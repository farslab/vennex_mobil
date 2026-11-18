import { useQuery } from "@tanstack/react-query";
import { notificationsApi } from "@/api/notifications";
import { queryKeys } from "@/api/queryKeys";
import { useAuthStore } from "@/store/authStore";

/**
 * Okunmamış bildirim sayısı — tüm başlıklar aynı sorguyu paylaşır (tek istek).
 * Backend 60 sn cache'ler; uygulama arka plandayken polling durur (focusManager).
 */
export function useUnreadNotificationCount(): number {
  const authed = useAuthStore((s) => s.status === "authenticated");
  const { data } = useQuery({
    queryKey: queryKeys.notifications.unreadCount(),
    queryFn: ({ signal }) => notificationsApi.unreadCount(signal),
    enabled: authed,
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
  return data ?? 0;
}
