import React from "react";
import { StyleSheet, View } from "react-native";
import { AppText, makeStyles } from "@/design-system";
import { EMPTY_VALUE } from "@/utils/number";

/** Etiket + seçilebilir değer satırı (uzun değerler satır kaydırır) */
export function InfoRow({ label, value, last }: { label: string; value?: string | null; last?: boolean }) {
  const styles = useStyles();
  const text = value && value.trim() ? value : EMPTY_VALUE;
  return (
    <View style={[styles.row, !last && styles.border]} accessible accessibilityLabel={`${label}: ${text}`}>
      <AppText variant="caption" color="textTertiary">
        {label}
      </AppText>
      <AppText variant="body" selectable>
        {text}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    row: { paddingHorizontal: t.layout.cardPadding, paddingVertical: t.spacing.md, gap: 2, minHeight: 52 },
    border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
  })
);
