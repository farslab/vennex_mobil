import React, { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppBadge, AppText, makeStyles, useTheme } from "@/design-system";
import { ConnectivityBadge, FillBar } from "@/components/devices/DeviceUi";
import { deviceTitle, fillInfo, lastSaleBadge, machineAlert } from "@/components/devices/deviceHelpers";
import { webBadgeColors } from "@/components/devices/webBadgeColors";
import { formatCurrency, formatInteger } from "@/utils/number";
import type { PosDeviceListItem } from "@/types/devices";

export interface DeviceRowProps {
  device: PosDeviceListItem;
  onPress: (device: PosDeviceListItem) => void;
  /** false → ciro/işlem sütunları gösterilmez (yetki yok veya kullanıcı gizledi) */
  showRevenue: boolean;
}

/** Web POS cihazı listesindeki dönem sütunları: Bugün · Dün · Bu Ay · Geçen Ay (ciro + işlem) */
const PERIODS = [
  { key: "today", label: "Bugün", revenue: "today_revenue", count: "today_tx_count" },
  { key: "yesterday", label: "Dün", revenue: "yesterday_revenue", count: "yesterday_tx_count" },
  { key: "month", label: "Bu Ay", revenue: "this_month_revenue", count: "this_month_tx_count" },
  { key: "last_month", label: "Geçen Ay", revenue: "last_month_revenue", count: "last_month_tx_count" },
] as const;

/**
 * Cihaz kartı — web listesindeki tüm bilgi:
 * ad + durum · seri no / konum · doluluk (yüzde + adet) · dört dönemin cirosu ve işlem sayısı · sol altta son satış.
 */
export const DeviceRow = memo(function DeviceRow({ device, onPress, showRevenue }: DeviceRowProps) {
  const styles = useStyles();
  const { isDark } = useTheme();
  const fill = fillInfo(device.fill_rate);
  const title = deviceTitle(device);
  const lastSale = lastSaleBadge(device.last_transaction);
  const alert = machineAlert(device.online, device.act_macstat);

  const a11y = [
    title,
    device.online ? "çevrimiçi" : "çevrimdışı",
    alert ? `makine ${alert}` : null,
    device.stat ? null : "Pasif",
    `son satış ${lastSale.label}`,
    fill.pct != null ? `doluluk ${fill.label}` : null,
    showRevenue ? PERIODS.map((p) => `${p.label} ${formatCurrency(device[p.revenue])}`).join(", ") : null,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Pressable
      testID={`device-row-${device.sn}`}
      onPress={() => onPress(device)}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint="Cihaz detayını açar"
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <View style={styles.line}>
        <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
          {title}
        </AppText>
        {!device.stat ? <AppBadge size="sm" tone="neutral" label="Pasif" /> : null}
        <ConnectivityBadge online={device.online} macstat={device.act_macstat} testID={`device-conn-${device.sn}`} />
      </View>

      <AppText variant="mono" color="textTertiary" numberOfLines={1}>
        {device.sn}
        {device.location_name ? ` · ${device.location_name}` : ""}
      </AppText>

      {/* Doluluk yoksa (ürün/stok girilmemiş) gösterilmez */}
      {fill.pct != null ? (
        <View style={styles.fillRow} testID={`device-fill-${device.sn}`}>
          <View style={styles.flex}>
            <FillBar pct={fill.pct} tone={fill.tone} height={6} />
          </View>
          <AppText variant="numericSm" color="textSecondary">
            {fill.label}
            {fill.detail ? ` · ${fill.detail}` : ""}
          </AppText>
        </View>
      ) : null}

      {showRevenue ? (
        <View style={styles.periods} testID={`device-revenue-${device.sn}`}>
          {PERIODS.map((p, i) => {
            const count = device[p.count];
            return (
              <View
                key={p.key}
                style={[styles.period, i % 2 === 1 && styles.periodRight, i >= 2 && styles.periodBottom]}
                testID={`device-period-${p.key}-${device.sn}`}
              >
                <AppText variant="caption" color="textTertiary" numberOfLines={1}>
                  {p.label}
                  {count != null ? ` · ${formatInteger(count)} işlem` : ""}
                </AppText>
                <AppText variant="numeric" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.amount}>
                  {formatCurrency(device[p.revenue])}
                </AppText>
              </View>
            );
          })}
        </View>
      ) : null}

      {/* Son satış süresi kartın sol altında */}
      <View style={styles.footer}>
        <View testID={`device-last-sale-${device.sn}`}>
          <AppBadge size="sm" icon="clock" label={lastSale.label} colors={webBadgeColors(lastSale.color, isDark)} />
        </View>
      </View>
    </Pressable>
  );
});

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    // Ayrık kart: kenarlardan boşluk, yuvarlak köşe, çerçeve ve hafif gölge
    card: {
      marginHorizontal: t.layout.screenPadding,
      marginBottom: t.spacing.md,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.md,
      gap: 6,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.md,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      ...t.elevation(1),
    },
    pressed: { backgroundColor: t.colors.surfacePressed },
    line: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    flex: { flex: 1, minWidth: 0 },
    footer: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, marginTop: 2 },
    fillRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    // 2×2: yüksek cirolar (₺1.250.000,00) da sığsın
    periods: {
      flexDirection: "row",
      flexWrap: "wrap",
      marginTop: 2,
      borderRadius: t.radius.sm,
      backgroundColor: t.colors.surfaceMuted,
      overflow: "hidden",
    },
    period: { width: "50%", gap: 1, paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.sm, minWidth: 0 },
    periodRight: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: t.colors.border },
    periodBottom: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.border },
    amount: { fontWeight: "700" },
  })
);
