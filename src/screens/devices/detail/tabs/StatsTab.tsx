/**
 * İstatistikler — YALNIZ gerçek veri: cihaz `summary` (4 dönem), bugünkü işlem `summary`'si ve
 * son ciro sayımının ödeme türü kırılımı. Tahmini/türetilmiş finansal değer gösterilmez.
 */
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AppCard, AppKpi, AppNotice, AppSkeleton, AppText, makeStyles, useTheme } from "@/design-system";
import { devicesApi } from "@/api/devices";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { FillBar, MetricCell } from "@/components/devices/DeviceUi";
import { ptTypeLabel } from "@/components/devices/deviceHelpers";
import { formatCurrency, formatInteger, formatPercent, percentChange } from "@/utils/number";
import { businessToday, formatDateTime, toApiDate } from "@/utils/date";
import { useDeviceSummary, useRevenueCounts } from "../useDeviceQueries";

export function StatsTab({ sn, refreshing, onRefresh }: { sn: string; refreshing: boolean; onRefresh: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const summary = useDeviceSummary(sn, true);
  const counts = useRevenueCounts(sn, true);
  const today = toApiDate(businessToday());
  const todayTx = useQuery({
    queryKey: [...queryKeys.devices.all, "tx-summary", sn, today] as const,
    queryFn: ({ signal }) => devicesApi.transactions(sn, { start_date: today, end_date: today }, signal),
  });

  const s = summary.data;
  const tx = todayTx.data?.summary ?? null;
  const successRate = tx && tx.total ? ((tx.success ?? 0) / tx.total) * 100 : null;
  const lastCount = counts.data?.results[0] ?? null;
  const breakdown = lastCount
    ? Object.entries(lastCount.by_pt_type)
        .filter(([, v]) => v > 0)
        .sort((a, b) => b[1] - a[1])
    : [];
  const breakdownMax = breakdown.reduce((m, [, v]) => Math.max(m, v), 0);

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      testID="tab-stats"
    >
      <AppText variant="overline" color="textTertiary">
        Dönem karşılaştırması
      </AppText>
      {summary.isLoading ? (
        <View style={styles.row}>
          <AppSkeleton height={92} width="48%" radius={12} />
          <AppSkeleton height={92} width="48%" radius={12} />
        </View>
      ) : summary.isError ? (
        <AppNotice tone="warning" message={`Özet alınamadı: ${errorMessage(summary.error)}`} />
      ) : s ? (
        <View style={styles.row}>
          <AppKpi
            label="Bugün"
            value={formatCurrency(s.today.revenue)}
            delta={percentChange(s.today.revenue, s.yesterday.revenue)}
            caption={`Dün ${formatCurrency(s.yesterday.revenue)}`}
            testID="stats-today"
          />
          <AppKpi
            label="Bu ay"
            value={formatCurrency(s.this_month.revenue)}
            delta={percentChange(s.this_month.revenue, s.last_month.revenue)}
            caption={`Geçen ay ${formatCurrency(s.last_month.revenue)}`}
            testID="stats-month"
          />
        </View>
      ) : null}
      {s ? (
        <AppText variant="caption" color="textTertiary">
          Bugün ve bu ay devam eden dönemlerdir; değişim, tamamlanmış önceki dönemin tamamına göredir.
        </AppText>
      ) : null}

      <AppCard title="Bugünkü işlemler">
        {todayTx.isLoading ? (
          <AppSkeleton height={58} />
        ) : todayTx.isError ? (
          <AppNotice tone="warning" message={errorMessage(todayTx.error)} />
        ) : (
          <View style={styles.gap}>
            <View style={styles.grid}>
              <MetricCell label="Toplam" value={formatInteger(tx?.total)} />
              <MetricCell label="Başarılı" value={formatInteger(tx?.success)} />
              <MetricCell label="Başarısız" value={formatInteger(tx?.failed)} />
              <MetricCell label="Başarı oranı" value={formatPercent(successRate)} />
            </View>
            <FillBar pct={successRate} tone={successRate == null ? "neutral" : successRate >= 90 ? "success" : successRate >= 70 ? "warning" : "danger"} height={6} accessibilityLabel={`Başarı oranı ${formatPercent(successRate)}`} />
          </View>
        )}
      </AppCard>

      <AppCard title="Ödeme türü kırılımı" subtitle={lastCount ? `Son ciro sayımı · ${formatDateTime(lastCount.datetime)}` : "Son ciro sayımına göre"}>
        {counts.isLoading ? (
          <AppSkeleton height={80} />
        ) : counts.isError ? (
          <AppNotice tone="warning" message={errorMessage(counts.error)} />
        ) : !lastCount ? (
          <AppText variant="callout" color="textSecondary">
            Henüz ciro sayımı yapılmamış; kırılım gösterilemiyor.
          </AppText>
        ) : breakdown.length === 0 ? (
          <AppText variant="callout" color="textSecondary">
            Son sayımda ciro yok.
          </AppText>
        ) : (
          <View style={styles.gap}>
            {breakdown.map(([pt, amount]) => (
              <View key={pt} style={styles.bdRow}>
                <View style={styles.bdHead}>
                  <AppText variant="callout">{ptTypeLabel(pt)}</AppText>
                  <AppText variant="numericSm">{formatCurrency(amount)}</AppText>
                </View>
                <FillBar pct={breakdownMax > 0 ? (amount / breakdownMax) * 100 : null} tone="info" height={6} />
              </View>
            ))}
            <View style={styles.bdHead}>
              <AppText variant="calloutStrong">Toplam</AppText>
              <AppText variant="numeric">{formatCurrency(lastCount.total_revenue)}</AppText>
            </View>
          </View>
        )}
      </AppCard>
    </ScrollView>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    content: { padding: t.layout.screenPadding, gap: t.spacing.md, paddingBottom: t.spacing.huge },
    row: { flexDirection: "row", gap: t.spacing.sm, flexWrap: "wrap" },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm },
    gap: { gap: t.spacing.md },
    bdRow: { gap: 4 },
    bdHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  })
);
