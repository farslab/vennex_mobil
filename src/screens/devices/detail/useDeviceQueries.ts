import { useQuery, useQueryClient } from "@tanstack/react-query";
import { devicesApi } from "@/api/devices";
import { queryKeys } from "@/api/queryKeys";
import { useAuthStore } from "@/store/authStore";
import {
  canManageDeviceSettings,
  canSendDeviceCommands,
  canManageStock,
  canRemoteVend,
  canSelectMachineType,
  canViewSales,
} from "@/auth/permissions";
import type { PosDeviceDetail } from "@/types/devices";

export function useDeviceDetail(sn: string) {
  return useQuery({
    queryKey: queryKeys.devices.detail(sn),
    queryFn: ({ signal }) => devicesApi.detail(sn, signal),
  });
}

export function useDeviceProducts(sn: string, enabled = true) {
  return useQuery({
    queryKey: queryKeys.devices.products(sn),
    queryFn: ({ signal }) => devicesApi.products(sn, signal),
    enabled,
  });
}

export function useDeviceSummary(sn: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.devices.summary(sn),
    queryFn: ({ signal }) => devicesApi.summary(sn, signal),
    enabled,
  });
}

export function useCashHistory(sn: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.devices.cashHistory(sn),
    queryFn: ({ signal }) => devicesApi.cashHistory(sn, 25, signal),
    enabled,
  });
}

export function useRevenueCounts(sn: string, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.devices.revenueCounts(sn),
    queryFn: ({ signal }) => devicesApi.revenueCountHistory(sn, 25, signal),
    enabled,
  });
}

export interface DeviceAccess {
  sales: boolean;
  manageSettings: boolean;
  /** Cihaz komutları — backend ortak kuralı (send_device_commands), web ile aynı */
  sendCommands: boolean;
  manageStock: boolean;
  selectMachineType: boolean;
  remoteVend: boolean;
  /** Teknisyen: kaynak lokasyon opsiyonel (tek varsayılan lokasyon) */
  isTech: boolean;
}

/**
 * Yetkiler kullanıcının `permissions[]` dizisinden (varsayılan RED). Cihaz detayı ayrıca
 * `sales_visible` / `permissions{}` döndürdüyse ve false ise o da kısıtlar.
 */
export function useDeviceAccess(detail: PosDeviceDetail | undefined): DeviceAccess {
  const user = useAuthStore((s) => s.user);
  return {
    sales: canViewSales(user) && detail?.sales_visible !== false,
    manageSettings: canManageDeviceSettings(user) && detail?.permissions?.manage_device_settings !== false,
    // Web komut kutularını yalnız cihaz ayarı yetkisiyle çizer (`pos_device_detail.html:325-333`)
    sendCommands: canSendDeviceCommands(user) && canManageDeviceSettings(user) && detail?.permissions?.manage_device_settings !== false,
    manageStock: canManageStock(user) && detail?.permissions?.manage_stock !== false,
    selectMachineType: canSelectMachineType(user),
    remoteVend: canRemoteVend(user),
    isTech: user?.role === "tech",
  };
}

/** Yazma sonrası: cihaz domain'i (liste, detay, ürünler, işlemler…) + şablonlar */
export function useInvalidateDevices() {
  const queryClient = useQueryClient();
  return (alsoTemplates = false) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.devices.all });
    if (alsoTemplates) queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
  };
}
