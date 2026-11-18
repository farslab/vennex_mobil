/**
 * Bildirim inbox API — backend `views/notifications.py`, docs/API_CONTRACTS.md §2.11.
 * Liste: sabit 25'lik sayfa, `page` + `unread=true` dışında parametre yok; cache 120 sn
 * (okundu işaretleme kullanıcı cache versiyonunu artırır → sonraki liste isteği tazedir).
 */
import { apiClient } from "./client";
import { toNumber } from "@/utils/number";
import type { NotificationItem, NotificationsPage } from "@/types/notifications";

export interface NotificationListParams {
  page?: number;
  unreadOnly?: boolean;
}

function normalizeItem(raw: NotificationItem): NotificationItem {
  const data = raw.data && typeof raw.data === "object" && !Array.isArray(raw.data) ? raw.data : null;
  return {
    ...raw,
    description: typeof raw.description === "string" ? raw.description : null,
    unread: raw.unread === true,
    data,
  };
}

export function normalizeNotificationsPage(raw: Partial<NotificationsPage> | null | undefined): NotificationsPage {
  const results = Array.isArray(raw?.results) ? raw!.results.map(normalizeItem) : [];
  return {
    count: toNumber(raw?.count) ?? results.length,
    page: toNumber(raw?.page) ?? 1,
    num_pages: toNumber(raw?.num_pages) ?? 1,
    unread_count: toNumber(raw?.unread_count) ?? 0,
    results,
  };
}

export const notificationsApi = {
  list: (params: NotificationListParams = {}, signal?: AbortSignal) =>
    apiClient
      .get<NotificationsPage>("/notifications/", {
        params: {
          page: params.page ?? 1,
          // backend: query_params.get("unread") == "true" (`notifications.py:35`)
          ...(params.unreadOnly ? { unread: "true" } : {}),
        },
        signal,
      })
      .then((r) => normalizeNotificationsPage(r.data)),

  unreadCount: (signal?: AbortSignal) =>
    apiClient
      .get<{ unread_count: number }>("/notifications/unread-count/", { signal })
      .then((r) => Number(r.data.unread_count) || 0),

  markRead: (id: number) =>
    apiClient.post<{ detail: string }>(`/notifications/${id}/read/`).then((r) => r.data),

  markAllRead: () =>
    apiClient
      .post<{ detail: string; count: number }>("/notifications/read-all/")
      .then((r) => ({ detail: r.data?.detail ?? "", count: toNumber(r.data?.count) ?? 0 })),
};
