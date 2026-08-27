import axios, { AxiosError, AxiosInstance, AxiosRequestConfig, InternalAxiosRequestConfig } from "axios";
import Constants from "expo-constants";
import { tokenStorage } from "@/utils/tokenStorage";
import type { ApiErrorBody } from "@/types/auth";

const API_BASE_URL =
  (Constants.expoConfig?.extra?.apiBaseUrl as string) ?? "https://tms.vennex.com.tr";
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
  headers: { "Content-Type": "application/json" },
});

// Wallet servisi vennexmobile prefix'i DIŞINDA (ör. /api/wallet/complaint/)
export const rootApiClient: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 20000,
  headers: { "Content-Type": "application/json" },
});

let onUnauthorized: (() => void) | null = null;
export function registerUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

function attachAuthInterceptor(instance: AxiosInstance) {
  instance.interceptors.request.use(async (config: InternalAxiosRequestConfig) => {
    if (config.skipAuth) return config;
    const access = await tokenStorage.getAccess();
    if (access) {
      config.headers.Authorization = `Bearer ${access}`;
    }
    return config;
  });

  // --- Refresh reentrancy guard ---
  let isRefreshing = false;
  let refreshWaiters: Array<(token: string | null) => void> = [];

  function subscribeRefresh(cb: (token: string | null) => void) {
    refreshWaiters.push(cb);
  }
  function notifyRefreshed(token: string | null) {
    refreshWaiters.forEach((cb) => cb(token));
    refreshWaiters = [];
  }

  instance.interceptors.response.use(
    (res) => res,
    async (error: AxiosError<ApiErrorBody>) => {
      const original = error.config as (InternalAxiosRequestConfig & { _retry?: boolean }) | undefined;

      if (error.response?.status === 401 && original && !original._retry && !original.skipAuth) {
        const refreshToken = await tokenStorage.getRefresh();
        if (!refreshToken) {
          onUnauthorized?.();
          return Promise.reject(normalizeError(error));
        }

        if (isRefreshing) {
          return new Promise((resolve, reject) => {
            subscribeRefresh((newToken) => {
              if (!newToken) {
                reject(normalizeError(error));
                return;
              }
              original._retry = true;
              original.headers.Authorization = `Bearer ${newToken}`;
              resolve(instance(original));
            });
          });
        }

        isRefreshing = true;
        try {
          const { data } = await apiClient.post<{ access: string; refresh: string }>(
            "/auth/refresh/",
            { refresh: refreshToken },
            { skipAuth: true }
          );
          await tokenStorage.setTokens(data.access, data.refresh ?? refreshToken);
          isRefreshing = false;
          notifyRefreshed(data.access);

          original._retry = true;
          original.headers.Authorization = `Bearer ${data.access}`;
          return instance(original);
        } catch (refreshError) {
          isRefreshing = false;
          notifyRefreshed(null);
          await tokenStorage.clear();
          onUnauthorized?.();
          return Promise.reject(normalizeError(error));
        }
      }

      return Promise.reject(normalizeError(error));
    }
  );
}

export function normalizeError(error: AxiosError<ApiErrorBody>): Error & { status?: number; body?: ApiErrorBody } {
  const status = error.response?.status;
  const body = error.response?.data;
  const message =
    body?.detail || body?.message || body?.error || error.message || "Bilinmeyen bir hata oluştu";
  const err = new Error(message) as Error & { status?: number; body?: ApiErrorBody };
  err.status = status;
  err.body = body;
  return err;
}

attachAuthInterceptor(apiClient);
attachAuthInterceptor(rootApiClient);