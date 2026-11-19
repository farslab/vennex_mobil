import React, { useMemo, useState } from "react";
import { FlatList, Platform, Pressable, StyleSheet, View, useWindowDimensions } from "react-native";
import { makeStyles } from "../theme";
import { AppText } from "./AppText";
import { AppIcon, type IconName } from "./AppIcon";
import { AppSheet } from "./AppSheet";
import { AppSearchField } from "./AppSearchField";
import { AppEmptyState } from "./AppStates";
import { AppButton } from "./AppButton";
import { normalizeForSearch } from "@/utils/text";

export interface SelectOption<V extends string | number> {
  value: V;
  label: string;
  description?: string;
  disabled?: boolean;
}

interface BaseProps<V extends string | number> {
  label?: string;
  placeholder?: string;
  options: SelectOption<V>[];
  error?: string | null;
  disabled?: boolean;
  required?: boolean;
  /** 8+ seçenekte arama otomatik açılır */
  searchable?: boolean;
  sheetTitle?: string;
  loading?: boolean;
  testID?: string;
  /** "bare": çerçevesiz, kompakt tetikleyici (kendi kabı içinde kullanılır, ör. filtre çubuğu) */
  variant?: "field" | "bare";
  /** Tetikleyicide soldaki simge */
  icon?: IconName;
}

interface SingleProps<V extends string | number> extends BaseProps<V> {
  multiple?: false;
  value: V | null | undefined;
  onChange: (value: V) => void;
}

interface MultiProps<V extends string | number> extends BaseProps<V> {
  multiple: true;
  value: V[];
  onChange: (value: V[]) => void;
}

export type AppSelectProps<V extends string | number> = SingleProps<V> | MultiProps<V>;

/** Tekli/çoklu seçim alanı — seçenekler alttan açılan sayfada, aranabilir */
export function AppSelect<V extends string | number>(props: AppSelectProps<V>) {
  const { label, placeholder = "Seçin", options, error, disabled, required, sheetTitle, loading, testID } = props;
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<V[]>([]);
  const searchable = props.searchable ?? options.length >= 8;
  // Liste ekran yüksekliğine göre: kısa listeler (ör. 12 ödeme türü) kaydırmadan sığar
  const { height: windowHeight } = useWindowDimensions();
  const listMaxHeight = Math.max(420, Math.round(windowHeight * 0.62));

  const filtered = useMemo(() => {
    const q = normalizeForSearch(query);
    if (!q) return options;
    return options.filter((o) => normalizeForSearch(`${o.label} ${o.description ?? ""}`).includes(q));
  }, [options, query]);

  const selectedLabel = props.multiple
    ? props.value.length === 0
      ? null
      : props.value.length === 1
        ? options.find((o) => o.value === props.value[0])?.label
        : `${props.value.length} seçili`
    : options.find((o) => o.value === props.value)?.label;

  const openSheet = () => {
    if (props.multiple) setDraft(props.value);
    setQuery("");
    setOpen(true);
  };

  const pick = (option: SelectOption<V>) => {
    if (option.disabled) return;
    if (props.multiple) {
      setDraft((d) => (d.includes(option.value) ? d.filter((v) => v !== option.value) : [...d, option.value]));
    } else {
      props.onChange(option.value);
      setOpen(false);
    }
  };

  const isSelected = (v: V) => (props.multiple ? draft.includes(v) : props.value === v);

  return (
    <View style={styles.root}>
      {label ? (
        <AppText variant="label" color="textSecondary">
          {label}
          {required ? <AppText variant="label" color="danger"> *</AppText> : null}
        </AppText>
      ) : null}
      <Pressable
        testID={testID}
        onPress={openSheet}
        disabled={disabled || loading}
        accessibilityRole="button"
        accessibilityLabel={`${label ?? placeholder}: ${selectedLabel ?? "seçilmedi"}`}
        accessibilityState={{ disabled: !!disabled, expanded: open }}
        style={({ pressed }) => [
          props.variant === "bare" ? styles.fieldBare : styles.field,
          error ? styles.fieldError : null,
          disabled ? styles.fieldDisabled : null,
          pressed ? styles.fieldPressed : null,
        ]}
      >
        {props.icon ? <AppIcon name={props.icon} size={16} color="primary" /> : null}
        <AppText
          variant={props.variant === "bare" ? "calloutStrong" : "body"}
          color={selectedLabel ? "text" : "textTertiary"}
          numberOfLines={1}
          style={styles.flex}
        >
          {loading ? "Yükleniyor…" : (selectedLabel ?? placeholder)}
        </AppText>
        <AppIcon name="chevron-down" size={18} color="textTertiary" />
      </Pressable>
      {error ? (
        <AppText variant="caption" color="danger">
          {error}
        </AppText>
      ) : null}

      <AppSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={sheetTitle ?? label ?? placeholder}
        scrollable={false}
        footer={
          props.multiple ? (
            <>
              <AppButton title="Temizle" variant="outline" onPress={() => setDraft([])} style={styles.flex} />
              <AppButton
                title={`Uygula${draft.length ? ` (${draft.length})` : ""}`}
                onPress={() => {
                  props.onChange(draft);
                  setOpen(false);
                }}
                style={styles.flex}
              />
            </>
          ) : undefined
        }
      >
        {searchable ? <AppSearchField value={query} onChangeText={setQuery} placeholder="Ara" autoFocus /> : null}
        <FlatList
          data={filtered}
          keyExtractor={(o) => String(o.value)}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
          // Üst sınır ekran yüksekliğine göre; sayfa daralırsa (klavye, küçük ekran) liste küçülür,
          // "Uygula" ve son satırlar görünür kalır
          style={[styles.list, { maxHeight: listMaxHeight }]}
          initialNumToRender={20}
          ListEmptyComponent={<AppEmptyState compact title="Sonuç yok" icon="search" />}
          renderItem={({ item }) => {
            const selected = isSelected(item.value);
            return (
              <Pressable
                onPress={() => pick(item)}
                disabled={item.disabled}
                accessibilityRole={props.multiple ? "checkbox" : "radio"}
                accessibilityState={{ checked: selected, disabled: !!item.disabled }}
                style={({ pressed }) => [styles.option, pressed && styles.fieldPressed, item.disabled && styles.optionDisabled]}
              >
                <View style={styles.flex}>
                  <AppText variant="body" weight={selected ? "600" : "400"}>
                    {item.label}
                  </AppText>
                  {item.description ? (
                    <AppText variant="caption" color="textTertiary">
                      {item.description}
                    </AppText>
                  ) : null}
                </View>
                {props.multiple ? (
                  <View style={[styles.checkbox, selected && styles.checkboxOn]}>
                    {selected ? <AppIcon name="check" size={14} color="onPrimary" /> : null}
                  </View>
                ) : selected ? (
                  <AppIcon name="check" size={18} color="primary" />
                ) : null}
              </Pressable>
            );
          }}
        />
      </AppSheet>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { gap: t.spacing.xs },
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
    fieldError: { borderColor: t.colors.danger },
    fieldDisabled: { backgroundColor: t.colors.surfaceMuted, opacity: 0.7 },
    fieldPressed: { backgroundColor: t.colors.surfacePressed },
    list: { maxHeight: 420, flexShrink: 1 },
    option: {
      minHeight: t.layout.minTouchTarget,
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      paddingVertical: t.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    optionDisabled: { opacity: 0.45 },
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
