import { apiClient } from "./client";
import type { AuthUser, LoginResponse, NotificationPreferences } from "@/types/auth";
import type {
  DetailResponse,
  ProfileUpdatePayload,
  TwoFactorSetup,
  TwoFactorStatus,
  TwoFactorToggleResponse,
} from "@/types/account";

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

  me: (signal?: AbortSignal) => apiClient.get<AuthUser>("/auth/me/", { signal }).then((r) => r.data),

  /** PATCH auth/me/ — kısmi; yanıt güncel AuthUser (views/auth.py:260-275) */
  updateMe: (patch: ProfileUpdatePayload) => apiClient.patch<AuthUser>("/auth/me/", patch).then((r) => r.data),

  /** 200 {detail}; hata: {current_password:[…]} / {new_password:[…]}. Backend diğer oturumları düşürür. */
  changePassword: (current_password: string, new_password: string) =>
    apiClient
      .post<DetailResponse>("/auth/change-password/", { current_password, new_password })
      .then((r) => r.data),

  passwordReset: (email: string) =>
    apiClient.post<DetailResponse>("/auth/password-reset/", { email }, { skipAuth: true }),

  passwordResetConfirm: (uid: string, token: string, new_password: string) =>
    apiClient.post<DetailResponse>("/auth/password-reset/confirm/", { uid, token, new_password }, { skipAuth: true }),

  /** 200 {detail}; parola hatalıysa 400 {password:["Parola hatalı."]} */
  deactivate: (password: string) =>
    apiClient.post<DetailResponse>("/auth/deactivate/", { password }).then(() => undefined),

  /** 204 — kullanıcı KALICI silinir; parola hatalıysa 400 {password:[…]} */
  deleteAccount: (password: string) => apiClient.post("/auth/delete/", { password }).then(() => undefined),

  // 2FA kurulum akışı: status → setup → enable{otp} / disable{password}
  get2FAStatus: (signal?: AbortSignal) =>
    apiClient.get<TwoFactorStatus>("/auth/2fa/status/", { signal }).then((r) => r.data),
  /** 400 {detail:"2FA zaten aktif.", is_enabled:true} olabilir */
  setup2FA: () => apiClient.post<TwoFactorSetup>("/auth/2fa/setup/").then((r) => r.data),
  /** 400 {detail:"Geçersiz kod."} / {detail:"Önce 2FA setup yapın."} */
  enable2FA: (otp: string) => apiClient.post<TwoFactorToggleResponse>("/auth/2fa/enable/", { otp }).then((r) => r.data),
  /** 400 {detail:"Parola hatalı."} (alan hatası değil, detail) */
  disable2FA: (password: string) =>
    apiClient.post<TwoFactorToggleResponse>("/auth/2fa/disable/", { password }).then((r) => r.data),

  // FCM push bildirimleri
  registerDevice: (fcm_token: string, platform: "ios" | "android", device_id: string) =>
    apiClient.post("/device/register/", { fcm_token, platform, device_id }),
  unregisterDevice: (fcm_token: string) => apiClient.post("/device/unregister/", { fcm_token }),

  getNotificationPreferences: (signal?: AbortSignal) =>
    apiClient.get<NotificationPreferences>("/me/notification-preferences/", { signal }).then((r) => r.data),
  updateNotificationPreferences: (patch: Partial<Omit<NotificationPreferences, "updated_at">>) =>
    apiClient.patch<NotificationPreferences>("/me/notification-preferences/", patch).then((r) => r.data),
};
