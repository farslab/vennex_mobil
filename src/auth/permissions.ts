/**
 * Mobil yetki sözlüğü — backend `vennex_mobile/permissions.py::compute_permissions` ile birebir.
 *
 * ÖNEMLİ: Bu kontroller yalnızca arayüzü düzenler (menü/buton gizleme). Asıl yetkilendirme
 * backend'de her endpoint'in permission_classes'ı ile yapılır. Varsayılan davranış REDDETMEKTİR:
 * yetki listesinde olmayan hiçbir şey "izinli" kabul edilmez.
 */
import type { AuthUser, Company } from "@/types/auth";

export const PERMISSIONS = [
  "owner",
  "tech",
  "view_sales",
  "manage_device_settings",
  "send_device_commands",
  "select_machine_type",
  "remote_vend",
  "manage_personel_card",
  "change_card_balance",
  "manage_stock",
] as const;

export type Permission = (typeof PERMISSIONS)[number];

export function hasPermission(user: Pick<AuthUser, "permissions" | "role"> | null | undefined, perm: Permission): boolean {
  if (!user) return false;
  if (!Array.isArray(user.permissions)) return false;
  return user.permissions.includes(perm);
}

export function isOwner(user: Pick<AuthUser, "role"> | null | undefined): boolean {
  return user?.role === "owner";
}

export function isAdmin(user: Pick<AuthUser, "role"> | null | undefined): boolean {
  return user?.role === "admin";
}

/** Kullanıcı yönetimi, bölgeler, cari: backend IsOwner (admin hariç) */
export function canManageUsers(user: AuthUser | null | undefined): boolean {
  return isOwner(user);
}

export function canViewSales(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, "view_sales");
}

export function canManageDeviceSettings(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, "manage_device_settings");
}

/** Cihaz komutları — kural backend'de tek yerde (dashboard_v2/capabilities.py), web ile aynı */
export function canSendDeviceCommands(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, "send_device_commands");
}

export function canSelectMachineType(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, "select_machine_type");
}

export function canRemoteVend(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, "remote_vend");
}

export function canManagePersonelCard(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, "manage_personel_card");
}

export function canChangeCardBalance(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, "change_card_balance");
}

export function canManageStock(user: AuthUser | null | undefined): boolean {
  return hasPermission(user, "manage_stock");
}

/**
 * Sunucunun döndürdüğü görünür modüller (GET /app/config/ → modules). Varsa TEK doğru
 * kaynaktır; yoksa (eski backend) aşağıdaki yerel kurallar yedek olarak kullanılır.
 */
export function moduleVisible(
  serverModules: { key: string }[] | undefined,
  key: string,
  fallback: () => boolean
): boolean {
  if (serverModules && serverModules.length > 0) return serverModules.some((m) => m.key === key);
  return fallback();
}

/** Kartlar sekmesi: yetki + seçili şirkette personel kart cihazı olmalı */
export function showCardsModule(user: AuthUser | null | undefined, company: Company | null | undefined): boolean {
  return canManagePersonelCard(user) && (isAdmin(user) || !!company?.has_personnel_card_device);
}

/** Stok sekmesi: yetki + seçili şirket stok modunda olmalı */
export function showStockModule(user: AuthUser | null | undefined, company: Company | null | undefined): boolean {
  return canManageStock(user) && (isAdmin(user) || !!company?.uses_stock_mode);
}

/** Cari durum (backend Company.cari_state) */
export const CARI_STATE = {
  0: { label: "Temiz", tone: "success" },
  1: { label: "Sarı", tone: "warning" },
  2: { label: "Kırmızı", tone: "danger" },
  3: { label: "Uyarı", tone: "warning" },
  4: { label: "Kilitli", tone: "danger" },
} as const;

export function cariStateInfo(state: number | null | undefined) {
  return CARI_STATE[(state ?? -1) as keyof typeof CARI_STATE] ?? { label: "Bilinmiyor", tone: "neutral" as const };
}
