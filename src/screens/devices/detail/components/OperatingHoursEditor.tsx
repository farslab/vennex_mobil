import React from "react";
import { StyleSheet, TextInput, View } from "react-native";
import { AppButton, AppIconButton, AppSegmented, AppText, makeStyles, useTheme } from "@/design-system";
import { DAY_LABELS, OPERATING_MODE_OPTIONS, isValidHHMM, type WeekSchedule } from "@/components/devices/deviceHelpers";
import type { OperatingHoursMode } from "@/types/devices";

/** SS:DD girişini kullanıcı yazarken biçimler ("830" → "08:30" değil; yalnız rakam + iki nokta) */
function maskTime(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 4);
  return digits.length <= 2 ? digits : `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function OperatingHoursEditor({
  mode,
  week,
  disabled,
  error,
  onChange,
}: {
  mode: OperatingHoursMode;
  week: WeekSchedule;
  disabled?: boolean;
  error?: string | null;
  onChange: (mode: OperatingHoursMode, week: WeekSchedule) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();

  const setRange = (day: number, idx: number, key: "start" | "end", value: string) => {
    const next = week.map((ranges, d) => (d === day ? ranges.map((r, i) => (i === idx ? { ...r, [key]: maskTime(value) } : r)) : ranges));
    onChange(mode, next);
  };
  const addRange = (day: number) => onChange(mode, week.map((r, d) => (d === day ? [...r, { start: "", end: "" }] : r)));
  const removeRange = (day: number, idx: number) => onChange(mode, week.map((r, d) => (d === day ? r.filter((_, i) => i !== idx) : r)));

  return (
    <View style={styles.root}>
      <AppSegmented<string>
        testID="oh-mode"
        value={String(mode)}
        onChange={(k) => !disabled && onChange(Number(k) as OperatingHoursMode, week)}
        items={OPERATING_MODE_OPTIONS.map((o) => ({ key: String(o.value), label: o.label }))}
      />
      <AppText variant="caption" color="textTertiary">
        {mode === 0
          ? "POS cihazı tüm saatlerde çalışır."
          : mode === 1
            ? "POS cihazı yalnızca aşağıdaki saatlerde satış yapar."
            : "POS cihazı aşağıdaki saatlerde satış yapmaz."}
      </AppText>
      {mode !== 0
        ? week.map((ranges, day) => (
            <View key={day} style={styles.day}>
              <View style={styles.dayHead}>
                <AppText variant="calloutStrong">{DAY_LABELS[day]}</AppText>
                {!disabled ? (
                  <AppButton title="Aralık ekle" icon="plus" size="sm" variant="ghost" onPress={() => addRange(day)} />
                ) : null}
              </View>
              {ranges.length === 0 ? (
                <AppText variant="caption" color="textTertiary">
                  Aralık yok
                </AppText>
              ) : (
                ranges.map((r, idx) => (
                  <View key={idx} style={styles.range}>
                    {(["start", "end"] as const).map((k) => (
                      <TextInput
                        key={k}
                        value={r[k]}
                        editable={!disabled}
                        onChangeText={(v) => setRange(day, idx, k, v)}
                        placeholder={k === "start" ? "08:00" : "18:00"}
                        placeholderTextColor={colors.textTertiary}
                        keyboardType="number-pad"
                        maxLength={5}
                        accessibilityLabel={`${DAY_LABELS[day]} ${k === "start" ? "başlangıç" : "bitiş"} saati`}
                        style={[
                          styles.input,
                          { color: colors.text, borderColor: r[k] && !isValidHHMM(r[k]) ? colors.danger : colors.border },
                        ]}
                      />
                    ))}
                    {!disabled ? (
                      <AppIconButton icon="x" label={`${DAY_LABELS[day]} aralığını sil`} onPress={() => removeRange(day, idx)} />
                    ) : null}
                  </View>
                ))
              )}
            </View>
          ))
        : null}
      {error ? (
        <AppText variant="caption" color="danger">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { gap: t.spacing.md },
    day: { gap: t.spacing.xs, paddingVertical: t.spacing.xs, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.border },
    dayHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", minHeight: 36 },
    range: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    input: {
      flex: 1,
      minHeight: 44,
      borderWidth: 1,
      borderRadius: t.radius.sm,
      paddingHorizontal: t.spacing.md,
      fontSize: 15,
      backgroundColor: t.colors.surface,
      fontVariant: ["tabular-nums"],
    },
  })
);
