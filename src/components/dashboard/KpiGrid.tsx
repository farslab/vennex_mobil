/**
 * Genel bakış özeti — kurumsal düzen:
 *  1. Ciro kartı (koyu lacivert → marka mavisi): toplam ciro, önceki döneme göre değişim, karşılaştırma
 *     ve altında işlem / başarılı / başarısız sayıları (web overview KPI'larıyla aynı veriler ve adlar).
 *  2. POS cihaz durumu: toplam, çevrimiçi/çevrimdışı oranı (yeşil/kırmızı çubuk); dokununca cihaz listesi.
 * Satış yetkisi yoksa yalnız cihaz durumu gösterilir.
 */
import React, { useState } from "react";
import { Pressable, StyleSheet, View, type LayoutChangeEvent } from "react-native";
import Svg, { Circle, Rect } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { AppIcon, AppText, makeStyles, useTheme } from "@/design-system";
import { formatCurrency, formatInteger } from "@/utils/number";
import type { DashboardData } from "@/types/overview";
import { DashSurface } from "./DashSection";

export interface KpiGridProps {
  data: DashboardData;
  /** false → hiçbir tutar/işlem sayısı gösterilmez (yetki yok veya backend gizledi) */
  salesAllowed: boolean;
  onDevicesPress: () => void;
}

const HERO_LIGHT = ["#0B2E55", "#17589C"] as const;
const HERO_DARK = ["#0C1E36", "#173A63"] as const;

export function KpiGrid({ data, salesAllowed, onDevicesPress }: KpiGridProps) {
  const styles = useStyles();
  const sales = salesAllowed ? data.sales : null;
  return (
    <View style={styles.stack} testID="kpi-grid">
      {sales ? <RevenueHero sales={sales} periodLabel={data.periodLabel} /> : null}
      <DeviceStatusCard devices={data.devices} onPress={onDevicesPress} />
    </View>
  );
}

