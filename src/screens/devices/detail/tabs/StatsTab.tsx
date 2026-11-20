/**
 * İstatistikler — web cihaz sayfası İstatistikler sekmesi gibi: zaman filtresi (hızlı seçim, özel tarih,
 * günlük saat penceresi) → Ciro / Toplam / Başarılı / Başarısız, Ödeme Tipine Göre, Başarısız Neden,
 * Ürün Bazında Satışlar (`GET pos-devices/{sn}/stats/`). Altta dönem karşılaştırması ve son ciro sayımı.
 * Yalnız gerçek veri; tahmini finansal değer gösterilmez.
 */
import React, { useState } from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { AppIcon, AppKpi, AppNotice, AppSkeleton, AppText, makeStyles, useTheme } from "@/design-system";
import { DashSection } from "@/components/dashboard/DashSection";
import { HERO_DIVIDER, HERO_MUTED, HeroSurface } from "@/components/dashboard/HeroSurface";
import { amountFontSize } from "@/utils/amountFontSize";
import { devicesApi } from "@/api/devices";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { FillBar } from "@/components/devices/DeviceUi";
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
        <AppSkeleton height={150} radius={20} />
      ) : stats.isError ? (
        <AppNotice tone="warning" message={`İstatistik alınamadı: ${errorMessage(stats.error)}`} />
      ) : st ? (
        <>
          {/* Özet: lacivert kart — ciro büyük, işlem sayısı, başarılı/başarısız ve başarı oranı çubuğu */}
          <HeroSurface testID="stats-kpis">
            <View style={styles.heroTop}>
              <View style={styles.flex} accessible accessibilityLabel={`Ciro: ${formatCurrency(tx?.revenue)}`}>
                <AppText variant="caption" weight="600" style={styles.heroMuted}>
                  Ciro
                </AppText>
                <AppText numberOfLines={1} style={[styles.heroValue, { fontSize: amountFontSize(tx?.revenue, 30) }]}>
                  {formatCurrency(tx?.revenue)}
                </AppText>
              </View>
              <View style={styles.heroCount} accessible accessibilityLabel={`Toplam İşlem: ${formatInteger(tx?.total)}`}>
                <AppText style={styles.heroCountValue}>{formatInteger(tx?.total)}</AppText>
                <AppText variant="caption" style={styles.heroMuted}>
                  işlem
                </AppText>
              </View>
            </View>
            <View style={styles.heroTrack}>
              {successRate != null ? <View style={[styles.heroFill, { width: `${successRate}%` }]} /> : null}
            </View>
            <View style={styles.heroStats}>
              <View style={styles.inline} accessible accessibilityLabel={`Başarılı: ${formatInteger(tx?.success)}`}>
                <View style={[styles.dot, { backgroundColor: "#4ADE80" }]} />
                <AppText variant="caption" weight="700" style={styles.white}>
                  {formatInteger(tx?.success)}
                </AppText>
                <AppText variant="caption" style={styles.heroMuted}>
                  başarılı
                </AppText>
              </View>
              <View style={styles.inline} accessible accessibilityLabel={`Başarısız: ${formatInteger(tx?.failed)}`}>
                <View style={[styles.dot, { backgroundColor: "#F87171" }]} />
                <AppText variant="caption" weight="700" style={styles.white}>
                  {formatInteger(tx?.failed)}
                </AppText>
                <AppText variant="caption" style={styles.heroMuted}>
                  başarısız
                </AppText>
              </View>
              <View style={styles.flex} />
              <AppText variant="caption" weight="600" style={styles.heroMuted}>
                Başarı oranı {formatPercent(successRate)}
              </AppText>
            </View>
          </HeroSurface>

          {st.payment_types.length ? (
            <DashSection title="Ödeme tipine göre" testID="stats-payment-types">
              <View style={styles.gap}>
                {st.payment_types.map((p) => {
                  const pct = ptTotal > 0 ? (p.revenue / ptTotal) * 100 : 0;
                  const c = webBadgeColors(ptBadge(p.pt_type).color, isDark);
                  return (
                    <View key={p.pt_type} style={styles.bdRow}>
                      <View style={styles.bdHead}>
                        <View style={[styles.dot, { backgroundColor: c.fg }]} />
                        <AppText variant="calloutStrong" style={styles.flex} numberOfLines={1}>
                          {p.label}
                        </AppText>
                        <AppText variant="numericSm" style={styles.money}>
                          {formatCurrency(p.revenue)}
                        </AppText>
                      </View>
                      <View style={[styles.track, { backgroundColor: colors.surfaceMuted }]}>
                        <View style={[styles.trackFill, { width: `${pct}%`, backgroundColor: c.fg }]} />
                      </View>
                      <AppText variant="caption" color="textTertiary">
                        {formatInteger(p.count)} işlem · {formatPercent(pct)}
                      </AppText>
                    </View>
                  );
                })}
              </View>
            </DashSection>
          ) : null}

          {st.failure_reasons.length ? (
            <DashSection title="Başarısızlık nedenleri" padded={false} testID="stats-failure-reasons">
              {st.failure_reasons.map((f, i) => (
                <View key={f.key} style={[styles.listRow, i > 0 && styles.listBorder]}>
                  <View style={[styles.reasonIcon, { backgroundColor: colors.dangerSubtle }]}>
                    <AppIcon name="x" size={14} color="danger" />
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="calloutStrong">{f.label}</AppText>
                    <AppText variant="caption" color="textTertiary">
                      {formatCurrency(f.amount)}
                    </AppText>
                  </View>
                  <AppText variant="numeric" style={styles.count}>
                    {formatInteger(f.count)}
                  </AppText>
                </View>
              ))}
            </DashSection>
          ) : null}

          {st.product_sales.length ? (
            <DashSection title="Ürün bazında satışlar" padded={false} testID="stats-product-sales">
              {st.product_sales.map((r, i) => (
                <View key={r.product_no} style={[styles.listRow, i > 0 && styles.listBorder]}>
                  <View style={[styles.rank, i < 3 && styles.rankTop]}>
                    <AppText variant="caption" weight="700" color={i < 3 ? "primary" : "textSecondary"}>
                      {i + 1}
                    </AppText>
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="calloutStrong" numberOfLines={1}>
                      {r.name || "—"}
                    </AppText>
                    <AppText variant="caption" color="textTertiary">
                      Ürün No {r.product_no}
                    </AppText>
                  </View>
                  <View style={styles.productRight}>
                    <AppText variant="numericSm" weight="700">
                      {formatCurrency(r.revenue)}
                    </AppText>
                    <AppText variant="caption" color="textTertiary">
                      {formatInteger(r.qty)} adet
                    </AppText>
                  </View>
                </View>
              ))}
            </DashSection>
          ) : null}
        </>
      ) : null}

      <AppText variant="cardTitle" accessibilityRole="header" style={styles.sectionTitle}>
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

      <DashSection
        testID="stats-count-breakdown"
        title="Ödeme türü kırılımı"
        subtitle={lastCount ? `Son ciro sayımı · ${formatDateTime(lastCount.datetime)}` : "Son ciro sayımına göre"}
      >
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
      </DashSection>
    </ScrollView>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    content: { padding: t.layout.screenPadding, gap: t.spacing.lg, paddingBottom: t.spacing.huge },
    row: { flexDirection: "row", gap: t.spacing.sm, flexWrap: "wrap", marginTop: -t.spacing.sm },
    gap: { gap: t.spacing.md },
    flex: { flex: 1, minWidth: 0 },
    inline: { flexDirection: "row", alignItems: "center", gap: 5 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    white: { color: "#FFFFFF" },
    heroMuted: { color: HERO_MUTED },
    heroTop: { flexDirection: "row", alignItems: "flex-end", gap: t.spacing.md },
    heroValue: { color: "#FFFFFF", fontWeight: "700", lineHeight: 38, letterSpacing: -0.5 },
    heroCount: { alignItems: "flex-end" },
    heroCountValue: { color: "#FFFFFF", fontWeight: "700", fontSize: 22, lineHeight: 28 },
    heroTrack: { height: 6, borderRadius: 3, backgroundColor: HERO_DIVIDER, overflow: "hidden" },
    heroFill: { height: 6, borderRadius: 3, backgroundColor: "#4ADE80" },
    heroStats: { flexDirection: "row", alignItems: "center", gap: t.spacing.md },
    sectionTitle: { paddingHorizontal: 2 },
    bdRow: { gap: 6 },
    bdHead: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    money: { fontWeight: "700", textAlign: "right" },
    count: { minWidth: 32, textAlign: "right", fontWeight: "700" },
    track: { height: 6, borderRadius: t.radius.pill, overflow: "hidden" },
    trackFill: { height: "100%", borderRadius: t.radius.pill },
    listRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.md, paddingHorizontal: t.layout.cardPadding, paddingVertical: t.spacing.md },
    listBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.border },
    reasonIcon: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
    rank: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", backgroundColor: t.colors.surfaceMuted },
    rankTop: { backgroundColor: t.colors.primarySubtle },
    productRight: { alignItems: "flex-end", gap: 2 },
  })
);
