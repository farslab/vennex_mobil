/**
 * Cihazlar (sekme kökü) — başlığı TabHeader verir.
 * - Arama/filtre/sıralama SUNUCU tarafında (§3.9): q (350 ms debounce), online, stat, location_id, sort_by
 * - Sonsuz sayfalama, sabit 25'lik sayfa (`page_size` gönderilmez)
 * - Sayaçlar ilk sayfadan (online_count/offline_count/total_count)
 * - Doluluk liste satırındaki `fill_rate`'ten — satır başına /products/ isteği YOK
 */
import { EXPORTS } from "@/api/exports";
import { useHeaderExcel } from "@/navigation/useHeaderExcel";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AppChip,
  AppEmptyState,
  AppErrorState,
  AppIconButton,
  AppListSkeleton,
  AppSearchField,
  AppText,
  makeStyles,
  useTheme,
} from "@/design-system";
import { devicesApi } from "@/api/devices";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { usePagedList } from "@/hooks/usePagedList";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useAuthStore } from "@/store/authStore";
import { canManageDeviceSettings, canViewSales } from "@/auth/permissions";
import { DEVICE_SORT_OPTIONS, revenueColumnForSort } from "@/components/devices/deviceHelpers";
import { formatInteger } from "@/utils/number";
import type { RootStackParamList } from "@/navigation/types";
import type { DeviceListQuery, PosDeviceListItem, PosDeviceListResponse } from "@/types/devices";
import { DeviceRow } from "./DeviceRow";
import { DEFAULT_FILTERS, DeviceFiltersSheet, activeFilterCount, type DeviceFilters } from "./DeviceFiltersSheet";
import { DeviceOrderSheet } from "./DeviceOrderSheet";
import { ListLoadMoreFooter } from "@/components/ListLoadMoreFooter";

const HIDE_REVENUE_KEY = "vennex.devices.hideRevenue";

/** UI filtreleri → backend sorgu parametreleri */
export function toDeviceQuery(q: string, f: DeviceFilters): DeviceListQuery {
  return {
    q: q || undefined,
    online: f.online === "all" ? undefined : f.online === "online",
    stat: f.stat === "all" ? undefined : f.stat === "1" ? 1 : 0,
    location_id: f.locationId ?? undefined,
    sort_by: f.sortBy === "default" ? undefined : f.sortBy,
  };
}

