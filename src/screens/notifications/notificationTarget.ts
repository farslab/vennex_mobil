/**
 * Bildirim → uygulama içi rota eşlemesi (docs/API_CONTRACTS.md §3.14, backend `tasks.py`).
 * Yalnız payload'ı rotanın ihtiyacını karşılayan event'ler eşlenir; diğerleri yalnızca okundu işaretlenir.
 * FCM data değerleri string gelir (`fcm_service.py:54`) → sayılar güvenle parse edilir.
 */
import type { IconName } from "@/design-system";
import type { RootStackParamList } from "@/navigation/types";
import type { NotificationItem } from "@/types/notifications";
import type { AuthUser } from "@/types/auth";
import { canManagePersonelCard, canViewSales, isOwner } from "@/auth/permissions";

export type NotificationTarget =
  | { name: "DeviceDetail"; params: RootStackParamList["DeviceDetail"] }
  | { name: "CardDetail"; params: RootStackParamList["CardDetail"] }
  | { name: "Reports"; params?: undefined }
  | { name: "CompanyAccount"; params?: undefined };

const nonEmpty = (v: unknown): string | null => {
  if (typeof v === "string" && v.trim()) return v.trim();
  if (typeof v === "number" && Number.isFinite(v)) return String(v);
  return null;
};

const positiveInt = (v: unknown): number | null => {
  const s = nonEmpty(v);
  if (!s || !/^\d+$/.test(s)) return null;
  const n = Number(s);
  return n > 0 ? n : null;
};

export function notificationEvent(item: Pick<NotificationItem, "data">): string | null {
  return nonEmpty(item.data?.event);
}

export function resolveNotificationTarget(
  item: Pick<NotificationItem, "data">,
  user: AuthUser | null | undefined
): NotificationTarget | null {
  const data = item.data;
  if (!data) return null;
  switch (notificationEvent(item)) {
    case "device.offline":
    case "transaction.new":
    case "stock.low": {
      const sn = nonEmpty(data.sn);
      return sn ? { name: "DeviceDetail", params: { sn } } : null;
    }
    case "card.pending": {
      const id = positiveInt(data.card_id);
      return id && canManagePersonelCard(user) ? { name: "CardDetail", params: { id } } : null;
    }
    case "report.ready":
      // `url` web dosya bağlantısıdır; mobilde rapor listesi açılır (indirme orada yetkili yapılır)
      return canViewSales(user) ? { name: "Reports" } : null;
    case "cari.overdue":
      // Cari ekranı yalnız owner (backend IsOwner)
      return isOwner(user) ? { name: "CompanyAccount" } : null;
    default:
      return null;
  }
}

export function notificationIcon(item: Pick<NotificationItem, "data">): IconName {
  switch (notificationEvent(item)) {
    case "device.offline":
      return "wifi-off";
    case "transaction.new":
      return "credit-card";
    case "stock.low":
      return "package";
    case "card.pending":
      return "user-check";
    case "report.ready":
      return "file-text";
    case "cari.overdue":
      return "alert-circle";
    default:
      return "bell";
  }
}