function RevenueHero({
  sales,
  periodLabel,
}: {
  sales: NonNullable<DashboardData["sales"]>;
  periodLabel?: string | null;
}) {
  const styles = useStyles();
  const { isDark } = useTheme();
  // Grafikte seçili çubuk; kartın başka bir yerine dokununca kalkar
  const [selected, setSelected] = useState<number | null>(null);
  // Dönem/veri değişince seçim sıfırlanır (render sırasında ayarlama — ek efekt yok)
  const signature = sales.timeseries.points.map((p) => p.label).join("|");
  const [seenSignature, setSeenSignature] = useState(signature);
  if (signature !== seenSignature) {
    setSeenSignature(signature);
    setSelected(null);
  }
  const tx = sales.transactions;
  const failRate = tx?.total && tx.failed != null ? (tx.failed / tx.total) * 100 : null;
  const delta = sales.changePct;
  const up = delta != null && delta > 0;
  const down = delta != null && delta < 0;
  const comparison =
    sales.previousRevenue != null
      ? `${sales.comparisonLabel ?? "Önceki dönem"}: ${formatCurrency(sales.previousRevenue)}`
      : (sales.comparisonLabel ?? null);

  return (
    <Pressable
      onPress={() => setSelected(null)}
      disabled={selected == null}
      accessible={false}
      testID="revenue-hero"
    >
      <LinearGradient
        colors={isDark ? HERO_DARK : HERO_LIGHT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.hero}
      >
        {/* Derinlik için yumuşak dekor halkaları */}
        <View pointerEvents="none" style={[styles.ring, styles.ringA]} />
        <View pointerEvents="none" style={[styles.ring, styles.ringB]} />

        <View
          testID="kpi-revenue"
          accessible
          accessibilityLabel={`Toplam Ciro: ${formatCurrency(sales.revenue)}${comparison ? `, ${comparison}` : ""}`}
        >
          <View style={styles.heroTop}>
            <AppText variant="caption" weight="600" style={styles.heroLabel}>
              Toplam Ciro
            </AppText>
          </View>
          <AppText style={styles.heroValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.6}>
            {formatCurrency(sales.revenue)}
          </AppText>
          <View style={styles.heroMeta}>
            {delta != null ? (
              <View
                style={[styles.deltaPill, up ? styles.deltaUp : down ? styles.deltaDown : styles.deltaFlat]}
              >
                <AppText variant="caption" weight="700" style={styles.deltaText}>
                  {up ? "▲" : down ? "▼" : "•"} %
                  {Math.abs(delta).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
                </AppText>
              </View>
            ) : null}
            {comparison ? (
              <AppText variant="caption" style={styles.heroMuted} numberOfLines={1}>
                {comparison}
              </AppText>
            ) : null}
          </View>
        </View>

        <HeroBars
          points={sales.timeseries.points}
          mode={sales.timeseries.mode}
          periodLabel={periodLabel}
          selected={selected}
          setSelected={setSelected}
        />

        <View style={styles.heroDivider} />

        <View style={styles.heroStats}>
          <HeroStat testID="kpi-transactions" label="Toplam İşlem" value={formatInteger(tx?.total)} />
          <View style={styles.statDivider} />
          <HeroStat label="Başarılı" value={formatInteger(tx?.success)} dot="#4ADE80" />
          <View style={styles.statDivider} />
          <HeroStat
            testID="kpi-failed"
            label="Başarısız"
            value={formatInteger(tx?.failed)}
            dot="#F87171"
            hint={
              failRate != null
                ? `%${failRate.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`
                : undefined
            }
          />
        </View>
      </LinearGradient>
    </Pressable>
  );
}

const BARS_HEIGHT = 64;

/** Ciro kartı içindeki satış grafiği: beyaz çubuklar, sade eksen (ilk / orta / son etiket) */
function HeroBars({
  points,
  mode,
  periodLabel,
  selected,
  setSelected,
}: {
  points: { label: string; amount: number }[];
  mode: string;
  periodLabel?: string | null;
  selected: number | null;
  setSelected: React.Dispatch<React.SetStateAction<number | null>>;
}) {
  const styles = useStyles();
  const [width, setWidth] = useState(0);
  const peak = Math.max(0, ...points.map((p) => p.amount));
  if (points.length === 0 || peak <= 0) {
    return (
      <AppText variant="caption" style={styles.heroMuted} testID="revenue-chart-empty">
        Bu dönemde satış yok
      </AppText>
    );
  }
  const slot = width > 0 ? width / points.length : 0;
  const barW = Math.max(2, Math.min(14, slot * 0.6));
  // Az çubukta (ör. haftalık) her etiket, çokta ilk / orta / son
  const labelIdx =
    points.length <= 7
      ? points.map((_, i) => i)
      : Array.from(new Set([0, Math.floor((points.length - 1) / 2), points.length - 1]));
  const active = selected != null && selected < points.length ? selected : null;
  const total = points.reduce((a, p) => a + p.amount, 0);
  const onLayout = (e: LayoutChangeEvent) => setWidth(Math.round(e.nativeEvent.layout.width));

  return (
    <View
      testID="revenue-chart"
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Satış grafiği, ${periodLabel ?? ""} ${mode === "hourly" ? "saatlik" : "günlük"}. Toplam ${formatCurrency(total)}.`}
    >
      <View style={styles.readout} testID="revenue-chart-readout">
        {active != null ? (
          <>
            <AppText variant="caption" weight="600" style={styles.heroMuted}>
              {points[active].label}
            </AppText>
            <AppText variant="callout" weight="700" style={styles.readoutValue}>
              {formatCurrency(points[active].amount)}
            </AppText>
          </>
        ) : null}
      </View>
      <View style={styles.bars} onLayout={onLayout}>
        {width > 0 ? (
          <Svg width={width} height={BARS_HEIGHT}>
            {points.map((p, i) => {
              const h = (p.amount / peak) * (BARS_HEIGHT - 4);
              const x = i * slot + (slot - barW) / 2;
              return (
                <Rect
                  key={`${p.label}-${i}`}
                  x={x}
                  y={p.amount > 0 ? BARS_HEIGHT - Math.max(h, 3) : BARS_HEIGHT - 2}
                  width={barW}
                  height={p.amount > 0 ? Math.max(h, 3) : 2}
                  rx={Math.min(3, barW / 2)}
                  fill="#FFFFFF"
                  fillOpacity={p.amount <= 0 ? 0.18 : active == null || active === i ? 0.95 : 0.35}
                />
              );
            })}
          </Svg>
        ) : null}
        {/* Dokunma alanları: çubuk seçimi */}
        <View style={styles.touchRow}>
          {points.map((p, i) => (
            <Pressable
              key={`hit-${i}`}
              style={styles.touchCol}
              onPress={() => setSelected((cur) => (cur === i ? null : i))}
              accessibilityRole="button"
              accessibilityLabel={`${p.label}: ${formatCurrency(p.amount)}`}
              testID={`revenue-bar-${i}`}
            />
          ))}
        </View>
      </View>
      {points.length <= 7 ? (
        <View style={styles.barLabels}>
          {points.map((p, i) => (
            <AppText
              key={i}
              variant="caption"
              style={[styles.barLabel, styles.center, active === i && styles.barLabelActive]}
              numberOfLines={1}
            >
              {p.label}
            </AppText>
          ))}
        </View>
      ) : (
        <View style={styles.barLabels}>
          {labelIdx.map((i, k) => (
            <AppText
              key={i}
              variant="caption"
              style={[
                styles.barLabel,
                k === 0 ? styles.left : k === labelIdx.length - 1 ? styles.right : styles.center,
              ]}
              numberOfLines={1}
            >
              {points[i].label}
            </AppText>
          ))}
        </View>
      )}
    </View>
  );
}

function HeroStat({
  label,
  value,
  dot,
  hint,
  testID,
}: {
  label: string;
  value: string;
  dot?: string;
  hint?: string;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <View
      style={styles.stat}
      testID={testID}
      accessible
      accessibilityLabel={`${label}: ${value}${hint ? `, oran ${hint}` : ""}`}
    >
      <View style={styles.statLabelRow}>
        {dot ? <View style={[styles.dot, { backgroundColor: dot }]} /> : null}
        <AppText variant="caption" style={styles.heroMuted} numberOfLines={1}>
          {label}
        </AppText>
      </View>
      <View style={styles.statValueRow}>
        <AppText style={styles.statValue} numberOfLines={1}>
          {value}
        </AppText>
        {hint ? (
          <AppText variant="caption" style={styles.heroMuted}>
            {hint}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

function DeviceStatusCard({ devices, onPress }: { devices: DashboardData["devices"]; onPress: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const total = devices.total ?? 0;
  const online = devices.online ?? 0;
  const offline = devices.offline ?? 0;
  const known = devices.online != null && devices.offline != null && online + offline > 0;
  const share = known ? online / (online + offline) : 0;

  return (
    <Pressable
      testID="kpi-devices"
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`POS Cihazları: ${formatInteger(total)}${known ? `, ${online} çevrimiçi, ${offline} çevrimdışı` : ""}`}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <DashSurface style={styles.deviceCard}>
        <OnlineRing share={share} known={known} color={colors.success} offColor={colors.danger} track={colors.surfaceMuted} />
        <View style={styles.flex}>
          <View style={styles.deviceHead}>
            <AppText variant="calloutStrong" style={styles.flex}>
              POS Cihazları
            </AppText>
            <AppIcon name="chevron-right" size={18} color="textTertiary" />
          </View>
          <View style={styles.deviceTotalRow}>
            <AppText style={styles.deviceValue}>{formatInteger(devices.total)}</AppText>
            <AppText variant="caption" color="textTertiary">
              cihaz
            </AppText>
          </View>
          {known ? (
            <View style={styles.legend} testID="kpi-devices-caption">
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: colors.success }]} />
                <AppText variant="caption" color="success" weight="700">
                  {`${formatInteger(online)} çevrimiçi`}
                </AppText>
              </View>
              <View style={styles.legendItem}>
                <View style={[styles.dot, { backgroundColor: colors.danger }]} />
                <AppText variant="caption" color="danger" weight="700">
                  {`${formatInteger(offline)} çevrimdışı`}
                </AppText>
              </View>
            </View>
          ) : null}
        </View>
      </DashSurface>
    </Pressable>
  );
}

const RING = 68;
const RING_STROKE = 7;

/** Çevrimiçi oranı halkası: yeşil = çevrimiçi, soluk kırmızı = çevrimdışı; ortada yüzde */
function OnlineRing({
  share,
  known,
  color,
  offColor,
  track,
}: {
  share: number;
  known: boolean;
  color: string;
  offColor: string;
  track: string;
}) {
  const styles = useStyles();
  const r = (RING - RING_STROKE) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={styles.ring68} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      <Svg width={RING} height={RING}>
        <Circle cx={RING / 2} cy={RING / 2} r={r} stroke={track} strokeWidth={RING_STROKE} fill="none" />
        {known && share < 1 ? (
          // Çevrimdışı dilimi (kırmızı), çevrimiçi diliminin bittiği yerden
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke={offColor}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeDasharray={`${c * (1 - share)} ${c}`}
            transform={`rotate(${-90 + 360 * share} ${RING / 2} ${RING / 2})`}
          />
        ) : null}
        {known && share > 0 ? (
          <Circle
            cx={RING / 2}
            cy={RING / 2}
            r={r}
            stroke={color}
            strokeWidth={RING_STROKE}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${c * share} ${c}`}
            transform={`rotate(-90 ${RING / 2} ${RING / 2})`}
          />
        ) : null}
      </Svg>
      <View style={styles.ringCenter}>
        <AppText variant="calloutStrong">{known ? `%${Math.round(share * 100)}` : "—"}</AppText>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    stack: { gap: t.spacing.md },
    flex: { flex: 1 },
    hero: {
      borderRadius: 20,
      padding: t.spacing.lg,
      overflow: "hidden",
      gap: t.spacing.md,
      shadowColor: "#0B2E55",
      shadowOpacity: 0.25,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    ring: { position: "absolute", borderRadius: 999, borderWidth: 28, borderColor: "rgba(255,255,255,0.05)" },
    ringA: { width: 220, height: 220, top: -90, right: -70 },
    ringB: { width: 140, height: 140, bottom: -70, right: 60 },
    heroTop: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: t.spacing.sm,
    },
    heroLabel: { color: "rgba(255,255,255,0.78)", letterSpacing: 0.4 },
    heroValue: {
      color: "#FFFFFF",
      fontSize: 34,
      lineHeight: 42,
      fontWeight: "700",
      letterSpacing: -0.5,
      marginTop: 4,
    },
    heroMeta: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, flexWrap: "wrap" },
    heroMuted: { color: "rgba(255,255,255,0.72)" },
    deltaPill: { paddingHorizontal: 9, paddingVertical: 3, borderRadius: 999 },
    // Lacivert zeminde net okunsun: dolu yeşil / kırmızı, beyaz yazı
    deltaUp: { backgroundColor: "#16A34A" },
    deltaDown: { backgroundColor: "#DC2626" },
    deltaFlat: { backgroundColor: "rgba(255,255,255,0.18)" },
    deltaText: { color: "#FFFFFF" },
    heroDivider: { height: StyleSheet.hairlineWidth, backgroundColor: "rgba(255,255,255,0.22)" },
    heroStats: { flexDirection: "row", alignItems: "stretch" },
    stat: { flex: 1, gap: 2 },
    statDivider: {
      width: StyleSheet.hairlineWidth,
      backgroundColor: "rgba(255,255,255,0.22)",
      marginHorizontal: t.spacing.md,
    },
    statLabelRow: { flexDirection: "row", alignItems: "center", gap: 5 },
    statValueRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
    statValue: { color: "#FFFFFF", fontSize: 20, lineHeight: 26, fontWeight: "700" },
    dot: { width: 7, height: 7, borderRadius: 4 },
    deviceCard: { flexDirection: "row", alignItems: "center", gap: t.spacing.lg },
    deviceHead: { flexDirection: "row", alignItems: "center" },
    deviceTotalRow: { flexDirection: "row", alignItems: "baseline", gap: 6 },
    ring68: { width: RING, height: RING },
    ringCenter: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, alignItems: "center", justifyContent: "center" },
    pressed: { opacity: 0.85 },
    bars: { height: BARS_HEIGHT, width: "100%" },
    touchRow: { position: "absolute", top: -8, bottom: -4, left: 0, right: 0, flexDirection: "row" },
    touchCol: { flex: 1 },
    readout: { flexDirection: "row", alignItems: "baseline", gap: 8, minHeight: 20, marginBottom: 2 },
    readoutValue: { color: "#FFFFFF" },
    barLabelActive: { color: "#FFFFFF", fontWeight: "700" },
    barLabels: { flexDirection: "row", marginTop: 4 },
    barLabel: { flex: 1, color: "rgba(255,255,255,0.6)", fontSize: 10 },
    left: { textAlign: "left" },
    center: { textAlign: "center" },
    right: { textAlign: "right" },
    deviceValue: { fontSize: 22, lineHeight: 28, fontWeight: "700", color: t.colors.text },
    bar: {
      flexDirection: "row",
      height: 8,
      borderRadius: 4,
      overflow: "hidden",
      backgroundColor: t.colors.surfaceMuted,
      gap: 2,
    },
    legend: { flexDirection: "row", gap: t.spacing.lg },
    legendItem: { flexDirection: "row", alignItems: "center", gap: 6 },
  })
);
