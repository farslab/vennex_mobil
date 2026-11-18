/**
 * Slot (stok modu) / ürün (normal mod) ekleme-düzenleme.
 * - Stok modu: `{urun_no, is_wildcard, stock_sku_id, price, max_quantity}` — PATCH'te de TAM payload
 *   (backend services_pos.edit_stock_slot eksik alanları sıfırlar).
 * - Normal mod: `{urun_no, name(≤50), price, quantity, max_quantity}`.
 * Fiyat `parseDecimal` ile okunur, `toApiDecimal` ile "12.50" gönderilir.
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
import { devicesApi } from "@/api/devices";
import { errorMessage, type ApiError } from "@/api/client";
import { SkuPickerSheet } from "@/components/devices/SkuPickerSheet";
import { productDisplayName, slotLabel } from "@/components/devices/deviceHelpers";
import { parseDecimal, toApiDecimal, toNumber } from "@/utils/number";
import type { NormalProductPayload, PosProduct, ProductsMode, StockSlotPayload } from "@/types/devices";

export type FormState = SlotFormState;
export interface SlotFormState {
  urunNo: string;
  wildcard: boolean;
  skuId: number | null;
  skuName: string;
  name: string;
  price: string;
  quantity: string;
  maxQuantity: string;
}

function initialState(item: PosProduct | null): FormState {
  const price = toNumber(item?.price);
  return {
    urunNo: item?.urun_no != null ? String(item.urun_no) : "",
    wildcard: item?.is_wildcard ?? false,
    skuId: item?.stock_sku ?? null,
    skuName: item?.stock_sku_name ?? "",
    name: item?.name ?? "",
    price: price != null ? price.toFixed(2).replace(".", ",") : "",
    quantity: item ? String(item.quantity) : "0",
    maxQuantity: item ? String(item.max_quantity) : "",
  };
}

const parseIntStrict = (s: string): number | null => (/^\d+$/.test(s.trim()) ? Number(s.trim()) : null);

/** Form doğrulama + payload üretimi (test edilebilir saf fonksiyon) */
export function buildProductPayload(
  mode: ProductsMode,
  f: FormState
): { payload: StockSlotPayload | NormalProductPayload | null; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const price = parseDecimal(f.price);
  if (price == null) errors.price = "Geçerli bir fiyat girin.";
  else if (price < 0) errors.price = "Fiyat negatif olamaz.";
  const maxQ = f.maxQuantity.trim() === "" ? 0 : parseIntStrict(f.maxQuantity);
  if (maxQ == null) errors.max_quantity = "Kapasite tam sayı olmalı.";
  const urunNo = f.urunNo.trim() === "" ? null : parseIntStrict(f.urunNo);

  if (mode === "stock") {
    if (!f.wildcard && (urunNo == null || urunNo < 1)) errors.urun_no = "Ürün no 1 veya üzeri olmalı.";
    if (f.skuId == null) errors.stock_sku_id = "SKU seçin.";
    if (Object.keys(errors).length) return { payload: null, errors };
    return {
      payload: {
        urun_no: f.wildcard ? null : urunNo,
        is_wildcard: f.wildcard,
        stock_sku_id: f.skuId as number,
        price: toApiDecimal(price as number),
        max_quantity: maxQ as number,
      },
      errors,
    };
  }

  if (urunNo == null) errors.urun_no = "Ürün no girin.";
  const name = f.name.trim();
  if (!name) errors.name = "Ürün adı zorunlu.";
  else if (name.length > 50) errors.name = "En fazla 50 karakter.";
  const qty = f.quantity.trim() === "" ? 0 : parseIntStrict(f.quantity);
  if (qty == null) errors.quantity = "Miktar tam sayı olmalı.";
  if (Object.keys(errors).length) return { payload: null, errors };
  return {
    payload: {
      urun_no: urunNo as number,
      name,
      price: toApiDecimal(price as number),
      quantity: qty as number,
      max_quantity: maxQ as number,
    },
    errors,
  };
}

