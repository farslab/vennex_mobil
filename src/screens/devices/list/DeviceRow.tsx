import React, { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppBadge, AppIcon, AppText, makeStyles, useTheme } from "@/design-system";
import { FillBar } from "@/components/devices/DeviceUi";
import { connectivityInfo, deviceTitle, fillInfo, lastSaleBadge, machineAlert } from "@/components/devices/deviceHelpers";
import { webBadgeColors } from "@/components/devices/webBadgeColors";
import { formatCurrency, formatInteger } from "@/utils/number";
import { amountFontSize } from "@/utils/amountFontSize";
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
const [TODAY, ...OTHER_PERIODS] = PERIODS;

/**
 * Cihaz kartı — web listesindeki tüm bilgi:
 * durum halkası + ad · seri no / konum · durum ve son satış süresi · doluluk (yüzde + adet) ·
 * bugünün cirosu büyük, dün / bu ay / geçen ay altta gri şeritte (ciro + işlem).
 */
export const DeviceRow = memo(function DeviceRow({ device, onPress, showRevenue }: DeviceRowProps) {
  const styles = useStyles();
  const { isDark, colors } = useTheme();
  const fill = fillInfo(device.fill_rate);
  const title = deviceTitle(device);
  const lastSale = lastSaleBadge(device.last_transaction);
  const alert = machineAlert(device.online, device.act_macstat);
  const conn = connectivityInfo(device.online);
  // Durum rengi: halka, ikon ve durum yazısı (bilinmiyorsa gri)
  const statusColor = device.online == null ? colors.textTertiary : device.online ? colors.success : colors.danger;
  const lastSaleColor = webBadgeColors(lastSale.color, isDark).fg;

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
      {/* Genel Bakış "POS Cihazları" kartı gibi: solda durum renginde halka + cihaz ikonu */}
      <View style={styles.head}>
        <View style={[styles.ring, { borderColor: statusColor }]}>
          <AppIcon name="pos" size={18} color={device.online == null ? "textTertiary" : device.online ? "success" : "danger"} />
        </View>
        <View style={styles.flex}>
          <View style={styles.titleRow}>
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.flexShrink}>
              {title}
            </AppText>
            {!device.stat ? <AppBadge size="sm" tone="neutral" label="Pasif" /> : null}
          </View>
          <AppText variant="caption" color="textTertiary" numberOfLines={1}>
            {device.sn}
            {device.location_name ? ` · ${device.location_name}` : ""}
          </AppText>
          {/* Son satış süresi (renk: web rozet rengi). Bağlantı durumu halkanın renginde; burada yalnız
              makine uyarısı varsa ikon çıkar (ekran okuyucu etiketi bağlantıyı söyler) */}
          <View style={styles.statusRow}>
            <View
              style={[styles.inline, alert ? styles.alertGap : null]}
              accessible
              accessibilityLabel={alert ? `${conn.label}, makine ${alert}` : conn.label}
              testID={`device-conn-${device.sn}`}
            >
              {alert ? <AppIcon name="alert-triangle" size={12} color="danger" /> : null}
            </View>
            <View style={styles.inline} testID={`device-last-sale-${device.sn}`}>
              <AppIcon name="clock" size={12} color={lastSaleColor} />
              <AppText variant="caption" weight="600" style={{ color: lastSaleColor }} numberOfLines={1}>
                {lastSale.label}
              </AppText>
            </View>
          </View>
        </View>
        <AppIcon name="chevron-right" size={18} color="textTertiary" />
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
        <View style={styles.revenue} testID={`device-revenue-${device.sn}`}>
          {/* Bugün: etiket solda, tutar (+ işlem sayısı) sağda büyük */}
          <View style={styles.todayRow} testID={`device-period-today-${device.sn}`}>
            <AppText variant="caption" color="textTertiary" weight="600">
              {TODAY.label}
            </AppText>
            <AppText
              variant="numeric"
              numberOfLines={1}
              style={[styles.todayAmount, { fontSize: amountFontSize(device[TODAY.revenue], 24) }]}
            >
              {formatCurrency(device[TODAY.revenue])}
              {device[TODAY.count] != null ? (
                <AppText variant="caption" color="textTertiary">
                  {`  ${formatInteger(device[TODAY.count])} işlem`}
                </AppText>
              ) : null}
            </AppText>
          </View>
          {/* Dün · Bu Ay · Geçen Ay: gri şeritte üç sütun */}
          <View style={styles.cols}>
            {OTHER_PERIODS.map((p) => {
              const count = device[p.count];
              return (
                <View key={p.key} style={styles.col} testID={`device-period-${p.key}-${device.sn}`}>
                  <AppText variant="caption" color="textTertiary" numberOfLines={1}>
                    {p.label}
                  </AppText>
                  <AppText variant="numericSm" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.65} style={styles.colAmount}>
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
        </View>
      ) : null}
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
    // Şerit kartın üst köşelerini izler (gölge kırpılmasın diye kartta overflow yok)
    head: { flexDirection: "row", alignItems: "center", gap: t.spacing.md },
    ring: { width: 46, height: 46, borderRadius: 23, borderWidth: 3, alignItems: "center", justifyContent: "center" },
    titleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
    flexShrink: { flexShrink: 1 },
    // Uyarı yokken boş durum görünümü boşluk bırakmasın: aralık yalnız uyarı ikonunda
    statusRow: { flexDirection: "row", alignItems: "center", marginTop: 2 },
    alertGap: { marginRight: 6 },
    inline: { flexDirection: "row", alignItems: "center", gap: 4 },
    fill: { gap: 6 },
    fillHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
    revenue: { gap: t.spacing.sm },
    todayRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: t.spacing.sm },
    todayAmount: { fontWeight: "700", lineHeight: 30, flexShrink: 1, textAlign: "right" },
    cols: {
      flexDirection: "row",
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      borderRadius: 12,
      backgroundColor: t.colors.surfaceMuted,
    },
    col: { flex: 1, minWidth: 0, gap: 1 },
    colAmount: { fontWeight: "700", fontSize: 14 },
  })
);
