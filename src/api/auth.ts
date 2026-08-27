import { apiClient } from "./client";
import type { AuthUser, LoginResponse, NotificationPreferences } from "@/types/auth";

export const authApi = {
  login: (username: string, password: string) =>
    apiClient
      .post<LoginResponse>("/auth/login/", { username, password }, { skipAuth: true })
      .then((r) => r.data),

  verify2FA: (session_token: string, otp: string) =>
    // Backend 400'ü de gövdeyle döndürebilir (requires_2fa: true, attempts_left...)
    // Bu yüzden burada validateStatus ile 400'ü de "başarılı" HTTP yanıtı sayıyoruz.
    apiClient
      .post<LoginResponse>(
        "/auth/2fa/verify/",
        { session_token, otp },
        { skipAuth: true, validateStatus: (s) => s < 400 || s === 400 }
      )
      .then((r) => r.data),

  refresh: (refresh: string) =>
    apiClient
      .post<{ access: string; refresh: string }>("/auth/refresh/", { refresh }, { skipAuth: true })
      .then((r) => r.data),

  logout: (refresh: string) => apiClient.post("/auth/logout/", { refresh }),

  me: () => apiClient.get<AuthUser>("/auth/me/").then((r) => r.data),

  updateMe: (patch: Partial<Pick<AuthUser, "first_name" | "last_name" | "email" | "phone">>) =>
    apiClient.patch<AuthUser>("/auth/me/", patch).then((r) => r.data),

  changePassword: (current_password: string, new_password: string) =>
    apiClient.post("/auth/change-password/", { current_password, new_password }),

  passwordReset: (email: string) =>
    apiClient.post("/auth/password-reset/", { email }, { skipAuth: true }),

  passwordResetConfirm: (uid: string, token: string, new_password: string) =>
    apiClient.post("/auth/password-reset/confirm/", { uid, token, new_password }, { skipAuth: true }),

  deactivate: (password: string) => apiClient.post("/auth/deactivate/", { password }),
  deleteAccount: (password: string) => apiClient.post("/auth/delete/", { password }),

  // 2FA setup akışı
  get2FAStatus: () => apiClient.get<{ is_enabled: boolean }>("/auth/2fa/status/").then((r) => r.data),
  setup2FA: () =>
    apiClient
      .post<{ device_id: number; secret: string; otpauth_url: string }>("/auth/2fa/setup/")
      .then((r) => r.data),
  enable2FA: (otp: string) => apiClient.post("/auth/2fa/enable/", { otp }),
  disable2FA: (password: string) => apiClient.post("/auth/2fa/disable/", { password }),

  // FCM push bildirimleri
  registerDevice: (fcm_token: string, platform: "ios" | "android", device_id: string) =>
    apiClient.post("/device/register/", { fcm_token, platform, device_id }),
  unregisterDevice: (fcm_token: string) => apiClient.post("/device/unregister/", { fcm_token }),

  getNotificationPreferences: () =>
    apiClient.get<NotificationPreferences>("/me/notification-preferences/").then((r) => r.data),
  updateNotificationPreferences: (patch: Partial<NotificationPreferences>) =>
    apiClient.patch<NotificationPreferences>("/me/notification-preferences/", patch).then((r) => r.data),
};