export function SlotFormSheet({
  visible,
  sn,
  mode,
  item,
  canDelete,
  onClose,
  onSaved,
}: {
  visible: boolean;
  sn: string;
  mode: ProductsMode;
  /** null → yeni */
  item: PosProduct | null;
  canDelete: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const styles = useStyles();
  const [form, setForm] = useState<FormState>(() => initialState(item));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [skuOpen, setSkuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Kaydedilmemiş değişiklik: kapatırken onay iste
  const dirty = useFormDirty(visible, form);

  useOnOpen(visible, () => {
      setForm(initialState(item));
      setErrors({});
  });

  const save = useMutation({
    mutationFn: (payload: StockSlotPayload | NormalProductPayload) =>
      item ? devicesApi.updateProduct(sn, item.id, payload) : devicesApi.createProduct(sn, payload),
    onSuccess: () => {
      toast.success(item ? "Kaydedildi." : mode === "stock" ? "Slot eklendi." : "Ürün eklendi.");
      onSaved();
      onClose();
    },
    onError: (e) => {
      const fe = (e as ApiError).fieldErrors;
      if (fe) setErrors(fe);
    },
  });

  const remove = useMutation({
    mutationFn: () => devicesApi.deleteProduct(sn, (item as PosProduct).id),
    onSuccess: () => {
      toast.success("Silindi.");
      setConfirmDelete(false);
      onSaved();
      onClose();
    },
  });

  const submit = () => {
    const { payload, errors: errs } = buildProductPayload(mode, form);
    setErrors(errs);
    if (payload) save.mutate(payload);
  };

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm((f) => ({ ...f, [k]: v }));
  const title = item ? `${mode === "stock" ? "Slot" : "Ürün"} ${slotLabel(item)}` : mode === "stock" ? "Yeni slot" : "Yeni ürün";

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      dirty={dirty}
      title={title}
      subtitle={item ? productDisplayName(item) : undefined}
      dismissible={!save.isPending && !remove.isPending}
      testID="slot-form"
      footer={
        <>
          {item && canDelete ? (
            <AppButton title="Sil" variant="dangerOutline" icon="trash-2" onPress={() => setConfirmDelete(true)} disabled={save.isPending} />
          ) : null}
          <AppButton title="Kaydet" onPress={submit} loading={save.isPending} style={styles.flex} testID="slot-form-save" />
        </>
      }
    >
      {save.error && !(save.error as ApiError).fieldErrors ? <AppNotice tone="danger" message={errorMessage(save.error)} /> : null}

      {mode === "stock" ? (
        <>
          <View style={styles.field}>
            <AppText variant="label" color="textSecondary">
              SKU <AppText variant="label" color="danger">*</AppText>
            </AppText>
            <Pressable
              onPress={() => setSkuOpen(true)}
              accessibilityRole="button"
              accessibilityLabel={`SKU: ${form.skuName || "seçilmedi"}`}
              style={({ pressed }) => [styles.picker, errors.stock_sku_id && styles.pickerError, pressed && styles.pressed]}
              testID="slot-sku-picker"
            >
              <AppText variant="body" color={form.skuName ? "text" : "textTertiary"} style={styles.flex} numberOfLines={1}>
                {form.skuName || "SKU seçin"}
              </AppText>
              <AppIcon name="chevron-right" size={18} color="textTertiary" />
            </Pressable>
            {errors.stock_sku_id ? (
              <AppText variant="caption" color="danger">
                {errors.stock_sku_id}
              </AppText>
            ) : null}
          </View>
          <AppSwitchRow
            label="Wildcard slot"
            description="Ürün numarasından bağımsız; cihazda yalnızca bir tane olabilir"
            value={form.wildcard}
            onChange={(v) => set("wildcard", v)}
            testID="slot-wildcard"
          />
        </>
      ) : (
        <AppInput label="Ürün adı" required value={form.name} onChangeText={(v) => set("name", v)} maxLength={50} error={errors.name} testID="slot-name" />
      )}

      {!(mode === "stock" && form.wildcard) ? (
        <AppInput
          label="Ürün no"
          required
          value={form.urunNo}
          onChangeText={(v) => set("urunNo", v.replace(/\D/g, ""))}
          keyboardType="number-pad"
          error={errors.urun_no}
          testID="slot-urun-no"
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
            testID="slot-price"
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
            testID="slot-max"
          />
        </View>
      </View>
      {mode === "normal" ? (
        <AppInput
          label="Mevcut miktar"
          value={form.quantity}
          onChangeText={(v) => set("quantity", v.replace(/\D/g, ""))}
          keyboardType="number-pad"
          suffix="adet"
          error={errors.quantity}
          testID="slot-qty"
        />
      ) : (
        <AppText variant="caption" color="textTertiary">
          Stok modunda miktar, “Toplu dolum” veya “Tümünü doldur” ile depodan aktarılarak değişir.
        </AppText>
      )}

      <SkuPickerSheet
        visible={skuOpen}
        onClose={() => setSkuOpen(false)}
        selectedId={form.skuId}
        onSelect={(sku) => setForm((f) => ({ ...f, skuId: sku.id, skuName: sku.name }))}
      />
      <AppConfirmSheet
        visible={confirmDelete}
        title="Silinsin mi?"
        message={`${item ? productDisplayName(item) : ""} cihazdan kaldırılacak. Cihaz bir şablona eşliyse eşleme kopabilir.`}
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
