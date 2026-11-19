import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppButton, AppIcon, AppSheet, AppText, makeStyles } from "@/design-system";
import type { OverviewLocation } from "@/types/overview";

export interface LocationGroup {
  key: string;
  name: string;
  locations: OverviewLocation[];
}

const NO_REGION = "Bölgesiz";

/** Web Genel Bakış ile aynı gruplama: bölge adına göre, sıra korunur (backend region→name sıralı) */
export function groupLocations(locations: OverviewLocation[]): LocationGroup[] {
  const groups: LocationGroup[] = [];
  const index = new Map<string, LocationGroup>();
  for (const loc of locations) {
    const key = loc.region_id != null ? `r${loc.region_id}` : "none";
    let g = index.get(key);
    if (!g) {
      g = { key, name: loc.region_name || NO_REGION, locations: [] };
      index.set(key, g);
      groups.push(g);
    }
    g.locations.push(loc);
  }
  return groups;
}

/** Alan etiketi: hiçbiri → Tüm konumlar · tek konum → adı · tam bir bölge → bölge adı · diğer → "N konum" */
export function locationSummary(groups: LocationGroup[], selected: number[]): string {
  if (selected.length === 0) return "Tüm konumlar";
  const set = new Set(selected);
  if (selected.length === 1) {
    for (const g of groups) {
      const loc = g.locations.find((l) => l.id === selected[0]);
      if (loc) return loc.name;
    }
  }
  const full = groups.filter((g) => g.locations.every((l) => set.has(l.id)));
  const covered = full.reduce((n, g) => n + g.locations.length, 0);
  if (full.length === 1 && covered === selected.length) return full[0].name;
  return `${selected.length} konum`;
}

export interface LocationMultiSelectProps {
  locations: OverviewLocation[];
  value: number[];
  onChange: (ids: number[]) => void;
  testID?: string;
  /** Çerçevesiz, kompakt tetikleyici (filtre çubuğu içinde) */
  bare?: boolean;
}

/**
 * Konum filtresi — web Genel Bakış'taki gibi çoktan seçmeli ve bölge gruplu:
 * bölge satırı o bölgenin tüm konumlarını seçer/kaldırır; boş seçim = tüm konumlar.
 * Seçim "Uygula" ile gönderilir (her dokunuşta istek atılmaz).
 */
export function LocationMultiSelect({ locations, value, onChange, testID, bare }: LocationMultiSelectProps) {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<number[]>(value);
  const groups = useMemo(() => groupLocations(locations), [locations]);
  const label = locationSummary(groups, value);

  const toggle = (id: number) => setDraft((d) => (d.includes(id) ? d.filter((x) => x !== id) : [...d, id]));
  const toggleGroup = (g: LocationGroup) => {
    const ids = g.locations.map((l) => l.id);
    setDraft((d) => (ids.every((id) => d.includes(id)) ? d.filter((id) => !ids.includes(id)) : [...d, ...ids.filter((id) => !d.includes(id))]));
  };

  return (
    <>
      <Pressable
        testID={testID}
        onPress={() => {
          setDraft(value);
          setOpen(true);
        }}
        accessibilityRole="button"
        accessibilityLabel={`Konum: ${label}`}
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [bare ? styles.fieldBare : styles.field, pressed && styles.pressed]}
      >
        <AppIcon name="map-pin" size={16} color={bare ? "primary" : "textTertiary"} />
        <AppText variant={bare ? "calloutStrong" : "body"} numberOfLines={1} style={styles.flex}>
          {label}
        </AppText>
        <AppIcon name="chevron-down" size={18} color="textTertiary" />
      </Pressable>

      <AppSheet
        visible={open}
        onClose={() => setOpen(false)}
        title="Konum"
        subtitle="Bölge seçmek o bölgedeki tüm konumları seçer."
        scrollable={false}
        footer={
          <>
            <AppButton
              title="Temizle"
              variant="outline"
              onPress={() => {
                onChange([]);
                setOpen(false);
              }}
              style={styles.flex}
              testID="location-clear"
            />
            <AppButton
              title={draft.length ? `Uygula (${draft.length})` : "Uygula"}
              onPress={() => {
                onChange(draft);
                setOpen(false);
              }}
              style={styles.flex}
              testID="location-apply"
            />
          </>
        }
      >
        <ScrollView style={styles.list} keyboardShouldPersistTaps="handled">
          {groups.map((g, gi) => {
            const count = g.locations.filter((l) => draft.includes(l.id)).length;
            const state = count === 0 ? "off" : count === g.locations.length ? "on" : "partial";
            return (
              <View key={g.key} style={gi > 0 ? styles.groupBorder : undefined}>
                <Pressable
                  onPress={() => toggleGroup(g)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: state === "on" ? true : state === "partial" ? "mixed" : false }}
                  accessibilityLabel={`${g.name} bölgesi`}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  testID={`region-${g.key}`}
                >
                  <Check state={state} />
                  <AppText variant="bodyStrong" style={styles.flex}>
                    {g.name}
                  </AppText>
                  <AppText variant="caption" color="textTertiary">
                    {g.locations.length}
                  </AppText>
                </Pressable>
                {g.locations.map((loc) => {
                  const on = draft.includes(loc.id);
                  return (
                    <Pressable
                      key={loc.id}
                      onPress={() => toggle(loc.id)}
                      accessibilityRole="checkbox"
                      accessibilityState={{ checked: on }}
                      accessibilityLabel={loc.name}
                      style={({ pressed }) => [styles.row, styles.child, pressed && styles.pressed]}
                      testID={`location-${loc.id}`}
                    >
                      <Check state={on ? "on" : "off"} />
                      <AppText variant="body" style={styles.flex}>
                        {loc.name}
                      </AppText>
                    </Pressable>
                  );
                })}
              </View>
            );
          })}
        </ScrollView>
      </AppSheet>
    </>
  );
}

function Check({ state }: { state: "on" | "off" | "partial" }) {
  const styles = useStyles();
  return (
    <View style={[styles.checkbox, state !== "off" && styles.checkboxOn]}>
      {state === "on" ? <AppIcon name="check" size={14} color="onPrimary" /> : null}
      {state === "partial" ? <AppIcon name="minus" size={14} color="onPrimary" /> : null}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
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
    fieldBare: {
      minHeight: 44,
      paddingHorizontal: t.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.sm,
      borderRadius: 999,
    },
    pressed: { backgroundColor: t.colors.surfacePressed },
    list: { maxHeight: 440 },
    groupBorder: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.border },
    row: {
      minHeight: t.layout.minTouchTarget,
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      paddingVertical: t.spacing.sm,
    },
    child: { paddingLeft: t.spacing.xl },
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 5,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxOn: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
  })
);
