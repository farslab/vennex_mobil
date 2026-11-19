/** Cihaz modülü küçük ortak görsel parçalar — yalnız design-system token'ları */
import React from "react";
import { StyleSheet, View } from "react-native";
import { AppBadge, AppIcon, AppText, makeStyles, toneColors, useTheme, type StatusTone } from "@/design-system";
import { connectivityInfo, machineAlert } from "./deviceHelpers";

/** İnce doluluk çubuğu — yüzde yoksa boş iz çizer (değer uydurmaz) */
export function FillBar({
  pct,
  tone = "neutral",
  height = 4,
  accessibilityLabel,
}: {
  pct: number | null;
  tone?: StatusTone;
  height?: number;
  accessibilityLabel?: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { fg } = toneColors(colors, tone);
  return (
    <View
      style={[styles.track, { height, borderRadius: height / 2 }]}
      accessible={!!accessibilityLabel}
      accessibilityLabel={accessibilityLabel}
      accessibilityRole={accessibilityLabel ? "progressbar" : undefined}
      accessibilityValue={pct != null ? { min: 0, max: 100, now: pct } : undefined}
    >
      {pct != null ? (
        <View style={{ width: `${Math.max(0, Math.min(100, pct))}%`, height, borderRadius: height / 2, backgroundColor: fg }} />
      ) : null}
    </View>
  );
}

/** Etiket–değer satırı (cihaz bilgisi, işlem detayı) */
export function KeyValueRow({
  label,
  value,
  mono,
  last,
  right,
}: {
  label: string;
  value?: string | null;
  mono?: boolean;
  last?: boolean;
  right?: React.ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.kvRow, !last && styles.kvBorder]} accessible accessibilityLabel={`${label}: ${value ?? "—"}`}>
      <AppText variant="callout" color="textSecondary" style={styles.kvLabel}>
        {label}
      </AppText>
      {right ?? (
        <AppText variant={mono ? "mono" : "calloutStrong"} style={styles.kvValue} numberOfLines={2} selectable>
          {value || "—"}
        </AppText>
      )}
    </View>
  );
}

/** Kompakt metrik hücresi (etiket üstte, değer altta) — yoğun ızgaralar için */
export function MetricCell({
  label,
  value,
  caption,
  testID,
}: {
  label: string;
  value: string;
  caption?: string | null;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.metric} testID={testID} accessible accessibilityLabel={`${label}: ${value}${caption ? `, ${caption}` : ""}`}>
      <AppText variant="caption" color="textTertiary" numberOfLines={1}>
        {label}
      </AppText>
      <AppText variant="numeric" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.75}>
        {value}
      </AppText>
      {caption ? (
        <AppText variant="caption" color="textTertiary" numberOfLines={1}>
          {caption}
        </AppText>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    track: { width: "100%", backgroundColor: t.colors.surfacePressed, overflow: "hidden" },
    kvRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: t.spacing.md,
      minHeight: 44,
      paddingVertical: t.spacing.sm,
    },
    kvBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    kvLabel: { flexShrink: 0, maxWidth: "45%" },
    kvValue: { flex: 1, textAlign: "right" },
    metric: {
      flex: 1,
      minWidth: 130,
      gap: 2,
      paddingVertical: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radius.sm,
      backgroundColor: t.colors.surfaceMuted,
    },
  })
);

/**
 * Bağlantı rozeti — web ile aynı: çevrimiçi cihazın makinesi DISABLED/INACTIVE ise
 * rozetin yanında kırmızı ünlem (pos_device_rows.html).
 */
export function ConnectivityBadge({
  online,
  macstat,
  size = "sm",
  testID,
}: {
  online: boolean | null | undefined;
  macstat?: unknown;
  size?: "sm" | "md";
  testID?: string;
}) {
  const conn = connectivityInfo(online);
  const alert = machineAlert(online, macstat);
  return (
    <View
      style={badgeStyles.row}
      accessible
      accessibilityLabel={alert ? `${conn.label}, makine ${alert}` : conn.label}
      testID={testID}
    >
      {alert ? <AppIcon name="alert-triangle" size={size === "sm" ? 13 : 15} color="danger" /> : null}
      <AppBadge size={size} dot tone={conn.tone} label={conn.label} />
    </View>
  );
}

const badgeStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 4 },
});
