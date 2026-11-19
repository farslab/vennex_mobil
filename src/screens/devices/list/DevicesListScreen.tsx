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
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
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
import { DEVICE_SORT_OPTIONS } from "@/components/devices/deviceHelpers";
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
    machine_type: f.machineType === "all" ? undefined : f.machineType === "1" ? 1 : 0,
    location_ids: f.locationIds.length ? f.locationIds : undefined,
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

  const showRevenue = salesAllowed && !hideRevenue;
  const filterCount = activeFilterCount(effectiveFilters);
  const sortLabel = DEVICE_SORT_OPTIONS.find((o) => o.value === effectiveFilters.sortBy)?.label;

  const openDevice = useCallback(
    (d: PosDeviceListItem) => navigation.navigate("DeviceDetail", { sn: d.sn, name: d.pos_name ?? undefined }),
    [navigation]
  );

  const renderItem = useCallback(
    ({ item }: { item: PosDeviceListItem }) => <DeviceRow device={item} onPress={openDevice} showRevenue={showRevenue} />,
    [openDevice, showRevenue]
  );

  const first = list.firstPage;
  const freshCounts = first
    ? {
        total: first.total_count ?? first.count,
        online: first.online_count,
        offline: first.offline_count,
      }
    : null;
  // Filtre değişip yeni sayfa yüklenirken sayaçlar kaybolmasın: son bilinen değer gösterilir
  // (sayaçlar çevrimiçi filtresinden önce hesaplanır; render sırasında durum düzeltme deseni).
  const [lastCounts, setLastCounts] = useState<typeof freshCounts>(null);
  if (
    freshCounts &&
    (lastCounts?.total !== freshCounts.total ||
      lastCounts?.online !== freshCounts.online ||
      lastCounts?.offline !== freshCounts.offline)
  ) {
    setLastCounts(freshCounts);
  }
  const counts = freshCounts ?? lastCounts;

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
  if (effectiveFilters.machineType !== "all")
    activeChips.push({
      key: "machine",
      label: effectiveFilters.machineType === "1" ? "Kahve" : "Snack",
      clear: () => setFilters((f) => ({ ...f, machineType: "all" })),
    });
  if (effectiveFilters.locationIds.length)
    activeChips.push({
      key: "loc",
      label: `${effectiveFilters.locationIds.length} konum`,
      clear: () => setFilters((f) => ({ ...f, locationIds: [] })),
    });

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
          {/* Sayaçlar filtre kısayolu: çevrimiçi/çevrimdışı dokununca süzer; seçiliye tekrar dokunmak ya da toplam → tümü */}
          <View style={styles.counts}>
            {counts ? (
              <>
                <CountChip
                  label={`${formatInteger(counts.total)} POS cihazı`}
                  selected={effectiveFilters.online === "all"}
                  onPress={() => setFilters((f) => ({ ...f, online: "all" }))}
                  testID="devices-count-total"
                  strong
                />
                <CountChip
                  label={formatInteger(counts.online)}
                  a11yLabel={`${formatInteger(counts.online)} çevrimiçi`}
                  dot={colors.success}
                  selected={effectiveFilters.online === "online"}
                  onPress={() => setFilters((f) => ({ ...f, online: f.online === "online" ? "all" : "online" }))}
                  testID="devices-count-online"
                />
                <CountChip
                  label={formatInteger(counts.offline)}
                  a11yLabel={`${formatInteger(counts.offline)} çevrimdışı`}
                  dot={colors.danger}
                  selected={effectiveFilters.online === "offline"}
                  onPress={() => setFilters((f) => ({ ...f, online: f.online === "offline" ? "all" : "offline" }))}
                  testID="devices-count-offline"
                />
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
        // İlk kartın üstünde kartlar arasındaki kadar boşluk
        contentContainerStyle={styles.listContent}
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

/** Sayaç + filtre: seçiliyken altı çizili ve vurgulu */
function CountChip({
  label,
  a11yLabel,
  dot,
  selected,
  onPress,
  strong,
  testID,
}: {
  label: string;
  /** Ekran okuyucu metni (görünür etiket yalnız rakamsa) */
  a11yLabel?: string;
  dot?: string;
  selected: boolean;
  onPress: () => void;
  strong?: boolean;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${a11yLabel ?? label}${selected ? ", seçili" : ""}`}
      hitSlop={6}
      style={({ pressed }) => [styles.countChip, selected && styles.countChipOn, pressed && styles.countPressed]}
      testID={testID}
    >
      {dot ? <View style={[styles.countDot, { backgroundColor: dot }]} /> : null}
      <AppText variant="numericSm" color={selected || strong ? "text" : "textSecondary"} style={selected ? styles.countTextOn : undefined}>
        {label}
      </AppText>
    </Pressable>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    listContent: { paddingTop: t.spacing.md },
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
    // Tek satıra sığsın: dar iç boşluk (seçili rozet zemini yine görünür)
    counts: { flex: 1, flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginLeft: -4 },
    countChip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 6, paddingVertical: 3, borderRadius: t.radius.xs },
    countChipOn: { backgroundColor: t.colors.surfaceMuted },
    countPressed: { opacity: 0.6 },
    countTextOn: { fontWeight: "700" },
    countDot: { width: 10, height: 10, borderRadius: 5 },
    sortLabel: { paddingHorizontal: t.layout.screenPadding, paddingBottom: t.spacing.sm },
    footer: { paddingVertical: t.spacing.lg },
  })
);
