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

// --- Token yenileme ---
// Oturum YALNIZ sunucu yenileme token'ını gerçekten reddettiğinde (400/401) kapanır.
// Ağ yok / zaman aşımı / sunucu hatası (5xx) → token'lar korunur, kullanıcı oturumdan atılmaz.
type RefreshResult = { token: string } | { invalid: true } | { unavailable: ApiError };

/** Eşzamanlı 401'lerde ve arka plan tazelemesinde tek yenileme isteği */
let refreshPromise: Promise<RefreshResult> | null = null;

async function refreshAccessToken(): Promise<RefreshResult> {
  let refreshToken: string | null;
  try {
    refreshToken = await tokenStorage.getRefresh();
  } catch (e) {
    // Anahtar zinciri o an okunamadı: oturumu silme, sonra tekrar denenir
    return { unavailable: toApiError(e) };
  }
  if (!refreshToken) return { invalid: true };
  try {
    const { data } = await apiClient.post<{ access: string; refresh?: string }>(
      "/auth/refresh/",
      { refresh: refreshToken },
      { skipAuth: true }
    );
    await tokenStorage.setTokens(data.access, data.refresh ?? refreshToken);
    return { token: data.access };
  } catch (e) {
    const status = (e as ApiError).status;
    if (status === 400 || status === 401) {
      await tokenStorage.clear().catch(() => {});
      return { invalid: true };
    }
    return { unavailable: toApiError(e) };
  }
}

function runRefresh(): Promise<RefreshResult> {
  refreshPromise ??= refreshAccessToken().finally(() => {
    refreshPromise = null;
  });
  return refreshPromise;
}

function toApiError(e: unknown): ApiError {
  if (e instanceof Error) return e as ApiError;
  const err = new Error("Sunucuya ulaşılamıyor. Bağlantınızı kontrol edin.") as ApiError;
  err.isNetworkError = true;
  return err;
}

/** JWT gövdesindeki `iat` (saniye); çözülemezse null */
function tokenIssuedAt(token: string): number | null {
  try {
    const part = token.split(".")[1];
    if (!part) return null;
    const b64 = part.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(part.length / 4) * 4, "=");
    const payload = JSON.parse(globalThis.atob(b64)) as { iat?: unknown };
    return typeof payload.iat === "number" ? payload.iat : null;
  } catch {
    return null;
  }
}

/** Yenileme token'ı bundan eskiyse uygulama açılışında/öne gelişinde arka planda tazelenir */
export const SESSION_SLIDE_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * Kayan oturum: yenileme token'ının ömrü (sunucuda 30 gün) son açılıştan itibaren işlesin.
 * Uygulama açıldığında/öne geldiğinde token bir günden eskiyse sessizce yenilenir.
 * Hata kullanıcıya gösterilmez ve oturumu kapatmaz (sunucu token'ı reddetmediği sürece).
 */
export async function refreshSessionIfStale(now: number = Date.now()): Promise<boolean> {
  let refreshToken: string | null = null;
  try {
    refreshToken = await tokenStorage.getRefresh();
  } catch {
    return false;
  }
  if (!refreshToken) return false;
  const iat = tokenIssuedAt(refreshToken);
  if (iat != null && now - iat * 1000 < SESSION_SLIDE_AFTER_MS) return false;
  const res = await runRefresh();
  return "token" in res;
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
      const res = await runRefresh();
      if ("token" in res) {
        original.headers.Authorization = `Bearer ${res.token}`;
        return apiClient(original);
      }
      if ("unavailable" in res) {
        // Yenileme isteği sunucuya ulaşamadı / sunucu hatası: oturum geçerli olabilir → çıkış YOK.
        // İstek bağlantı hatası olarak döner (ekranlar "tekrar dene" gösterir).
        return Promise.reject(res.unavailable);
      }
      onUnauthorized?.();
      return Promise.reject(normalizeError(error));
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
      // Genel mesaj anahtarları yalnız düz metinken genel sayılır; DRF'de aynı adlı bir ALANIN
      // doğrulama hatası dizi olarak gelir (ör. geri bildirimdeki `message` alanı) → alan hatası.
      if (["detail", "message", "error", "code"].includes(key) && typeof val === "string") continue;
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
