/**
 * Genel bakış bölümü: başlık kartın DIŞINDA (sade bölüm başlığı + isteğe bağlı sağ bağlantı), içerik
 * çerçevesiz, hafif gölgeli yüzeyde. Açık temada gölge, koyu temada ince kenarlık (gölge görünmez).
 */
import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { AppText, makeStyles, useTheme } from "@/design-system";

export function DashSection({
  title,
  subtitle,
  action,
  padded = true,
  style,
  testID,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: { label: string; onPress: () => void; testID?: string };
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  return (
    <View style={styles.section} testID={testID}>
      <View style={styles.header}>
        <View style={styles.flex}>
          <AppText variant="cardTitle" accessibilityRole="header">
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="caption" color="textTertiary">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {action ? (
          <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button" testID={action.testID}>
            <AppText variant="caption" color="primary" weight="700">
              {action.label}
            </AppText>
          </Pressable>
        ) : null}
      </View>
      <DashSurface padded={padded} style={style}>
        {children}
      </DashSurface>
    </View>
  );
}

/** Çerçevesiz, hafif gölgeli kart yüzeyi (genel bakışın ortak kartı) */
export function DashSurface({
  padded = true,
  style,
  children,
}: {
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  const { isDark } = useTheme();
  return <View style={[styles.surface, isDark ? styles.surfaceDark : styles.surfaceLight, padded && styles.padded, style]}>{children}</View>;
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    section: { gap: t.spacing.sm },
    header: { flexDirection: "row", alignItems: "flex-end", gap: t.spacing.md, paddingHorizontal: 2 },
    flex: { flex: 1, gap: 1 },
    surface: { backgroundColor: t.colors.surface, borderRadius: 16 },
    surfaceLight: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.07,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    surfaceDark: { borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border },
    padded: { padding: t.layout.cardPadding },
  })
);
