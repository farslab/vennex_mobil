import React from "react";
import { StyleSheet, View } from "react-native";
import { AppKpi, makeStyles } from "@/design-system";
import { formatCurrency, formatCurrencyCompact, formatInteger, formatPercent } from "@/utils/number";
import type { DashboardData } from "@/types/overview";

export interface KpiGridProps {
  data: DashboardData;
  /** false → hiçbir tutar/işlem sayısı gösterilmez (yetki yok veya backend gizledi) */
  salesAllowed: boolean;
  onDevicesPress: () => void;
}

/** 2 sütunlu kompakt KPI ızgarası (375pt'de 2×2) */
export function KpiGrid({ data, salesAllowed, onDevicesPress }: KpiGridProps) {
  const styles = useStyles();
  const { devices } = data;
  const sales = salesAllowed ? data.sales : null;

  const deviceCaption =
    devices.online != null && devices.offline != null
      ? `${formatInteger(devices.online)} çevrimiçi · ${formatInteger(devices.offline)} çevrimdışı`
      : undefined;

  const tx = sales?.transactions;
  const failRate = tx?.total && tx.failed != null ? (tx.failed / tx.total) * 100 : null;

  const revenueCaption =
    sales && sales.previousRevenue != null
      ? `${sales.comparisonLabel ?? "Önceki dönem"}: ${formatCurrencyCompact(sales.previousRevenue)}`
      : sales?.comparisonLabel ?? undefined;

  return (
    <View style={styles.grid} testID="kpi-grid">
      <AppKpi
        testID="kpi-devices"
        icon="monitor"
        label="POS cihazları"
        value={formatInteger(devices.total)}
        caption={deviceCaption}
        onPress={onDevicesPress}
      />
      {sales ? (
        <>
          <AppKpi
            testID="kpi-revenue"
            icon="trending-up"
            label="Ciro"
            value={formatCurrency(sales.revenue)}
            // Yalnız backend önceki döneme göre değişim hesapladıysa (önceki ciro > 0)
            delta={sales.changePct}
            caption={revenueCaption}
          />
          <AppKpi
            testID="kpi-transactions"
            icon="activity"
            label="İşlem"
            value={formatInteger(tx?.total)}
            caption={tx?.success != null ? `${formatInteger(tx.success)} başarılı` : undefined}
          />
          <AppKpi
            testID="kpi-failed"
            icon="alert-circle"
            label="Başarısız işlem"
            value={formatInteger(tx?.failed)}
            caption={failRate != null ? `Başarısızlık oranı ${formatPercent(failRate)}` : undefined}
          />
        </>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    grid: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm },
  })
);
