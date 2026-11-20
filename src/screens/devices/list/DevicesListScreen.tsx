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
import { canViewSales } from "@/auth/permissions";
import { DEVICE_SORT_OPTIONS } from "@/components/devices/deviceHelpers";
import { formatInteger } from "@/utils/number";
import type { RootStackParamList } from "@/navigation/types";
import type { DeviceListQuery, PosDeviceListItem, PosDeviceListResponse } from "@/types/devices";
import { DeviceRow } from "./DeviceRow";
import { DEFAULT_FILTERS, DeviceFiltersSheet, activeFilterCount, type DeviceFilters } from "./DeviceFiltersSheet";
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
  const { colors, isDark } = useTheme();
  const user = useAuthStore((s) => s.user);
  const salesAllowed = canViewSales(user);
  // Web: özel sıralama herkese açık (`pos_device_list.html:89`); ürün şablonları cihaz ayarı yetkisi ister
  // (`dashboard_v2/views/product_templates.py:62`) — yetkisize 403 dönen bir giriş gösterilmez
  // Excel: Genel Bakış gibi başlıkta, bildirim zilinin yanında
  useHeaderExcel("POS Cihazları", EXPORTS.devices);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search.trim(), 350);
  const [filters, setFilters] = useState<DeviceFilters>(DEFAULT_FILTERS);
  const [filtersOpen, setFiltersOpen] = useState(false);
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
        {/* Arama + filtre tek yuvarlak çubukta (Genel Bakış filtre çubuğu gibi) */}
        <View style={[styles.searchBar, isDark ? styles.barDark : styles.barLight]}>
          <View style={styles.flex}>
            <AppSearchField
              value={search}
              onChangeText={setSearch}
              placeholder="POS cihazı adı veya seri numarası"
              variant="bare"
              testID="devices-search"
            />
          </View>
          <View style={styles.barDivider} />
          <AppIconButton
            icon="sliders"
            label={filterCount ? `Filtreler, ${filterCount} etkin` : "Filtrele ve sırala"}
            onPress={() => setFiltersOpen(true)}
            badge={filterCount || undefined}
            testID="devices-filter-button"
          />
        </View>

        {/* Sayaçlar bölmeli seçici: dokununca süzer; seçiliye tekrar dokunmak ya da toplam → tümü */}
        <View style={styles.summary}>
          <View style={styles.segment}>
            {counts ? (
              <>
                <CountChip
                  label={`${formatInteger(counts.total)} POS cihazı`}
                  selected={effectiveFilters.online === "all"}
                  onPress={() => setFilters((f) => ({ ...f, online: "all" }))}
                  testID="devices-count-total"
                  wide
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
              <AppText variant="caption" color="textTertiary" style={styles.countsPending}>
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

        {/* Etkin filtreler: dokununca o filtre kalkar */}
        {activeChips.length > 0 ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {activeChips.map((c) => (
              <AppChip key={c.key} label={c.label} icon="x" selected onPress={c.clear} />
            ))}
          </ScrollView>
        ) : null}
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
    </View>
  );
}

/** Bölmeli seçicinin bir dilimi: seçili dilim beyaz kabarık yüzey + mavi yazı */
function CountChip({
  label,
  a11yLabel,
  dot,
  selected,
  onPress,
  wide,
  testID,
}: {
  label: string;
  /** Ekran okuyucu metni (görünür etiket yalnız rakamsa) */
  a11yLabel?: string;
  dot?: string;
  selected: boolean;
  onPress: () => void;
  /** Toplam dilimi metni uzun olduğu için daha geniş */
  wide?: boolean;
  testID?: string;
}) {
  const styles = useStyles();
  const { isDark } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={`${a11yLabel ?? label}${selected ? ", seçili" : ""}`}
      style={({ pressed }) => [
        styles.countChip,
        wide && styles.countWide,
        selected && styles.countChipOn,
        selected && !isDark && styles.countChipShadow,
        pressed && styles.countPressed,
      ]}
      testID={testID}
    >
      {dot ? <View style={[styles.countDot, { backgroundColor: dot }]} /> : null}
      <AppText
        variant="numericSm"
        weight={selected ? "700" : "600"}
        color={selected ? "primary" : "textSecondary"}
        numberOfLines={1}
      >
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
    // Arama ve sayaçlar sayfa zemininde (kartlarla bütün görünüm)
    toolbar: {
      backgroundColor: t.colors.background,
      paddingTop: t.spacing.sm,
      gap: t.spacing.md,
      paddingBottom: t.spacing.xs,
    },
    searchBar: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: t.layout.screenPadding,
      paddingLeft: t.spacing.lg,
      paddingRight: t.spacing.xs,
      minHeight: 50,
      borderRadius: 999,
      backgroundColor: t.colors.surface,
    },
    barLight: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.07,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    barDark: { borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border },
    barDivider: { width: StyleSheet.hairlineWidth, height: 24, backgroundColor: t.colors.border, marginLeft: t.spacing.sm },
    summary: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.xs,
      paddingLeft: t.layout.screenPadding,
      paddingRight: t.spacing.sm,
    },
    // Bölmeli seçici: gri ray, seçili dilim beyaz
    segment: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      padding: 3,
      borderRadius: 999,
      backgroundColor: "rgba(120,130,150,0.14)",
      minHeight: 42,
    },
    countsPending: { paddingHorizontal: t.spacing.md },
    countChip: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      gap: 6,
      paddingHorizontal: 8,
      paddingVertical: 8,
      borderRadius: 999,
    },
    countWide: { flex: 1.6 },
    countChipOn: { backgroundColor: t.colors.surface },
    countChipShadow: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.1,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    countPressed: { opacity: 0.6 },
    countDot: { width: 8, height: 8, borderRadius: 4 },
    chips: { gap: t.spacing.sm, paddingHorizontal: t.layout.screenPadding },
    sortLabel: { paddingHorizontal: t.layout.screenPadding },
    footer: { paddingVertical: t.spacing.lg },
  })
);
