import { useAuthStore } from "@/store/authStore";
import { canChangeCardBalance, canManagePersonelCard, canViewSales, isOwner } from "@/auth/permissions";
import type { DeviceOptionSource } from "@/types/cards";

/** Kart modülünde arayüzü düzenleyen yetkiler (varsayılan RED; asıl kontrol backend'de) */
export function useCardAccess() {
  const user = useAuthStore((s) => s.user);
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  const deviceSource: DeviceOptionSource | null = isOwner(user)
    ? "assignable-options"
    : canViewSales(user)
      ? "report-filter-options"
      : null;
  return {
    canManage: canManagePersonelCard(user),
    canChangeBalance: canChangeCardBalance(user),
    deviceSource,
    companyId,
  };
}
