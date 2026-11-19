import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  AppBadge,
  AppButton,
  AppEmptyState,
  AppErrorState,
  AppListSkeleton,
  AppNotice,
  AppSearchField,
  AppSegmented,
  AppText,
  makeStyles,
  useTheme,
} from "@/design-system";
import { stockApi } from "@/api/stock";
import { errorMessage } from "@/api/client";
import { usePagedList } from "@/hooks/usePagedList";
import { useAuthStore } from "@/store/authStore";
import { canManageStock } from "@/auth/permissions";
import { normalizeForSearch } from "@/utils/text";
import { formatInteger } from "@/utils/number";
import { formatDateTime } from "@/utils/date";
import { LocationTypeBadge, LocationTypeIcon } from "@/components/stock/LocationTypeIcon";
import { formatStockQuantity, stockLevelOf } from "@/components/stock/stockFormat";
import type { RootScreenProps } from "@/navigation/types";
import type { StockBaseUnit, StockInventoryRow, StockMovement } from "@/types/stock";
import { stockKeys, useSkuIndex } from "./hooks/useStockData";
import { MovementRow } from "./components/MovementRow";
import { MovementFormSheet, type MovementMode } from "./components/MovementFormSheet";
import { StatStrip } from "./components/StatStrip";
import { ListLoadMoreFooter } from "@/components/ListLoadMoreFooter";

type Pane = "inventory" | "movements";

/** Lokasyon detayı: envanter (`/locations/{id}/inventory/`) + hareket geçmişi (`/locations/{id}/movements/`, 25'lik sayfa) */
export default function StockLocationDetailScreen({ route, navigation }: RootScreenProps<"StockLocationDetail">) {
  const { locationId, name } = route.params;
  const styles = useStyles();
  const { colors } = useTheme();
  const user = useAuthStore((s) => s.user);
  const canManage = canManageStock(user);
  const [pane, setPane] = useState<Pane>("inventory");
  const [movementsVisited, setMovementsVisited] = useState(false);
  const [q, setQ] = useState("");
  // Açık/kapalı ayrı tutulur: kapanırken son mod korunur (form key'i moda bağlı → mod değişirse
  // kapanış animasyonunda "Transfer" olarak yeniden mount olup titrerdi)
  const [formOpen, setFormOpen] = useState(false);
  const [formMode, setFormMode] = useState<MovementMode>("transfer");
  const openForm = (mode: MovementMode) => {
    setFormMode(mode);
    setFormOpen(true);
  };
  const [refreshing, setRefreshing] = useState(false);

  const inventory = useQuery({
    queryKey: stockKeys.inventory(locationId),
    queryFn: ({ signal }) => stockApi.locations.inventoryDetail(locationId, signal),
    staleTime: 15_000,
  });
  const skus = useSkuIndex();
  const movements = usePagedList<StockMovement>({
    queryKey: stockKeys.locationMovements(locationId),
    fetchPage: (page, signal) => stockApi.locations.movements(locationId, page, signal),
    enabled: movementsVisited,
  });

  const location = inventory.data?.location ?? null;
  const title = location?.name ?? name ?? "Lokasyon";
  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const rows = useMemo(() => inventory.data?.results ?? [], [inventory.data]);
  const filtered = useMemo(() => {
    const nq = normalizeForSearch(q);
    if (!nq) return rows;
    return rows.filter((r) => normalizeForSearch(`${r.sku_name} ${r.sku_code}`).includes(nq));
  }, [rows, q]);

  const isVending = location?.location_type === "vending_machine";

  const selectPane = (p: Pane) => {
    setPane(p);
    if (p === "movements") setMovementsVisited(true);
  };

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([inventory.refetch(), pane === "movements" ? movements.refresh() : Promise.resolve()]);
    } finally {
      setRefreshing(false);
    }
  }, [inventory, movements, pane]);

  const header = (
    <View style={styles.header}>
      {location ? (
        <View style={styles.identity}>
          <LocationTypeIcon type={location.location_type} size={44} />
          <View style={styles.flex}>
            <AppText variant="headline" numberOfLines={2}>
              {location.name}
            </AppText>
            <View style={styles.badges}>
              <LocationTypeBadge type={location.location_type} />
              {!location.is_active ? <AppBadge size="sm" label="Pasif" tone="neutral" dot /> : null}
              {location.pos_device_sn ? (
                <AppText variant="mono" color="textTertiary">
                  {location.pos_device_sn}
                </AppText>
              ) : null}
            </View>
          </View>
        </View>
      ) : null}

      {inventory.isSuccess ? (
        <StatStrip
          items={[
            { label: "Kalem", value: formatInteger(rows.length) },
            { label: "Tükenen", value: formatInteger(rows.filter((r) => r.quantity === 0).length) },
            {
              label: "Negatif",
              value: formatInteger(rows.filter((r) => r.quantity < 0).length),
              tone: rows.some((r) => r.quantity < 0) ? "danger" : "text",
            },
          ]}
        />
      ) : null}

      {canManage && location && !isVending && location.is_active ? (
        <View style={styles.actions}>
          <AppButton title="Transfer" onPress={() => openForm("transfer")} style={styles.flex} testID="detail-transfer" />
          <AppButton title="Giriş" variant="secondary" onPress={() => openForm("receipt")} style={styles.flex} testID="detail-receipt" />
          <AppButton title="Düzeltme" variant="secondary" onPress={() => openForm("adjustment")} style={styles.flex} testID="detail-adjustment" />
        </View>
      ) : null}
      {/* Hareket formu yalnız aktif lokasyonları listeler → pasif lokasyon ön seçilemezdi (özet `#id` gösterirdi) */}
      {canManage && location && !isVending && !location.is_active ? (
        <AppNotice message="Pasif lokasyonda stok hareketi yapılamaz. Hareket için lokasyonu Lokasyonlar sekmesinden aktif yapın." />
      ) : null}
      {isVending ? (
        <AppNotice message="Otomat stoğu dolum ve satışla değişir; düzenleme POS cihazı sayfasındaki ürünler ekranından yapılır." />
      ) : null}

      <AppSegmented<Pane>
        items={[
          { key: "inventory", label: "Envanter", count: inventory.isSuccess ? rows.length : undefined },
          { key: "movements", label: "Hareketler", count: movements.firstPage ? movements.total : undefined },
        ]}
        value={pane}
        onChange={selectPane}
        testID="detail-pane"
      />
      {pane === "inventory" && rows.length > 0 ? (
        <AppSearchField value={q} onChangeText={setQ} placeholder="Ürün ara" testID="inventory-search" />
      ) : null}
    </View>
  );

  const refreshControl = <RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />;

  return (
    <View style={styles.root}>
      {pane === "inventory" ? (
        <FlatList
          key="inventory"
          data={inventory.isSuccess ? filtered : []}
          keyExtractor={(r) => String(r.id)}
          ListHeaderComponent={header}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
          refreshControl={refreshControl}
          initialNumToRender={20}
          ListEmptyComponent={
            inventory.isLoading ? (
              <AppListSkeleton rows={6} />
            ) : inventory.isError ? (
              <AppErrorState message={errorMessage(inventory.error)} onRetry={() => inventory.refetch()} retrying={inventory.isFetching} />
            ) : rows.length === 0 ? (
              <AppEmptyState icon="inbox" title="Bu lokasyonda stok yok" description="Stok girişi veya transfer yapıldığında ürünler burada listelenir." />
            ) : (
              <AppEmptyState compact icon="search" title="Sonuç yok" />
            )
          }
          renderItem={({ item }) => <InventoryRow row={item} unit={skus.byId.get(item.sku)?.base_unit} />}
        />
      ) : (
        <FlatList
          key="movements"
          data={movements.items}
          keyExtractor={(m) => String(m.id)}
          ListHeaderComponent={header}
          contentContainerStyle={styles.content}
          refreshControl={refreshControl}
          onEndReached={movements.loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={
            movements.isLoading ? (
              <AppListSkeleton rows={6} />
            ) : movements.isError ? (
              <AppErrorState message={errorMessage(movements.error)} onRetry={() => movements.refetch()} />
            ) : (
              <AppEmptyState icon="activity" title="Hareket yok" description="Bu lokasyona ait stok hareketi bulunmuyor." />
            )
          }
          ListFooterComponent={<ListLoadMoreFooter loading={movements.isFetchingMore} error={movements.loadMoreError} onRetry={movements.retryLoadMore} />}
          renderItem={({ item }) => <MovementRow movement={item} locationId={locationId} unit={skus.byId.get(item.sku)?.base_unit} />}
        />
      )}
      {canManage ? (
        <MovementFormSheet visible={formOpen} mode={formMode} presetLocationId={locationId} onClose={() => setFormOpen(false)} />
      ) : null}
    </View>
  );
}

