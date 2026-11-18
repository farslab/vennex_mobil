/**
 * Bildirim inbox şemaları — backend `views/notifications.py:19-79`, docs/API_CONTRACTS.md §2.11, §3.14.
 */
import type { PageResponse } from "@/api/pagination";

export interface NotificationItem {
  id: number;
  timestamp: string | null;
  verb: string;
  description: string | null;
  unread: boolean;
  actor_str?: string | null;
  target_str?: string | null;
  /** `n.data or None` → null olabilir (`notifications.py:28`). Deep link için `data.event` okunur. */
  data: Record<string, unknown> | null;
}

/** GET /notifications/ — sabit 25'lik sayfa + `unread_count` (`notifications.py:40-53`) */
export interface NotificationsPage extends PageResponse<NotificationItem> {
  unread_count: number;
}

/**
 * Backend'in ürettiği event'ler (`tasks.py`): FCM data değerleri string'e çevrilir (`fcm_service.py:54`).
 * SÖZLEŞME: inbox kaydının `data` alanının push payload'ı ile aynı olduğu kopyada doğrulanamadı
 * (inbox kayıtlarını oluşturan kod backend-ref'te yok); null-safe okunur.
 */
export type NotificationEvent =
  | "device.offline"
  | "transaction.new"
  | "stock.low"
  | "card.pending"
  | "report.ready"
  | "cari.overdue"
  | "test";
