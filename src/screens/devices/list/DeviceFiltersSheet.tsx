/**
 * POS cihazı filtreleri — web POS cihazı listesiyle aynı alanlar ve adlar:
 * Konum (bölge gruplu, çoktan seçmeli) · Durum · Makine Tipi · Sırala. Aktif/Pasif filtresi yok (web'de yok).
 */
import React, { useMemo, useState } from "react";
import { useOnOpen } from "@/components/devices/useOnOpen";
import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AppButton, AppNotice, AppSelect, AppSheet, AppText, makeStyles } from "@/design-system";
import { devicesApi } from "@/api/devices";
import { queryKeys } from "@/api/queryKeys";
import { DEVICE_SORT_OPTIONS } from "@/components/devices/deviceHelpers";
import { LocationMultiSelect } from "@/components/dashboard/LocationMultiSelect";
import type { DeviceSortBy } from "@/types/devices";

export type ConnectivityFilter = "all" | "online" | "offline";
export type MachineTypeFilter = "all" | "0" | "1";

export interface DeviceFilters {
  online: ConnectivityFilter;
  machineType: MachineTypeFilter;
  /** Boş = tüm konumlar */
  locationIds: number[];
  sortBy: DeviceSortBy;
}

export const DEFAULT_FILTERS: DeviceFilters = { online: "all", machineType: "all", locationIds: [], sortBy: "default" };

/** Varsayılandan farklı filtre sayısı (sıralama hariç) */
export function activeFilterCount(f: DeviceFilters): number {
  return (f.online !== "all" ? 1 : 0) + (f.machineType !== "all" ? 1 : 0) + (f.locationIds.length ? 1 : 0);
}

export const deviceLocationOptionsKey = () => [...queryKeys.devices.all, "location-options"] as const;

const STATUS_OPTIONS: { value: ConnectivityFilter; label: string }[] = [
  { value: "all", label: "Tüm Cihazlar" },
  { value: "online", label: "Çevrimiçi" },
  { value: "offline", label: "Çevrimdışı" },
];

const MACHINE_TYPE_OPTIONS: { value: MachineTypeFilter; label: string }[] = [
  { value: "all", label: "Tüm Tipler" },
  { value: "0", label: "Snack" },
  { value: "1", label: "Kahve" },
];

export function useDeviceLocationOptions(enabled: boolean) {
  return useQuery({
    queryKey: deviceLocationOptionsKey(),
    queryFn: ({ signal }) => devicesApi.locationOptions(signal),
    enabled,
    staleTime: 5 * 60_000,
  });
}

export function DeviceFiltersSheet({
  visible,
  value,
  canViewSales,
  onApply,
  onClose,
}: {
  visible: boolean;
  value: DeviceFilters;
  canViewSales: boolean;
  onApply: (f: DeviceFilters) => void;
  onClose: () => void;
}) {
  const styles = useStyles();
  const [draft, setDraft] = useState<DeviceFilters>(value);

  useOnOpen(visible, () => setDraft(value));

  const locations = useDeviceLocationOptions(visible);

  const sortOptions = useMemo(
    () => DEVICE_SORT_OPTIONS.filter((o) => canViewSales || !o.sales).map((o) => ({ value: o.value, label: o.label })),
    [canViewSales]
  );

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title="Filtrele ve sırala"
      testID="device-filters"
      footer={
        <>
          <AppButton title="Temizle" variant="outline" onPress={() => setDraft(DEFAULT_FILTERS)} style={styles.flex} />
          <AppButton
            testID="device-filters-apply"
            title="Uygula"
            onPress={() => {
              onApply(draft);
              onClose();
            }}
            style={styles.flex}
          />
        </>
      }
    >
      <View style={styles.group}>
        <AppText variant="label" color="textSecondary">
          Konum
        </AppText>
        {locations.isError ? (
          <AppNotice tone="warning" message="Konum listesi yüklenemedi; konum filtresi kullanılamıyor." />
        ) : (
          <LocationMultiSelect
            locations={locations.data ?? []}
            value={draft.locationIds}
            onChange={(locationIds) => setDraft((d) => ({ ...d, locationIds }))}
            testID="filter-location"
          />
        )}
      </View>
      <AppSelect<ConnectivityFilter>
        label="Durum"
        testID="filter-online"
        options={STATUS_OPTIONS}
        value={draft.online}
        searchable={false}
        onChange={(online) => setDraft((d) => ({ ...d, online }))}
      />
      <AppSelect<MachineTypeFilter>
        label="Makine Tipi"
        testID="filter-machine-type"
        options={MACHINE_TYPE_OPTIONS}
        value={draft.machineType}
        searchable={false}
        onChange={(machineType) => setDraft((d) => ({ ...d, machineType }))}
      />
      <AppSelect<DeviceSortBy>
        label="Sırala"
        testID="filter-sort"
        options={sortOptions}
        value={draft.sortBy}
        onChange={(sortBy) => setDraft((d) => ({ ...d, sortBy }))}
      />
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    group: { gap: t.spacing.xs },
  })
);
