/**
 * Cihaz detayı sekme çubuğu. Görünüm denemeleri için stiller:
 * - "navy":    lacivert bant içinde; beyaz yazı, seçili beyaz alt çizgi
 * - "line":    sola dayalı alt çizgili sekmeler (seçili mavi)
 * - "segment": gri ray üzerinde beyaz seçili dilim (POS listesindeki sayaç seçicisi gibi)
 * - "icons":   ikon + etiket, seçilide alt çizgi
 * - "orange":  alt çizgili sekmeler, seçili turuncu (ciro kartıyla uyumlu)
 * - "dark":    seçili sekme lacivert dolu kapsül
 * - "card":    beyaz gölgeli kart içinde, seçili açık mavi zemin
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppIcon, AppText, makeStyles, useTheme, type IconName } from "@/design-system";
import type { DeviceTabKey } from "../DeviceDetailScreen";

export type DeviceTabStyle = "navy" | "line" | "segment" | "icons" | "orange" | "dark" | "card";

export interface DeviceTabItem {
  key: DeviceTabKey;
  label: string;
}

const ICONS: Record<DeviceTabKey, IconName> = {
  general: "grid",
  sales: "file-text",
  stock: "package",
  stats: "bar-chart-2",
  settings: "settings",
};

const ORANGE = "#E2602F";
const NAVY = "#0B2E55";

export function DeviceTabBar({
  items,
  value,
  onChange,
  variant = "segment",
  testID,
}: {
  items: DeviceTabItem[];
  value: DeviceTabKey;
  onChange: (key: DeviceTabKey) => void;
  variant?: DeviceTabStyle;
  testID?: string;
}) {
  const styles = useStyles();
  const { isDark } = useTheme();

  const wrapStyle =
    variant === "segment"
      ? styles.segmentWrap
      : variant === "card"
        ? [styles.cardWrap, isDark ? styles.cardDark : styles.cardLight]
        : variant === "dark"
          ? styles.darkWrap
          : variant === "line"
            ? [styles.lineWrap, styles.lineLeft]
            : variant === "navy"
              ? [styles.lineWrap, styles.lineLeft, styles.navyWrap]
            : styles.lineWrap;

  return (
    <View style={styles.outer}>
      <View style={wrapStyle} accessibilityRole="tablist" testID={testID}>
        {items.map((item) => {
          const active = item.key === value;
          return (
            <Pressable
              key={item.key}
              onPress={() => onChange(item.key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={item.label}
              hitSlop={4}
              style={({ pressed }) => [
                styles.item,
                variant === "segment" && styles.segmentItem,
                variant === "segment" && active && [styles.segmentActive, !isDark && styles.segmentShadow],
                variant === "icons" && styles.iconItem,
                (variant === "icons" || variant === "orange" || variant === "line" || variant === "navy") && styles.lineItem,
                variant === "navy" && active && styles.navyActive,
                (variant === "icons" || variant === "line") && active && styles.lineActive,
                variant === "orange" && active && styles.orangeActive,
                variant === "dark" && styles.darkItem,
                variant === "dark" && active && styles.darkActive,
                variant === "card" && styles.cardItem,
                variant === "card" && active && styles.cardActive,
                pressed && styles.pressed,
              ]}
            >
              {variant === "icons" ? <AppIcon name={ICONS[item.key]} size={18} color={active ? "primary" : "textSecondary"} /> : null}
              <AppText
                variant={variant === "icons" ? "caption" : "callout"}
                weight={active ? "700" : "600"}
                numberOfLines={1}
                color={
                  variant === "navy"
                    ? undefined
                    : variant === "dark" && active
                      ? "onPrimary"
                      : variant === "orange" && active
                        ? undefined
                        : active
                          ? "primary"
                          : "textSecondary"
                }
                style={
                  variant === "navy" ? (active ? styles.navyText : styles.navyTextMuted) : variant === "orange" && active ? styles.orangeText : undefined
                }
              >
                {item.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    outer: { paddingHorizontal: t.layout.screenPadding, paddingBottom: t.spacing.sm },
    item: { alignItems: "center", justifyContent: "center" },
    pressed: { opacity: 0.6 },
    // 1 · bölmeli seçici
    segmentWrap: {
      flexDirection: "row",
      padding: 3,
      borderRadius: 999,
      backgroundColor: "rgba(120,130,150,0.14)",
    },
    segmentItem: { flexGrow: 1, flexBasis: 0, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 999 },
    segmentActive: { backgroundColor: t.colors.surface },
    segmentShadow: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.1,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
      elevation: 1,
    },
    // 2 · ikonlu ve 3 · turuncu alt çizgi
    lineWrap: {
      flexDirection: "row",
      justifyContent: "space-between",
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    lineItem: { paddingVertical: 8, paddingHorizontal: 4, borderBottomWidth: 2, borderBottomColor: "transparent", marginBottom: -StyleSheet.hairlineWidth },
    navyWrap: { borderBottomColor: "rgba(255,255,255,0.18)" },
    navyActive: { borderBottomColor: "#FFFFFF" },
    navyText: { color: "#FFFFFF" },
    navyTextMuted: { color: "rgba(255,255,255,0.7)" },
    lineLeft: { justifyContent: "flex-start", gap: t.spacing.lg },
    iconItem: { flexGrow: 1, flexBasis: 0, gap: 2 },
    lineActive: { borderBottomColor: t.colors.primary },
    orangeActive: { borderBottomColor: ORANGE, borderBottomWidth: 3 },
    orangeText: { color: ORANGE },
    // 4 · koyu kapsül
    darkWrap: { flexDirection: "row", gap: 2 },
    darkItem: { flexGrow: 1, flexBasis: 0, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 999 },
    darkActive: { backgroundColor: NAVY },
    // 5 · kart içinde
    cardWrap: { flexDirection: "row", padding: 4, borderRadius: 14, backgroundColor: t.colors.surface },
    cardLight: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.07,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    cardDark: { borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border },
    cardItem: { flexGrow: 1, flexBasis: 0, paddingVertical: 8, paddingHorizontal: 4, borderRadius: 10 },
    cardActive: { backgroundColor: t.colors.primarySubtle },
  })
);
