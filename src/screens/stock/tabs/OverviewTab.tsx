import React, { useCallback, useMemo, useState } from "react";
import { EXPORTS } from "@/api/exports";
import { useExcelExport } from "@/hooks/useExcelExport";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useQueries, useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import {
  AppBadge,
  AppChip,
  AppEmptyState,
  AppErrorState,
  AppIcon,
  AppListSkeleton,
  AppSearchField,
  AppSkeleton,
  AppText,
  makeStyles,
  useTheme,
} from "@/design-system";
import { stockApi } from "@/api/stock";
import { errorMessage } from "@/api/client";
import { normalizeForSearch } from "@/utils/text";
import { formatInteger } from "@/utils/number";
import { LocationTypeIcon } from "@/components/stock/LocationTypeIcon";
import { formatStockQuantity, stockLevelOf } from "@/components/stock/stockFormat";
import type { StockBaseUnit, StockLocation, StockOverviewRow } from "@/types/stock";
import { stockKeys, useSkuIndex, useStockLocations } from "../hooks/useStockData";
import { StatStrip } from "../components/StatStrip";

type LevelFilter = "all" | "out" | "negative";

export function OverviewTab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [q, setQ] = useState("");
  const [level, setLevel] = useState<LevelFilter>("all");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const overview = useQuery({
    queryKey: stockKeys.overview(),
    queryFn: ({ signal }) => stockApi.overview(signal),
    staleTime: 30_000,
  });
  const skus = useSkuIndex();

  const rows = useMemo(() => overview.data ?? [], [overview.data]);
  const counts = useMemo(
    () => ({
      total: rows.length,
      out: rows.filter((r) => r.total === 0).length,
      negative: rows.filter((r) => r.total < 0).length,
    }),
    [rows]
  );

  // Overview uç noktası arama parametresi almaz; filtre istemcide (query key'e girmez)
  const filtered = useMemo(() => {
    const nq = normalizeForSearch(q);
    return rows.filter((r) => {
      if (level === "out" && r.total !== 0) return false;
      if (level === "negative" && r.total >= 0) return false;
      if (!nq) return true;
      return normalizeForSearch(`${r.sku_name} ${r.sku_code}`).includes(nq);
    });
  }, [rows, q, level]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([overview.refetch(), skus.refetch()]);
    } finally {
      setRefreshing(false);
    }
  }, [overview, skus]);

  const excel = useExcelExport();
  const header = (
    <View style={styles.header}>
      <StatStrip
        items={[
          { label: "Ürün", value: overview.isSuccess ? formatInteger(counts.total) : "—" },
          { label: "Tükenen", value: overview.isSuccess ? formatInteger(counts.out) : "—", tone: counts.out ? "warning" : "text" },
          { label: "Negatif", value: overview.isSuccess ? formatInteger(counts.negative) : "—", tone: counts.negative ? "danger" : "text" },
        ]}
      />
      <AppSearchField value={q} onChangeText={setQ} placeholder="Ürün adı veya SKU kodu" testID="overview-search" />
      <View style={styles.chips}>
        <AppChip label="Tümü" selected={level === "all"} onPress={() => setLevel("all")} />
        <AppChip label={`Tükenen (${counts.out})`} selected={level === "out"} onPress={() => setLevel("out")} />
        <AppChip label={`Negatif (${counts.negative})`} selected={level === "negative"} onPress={() => setLevel("negative")} />
        <AppChip label={excel.exporting ? "Excel hazırlanıyor…" : "Excel"} icon="download" onPress={() => excel.run(EXPORTS.stockOverview)} />
      </View>
      <AppText variant="caption" color="textTertiary">
        Toplamlar tüm lokasyonları kapsar. Reçeteli ürünler bileşenlerinden izlendiği için listede yer almaz.
      </AppText>
    </View>
  );

  return (
    <FlatList
      data={overview.isSuccess ? filtered : []}
      keyExtractor={(r) => String(r.sku_id)}
      ListHeaderComponent={header}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
      initialNumToRender={20}
      ListEmptyComponent={
        overview.isLoading ? (
          <AppListSkeleton rows={6} />
        ) : overview.isError ? (
          <AppErrorState message={errorMessage(overview.error)} onRetry={() => overview.refetch()} retrying={overview.isFetching} />
        ) : rows.length === 0 ? (
          <AppEmptyState icon="package" title="Stok kaydı yok" description="Stok girişi yapıldığında ürün toplamları burada görünür." />
        ) : (
          <AppEmptyState compact icon="search" title="Sonuç yok" description="Arama veya filtreyle eşleşen ürün bulunamadı." />
        )
      }
      renderItem={({ item }) => (
        <OverviewRow
          row={item}
          unit={skus.byId.get(item.sku_id)?.base_unit}
          expanded={expanded === item.sku_id}
          onToggle={() => setExpanded((e) => (e === item.sku_id ? null : item.sku_id))}
        />
      )}
    />
  );
}

