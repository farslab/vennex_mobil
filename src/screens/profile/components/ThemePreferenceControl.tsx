import React from "react";
import { StyleSheet, View } from "react-native";
import { AppSegmented, AppText, makeStyles, useThemePreference, type ThemePreference } from "@/design-system";

const ITEMS: { key: ThemePreference; label: string }[] = [
  { key: "system", label: "Sistem" },
  { key: "light", label: "Açık" },
  { key: "dark", label: "Koyu" },
];

/** Tema tercihi — seçim AsyncStorage'a yazılır, tüm ekranlar anında yeniden çizilir */
export function ThemePreferenceControl() {
  const styles = useStyles();
  const preference = useThemePreference((s) => s.preference);
  const setPreference = useThemePreference((s) => s.setPreference);
  return (
    <View style={styles.root}>
      <View style={styles.text}>
        <AppText variant="body">Tema</AppText>
        <AppText variant="caption" color="textTertiary">
          {preference === "system" ? "Cihazınızın açık/koyu ayarını izler" : "Cihaz ayarından bağımsız"}
        </AppText>
      </View>
      <AppSegmented items={ITEMS} value={preference} onChange={setPreference} testID="theme-segmented" />
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { gap: t.spacing.md },
    text: { gap: 2 },
  })
);
