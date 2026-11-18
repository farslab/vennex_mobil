import { AppState, Platform, type AppStateStatus } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { focusManager, onlineManager, QueryClient } from "@tanstack/react-query";

type ErrorWithStatus = Error & { status?: number };

/**
 * Akıllı retry: 4xx (yetki, doğrulama, bulunamadı) tekrar denenmez — sunucuyu boşuna yormaz.
 * Ağ hatası / 5xx en fazla 2 kez, üstel bekleme ile denenir.
 */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const status = (error as ErrorWithStatus)?.status;
  if (status && status >= 400 && status < 500 && status !== 408 && status !== 429) return false;
  return failureCount < 2;
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: shouldRetry,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 8000),
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      // Uygulama ön plana dönünce yalnızca bayat sorgular yenilenir
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
    },
    mutations: {
      // Finansal/stok işlemleri ASLA otomatik tekrarlanmaz (çift işlem riski)
      retry: false,
    },
  },
});

let lifecycleBound = false;

/**
 * React Query'yi mobil yaşam döngüsüne bağlar:
 *  - Uygulama arka plandayken polling/refetch durur (AppState → focusManager)
 *  - Ağ yokken sorgular beklemeye alınır (NetInfo → onlineManager)
 */
export function bindQueryLifecycle() {
  if (lifecycleBound || Platform.OS === "web") return;
  lifecycleBound = true;

  onlineManager.setEventListener((setOnline) =>
    NetInfo.addEventListener((state) => {
      setOnline(state.isConnected !== false);
    })
  );

  const onAppStateChange = (status: AppStateStatus) => focusManager.setFocused(status === "active");
  const sub = AppState.addEventListener("change", onAppStateChange);
  return () => sub.remove();
}
