/**
 * Genel — yalnız detay/summary/products yanıtlarındaki GERÇEK alanlar; uydurma şirket/SIM/tarih yok.
 * Düzen (Genel Bakış ile aynı dil): turuncu ciro kartı öne (Genel Bakış laciverdinden ayrışsın) (bugün büyük; dün · bu ay · geçen ay altta),
 * bağlantı ve makine durumu kutuları, ardından başlığı kart dışında bölümler (doluluk, ödeme yöntemleri, cihaz bilgisi).
 */
import React from "react";
import { RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { AppBadge, AppNotice, AppSkeleton, AppText, makeStyles, useTheme, type StatusTone } from "@/design-system";
import { errorMessage } from "@/api/client";
import { FillBar, KeyValueRow } from "@/components/devices/DeviceUi";
import {
  PAYMENT_METHOD_LABELS,
  connectivityInfo,
  deviceFillInfo,
  machineAlert,
  machineStatusInfo,
  machineTypeLabel,
  priceManagementLabel,
} from "@/components/devices/deviceHelpers";
import { DashSection, DashSurface } from "@/components/dashboard/DashSection";
import { HERO_DIVIDER, HERO_MUTED, HeroSurface } from "@/components/dashboard/HeroSurface";
import { formatCurrency, formatInteger } from "@/utils/number";
import { amountFontSize } from "@/utils/amountFontSize";
import type { PosDeviceDetail } from "@/types/devices";
import { useDeviceProducts, useDeviceSummary, type DeviceAccess } from "../useDeviceQueries";
import { CashSection } from "../components/CashSection";

type Period = { revenue: number | null; count: number | null };

/** Durum tonunu yazı rengine çevirir (kutulardaki değerler) */
const TONE_TEXT = {
  success: "success",
  danger: "danger",
  warning: "warning",
  info: "primary",
  neutral: "textSecondary",
} as const satisfies Record<StatusTone, string>;

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

  const conn = connectivityInfo(detail.is_online);
  const alert = machineAlert(detail.is_online, detail.act_macstat);
  const macStatus = machineStatusInfo(detail.act_macstat);
  const fill = deviceFillInfo(products.data?.fill);
  const methods = detail.payment_methods ?? {};
  const enabledMethods = PAYMENT_METHOD_LABELS.filter((m) => methods[m.key] === true);
  const knownMethods = PAYMENT_METHOD_LABELS.filter((m) => typeof methods[m.key] === "boolean");

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      keyboardShouldPersistTaps="handled"
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />}
      testID="tab-general"
    >
      {access.sales ? (
        summary.isLoading ? (
          <AppSkeleton height={168} radius={20} />
        ) : summary.isError ? (
          <AppNotice tone="warning" message={`Özet alınamadı: ${errorMessage(summary.error)}`} />
        ) : summary.data ? (
          <HeroSurface palette="orange" testID="general-revenue">
            <View testID="summary-Bugün Ciro">
              <AppText variant="caption" weight="600" style={styles.heroMuted}>
                Bugün ciro
              </AppText>
              {/* Tutar ve işlem sayısı tek metinde. adjustsFontSizeToFit burada tutarı okunamayacak kadar
                  küçültüyordu; boyut tutarın uzunluğuna göre seçilir */}
              <AppText style={[styles.heroValue, { fontSize: amountFontSize(summary.data.today.revenue, 32) }]} numberOfLines={1}>
                {formatCurrency(summary.data.today.revenue)}
                {summary.data.today.count != null ? (
                  <AppText variant="callout" style={styles.heroMuted}>
                    {`  ${formatInteger(summary.data.today.count)} işlem`}
                  </AppText>
                ) : null}
              </AppText>
            </View>
            <View style={styles.heroCols}>
              <HeroCol label="Dün" testID="summary-Dün Ciro" period={summary.data.yesterday} />
              <HeroCol label="Bu ay" testID="summary-Bu Ay Ciro" period={summary.data.this_month} divider />
              <HeroCol label="Geçen ay" testID="summary-Geçen Ay Ciro" period={summary.data.last_month} divider />
            </View>
          </HeroSurface>
        ) : null
      ) : null}

      {/* Durum: bağlantı ve makine durumu yan yana (pasif cihaz başlıkta "Pasif" rozetiyle görünür) */}
      <View style={styles.tiles}>
        <StatusTile label="Bağlantı" value={conn.label} tone={conn.tone} dot caption={alert ? `Makine ${alert}` : null} captionTone="danger" />
        <StatusTile label="Makine durumu" value={macStatus?.label ?? null} tone={macStatus?.tone ?? "neutral"} />
      </View>

      <DashSection
        title="Doluluk"
        subtitle={products.data ? (products.data.mode === "stock" ? "Stok modu" : "Normal mod") : undefined}
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
            {fill.pct != null ? (
              <FillBar pct={fill.pct} tone={fill.tone} height={8} accessibilityLabel={`Doluluk ${fill.label}`} />
            ) : null}
          </View>
        )}
      </DashSection>

      <DashSection title="Ödeme yöntemleri" subtitle={knownMethods.length ? `${enabledMethods.length} / ${knownMethods.length} açık` : undefined}>
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
      </DashSection>

      <DashSection title="Cihaz bilgisi" style={styles.infoSurface}>
        <KeyValueRow label="Seri no" value={detail.sn} mono />
        <KeyValueRow label="Ödeme tipi" value={machineTypeLabel(detail.pos_odemetip)} />
        <KeyValueRow label="Makine modeli" value={detail.machine_type?.name} />
        <KeyValueRow label="Fiyat yönetimi" value={priceManagementLabel(detail.price_management)} />
        <KeyValueRow label="Şirket" value={detail.company?.name} />
        <KeyValueRow label="Konum" value={detail.location?.name} last />
      </DashSection>

      {/* Nakit & ciro: ayrı sekme değil, Genel'in en altında (web: nakit paneli satış yetkisi veya teknisyen) */}
      {access.sales || access.isTech ? <CashSection sn={sn} detail={detail} access={access} /> : null}
    </ScrollView>
  );
}

