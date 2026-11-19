import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  AppButton,
  AppConfirmSheet,
  AppInput,
  AppNotice,
  AppSegmented,
  AppSelect,
  AppSheet,
  AppText,
  makeStyles,
  toast,
  type ConfirmSummaryItem,
  type SelectOption,
  useFormDirty,
  useGuardedClose,
} from "@/design-system";
import { stockApi, validateMovementInput } from "@/api/stock";
import { errorMessage } from "@/api/client";
import { parseDecimal } from "@/utils/number";
import { formatSignedQuantity, formatStockQuantity, unitShort } from "@/components/stock/stockFormat";
import {
  STOCK_LOCATION_TYPE_LABELS,
  type StockLocation,
  type StockMovementInput,
  type StockSku,
} from "@/types/stock";
import { stockKeys, useStockLocations, useStockMutation } from "../hooks/useStockData";
import { SkuPickerField } from "./SkuPickerField";
import { useOpenSession } from "../hooks/useOpenSession";

export type MovementMode = "transfer" | "receipt" | "adjustment";

const MODE_TEXT: Record<MovementMode, { title: string; subtitle: string; confirm: string; done: string }> = {
  transfer: {
    title: "Transfer",
    subtitle: "Lokasyonlar arası stok aktarımı",
    confirm: "Transferi onayla",
    done: "Transfer kaydedildi.",
  },
  receipt: {
    title: "Stok Girişi",
    subtitle: "Tedarikten gelen ürünü lokasyona ekleyin",
    confirm: "Girişi onayla",
    done: "Stok girişi kaydedildi.",
  },
  adjustment: {
    title: "Stok Düzeltme",
    subtitle: "Sayım farkı, fire veya hasar düzeltmesi",
    confirm: "Düzeltmeyi onayla",
    done: "Düzeltme kaydedildi.",
  },
};

export interface MovementFormSheetProps {
  visible: boolean;
  mode: MovementMode;
  onClose: () => void;
  /** Lokasyon detayından açıldığında: transferde kaynak, girişte hedef, düzeltmede lokasyon */
  presetLocationId?: number;
}

type Errors = Partial<Record<"sku_id" | "from_location_id" | "to_location_id" | "location_id" | "quantity" | "reason", string>>;

export function MovementFormSheet(props: MovementFormSheetProps) {
  const session = useOpenSession(props.visible);
  return <MovementForm key={`${session}-${props.mode}`} {...props} />;
}

