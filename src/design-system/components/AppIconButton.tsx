import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { makeStyles, useTheme } from "../theme";
import { AppIcon, type IconName } from "./AppIcon";
import { AppText } from "./AppText";

export interface AppIconButtonProps {
  icon: IconName;
  /** Ekran okuyucu etiketi — ikon butonlarda zorunlu */
  label: string;
  onPress: () => void;
  badge?: number;
  disabled?: boolean;
  tone?: "default" | "primary" | "danger" | "success";
  /** İşlem sürüyor: ikon yerine gösterge, dokunma kapalı */
  loading?: boolean;
  /** "lg": öne çıkan header aksiyonu (daha büyük ikon, aynı 44pt dokunma alanı) */
  size?: "md" | "lg";
  testID?: string;
}

/** 44x44 dokunma alanlı ikon butonu (header aksiyonları, satır menüleri) */
export function AppIconButton({ icon, label, onPress, badge, disabled, tone = "default", size = "md", loading, testID }: AppIconButtonProps) {
  const styles = useStyles();
  const { colors } = useTheme();
  const color = tone === "primary" ? "primary" : tone === "danger" ? "danger" : tone === "success" ? "success" : "text";
  const badgeText = badge && badge > 99 ? "99+" : badge ? String(badge) : null;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      accessibilityRole="button"
      accessibilityLabel={badgeText ? `${label}, ${badgeText} okunmamış` : label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      style={({ pressed }) => [styles.root, pressed && styles.pressed, disabled && styles.disabled]}
    >
      {loading ? <ActivityIndicator size="small" color={colors[color]} /> : <AppIcon name={icon} size={size === "lg" ? 28 : 20} color={color} />}
      {badgeText ? (
        // Rozet ikonun sağ üst köşesinden SAĞA doğru büyür: "99+" gibi geniş metin ikonu örtmez
        <View style={[styles.badge, size === "lg" ? styles.badgeLg : styles.badgeMd]}>
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
      minWidth: 18,
      height: 18,
      paddingHorizontal: 3,
      borderRadius: t.radius.pill,
      backgroundColor: t.colors.danger,
      alignItems: "center",
      justifyContent: "center",
      borderWidth: 1.5,
      borderColor: t.colors.surface,
    },
    // Rozet ikonun ortasından sağa büyür: "99+" ikonu örtmez, ekran kenarındaki zilde de taşmaz
    badgeLg: { top: 2, left: 20 },
    badgeMd: { top: 5, left: 20 },
    badgeText: { color: "#FFFFFF", fontSize: 10, lineHeight: 12, fontWeight: "700", letterSpacing: -0.3 },
  })
);
