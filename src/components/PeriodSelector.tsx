import React from "react";
import { ScrollView, Pressable, Text, StyleSheet } from "react-native";
import { useAppTheme } from "@/theme/colors";
import { radius, spacing } from "@/theme/spacing";
import { ApiPeriod, PERIOD_LABELS } from "@/types/common";

const SELECTABLE: ApiPeriod[] = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "last_30",
];

export function PeriodSelector({
  value,
  onChange,
}: {
  value: ApiPeriod;
  onChange: (p: ApiPeriod) => void;
}) {
  const { colors, isDark } = useAppTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {SELECTABLE.map((p) => {
        const active = p === value;
        return (
          <Pressable
            key={p}
            onPress={() => onChange(p)}
            style={[
              styles.chip,
              {
                backgroundColor: active
                  ? colors.primary
                  : isDark
                  ? colors.surface
                  : "#FFFFFF",
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
          >
            <Text
              style={[
                styles.chipText,
                {
                  color: active
                    ? "#FFFFFF"
                    : isDark
                    ? colors.textSecondary
                    : colors.textPrimary,
                  fontWeight: active ? "700" : "500",
                },
              ]}
            >
              {PERIOD_LABELS[p]}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: {
    gap: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  chipText: {
    fontSize: 13,
  },
});