function InventoryRow({ row, unit }: { row: StockInventoryRow; unit?: StockBaseUnit }) {
  const styles = useStyles();
  const lvl = stockLevelOf(row.quantity);
  const qty = formatStockQuantity(row.quantity, unit);
  return (
    <View style={styles.row} accessible accessibilityLabel={`${row.sku_name}, ${row.sku_code}, ${qty}${lvl ? `, ${lvl.label}` : ""}`} testID={`inventory-row-${row.sku}`}>
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {row.sku_name}
        </AppText>
        <AppText variant="mono" color="textTertiary" numberOfLines={1}>
          {row.sku_code}
          {row.updated_at ? ` · ${formatDateTime(row.updated_at)}` : ""}
        </AppText>
      </View>
      <View style={styles.right}>
        <AppText variant="numeric" color={row.quantity < 0 ? "danger" : "text"}>
          {qty}
        </AppText>
        {lvl ? <AppBadge size="sm" label={lvl.label} tone={lvl.tone} dot /> : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    content: { paddingBottom: t.spacing.huge },
    header: { padding: t.layout.screenPadding, gap: t.spacing.md },
    identity: { flexDirection: "row", alignItems: "center", gap: t.spacing.md },
    badges: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: t.spacing.sm, marginTop: t.spacing.xs },
    actions: { flexDirection: "row", gap: t.spacing.sm },
    flex: { flex: 1 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      minHeight: 56,
      paddingVertical: t.spacing.sm,
      paddingHorizontal: t.layout.screenPadding,
      backgroundColor: t.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    right: { alignItems: "flex-end", gap: 2 },
    footer: { paddingVertical: t.spacing.lg },
  })
);
