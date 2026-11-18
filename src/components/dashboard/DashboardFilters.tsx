import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { AppChip, AppSelect, makeStyles } from "@/design-system";
import type { ApiPeriod } from "@/types/common";
import type { OverviewLocation } from "@/types/overview";
import { PERIOD_OPTIONS, formatRangeLabel, type CustomRange } from "@/screens/dashboard/dashboardPeriod";
import { CustomRangeSheet } from "./CustomRangeSheet";

export interface DashboardFiltersProps {
  period: ApiPeriod;
  customRange: CustomRange | null;
  onPeriodChange: (period: Exclude<ApiPeriod, "custom">) => void;
  onCustomRange: (range: CustomRange) => void;
  /** Konum filtresi yalnız backend konum döndürürse gösterilir */
  locations: OverviewLocation[];
  locationId: number | null;
  onLocationChange: (id: number | null) => void;
}

const ALL_LOCATIONS = "all";

/** Dönem çipleri (yatay kaydırma) + opsiyonel konum seçimi */
export function DashboardFilters({
  period,
  customRange,
  onPeriodChange,
  onCustomRange,
  locations,
  locationId,
  onLocationChange,
}: DashboardFiltersProps) {
  const styles = useStyles();
  const [rangeOpen, setRangeOpen] = useState(false);

  const locationOptions = useMemo(
    () => [
      { value: ALL_LOCATIONS, label: "Tüm konumlar" },
      ...locations.map((l) => ({
        value: String(l.id),
        label: l.name,
        description: l.region_name ?? undefined,
      })),
    ],
    [locations]
  );

  return (
    <View style={styles.root}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipScroll}
        accessibilityRole="tablist"
        testID="period-chips"
      >
        {PERIOD_OPTIONS.map((p) => {
          const isCustom = p.key === "custom";
          const selected = period === p.key;
          const label = isCustom && selected && customRange ? formatRangeLabel(customRange) : p.label;
          return (
            <AppChip
              key={p.key}
              label={label}
              icon={isCustom ? "calendar" : undefined}
              selected={selected}
              onPress={() => (isCustom ? setRangeOpen(true) : onPeriodChange(p.key as Exclude<ApiPeriod, "custom">))}
            />
          );
        })}
      </ScrollView>

      {locations.length > 0 ? (
        <AppSelect<string>
          placeholder="Tüm konumlar"
          sheetTitle="Konum"
          options={locationOptions}
          value={locationId == null ? ALL_LOCATIONS : String(locationId)}
          onChange={(v) => onLocationChange(v === ALL_LOCATIONS ? null : Number(v))}
          testID="location-select"
        />
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
    root: { gap: t.spacing.md },
    // Çipler ekran kenarına kadar kaysın
    chipScroll: { marginHorizontal: -t.layout.screenPadding },
    chips: { gap: t.spacing.sm, paddingHorizontal: t.layout.screenPadding },
  })
);
