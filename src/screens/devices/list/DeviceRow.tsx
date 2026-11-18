import React, { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppBadge, AppIcon, AppText, makeStyles } from "@/design-system";
import { FillBar } from "@/components/devices/DeviceUi";
import { connectivityInfo, deviceTitle, fillInfo, type RevenueColumn } from "@/components/devices/deviceHelpers";
import { formatCurrency, formatInteger } from "@/utils/number";
import { formatRelative } from "@/utils/date";
import type { PosDeviceListItem } from "@/types/devices";

export interface DeviceRowProps {
  device: PosDeviceListItem;
  onPress: (device: PosDeviceListItem) => void;
  /** null → ciro sütunu gösterilmez (yetki yok veya kullanıcı gizledi) */
  revenue: { key: RevenueColumn; label: string } | null;
}

/** Yoğun, üç satırlı cihaz satırı: kimlik · ciro / durum · doluluk · son iletişim */
export const DeviceRow = memo(function DeviceRow({ device, onPress, revenue }: DeviceRowProps) {
  const styles = useStyles();
  const conn = connectivityInfo(device.online);
  const fill = fillInfo(device.fill_rate);
  const title = deviceTitle(device);
  const lastSeen = formatRelative(device.last_seen);
  const revenueValue = revenue ? device[revenue.key] : null;
  const showTxCount = revenue?.key === "today_revenue" && device.today_tx_count != null;

  const a11y = [
    title,
    conn.label,
    device.stat ? null : "Pasif",
    `Doluluk ${fill.label}`,
    `Son iletişim ${lastSeen}`,
    revenue ? `${revenue.label} ciro ${formatCurrency(revenueValue)}` : null,
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
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.line}>
        <AppText variant="bodyStrong" numberOfLines={1} style={styles.flex}>
          {title}
        </AppText>
        {revenue ? (
          <AppText variant="numeric" numberOfLines={1}>
            {formatCurrency(revenueValue)}
          </AppText>
        ) : null}
      </View>

      <View style={styles.line}>
        <AppText variant="mono" color="textTertiary" numberOfLines={1} style={styles.flex}>
          {device.sn}
          {device.location_name ? ` · ${device.location_name}` : ""}
        </AppText>
        {revenue ? (
          <AppText variant="caption" color="textTertiary" numberOfLines={1}>
            {revenue.label}
            {showTxCount ? ` · ${formatInteger(device.today_tx_count)} işlem` : ""}
          </AppText>
        ) : null}
      </View>

      <View style={[styles.line, styles.meta]}>
        <AppBadge size="sm" dot tone={conn.tone} label={conn.label} />
        {!device.stat ? <AppBadge size="sm" tone="neutral" label="Pasif" /> : null}
        <View style={styles.fill}>
          <View style={styles.fillBar}>
            <FillBar pct={fill.pct} tone={fill.tone} />
          </View>
          <AppText variant="numericSm" color="textSecondary">
            {fill.label}
          </AppText>
        </View>
        <View style={styles.spacer} />
        <AppIcon name="activity" size={12} color="textTertiary" />
        <AppText variant="caption" color="textTertiary" numberOfLines={1}>
          {lastSeen}
        </AppText>
      </View>
    </Pressable>
  );
});

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    row: {
      paddingHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.md,
      gap: 3,
      backgroundColor: t.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      minHeight: 76,
    },
    pressed: { backgroundColor: t.colors.surfacePressed },
    line: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    meta: { marginTop: t.spacing.xs },
    flex: { flex: 1 },
    spacer: { flex: 1 },
    fill: { flexDirection: "row", alignItems: "center", gap: 6 },
    fillBar: { width: 48 },
  })
);
