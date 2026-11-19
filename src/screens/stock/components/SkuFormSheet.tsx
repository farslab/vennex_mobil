import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  AppButton,
  AppConfirmSheet,
  AppInput,
  AppNotice,
  AppSelect,
  AppSheet,
  AppText,
  makeStyles,
  toast,
  useFormDirty,
  useGuardedClose,
} from "@/design-system";
import { stockApi } from "@/api/stock";
import { errorMessage, type ApiError } from "@/api/client";
import { formatCurrency, parseDecimal, toApiDecimal, toNumber } from "@/utils/number";
import {
  BASE_UNIT_LABELS,
  SKU_KIND_LABELS,
  type StockBaseUnit,
  type StockSku,
  type StockSkuKind,
  type StockSkuWritePayload,
} from "@/types/stock";
import { useStockMutation } from "../hooks/useStockData";
import { useOpenSession } from "../hooks/useOpenSession";

export interface SkuFormSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Verilirse düzenleme modu */
  sku?: StockSku | null;
}

export interface SkuFormState {
  name: string;
  sku_code: string;
  barcode: string;
  kind: StockSkuKind;
  base_unit: StockBaseUnit;
  package_size: string;
  package_label: string;
  unit_cost: string;
  sale_price: string;
  vat_rate: string;
}

const VAT_PRESETS = ["0", "1", "10", "20"];

/** Backend ondalık string'ini ("25.00") Türkçe girişe ("25,00") çevirir */
function toInputDecimal(value: unknown, digits: number): string {
  const n = toNumber(value);
  if (n == null) return "";
  return n.toFixed(digits).replace(".", ",");
}

function trimZeros(value: unknown): string {
  const n = toNumber(value);
  if (n == null) return "";
  return String(n).replace(".", ",");
}

function initialState(sku?: StockSku | null): SkuFormState {
  return {
    name: sku?.name ?? "",
    sku_code: sku?.sku_code ?? "",
    barcode: sku?.barcode ?? "",
    kind: sku?.kind ?? "simple",
    base_unit: sku?.base_unit ?? "piece",
    package_size: sku ? trimZeros(sku.package_size ?? 1) : "1",
    package_label: sku?.package_label ?? "",
    unit_cost: sku ? toInputDecimal(sku.unit_cost ?? 0, 2) : "",
    sale_price: sku ? toInputDecimal(sku.sale_price ?? 0, 2) : "",
    vat_rate: sku ? trimZeros(sku.vat_rate ?? 20) : "20",
  };
}

type Errors = Partial<Record<keyof SkuFormState, string>>;

/**
 * Formu doğrular ve backend gövdesine çevirir (SKUWriteSerializer, serializers/stock.py:40-71).
 * Model kuralları (api/models.py StockSKU.clean): satılabilir türler adet; bileşenin satış fiyatı 0;
 * reçeteli ürünün alış fiyatı 0 (bileşenlerden hesaplanır). Mobil API clean() çağırmadığı için
 * istemci bu kuralları gönderimde uygular.
 */
export function buildSkuPayload(form: SkuFormState): { payload: StockSkuWritePayload | null; errors: Errors } {
  const errors: Errors = {};
  const name = form.name.trim();
  const code = form.sku_code.trim();
  if (!name) errors.name = "Ürün adı gerekli.";
  else if (name.length > 100) errors.name = "En fazla 100 karakter.";
  if (!code) errors.sku_code = "SKU kodu gerekli.";
  else if (code.length > 50) errors.sku_code = "En fazla 50 karakter.";
  if (form.barcode.trim().length > 50) errors.barcode = "En fazla 50 karakter.";

  const unit: StockBaseUnit = form.kind === "ingredient" ? form.base_unit : "piece";

  const pkg = parseDecimal(form.package_size || "1");
  if (pkg == null || pkg < 0.001) errors.package_size = "En az 0,001 olmalı.";
  else if (unit === "piece" && !Number.isInteger(pkg)) errors.package_size = "Adet bazlı üründe paket boyutu tam sayı olmalı.";
  if (form.package_label.trim().length > 40) errors.package_label = "En fazla 40 karakter.";

  const cost = form.kind === "composite" ? 0 : parseDecimal(form.unit_cost || "0");
  if (cost == null || cost < 0) errors.unit_cost = "Geçerli bir tutar girin.";
  else if (cost >= 1e8) errors.unit_cost = "Tutar çok büyük.";

  const price = form.kind === "ingredient" ? 0 : parseDecimal(form.sale_price || "0");
  if (price == null || price < 0) errors.sale_price = "Geçerli bir tutar girin.";
  else if (price >= 1e6) errors.sale_price = "Tutar çok büyük.";

  const vat = parseDecimal(form.vat_rate || "20");
  if (vat == null || vat < 0 || vat > 100) errors.vat_rate = "0 ile 100 arasında olmalı.";

  if (Object.keys(errors).length) return { payload: null, errors };
  return {
    errors,
    payload: {
      name,
      sku_code: code,
      barcode: form.barcode.trim() || null,
      kind: form.kind,
      base_unit: unit,
      package_size: toApiDecimal(pkg as number, 3),
      package_label: form.package_label.trim(),
      unit_cost: toApiDecimal(cost as number, 2),
      sale_price: toApiDecimal(price as number, 2),
      vat_rate: toApiDecimal(vat as number, 2),
    },
  };
}