function OverviewRow({
  row,
  unit,
  expanded,
  onToggle,
}: {
  row: StockOverviewRow;
  unit?: StockBaseUnit;
  expanded: boolean;
  onToggle: () => void;
}) {
  const styles = useStyles();
  const lvl = stockLevelOf(row.total);
  const qty = formatStockQuantity(row.total, unit);
  return (
    <View style={styles.card}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityLabel={`${row.sku_name}, ${row.sku_code}, toplam ${qty}${lvl ? `, ${lvl.label}` : ""}`}
        accessibilityHint="Lokasyon dağılımını göster"
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        testID={`overview-row-${row.sku_id}`}
      >
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {row.sku_name}
          </AppText>
          <AppText variant="mono" color="textTertiary" numberOfLines={1}>
            {row.sku_code}
          </AppText>
        </View>
        <View style={styles.right}>
          <AppText variant="numeric" color={row.total < 0 ? "danger" : "text"}>
            {qty}
          </AppText>
          {lvl ? <AppBadge size="sm" label={lvl.label} tone={lvl.tone} dot /> : null}
        </View>
        <AppIcon name={expanded ? "chevron-up" : "chevron-down"} size={18} color="textTertiary" />
      </Pressable>
      {expanded ? <BreakdownPanel skuId={row.sku_id} total={row.total} unit={unit} /> : null}
    </View>
  );
}

/**
 * Lokasyon dağılımı. Backend SKU bazlı dağılım ucu sunmuyor (yalnız lokasyon bazlı `inventory/`).
 * N+1'i önlemek için satır başına istek atılmaz: ilk açılışta aktif depo/ara depo/araç
 * lokasyonlarının envanteri BİR KEZ çekilir ve tüm satırlar + lokasyon detay ekranı aynı cache'i
 * paylaşır. Otomatlar (çok sayıda olabilir) çekilmez; kalan fark ayrı satırda gösterilir.
 */
function BreakdownPanel({ skuId, total, unit }: { skuId: number; total: number; unit?: StockBaseUnit }) {
  const styles = useStyles();
  const navigation = useNavigation();
  const locationsQuery = useStockLocations({});
  const stores = useMemo(
    () => (locationsQuery.data ?? []).filter((l) => l.location_type !== "vending_machine"),
    [locationsQuery.data]
  );
  const inventories = useQueries({
    queries: stores.map((l) => ({
      queryKey: stockKeys.inventory(l.id),
      queryFn: ({ signal }: { signal: AbortSignal }) => stockApi.locations.inventoryDetail(l.id, signal),
      staleTime: 60_000,
    })),
  });

  if (locationsQuery.isLoading || inventories.some((q) => q.isLoading)) {
    return (
      <View style={styles.panel} accessibilityLabel="Dağılım yükleniyor">
        <AppSkeleton height={14} width="70%" />
        <AppSkeleton height={14} width="50%" />
      </View>
    );
  }
  if (locationsQuery.isError || inventories.some((q) => q.isError)) {
    const failed = locationsQuery.isError ? locationsQuery.error : inventories.find((q) => q.isError)?.error;
    return (
      <View style={styles.panel}>
        <AppErrorState
          compact
          message={errorMessage(failed)}
          onRetry={() => {
            locationsQuery.refetch();
            inventories.forEach((q) => q.isError && q.refetch());
          }}
        />
      </View>
    );
  }

  const entries: { location: StockLocation; quantity: number }[] = [];
  stores.forEach((l, i) => {
    const row = inventories[i]?.data?.results.find((r) => r.sku === skuId);
    if (row && row.quantity !== 0) entries.push({ location: l, quantity: row.quantity });
  });
  const sum = entries.reduce((s, e) => s + e.quantity, 0);
  const rest = Math.round((total - sum) * 1000) / 1000;

  return (
    <View style={styles.panel} testID={`breakdown-${skuId}`}>
      {entries.length === 0 && rest === 0 ? (
        <AppText variant="caption" color="textTertiary">
          Hiçbir lokasyonda bakiye yok.
        </AppText>
      ) : null}
      {entries.map(({ location, quantity }) => (
        <Pressable
          key={location.id}
          onPress={() => navigation.navigate("StockLocationDetail", { locationId: location.id, name: location.name })}
          accessibilityRole="button"
          accessibilityLabel={`${location.name}: ${formatStockQuantity(quantity, unit)}`}
          style={({ pressed }) => [styles.panelRow, pressed && styles.pressed]}
        >
          <LocationTypeIcon type={location.location_type} size={28} />
          <AppText variant="callout" numberOfLines={1} style={styles.flex}>
            {location.name}
          </AppText>
          <AppText variant="numericSm" color={quantity < 0 ? "danger" : "text"}>
            {formatStockQuantity(quantity, unit)}
          </AppText>
        </Pressable>
      ))}
      {rest !== 0 ? (
        <View style={styles.panelRow}>
          <LocationTypeIcon type="vending_machine" size={28} />
          <AppText variant="callout" color="textSecondary" numberOfLines={2} style={styles.flex}>
            Otomatlar ve pasif lokasyonlar
          </AppText>
          <AppText variant="numericSm" color={rest < 0 ? "danger" : "textSecondary"}>
            {formatStockQuantity(rest, unit)}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    content: { paddingBottom: t.spacing.huge },
    header: { padding: t.layout.screenPadding, gap: t.spacing.md },
    chips: { flexDirection: "row", gap: t.spacing.sm, flexWrap: "wrap" },
    card: {
      backgroundColor: t.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      minHeight: 56,
      paddingVertical: t.spacing.sm,
      paddingHorizontal: t.layout.screenPadding,
    },
    pressed: { backgroundColor: t.colors.surfacePressed },
    flex: { flex: 1 },
    right: { alignItems: "flex-end", gap: 2 },
    panel: {
      marginHorizontal: t.layout.screenPadding,
      marginBottom: t.spacing.md,
      padding: t.spacing.sm,
      gap: t.spacing.xs,
      borderRadius: t.radius.sm,
      backgroundColor: t.colors.surfaceMuted,
    },
    panelRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.sm,
      minHeight: t.layout.minTouchTarget,
      paddingHorizontal: t.spacing.xs,
      borderRadius: t.radius.xs,
    },
  })
);
