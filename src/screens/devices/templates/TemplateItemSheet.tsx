/**
 * Şablon kalemi ekle/düzenle — TEK kalem objesi (§3.2):
 *  POST product-templates/{id}/items/ · PATCH|DELETE …/items/{item_id}/
 * Stok modu: `stock_sku` zorunlu (ad SKU'dan), wildcard desteklenir. Normal mod: `name` zorunlu (≤50).
 * `price` zorunlu → parseDecimal + toApiDecimal ("15.00").
 */
import React, { useState } from "react";
import { useOnOpen } from "@/components/devices/useOnOpen";
import { Pressable, StyleSheet, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import {
  AppButton,
  AppConfirmSheet,
  AppIcon,
  AppInput,
  AppNotice,
  AppSheet,
  AppSwitchRow,
  AppText,
  makeStyles,
  toast,
  useFormDirty,
} from "@/design-system";
import { templatesApi } from "@/api/templates";
import { errorMessage, type ApiError } from "@/api/client";
import { SkuPickerSheet } from "@/components/devices/SkuPickerSheet";
import { parseDecimal, toApiDecimal, toNumber } from "@/utils/number";
import type { TemplateItem, TemplateItemPayload } from "@/types/templates";

export interface TemplateItemForm {
  urunNo: string;
  wildcard: boolean;
  skuId: number | null;
  skuName: string;
  name: string;
  price: string;
  maxQuantity: string;
  quantity: string;
}

export function itemFormFrom(item: TemplateItem | null): TemplateItemForm {
  const price = toNumber(item?.price);
  return {
    urunNo: item?.urun_no != null ? String(item.urun_no) : "",
    wildcard: item?.is_wildcard ?? false,
    skuId: item?.stock_sku ?? null,
    skuName: item?.stock_sku_name ?? "",
    name: item?.name ?? "",
    price: price != null ? price.toFixed(2).replace(".", ",") : "",
    maxQuantity: item ? String(item.max_quantity) : "",
    quantity: item ? String(item.quantity) : "0",
  };
}

const intOrNull = (s: string): number | null => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : null);

/** Doğrulama + payload (saf, test edilir). stockMode null → normal mod kuralları. */
export function buildTemplateItemPayload(
  stockMode: boolean,
  f: TemplateItemForm,
  order?: number
): { payload: TemplateItemPayload | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const price = parseDecimal(f.price);
  if (price == null) errors.price = "Fiyat zorunlu.";
  else if (price < 0) errors.price = "Fiyat negatif olamaz.";
  else if (price >= 1_000_000) errors.price = "Fiyat çok yüksek.";
  const maxQ = f.maxQuantity.trim() === "" ? 0 : intOrNull(f.maxQuantity);
  if (maxQ == null) errors.max_quantity = "Tam sayı girin.";
  const qty = f.quantity.trim() === "" ? 0 : intOrNull(f.quantity);
  if (qty == null) errors.quantity = "Tam sayı girin.";
  const wildcard = stockMode && f.wildcard;
  const urunNo = wildcard ? null : f.urunNo.trim() === "" ? null : intOrNull(f.urunNo);
  if (!wildcard && f.urunNo.trim() !== "" && urunNo == null) errors.urun_no = "Tam sayı girin.";
  if (stockMode && f.skuId == null) errors.stock_sku = "SKU seçin.";
  const name = f.name.trim();
  if (!stockMode) {
    if (!name) errors.name = "Ürün adı zorunlu.";
    else if (name.length > 50) errors.name = "En fazla 50 karakter.";
  }
  if (Object.keys(errors).length) return { payload: null, errors };

  const payload: TemplateItemPayload = {
    urun_no: urunNo,
    is_wildcard: wildcard,
    price: toApiDecimal(price as number),
    max_quantity: maxQ as number,
    quantity: qty as number,
    ...(stockMode ? { stock_sku: f.skuId } : { name }),
    ...(order != null ? { order } : {}),
  };
  return { payload, errors };
}

