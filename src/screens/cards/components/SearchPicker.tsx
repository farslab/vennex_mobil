import React, { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, StyleSheet, View } from "react-native";
import type { QueryKey } from "@tanstack/react-query";
import {
  AppEmptyState,
  AppErrorState,
  AppIcon,
  AppListSkeleton,
  AppSearchField,
  AppSheet,
  AppText,
  makeStyles,
  useTheme,
} from "@/design-system";
import { usePagedList } from "@/hooks/usePagedList";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { errorMessage } from "@/api/client";
import type { PageResponse } from "@/api/pagination";

export interface SearchPickerProps<T> {
  label: string;
  required?: boolean;
  error?: string | null;
  placeholder?: string;
  sheetTitle?: string;
  searchPlaceholder?: string;
  /** Seçili kaydın görünen adı (null → seçilmedi) */
  valueLabel: string | null;
  selectedId?: number | null;
  onSelect: (item: T) => void;
  disabled?: boolean;
  queryKey: (q: string) => QueryKey;
  fetchPage: (page: number, q: string, signal?: AbortSignal) => Promise<PageResponse<T>>;
  getId: (item: T) => number;
  getLabel: (item: T) => string;
  getDescription?: (item: T) => string | null;
  emptyText?: string;
  testID?: string;
}

/**
 * Sunucu tarafı aramalı seçim alanı: sorgu `q` debounce ile backend'e gider, sonuçlar sayfalı
 * (sonsuz kaydırma). Yalnız sayfa açıkken istek atar.
 */
export function SearchPicker<T>({
  label,
  required,
  error,
  placeholder = "Seçin",
  sheetTitle,
  searchPlaceholder = "Ara",
  valueLabel,
  selectedId,
  onSelect,
  disabled,
  queryKey,
  fetchPage,
  getId,
  getLabel,
  getDescription,
  emptyText = "Sonuç bulunamadı",
  testID,
}: SearchPickerProps<T>) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 350);

  const list = usePagedList<T>({
    queryKey: queryKey(debounced.trim()),
    fetchPage: (page, signal) => fetchPage(page, debounced.trim(), signal),
    enabled: open,
  });

  return (
    <View style={styles.root}>
      <AppText variant="label" color="textSecondary">
        {label}
        {required ? <AppText variant="label" color="danger"> *</AppText> : null}
      </AppText>
      <Pressable
        testID={testID}
        disabled={disabled}
        onPress={() => {
          setQ("");
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${valueLabel ?? "seçilmedi"}`}
        accessibilityState={{ disabled: !!disabled, expanded: open }}
        style={({ pressed }) => [
          styles.field,
          error ? styles.fieldError : null,
          disabled ? styles.fieldDisabled : null,
          pressed ? styles.pressed : null,
        ]}
      >
        <AppText variant="body" color={valueLabel ? "text" : "textTertiary"} numberOfLines={1} style={styles.flex}>
          {valueLabel ?? placeholder}
        </AppText>
        <AppIcon name="search" size={16} color="textTertiary" />
      </Pressable>
      {error ? (
        <AppText variant="caption" color="danger">
          {error}
        </AppText>
      ) : null}

      <AppSheet visible={open} onClose={() => setOpen(false)} title={sheetTitle ?? label} scrollable={false}>
        <AppSearchField
          value={q}
          onChangeText={setQ}
          placeholder={searchPlaceholder}
          autoFocus
          testID={testID ? `${testID}-search` : undefined}
        />
        {list.isLoading ? (
          <AppListSkeleton rows={4} />
        ) : list.isError ? (
          <AppErrorState compact message={errorMessage(list.error)} onRetry={() => list.refetch()} />
        ) : (
          <FlatList
            data={list.items}
            keyExtractor={(item) => String(getId(item))}
            keyboardShouldPersistTaps="handled"
            style={styles.list}
            onEndReached={list.loadMore}
            onEndReachedThreshold={0.4}
            ListEmptyComponent={<AppEmptyState compact title={emptyText} icon="search" />}
            ListFooterComponent={
              list.isFetchingMore ? <ActivityIndicator color={colors.primary} style={styles.footer} /> : null
            }
            renderItem={({ item }) => {
              const id = getId(item);
              const selected = selectedId === id;
              const description = getDescription?.(item);
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item);
                    setOpen(false);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={({ pressed }) => [styles.option, pressed && styles.pressed]}
                >
                  <View style={styles.flex}>
                    <AppText variant="body" weight={selected ? "600" : "400"} numberOfLines={1}>
                      {getLabel(item)}
                    </AppText>
                    {description ? (
                      <AppText variant="caption" color="textTertiary" numberOfLines={1}>
                        {description}
                      </AppText>
                    ) : null}
                  </View>
                  {selected ? <AppIcon name="check" size={18} color="primary" /> : null}
                </Pressable>
              );
            }}
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
    footer: { paddingVertical: t.spacing.md },
    option: {
      minHeight: t.layout.minTouchTarget,
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      paddingVertical: t.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
  })
);
