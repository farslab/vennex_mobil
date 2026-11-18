/**
 * Cihaz detayı — route "DeviceDetail" { sn, name? }.
 * Sekmeler yetkiye göre: Genel · Nakit & Ciro · Satışlar · Stok · İstatistikler · Ayarlar.
 * Uzaktan satış yalnız WebSocket ile mümkün (§2.6) → bu sürümde yok (Genel'de AppNotice).
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  AppBadge,
  AppErrorState,
  AppSegmented,
  AppSkeleton,
  AppText,
  makeStyles,
  type SegmentItem,
} from "@/design-system";
import { errorMessage, type ApiError } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { connectivityInfo, machineTypeLabel } from "@/components/devices/deviceHelpers";
import type { RootScreenProps } from "@/navigation/types";
import { useDeviceAccess, useDeviceDetail } from "./useDeviceQueries";
import { GeneralTab } from "./tabs/GeneralTab";
import { CashTab } from "./tabs/CashTab";
import { SalesTab } from "./tabs/SalesTab";
import { StockTab } from "./tabs/StockTab";
import { StatsTab } from "./tabs/StatsTab";
import { SettingsTab } from "./tabs/SettingsTab";

export type DeviceTabKey = "general" | "cash" | "sales" | "stock" | "stats" | "settings";

export default function DeviceDetailScreen({ route, navigation }: RootScreenProps<"DeviceDetail">) {
  const { sn, name } = route.params;
  const styles = useStyles();
  const queryClient = useQueryClient();
  const detailQuery = useDeviceDetail(sn);
  const detail = detailQuery.data;
  const access = useDeviceAccess(detail);
  const [tab, setTab] = useState<DeviceTabKey>("general");
  const [refreshing, setRefreshing] = useState(false);

  const title = detail?.pos_name || name || sn;
  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);

  const tabs = useMemo<SegmentItem<DeviceTabKey>[]>(() => {
    const list: SegmentItem<DeviceTabKey>[] = [{ key: "general", label: "Genel" }];
    if (access.sales || access.manageSettings) list.push({ key: "cash", label: "Nakit & Ciro" });
    if (access.sales) list.push({ key: "sales", label: "Satışlar" });
    list.push({ key: "stock", label: "Stok" });
    if (access.sales) list.push({ key: "stats", label: "İstatistikler" });
    list.push({ key: "settings", label: "Ayarlar" });
    return list;
  }, [access.sales, access.manageSettings]);

  // Yetki değişip seçili sekme kalktıysa Genel'e dön
  const activeTab = tabs.some((t) => t.key === tab) ? tab : "general";

  /** Pull-to-refresh: bu cihaza ait tüm sorgular */
  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: queryKeys.devices.detail(sn) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.devices.summary(sn) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.devices.products(sn) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.devices.cashHistory(sn) }),
        queryClient.invalidateQueries({ queryKey: queryKeys.devices.revenueCounts(sn) }),
        queryClient.invalidateQueries({ queryKey: [...queryKeys.devices.all, "tx-summary", sn] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, sn]);

  if (detailQuery.isLoading) {
    return (
      <View style={styles.root} testID="device-detail-loading">
        <View style={styles.header}>
          <AppSkeleton width="55%" height={20} />
          <AppSkeleton width="35%" height={12} />
        </View>
        <View style={styles.body}>
          <AppSkeleton height={120} radius={12} />
          <AppSkeleton height={160} radius={12} />
        </View>
      </View>
    );
  }

  if (detailQuery.isError || !detail) {
    const status = (detailQuery.error as ApiError | null)?.status;
    return (
      <View style={styles.root}>
        <AppErrorState
          title={status === 404 ? "Cihaz bulunamadı" : "Cihaz yüklenemedi"}
          message={status === 404 ? "Bu cihaz mevcut değil veya erişim yetkiniz yok." : errorMessage(detailQuery.error)}
          onRetry={() => detailQuery.refetch()}
          retrying={detailQuery.isFetching}
        />
      </View>
    );
  }

  const conn = connectivityInfo(detail.is_online);
  const typeLabel = machineTypeLabel(detail.pos_odemetip);

  return (
    <View style={styles.root} testID="device-detail">
      <View style={styles.header}>
        <View style={styles.meta}>
          <AppText variant="mono" color="textTertiary" selectable>
            {detail.sn}
          </AppText>
          <AppBadge size="sm" dot tone={conn.tone} label={conn.label} />
          {!detail.stat ? <AppBadge size="sm" tone="neutral" label="Pasif" /> : null}
          {typeLabel !== "—" ? <AppBadge size="sm" tone="info" label={typeLabel} /> : null}
        </View>
      </View>
      <View style={styles.tabs}>
        <AppSegmented<DeviceTabKey> variant="tabs" items={tabs} value={activeTab} onChange={setTab} testID="device-tabs" />
      </View>
      <View style={styles.flex}>
        {activeTab === "general" ? <GeneralTab sn={sn} detail={detail} access={access} refreshing={refreshing} onRefresh={refreshAll} /> : null}
        {activeTab === "cash" ? <CashTab sn={sn} detail={detail} access={access} refreshing={refreshing} onRefresh={refreshAll} /> : null}
        {activeTab === "sales" ? <SalesTab sn={sn} /> : null}
        {activeTab === "stock" ? <StockTab sn={sn} detail={detail} access={access} /> : null}
        {activeTab === "stats" ? <StatsTab sn={sn} refreshing={refreshing} onRefresh={refreshAll} /> : null}
        {activeTab === "settings" ? <SettingsTab sn={sn} detail={detail} access={access} /> : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    header: {
      backgroundColor: t.colors.surface,
      paddingHorizontal: t.layout.screenPadding,
      paddingTop: t.spacing.md,
      paddingBottom: t.spacing.sm,
      gap: t.spacing.xs,
    },
    meta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: t.spacing.sm },
    tabs: { backgroundColor: t.colors.surface },
    body: { padding: t.layout.screenPadding, gap: t.spacing.md },
  })
);
