import React from "react";
import { StyleSheet, View } from "react-native";
import { AppText, makeStyles } from "@/design-system";

export interface StatItem {
  label: string;
  value: string;
  tone?: "text" | "warning" | "danger";
}

/** Dar ekranda (375pt) tek satıra sığan kompakt sayı şeridi */
export function StatStrip({ items }: { items: StatItem[] }) {
  const styles = useStyles();
  return (
    <View style={styles.root}>
      {items.map((it, i) => (
        <View
          key={it.label}
          style={[styles.cell, i > 0 && styles.divider]}
          accessible
          accessibilityLabel={`${it.label}: ${it.value}`}
        >
          <AppText variant="caption" color="textSecondary" numberOfLines={1}>
            {it.label}
          </AppText>
          <AppText variant="metricMd" color={it.tone ?? "text"} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
            {it.value}
          </AppText>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: {
      flexDirection: "row",
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.md,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.colors.border,
    },
    cell: { flex: 1, paddingVertical: t.spacing.sm, paddingHorizontal: t.spacing.md, gap: 2 },
    divider: { borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: t.colors.border },
  })
);