/** Düzenlemede yalnız değişen alanları gönderir (PATCH kısmi) */
function diffPayload(next: StockSkuWritePayload, prev: StockSkuWritePayload): StockSkuWritePayload {
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(next) as (keyof StockSkuWritePayload)[]) {
    if (next[key] !== prev[key]) out[key] = next[key];
  }
  return out as StockSkuWritePayload;
}

export function SkuFormSheet(props: SkuFormSheetProps) {
  const session = useOpenSession(props.visible);
  return <SkuForm key={session} {...props} />;
}

function SkuForm({ visible, onClose, sku }: SkuFormSheetProps) {
  const styles = useStyles();
  const editing = !!sku;
  const [form, setForm] = useState<SkuFormState>(() => initialState(sku));
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Kaydedilmemiş değişiklik: kapatırken onay iste
  const dirty = useFormDirty(visible, form);
  const guardedClose = useGuardedClose(dirty, onClose);


  const original = useMemo(() => (sku ? buildSkuPayload(initialState(sku)).payload : null), [sku]);

  const saveMutation = useStockMutation((payload: StockSkuWritePayload) =>
    sku ? stockApi.skus.update(sku.id, payload) : stockApi.skus.create(payload)
  );
  const deleteMutation = useStockMutation((id: number) => stockApi.skus.remove(id));
  const busy = saveMutation.isPending || deleteMutation.isPending;

  const set = <K extends keyof SkuFormState>(key: K, value: SkuFormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const save = () => {
    const { payload, errors: errs } = buildSkuPayload(form);
    setErrors(errs);
    if (!payload) return;
    const body = editing && original ? diffPayload(payload, original) : payload;
    if (editing && Object.keys(body).length === 0) {
      onClose();
      return;
    }
    setFormError(null);
    saveMutation.run(body, {
      onSuccess: () => {
        toast.success(editing ? "Ürün güncellendi." : "Ürün oluşturuldu.");
        onClose();
      },
      onError: (e) => {
        const fe = (e as ApiError).fieldErrors;
        if (fe) setErrors(fe as Errors);
        setFormError(errorMessage(e, "Ürün kaydedilemedi."));
      },
    });
  };

  const confirmDelete = () => {
    if (!sku) return;
    setDeleteError(null);
    deleteMutation.run(sku.id, {
      onSuccess: () => {
        toast.success("Ürün silindi.");
        setDeleteOpen(false);
        onClose();
      },
      onError: (e) => setDeleteError(errorMessage(e, "Ürün silinemedi.")),
    });
  };

  const vatOptions = useMemo(() => {
    const opts = VAT_PRESETS.map((v) => ({ value: v, label: `%${v}` }));
    if (form.vat_rate && !VAT_PRESETS.includes(form.vat_rate)) opts.push({ value: form.vat_rate, label: `%${form.vat_rate}` });
    return opts;
  }, [form.vat_rate]);

  const isIngredient = form.kind === "ingredient";

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      dirty={dirty}
      title={editing ? "Ürünü düzenle" : "Yeni ürün"}
      subtitle={editing ? sku?.sku_code : "Stok kataloğuna SKU ekleyin"}
      dismissible={!busy}
      testID="sku-form"
      footer={
        <>
          <AppButton title="Vazgeç" variant="outline" onPress={guardedClose} disabled={busy} style={styles.flex} />
          <AppButton title="Kaydet" onPress={save} loading={saveMutation.isPending} disabled={deleteMutation.isPending} style={styles.flex} testID="sku-save" />
        </>
      }
    >
      {formError ? <AppNotice tone="danger" message={formError} /> : null}
      <AppInput label="Ürün adı" required value={form.name} onChangeText={(v) => set("name", v)} maxLength={100} error={errors.name} testID="sku-name" />
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppInput
            label="SKU kodu"
            required
            value={form.sku_code}
            onChangeText={(v) => set("sku_code", v)}
            maxLength={50}
            autoCapitalize="characters"
            autoCorrect={false}
            error={errors.sku_code}
            testID="sku-code"
          />
        </View>
        <View style={styles.flex}>
          <AppInput label="Barkod" value={form.barcode} onChangeText={(v) => set("barcode", v)} maxLength={50} keyboardType="number-pad" error={errors.barcode} testID="sku-barcode" />
        </View>
      </View>

      <AppSelect<StockSkuKind>
        label="Tür"
        required
        options={(Object.keys(SKU_KIND_LABELS) as StockSkuKind[]).map((k) => ({
          value: k,
          label: SKU_KIND_LABELS[k],
          description:
            k === "simple" ? "Doğrudan satılır, adet" : k === "composite" ? "Satışta bileşenleri düşer" : "Reçetede tüketilir (g/ml/adet)",
        }))}
        value={form.kind}
        onChange={(k) => {
          setForm((f) => ({ ...f, kind: k, base_unit: k === "ingredient" ? f.base_unit : "piece" }));
          // Tür değişince kurallar değişir (paket boyutu tam sayı, alış/satış alanı kilidi): eski hatalar geçersiz
          setErrors({});
        }}
        testID="sku-kind"
      />
      <AppSelect<StockBaseUnit>
        label="Birim"
        options={(Object.keys(BASE_UNIT_LABELS) as StockBaseUnit[]).map((u) => ({
          value: u,
          label: BASE_UNIT_LABELS[u],
          disabled: !isIngredient && u !== "piece",
        }))}
        value={isIngredient ? form.base_unit : "piece"}
        onChange={(u) => set("base_unit", u)}
        disabled={!isIngredient}
        error={errors.base_unit}
        testID="sku-unit"
      />
      <AppText variant="caption" color="textTertiary">
        {isIngredient
          ? "Tüm stok miktarları bu birimde tutulur. Bakiyesi/hareketi olan üründe birim değiştirilemez."
          : "Satılabilir ürünlerin birimi Adet'tir."}
      </AppText>

      <View style={styles.row}>
        <View style={styles.flex}>
          <AppInput
            label="Paket boyutu"
            value={form.package_size}
            onChangeText={(v) => set("package_size", v)}
            keyboardType="decimal-pad"
            error={errors.package_size}
            testID="sku-package-size"
          />
        </View>
        <View style={styles.flex}>
          <AppInput label="Paket etiketi" value={form.package_label} onChangeText={(v) => set("package_label", v)} maxLength={40} placeholder="Örn. 1 kg çuval" error={errors.package_label} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.flex}>
          <AppInput
            label="Alış (KDV dahil)"
            value={form.kind === "composite" ? "" : form.unit_cost}
            onChangeText={(v) => set("unit_cost", v)}
            keyboardType="decimal-pad"
            suffix="₺"
            disabled={form.kind === "composite"}
            placeholder={form.kind === "composite" ? "Reçeteden" : "0,00"}
            error={errors.unit_cost}
            testID="sku-unit-cost"
          />
        </View>
        <View style={styles.flex}>
          <AppInput
            label="Satış (KDV dahil)"
            value={isIngredient ? "" : form.sale_price}
            onChangeText={(v) => set("sale_price", v)}
            keyboardType="decimal-pad"
            suffix="₺"
            disabled={isIngredient}
            placeholder={isIngredient ? "Satılmaz" : "0,00"}
            error={errors.sale_price}
            testID="sku-sale-price"
          />
        </View>
      </View>
      <AppSelect<string> label="KDV oranı" options={vatOptions} value={form.vat_rate} onChange={(v) => set("vat_rate", v)} error={errors.vat_rate} testID="sku-vat" />

      {editing && sku && toNumber(sku.sale_price_excl_vat) != null ? (
        <AppText variant="caption" color="textTertiary">
          Kayıtlı satış: KDV hariç {formatCurrency(sku.sale_price_excl_vat)} · KDV {formatCurrency(sku.vat_amount)}
        </AppText>
      ) : null}

      {editing ? (
        <AppButton title="Ürünü sil" icon="trash-2" variant="dangerOutline" onPress={() => setDeleteOpen(true)} disabled={busy} testID="sku-delete" />
      ) : null}

      <AppConfirmSheet
        visible={deleteOpen}
        title="Ürünü sil"
        // Sunucu hareket geçmişi olan SKU'yu reddeder (views/stock.py:370-377, 400 + detail);
        // ret mesajı `deleteError` ile onay sayfasında gösterilir.
        message="Stok hareket geçmişi olan ürün silinemez. Reçete veya rotada kullanılan ürün de silinemeyebilir."
        summary={sku ? [{ label: "Ürün", value: sku.name }, { label: "SKU kodu", value: sku.sku_code }] : []}
        confirmLabel="Sil"
        destructive
        irreversible
        loading={deleteMutation.isPending}
        error={deleteError}
        onConfirm={confirmDelete}
        onCancel={() => {
          if (!deleteMutation.isPending) setDeleteOpen(false);
        }}
      />
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    row: { flexDirection: "row", gap: t.spacing.md },
  })
);
