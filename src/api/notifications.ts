import { apiClient } from "./client";
import type { Paginated } from "@/types/common";
import type { NotificationItem } from "@/types/notifications";

export const notificationsApi = {
  list: (params: { page?: number; unreadOnly?: boolean } = {}) =>
    apiClient
      .get<Paginated<NotificationItem>>("/notifications/", {
        params: {
          page: params.page ?? 1,
          ...(params.unreadOnly ? { unread: true } : {}),
        },
      })
      .then((r) => r.data),

  unreadCount: () =>
    apiClient.get<{ unread_count: number }>("/notifications/unread-count/").then((r) => r.data.unread_count),

  markRead: (id: number) => apiClient.post(`/notifications/${id}/read/`),

  markAllRead: () => apiClient.post("/notifications/read-all/"),
};