export function TemplateItemSheet({
  visible,
  templateId,
  stockMode,
  item,
  nextOrder,
  onClose,
  onSaved,
}: {
  visible: boolean;
  templateId: number;
  stockMode: boolean;
  item: TemplateItem | null;
  nextOrder: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const styles = useStyles();
  const [form, setForm] = useState<TemplateItemForm>(() => itemFormFrom(item));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [skuOpen, setSkuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Kaydedilmemiş değişiklik: kapatırken onay iste
  const dirty = useFormDirty(visible, form);

  useOnOpen(visible, () => {
      setForm(itemFormFrom(item));
      setErrors({});
  });

  const save = useMutation({
    mutationFn: (payload: TemplateItemPayload) =>
      item ? templatesApi.updateItem(templateId, item.id, payload) : templatesApi.createItem(templateId, payload),
    onSuccess: () => {
      toast.success(item ? "Kalem güncellendi." : "Kalem eklendi.");
      onSaved();
      onClose();
    },
    onError: (e) => {
      const fe = (e as ApiError).fieldErrors;
      if (fe) setErrors(fe);
    },
  });

  const remove = useMutation({
    mutationFn: () => templatesApi.deleteItem(templateId, (item as TemplateItem).id),
    onSuccess: () => {
      toast.success("Kalem silindi.");
      setConfirmDelete(false);
      onSaved();
      onClose();
    },
  });

  const submit = () => {
    const { payload, errors: errs } = buildTemplateItemPayload(stockMode, form, item ? item.order : nextOrder);
    setErrors(errs);
    if (payload) save.mutate(payload);
  };

  const set = <K extends keyof TemplateItemForm>(k: K, v: TemplateItemForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const displayName = item ? item.stock_sku_name || item.name : "";

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      dirty={dirty}
      title={item ? "Kalemi düzenle" : "Yeni kalem"}
      subtitle={displayName || undefined}
      dismissible={!save.isPending && !remove.isPending}
      testID="template-item-sheet"
      footer={
        <>
          {item ? <AppButton title="Sil" icon="trash-2" variant="dangerOutline" onPress={() => setConfirmDelete(true)} disabled={save.isPending} /> : null}
          <AppButton title={item ? "Kaydet" : "Ekle"} onPress={submit} loading={save.isPending} style={styles.flex} testID="template-item-save" />
        </>
      }
    >
      {save.error && !(save.error as ApiError).fieldErrors ? <AppNotice tone="danger" message={errorMessage(save.error)} /> : null}
      {stockMode ? (
        <>
          <View style={styles.field}>
            <AppText variant="label" color="textSecondary">
              SKU <AppText variant="label" color="danger">*</AppText>
            </AppText>
            <Pressable
              onPress={() => setSkuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`SKU: ${form.skuName || "seçilmedi"}`}
              style={({ pressed }) => [styles.picker, errors.stock_sku && styles.pickerError, pressed && styles.pressed]}
              testID="template-item-sku"
            >
              <AppText variant="body" color={form.skuName ? "text" : "textTertiary"} numberOfLines={1} style={styles.flex}>
                {form.skuName || "SKU seçin"}
              </AppText>
              <AppIcon name="chevron-right" size={18} color="textTertiary" />
            </Pressable>
            {errors.stock_sku ? (
              <AppText variant="caption" color="danger">
                {errors.stock_sku}
              </AppText>
            ) : (
              <AppText variant="caption" color="textTertiary">
                Kalem adı SKU adından alınır.
              </AppText>
            )}
          </View>
          <AppSwitchRow
            label="Wildcard"
            description="Ürün numarasından bağımsız kalem"
            value={form.wildcard}
            onChange={(v) => set("wildcard", v)}
            testID="template-item-wildcard"
          />
        </>
      ) : (
        <AppInput label="Ürün adı" required value={form.name} onChangeText={(v) => set("name", v)} maxLength={50} error={errors.name} testID="template-item-name" />
      )}
      {!(stockMode && form.wildcard) ? (
        <AppInput
          label="Slot / ürün no"
          value={form.urunNo}
          onChangeText={(v) => set("urunNo", v.replace(/\D/g, ""))}
          keyboardType="number-pad"
          error={errors.urun_no}
          testID="template-item-urun-no"
        />
      ) : null}
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppInput
            label="Fiyat"
            required
            value={form.price}
            onChangeText={(v) => set("price", v)}
            keyboardType="decimal-pad"
            suffix="₺"
            placeholder="0,00"
            error={errors.price}
            testID="template-item-price"
          />
        </View>
        <View style={styles.flex}>
          <AppInput
            label="Kapasite"
            value={form.maxQuantity}
            onChangeText={(v) => set("maxQuantity", v.replace(/\D/g, ""))}
            keyboardType="number-pad"
            suffix="adet"
            error={errors.max_quantity}
            testID="template-item-max"
          />
        </View>
      </View>
      {!stockMode ? (
        <AppInput
          label="Başlangıç miktarı"
          value={form.quantity}
          onChangeText={(v) => set("quantity", v.replace(/\D/g, ""))}
          keyboardType="number-pad"
          suffix="adet"
          error={errors.quantity}
        />
      ) : null}

      <SkuPickerSheet visible={skuOpen} onClose={() => setSkuOpen(false)} selectedId={form.skuId} onSelect={(s) => setForm((f) => ({ ...f, skuId: s.id, skuName: s.name }))} />
      <AppConfirmSheet
        visible={confirmDelete}
        title="Kalem silinsin mi?"
        message="Kalem şablondan silinir; şablona eşli POS cihazlarından da kaldırılır."
        summary={item ? [{ label: "Kalem", value: displayName || "—" }] : undefined}
        confirmLabel="Sil"
        destructive
        irreversible
        loading={remove.isPending}
        error={remove.error ? errorMessage(remove.error) : null}
        onConfirm={() => remove.mutate()}
        onCancel={() => {
          setConfirmDelete(false);
          remove.reset();
        }}
      />
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    row: { flexDirection: "row", gap: t.spacing.md },
    field: { gap: t.spacing.xs },
    picker: {
      minHeight: t.layout.controlHeight,
      borderWidth: 1,
      borderColor: t.colors.border,
      borderRadius: t.radius.sm,
      paddingHorizontal: t.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.sm,
      backgroundColor: t.colors.surface,
    },
    pickerError: { borderColor: t.colors.danger },
    pressed: { backgroundColor: t.colors.surfacePressed },
  })
);
