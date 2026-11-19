/**
 * Alt çubuğun ortasındaki öne çıkan "Genel Bakış" düğmesi: çubuğun üstüne taşan
 * büyük yuvarlak, altında etiket. Diğer sekmelerle aynı gezinme (onPress/erişilebilirlik
 * React Navigation'dan gelir); seçiliyken halka ile vurgulanır.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import type { BottomTabBarButtonProps } from "@react-navigation/bottom-tabs";
import { AppIcon, makeStyles, useTheme, type IconName } from "@/design-system";

const SIZE = 58;
const LIFT = 22;

export function CenterTabButton({
  icon,
  label,
  onPress,
  onLongPress,
  accessibilityState,
  accessibilityLabel,
  "aria-selected": ariaSelected,
  "aria-label": ariaLabel,
  testID,
}: BottomTabBarButtonProps & { icon: IconName; label: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  // React Navigation 7 seçili durumu `aria-selected` ile verir
  const selected = !!(ariaSelected ?? accessibilityState?.selected);
  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="tab"
      accessibilityState={{ ...accessibilityState, selected }}
      accessibilityLabel={ariaLabel ?? accessibilityLabel ?? label}
      testID={testID ?? "tab-center"}
      style={styles.slot}
      hitSlop={{ top: LIFT }}
    >
      {({ pressed }) => (
        <>
          <View style={[styles.ring, selected && styles.ringSelected]}>
            <View style={[styles.circle, pressed && styles.pressed]}>
              <AppIcon name={icon} size={26} color={colors.onPrimary} />
            </View>
          </View>
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={[styles.label, { color: selected ? colors.primary : colors.textTertiary }]}
          >
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    slot: { flex: 1, alignItems: "center", justifyContent: "flex-end", paddingBottom: 4 },
    ring: {
      width: SIZE + 8,
      height: SIZE + 8,
      borderRadius: (SIZE + 8) / 2,
      marginTop: -LIFT,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
    ringSelected: { borderColor: t.colors.primary, borderWidth: 2 },
    circle: {
      width: SIZE,
      height: SIZE,
      borderRadius: SIZE / 2,
      backgroundColor: t.colors.primary,
      alignItems: "center",
      justifyContent: "center",
      ...t.elevation(2),
    },
    pressed: { opacity: 0.85, transform: [{ scale: 0.96 }] },
    label: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  })
);
