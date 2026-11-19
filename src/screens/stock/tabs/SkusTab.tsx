import React, { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  AppBadge,
  AppButton,
  AppChip,
  AppNotice,
  AppEmptyState,
  AppErrorState,
  AppListSkeleton,
  AppSearchField,
  AppText,
  makeStyles,
  useTheme,
  type StatusTone,
} from "@/design-system";
import { stockApi } from "@/api/stock";
import { errorMessage } from "@/api/client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency, formatPercent } from "@/utils/number";
import { unitShort } from "@/components/stock/stockFormat";
import { BASE_UNIT_LABELS, SKU_KIND_LABELS, type StockSku, type StockSkuKind } from "@/types/stock";
import { stockKeys } from "../hooks/useStockData";
import { SkuFormSheet } from "../components/SkuFormSheet";

const KIND_TONE: Record<StockSkuKind, StatusTone> = { simple: "neutral", composite: "info", ingredient: "warning" };

export function SkusTab({ canManage }: { canManage: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<StockSkuKind | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StockSku | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const debounced = useDebouncedValue(q.trim(), 350);

  // Arama sunucuda (`q`: ad/kod/barkod); tür filtresi backend'de yok → istemcide
  const query = useQuery({
    queryKey: stockKeys.skuSearch({ q: debounced }),
    queryFn: ({ signal }) => stockApi.skus.search({ q: debounced }, signal),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
  });

  const all = useMemo(() => query.data?.items ?? [], [query.data]);
  const truncated = query.data?.truncated === true;
  const filtered = useMemo(() => (kind ? all.filter((s) => s.kind === kind) : all), [all, kind]);
  const kindCounts = useMemo(() => {
    const c: Record<StockSkuKind, number> = { simple: 0, composite: 0, ingredient: 0 };
    for (const s of all) c[s.kind] += 1;
    return c;
  }, [all]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [query]);

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.searchRow}>
        <View style={styles.flex}>
          <AppSearchField value={q} onChangeText={setQ} placeholder="Ad, SKU kodu veya barkod" testID="sku-search" />
        </View>
        {canManage ? <AppButton title="Yeni" icon="plus" onPress={openNew} accessibilityHint="Yeni ürün oluşturur" testID="sku-new" /> : null}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <AppChip label="Tümü" selected={kind == null} onPress={() => setKind(null)} />
        {(Object.keys(SKU_KIND_LABELS) as StockSkuKind[]).map((k) => (
          // Kesilmiş aramada sayılar yalnız ilk sonuçları sayardı → gösterilmez (yanlış bilgi olmasın)
          <AppChip
            key={k}
            label={truncated ? SKU_KIND_LABELS[k] : `${SKU_KIND_LABELS[k]} (${kindCounts[k]})`}
            selected={kind === k}
            onPress={() => setKind(k)}
          />
        ))}
      </ScrollView>
      {truncated ? (
        <AppNotice tone="info" message="Aramayla eşleşen ilk 50 ürün gösteriliyor. Daha fazlası için aramayı daraltın." />
      ) : null}
    </View>
  );

  const hasData = query.data != null;

  return (
    <>
      <FlatList
        data={hasData ? filtered : []}
        keyExtractor={(s) => String(s.id)}
        ListHeaderComponent={header}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
        initialNumToRender={20}
        ListEmptyComponent={
          !hasData && query.isLoading ? (
            <AppListSkeleton rows={6} />
          ) : !hasData && query.isError ? (
            <AppErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} retrying={query.isFetching} />
          ) : debounced || kind ? (
            <AppEmptyState compact icon="search" title="Ürün bulunamadı" description="Aramayı veya tür filtresini değiştirin." />
          ) : (
            <AppEmptyState
              icon="package"
              title="Henüz ürün yok"
              description="Stok takibi için ürün (SKU) ekleyin."
              actionLabel={canManage ? "Ürün ekle" : undefined}
              onAction={canManage ? openNew : undefined}
            />
          )
        }
        ListFooterComponent={
          query.isFetching && hasData && !refreshing ? (
            <AppText variant="caption" color="textTertiary" align="center" style={styles.footer}>
              Aranıyor…
            </AppText>
          ) : null
        }
        renderItem={({ item }) => (
          <SkuRow
            sku={item}
            onPress={
              canManage
                ? () => {
                    setEditing(item);
                    setFormOpen(true);
                  }
                : undefined
            }
          />
        )}
      />
      {canManage ? <SkuFormSheet visible={formOpen} sku={editing} onClose={() => setFormOpen(false)} /> : null}
    </>
  );
}

function SkuRow({ sku, onPress }: { sku: StockSku; onPress?: () => void }) {
  const styles = useStyles();
  const meta = [
    BASE_UNIT_LABELS[sku.base_unit],
    sku.package_label || null,
    sku.kind !== "composite" ? `Alış ${formatCurrency(sku.unit_cost)}` : null,
    `KDV ${formatPercent(sku.vat_rate, 2)}`,
  ]
    .filter(Boolean)
    .join(" · ");
  const price = sku.kind === "ingredient" ? null : formatCurrency(sku.sale_price);
  const content = (
    <>
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {sku.name}
        </AppText>
        <AppText variant="mono" color="textTertiary" numberOfLines={1}>
          {sku.sku_code}
          {sku.barcode ? ` · ${sku.barcode}` : ""}
        </AppText>
        <AppText variant="caption" color="textSecondary" numberOfLines={1}>
          {meta}
        </AppText>
      </View>
      <View style={styles.right}>
        {price ? <AppText variant="numeric">{price}</AppText> : null}
        <AppBadge size="sm" label={sku.kind === "ingredient" ? `${SKU_KIND_LABELS[sku.kind]} · ${unitShort(sku.base_unit)}` : SKU_KIND_LABELS[sku.kind]} tone={KIND_TONE[sku.kind]} />
      </View>
    </>
  );
  const label = `${sku.name}, ${sku.sku_code}, ${SKU_KIND_LABELS[sku.kind]}${price ? `, satış ${price}` : ""}`;
  if (!onPress) {
    return (
      <View style={styles.row} accessible accessibilityLabel={label}>
        {content}
      </View>
    );
  }
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Düzenlemek için dokunun"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID={`sku-row-${sku.id}`}
    >
      {content}
    </Pressable>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    content: { paddingBottom: t.spacing.huge },
    header: { paddingTop: t.layout.screenPadding, paddingBottom: t.spacing.md, gap: t.spacing.md },
    searchRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, paddingHorizontal: t.layout.screenPadding },
    chips: { gap: t.spacing.sm, paddingHorizontal: t.layout.screenPadding },
    flex: { flex: 1 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      minHeight: 64,
      paddingVertical: t.spacing.sm,
      paddingHorizontal: t.layout.screenPadding,
      backgroundColor: t.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    pressed: { backgroundColor: t.colors.surfacePressed },
    right: { alignItems: "flex-end", gap: t.spacing.xs },
    footer: { paddingVertical: t.spacing.md },
  })
);
