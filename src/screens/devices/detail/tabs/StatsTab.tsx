/**
 * İstatistikler — web cihaz sayfası İstatistikler sekmesi gibi: zaman filtresi (hızlı seçim, özel tarih,
 * günlük saat penceresi) → Ciro / Toplam / Başarılı / Başarısız, Ödeme Tipine Göre, Başarısız Neden,
 * Ürün Bazında Satışlar (`GET pos-devices/{sn}/stats/`). Altta dönem karşılaştırması ve son ciro sayımı.
 * Yalnız gerçek veri; tahmini finansal değer gösterilmez.
 */
import React, { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AppCard, AppKpi, AppNotice, AppSkeleton, AppText, makeStyles, useTheme } from "@/design-system";
import { devicesApi } from "@/api/devices";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { FillBar, MetricCell } from "@/components/devices/DeviceUi";
import { ptBadge, ptTypeLabel } from "@/components/devices/deviceHelpers";
import { formatCurrency, formatInteger, formatPercent, percentChange } from "@/utils/number";
import { formatDateTime } from "@/utils/date";
import { useDeviceSummary, useRevenueCounts } from "../useDeviceQueries";
import { defaultStatsFilter, resolveStatsRange, StatsPeriodFilter, type StatsFilter } from "../components/StatsPeriodFilter";
import { useBusinessDay } from "../useBusinessDay";
import { webBadgeColors } from "@/components/devices/webBadgeColors";
import type { DeviceStatsParams } from "@/types/devices";

export function StatsTab({ sn, refreshing, onRefresh }: { sn: string; refreshing: boolean; onRefresh: () => void }) {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const summary = useDeviceSummary(sn, true);
  const counts = useRevenueCounts(sn, true);
  const [filter, setFilter] = useState<StatsFilter>(() => defaultStatsFilter());
  // Hızlı seçim aralığı her çizimde bugünden yeniden hesaplanır (gece yarısı sonrası "Bugün" donmaz)
  useBusinessDay();
  const range = resolveStatsRange(filter);
  const params: DeviceStatsParams = {
    start_date: range.start,
    end_date: range.end,
    ...(filter.startTime ? { start_time: filter.startTime } : {}),
    ...(filter.endTime ? { end_time: filter.endTime } : {}),
  };
  const stats = useQuery({
    queryKey: queryKeys.devices.stats(sn, { ...params }),
    queryFn: ({ signal }) => devicesApi.stats(sn, params, signal),
    placeholderData: (prev) => prev,
  });

  const s = summary.data;
  const st = stats.data;
  const tx = st?.summary ?? null;
  const successRate = tx && tx.total ? (tx.success / tx.total) * 100 : null;
  const ptTotal = st ? st.payment_types.reduce((a, p) => a + p.revenue, 0) : 0;
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
      <StatsPeriodFilter value={filter} onChange={setFilter} />

      {stats.isLoading ? (
        <AppSkeleton height={120} radius={12} />
      ) : stats.isError ? (
        <AppNotice tone="warning" message={`İstatistik alınamadı: ${errorMessage(stats.error)}`} />
      ) : st ? (
        <>
          <AppCard testID="stats-kpis">
            <View style={styles.gap}>
              <View style={styles.grid}>
                <MetricCell label="Ciro" value={formatCurrency(tx?.revenue)} />
                <MetricCell label="Toplam İşlem" value={formatInteger(tx?.total)} />
                <MetricCell label="Başarılı" value={formatInteger(tx?.success)} />
                <MetricCell label="Başarısız" value={formatInteger(tx?.failed)} />
              </View>
              <FillBar
                pct={successRate}
                tone={successRate == null ? "neutral" : successRate >= 90 ? "success" : successRate >= 70 ? "warning" : "danger"}
                height={6}
                accessibilityLabel={`Başarı oranı ${formatPercent(successRate)}`}
              />
              <AppText variant="caption" color="textTertiary">
                Başarı oranı {formatPercent(successRate)}
              </AppText>
            </View>
          </AppCard>

          {st.payment_types.length ? (
            <AppCard title="Ödeme Tipine Göre" testID="stats-payment-types">
              <View style={styles.gap}>
                {st.payment_types.map((p) => {
                  const pct = ptTotal > 0 ? (p.revenue / ptTotal) * 100 : 0;
                  const c = webBadgeColors(ptBadge(p.pt_type).color, isDark);
                  return (
                    <View key={p.pt_type} style={styles.bdRow}>
                      <View style={styles.bdHead}>
                        <AppText variant="callout" style={styles.flex} numberOfLines={1}>
                          {p.label}
                        </AppText>
                        <AppText variant="caption" color="textTertiary">
                          {formatInteger(p.count)} işlem · {formatPercent(pct)}
                        </AppText>
                        <AppText variant="numericSm" style={styles.money}>
                          {formatCurrency(p.revenue)}
                        </AppText>
                      </View>
                      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
                        <View style={[styles.trackFill, { width: `${pct}%`, backgroundColor: c.fg }]} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </AppCard>
          ) : null}

          {st.failure_reasons.length ? (
            <AppCard title="Başarısız Neden" testID="stats-failure-reasons">
              <View style={styles.gap}>
                {st.failure_reasons.map((f) => (
                  <View key={f.key} style={styles.bdHead}>
                    <AppText variant="callout" style={styles.flex}>
                      {f.label}
                    </AppText>
                    <AppText variant="numericSm" color="textSecondary">
                      {formatCurrency(f.amount)}
                    </AppText>
                    <AppText variant="numeric" style={styles.count}>
                      {formatInteger(f.count)}
                    </AppText>
                  </View>
                ))}
              </View>
            </AppCard>
          ) : null}

          {st.product_sales.length ? (
            <AppCard title="Ürün Bazında Satışlar" padded={false} testID="stats-product-sales">
              {st.product_sales.map((r, i) => (
                <View key={r.product_no} style={[styles.productRow, i > 0 && styles.productBorder]}>
                  <View style={styles.flex}>
                    <AppText variant="callout" numberOfLines={1}>
                      {r.name || "—"}
                    </AppText>
                    <AppText variant="caption" color="textTertiary">
                      Ürün No {r.product_no}
                    </AppText>
                  </View>
                  <View style={styles.productRight}>
                    <AppText variant="numericSm">{formatCurrency(r.revenue)}</AppText>
                    <AppText variant="caption" color="textTertiary">
                      {formatInteger(r.qty)} adet
                    </AppText>
                  </View>
                </View>
              ))}
            </AppCard>
          ) : null}
        </>
      ) : null}

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

      <AppCard testID="stats-count-breakdown" title="Ödeme türü kırılımı" subtitle={lastCount ? `Son ciro sayımı · ${formatDateTime(lastCount.datetime)}` : "Son ciro sayımına göre"}>
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
    bdHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline", gap: t.spacing.sm },
    flex: { flex: 1, minWidth: 0 },
    money: { minWidth: 84, textAlign: "right" },
    count: { minWidth: 40, textAlign: "right" },
    track: { height: 6, borderRadius: t.radius.pill, overflow: "hidden" },
    trackFill: { height: "100%", borderRadius: t.radius.pill },
    productRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.md, paddingHorizontal: t.layout.cardPadding, paddingVertical: t.spacing.sm },
    productBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.border },
    productRight: { alignItems: "flex-end", gap: 2 },
  })
);
