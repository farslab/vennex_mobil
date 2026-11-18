import React, { useEffect, useState } from "react";
import { Animated, Pressable, StyleSheet } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { create } from "zustand";
import { makeStyles, useTheme } from "../theme";
import { AppText } from "./AppText";
import { AppIcon } from "./AppIcon";

type ToastTone = "success" | "danger" | "info";

interface ToastState {
  current: { id: number; message: string; tone: ToastTone } | null;
  show: (message: string, tone?: ToastTone) => void;
  hide: () => void;
}

let nextId = 1;

export const useToastStore = create<ToastState>((set) => ({
  current: null,
  show: (message, tone = "success") => set({ current: { id: nextId++, message, tone } }),
  hide: () => set({ current: null }),
}));

/** Bileşen dışından da çağrılabilir: toast.success("Kaydedildi") */
export const toast = {
  success: (message: string) => useToastStore.getState().show(message, "success"),
  error: (message: string) => useToastStore.getState().show(message, "danger"),
  info: (message: string) => useToastStore.getState().show(message, "info"),
};

/** Uygulama kökünde bir kez render edilir */
export function AppToastHost() {
  const current = useToastStore((s) => s.current);
  const hide = useToastStore((s) => s.hide);
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const styles = useStyles();
  const [anim] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!current) return;
    anim.setValue(0);
    Animated.timing(anim, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(hide, current.tone === "danger" ? 5000 : 3000);
    return () => clearTimeout(timer);
  }, [current, anim, hide]);

  if (!current) return null;
  const fg = current.tone === "success" ? colors.success : current.tone === "danger" ? colors.danger : colors.info;
  const icon = current.tone === "success" ? "check-circle" : current.tone === "danger" ? "alert-circle" : "info";

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        { top: insets.top + 8, opacity: anim, transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] },
      ]}
    >
      <Pressable onPress={hide} style={styles.toast} accessibilityRole="alert" accessibilityLiveRegion="assertive">
        <AppIcon name={icon} size={18} color={fg} />
        <AppText variant="calloutStrong" style={styles.text}>
          {current.message}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    wrap: { position: "absolute", left: t.layout.screenPadding, right: t.layout.screenPadding, zIndex: 1000 },
    toast: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.lg,
      paddingVertical: t.spacing.md,
      borderRadius: t.radius.md,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.colors.border,
      ...t.elevation(3),
    },
    text: { flex: 1 },
  })
);
