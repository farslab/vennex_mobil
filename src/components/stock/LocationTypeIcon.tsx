import React from "react";
import { StyleSheet, View } from "react-native";
import { AppBadge, AppIcon, makeStyles, toneColors, useTheme } from "@/design-system";
import type { StockLocationType } from "@/types/stock";
import { LOCATION_TYPE_META } from "./stockFormat";

/** Lokasyon tipi ikonu (kare zemin, tip tonu) — ekran okuyucuda tip adıyla okunur */
export function LocationTypeIcon({ type, size = 36 }: { type: StockLocationType; size?: number }) {
  const { colors } = useTheme();
  const styles = useStyles();
  const meta = LOCATION_TYPE_META[type];
  const { fg, bg } = toneColors(colors, meta.tone);
  return (
    <View
      style={[styles.box, { width: size, height: size, backgroundColor: bg }]}
      accessible
      accessibilityLabel={meta.label}
    >
      <AppIcon name={meta.icon} size={Math.round(size * 0.5)} color={fg} />
    </View>
  );
}

/** Lokasyon tipi rozeti: ikon + metin */
export function LocationTypeBadge({ type, size = "sm" }: { type: StockLocationType; size?: "sm" | "md" }) {
  const meta = LOCATION_TYPE_META[type];
  return <AppBadge label={meta.label} tone={meta.tone} icon={meta.icon} size={size} />;
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    box: { borderRadius: t.radius.sm, alignItems: "center", justifyContent: "center" },
  })
);