export default function DevicesListScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const styles = useStyles();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const salesAllowed = canViewSales(user);
  // Web: özel sıralama herkese açık (`pos_device_list.html:89`); ürün şablonları cihaz ayarı yetkisi ister
  // (`dashboard_v2/views/product_templates.py:62`) — yetkisize 403 dönen bir giriş gösterilmez
  const canOrder = true;
  const canTemplates = canManageDeviceSettings(user);
  // Excel: Genel Bakış gibi başlıkta, bildirim zilinin yanında
  useHeaderExcel("POS Cihazları", EXPORTS.devices);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const [filters, setFilters] = useState<DeviceFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [orderOpen, setOrderOpen] = useState(false);
  const [hideRevenue, setHideRevenue] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(HIDE_REVENUE_KEY)
      .then((v) => setHideRevenue(v === "1"))
      .catch(() => {});
  }, []);

  const toggleRevenue = () => {
    const next = !hideRevenue;
    setHideRevenue(next);
    AsyncStorage.setItem(HIDE_REVENUE_KEY, next ? "1" : "0").catch(() => {});
  };

  // Yetkisi olmayan kullanıcı ciro sıralaması seçemez (sheet'te de gizli)
  const effectiveFilters = useMemo<DeviceFilters>(
    () => (salesAllowed || !filters.sortBy.includes("revenue") ? filters : { ...filters, sortBy: "default" }),
    [filters, salesAllowed]
  );
  const query = useMemo(() => toDeviceQuery(debouncedSearch, effectiveFilters), [debouncedSearch, effectiveFilters]);

  const list = usePagedList<PosDeviceListItem, PosDeviceListResponse>({
    queryKey: queryKeys.devices.list({ ...query }),
    fetchPage: (page, signal) => devicesApi.list({ ...query, page }, signal),
  });

  const revenue = salesAllowed && !hideRevenue ? revenueColumnForSort(effectiveFilters.sortBy) : null;
  const filterCount = activeFilterCount(effectiveFilters);
  const sortLabel = DEVICE_SORT_OPTIONS.find((o) => o.value === effectiveFilters.sortBy)?.label;

  const openDevice = useCallback(
    (d: PosDeviceListItem) => navigation.navigate("DeviceDetail", { sn: d.sn, name: d.pos_name ?? undefined }),
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: PosDeviceListItem }) => <DeviceRow device={item} onPress={openDevice} revenue={revenue} />,
    [openDevice, revenue]
  );

  const first = list.firstPage;
  const counts = first
    ? {
        total: first.total_count ?? first.count,
        online: first.online_count,
        offline: first.offline_count,
      }
    : null;

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
    setSearch("");
  };

  const activeChips: { key: string; label: string; clear: () => void }[] = [];
  if (effectiveFilters.online !== "all")
    activeChips.push({
      key: "online",
      label: effectiveFilters.online === "online" ? "Çevrimiçi" : "Çevrimdışı",
      clear: () => setFilters((f) => ({ ...f, online: "all" })),
    });
  if (effectiveFilters.stat !== "all")
    activeChips.push({
      key: "stat",
      label: effectiveFilters.stat === "1" ? "Aktif" : "Pasif",
      clear: () => setFilters((f) => ({ ...f, stat: "all" })),
    });
  if (effectiveFilters.locationId != null)
    activeChips.push({ key: "loc", label: "Konum filtresi", clear: () => setFilters((f) => ({ ...f, locationId: null })) });

  const listEmpty = list.isLoading ? (
    <AppListSkeleton rows={8} />
  ) : list.isError ? (
    <AppErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} compact />
  ) : (
    <AppEmptyState
      compact
      icon={debouncedSearch || filterCount ? "search" : "pos"}
      title={debouncedSearch || filterCount ? "Eşleşen POS cihazı yok" : "Henüz POS cihazı yok"}
      description={
        debouncedSearch || filterCount
          ? "Aramayı veya filtreleri değiştirerek tekrar deneyin."
          : "Bu şirkete tanımlı POS cihazı bulunmuyor."
      }
      actionLabel={debouncedSearch || filterCount ? "Filtreleri temizle" : undefined}
      onAction={debouncedSearch || filterCount ? clearFilters : undefined}
    />
  );

  return (
    <View style={styles.root} testID="devices-list-screen">
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <View style={styles.flex}>
            <AppSearchField
              value={search}
              onChangeText={setSearch}
              placeholder="Ad, seri no veya otomat ara"
              testID="devices-search"
            />
          </View>
          <AppIconButton
            icon="sliders"
            label={filterCount ? `Filtreler, ${filterCount} etkin` : "Filtrele ve sırala"}
            onPress={() => setFiltersOpen(true)}
            badge={filterCount || undefined}
            testID="devices-filter-button"
          />
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {canTemplates ? (
            <AppChip label="Ürün şablonları" icon="layers" onPress={() => navigation.navigate("ProductTemplates")} />
          ) : null}
          {canOrder ? <AppChip label="Özel sıralama" icon="list" onPress={() => setOrderOpen(true)} /> : null}
          {activeChips.map((c) => (
            <AppChip key={c.key} label={c.label} icon="x" selected onPress={c.clear} />
          ))}
        </ScrollView>

        <View style={styles.summary}>
          <View style={styles.counts} accessible accessibilityLabel={counts ? `${counts.total} POS cihazı, ${counts.online ?? 0} çevrimiçi, ${counts.offline ?? 0} çevrimdışı` : "Sayaçlar yükleniyor"}>
            {counts ? (
              <>
                <AppText variant="numericSm" testID="devices-count-total">
                  {formatInteger(counts.total)} POS cihazı
                </AppText>
                <View style={[styles.dot, styles.dotOnline]} />
                <AppText variant="numericSm" color="textSecondary" testID="devices-count-online">
                  {formatInteger(counts.online)} çevrimiçi
                </AppText>
                <View style={[styles.dot, styles.dotOffline]} />
                <AppText variant="numericSm" color="textSecondary" testID="devices-count-offline">
                  {formatInteger(counts.offline)} çevrimdışı
                </AppText>
              </>
            ) : (
              <AppText variant="caption" color="textTertiary">
                {list.isError ? "Sayaçlar alınamadı" : "Yükleniyor…"}
              </AppText>
            )}
          </View>
          {salesAllowed ? (
            <AppIconButton
              icon={hideRevenue ? "eye-off" : "eye"}
              label={hideRevenue ? "Ciroyu göster" : "Ciroyu gizle"}
              onPress={toggleRevenue}
              testID="devices-toggle-revenue"
            />
          ) : null}
        </View>
        {effectiveFilters.sortBy !== "default" && sortLabel ? (
          <AppText variant="caption" color="textTertiary" style={styles.sortLabel}>
            Sıralama: {sortLabel}
          </AppText>
        ) : null}
      </View>

      <FlatList
        testID="devices-list"
        data={list.items}
        keyExtractor={(d) => d.sn}
        renderItem={renderItem}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        initialNumToRender={12}
        windowSize={9}
        ListEmptyComponent={listEmpty}
        ListFooterComponent={
          <ListLoadMoreFooter loading={list.isFetchingMore} error={list.loadMoreError} onRetry={list.retryLoadMore} />
        }
        refreshControl={
          <RefreshControl refreshing={list.isRefreshing} onRefresh={list.refresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      />

      <DeviceFiltersSheet
        visible={filtersOpen}
        value={effectiveFilters}
        canViewSales={salesAllowed}
        onApply={setFilters}
        onClose={() => setFiltersOpen(false)}
      />
      {canOrder ? <DeviceOrderSheet visible={orderOpen} onClose={() => setOrderOpen(false)} /> : null}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    toolbar: {
      backgroundColor: t.colors.surface,
      paddingTop: t.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    searchRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.xs,
      paddingLeft: t.layout.screenPadding,
      paddingRight: t.spacing.sm,
    },
    chips: { gap: t.spacing.sm, paddingHorizontal: t.layout.screenPadding, paddingVertical: t.spacing.sm },
    summary: {
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: t.layout.screenPadding,
      paddingRight: t.spacing.sm,
      minHeight: 44,
    },
    counts: { flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6 },
    dot: { width: 6, height: 6, borderRadius: 3, marginLeft: t.spacing.xs },
    dotOnline: { backgroundColor: t.colors.success },
    dotOffline: { backgroundColor: t.colors.danger },
    sortLabel: { paddingHorizontal: t.layout.screenPadding, paddingBottom: t.spacing.sm },
    footer: { paddingVertical: t.spacing.lg },
  })
);
