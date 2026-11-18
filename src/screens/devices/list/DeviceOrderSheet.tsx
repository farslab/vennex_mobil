/**
 * Özel sıralama — backend `POST pos-devices/sort/` `{device_orders:[{sn, sort_order}]}` ve
 * `POST pos-devices/sort/reset/`. Sıra cihaz kaydında tutulur (şirketteki tüm kullanıcılar görür);
 * AsyncStorage'a yazılmaz. Basit ve güvenilir: yukarı/aşağı taşı, kaydet.
 */
import React, { useMemo, useState } from "react";
import { useOnOpen } from "@/components/devices/useOnOpen";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  AppButton,
  AppConfirmSheet,
  AppErrorState,
  AppIconButton,
  AppListSkeleton,
  AppNotice,
  AppSheet,
  AppText,
  makeStyles,
  toast,
  useTheme,
} from "@/design-system";
import { devicesApi } from "@/api/devices";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { usePagedList } from "@/hooks/usePagedList";
import { deviceTitle } from "@/components/devices/deviceHelpers";
import type { PosDeviceListItem, PosDeviceListResponse } from "@/types/devices";

export const deviceOrderKey = () => [...queryKeys.devices.all, "order-source"] as const;

export function DeviceOrderSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  /** Kullanıcının taşıdığı sıra (SN listesi); null → sunucu sırası */
  const [customSns, setCustomSns] = useState<string[] | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const dirty = customSns != null;

  useOnOpen(visible, () => setCustomSns(null));

  const list = usePagedList<PosDeviceListItem, PosDeviceListResponse>({
    queryKey: deviceOrderKey(),
    fetchPage: (page, signal) => devicesApi.list({ page, sort_by: "default" }, signal),
    enabled: visible,
  });

  // Taşınan sıra + sonradan yüklenen sayfalar sona eklenir
  const order = useMemo(() => {
    if (!customSns) return list.items;
    const bySn = new Map(list.items.map((d) => [d.sn, d]));
    const head = customSns.map((sn) => bySn.get(sn)).filter((d): d is PosDeviceListItem => !!d);
    const known = new Set(customSns);
    return [...head, ...list.items.filter((d) => !known.has(d.sn))];
  }, [customSns, list.items]);

  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = order.map((d) => d.sn);
    [next[index], next[target]] = [next[target], next[index]];
    setCustomSns(next);
  };

  const afterWrite = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.devices.all });
  };

  const save = useMutation({
    mutationFn: () => devicesApi.updateSortOrders(order.map((d, i) => ({ sn: d.sn, sort_order: i + 1 }))),
    onSuccess: (res) => {
      toast.success(res.detail || "Sıralama kaydedildi.");
      afterWrite();
      onClose();
    },
    onError: (e) => toast.error(errorMessage(e)),
  });

  const reset = useMutation({
    mutationFn: () => devicesApi.resetSortOrders(),
    onSuccess: (res) => {
      toast.success(res.detail || "Sıralama sıfırlandı.");
      setConfirmReset(false);
      afterWrite();
      onClose();
    },
  });

  const busy = save.isPending || reset.isPending;
  const total = list.total;

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title="Özel sıralama"
      subtitle="Cihazlar listede bu sırayla görünür (tüm kullanıcılar için)"
      scrollable={false}
      dismissible={!busy}
      testID="device-order-sheet"
      footer={
        <>
          <AppButton title="Sıfırla" variant="outline" onPress={() => setConfirmReset(true)} disabled={busy} style={styles.flex} />
          <AppButton
            testID="device-order-save"
            title="Kaydet"
            onPress={() => save.mutate()}
            disabled={!dirty || order.length === 0}
            loading={save.isPending}
            style={styles.flex}
          />
        </>
      }
    >
      {total > order.length && order.length > 0 ? (
        <AppNotice
          tone="info"
          message={`${total} cihazdan ${order.length} tanesi yüklendi. Kaydedince yalnız yüklenen cihazların sırası güncellenir; diğerleri sonda kalır.`}
        />
      ) : null}
      {list.isLoading ? (
        <AppListSkeleton rows={6} />
      ) : list.isError ? (
        <AppErrorState compact message={errorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : (
        <FlatList
          data={order}
          keyExtractor={(d) => d.sn}
          style={styles.list}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.4}
          ListFooterComponent={list.isFetchingMore ? <ActivityIndicator color={colors.primary} style={styles.footer} /> : null}
          renderItem={({ item, index }) => (
            <View style={styles.row} testID={`order-row-${item.sn}`}>
              <AppText variant="numericSm" color="textTertiary" style={styles.index}>
                {index + 1}
              </AppText>
              <View style={styles.flex}>
                <AppText variant="calloutStrong" numberOfLines={1}>
                  {deviceTitle(item)}
                </AppText>
                <AppText variant="mono" color="textTertiary" numberOfLines={1}>
                  {item.sn}
                </AppText>
              </View>
              <AppIconButton
                icon="chevron-up"
                label={`${deviceTitle(item)} yukarı taşı`}
                onPress={() => move(index, -1)}
                disabled={index === 0 || busy}
                testID={`order-up-${item.sn}`}
              />
              <AppIconButton
                icon="chevron-down"
                label={`${deviceTitle(item)} aşağı taşı`}
                onPress={() => move(index, 1)}
                disabled={index === order.length - 1 || busy}
                testID={`order-down-${item.sn}`}
              />
            </View>
          )}
        />
      )}

      <AppConfirmSheet
        visible={confirmReset}
        title="Sıralamayı sıfırla"
        message="Tüm cihazların özel sırası kaldırılır; liste ada göre sıralanır."
        confirmLabel="Sıfırla"
        destructive
        loading={reset.isPending}
        error={reset.error ? errorMessage(reset.error) : null}
        onConfirm={() => reset.mutate()}
        onCancel={() => {
          setConfirmReset(false);
          reset.reset();
        }}
      />
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    list: { maxHeight: 460 },
    footer: { paddingVertical: t.spacing.md },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.xs,
      minHeight: 52,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    index: { width: 28, textAlign: "center" },
  })
);
