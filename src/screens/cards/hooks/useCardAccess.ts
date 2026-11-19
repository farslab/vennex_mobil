import { useAppConfig } from "@/hooks/useAppConfig";
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
  const { data: config } = useAppConfig();
  // Belirli kart gruplarıyla sınırlı teknisyen (sunucu bayrağı; web aynı butonları gizler)
  const scopeRestricted = config?.card_scope_restricted === true;
  return {
    canManage: canManagePersonelCard(user),
    scopeRestricted,
    /** Grup oluşturma/düzenleme/silme (web `nfc_card_groups.html:7,75,94`) */
    canManageGroups: canManagePersonelCard(user) && !scopeRestricted,
    canChangeBalance: canChangeCardBalance(user),
    deviceSource,
    companyId,
  };
}
