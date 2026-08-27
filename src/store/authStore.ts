import { create } from "zustand";
import { authApi } from "@/api/auth";
import { registerUnauthorizedHandler } from "@/api/client";
import { tokenStorage } from "@/utils/tokenStorage";
import type { AuthUser } from "@/types/auth";

type AuthStatus = "booting" | "unauthenticated" | "requires_2fa" | "authenticated";

interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  sessionToken: string | null; // 2FA akışı için (5 dk TTL)
  attemptsLeft: number | null;
  errorMessage: string | null;

  bootstrap: () => Promise<void>;
  login: (username: string, password: string) => Promise<void>;
  verify2FA: (otp: string) => Promise<void>;
  logout: () => Promise<void>;
  setUser: (user: AuthUser) => void;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  status: "booting",
  user: null,
  sessionToken: null,
  attemptsLeft: null,
  errorMessage: null,

  // Uygulama açılışında: token varsa /auth/me/ ile doğrula, yoksa login ekranına düş
  bootstrap: async () => {
    const access = await tokenStorage.getAccess();
    if (!access) {
      set({ status: "unauthenticated" });
      return;
    }
    try {
      const user = await authApi.me();
      set({ status: "authenticated", user });
    } catch {
      await tokenStorage.clear();
      set({ status: "unauthenticated" });
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
      await tokenStorage.setTokens(res.access, res.refresh);
      set({ status: "authenticated", user: res.user, sessionToken: null });
    }
  },

  verify2FA: async (otp) => {
    const { sessionToken } = get();
    if (!sessionToken) {
      set({ errorMessage: "Oturum süresi doldu, lütfen tekrar giriş yapın." });
      set({ status: "unauthenticated" });
      return;
    }

    const res = await authApi.verify2FA(sessionToken, otp);

    // Backend 400 + requires_2fa:true dönerse -> retry edilebilir, OTP ekranında kal
    if (res.requires_2fa) {
      set({
        sessionToken: res.session_token ?? sessionToken,
        attemptsLeft: res.attempts_left ?? null,
        errorMessage: res.detail ?? "Geçersiz kod, tekrar deneyin.",
      });
      return;
    }

    if (res.access && res.refresh && res.user) {
      await tokenStorage.setTokens(res.access, res.refresh);
      set({ status: "authenticated", user: res.user, sessionToken: null, errorMessage: null });
    }
  },

  logout: async () => {
    const refresh = await tokenStorage.getRefresh();
    // Fire-and-forget: backend isteği başarısız olsa da istemci logout'u tamamlar
    if (refresh) {
      authApi.logout(refresh).catch(() => {});
    }
    await tokenStorage.clear();
    set({ status: "unauthenticated", user: null, sessionToken: null, attemptsLeft: null });
  },

  setUser: (user) => set({ user }),
  clearError: () => set({ errorMessage: null }),
}));

// api/client.ts'deki 401 handler'ı buraya bağlıyoruz (circular import olmadan)
registerUnauthorizedHandler(() => {
  useAuthStore.setState({ status: "unauthenticated", user: null, sessionToken: null });
});
