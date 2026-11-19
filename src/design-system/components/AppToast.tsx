import React, { useEffect, useState } from "react";
import { AccessibilityInfo, Animated, Platform, Pressable, StyleSheet } from "react-native";
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
  show: (message, tone = "success") => {
    set({ current: { id: nextId++, message, tone } });
    // iOS VoiceOver canlı bölgeyi (accessibilityLiveRegion) desteklemez → açıkça duyur
    if (Platform.OS === "ios") AccessibilityInfo.announceForAccessibility(message);
  },
  hide: () => set({ current: null }),
}));

/**
 * Toast'ı gösterecek konak yığını. RN `Modal` ayrı bir pencerede çizilir; kökteki konak açık bir
 * alttan sayfanın (AppSheet) altında kalır. Bu yüzden açık her sayfa kendi Modal'ının içinde bir
 * konak kaydeder; toast en üstteki (en son açılan) konakta, hiç sayfa yoksa kökte çizilir.
 */
interface ToastHostState {
  hosts: number[];
  register: (id: number) => void;
  unregister: (id: number) => void;
}

export const ROOT_TOAST_HOST = 0;

export const useToastHostStore = create<ToastHostState>((set) => ({
  hosts: [],
  register: (id) => set((s) => (s.hosts.includes(id) ? s : { hosts: [...s.hosts, id] })),
  unregister: (id) => set((s) => (s.hosts.includes(id) ? { hosts: s.hosts.filter((h) => h !== id) } : s)),
}));

/** Bileşen dışından da çağrılabilir: toast.success("Kaydedildi") */
export const toast = {
  success: (message: string) => useToastStore.getState().show(message, "success"),
  error: (message: string) => useToastStore.getState().show(message, "danger"),
  info: (message: string) => useToastStore.getState().show(message, "info"),
};

/**
 * Uygulama kökünde bir kez render edilir (`hostId` verilmeden). AppSheet kendi Modal'ında
 * `hostId` ile render eder; yalnız en üstteki konak toast'ı çizer.
 */
export function AppToastHost({ hostId = ROOT_TOAST_HOST }: { hostId?: number } = {}) {
  const isTopHost = useToastHostStore((s) => (s.hosts.length ? s.hosts[s.hosts.length - 1] : ROOT_TOAST_HOST) === hostId);
  const storeCurrent = useToastStore((s) => s.current);
  const current = isTopHost ? storeCurrent : null;
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
