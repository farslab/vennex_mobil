/** Genel — yalnız detay/summary/products yanıtlarındaki GERÇEK alanlar; uydurma şirket/SIM/tarih yok */
import React, { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppNotice,
  AppSkeleton,
  AppText,
  makeStyles,
  useTheme,
} from "@/design-system";
import { errorMessage } from "@/api/client";
import { FillBar, KeyValueRow, MetricCell } from "@/components/devices/DeviceUi";
import {
  PAYMENT_METHOD_LABELS,
  connectivityInfo,
  deviceFillInfo,
  machineStatusInfo,
  machineTypeLabel,
  priceManagementLabel,
} from "@/components/devices/deviceHelpers";
import { formatCurrency, formatInteger } from "@/utils/number";
import { formatDateTime, formatRelative } from "@/utils/date";
import type { PosDeviceDetail } from "@/types/devices";
import { useDeviceProducts, useDeviceSummary, type DeviceAccess } from "../useDeviceQueries";
import { RemoteSaleSheet } from "../components/RemoteSaleSheet";

export function GeneralTab({
  sn,
  detail,
  access,
  refreshing,
  onRefresh,
}: {
  sn: string;
  detail: PosDeviceDetail;
  access: DeviceAccess;
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const summary = useDeviceSummary(sn, access.sales);
  const products = useDeviceProducts(sn);
  const [remoteOpen, setRemoteOpen] = useState(false);

  const conn = connectivityInfo(detail.is_online);
  const macStatus = machineStatusInfo(detail.act_macstat);
  const fill = deviceFillInfo(products.data?.fill);
  const methods = detail.payment_methods ?? {};
  const enabledMethods = PAYMENT_METHOD_LABELS.filter((m) => methods[m.key] === true);
  const knownMethods = PAYMENT_METHOD_LABELS.filter((m) => typeof methods[m.key] === "boolean");

  const periods = summary.data
    ? ([
        ["Bugün", summary.data.today],
        ["Dün", summary.data.yesterday],
        ["Bu ay", summary.data.this_month],
        ["Geçen ay", summary.data.last_month],
      ] as const)
    : null;

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      testID="tab-general"
    >
      <AppCard title="Durum">
        <KeyValueRow label="Bağlantı" right={<AppBadge dot tone={conn.tone} label={conn.label} />} />
        <KeyValueRow
          label="Cihaz durumu"
          right={<AppBadge tone={detail.stat ? "success" : "neutral"} label={detail.stat ? "Aktif" : "Pasif"} />}
        />
        <KeyValueRow
          label="Makine durumu"
          right={macStatus ? <AppBadge tone={macStatus.tone} label={macStatus.label} /> : undefined}
          value={macStatus ? undefined : "—"}
        />
        <KeyValueRow
          label="Son iletişim"
          value={detail.last_seen ? `${formatRelative(detail.last_seen)} · ${formatDateTime(detail.last_seen)}` : "—"}
          last
        />
      </AppCard>

      {access.sales ? (
        <AppCard title="Ciro özeti" subtitle="Başarılı işlemler">
          {summary.isLoading ? (
            <View style={styles.grid}>
              {[0, 1, 2, 3].map((i) => (
                <AppSkeleton key={i} width="47%" height={58} radius={8} />
              ))}
            </View>
          ) : summary.isError ? (
            <AppNotice tone="warning" message={`Özet alınamadı: ${errorMessage(summary.error)}`} />
          ) : periods ? (
            <View style={styles.grid}>
              {periods.map(([label, p]) => (
                <MetricCell
                  key={label}
                  testID={`summary-${label}`}
                  label={label}
                  value={formatCurrency(p.revenue)}
                  caption={p.count != null ? `${formatInteger(p.count)} işlem` : null}
                />
              ))}
            </View>
          ) : null}
        </AppCard>
      ) : null}

      <AppCard
        title="Doluluk"
        headerRight={products.data ? <AppBadge size="sm" tone="neutral" label={products.data.mode === "stock" ? "Stok modu" : "Normal mod"} /> : undefined}
      >
        {products.isLoading ? (
          <AppSkeleton height={36} />
        ) : products.isError ? (
          <AppNotice tone="warning" message={`Ürün bilgisi alınamadı: ${errorMessage(products.error)}`} />
        ) : !products.data?.fill || (products.data.items.length === 0 && fill.source !== "containers") ? (
          <AppText variant="callout" color="textSecondary">
            Bu cihazda tanımlı ürün/slot yok.
          </AppText>
        ) : (
          <View style={styles.fillBlock}>
            <View style={styles.fillHead}>
              <AppText variant="metricMd" testID="general-fill-pct">
                {fill.label}
              </AppText>
              {fill.source === "containers" ? (
                <AppText variant="caption" color="textSecondary" testID="general-fill-source">
                  Bileşen hazneleri
                </AppText>
              ) : fill.detail ? (
                <AppText variant="numericSm" color="textSecondary">
                  {fill.detail} adet
                </AppText>
              ) : null}
            </View>
            <FillBar pct={fill.pct} tone={fill.tone} height={8} accessibilityLabel={`Doluluk ${fill.label}`} />
          </View>
        )}
      </AppCard>

      <AppCard title="Ödeme yöntemleri" subtitle={knownMethods.length ? `${enabledMethods.length} / ${knownMethods.length} açık` : undefined}>
        {knownMethods.length === 0 ? (
          <AppText variant="callout" color="textSecondary">
            Ödeme yöntemi bilgisi yok.
          </AppText>
        ) : enabledMethods.length === 0 ? (
          <AppText variant="callout" color="textSecondary">
            Tüm ödeme yöntemleri kapalı.
          </AppText>
        ) : (
          <View style={styles.badges}>
            {enabledMethods.map((m) => (
              <AppBadge key={m.key} tone="info" label={m.label} />
            ))}
          </View>
        )}
      </AppCard>

      <AppCard title="Cihaz bilgisi">
        <KeyValueRow label="Seri no" value={detail.sn} mono />
        <KeyValueRow label="Otomat adı" value={detail.act_vmc} />
        <KeyValueRow label="Otomat seri no" value={detail.act_vmcsn} mono />
        <KeyValueRow label="Ödeme tipi" value={machineTypeLabel(detail.pos_odemetip)} />
        <KeyValueRow label="Makine modeli" value={detail.machine_type?.name} />
        <KeyValueRow label="Fiyat yönetimi" value={priceManagementLabel(detail.price_management)} />
        <KeyValueRow label="Şirket" value={detail.company?.name} />
        <KeyValueRow label="Konum" value={detail.location?.name} />
        <KeyValueRow label="Uygulama sürümü" value={detail.app_vers} mono />
        <KeyValueRow label="BKM sürümü" value={detail.tp_vers} mono />
        <KeyValueRow label="SIM sinyal gücü" value={detail.act_sim_pw != null ? String(detail.act_sim_pw) : null} />
        <KeyValueRow label="Güncelleme periyodu" value={detail.pos_updprd != null ? `${detail.pos_updprd} dk` : null} last />
      </AppCard>

      {access.remoteVend ? (
        <AppCard title="Uzaktan satış" subtitle="Müşterinin seçtiği ürünü uzaktan onaylayın">
          <AppButton
            testID="open-remote-sale"
            title="Uzaktan satışı başlat"
            icon="radio"
            variant="outline"
            onPress={() => setRemoteOpen(true)}
          />
          <RemoteSaleSheet
            visible={remoteOpen}
            onClose={() => setRemoteOpen(false)}
            sn={detail.sn}
            deviceName={detail.pos_name}
          />
        </AppCard>
      ) : null}
    </ScrollView>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    content: { padding: t.layout.screenPadding, gap: t.spacing.md, paddingBottom: t.spacing.huge },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm },
    fillBlock: { gap: t.spacing.sm },
    fillHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
  })
);
