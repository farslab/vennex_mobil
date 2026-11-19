import React from "react";
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { makeStyles } from "../theme";
import { AppText } from "./AppText";

export interface AppCardProps {
  children: React.ReactNode;
  title?: string;
  /** Başlığın sağındaki aksiyon/öğe */
  headerRight?: React.ReactNode;
  subtitle?: string;
  onPress?: () => void;
  padded?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
  testID?: string;
}

/** Düz, ince kenarlıklı kurumsal kart yüzeyi */
export function AppCard({
  children,
  title,
  subtitle,
  headerRight,
  onPress,
  padded = true,
  style,
  accessibilityLabel,
  testID,
}: AppCardProps) {
  const styles = useStyles();
  const header =
    title || headerRight ? (
      <View style={[styles.header, !padded && styles.headerUnpadded]}>
        <View style={styles.headerText}>
          {title ? (
            <AppText variant="cardTitle" accessibilityRole="header">
              {title}
            </AppText>
          ) : null}
          {subtitle ? (
            <AppText variant="caption" color="textTertiary">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        {headerRight}
      </View>
    ) : null;

  const content = (
    <>
      {header}
      {children}
    </>
  );

  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel ?? title}
        style={({ pressed }) => [styles.card, padded && styles.padded, pressed && styles.pressed, style]}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={[styles.card, padded && styles.padded, style]}>
      {content}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.md,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.colors.border,
      overflow: "hidden",
    },
    padded: { padding: t.layout.cardPadding },
    pressed: { backgroundColor: t.colors.surfacePressed },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: t.spacing.md,
      marginBottom: t.spacing.md,
    },
    headerUnpadded: { paddingHorizontal: t.layout.cardPadding, paddingTop: t.layout.cardPadding },
    headerText: { flex: 1, gap: 2 },
  })
);