/** Ciro kartının alt sütunu (dün · bu ay · geçen ay) — 0 geçerli değer, yoksa "—" */
function HeroCol({ label, period, divider, testID }: { label: string; period: Period; divider?: boolean; testID: string }) {
  const styles = useStyles();
  return (
    <View style={[styles.heroCol, divider && styles.heroColDivider]} testID={testID}>
      <AppText variant="caption" style={styles.heroMuted} numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="numericSm" style={styles.heroColValue} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65}>
        {formatCurrency(period.revenue)}
      </AppText>
      {period.count != null ? (
        <AppText variant="caption" style={styles.heroMuted} numberOfLines={1}>
          {formatInteger(period.count)} işlem
        </AppText>
      ) : null}
    </View>
  );
}

/** Durum kutusu: etiket · renkli değer (isteğe bağlı nokta) · alt bilgi */
function StatusTile({
  label,
  value,
  tone = "neutral",
  dot,
  caption,
  captionTone,
}: {
  label: string;
  value: string | null;
  tone?: StatusTone;
  dot?: boolean;
  caption?: string | null;
  captionTone?: StatusTone;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const color = value ? (tone === "neutral" ? "text" : TONE_TEXT[tone]) : "textTertiary";
  return (
    <DashSurface style={styles.tile}>
      <View accessible accessibilityLabel={`${label}: ${value ?? "—"}${caption ? `, ${caption}` : ""}`}>
        <AppText variant="caption" color="textTertiary" numberOfLines={1}>
          {label}
        </AppText>
        <View style={styles.tileValueRow}>
          {dot && value ? <View style={[styles.dot, { backgroundColor: colors[TONE_TEXT[tone]] }]} /> : null}
          <AppText variant="calloutStrong" color={color} numberOfLines={1} style={styles.flex}>
            {value ?? "—"}
          </AppText>
        </View>
        {caption ? (
          <AppText variant="caption" color={captionTone ? TONE_TEXT[captionTone] : "textTertiary"} numberOfLines={1}>
            {caption}
          </AppText>
        ) : null}
      </View>
    </DashSurface>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    content: { padding: t.layout.screenPadding, gap: t.spacing.lg, paddingBottom: t.spacing.huge },
    flex: { flex: 1, minWidth: 0 },
    heroMuted: { color: HERO_MUTED },
    heroValue: { color: "#FFFFFF", lineHeight: 40, fontWeight: "700", letterSpacing: -0.5, marginTop: 2 },
    heroCols: { flexDirection: "row", paddingTop: t.spacing.md, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: HERO_DIVIDER },
    heroCol: { flex: 1, minWidth: 0, gap: 1 },
    heroColDivider: { paddingLeft: t.spacing.md, marginLeft: t.spacing.sm, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: HERO_DIVIDER },
    heroColValue: { color: "#FFFFFF", fontWeight: "700", fontSize: 15 },
    tiles: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm },
    tile: { flexBasis: "48%", flexGrow: 1, paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.sm + 2 },
    tileValueRow: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: 2 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm },
    fillBlock: { gap: t.spacing.sm },
    fillHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between" },
    // Anahtar/değer satırları kendi dikey boşluğunu taşır
    infoSurface: { paddingVertical: t.spacing.xs },
  })
);
