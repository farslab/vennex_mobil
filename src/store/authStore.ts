import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { authApi } from "@/api/auth";
import { registerCompanyProvider, registerUnauthorizedHandler } from "@/api/client";
import { tokenStorage } from "@/utils/tokenStorage";
import { queryClient } from "@/store/queryClient";
import { stopPush } from "@/push/pushService";
import type { AuthUser, Company } from "@/types/auth";

/**
 * `offline`: kayıtlı oturum var ama açılışta sunucuya ulaşılamadı (ağ yok / 5xx).
 * Token'lar korunur; kullanıcı giriş ekranına atılmaz, bağlantı ekranından tekrar dener.
 */
type AuthStatus = "booting" | "offline" | "unauthenticated" | "requires_2fa" | "authenticated";

/** Seçili şirket hassas veri değildir; kullanıcı bazında saklanır */
const companyKey = (userId: number) => `vennex.selectedCompany.${userId}`;

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  /** Backend X-Company-Id header'ı ile gönderilir (mixins.CompanyContextMixin) */
  selectedCompanyId: number | null;
  sessionToken: string | null; // 2FA akışı için (5 dk TTL)
  attemptsLeft: number | null;
  errorMessage: string | null;

  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  verify2FA: (otp: string) => Promise<void>;
  cancel2FA: () => void;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
  selectCompany: (companyId: number) => Promise<void>;
  clearError: () => void;
}

const initialSession = {
  user: null,
  selectedCompanyId: null,
  sessionToken: null,
  attemptsLeft: null,
  errorMessage: null,
};

/** Kayıtlı seçim hâlâ erişilebilir bir şirketse onu, değilse ilk şirketi seçer */
async function resolveCompanyId(user: AuthUser): Promise<number | null> {
  const companies = user.companies ?? [];
  if (companies.length === 0) return null;
  try {
    const saved = Number(await AsyncStorage.getItem(companyKey(user.id)));
    if (saved && companies.some((c) => c.id === saved)) return saved;
  } catch {
    // depolama okunamazsa ilk şirkete düş
  }
  return companies[0].id;
}

export const useAuthStore = create<AuthState>((set, get) => {
  /** Oturum açıldığında ortak adımlar */
  const establishSession = async (access: string, refresh: string, user: AuthUser) => {
    await tokenStorage.setTokens(access, refresh);
    // Önceki kullanıcının önbelleği yeni oturuma sızmasın
    queryClient.clear();
    const selectedCompanyId = await resolveCompanyId(user);
    set({ ...initialSession, status: "authenticated", user, selectedCompanyId });
  };

  return {
    status: "booting",
    ...initialSession,

    // Uygulama açılışında: token varsa /auth/me/ ile doğrula, yoksa login ekranına düş
    bootstrap: async () => {
      // Yeniden kurulumda Keychain'de kalan eski oturumu açma
      await tokenStorage.resetIfFreshInstall();
      const access = await tokenStorage.getAccess();
      if (!access) {
        set({ status: "unauthenticated" });
        return;
      }
      try {
        const user = await authApi.me();
        const selectedCompanyId = await resolveCompanyId(user);
        set({ status: "authenticated", user, selectedCompanyId, errorMessage: null });
      } catch (e) {
        const status = (e as { status?: number }).status;
        if (status === 401 || status === 403) {
          await tokenStorage.clear();
          set({ status: "unauthenticated", errorMessage: null });
          return;
        }
        // Ağ hatası / sunucu hatası: oturum geçerli olabilir — silme, bağlantı ekranında tekrar denensin
        set({ status: "offline", errorMessage: (e as Error).message });
      }
    },

    login: async (username, password) => {
      set({ errorMessage: null });
      const res = await authApi.login(username, password);

      if (res.requires_2fa) {
        set({
          status: "requires_2fa",
          sessionToken: res.session_token ?? null,
          attemptsLeft: res.attempts_left ?? null,
        });
        return;
      }

      if (res.access && res.refresh && res.user) {
        await establishSession(res.access, res.refresh, res.user);
        return;
      }
      throw new Error("Sunucudan beklenmeyen yanıt alındı.");
    },

    verify2FA: async (otp) => {
      const { sessionToken } = get();
      if (!sessionToken) {
        set({ status: "unauthenticated", errorMessage: "Oturum süresi doldu, lütfen tekrar giriş yapın." });
        return;
      }

      let res;
      try {
        res = await authApi.verify2FA(sessionToken, otp);
      } catch (e) {
        // 401: oturum süresi doldu / çok fazla hatalı deneme → girişe dön
        const status = (e as { status?: number }).status;
        if (status === 401 || status === 404) {
          set({ ...initialSession, status: "unauthenticated", errorMessage: (e as Error).message });
          return;
        }
        set({ errorMessage: (e as Error).message });
        return;
      }

      // Backend 400 + requires_2fa:true dönerse → OTP ekranında kal
      if (res.requires_2fa) {
        set({
          sessionToken: res.session_token ?? sessionToken,
          attemptsLeft: res.attempts_left ?? null,
          errorMessage: res.detail ?? "Geçersiz kod, tekrar deneyin.",
        });
        return;
      }

      if (res.access && res.refresh && res.user) {
        await establishSession(res.access, res.refresh, res.user);
      }
    },

    cancel2FA: () => set({ ...initialSession, status: "unauthenticated" }),

    logout: async () => {
      // Push kaydı oturum token'ı geçerliyken silinir (aksi halde cihaz bildirim almaya devam eder)
      await stopPush();
      const [access, refresh] = await Promise.all([tokenStorage.getAccess(), tokenStorage.getRefresh()]);
      // Backend refresh token'ı kara listeye alır. Token'lar silinmeden önce, açık token'la ve
      // beklenerek gönderilir (en fazla 5 sn); başarısız olsa da istemci çıkışı tamamlanır.
      if (refresh) await authApi.logout(refresh, access).catch(() => {});
      await tokenStorage.clear();
      queryClient.clear();
      set({ ...initialSession, status: "unauthenticated" });
    },

    setUser: (user) => {
      const { selectedCompanyId } = get();
      const stillValid = user.companies?.some((c) => c.id === selectedCompanyId);
      set({ user, selectedCompanyId: stillValid ? selectedCompanyId : (user.companies?.[0]?.id ?? null) });
    },

    selectCompany: async (companyId) => {
      const { user, selectedCompanyId } = get();
      if (!user || companyId === selectedCompanyId) return;
      if (!user.companies.some((c) => c.id === companyId)) return;
      set({ selectedCompanyId: companyId });
      AsyncStorage.setItem(companyKey(user.id), String(companyId)).catch(() => {});
      // Şirket bazlı tüm veriler geçersiz — aktif ekranlar yeni şirketle yeniden yüklenir
      await queryClient.resetQueries();
    },

    clearError: () => set({ errorMessage: null }),
  };
});

/** Seçili şirket nesnesi */
export function useSelectedCompany(): Company | null {
  return useAuthStore((s) => s.user?.companies.find((c) => c.id === s.selectedCompanyId) ?? null);
}

// api/client.ts'deki 401 handler'ı ve şirket sağlayıcısını buraya bağlıyoruz (circular import olmadan)
registerUnauthorizedHandler(() => {
  queryClient.clear();
  useAuthStore.setState({ ...initialSession, status: "unauthenticated", errorMessage: "Oturumunuz sona erdi, lütfen tekrar giriş yapın." });
});
registerCompanyProvider(() => useAuthStore.getState().selectedCompanyId);
