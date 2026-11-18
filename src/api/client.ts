import axios, { AxiosError, AxiosInstance, InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "@/config/env";
import { tokenStorage } from "@/utils/tokenStorage";
import type { ApiErrorBody } from "@/types/auth";

export const API_PREFIX = "/api/v1/vennexmobile";

// skipAuth: true işaretli isteklere Authorization header eklenmez
declare module "axios" {
  export interface AxiosRequestConfig {
    skipAuth?: boolean;
  }
  export interface InternalAxiosRequestConfig {
    skipAuth?: boolean;
  }
}

export const apiClient: AxiosInstance = axios.create({
  baseURL: `${API_BASE_URL}${API_PREFIX}`,
  timeout: 20000,
  headers: { "Content-Type": "application/json", Accept: "application/json" },
});

let onUnauthorized: (() => void) | null = null;
export function registerUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

/** Seçili şirket → X-Company-Id header (backend mixins.CompanyContextMixin) */
let companyProvider: (() => number | null) | null = null;
export function registerCompanyProvider(provider: () => number | null) {
  companyProvider = provider;
}

// --- Refresh reentrancy guard: eşzamanlı 401'lerde tek refresh isteği ---
let refreshPromise: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = await tokenStorage.getRefresh();
  if (!refreshToken) return null;
  try {
    const { data } = await apiClient.post<{ access: string; refresh?: string }>(
      "/auth/refresh/",
      { refresh: refreshToken },
      { skipAuth: true }
    );
    await tokenStorage.setTokens(data.access, data.refresh ?? refreshToken);
    return data.access;
  } catch {
    await tokenStorage.clear();
    return null;
  }
}

apiClient.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
  if (config.skipAuth) return config;
  const access = await tokenStorage.getAccess();
  if (access) config.headers.Authorization = `Bearer ${access}`;
  const companyId = companyProvider?.();
  if (companyId != null && !config.headers["X-Company-Id"]) {
    config.headers["X-Company-Id"] = String(companyId);
  }
  return config;
});

apiClient.interceptors.response.use(
  (res) => res,
  async (error: AxiosError<ApiErrorBody>) => {
    const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

    if (error.response?.status === 401 && original && !original._retry && !original.skipAuth) {
      original._retry = true;
      refreshPromise ??= refreshAccessToken().finally(() => {
        refreshPromise = null;
      });
      const newToken = await refreshPromise;
      if (!newToken) {
        onUnauthorized?.();
        return Promise.reject(normalizeError(error));
      }
      original.headers.Authorization = `Bearer ${newToken}`;
      return apiClient(original);
    }

    return Promise.reject(normalizeError(error));
  }
);

export type ApiError = Error & {
  status?: number;
  body?: ApiErrorBody;
  /** DRF alan bazlı doğrulama hataları: { alan: "mesaj" } */
  fieldErrors?: Record<string, string>;
  /** İstek hiç sunucuya ulaşamadı (ağ yok / zaman aşımı) */
  isNetworkError?: boolean;
};

const STATUS_MESSAGES: Record<number, string> = {
  403: "Bu işlem için yetkiniz yok.",
  404: "Kayıt bulunamadı.",
  429: "Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.",
  500: "Sunucuda bir hata oluştu. Lütfen daha sonra tekrar deneyin.",
  502: "Sunucuya şu anda ulaşılamıyor.",
  503: "Servis geçici olarak kullanılamıyor.",
  504: "Sunucu zamanında yanıt vermedi.",
};

function firstMessage(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (Array.isArray(value)) return value.map(firstMessage).find(Boolean) ?? null;
  if (value && typeof value === "object") return Object.values(value).map(firstMessage).find(Boolean) ?? null;
  return null;
}

/** Backend hatasını kullanıcıya gösterilebilir, alan bazlı bilgi içeren tek tip hataya çevirir */
export function normalizeError(error: AxiosError<ApiErrorBody>): ApiError {
  const status = error.response?.status;
  const body = error.response?.data;

  let fieldErrors: Record<string, string> | undefined;
  if (body && typeof body === "object" && !Array.isArray(body)) {
    for (const [key, val] of Object.entries(body)) {
      if (["detail", "message", "error", "code"].includes(key)) continue;
      const msg = firstMessage(val);
      if (msg) (fieldErrors ??= {})[key] = msg;
    }
  }

  const isNetworkError = !error.response;
  let message: string | null =
    (typeof body?.detail === "string" && body.detail) ||
    (typeof body?.message === "string" && body.message) ||
    (typeof body?.error === "string" && body.error) ||
    (fieldErrors ? Object.values(fieldErrors)[0] : null) ||
    (status ? STATUS_MESSAGES[status] : null) ||
    null;

  if (!message && isNetworkError) {
    message =
      error.code === "ECONNABORTED" || error.code === "ETIMEDOUT"
        ? "İstek zaman aşımına uğradı. Bağlantınızı kontrol edip tekrar deneyin."
        : "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.";
  }

  const err = new Error(message || error.message || "Bilinmeyen bir hata oluştu") as ApiError;
  err.status = status;
  err.body = body;
  err.fieldErrors = fieldErrors;
  err.isNetworkError = isNetworkError;
  return err;
}

/** UI tarafında güvenli hata mesajı */
export function errorMessage(error: unknown, fallback = "Bir hata oluştu."): string {
  if (error instanceof Error && error.message) return error.message;
  return fallback;
}
