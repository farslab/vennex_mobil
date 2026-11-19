import { tokenStorage } from "@/utils/tokenStorage";
import { apiClient } from "./client";
import type { AuthUser, LoginResponse, NotificationPreferences } from "@/types/auth";
import { clientPlatform, nativeAppVersion } from "./appConfig";
import type {
  AccountDeletionRequest,
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

  /**
   * Refresh token'ı kara listeye alır. Token'lar silinmeden ÖNCE ve erişim token'ı AÇIKÇA verilerek
   * çağrılır (skipAuth): aksi halde istek token'sız gider → 401 → refresh kara listeye girmez ve
   * istemcinin "oturum sona erdi" akışı tetiklenir (yerel gerçek backend E2E'sinde yakalandı).
   */
  logout: (refresh: string, access?: string | null) =>
    apiClient.post(
      "/auth/logout/",
      { refresh },
      { skipAuth: true, timeout: 5000, headers: access ? { Authorization: `Bearer ${access}` } : undefined }
    ),

  me: (signal?: AbortSignal) => apiClient.get<AuthUser>("/auth/me/", { signal }).then((r) => r.data),

  /** PATCH auth/me/ — kısmi; yanıt güncel AuthUser (views/auth.py:260-275) */
  updateMe: (patch: ProfileUpdatePayload) => apiClient.patch<AuthUser>("/auth/me/", patch).then((r) => r.data),

  /** 200 {detail}; hata: {current_password:[…]} / {new_password:[…]}. Backend diğer oturumları düşürür. */
  /**
   * Sunucu TÜM refresh token'ları kara listeye alır (bu cihazınki dahil) ve bu cihaza yeni bir çift
   * döner; çift saklanınca bu cihazda oturum açık kalır. `sessionKept: false` → eski sunucu, çift yok.
   */
  changePassword: async (current_password: string, new_password: string) => {
    const { data } = await apiClient.post<DetailResponse & { access?: string; refresh?: string }>(
      "/auth/change-password/",
      { current_password, new_password }
    );
    if (data.access && data.refresh) {
      await tokenStorage.setTokens(data.access, data.refresh);
      return { detail: data.detail, sessionKept: true };
    }
    return { detail: data.detail, sessionKept: false };
  },



  /**
   * Hesap silme TALEBİ — hesap silinmez, oturum açık kalır; Nexus'a "Hesap silme talebi" kaydı düşer.
   * 201 yeni talep · 200 açık talep zaten var (`already: true`) · 400 {password:["Parola hatalı."]}.
   * (Hesap dondurma ucu backend'den kaldırıldı.)
   */
  requestAccountDeletion: (password: string) =>
    apiClient
      .post<AccountDeletionRequest>("/auth/delete/", {
        password,
        platform: clientPlatform() ?? undefined,
        app_version: nativeAppVersion(),
      })
      .then((r): AccountDeletionRequest & { already: boolean } => ({ ...r.data, already: r.status === 200 })),

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
  // Çıkışta beklenir: kötü ağda çıkış düğmesi uzun süre takılmasın
  unregisterDevice: (fcm_token: string) => apiClient.post("/device/unregister/", { fcm_token }, { timeout: 5000 }),

  getNotificationPreferences: (signal?: AbortSignal) =>
    apiClient.get<NotificationPreferences>("/me/notification-preferences/", { signal }).then((r) => r.data),
  updateNotificationPreferences: (patch: Partial<Omit<NotificationPreferences, "updated_at">>) =>
    apiClient.patch<NotificationPreferences>("/me/notification-preferences/", patch).then((r) => r.data),
};
