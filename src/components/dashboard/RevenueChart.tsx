import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Line, Rect } from "react-native-svg";
import { AppCard, AppEmptyState, AppText, makeStyles, useTheme } from "@/design-system";
import { formatCurrency, formatCurrencyAxis } from "@/utils/number";

export interface RevenueChartProps {
  mode: "hourly" | "daily";
  points: { label: string; amount: number }[];
  periodLabel: string;
}

const CHART_HEIGHT = 140;
const Y_AXIS_WIDTH = 52;
const MAX_X_LABELS = 6;

/** Üst sınırı okunabilir bir değere yuvarlar (1, 2, 2.5, 5 × 10^n) */
function niceCeil(value: number): number {
  if (value <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(value)));
  const n = value / mag;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10;
  return step * mag;
}

/**
 * Ciro zaman serisi — yalnız backend `revenue_timeseries` verisinden çizilir.
 * Veri yoksa veya tüm değerler 0 ise boş durum gösterilir (sahte eğri çizilmez).
 */
export function RevenueChart({ mode, points, periodLabel }: RevenueChartProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [width, setWidth] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);

  const { max, total, peakIndex } = useMemo(() => {
    let peak = -1;
    let peakVal = 0;
    let sum = 0;
    points.forEach((p, i) => {
      sum += p.amount;
      if (p.amount > peakVal) {
        peakVal = p.amount;
        peak = i;
      }
    });
    return { max: niceCeil(peakVal), total: sum, peakIndex: peak };
  }, [points]);

  const hasData = points.length > 0 && peakIndex >= 0;
  const subtitle = `${periodLabel} · ${mode === "hourly" ? "saatlik" : "günlük"}`;

  if (!hasData) {
    return (
      <AppCard title="Ciro trendi" subtitle={subtitle} testID="revenue-chart">
        <AppEmptyState compact icon="bar-chart-2" title="Bu dönemde satış yok" description="Seçilen dönemde başarılı işlem bulunmuyor." />
      </AppCard>
    );
  }

  const plotWidth = Math.max(0, width - Y_AXIS_WIDTH);
  const slot = points.length > 0 ? plotWidth / points.length : 0;
  const barWidth = Math.max(2, Math.min(18, slot * 0.62));
  const labelEvery = Math.max(1, Math.ceil(points.length / MAX_X_LABELS));
  const active = selected ?? null;
  const activePoint = active != null ? points[active] : null;

  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  const a11ySummary = `Ciro trendi, ${subtitle}. Toplam ${formatCurrency(total)}. En yüksek ${points[peakIndex].label}: ${formatCurrency(points[peakIndex].amount)}.`;

  return (
    <AppCard title="Ciro trendi" subtitle={subtitle} testID="revenue-chart">
      <View style={styles.readout}>
        <AppText variant="caption" color="textSecondary">
          {activePoint ? activePoint.label : "Dönem toplamı"}
        </AppText>
        <AppText variant="metricMd" testID="revenue-chart-readout">
          {formatCurrency(activePoint ? activePoint.amount : total)}
        </AppText>
      </View>

      <View style={styles.chart} onLayout={onLayout} accessible accessibilityLabel={a11ySummary} accessibilityRole="image">
        {width > 0 ? (
          <>
            <Svg width={width} height={CHART_HEIGHT}>
              {[0, 0.5, 1].map((r) => {
                const y = Math.round(CHART_HEIGHT - r * (CHART_HEIGHT - 8)) - 0.5;
                return (
                  <Line
                    key={r}
                    x1={Y_AXIS_WIDTH}
                    x2={width}
                    y1={y}
                    y2={y}
                    stroke={colors.border}
                    strokeWidth={1}
                    strokeDasharray={r === 0 ? undefined : "3,4"}
                  />
                );
              })}
              {points.map((p, i) => {
                const h = max > 0 ? (p.amount / max) * (CHART_HEIGHT - 8) : 0;
                const x = Y_AXIS_WIDTH + i * slot + (slot - barWidth) / 2;
                const isActive = active === i;
                return (
                  <Rect
                    key={`${p.label}-${i}`}
                    x={x}
                    y={CHART_HEIGHT - Math.max(h, p.amount > 0 ? 2 : 0)}
                    width={barWidth}
                    height={Math.max(h, p.amount > 0 ? 2 : 0)}
                    rx={Math.min(3, barWidth / 2)}
                    fill={isActive || active == null ? colors.chart[0] : colors.primarySubtle}
                  />
                );
              })}
            </Svg>
            {/* Y ekseni etiketleri */}
            <View style={styles.yAxis} pointerEvents="none">
              <AppText variant="numericSm" color="textTertiary" style={styles.yLabelTop} numberOfLines={1}>
                {formatCurrencyAxis(max)}
              </AppText>
              <AppText variant="numericSm" color="textTertiary" style={styles.yLabelMid} numberOfLines={1}>
                {formatCurrencyAxis(max / 2)}
              </AppText>
            </View>
            {/* Dokunma alanları: çubuk seçimi */}
            <View style={[styles.touchRow, { left: Y_AXIS_WIDTH }]}>
              {points.map((p, i) => (
                <Pressable
                  key={`hit-${i}`}
                  style={styles.touchCol}
                  accessible={false}
                  onPress={() => setSelected((cur) => (cur === i ? null : i))}
                  testID={`revenue-bar-${i}`}
                />
              ))}
            </View>
          </>
        ) : null}
      </View>

      <View style={[styles.xAxis, { paddingLeft: Y_AXIS_WIDTH }]}>
        {points.map((p, i) => (
          <View key={`x-${i}`} style={styles.xCell}>
            {i % labelEvery === 0 ? (
              <AppText variant="caption" color="textTertiary" numberOfLines={1} style={styles.xLabel}>
                {p.label}
              </AppText>
            ) : null}
          </View>
        ))}
      </View>
    </AppCard>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    readout: { gap: 2, marginBottom: t.spacing.md },
    chart: { height: CHART_HEIGHT, width: "100%" },
    yAxis: { position: "absolute", left: 0, top: 0, bottom: 0, width: Y_AXIS_WIDTH - 6 },
    yLabelTop: { position: "absolute", top: 0, fontSize: 11 },
    yLabelMid: { position: "absolute", top: (CHART_HEIGHT - 8) / 2 - 2, fontSize: 11 },
    touchRow: { position: "absolute", top: 0, right: 0, bottom: 0, flexDirection: "row" },
    touchCol: { flex: 1 },
    xAxis: { flexDirection: "row", marginTop: t.spacing.xs },
    xCell: { flex: 1, overflow: "visible", alignItems: "flex-start" },
    xLabel: { fontSize: 10, width: 44 },
  })
);
