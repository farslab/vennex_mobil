/**
 * Gerçek SKU listesinden seçim (`GET stock/skus/?q=`). Arama sunucu tarafında, 350 ms debounce.
 * Bileşen (ingredient) türleri slota/şablona konamaz → api katmanında elenir.
 */
import React, { useState } from "react";
import { useOnOpen } from "@/components/devices/useOnOpen";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  AppBadge,
  AppEmptyState,
  AppErrorState,
  AppIcon,
  AppListSkeleton,
  AppSearchField,
  AppSheet,
  AppText,
  makeStyles,
} from "@/design-system";
import { devicesApi } from "@/api/devices";
import { errorMessage, type ApiError } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency } from "@/utils/number";
import type { DeviceSkuOption } from "@/types/devices";

export const skuQueryKey = (q: string) => [...queryKeys.devices.all, "sku-options", q] as const;

export interface SkuPickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onSelect: (sku: DeviceSkuOption) => void;
  selectedId?: number | null;
  title?: string;
}

export function SkuPickerSheet({ visible, onClose, onSelect, selectedId, title = "SKU seçin" }: SkuPickerSheetProps) {
  const styles = useStyles();
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q.trim(), 350);

  useOnOpen(visible, () => setQ(""));

  const query = useQuery({
    queryKey: skuQueryKey(debounced),
    queryFn: ({ signal }) => devicesApi.skus(debounced || undefined, signal),
    enabled: visible,
    staleTime: 60_000,
  });

  const forbidden = (query.error as ApiError | null)?.status === 403;

  return (
    <AppSheet visible={visible} onClose={onClose} title={title} scrollable={false} testID="sku-picker">
      <AppSearchField value={q} onChangeText={setQ} placeholder="Ad, kod veya barkod ara" testID="sku-search" />
      {query.isLoading ? (
        <AppListSkeleton rows={5} />
      ) : query.isError ? (
        <AppErrorState
          compact
          title={forbidden ? "SKU listesine erişim yok" : "SKU'lar yüklenemedi"}
          message={forbidden ? "SKU listesini görmek için stok yönetimi yetkisi gerekir." : errorMessage(query.error)}
          onRetry={forbidden ? undefined : () => query.refetch()}
          retrying={query.isFetching}
        />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(s) => String(s.id)}
          keyboardShouldPersistTaps="handled"
          style={styles.list}
          initialNumToRender={20}
          ListEmptyComponent={
            <AppEmptyState compact icon="search" title="SKU bulunamadı" description={debounced ? "Aramanızı değiştirin." : undefined} />
          }
          renderItem={({ item }) => {
            const selected = item.id === selectedId;
            return (
              <Pressable
                onPress={() => {
                  onSelect(item);
                  onClose();
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={`${item.name}${item.sku_code ? `, kod ${item.sku_code}` : ""}`}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              >
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {item.name}
                  </AppText>
                  <View style={styles.meta}>
                    {item.sku_code ? (
                      <AppText variant="mono" color="textTertiary">
                        {item.sku_code}
                      </AppText>
                    ) : null}
                    {item.kind === "composite" ? <AppBadge size="sm" tone="info" label="Reçeteli" /> : null}
                  </View>
                </View>
                {item.sale_price != null ? (
                  <AppText variant="numericSm" color="textSecondary">
                    {formatCurrency(item.sale_price)}
                  </AppText>
                ) : null}
                {selected ? <AppIcon name="check" size={18} color="primary" /> : null}
              </Pressable>
            );
          }}
        />
      )}
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    list: { maxHeight: 440 },
    row: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      paddingVertical: t.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    pressed: { backgroundColor: t.colors.surfacePressed },
    meta: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, marginTop: 2 },
  })
);
