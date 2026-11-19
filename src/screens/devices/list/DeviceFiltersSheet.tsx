import React, { useMemo, useState } from "react";
import { useOnOpen } from "@/components/devices/useOnOpen";
import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AppButton, AppNotice, AppSegmented, AppSelect, AppSheet, AppText, makeStyles } from "@/design-system";
import { devicesApi } from "@/api/devices";
import { queryKeys } from "@/api/queryKeys";
import { DEVICE_SORT_OPTIONS } from "@/components/devices/deviceHelpers";
import type { DeviceSortBy } from "@/types/devices";

export type ConnectivityFilter = "all" | "online" | "offline";
export type StatFilter = "all" | "1" | "0";

export interface DeviceFilters {
  online: ConnectivityFilter;
  stat: StatFilter;
  locationId: number | null;
  sortBy: DeviceSortBy;
}

export const DEFAULT_FILTERS: DeviceFilters = { online: "all", stat: "all", locationId: null, sortBy: "default" };

/** Varsayılandan farklı filtre sayısı (sıralama hariç) */
export function activeFilterCount(f: DeviceFilters): number {
  return (f.online !== "all" ? 1 : 0) + (f.stat !== "all" ? 1 : 0) + (f.locationId != null ? 1 : 0);
}

export const deviceLocationOptionsKey = () => [...queryKeys.devices.all, "location-options"] as const;

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

  const locations = useQuery({
    queryKey: deviceLocationOptionsKey(),
    queryFn: ({ signal }) => devicesApi.locationOptions(signal),
    enabled: visible,
    staleTime: 5 * 60_000,
  });

  const locationOptions = useMemo(
    () => [
      { value: 0, label: "Tüm konumlar" },
      ...(locations.data ?? []).map((l) => ({ value: l.id, label: l.name, description: l.region_name ?? undefined })),
    ],
    [locations.data]
  );

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
          <AppButton title="Sıfırla" variant="outline" onPress={() => setDraft(DEFAULT_FILTERS)} style={styles.flex} />
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
        <AppText variant="overline" color="textTertiary">
          Bağlantı
        </AppText>
        <AppSegmented<ConnectivityFilter>
          testID="filter-online"
          value={draft.online}
          onChange={(online) => setDraft((d) => ({ ...d, online }))}
          items={[
            { key: "all", label: "Tümü" },
            { key: "online", label: "Çevrimiçi" },
            { key: "offline", label: "Çevrimdışı" },
          ]}
        />
      </View>
      <View style={styles.group}>
        <AppText variant="overline" color="textTertiary">
          Durum
        </AppText>
        <AppSegmented<StatFilter>
          testID="filter-stat"
          value={draft.stat}
          onChange={(stat) => setDraft((d) => ({ ...d, stat }))}
          items={[
            { key: "all", label: "Tümü" },
            { key: "1", label: "Aktif" },
            { key: "0", label: "Pasif" },
          ]}
        />
      </View>
      <AppSelect<number>
        label="Konum"
        testID="filter-location"
        options={locationOptions}
        value={draft.locationId ?? 0}
        loading={locations.isLoading}
        onChange={(v) => setDraft((d) => ({ ...d, locationId: v === 0 ? null : v }))}
        searchable
      />
      {locations.isError ? <AppNotice tone="warning" message="Konum listesi yüklenemedi; konum filtresi kullanılamıyor." /> : null}
      <AppSelect<DeviceSortBy>
        label="Sıralama"
        testID="filter-sort"
        options={sortOptions}
        value={draft.sortBy}
        onChange={(sortBy) => setDraft((d) => ({ ...d, sortBy }))}
      />
      <AppText variant="caption" color="textTertiary">
        Makine tipine (Snack/Kahve) göre filtreleme POS cihazı listesinde desteklenmiyor.
      </AppText>
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    group: { gap: t.spacing.sm },
  })
);
