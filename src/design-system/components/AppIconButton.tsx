import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { makeStyles } from "../theme";
import { AppIcon, type IconName } from "./AppIcon";
import { AppText } from "./AppText";

export interface AppIconButtonProps {
  icon: IconName;
  /** Ekran okuyucu etiketi — ikon butonlarda zorunlu */
  label: string;
  onPress: () => void;
  badge?: number;
  disabled?: boolean;
  tone?: "default" | "primary" | "danger";
  testID?: string;
}

/** 44x44 dokunma alanlı ikon butonu (header aksiyonları, satır menüleri) */
export function AppIconButton({ icon, label, onPress, badge, disabled, tone = "default", testID }: AppIconButtonProps) {
  const styles = useStyles();
  const color = tone === "primary" ? "primary" : tone === "danger" ? "danger" : "text";
  const badgeText = badge && badge > 99 ? "99+" : badge ? String(badge) : null;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={badgeText ? `${label}, ${badgeText} okunmamış` : label}
      accessibilityState={{ disabled: !!disabled }}
      style={({ pressed }) => [styles.root, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <AppIcon name={icon} size={20} color={color} />
      {badgeText ? (
        <View style={styles.badge}>
          <AppText variant="caption" style={styles.badgeText}>
            {badgeText}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: {
      width: t.layout.minTouchTarget,
      height: t.layout.minTouchTarget,
      borderRadius: t.radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    pressed: { backgroundColor: t.colors.surfacePressed },
    disabled: { opacity: 0.4 },
    badge: {
      position: "absolute",
      top: 6,
      right: 4,
      minWidth: 18,
      height: 18,
      paddingHorizontal: 4,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.danger,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 2,
      borderColor: t.colors.surface,
    },
    badgeText: { color: "#FFFFFF", fontSize: 10, lineHeight: 12, fontWeight: "700" },
  })
);
