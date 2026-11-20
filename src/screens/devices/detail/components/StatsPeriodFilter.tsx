/**
 * İstatistik zaman filtresi — web cihaz sayfası İstatistikler sekmesiyle aynı:
 * hızlı seçimler (Bugün · Dün · Bu Hafta · Bu Ay · Geçen Ay) ve özel tarih aralığı. Günlük saat penceresi
 * mobilde kullanılmıyor (istek üzerine kaldırıldı; her zaman tüm gün).
 */
import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppSelect, makeStyles, useTheme } from "@/design-system";
import { CustomRangeSheet } from "@/components/dashboard/CustomRangeSheet";
import { formatRangeLabel, type CustomRange } from "@/screens/dashboard/dashboardPeriod";
import { businessToday, toApiDate } from "@/utils/date";

export type StatsPreset = "today" | "yesterday" | "this_week" | "this_month" | "last_month" | "custom";

export interface StatsFilter {
  preset: StatsPreset;
  range: CustomRange;
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

/** Hızlı seçimler (web sırası) — Satışlar sekmesi de aynı listeyi kullanır */
export const STATS_PRESET_OPTIONS: { key: StatsPreset; label: string }[] = (Object.keys(PRESET_LABELS) as StatsPreset[]).map((key) => ({
  key,
  label: PRESET_LABELS[key],
}));

/**
 * Sorguda kullanılacak aralık: hızlı seçimde her çağrıda `now`dan yeniden hesaplanır (gece yarısından
 * sonra "Bugün" dünde donmaz); yalnız özel aralık saklanan değeri kullanır.
 */
export function resolveStatsRange(f: Pick<StatsFilter, "preset" | "range">, now: Date = new Date()): CustomRange {
  return f.preset === "custom" ? f.range : statsPresetRange(f.preset, now);
}

export function defaultStatsFilter(now: Date = new Date()): StatsFilter {
  return { preset: "today", range: statsPresetRange("today", now) };
}

const SHEET_HANDOFF_MS = 450;

export function StatsPeriodFilter({ value, onChange }: { value: StatsFilter; onChange: (f: StatsFilter) => void }) {
  const styles = useStyles();
  const { isDark } = useTheme();
  const [rangeOpen, setRangeOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  const options = (Object.keys(PRESET_LABELS) as StatsPreset[]).map((k) => ({
    value: k,
    label: k === "custom" && value.preset === "custom" ? formatRangeLabel(value.range) : PRESET_LABELS[k],
  }));

  return (
    // Genel Bakış ve Satışlar gibi yuvarlak beyaz çubukta dönem açılır menüsü
    <View style={[styles.row, isDark ? styles.rowDark : styles.rowLight]} testID="stats-period-filter">
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
          variant="bare"
          icon="calendar"
        />
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
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    row: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, borderRadius: 999, backgroundColor: t.colors.surface },
    rowLight: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.07,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    rowDark: { borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border },
    cell: { flex: 1, minWidth: 0 },
  })
);
