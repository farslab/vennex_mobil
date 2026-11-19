import React, { useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  AppButton,
  AppChip,
  AppEmptyState,
  AppErrorState,
  AppListSkeleton,
  AppText,
  makeStyles,
  useTheme,
} from "@/design-system";
import { stockApi } from "@/api/stock";
import { errorMessage } from "@/api/client";
import { usePagedList } from "@/hooks/usePagedList";
import { formatInteger } from "@/utils/number";
import { MOVEMENT_TYPE_META } from "@/components/stock/stockFormat";
import type { StockMovement, StockMovementType } from "@/types/stock";
import { stockKeys, useSkuIndex } from "../hooks/useStockData";
import { MovementRow } from "../components/MovementRow";
import { MovementFormSheet, type MovementMode } from "../components/MovementFormSheet";
import { ListLoadMoreFooter } from "@/components/ListLoadMoreFooter";

const FILTERS: StockMovementType[] = ["transfer", "receipt", "adjustment", "refill", "consumption"];

export function MovementsTab({ canManage }: { canManage: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [type, setType] = useState<StockMovementType | null>(null);
  const [mode, setMode] = useState<MovementMode>("transfer");
  const [formOpen, setFormOpen] = useState(false);
  const skus = useSkuIndex();

  const list = usePagedList<StockMovement>({
    queryKey: stockKeys.movements({ type }),
    fetchPage: (page, signal) => stockApi.movements.list({ type: type ?? undefined, page }, signal),
  });

  const open = (m: MovementMode) => {
    setMode(m);
    setFormOpen(true);
  };

  const header = (
    <View style={styles.header}>
      {canManage ? (
        <View style={styles.actions}>
          <AppButton title="Transfer" onPress={() => open("transfer")} style={styles.flex} testID="movement-new-transfer" />
          <AppButton title="Giriş" variant="secondary" onPress={() => open("receipt")} style={styles.flex} testID="movement-new-receipt" />
          <AppButton title="Düzeltme" variant="secondary" onPress={() => open("adjustment")} style={styles.flex} testID="movement-new-adjustment" />
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <AppChip label="Tümü" selected={type == null} onPress={() => setType(null)} />
        {FILTERS.map((t) => (
          <AppChip key={t} label={MOVEMENT_TYPE_META[t].label} icon={MOVEMENT_TYPE_META[t].icon} selected={type === t} onPress={() => setType(t)} />
        ))}
      </ScrollView>
      {list.firstPage ? (
        <AppText variant="caption" color="textTertiary" style={styles.count}>
          {formatInteger(list.total)} hareket
        </AppText>
      ) : null}
    </View>
  );

  return (
    <>
      <FlatList
        data={list.items}
        keyExtractor={(m) => String(m.id)}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        refreshControl={<RefreshControl refreshing={list.isRefreshing} onRefresh={list.refresh} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={
          list.isLoading ? (
            <AppListSkeleton rows={6} />
          ) : list.isError ? (
            <AppErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />
          ) : (
            <AppEmptyState
              icon="activity"
              title="Hareket bulunamadı"
              description={type ? "Bu tipte kayıtlı hareket yok." : "Transfer, stok girişi ve düzeltmeler burada listelenir."}
            />
          )
        }
        ListFooterComponent={<ListLoadMoreFooter loading={list.isFetchingMore} error={list.loadMoreError} onRetry={list.retryLoadMore} />}
        renderItem={({ item }) => <MovementRow movement={item} unit={skus.byId.get(item.sku)?.base_unit} />}
      />
      {canManage ? <MovementFormSheet visible={formOpen} mode={mode} onClose={() => setFormOpen(false)} /> : null}
    </>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    content: { paddingBottom: t.spacing.huge },
    header: { paddingTop: t.layout.screenPadding, paddingBottom: t.spacing.sm, gap: t.spacing.md },
    actions: { flexDirection: "row", gap: t.spacing.sm, paddingHorizontal: t.layout.screenPadding },
    chips: { gap: t.spacing.sm, paddingHorizontal: t.layout.screenPadding },
    count: { paddingHorizontal: t.layout.screenPadding },
    flex: { flex: 1 },
    footer: { paddingVertical: t.spacing.lg },
  })
);
