/**
 * İstatistik zaman filtresi — web cihaz sayfası İstatistikler sekmesiyle aynı:
 * hızlı seçimler (Bugün · Dün · Bu Hafta · Bu Ay · Geçen Ay), özel tarih aralığı ve günlük saat penceresi
 * (örn. her günün 12:00–14:00 arası; başlangıç > bitiş ise gece aşırı, örn. 22:00–02:00).
 */
import React, { useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppButton, AppIcon, AppInput, AppSelect, AppSheet, AppText, makeStyles } from "@/design-system";
import { CustomRangeSheet } from "@/components/dashboard/CustomRangeSheet";
import { formatRangeLabel, type CustomRange } from "@/screens/dashboard/dashboardPeriod";
import { businessToday, toApiDate } from "@/utils/date";

export type StatsPreset = "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom";

export interface StatsFilter {
  preset: StatsPreset;
  range: CustomRange;
  /** "HH:MM"; ikisi de boşsa tüm gün */
  startTime: string;
  endTime: string;
}

const PRESET_LABELS: Record<StatsPreset, string> = {
  today: "Bugün",
  yesterday: "Dün",
  this_week: "Bu Hafta",
  this_month: "Bu Ay",
  last_month: "Geçen Ay",
  custom: "Özel aralık",
};

/** Web `quick_periods` ile aynı aralıklar (hafta pazartesi başlar) */
export function statsPresetRange(preset: Exclude<StatsPreset, "custom">, now: Date = new Date()): CustomRange {
  const today = businessToday(now);
  const d = (x: Date) => toApiDate(x);
  const shift = (days: number) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + days);
  switch (preset) {
    case "today":
      return { start: d(today), end: d(today) };
    case "yesterday":
      return { start: d(shift(-1)), end: d(shift(-1)) };
    case "this_week": {
      const weekday = (today.getDay() + 6) % 7; // pazartesi = 0
      return { start: d(shift(-weekday)), end: d(today) };
    }
    case "this_month":
      return { start: d(new Date(today.getFullYear(), today.getMonth(), 1)), end: d(today) };
    case "last_month": {
      const first = new Date(today.getFullYear(), today.getMonth() - 1, 1);
      const last = new Date(today.getFullYear(), today.getMonth(), 0);
      return { start: d(first), end: d(last) };
    }
  }
}

export function defaultStatsFilter(now: Date = new Date()): StatsFilter {
  return { preset: "today", range: statsPresetRange("today", now), startTime: "", endTime: "" };
}

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const SHEET_HANDOFF_MS = 450;

export function timeWindowLabel(f: Pick<StatsFilter, "startTime" | "endTime">): string {
  if (!f.startTime && !f.endTime) return "Tüm gün";
  return `${f.startTime || "00:00"}–${f.endTime || "23:59"}`;
}

export function StatsPeriodFilter({ value, onChange }: { value: StatsFilter; onChange: (f: StatsFilter) => void }) {
  const styles = useStyles();
  const [rangeOpen, setRangeOpen] = useState(false);
  const [timeOpen, setTimeOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  const options = (Object.keys(PRESET_LABELS) as StatsPreset[]).map((k) => ({
    value: k,
    label: k === "custom" && value.preset === "custom" ? formatRangeLabel(value.range) : PRESET_LABELS[k],
  }));

  return (
    <View style={styles.row} testID="stats-period-filter">
      <View style={styles.cell}>
        <AppSelect<StatsPreset>
          sheetTitle="Dönem"
          options={options}
          value={value.preset}
          searchable={false}
          onChange={(p) => {
            if (p === "custom") timer.current = setTimeout(() => setRangeOpen(true), SHEET_HANDOFF_MS);
            else onChange({ ...value, preset: p, range: statsPresetRange(p) });
          }}
          testID="stats-period"
        />
      </View>
      <View style={styles.cell}>
        <Pressable
          onPress={() => setTimeOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Saat aralığı: ${timeWindowLabel(value)}`}
          style={({ pressed }) => [styles.field, pressed && styles.pressed]}
          testID="stats-time"
        >
          <AppIcon name="clock" size={16} color="textTertiary" />
          <AppText variant="body" numberOfLines={1} style={styles.flex}>
            {timeWindowLabel(value)}
          </AppText>
          <AppIcon name="chevron-down" size={18} color="textTertiary" />
        </Pressable>
      </View>

      <CustomRangeSheet
        key={rangeOpen ? "open" : "closed"}
        visible={rangeOpen}
        initial={value.preset === "custom" ? value.range : null}
        onClose={() => setRangeOpen(false)}
        onApply={(range) => {
          setRangeOpen(false);
          onChange({ ...value, preset: "custom", range });
        }}
      />
      <TimeWindowSheet
        key={timeOpen ? "t-open" : "t-closed"}
        visible={timeOpen}
        value={value}
        onClose={() => setTimeOpen(false)}
        onApply={(startTime, endTime) => {
          setTimeOpen(false);
          onChange({ ...value, startTime, endTime });
        }}
      />
    </View>
  );
}

function TimeWindowSheet({
  visible,
  value,
  onClose,
  onApply,
}: {
  visible: boolean;
  value: StatsFilter;
  onClose: () => void;
  onApply: (start: string, end: string) => void;
}) {
  const styles = useStyles();
  const [start, setStart] = useState(value.startTime);
  const [end, setEnd] = useState(value.endTime);
  const [error, setError] = useState<{ start?: string; end?: string }>({});

  const apply = () => {
    const e: { start?: string; end?: string } = {};
    if (start && !TIME_RE.test(start)) e.start = "SS:DD biçiminde girin (örn. 12:00).";
    if (end && !TIME_RE.test(end)) e.end = "SS:DD biçiminde girin (örn. 14:00).";
    setError(e);
    if (e.start || e.end) return;
    onApply(start, end);
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title="Saat aralığı"
      subtitle="Seçilen tarihlerde her günün yalnız bu saatleri. Başlangıç bitişten büyükse gece aşırı (örn. 22:00–02:00)."
      footer={
        <>
          <AppButton title="Tüm gün" variant="outline" onPress={() => onApply("", "")} style={styles.flex} testID="stats-time-clear" />
          <AppButton title="Uygula" onPress={apply} style={styles.flex} testID="stats-time-apply" />
        </>
      }
    >
      <View style={styles.timeRow}>
        <View style={styles.flex}>
          <AppInput
            label="Başlangıç saati"
            placeholder="00:00"
            value={start}
            onChangeText={setStart}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            error={error.start}
            testID="stats-time-start"
          />
        </View>
        <View style={styles.flex}>
          <AppInput
            label="Bitiş saati"
            placeholder="23:59"
            value={end}
            onChangeText={setEnd}
            keyboardType="numbers-and-punctuation"
            maxLength={5}
            error={error.end}
            testID="stats-time-end"
          />
        </View>
      </View>
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    row: { flexDirection: "row", gap: t.spacing.sm },
    cell: { flex: 1, minWidth: 0 },
    flex: { flex: 1 },
    field: {
      minHeight: t.layout.controlHeight,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: t.radius.sm,
      backgroundColor: t.colors.surface,
      paddingHorizontal: t.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.sm,
    },
    pressed: { backgroundColor: t.colors.surfacePressed },
    timeRow: { flexDirection: "row", gap: t.spacing.sm },
  })
);
