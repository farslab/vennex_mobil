import React, { useState } from "react";
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
import { stockApi } from "@/api/stock";
import { errorMessage } from "@/api/client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { unitShort } from "@/components/stock/stockFormat";
import { SKU_KIND_LABELS, type StockSku } from "@/types/stock";
import { stockKeys } from "../hooks/useStockData";

export interface SkuPickerFieldProps {
  label: string;
  value: StockSku | null;
  onChange: (sku: StockSku) => void;
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  /** true → reçeteli ürünler hariç (fiziksel stok hareketi) */
  stockable?: boolean;
  testID?: string;
}

/** Sunucu tarafı aramalı SKU seçici — arama kutusu yükleme sırasında unmount edilmez */
export function SkuPickerField({ label, value, onChange, error, required, disabled, stockable = true, testID }: SkuPickerFieldProps) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q.trim(), 350);

  const query = useQuery({
    queryKey: stockKeys.skuSearch({ q: debounced, stockable }),
    queryFn: ({ signal }) => stockApi.skus.list({ q: debounced, stockable }, signal),
    enabled: open,
    staleTime: 60_000,
    placeholderData: (prev) => prev,
  });

  const pick = (sku: StockSku) => {
    onChange(sku);
    setOpen(false);
  };

  const results = query.data ?? [];
  const selectedText = value ? `${value.name} · ${value.sku_code}` : null;

  return (
    <View style={styles.root}>
      <AppText variant="label" color="textSecondary">
        {label}
        {required ? <AppText variant="label" color="danger"> *</AppText> : null}
      </AppText>
      <Pressable
        testID={testID}
        onPress={() => {
          setQ("");
          setOpen(true);
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${selectedText ?? "seçilmedi"}`}
        accessibilityState={{ disabled: !!disabled, expanded: open }}
        style={({ pressed }) => [styles.field, error ? styles.fieldError : null, disabled ? styles.fieldDisabled : null, pressed ? styles.pressed : null]}
      >
        <AppIcon name="package" size={18} color="textTertiary" />
        <AppText variant="body" color={selectedText ? "text" : "textTertiary"} numberOfLines={1} style={styles.flex}>
          {selectedText ?? "Ürün seçin"}
        </AppText>
        <AppIcon name="chevron-down" size={18} color="textTertiary" />
      </Pressable>
      {error ? (
        <AppText variant="caption" color="danger">
          {error}
        </AppText>
      ) : null}

      <AppSheet visible={open} onClose={() => setOpen(false)} title={label} subtitle="Ad, SKU kodu veya barkod ile arayın" scrollable={false}>
        <AppSearchField value={q} onChangeText={setQ} placeholder="Ürün ara" autoFocus testID="sku-picker-search" />
        {query.isLoading && results.length === 0 ? (
          <AppListSkeleton rows={4} />
        ) : query.isError && results.length === 0 ? (
          <AppErrorState compact message={errorMessage(query.error)} onRetry={() => query.refetch()} retrying={query.isFetching} />
        ) : (
          <FlatList
            data={results}
            keyExtractor={(s) => String(s.id)}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            initialNumToRender={20}
            ListEmptyComponent={<AppEmptyState compact icon="search" title="Ürün bulunamadı" description={debounced ? `"${debounced}" için sonuç yok.` : undefined} />}
            renderItem={({ item }) => {
              const selected = value?.id === item.id;
              return (
                <Pressable
                  onPress={() => pick(item)}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  accessibilityLabel={`${item.name}, ${item.sku_code}, ${SKU_KIND_LABELS[item.kind]}`}
                  style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                >
                  <View style={styles.flex}>
                    <AppText variant="body" weight={selected ? "600" : "400"} numberOfLines={1}>
                      {item.name}
                    </AppText>
                    <AppText variant="mono" color="textTertiary" numberOfLines={1}>
                      {item.sku_code}
                      {item.barcode ? ` · ${item.barcode}` : ""}
                    </AppText>
                  </View>
                  {item.kind === "ingredient" ? <AppBadge size="sm" label={`Bileşen · ${unitShort(item.base_unit)}`} tone="info" /> : null}
                  {selected ? <AppIcon name="check" size={18} color="primary" /> : null}
                </Pressable>
              );
            }}
            ListFooterComponent={
              query.isFetching && results.length > 0 ? (
                <AppText variant="caption" color="textTertiary" align="center" style={styles.footer}>
                  Aranıyor…
                </AppText>
              ) : null
            }
          />
        )}
      </AppSheet>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { gap: t.spacing.xs },
    flex: { flex: 1 },
    field: {
      minHeight: t.layout.controlHeight,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: t.radius.sm,
      backgroundColor: t.colors.surface,
      paddingHorizontal: t.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.sm,
    },
    fieldError: { borderColor: t.colors.danger },
    fieldDisabled: { backgroundColor: t.colors.surfaceMuted, opacity: 0.7 },
    pressed: { backgroundColor: t.colors.surfacePressed },
    list: { maxHeight: 420 },
    option: {
      minHeight: t.layout.minTouchTarget,
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      paddingVertical: t.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    footer: { paddingVertical: t.spacing.sm },
  })
);
