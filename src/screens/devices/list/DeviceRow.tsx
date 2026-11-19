import React, { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppBadge, AppIcon, AppText, makeStyles, useTheme } from "@/design-system";
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
  const { isDark, colors } = useTheme();
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
      style={({ pressed }) => [styles.card, isDark ? styles.cardDark : styles.cardLight, pressed && styles.pressed]}
    >
      {/* Başlık: durum simgesi (yeşil çevrimiçi / kırmızı çevrimdışı) · ad · seri no ve konum · rozetler */}
      <View style={styles.head}>
        <View style={[styles.avatar, { backgroundColor: device.online ? colors.successSubtle : colors.dangerSubtle }]}>
          <AppIcon name="pos" size={20} color={device.online ? "success" : "danger"} />
        </View>
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {title}
          </AppText>
          <AppText variant="caption" color="textTertiary" numberOfLines={1}>
            {device.sn}
            {device.location_name ? ` · ${device.location_name}` : ""}
          </AppText>
        </View>
        <View style={styles.badges}>
          {!device.stat ? <AppBadge size="sm" tone="neutral" label="Pasif" /> : null}
          <ConnectivityBadge online={device.online} macstat={device.act_macstat} testID={`device-conn-${device.sn}`} />
        </View>
      </View>

      {/* Doluluk yoksa (ürün/stok girilmemiş) gösterilmez */}
      {fill.pct != null ? (
        <View style={styles.fill} testID={`device-fill-${device.sn}`}>
          <View style={styles.fillHead}>
            <AppText variant="caption" color="textSecondary" weight="600">
              Doluluk
            </AppText>
            <AppText variant="caption" color="textSecondary" weight="700">
              {fill.label}
              {fill.detail ? ` · ${fill.detail}` : ""}
            </AppText>
          </View>
          <FillBar pct={fill.pct} tone={fill.tone} height={6} />
        </View>
      ) : null}

      {showRevenue ? (
        <View style={styles.periods} testID={`device-revenue-${device.sn}`}>
          {PERIODS.map((p) => {
            const count = device[p.count];
            const today = p.key === "today";
            return (
              <View
                key={p.key}
                style={[styles.period, today && { backgroundColor: colors.primarySubtle }]}
                testID={`device-period-${p.key}-${device.sn}`}
              >
                <AppText variant="caption" color={today ? "primary" : "textSecondary"} weight="600" numberOfLines={1}>
                  {p.label}
                </AppText>
                <AppText variant="numeric" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.amount}>
                  {formatCurrency(device[p.revenue])}
                </AppText>
                {count != null ? (
                  <AppText variant="caption" color="textTertiary" numberOfLines={1}>
                    {formatInteger(count)} işlem
                  </AppText>
                ) : null}
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
        <View style={styles.flex} />
        <AppIcon name="chevron-right" size={18} color="textTertiary" />
      </View>
    </Pressable>
  );
});

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    // Genel bakışla aynı yüzey: çerçevesiz, yumuşak gölge (koyu temada ince kenarlık)
    card: {
      marginHorizontal: t.layout.screenPadding,
      marginBottom: t.spacing.md,
      padding: t.spacing.md,
      gap: t.spacing.md,
      backgroundColor: t.colors.surface,
      borderRadius: 18,
    },
    cardLight: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.07,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    cardDark: { borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border },
    pressed: { opacity: 0.85 },
    flex: { flex: 1, minWidth: 0 },
    head: { flexDirection: "row", alignItems: "center", gap: t.spacing.md },
    avatar: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
    badges: { flexDirection: "row", alignItems: "center", gap: 6 },
    fill: { gap: 6 },
    fillHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    // 2×2 ayrı kutular; yüksek cirolar (₺1.250.000,00) da sığsın
    periods: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm },
    period: {
      flexBasis: "47%",
      flexGrow: 1,
      gap: 1,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      borderRadius: 12,
      backgroundColor: t.colors.surfaceMuted,
      minWidth: 0,
    },
    amount: { fontWeight: "700", fontSize: 17 },
    footer: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
  })
);
