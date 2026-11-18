import React from "react";
import { StyleSheet, View } from "react-native";
import { AppCard, AppEmptyState, AppText, makeStyles, useTheme } from "@/design-system";
import { formatCurrency, formatInteger, formatPercent } from "@/utils/number";
import type { DashboardSales, PaymentBreakdownItem } from "@/types/overview";

/* -------------------------------------------------------- Payment types */

/** Ödeme tipine göre ciro — yalnız başarılı işlemler (`overview.py:151-153`) */
export function PaymentBreakdownCard({ items }: { items: PaymentBreakdownItem[] }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const total = items.reduce((acc, p) => acc + p.amount, 0);

  return (
    <AppCard title="Ödeme tipleri" subtitle="Başarılı işlemler" testID="payment-breakdown">
      {items.length === 0 || total <= 0 ? (
        <AppEmptyState compact icon="credit-card" title="Bu dönemde ödeme yok" />
      ) : (
        <View style={styles.list}>
          {/* Yığılmış dağılım çubuğu */}
          <View style={styles.stack} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {items.map((p, i) =>
              p.amount > 0 ? (
                <View
                  key={`seg-${p.pt_type}`}
                  style={{ flex: p.amount, backgroundColor: colors.chart[i % colors.chart.length] }}
                />
              ) : null
            )}
          </View>
          {items.map((p, i) => {
            const share = (p.amount / total) * 100;
            return (
              <View
                key={`pt-${p.pt_type}-${i}`}
                style={styles.row}
                accessible
                accessibilityLabel={`${p.label}: ${formatCurrency(p.amount)}, ${formatInteger(p.count)} işlem, ${formatPercent(share)}`}
              >
                <View style={[styles.swatch, { backgroundColor: colors.chart[i % colors.chart.length] }]} />
                <View style={styles.flex}>
                  <AppText variant="callout" numberOfLines={1}>
                    {p.label}
                  </AppText>
                  <AppText variant="caption" color="textTertiary">
                    {formatInteger(p.count)} işlem · {formatPercent(share)}
                  </AppText>
                </View>
                <AppText variant="numeric">{formatCurrency(p.amount)}</AppText>
              </View>
            );
          })}
        </View>
      )}
    </AppCard>
  );
}

/* ------------------------------------------------------ Failure reasons */

const REASONS: { key: keyof DashboardSales["failures"]; label: string }[] = [
  { key: "timeout", label: "Zaman aşımı" },
  { key: "bank", label: "Banka reddi" },
  { key: "technical", label: "Teknik hata" },
  { key: "other", label: "Diğer" },
];

/** Başarısız işlemlerin nedenleri (`iptalNo` 1/2/3/diğer, `overview.py:81-84`) */
export function FailureReasonsCard({ failures, failed }: { failures: DashboardSales["failures"]; failed: number }) {
  const styles = useStyles();
  const max = Math.max(1, ...REASONS.map((r) => failures[r.key] ?? 0));
  return (
    <AppCard title="Başarısızlık nedenleri" subtitle={`${formatInteger(failed)} başarısız işlem`} testID="failure-reasons">
      <View style={styles.list}>
        {REASONS.map((r) => {
          const v = failures[r.key];
          return (
            <View key={r.key} style={styles.reasonRow} accessible accessibilityLabel={`${r.label}: ${formatInteger(v)}`}>
              <AppText variant="callout" style={styles.reasonLabel} numberOfLines={1}>
                {r.label}
              </AppText>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${((v ?? 0) / max) * 100}%` }]} />
              </View>
              <AppText variant="numeric" style={styles.reasonValue}>
                {formatInteger(v)}
              </AppText>
            </View>
          );
        })}
      </View>
    </AppCard>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    list: { gap: t.spacing.md },
    stack: {
      flexDirection: "row",
      height: 8,
      borderRadius: t.radius.pill,
      overflow: "hidden",
      gap: 2,
      backgroundColor: t.colors.surfaceMuted,
    },
    row: { flexDirection: "row", alignItems: "center", gap: t.spacing.md },
    swatch: { width: 10, height: 10, borderRadius: 3 },
    reasonRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.md },
    reasonLabel: { width: 96 },
    reasonValue: { minWidth: 40, textAlign: "right" },
    track: { flex: 1, height: 6, borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceMuted, overflow: "hidden" },
    fill: { height: "100%", borderRadius: t.radius.pill, backgroundColor: t.colors.danger },
  })
);
