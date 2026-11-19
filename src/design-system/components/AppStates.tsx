import React, { useEffect, useState } from "react";
import { ActivityIndicator, Animated, StyleSheet, View, type DimensionValue, type StyleProp, type ViewStyle } from "react-native";
import { makeStyles, useTheme } from "../theme";
import { AppText } from "./AppText";
import { AppIcon, type IconName } from "./AppIcon";
import { AppButton } from "./AppButton";

/** Tam alan yükleniyor durumu (yalnızca ilk yüklemede; yenilemede içerik korunur) */
export function AppLoading({ label = "Yükleniyor…" }: { label?: string }) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.center} accessibilityRole="progressbar" accessibilityLabel={label}>
      <ActivityIndicator color={colors.primary} />
      <AppText variant="callout" color="textSecondary">
        {label}
      </AppText>
    </View>
  );
}

export interface AppEmptyStateProps {
  title: string;
  description?: string;
  icon?: IconName;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

export function AppEmptyState({ title, description, icon = "inbox", actionLabel, onAction, compact }: AppEmptyStateProps) {
  const styles = useStyles();
  return (
    <View style={[styles.center, compact && styles.compact]}>
      {/* Yalnız metinler tek öğe olarak okunur; aksiyon düğmesi VoiceOver/TalkBack'te ayrıca erişilebilir kalır */}
      <View style={styles.emptyText} accessible accessibilityLabel={description ? `${title}. ${description}` : title}>
        <View style={styles.iconWrap}>
          <AppIcon name={icon} size={22} color="textTertiary" />
        </View>
        <AppText variant="cardTitle" align="center">
          {title}
        </AppText>
        {description ? (
          <AppText variant="callout" color="textSecondary" align="center" style={styles.description}>
            {description}
          </AppText>
        ) : null}
      </View>
      {actionLabel && onAction ? <AppButton title={actionLabel} onPress={onAction} variant="outline" size="sm" /> : null}
    </View>
  );
}

export interface AppErrorStateProps {
  message: string;
  title?: string;
  onRetry?: () => void;
  retrying?: boolean;
  compact?: boolean;
}

export function AppErrorState({ title = "Bir sorun oluştu", message, onRetry, retrying, compact }: AppErrorStateProps) {
  const styles = useStyles();
  return (
    <View style={[styles.center, compact && styles.compact]} accessibilityLiveRegion="polite">
      <View style={[styles.iconWrap, styles.iconDanger]}>
        <AppIcon name="alert-triangle" size={22} color="danger" />
      </View>
      <AppText variant="cardTitle" align="center">
        {title}
      </AppText>
      <AppText variant="callout" color="textSecondary" align="center" style={styles.description}>
        {message}
      </AppText>
      {onRetry ? (
        <AppButton title="Tekrar dene" icon="refresh-cw" onPress={onRetry} loading={retrying} variant="outline" size="sm" />
      ) : null}
    </View>
  );
}

/** Satır içi uyarı/bilgi kutusu (ör. "Bu özellik henüz desteklenmiyor") */
export function AppNotice({
  tone = "info",
  title,
  message,
}: {
  tone?: "info" | "warning" | "danger" | "success";
  title?: string;
  message: string;
}) {
  const { colors } = useTheme();
  const styles = useStyles();
  const map = {
    info: { fg: colors.info, bg: colors.infoSubtle, icon: "info" as const },
    warning: { fg: colors.warning, bg: colors.warningSubtle, icon: "alert-circle" as const },
    danger: { fg: colors.danger, bg: colors.dangerSubtle, icon: "alert-octagon" as const },
    success: { fg: colors.success, bg: colors.successSubtle, icon: "check-circle" as const },
  }[tone];
  return (
    <View style={[styles.notice, { backgroundColor: map.bg }]} accessibilityRole="alert">
      <AppIcon name={map.icon} size={18} color={map.fg} />
      <View style={styles.noticeBody}>
        {title ? <AppText variant="calloutStrong" style={{ color: map.fg }}>{title}</AppText> : null}
        <AppText variant="callout" color="textSecondary">
          {message}
        </AppText>
      </View>
    </View>
  );
}

/** İskelet yükleme bloğu */
export function AppSkeleton({
  width = "100%",
  height = 14,
  radius = 6,
  style,
}: {
  width?: DimensionValue;
  height?: number;
  radius?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const { colors } = useTheme();
  const [opacity] = useState(() => new Animated.Value(0.55));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.55, duration: 700, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={[{ width, height, borderRadius: radius, backgroundColor: colors.surfacePressed, opacity }, style]}
    />
  );
}

/** Liste için hazır iskelet satırları */
export function AppListSkeleton({ rows = 5 }: { rows?: number }) {
  const styles = useStyles();
  return (
    <View style={styles.skeletonList} accessibilityRole="progressbar" accessibilityLabel="Yükleniyor">
      {Array.from({ length: rows }).map((_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <AppSkeleton width={36} height={36} radius={18} />
          <View style={styles.skeletonText}>
            <AppSkeleton width="60%" />
            <AppSkeleton width="35%" height={11} />
          </View>
          <AppSkeleton width={56} height={14} />
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    center: { flex: 1, alignItems: "center", justifyContent: "center", padding: t.spacing.xxl, gap: t.spacing.sm },
    compact: { flex: 0, paddingVertical: t.spacing.xxl },
    emptyText: { alignItems: "center", gap: t.spacing.sm },
    iconWrap: {
      width: 48,
      height: 48,
      borderRadius: 24,
      backgroundColor: t.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
      marginBottom: t.spacing.xs,
    },
    iconDanger: { backgroundColor: t.colors.dangerSubtle },
    description: { maxWidth: 320, marginBottom: t.spacing.sm },
    notice: { flexDirection: "row", gap: t.spacing.md, padding: t.spacing.md, borderRadius: t.radius.sm },
    noticeBody: { flex: 1, gap: 2 },
    skeletonList: { padding: t.layout.screenPadding, gap: t.spacing.lg },
    skeletonRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.md },
    skeletonText: { flex: 1, gap: t.spacing.sm },
  })
);
