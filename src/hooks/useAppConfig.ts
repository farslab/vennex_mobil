import { useQuery } from "@tanstack/react-query";
import { appConfigApi, type AppConfig, type EnumOption } from "@/api/appConfig";
import { queryKeys } from "@/api/queryKeys";
import { useAuthStore } from "@/store/authStore";

/**
 * Sunucu yapılandırması (yetkiler, modüller, enum etiketleri). Şirket değişince
 * tüm sorgular sıfırlandığı için anahtar şirketten bağımsızdır; 5 dk bayat kabul edilir.
 */
export function useAppConfig() {
  const authed = useAuthStore((s) => s.status === "authenticated");
  return useQuery<AppConfig>({
    queryKey: queryKeys.appConfig(),
    queryFn: ({ signal }) => appConfigApi.config(signal),
    enabled: authed,
    staleTime: 5 * 60_000,
    // Eski backend'de uç yoksa (404) yerel kurallarla devam edilir; tekrar denenmez
    retry: (count, err) => (err as { status?: number })?.status !== 404 && count < 2,
  });
}

/** Sunucudan gelen enum etiketi; yoksa yerel yedek */
export function enumLabel(
  enums: Record<string, EnumOption[]> | undefined,
  key: string,
  value: unknown,
  fallback: string
): string {
  const found = enums?.[key]?.find((o) => o.value === value || String(o.value) === String(value));
  return found?.label ?? fallback;
}
