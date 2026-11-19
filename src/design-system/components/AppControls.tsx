import React from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { makeStyles, useTheme } from "../theme";
import { AppText } from "./AppText";
import { AppIcon } from "./AppIcon";

/** Görünümü değiştirmeden 44pt dokunma hedefi (34pt + 2×5) */
const CHIP_HIT_SLOP = { top: 5, bottom: 5, left: 2, right: 2 } as const;
const PILL_HIT_SLOP = { top: 5, bottom: 5 } as const;

/* ---------------------------------------------------------------- Checkbox */

export interface AppCheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  testID?: string;
}

export function AppCheckbox({ checked, onChange, label, description, disabled, testID }: AppCheckboxProps) {
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      onPress={() => onChange(!checked)}
      disabled={disabled}
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked, disabled: !!disabled }}
      style={[styles.row, disabled && styles.disabled]}
    >
      <View style={[styles.box, checked && styles.boxOn]}>
        {checked ? <AppIcon name="check" size={14} color="onPrimary" /> : null}
      </View>
      <View style={styles.flex}>
        <AppText variant="body">{label}</AppText>
        {description ? (
          <AppText variant="caption" color="textTertiary">
            {description}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

/* ------------------------------------------------------------------ Switch */

export interface AppSwitchRowProps {
  value: boolean;
  onChange: (value: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  testID?: string;
}

export function AppSwitchRow({ value, onChange, label, description, disabled, testID }: AppSwitchRowProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={[styles.row, disabled && styles.disabled]}>
      <View style={styles.flex}>
        <AppText variant="body">{label}</AppText>
        {description ? (
          <AppText variant="caption" color="textTertiary">
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        testID={testID}
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ true: colors.primary, false: colors.borderStrong }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={colors.borderStrong}
      />
    </View>
  );
}

/* -------------------------------------------------------- Segmented / Tabs */

export interface SegmentItem<K extends string> {
  key: K;
  label: string;
  count?: number;
}

export interface AppSegmentedProps<K extends string> {
  items: SegmentItem<K>[];
  value: K;
  onChange: (key: K) => void;
  /** "pill": kompakt segment (2-4 seçenek); "tabs": kaydırılabilir alt çizgili sekmeler */
  variant?: "pill" | "tabs";
  testID?: string;
}

export function AppSegmented<K extends string>({ items, value, onChange, variant = "pill", testID }: AppSegmentedProps<K>) {
  const styles = useStyles();

  if (variant === "tabs") {
    return (
      <View style={styles.tabsWrap}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabsContent}
          accessibilityRole="tablist"
          testID={testID}
        >
          {items.map((item) => {
            const active = item.key === value;
            return (
              <Pressable
                key={item.key}
                onPress={() => onChange(item.key)}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[styles.tab, active && styles.tabActive]}
              >
                <AppText variant="calloutStrong" color={active ? "primary" : "textSecondary"}>
                  {item.label}
                  {item.count != null ? ` · ${item.count}` : ""}
                </AppText>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={styles.pillWrap} accessibilityRole="tablist" testID={testID}>
      {items.map((item) => {
        const active = item.key === value;
        return (
          <Pressable
            key={item.key}
            onPress={() => onChange(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            // 34pt görünür yükseklik + dikey hitSlop → 44pt dokunma alanı
            hitSlop={PILL_HIT_SLOP}
            style={[styles.pill, active && styles.pillActive]}
          >
            <AppText variant="calloutStrong" color={active ? "text" : "textSecondary"} numberOfLines={1}>
              {item.label}
              {item.count != null ? ` (${item.count})` : ""}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/* ------------------------------------------------------------- Filter chip */

export function AppChip({
  label,
  selected,
  onPress,
  icon,
}: {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: React.ComponentProps<typeof AppIcon>["name"];
}) {
  const styles = useStyles();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      // 34pt görünür yükseklik + dikey hitSlop → 44pt dokunma alanı
      hitSlop={CHIP_HIT_SLOP}
      style={({ pressed }) => [styles.chip, selected && styles.chipOn, pressed && styles.chipPressed]}
    >
      {icon ? <AppIcon name={icon} size={14} color={selected ? "primary" : "textSecondary"} /> : null}
      <AppText variant="calloutStrong" color={selected ? "primary" : "textSecondary"} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    row: { flexDirection: "row", alignItems: "center", gap: t.spacing.md, minHeight: t.layout.minTouchTarget },
    disabled: { opacity: 0.5 },
    box: {
      width: 22,
      height: 22,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surface,
    },
    boxOn: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },

    pillWrap: {
      flexDirection: "row",
      backgroundColor: t.colors.surfaceMuted,
      borderRadius: t.radius.sm,
      padding: 3,
      gap: 3,
    },
    pill: {
      flex: 1,
      minHeight: 34,
      alignItems: "center",
      justifyContent: "center",
      borderRadius: t.radius.xs,
      paddingHorizontal: t.spacing.sm,
    },
    pillActive: { backgroundColor: t.colors.surface, ...t.elevation(1) },

    tabsWrap: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    tabsContent: { paddingHorizontal: t.layout.screenPadding, gap: t.spacing.xl },
    tab: {
      minHeight: t.layout.minTouchTarget,
      justifyContent: "center",
      borderBottomWidth: 2,
      borderBottomColor: "transparent",
    },
    tabActive: { borderBottomColor: t.colors.primary },

    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
      minHeight: 34,
      paddingHorizontal: t.spacing.md,
      borderRadius: t.radius.pill,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    chipOn: { borderColor: t.colors.primary, backgroundColor: t.colors.primarySubtle },
    chipPressed: { backgroundColor: t.colors.surfacePressed },
  })
);
