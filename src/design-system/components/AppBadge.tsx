import React from "react";
import { StyleSheet, View } from "react-native";
import { makeStyles, useTheme } from "../theme";
import { toneColors, type StatusTone } from "../tokens/colors";
import { AppText } from "./AppText";
import { AppIcon, type IconName } from "./AppIcon";

export interface AppBadgeProps {
  label: string;
  tone?: StatusTone;
  /** Durumu renk dışında da ifade etmek için nokta veya ikon */
  dot?: boolean;
  icon?: IconName;
  size?: "sm" | "md";
  /** Tonu ezen özel renk (ör. web'deki ödeme tipi renkleri) */
  colors?: { fg: string; bg: string };
}

/** Durum rozeti — renk tek başına bilgi taşımaz, her zaman metin içerir */
export function AppBadge({ label, tone = "neutral", dot = false, icon, size = "md", colors: custom }: AppBadgeProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const { fg, bg } = custom ?? toneColors(colors, tone);
  return (
    <View
      style={[styles.root, size === "sm" && styles.sm, { backgroundColor: bg }]}
      accessible
      accessibilityLabel={label}
    >
      {dot ? <View style={[styles.dot, { backgroundColor: fg }]} /> : null}
      {icon ? <AppIcon name={icon} size={12} color={fg} /> : null}
      <AppText variant="caption" style={{ color: fg, fontWeight: "600" }} numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: {
      flexDirection: "row",
      alignItems: "center",
      alignSelf: "flex-start",
      gap: 6,
      paddingHorizontal: t.spacing.sm,
      paddingVertical: 3,
      borderRadius: t.radius.pill,
    },
    sm: { paddingHorizontal: 6, paddingVertical: 1 },
    dot: { width: 6, height: 6, borderRadius: 3 },
  })
);