function MovementForm({ visible, mode, onClose, presetLocationId }: MovementFormSheetProps) {
  const styles = useStyles();
  const text = MODE_TEXT[mode];

  // State her açılışta (key) yeniden kurulur; ön seçili lokasyon uygulanır
  const [sku, setSku] = useState<StockSku | null>(null);
  const [fromId, setFromId] = useState<number | null>(mode === "transfer" ? (presetLocationId ?? null) : null);
  const [toId, setToId] = useState<number | null>(mode === "receipt" ? (presetLocationId ?? null) : null);
  const [locationId, setLocationId] = useState<number | null>(mode === "adjustment" ? (presetLocationId ?? null) : null);
  const [qtyText, setQtyText] = useState("");
  const [direction, setDirection] = useState<"in" | "out">("in");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<Errors>({});
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Kaydedilmemiş değişiklik: kapatırken onay iste
  const dirty = useFormDirty(visible, { sku: sku?.id ?? null, fromId, toId, locationId, qtyText, direction, reason });
  const guardedClose = useGuardedClose(dirty, onClose);


  const locationsQuery = useStockLocations({}, visible);
  const locations = useMemo(() => locationsQuery.data ?? [], [locationsQuery.data]);
  const byId = useMemo(() => new Map(locations.map((l) => [l.id, l])), [locations]);

  // Mevcut miktar: transferde kaynak, girişte hedef, düzeltmede lokasyon (tek envanter isteği)
  const balanceLocId = mode === "transfer" ? fromId : mode === "receipt" ? toId : locationId;
  const inventoryQuery = useQuery({
    queryKey: stockKeys.inventory(balanceLocId ?? 0),
    queryFn: ({ signal }) => stockApi.locations.inventoryDetail(balanceLocId as number, signal),
    enabled: visible && balanceLocId != null && sku != null,
    staleTime: 15_000,
  });
  const available: number | null = useMemo(() => {
    if (!sku || !inventoryQuery.data) return null;
    return inventoryQuery.data.results.find((r) => r.sku === sku.id)?.quantity ?? 0;
  }, [sku, inventoryQuery.data]);

  const unit = sku?.base_unit ?? "piece";
  const mutation = useStockMutation((input: StockMovementInput) => stockApi.movements.create(input));

  const options = (filter: (l: StockLocation) => { disabled?: boolean; description?: string } | null): SelectOption<number>[] =>
    locations.map((l) => {
      const extra = filter(l);
      return {
        value: l.id,
        label: l.name,
        description: extra?.description ?? STOCK_LOCATION_TYPE_LABELS[l.location_type],
        disabled: extra?.disabled,
      };
    });

  const fromOptions = options(() => null);
  const toOptions = options((l) => {
    if (mode !== "transfer") return null;
    if (l.location_type === "vending_machine") return { disabled: true, description: "Otomata doğrudan transfer yapılamaz (dolum POS cihazı sayfasından)" };
    if (l.id === fromId) return { disabled: true, description: "Kaynak lokasyon" };
    return null;
  });
  const adjustOptions = options((l) =>
    l.location_type === "vending_machine" ? { disabled: true, description: "Otomat düzeltmesi POS cihazı sayfasından yapılır" } : null
  );

  const buildInput = (): { input: StockMovementInput | null; errs: Errors } => {
    const parsed = parseDecimal(qtyText);
    const errs: Errors = {};
    if (mode === "adjustment" && parsed != null && parsed < 0) {
      errs.quantity = "Miktarı pozitif girin; yönü yukarıdan seçin.";
    }
    const q = parsed == null ? NaN : mode === "adjustment" && direction === "out" ? -parsed : parsed;
    const base = { sku_id: sku?.id ?? 0, quantity: q, unit };
    const input: StockMovementInput =
      mode === "transfer"
        ? { type: "transfer", ...base, from_location_id: fromId ?? 0, to_location_id: toId ?? 0 }
        : mode === "receipt"
          ? { type: "receipt", ...base, to_location_id: toId ?? 0 }
          : { type: "adjustment", ...base, location_id: locationId ?? 0, reason: reason.trim() || undefined };
    Object.assign(errs, validateMovementInput(input) ?? {}, errs.quantity ? { quantity: errs.quantity } : {});
    // Backend "Yetersiz stok" kuralı (services_stock.py:104, 171) — veri yüklüyse önceden uyar
    if (!errs.quantity && available != null && Number.isFinite(q)) {
      if (mode === "transfer" && q > available)
        errs.quantity = `Kaynakta yeterli stok yok. Mevcut: ${formatStockQuantity(available, unit)}`;
      if (mode === "adjustment" && q < 0 && available + q < 0)
        errs.quantity = `Lokasyonda yeterli stok yok. Mevcut: ${formatStockQuantity(available, unit)}`;
    }
    return { input: Object.keys(errs).length ? null : input, errs };
  };

  const onContinue = () => {
    const { input, errs } = buildInput();
    setErrors(errs);
    if (!input) return;
    setSubmitError(null);
    setConfirmOpen(true);
  };

  const onConfirm = () => {
    const { input } = buildInput();
    if (!input) {
      setConfirmOpen(false);
      return;
    }
    mutation.run(input, {
      onSuccess: () => {
        toast.success(text.done);
        setConfirmOpen(false);
        onClose();
      },
      onError: (e) => setSubmitError(errorMessage(e, "Hareket kaydedilemedi.")),
    });
  };

  const summary = useMemo((): ConfirmSummaryItem[] => {
    if (!confirmOpen || !sku) return [];
    const q = parseDecimal(qtyText) ?? 0;
    const delta = mode === "adjustment" && direction === "out" ? -q : q;
    const name = (id: number | null) => (id != null ? (byId.get(id)?.name ?? `#${id}`) : "—");
    const items: ConfirmSummaryItem[] = [
      { label: "İşlem", value: mode === "adjustment" ? `Düzeltme (${direction === "in" ? "ekleme" : "çıkarma"})` : text.title },
      { label: "Ürün", value: `${sku.name} · ${sku.sku_code}` },
    ];
    if (mode === "transfer") {
      items.push({ label: "Kaynak", value: name(fromId) }, { label: "Hedef", value: name(toId) });
    } else if (mode === "receipt") {
      items.push({ label: "Hedef", value: name(toId) });
    } else {
      items.push({ label: "Lokasyon", value: name(locationId) });
    }
    items.push({
      label: "Miktar",
      value: mode === "transfer" ? formatStockQuantity(q, unit) : formatSignedQuantity(delta, delta >= 0 ? 1 : -1, unit),
    });
    if (available != null) {
      const after = mode === "transfer" ? available - q : available + delta;
      items.push({
        label: mode === "transfer" ? "Kaynak bakiyesi" : "Bakiye",
        value: `${formatStockQuantity(available, unit)} → ${formatStockQuantity(after, unit)}`,
      });
    }
    if (mode === "adjustment" && reason.trim()) items.push({ label: "Açıklama", value: reason.trim() });
    return items;
  }, [confirmOpen, sku, qtyText, mode, direction, byId, fromId, toId, locationId, unit, available, reason, text.title]);

  const clearError = (key: keyof Errors) => setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));

  const balanceLabel =
    sku && balanceLocId != null
      ? inventoryQuery.isLoading
        ? "Mevcut miktar yükleniyor…"
        : available != null
          ? `${mode === "transfer" ? "Kaynakta mevcut" : "Lokasyonda mevcut"}: ${formatStockQuantity(available, unit)}`
          : null
      : null;

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      dirty={dirty}
      title={text.title}
      subtitle={text.subtitle}
      dismissible={!mutation.isPending}
      testID={`movement-sheet-${mode}`}
      footer={
        <>
          <AppButton title="Vazgeç" variant="outline" onPress={guardedClose} disabled={mutation.isPending} style={styles.flex} />
          <AppButton title="Devam" onPress={onContinue} disabled={mutation.isPending} style={styles.flex} testID="movement-continue" />
        </>
      }
    >
      {locationsQuery.isError ? <AppNotice tone="danger" message={`Lokasyonlar yüklenemedi: ${errorMessage(locationsQuery.error)}`} /> : null}

      <SkuPickerField
        label="Ürün"
        required
        value={sku}
        onChange={(s) => {
          setSku(s);
          clearError("sku_id");
          clearError("quantity");
        }}
        error={errors.sku_id}
        testID="movement-sku"
      />

      {mode === "transfer" ? (
        <>
          <AppSelect<number>
            label="Kaynak lokasyon"
            required
            options={fromOptions}
            value={fromId}
            onChange={(v) => {
              setFromId(v);
              clearError("from_location_id");
              clearError("to_location_id");
              clearError("quantity");
            }}
            loading={locationsQuery.isLoading}
            error={errors.from_location_id}
            testID="movement-from"
          />
          <AppSelect<number>
            label="Hedef lokasyon"
            required
            options={toOptions}
            value={toId}
            onChange={(v) => {
              setToId(v);
              clearError("to_location_id");
            }}
            loading={locationsQuery.isLoading}
            error={errors.to_location_id}
            testID="movement-to"
          />
        </>
      ) : mode === "receipt" ? (
        <AppSelect<number>
          label="Hedef lokasyon"
          required
          options={toOptions}
          value={toId}
          onChange={(v) => {
            setToId(v);
            clearError("to_location_id");
          }}
          loading={locationsQuery.isLoading}
          error={errors.to_location_id}
          testID="movement-to"
        />
      ) : (
        <>
          <AppSelect<number>
            label="Lokasyon"
            required
            options={adjustOptions}
            value={locationId}
            onChange={(v) => {
              setLocationId(v);
              clearError("location_id");
              clearError("quantity");
            }}
            loading={locationsQuery.isLoading}
            error={errors.location_id}
            testID="movement-location"
          />
          <View style={styles.group}>
            <AppText variant="label" color="textSecondary">
              Yön
            </AppText>
            <AppSegmented<"in" | "out">
              items={[
                { key: "in", label: "Ekle (+)" },
                { key: "out", label: "Çıkar (−)" },
              ]}
              value={direction}
              onChange={(d) => {
                setDirection(d);
                clearError("quantity");
              }}
            />
          </View>
        </>
      )}

      <AppInput
        label={`Miktar${sku ? ` (${unitShort(unit)})` : ""}`}
        required
        value={qtyText}
        onChangeText={(v) => {
          setQtyText(v);
          clearError("quantity");
        }}
        keyboardType={unit === "piece" ? "number-pad" : "decimal-pad"}
        placeholder={unit === "piece" ? "Örn. 24" : "Örn. 1250,5"}
        suffix={sku ? unitShort(unit) : undefined}
        error={errors.quantity}
        helper={
          balanceLabel ??
          (sku
            ? unit === "piece"
              ? "Adet bazlı ürün: yalnız tam sayı."
              : `Miktar ${unitShort(unit)} cinsinden; en fazla 3 ondalık.`
            : "Önce ürün seçin.")
        }
        testID="movement-quantity"
      />

      {mode === "adjustment" ? (
        <AppInput
          label="Açıklama"
          value={reason}
          onChangeText={(v) => {
            setReason(v);
            clearError("reason");
          }}
          placeholder="Örn. sayım farkı, fire"
          maxLength={200}
          error={errors.reason}
          // SÖZLEŞME: AdjustmentSerializer `reason` kabul ediyor ama view servise iletmiyor
          // (views/stock.py:436-442) → hareketin `notes` alanı boş kalıyor. Kullanıcıya açıkça söylenir.
          helper="Not: Sunucu açıklamayı şu an hareket kaydına yazmıyor."
          testID="movement-reason"
        />
      ) : null}

      <AppConfirmSheet
        visible={confirmOpen}
        title={`${text.title} özeti`}
        message="Bilgileri kontrol edin. Onayladığınızda stok bakiyeleri hemen güncellenir."
        summary={summary}
        confirmLabel={text.confirm}
        loading={mutation.isPending}
        error={submitError}
        onConfirm={onConfirm}
        onCancel={() => {
          if (!mutation.isPending) setConfirmOpen(false);
        }}
      />
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    group: { gap: t.spacing.xs },
  })
);
