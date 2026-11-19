import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppSelect, makeStyles, useTheme } from "@/design-system";
import type { ApiPeriod } from "@/types/common";
import type { OverviewLocation } from "@/types/overview";
import { PERIOD_OPTIONS, formatRangeLabel, type CustomRange } from "@/screens/dashboard/dashboardPeriod";
import { CustomRangeSheet } from "./CustomRangeSheet";
import { LocationMultiSelect } from "./LocationMultiSelect";

export interface DashboardFiltersProps {
  period: ApiPeriod;
  customRange: CustomRange | null;
  onPeriodChange: (period: Exclude<ApiPeriod, "custom">) => void;
  onCustomRange: (range: CustomRange) => void;
  /** Konum filtresi yalnız backend konum döndürürse gösterilir */
  locations: OverviewLocation[];
  /** Boş = tüm konumlar (web Genel Bakış ile aynı) */
  locationIds: number[];
  onLocationsChange: (ids: number[]) => void;
}

/** Seçim sayfası kapanmadan ikinci sayfa açılırsa iOS'ta görünmez kalabilir (AppSheet notu) */
const SHEET_HANDOFF_MS = 450;

/** Dönem ve konum açılır alanları — aynı satırda */
export function DashboardFilters({
  period,
  customRange,
  onPeriodChange,
  onCustomRange,
  locations,
  locationIds,
  onLocationsChange,
}: DashboardFiltersProps) {
  const styles = useStyles();
  const [rangeOpen, setRangeOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => (timer.current ? clearTimeout(timer.current) : undefined), []);

  const periodOptions = useMemo(
    () =>
      PERIOD_OPTIONS.map((p) => ({
        value: p.key,
        label: p.key === "custom" && period === "custom" && customRange ? formatRangeLabel(customRange) : p.label,
      })),
    [period, customRange]
  );

  const { isDark } = useTheme();
  return (
    <View style={[styles.row, isDark ? styles.rowDark : styles.rowLight]} testID="dashboard-filters">
      {/* Sıra: konum solda, dönem sağda */}
      {locations.length > 0 ? (
        <View style={styles.cell}>
          <LocationMultiSelect
            locations={locations}
            value={locationIds}
            onChange={onLocationsChange}
            testID="location-select"
            bare
          />
        </View>
      ) : null}
      {locations.length > 0 ? <View style={styles.divider} /> : null}

      <View style={styles.cell}>
        <AppSelect<ApiPeriod>
          sheetTitle="Dönem"
          options={periodOptions}
          value={period}
          searchable={false}
          onChange={(v) => {
            if (v === "custom") {
              timer.current = setTimeout(() => setRangeOpen(true), SHEET_HANDOFF_MS);
            } else {
              onPeriodChange(v as Exclude<ApiPeriod, "custom">);
            }
          }}
          testID="period-select"
          variant="bare"
          icon="calendar"
        />
      </View>

      <CustomRangeSheet
        key={rangeOpen ? "open" : "closed"}
        visible={rangeOpen}
        initial={customRange}
        onClose={() => setRangeOpen(false)}
        onApply={(range) => {
          setRangeOpen(false);
          onCustomRange(range);
        }}
      />
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    // Tek parça filtre çubuğu: konum | dönem
    row: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.colors.surface,
      borderRadius: 999,
      paddingHorizontal: 4,
    },
    rowLight: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.07,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 3 },
      elevation: 2,
    },
    rowDark: { borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border },
    cell: { flex: 1, minWidth: 0 },
    divider: { width: StyleSheet.hairlineWidth, height: 24, backgroundColor: t.colors.borderStrong },
  })
);
