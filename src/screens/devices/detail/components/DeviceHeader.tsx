/**
 * Cihaz detayı başlığı (yerel yığın başlığı gizli; geri ve uzaktan satış burada).
 * Görünüm denemeleri:
 * - "large": sekme ekranları gibi büyük, sola dayalı ad; altında seri no · konum; yuvarlak geri/uzaktan satış
 * - "navy":  lacivert degrade bant (Genel Bakış ciro kartı renginde); beyaz yazılar, sekmeler bandın içinde
 * - "compact": tek satır — yuvarlak geri · ad (altında seri no) · lacivert uzaktan satış
 * - "card":  üstte "‹ Geri" satırı; cihaz bir kartta (durum halkası + ad + seri no · konum + uzaktan satış)
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { AppBadge, AppIcon, AppText, makeStyles, useTheme } from "@/design-system";

export type DeviceHeaderStyle = "large" | "card" | "navy" | "compact";

export function DeviceHeader({
  variant = "large",
  title,
  sn,
  location,
  inactive,
  online,
  onBack,
  onRemoteSale,
  children,
}: {
  variant?: DeviceHeaderStyle;
  title: string;
  sn: string;
  location?: string | null;
  inactive?: boolean;
  /** Durum halkasının rengi ("card"): true yeşil, false kırmızı, bilinmiyorsa gri */
  online?: boolean | null;
  onBack: () => void;
  /** Verilirse sağ üstte uzaktan satış düğmesi */
  onRemoteSale?: () => void;
  /** Başlığın altında (sekmeler) */
  children?: React.ReactNode;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const { isDark, colors } = useTheme();

  if (variant === "compact") {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 4 }]}>
        <View style={styles.compactRow}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Geri"
            hitSlop={8}
            style={({ pressed }) => [styles.round, isDark ? styles.roundDark : styles.roundLight, pressed && styles.pressed]}
            testID="device-header-back"
          >
            <AppIcon name="arrow-left" size={20} color="text" />
          </Pressable>
          <View style={styles.cardText} accessible accessibilityRole="header" accessibilityLabel={`${title}, ${sn}${inactive ? ", pasif" : ""}`}>
            <AppText variant="bodyStrong" numberOfLines={1}>
              {title}
            </AppText>
            <View style={styles.meta}>
              <AppText variant="mono" color="textSecondary" numberOfLines={1} testID="device-header-sn" style={styles.snSm}>
                {sn}
              </AppText>
              {inactive ? <AppBadge size="sm" tone="neutral" label="Pasif" /> : null}
            </View>
          </View>
          {onRemoteSale ? (
            <Pressable
              onPress={onRemoteSale}
              accessibilityRole="button"
              accessibilityLabel="Uzaktan satış"
              hitSlop={8}
              style={({ pressed }) => [styles.round, styles.remoteNavy, pressed && styles.pressed]}
              testID="open-remote-sale"
            >
              <AppIcon name="radio" size={20} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
        {children}
      </View>
    );
  }

  if (variant === "navy") {
    return (
      <LinearGradient
        colors={isDark ? ["#0C1E36", "#173A63"] : ["#0B2E55", "#17589C"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.navy, { paddingTop: insets.top + 4 }]}
      >
        {/* Lacivert zeminde saat/pil simgeleri beyaz; ekrandan çıkınca tema rengine döner */}
        <StatusBar style="light" />
        <View style={styles.actions}>
          <Pressable
            onPress={onBack}
            accessibilityRole="button"
            accessibilityLabel="Geri"
            hitSlop={8}
            style={({ pressed }) => [styles.round, styles.navyButton, pressed && styles.pressed]}
            testID="device-header-back"
          >
            <AppIcon name="chevron-left" size={22} color="#FFFFFF" />
          </Pressable>
          {onRemoteSale ? (
            <Pressable
              onPress={onRemoteSale}
              accessibilityRole="button"
              accessibilityLabel="Uzaktan satış"
              hitSlop={8}
              style={({ pressed }) => [styles.round, styles.navyButton, pressed && styles.pressed]}
              testID="open-remote-sale"
            >
              <AppIcon name="radio" size={20} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </View>
        <View style={styles.titleBlock} accessible accessibilityRole="header" accessibilityLabel={`${title}, ${sn}${inactive ? ", pasif" : ""}`}>
          <AppText variant="title" numberOfLines={2} style={styles.white}>
            {title}
          </AppText>
          <View style={styles.meta}>
            <AppText variant="mono" numberOfLines={1} testID="device-header-sn" style={[styles.sn, styles.whiteMuted]}>
              {sn}
            </AppText>
            {location ? (
              <AppText variant="callout" numberOfLines={1} style={[styles.flexShrink, styles.whiteMuted]}>
                · {location}
              </AppText>
            ) : null}
            {inactive ? <AppBadge size="sm" tone="neutral" label="Pasif" /> : null}
          </View>
        </View>
        {children}
      </LinearGradient>
    );
  }

  if (variant === "card") {
    const ring = online == null ? colors.textTertiary : online ? colors.success : colors.danger;
    return (
      <View style={[styles.root, { paddingTop: insets.top + 4 }]}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Geri"
          hitSlop={8}
          style={({ pressed }) => [styles.backRow, pressed && styles.pressed]}
          testID="device-header-back"
        >
          <AppIcon name="chevron-left" size={22} color="primary" />
          {/* Detay Genel Bakış'tan da açılır: sabit ekran adı yerine "Geri" */}
          <AppText variant="callout" color="primary" weight="600">
            Geri
          </AppText>
        </Pressable>
        <View style={[styles.card, isDark ? styles.roundDark : styles.cardLight]}>
          <View style={[styles.ring, { borderColor: ring }]}>
            <AppIcon name="pos" size={18} color={ring} />
          </View>
          <View style={styles.cardText} accessible accessibilityRole="header" accessibilityLabel={`${title}, ${sn}${inactive ? ", pasif" : ""}`}>
            <AppText variant="bodyStrong" numberOfLines={2}>
              {title}
            </AppText>
            <View style={styles.meta}>
              <AppText variant="mono" color="textSecondary" numberOfLines={1} testID="device-header-sn" style={styles.snSm}>
                {sn}
              </AppText>
              {location ? (
                <AppText variant="caption" color="textTertiary" numberOfLines={1} style={styles.flexShrink}>
                  · {location}
                </AppText>
              ) : null}
              {inactive ? <AppBadge size="sm" tone="neutral" label="Pasif" /> : null}
            </View>
          </View>
          {onRemoteSale ? (
            <Pressable
              onPress={onRemoteSale}
              accessibilityRole="button"
              accessibilityLabel="Uzaktan satış"
              hitSlop={8}
              style={({ pressed }) => [styles.round, styles.remote, pressed && styles.pressed]}
              testID="open-remote-sale"
            >
              <AppIcon name="radio" size={20} color="primary" />
            </Pressable>
          ) : null}
        </View>
        {children}
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 4 }]}>
      <View style={styles.actions}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Geri"
          hitSlop={8}
          style={({ pressed }) => [styles.round, isDark ? styles.roundDark : styles.roundLight, pressed && styles.pressed]}
          testID="device-header-back"
        >
          <AppIcon name="chevron-left" size={22} color="primary" />
        </Pressable>
        {onRemoteSale ? (
          <Pressable
            onPress={onRemoteSale}
            accessibilityRole="button"
            accessibilityLabel="Uzaktan satış"
            hitSlop={8}
            style={({ pressed }) => [styles.round, styles.remote, pressed && styles.pressed]}
            testID="open-remote-sale"
          >
            <AppIcon name="radio" size={20} color="primary" />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.titleBlock} accessible accessibilityRole="header" accessibilityLabel={`${title}, ${sn}${inactive ? ", pasif" : ""}`}>
        <AppText variant="title" numberOfLines={2}>
          {title}
        </AppText>
        <View style={styles.meta}>
          <AppText variant="mono" color="textSecondary" numberOfLines={1} testID="device-header-sn" style={styles.sn}>
            {sn}
          </AppText>
          {location ? (
            <AppText variant="callout" color="textTertiary" numberOfLines={1} style={styles.flexShrink}>
              · {location}
            </AppText>
          ) : null}
          {inactive ? <AppBadge size="sm" tone="neutral" label="Pasif" /> : null}
        </View>
      </View>
      {children}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { backgroundColor: t.colors.background },
    actions: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      paddingHorizontal: t.layout.screenPadding,
      minHeight: 44,
    },
    round: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    roundLight: {
      backgroundColor: t.colors.surface,
      shadowColor: "#0F172A",
      shadowOpacity: 0.08,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 2 },
      elevation: 2,
    },
    roundDark: { backgroundColor: t.colors.surface, borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border },
    remote: { backgroundColor: t.colors.primarySubtle },
    pressed: { opacity: 0.6 },
    titleBlock: { paddingHorizontal: t.layout.screenPadding, paddingTop: t.spacing.sm, paddingBottom: t.spacing.md, gap: 2 },
    meta: { flexDirection: "row", alignItems: "center", gap: 4 },
    backRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 2,
      alignSelf: "flex-start",
      paddingHorizontal: t.layout.screenPadding - 6,
      minHeight: 44,
    },
    card: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      marginHorizontal: t.layout.screenPadding,
      marginBottom: t.spacing.md,
      padding: t.spacing.md,
      borderRadius: 18,
      backgroundColor: t.colors.surface,
    },
    cardLight: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.07,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    ring: { width: 46, height: 46, borderRadius: 23, borderWidth: 3, alignItems: "center", justifyContent: "center" },
    cardText: { flex: 1, minWidth: 0, gap: 2 },
    snSm: { fontSize: 13 },
    navy: { marginBottom: t.spacing.md },
    compactRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.sm,
    },
    remoteNavy: { backgroundColor: "#0B2E55" },
    navyButton: { backgroundColor: "rgba(255,255,255,0.16)" },
    white: { color: "#FFFFFF" },
    whiteMuted: { color: "rgba(255,255,255,0.75)" },
    sn: { fontSize: 14 },
    flexShrink: { flexShrink: 1 },
  })
);
