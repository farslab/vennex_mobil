/**
 * Cihaz seçici — `GET pos-devices/?q=` sunucu araması + sonsuz sayfalama (25'lik sabit sayfa).
 * Satır başına detay isteği ATILMAZ. Liste yanıtında `pos_odemetip` olmadığından makine tipine
 * göre istemci filtresi yapılamaz (§3.9) → `notice` ile kullanıcıya açıklanır.
 */
import React, { useState } from "react";
import { useOnOpen } from "@/components/devices/useOnOpen";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import {
  AppBadge,
  AppButton,
  AppEmptyState,
  AppErrorState,
  AppIcon,
  AppListSkeleton,
  AppNotice,
  AppSearchField,
  AppSheet,
  AppText,
  makeStyles,
} from "@/design-system";
import { devicesApi } from "@/api/devices";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { usePagedList } from "@/hooks/usePagedList";
import { connectivityInfo, deviceTitle } from "./deviceHelpers";
import type { PosDeviceListItem, PosDeviceListResponse } from "@/types/devices";
import { ListLoadMoreFooter } from "@/components/ListLoadMoreFooter";

export const devicePickerKey = (q: string) => [...queryKeys.devices.all, "picker", q] as const;

interface BaseProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  notice?: string;
  /** Zaten eşli/işaretli cihazlar (rozetle gösterilir) */
  markedSns?: string[];
  markedLabel?: string;
  /** İşaretli cihazlar tikli ve kilitli görünür; seçime/gönderime katılmaz (ör. şablona zaten eşli) */
  markedLocked?: boolean;
  confirmLabel: string;
  loading?: boolean;
}

interface MultiProps extends BaseProps {
  multiple: true;
  onConfirm: (sns: string[]) => void;
}
interface SingleProps extends BaseProps {
  multiple?: false;
  onConfirm: (sn: string) => void;
}

export type DevicePickerSheetProps = MultiProps | SingleProps;

export function DevicePickerSheet(props: DevicePickerSheetProps) {
  const {
    visible,
    onClose,
    title,
    subtitle,
    notice,
    markedSns = [],
    markedLabel = "Eşli",
    markedLocked = false,
    confirmLabel,
    loading,
  } = props;
  const styles = useStyles();
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const debounced = useDebouncedValue(q.trim(), 350);

  useOnOpen(visible, () => {
      setSelected([]);
      setQ("");
  });

  const list = usePagedList<PosDeviceListItem, PosDeviceListResponse>({
    queryKey: devicePickerKey(debounced),
    fetchPage: (page, signal) => devicesApi.list({ page, q: debounced || undefined }, signal),
    enabled: visible,
  });

  const toggle = (sn: string) => {
    if (props.multiple) setSelected((s) => (s.includes(sn) ? s.filter((x) => x !== sn) : [...s, sn]));
    else setSelected((s) => (s[0] === sn ? [] : [sn]));
  };

  const confirm = () => {
    if (!selected.length) return;
    if (props.multiple) props.onConfirm(selected);
    else props.onConfirm(selected[0]);
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      scrollable={false}
      dismissible={!loading}
      testID="device-picker"
      footer={
        <>
          <AppButton title="Vazgeç" variant="outline" onPress={onClose} disabled={loading} style={styles.flex} />
          <AppButton
            testID="device-picker-confirm"
            title={props.multiple && selected.length ? `${confirmLabel} (${selected.length})` : confirmLabel}
            onPress={confirm}
            disabled={!selected.length}
            loading={loading}
            style={styles.flex}
          />
        </>
      }
    >
      {notice ? <AppNotice tone="info" message={notice} /> : null}
      <AppSearchField value={q} onChangeText={setQ} placeholder="Cihaz adı veya seri no" testID="device-picker-search" />
      {list.isLoading ? (
        <AppListSkeleton rows={5} />
      ) : list.isError ? (
        <AppErrorState compact message={errorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(d) => d.sn}
          style={styles.list}
          keyboardShouldPersistTaps="handled"
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.4}
          ListEmptyComponent={<AppEmptyState compact icon="search" title="Cihaz bulunamadı" />}
          ListFooterComponent={<ListLoadMoreFooter loading={list.isFetchingMore} error={list.loadMoreError} onRetry={list.retryLoadMore} />}
          renderItem={({ item }) => {
            const marked = markedSns.includes(item.sn);
            const locked = markedLocked && marked;
            const checked = locked || selected.includes(item.sn);
            const conn = connectivityInfo(item.online);
            return (
              <Pressable
                onPress={() => toggle(item.sn)}
                disabled={locked}
                accessibilityRole={props.multiple ? "checkbox" : "radio"}
                accessibilityState={{ checked, disabled: locked }}
                accessibilityLabel={`${deviceTitle(item)}, ${item.sn}${marked ? `, ${markedLabel}` : ""}`}
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                testID={`device-pick-${item.sn}`}
              >
                <View style={[styles.box, !props.multiple && styles.radio, checked && styles.boxOn, locked && styles.boxLocked]}>
                  {checked ? <AppIcon name="check" size={14} color="onPrimary" /> : null}
                </View>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {deviceTitle(item)}
                  </AppText>
                  <AppText variant="mono" color="textTertiary" numberOfLines={1}>
                    {item.sn}
                    {item.location_name ? ` · ${item.location_name}` : ""}
                  </AppText>
                </View>
                {marked ? <AppBadge size="sm" tone="info" label={markedLabel} /> : null}
                <AppBadge size="sm" dot tone={conn.tone} label={conn.label} />
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
    boxLocked: { opacity: 0.5 },
    flex: { flex: 1 },
    list: { maxHeight: 400 },
    footer: { paddingVertical: t.spacing.md },
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
    box: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    radio: { borderRadius: 11 },
    boxOn: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  })
);
