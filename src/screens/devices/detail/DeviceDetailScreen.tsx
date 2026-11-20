/**
 * Cihaz detayı — route "DeviceDetail" { sn, name? }.
 * Sekmeler yetkiye göre: Genel · Satışlar · Stok · İstatistikler · Ayarlar.
 * Nakit toplama & ciro sayımı Genel sekmesinin en altında (ayrı sekme yok).
 * Uzaktan satış: başlığın sağ üstünde büyük ikon (remote_vend yetkisi), WebSocket kanalı (src/realtime/posVendChannel.ts) — web dashboard ile aynı protokol.
 */
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import {
  AppConfirmSheet,
  AppErrorState,
  AppSkeleton,
  makeStyles,
} from "@/design-system";
import { errorMessage, type ApiError } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { RootScreenProps } from "@/navigation/types";
import { useDeviceAccess, useDeviceDetail } from "./useDeviceQueries";
import { GeneralTab } from "./tabs/GeneralTab";
import { SalesTab } from "./tabs/SalesTab";
import { StockTab } from "./tabs/StockTab";
import { StatsTab } from "./tabs/StatsTab";
import { SettingsTab } from "./tabs/SettingsTab";
import { RemoteSaleSheet } from "./components/RemoteSaleSheet";
import { DeviceTabBar, type DeviceTabItem, type DeviceTabStyle } from "./components/DeviceTabBar";
import { DeviceHeader, type DeviceHeaderStyle } from "./components/DeviceHeader";

/**
 * Başlık ve sekme görünümü (deneme sürüyor). Beğenilen adaylar:
 * "card" + "icons", "compact" + "dark", "compact" + "icons".
 * Şu an deneniyor: "card" + "segment".
 */
const HEADER_STYLE: DeviceHeaderStyle = "card";
const TAB_STYLE: DeviceTabStyle = "segment";

export type DeviceTabKey = "general" | "sales" | "stock" | "stats" | "settings";

export default function DeviceDetailScreen({ route, navigation }: RootScreenProps<"DeviceDetail">) {
  const { sn, name } = route.params;
  const styles = useStyles();
  const queryClient = useQueryClient();
  const detailQuery = useDeviceDetail(sn);
  const detail = detailQuery.data;
  const access = useDeviceAccess(detail);
  const [tab, setTab] = useState<DeviceTabKey>("general");
  const [refreshing, setRefreshing] = useState(false);
  const [remoteOpen, setRemoteOpen] = useState(false);
  // Ayarlar sekmesinde kaydedilmemiş değişiklik: sekme değişince SettingsTab kapanır ve form kaybolur →
  // önce onay (useUnsavedChangesGuard yalnız ekrandan çıkışı korur)
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [pendingTab, setPendingTab] = useState<DeviceTabKey | null>(null);

  const title = detail?.pos_name || name || sn;
  useEffect(() => {
    navigation.setOptions({ title });
  }, [navigation, title]);
  const inactive = detail ? !detail.stat : false;
  // Yerel başlık gizli: geri, ad, seri no ve uzaktan satış ekranın kendi başlığında (DeviceHeader)
  useLayoutEffect(() => {
    navigation.setOptions({ headerShown: false });
  }, [navigation]);

  // Uzaktan satış: yetki varsa başlığın sağ üstünde
  const canRemoteVend = !!detail && access.remoteVend;
  const openRemote = useCallback(() => setRemoteOpen(true), []);
  const goBack = useCallback(() => navigation.goBack(), [navigation]);

  const tabs = useMemo<DeviceTabItem[]>(() => {
    const list: DeviceTabItem[] = [{ key: "general", label: "Genel" }];
    if (access.sales) list.push({ key: "sales", label: "Satışlar" });
    list.push({ key: "stock", label: "Stok" });
    // Beş sekme tek satıra eşit sığsın: "İstatistikler" → "İstatistik"
    if (access.sales) list.push({ key: "stats", label: "İstatistik" });
    // Web: Ayarlar sekmesi yalnız cihaz ayarı yetkisiyle görünür (`pos_device_detail.html:53,59`)
    if (access.manageSettings) list.push({ key: "settings", label: "Ayarlar" });
    return list;
  }, [access.sales, access.manageSettings]);

  // Yetki değişip seçili sekme kalktıysa Genel'e dön
  const activeTab = tabs.some((t) => t.key === tab) ? tab : "general";

  const changeTab = useCallback(
    (next: DeviceTabKey) => {
      if (next === activeTab) return;
      if (activeTab === "settings" && settingsDirty) setPendingTab(next);
      else setTab(next);
    },
    [activeTab, settingsDirty]
  );

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
        // İstatistikler sekmesi KPI'ları (tüm dönem/saat parametreleri)
        queryClient.invalidateQueries({ queryKey: [...queryKeys.devices.all, "stats", sn] }),
        queryClient.invalidateQueries({ queryKey: [...queryKeys.devices.all, "tx-summary", sn] }),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [queryClient, sn]);

  if (detailQuery.isLoading) {
    return (
      <View style={styles.root} testID="device-detail-loading">
        <DeviceHeader variant={HEADER_STYLE} title={title} sn={sn} onBack={goBack} />
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
        <DeviceHeader variant={HEADER_STYLE} title={title} sn={sn} onBack={goBack} />
        <AppErrorState
          title={status === 404 ? "Cihaz bulunamadı" : "Cihaz yüklenemedi"}
          message={status === 404 ? "Bu cihaz mevcut değil veya erişim yetkiniz yok." : errorMessage(detailQuery.error)}
          onRetry={() => detailQuery.refetch()}
          retrying={detailQuery.isFetching}
        />
      </View>
    );
  }

  return (
    <View style={styles.root} testID="device-detail">
      <DeviceHeader
        variant={HEADER_STYLE}
        title={title}
        sn={detail.sn}
        location={detail.location?.name}
        inactive={inactive}
        online={detail.is_online}
        onBack={goBack}
        onRemoteSale={canRemoteVend ? openRemote : undefined}
      >
        <DeviceTabBar variant={TAB_STYLE} items={tabs} value={activeTab} onChange={changeTab} testID="device-tabs" />
      </DeviceHeader>
      <View style={styles.flex}>
        {activeTab === "general" ? <GeneralTab sn={sn} detail={detail} access={access} refreshing={refreshing} onRefresh={refreshAll} /> : null}
        {activeTab === "sales" ? <SalesTab sn={sn} /> : null}
        {activeTab === "stock" ? <StockTab sn={sn} detail={detail} access={access} /> : null}
        {activeTab === "stats" ? <StatsTab sn={sn} refreshing={refreshing} onRefresh={refreshAll} /> : null}
        {activeTab === "settings" ? <SettingsTab sn={sn} detail={detail} access={access} onDirtyChange={setSettingsDirty} /> : null}
      </View>
      <AppConfirmSheet
        visible={pendingTab != null}
        title="Kaydedilmemiş değişiklikler"
        message="Ayarlarda kaydedilmemiş değişiklikler var. Sekmeden çıkarsanız bu değişiklikler kaybolur."
        confirmLabel="Değişiklikleri at"
        cancelLabel="Kal"
        destructive
        onConfirm={() => {
          if (pendingTab) setTab(pendingTab);
          setSettingsDirty(false);
          setPendingTab(null);
        }}
        onCancel={() => setPendingTab(null)}
      />
      {canRemoteVend ? (
        <RemoteSaleSheet visible={remoteOpen} onClose={() => setRemoteOpen(false)} sn={detail.sn} deviceName={detail.pos_name} />
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    body: { padding: t.layout.screenPadding, gap: t.spacing.md },
  })
);
