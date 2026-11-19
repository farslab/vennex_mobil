import React, { useEffect, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppSelect, makeStyles } from "@/design-system";
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

  return (
    <View style={styles.row} testID="dashboard-filters">
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
        />
      </View>

      {locations.length > 0 ? (
        <View style={styles.cell}>
          <LocationMultiSelect
            locations={locations}
            value={locationIds}
            onChange={onLocationsChange}
            testID="location-select"
          />
        </View>
      ) : null}

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
    row: { flexDirection: "row", gap: t.spacing.sm },
    cell: { flex: 1, minWidth: 0 },
  })
);
