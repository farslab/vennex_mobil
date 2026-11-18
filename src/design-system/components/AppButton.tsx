import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import { makeStyles, useTheme } from "../theme";
import { AppText } from "./AppText";
import { AppIcon, type IconName } from "./AppIcon";

export type ButtonVariant = "primary" | "secondary" | "outline" | "ghost" | "danger" | "dangerOutline";
export type ButtonSize = "md" | "sm";

export interface AppButtonProps {
  title: string;
  onPress: () => void;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: IconName;
  iconPosition?: "left" | "right";
  loading?: boolean;
  disabled?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}

/**
 * Birincil aksiyon bileşeni. `loading` sırasında buton kilitlenir —
 * çift dokunma ile çift istek gönderilmesini engeller.
 */
export function AppButton({
  title,
  onPress,
  variant = "primary",
  size = "md",
  icon,
  iconPosition = "left",
  loading = false,
  disabled = false,
  fullWidth = false,
  accessibilityHint,
  testID,
  style,
}: AppButtonProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  const inactive = disabled || loading;
  const palette = variantColors(variant, colors);

  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      hitSlop={size === "sm" ? 6 : 0}
      style={({ pressed }) => [
        styles.base,
        size === "sm" ? styles.sm : styles.md,
        fullWidth && styles.fullWidth,
        {
          backgroundColor: pressed && !inactive ? palette.pressedBg : palette.bg,
          borderColor: palette.border,
          opacity: disabled && !loading ? 0.5 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} size="small" accessibilityLabel="Yükleniyor" />
      ) : (
        <View style={styles.content}>
          {icon && iconPosition === "left" ? <AppIcon name={icon} size={size === "sm" ? 16 : 18} color={palette.fg} /> : null}
          <AppText
            variant={size === "sm" ? "calloutStrong" : "bodyStrong"}
            style={{ color: palette.fg }}
            numberOfLines={1}
          >
            {title}
          </AppText>
          {icon && iconPosition === "right" ? <AppIcon name={icon} size={size === "sm" ? 16 : 18} color={palette.fg} /> : null}
        </View>
      )}
    </Pressable>
  );
}

function variantColors(variant: ButtonVariant, c: ReturnType<typeof useTheme>["colors"]) {
  switch (variant) {
    case "primary":
      return { bg: c.primary, pressedBg: c.primaryPressed, fg: c.onPrimary, border: c.primary };
    case "secondary":
      return { bg: c.surfaceMuted, pressedBg: c.surfacePressed, fg: c.text, border: c.surfaceMuted };
    case "outline":
      return { bg: c.surface, pressedBg: c.surfacePressed, fg: c.text, border: c.borderStrong };
    case "ghost":
      return { bg: "transparent", pressedBg: c.surfacePressed, fg: c.primary, border: "transparent" };
    case "danger":
      return { bg: c.danger, pressedBg: c.dangerPressed, fg: c.textInverse, border: c.danger };
    case "dangerOutline":
      return { bg: c.surface, pressedBg: c.dangerSubtle, fg: c.danger, border: c.danger };
  }
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    base: {
      borderRadius: t.radius.sm,
      borderWidth: 1,
      alignItems: "center",
      justifyContent: "center",
      paddingHorizontal: t.spacing.lg,
    },
    md: { minHeight: t.layout.controlHeight },
    sm: { minHeight: t.layout.controlHeightSm, paddingHorizontal: t.spacing.md },
    fullWidth: { alignSelf: "stretch" },
    content: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
  })
);
