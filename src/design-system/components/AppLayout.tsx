import React, { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type ScrollViewProps,
  type StyleProp,
  type ViewStyle,
  type KeyboardEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { makeStyles, useTheme } from "../theme";
import { AppText } from "./AppText";
import { AppIcon, type IconName } from "./AppIcon";

/* ------------------------------------------------------------------ Screen */

export interface AppScreenProps {
  children: React.ReactNode;
  /** Kaydırılabilir içerik (varsayılan). Liste ekranlarında false verilip FlatList kullanılır. */
  scroll?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  contentStyle?: StyleProp<ViewStyle>;
  /** Altta sabit aksiyon çubuğu */
  footer?: React.ReactNode;
  keyboardShouldPersistTaps?: ScrollViewProps["keyboardShouldPersistTaps"];
  /**
   * Sonsuz kaydırma: içeriğin sonuna `END_REACHED_THRESHOLD` kadar yaklaşınca (ya da içerik ekrana
   * sığıyorsa) çağrılır. Çağıran taraf yükleme sürerken / sayfa bitince yok saymalıdır (usePagedList.loadMore).
   */
  onEndReached?: () => void;
  testID?: string;
}

/** Sona bu kadar (pt) kala sonraki sayfa istenir */
export const END_REACHED_THRESHOLD = 400;

/**
 * iOS: klavyenin bu görünümün altıyla çakışan yüksekliği (pencere koordinatında ölçülür; üstteki
 * navigator başlığı / alttaki sekme çubuğu hesaba katılır). Android'de pencere zaten yeniden
 * boyutlanır (adjustResize) → 0.
 */
function useIosKeyboardOverlap(enabled: boolean, ref: React.RefObject<View | null>): number {
  const [overlap, setOverlap] = useState(0);
  useEffect(() => {
    if (!enabled || Platform.OS !== "ios") return;
    const animate = (e: KeyboardEvent) => {
      if (e.duration) {
        LayoutAnimation.configureNext({
          duration: e.duration,
          update: { duration: e.duration, type: LayoutAnimation.Types.keyboard },
        });
      }
    };
    const onChange = (e: KeyboardEvent) => {
      const node = ref.current;
      if (!node?.measureInWindow) return;
      node.measureInWindow((_x, y, _w, h) => {
        const next = Math.max(0, Math.round(y + h - e.endCoordinates.screenY));
        setOverlap((cur) => {
          if (cur !== next) animate(e);
          return next;
        });
      });
    };
    const onHide = (e: KeyboardEvent) => {
      setOverlap((cur) => {
        if (cur !== 0) animate(e);
        return 0;
      });
    };
    const subs = [Keyboard.addListener("keyboardWillChangeFrame", onChange), Keyboard.addListener("keyboardWillHide", onHide)];
    return () => subs.forEach((s) => s.remove());
  }, [enabled, ref]);
  return enabled ? overlap : 0;
}

/** Ekran iskeleti — header'ı navigator verir; bu bileşen zemin, padding ve pull-to-refresh sağlar */
export function AppScreen({
  children,
  scroll = true,
  refreshing = false,
  onRefresh,
  contentStyle,
  footer,
  keyboardShouldPersistTaps = "handled",
  onEndReached,
  testID,
}: AppScreenProps) {
  const { colors, layout } = useTheme();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const layoutHeight = useRef(0);
  const rootRef = useRef<View>(null);
  // Alt aksiyon çubuğu klavyenin üstünde kalsın (iOS); klavye kapalıyken ana ekran göstergesinin üstünde
  const keyboardOverlap = useIosKeyboardOverlap(!!footer, rootRef);
  return (
    <View ref={rootRef} style={[styles.root, keyboardOverlap > 0 && { paddingBottom: keyboardOverlap }]} testID={testID}>
      {scroll ? (
        <ScrollView
          testID={testID ? `${testID}-scroll` : undefined}
          contentContainerStyle={[styles.content, contentStyle]}
          keyboardShouldPersistTaps={keyboardShouldPersistTaps}
          keyboardDismissMode="on-drag"
          scrollEventThrottle={onEndReached ? 100 : undefined}
          onLayout={onEndReached ? (e) => (layoutHeight.current = e.nativeEvent.layout.height) : undefined}
          onScroll={
            onEndReached
              ? ({ nativeEvent: n }) => {
                  if (n.layoutMeasurement.height + n.contentOffset.y >= n.contentSize.height - END_REACHED_THRESHOLD) onEndReached();
                }
              : undefined
          }
          onContentSizeChange={
            onEndReached
              ? (_w, h) => {
                  // İçerik ekrana sığıyorsa kaydırma olmaz → doğrudan iste
                  if (layoutHeight.current > 0 && h <= layoutHeight.current + END_REACHED_THRESHOLD) onEndReached();
                }
              : undefined
          }
          refreshControl={
            onRefresh ? (
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
            ) : undefined
          }
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.flex, contentStyle]}>{children}</View>
      )}
      {footer ? (
        <View
          style={[styles.footer, { paddingBottom: keyboardOverlap > 0 ? layout.screenPadding : Math.max(insets.bottom, layout.screenPadding) }]}
          testID={testID ? `${testID}-footer` : undefined}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

/* ----------------------------------------------------------------- Section */

export function AppSection({
  title,
  action,
  children,
  style,
}: {
  title?: string;
  action?: { label: string; onPress: () => void };
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  return (
    <View style={[styles.section, style]}>
      {title || action ? (
        <View style={styles.sectionHeader}>
          {title ? (
            <AppText variant="overline" color="textTertiary" accessibilityRole="header">
              {title}
            </AppText>
          ) : (
            <View />
          )}
          {action ? (
            <Pressable onPress={action.onPress} hitSlop={10} accessibilityRole="button">
              <AppText variant="calloutStrong" color="primary">
                {action.label}
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

/* ---------------------------------------------------------------- List row */

export interface AppListRowProps {
  title: string;
  subtitle?: string;
  icon?: IconName;
  iconTone?: "default" | "primary" | "danger";
  /** Sağ taraf: değer metni veya özel öğe */
  value?: string;
  right?: React.ReactNode;
  onPress?: () => void;
  chevron?: boolean;
  destructive?: boolean;
  last?: boolean;
  testID?: string;
}

export function AppListRow({
  title,
  subtitle,
  icon,
  iconTone = "default",
  value,
  right,
  onPress,
  chevron = !!onPress,
  destructive,
  last,
  testID,
}: AppListRowProps) {
  const styles = useStyles();
  const body = (
    <>
      {icon ? (
        <View style={[styles.rowIcon, iconTone === "primary" && styles.rowIconPrimary, (destructive || iconTone === "danger") && styles.rowIconDanger]}>
          <AppIcon name={icon} size={18} color={destructive || iconTone === "danger" ? "danger" : iconTone === "primary" ? "primary" : "textSecondary"} />
        </View>
      ) : null}
      <View style={styles.flex}>
        <AppText variant="body" color={destructive ? "danger" : "text"} numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="caption" color="textTertiary" numberOfLines={2}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="callout" color="textSecondary" numberOfLines={1} style={styles.rowValue}>
          {value}
        </AppText>
      ) : null}
      {right}
      {chevron ? <AppIcon name="chevron-right" size={18} color="textTertiary" /> : null}
    </>
  );
  const rowStyle = [styles.row, !last && styles.rowBorder];
  if (!onPress) {
    return (
      <View style={rowStyle} testID={testID}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={[title, value, subtitle].filter(Boolean).join(", ")}
      style={({ pressed }) => [...rowStyle, pressed && styles.rowPressed]}
    >
      {body}
    </Pressable>
  );
}

/* ----------------------------------------------------------------- Divider */

export function AppDivider({ inset = 0 }: { inset?: number }) {
  const styles = useStyles();
  return <View style={[styles.divider, { marginLeft: inset }]} />;
}

/* ---------------------------------------------------------------- KPI card */

export interface AppKpiProps {
  label: string;
  value: string;
  /** Alt bilgi (ör. "128 işlem") */
  caption?: string;
  /** Önceki döneme göre değişim yüzdesi; null → gösterilmez */
  delta?: number | null;
  icon?: IconName;
  onPress?: () => void;
  testID?: string;
}

export function AppKpi({ label, value, caption, delta, icon, onPress, testID }: AppKpiProps) {
  const styles = useStyles();
  const deltaTone = delta == null ? null : delta > 0 ? "success" : delta < 0 ? "danger" : "textSecondary";
  const content = (
    <>
      <View style={styles.kpiHeader}>
        {icon ? <AppIcon name={icon} size={15} color="textTertiary" /> : null}
        <AppText variant="caption" color="textSecondary" numberOfLines={1} style={styles.flex}>
          {label}
        </AppText>
      </View>
      <AppText variant="metricMd" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7}>
        {value}
      </AppText>
      <View style={styles.kpiFooter}>
        {delta != null && deltaTone ? (
          <AppText variant="caption" color={deltaTone as "success" | "danger" | "textSecondary"} weight="600">
            {delta > 0 ? "▲" : delta < 0 ? "▼" : "•"} %{Math.abs(delta).toLocaleString("tr-TR", { maximumFractionDigits: 1 })}
          </AppText>
        ) : null}
        {caption ? (
          // Dar kartta kesilmez: değişim rozetinin yanına sığmazsa alt satıra geçer (en fazla 2 satır)
          <AppText variant="caption" color="textTertiary" numberOfLines={2} style={styles.kpiCaption} testID={testID ? `${testID}-caption` : undefined}>
            {caption}
          </AppText>
        ) : null}
      </View>
    </>
  );
  if (onPress) {
    return (
      <Pressable
        testID={testID}
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}${caption ? `, ${caption}` : ""}`}
        style={({ pressed }) => [styles.kpi, pressed && styles.rowPressed]}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View style={styles.kpi} testID={testID} accessible accessibilityLabel={`${label}: ${value}${caption ? `, ${caption}` : ""}`}>
      {content}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    content: {
      padding: t.layout.screenPadding,
      paddingBottom: t.spacing.huge,
      gap: t.layout.sectionGap,
      width: "100%",
      maxWidth: t.layout.maxContentWidth,
      alignSelf: "center",
    },
    footer: {
      flexDirection: "row",
      gap: t.spacing.md,
      padding: t.layout.screenPadding,
      backgroundColor: t.colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
    section: { gap: t.spacing.sm },
    sectionHeader: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 2,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      minHeight: 52,
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.layout.cardPadding,
    },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    rowPressed: { backgroundColor: t.colors.surfacePressed },
    rowValue: { maxWidth: "45%" },
    rowIcon: {
      width: 32,
      height: 32,
      borderRadius: t.radius.xs,
      backgroundColor: t.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    rowIconPrimary: { backgroundColor: t.colors.primarySubtle },
    rowIconDanger: { backgroundColor: t.colors.dangerSubtle },
    divider: { height: StyleSheet.hairlineWidth, backgroundColor: t.colors.border },
    kpi: {
      flex: 1,
      minWidth: 140,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.md,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.colors.border,
      padding: t.spacing.md,
      gap: t.spacing.xs,
    },
    kpiHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
    kpiFooter: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", columnGap: 6, rowGap: 2, minHeight: 16 },
    kpiCaption: { flexShrink: 1, maxWidth: "100%" },
  })
);
