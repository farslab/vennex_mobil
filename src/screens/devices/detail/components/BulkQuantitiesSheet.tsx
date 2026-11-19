/**
 * Toplu dolum (stok modu) — `POST products/bulk-quantities/ {source_location_id?, updates:[{slot_id, quantity}]}`.
 * Backend kuralları (services_pos.bulk_save_slot_quantities): yeni miktar mevcut miktardan düşük olamaz,
 * kapasiteyi aşamaz; değişmeyen slotlar gönderilmez. Fark kaynak lokasyondan düşülür.
 */
import React, { useMemo, useState } from "react";
import { useOnOpen } from "@/components/devices/useOnOpen";
import { FlatList, StyleSheet, TextInput, View } from "react-native";
import { AppButton, AppConfirmSheet, AppSheet, AppText, makeStyles, useTheme } from "@/design-system";
import { productDisplayName, slotLabel } from "@/components/devices/deviceHelpers";
import { formatInteger } from "@/utils/number";
import type { BulkQuantityUpdate, PosProduct } from "@/types/devices";

export function validateBulk(items: PosProduct[], draft: Record<number, string>): { updates: BulkQuantityUpdate[]; errors: Record<number, string> } {
  const updates: BulkQuantityUpdate[] = [];
  const errors: Record<number, string> = {};
  for (const item of items) {
    const raw = draft[item.id];
    if (raw == null || raw.trim() === "") continue;
    if (!/^\d+$/.test(raw.trim())) {
      errors[item.id] = "Tam sayı girin";
      continue;
    }
    const q = Number(raw.trim());
    if (q === item.quantity) continue;
    if (q < item.quantity) errors[item.id] = `En az ${formatInteger(item.quantity)}`;
    else if (item.max_quantity > 0 && q > item.max_quantity) errors[item.id] = `En fazla ${formatInteger(item.max_quantity)}`;
    else updates.push({ slot_id: item.id, quantity: q });
  }
  return { updates, errors };
}

export function BulkQuantitiesSheet({
  visible,
  items,
  sourceLabel,
  loading,
  error,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  items: PosProduct[];
  sourceLabel: string;
  loading: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (updates: BulkQuantityUpdate[]) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [draft, setDraft] = useState<Record<number, string>>({});
  const [confirm, setConfirm] = useState(false);

  useOnOpen(visible, () => {
      setDraft({});
      setConfirm(false);
  });

  const { updates, errors } = useMemo(() => validateBulk(items, draft), [items, draft]);
  const hasErrors = Object.keys(errors).length > 0;
  const totalUnits = updates.reduce((sum, u) => sum + (u.quantity - (items.find((i) => i.id === u.slot_id)?.quantity ?? 0)), 0);

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title="Toplu dolum"
      subtitle={`Kaynak: ${sourceLabel}`}
      scrollable={false}
      dismissible={!loading}
      testID="bulk-sheet"
      footer={
        <>
          <AppButton title="Vazgeç" variant="outline" onPress={onClose} disabled={loading} style={styles.flex} />
          <AppButton
            title={updates.length ? `Devam (${updates.length})` : "Devam"}
            onPress={() => setConfirm(true)}
            disabled={!updates.length || hasErrors}
            style={styles.flex}
            testID="bulk-continue"
          />
        </>
      }
    >
      <AppText variant="caption" color="textTertiary">
        Yeni miktarı girin. Mevcut miktardan düşük ve kapasiteden yüksek değer girilemez.
      </AppText>
      <FlatList
        data={items}
        keyExtractor={(i) => String(i.id)}
        style={styles.list}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <View style={styles.row}>
            <AppText variant="numericSm" color="textTertiary" style={styles.slot}>
              {slotLabel(item)}
            </AppText>
            <View style={styles.flex}>
              <AppText variant="calloutStrong" numberOfLines={1}>
                {productDisplayName(item)}
              </AppText>
              <AppText variant="caption" color={errors[item.id] ? "danger" : "textTertiary"}>
                {errors[item.id] ?? `${formatInteger(item.quantity)} / ${formatInteger(item.max_quantity)}`}
              </AppText>
            </View>
            <TextInput
              value={draft[item.id] ?? ""}
              onChangeText={(t) => setDraft((d) => ({ ...d, [item.id]: t.replace(/\D/g, "") }))}
              placeholder={String(item.quantity)}
              placeholderTextColor={colors.textTertiary}
              keyboardType="number-pad"
              accessibilityLabel={`${productDisplayName(item)} yeni miktar`}
              testID={`bulk-input-${item.id}`}
              style={[styles.input, { color: colors.text, borderColor: errors[item.id] ? colors.danger : colors.border }]}
            />
          </View>
        )}
      />
      <AppConfirmSheet
        visible={confirm}
        title="Toplu dolumu onayla"
        message="Girilen miktarlar kaynak lokasyondan POS cihazına aktarılır."
        summary={[
          { label: "Kaynak", value: sourceLabel },
          { label: "Güncellenecek slot", value: formatInteger(updates.length) },
          { label: "Aktarılacak toplam", value: `${formatInteger(totalUnits)} adet` },
        ]}
        confirmLabel="Dolumu kaydet"
        loading={loading}
        error={error}
        onConfirm={() => onSubmit(updates)}
        onCancel={() => setConfirm(false)}
      />
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    list: { maxHeight: 420 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      minHeight: 56,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    slot: { width: 28, textAlign: "center" },
    input: {
      width: 76,
      minHeight: 44,
      borderWidth: 1,
      borderRadius: t.radius.sm,
      paddingHorizontal: t.spacing.sm,
      textAlign: "right",
      fontSize: 15,
      backgroundColor: t.colors.surface,
    },
  })
);
