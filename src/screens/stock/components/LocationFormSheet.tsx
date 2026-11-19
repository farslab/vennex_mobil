import React, { useState } from "react";
import { StyleSheet } from "react-native";
import {
  AppButton,
  AppConfirmSheet,
  AppInput,
  AppNotice,
  AppSelect,
  AppSheet,
  AppSwitchRow,
  makeStyles,
  toast,
  useFormDirty,
  useGuardedClose,
} from "@/design-system";
import { stockApi } from "@/api/stock";
import { errorMessage, type ApiError } from "@/api/client";
import {
  MANUAL_LOCATION_TYPES,
  STOCK_LOCATION_TYPE_LABELS,
  type StockLocation,
  type StockLocationWritePayload,
} from "@/types/stock";
import { useStockMutation } from "../hooks/useStockData";
import { useOpenSession } from "../hooks/useOpenSession";

type ManualType = StockLocationWritePayload["location_type"];

export interface LocationFormSheetProps {
  visible: boolean;
  onClose: () => void;
  /** Verilirse düzenleme modu */
  location?: StockLocation | null;
}

/** Lokasyon oluştur/düzenle — LocationWriteSerializer: name(≤100), location_type, is_active */
export function LocationFormSheet(props: LocationFormSheetProps) {
  const session = useOpenSession(props.visible);
  return <LocationForm key={session} {...props} />;
}

function LocationForm({ visible, onClose, location }: LocationFormSheetProps) {
  const styles = useStyles();
  const editing = !!location;
  const [name, setName] = useState(location?.name ?? "");
  const [type, setType] = useState<ManualType | null>(
    location && location.location_type !== "vending_machine" ? location.location_type : "warehouse"
  );
  const [active, setActive] = useState(location?.is_active ?? true);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // Kaydedilmemiş değişiklik: kapatırken onay iste
  const dirty = useFormDirty(visible, { name, type, active });
  const guardedClose = useGuardedClose(dirty, onClose);


  const mutation = useStockMutation((payload: StockLocationWritePayload) =>
    location ? stockApi.locations.update(location.id, payload) : stockApi.locations.create(payload)
  );

  const deleteMutation = useStockMutation((id: number) => stockApi.locations.remove(id));
  const busy = mutation.isPending || deleteMutation.isPending;

  const confirmDelete = () => {
    if (!location) return;
    setDeleteError(null);
    deleteMutation.run(location.id, {
      onSuccess: () => {
        toast.success("Lokasyon silindi.");
        setDeleteOpen(false);
        onClose();
      },
      onError: (e) => setDeleteError(errorMessage(e, "Lokasyon silinemedi.")),
    });
  };

  const save = () => {
    const errs: Record<string, string> = {};
    const trimmed = name.trim();
    if (!trimmed) errs.name = "Lokasyon adı gerekli.";
    else if (trimmed.length > 100) errs.name = "En fazla 100 karakter.";
    if (!type) errs.location_type = "Tip seçin.";
    setErrors(errs);
    if (Object.keys(errs).length || !type) return;
    setFormError(null);
    mutation.run(
      { name: trimmed, location_type: type, is_active: active },
      {
        onSuccess: () => {
          toast.success(editing ? "Lokasyon güncellendi." : "Lokasyon oluşturuldu.");
          onClose();
        },
        onError: (e) => {
          const fe = (e as ApiError).fieldErrors;
          if (fe) setErrors(fe);
          setFormError(errorMessage(e, "Lokasyon kaydedilemedi."));
        },
      }
    );
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      dirty={dirty}
      title={editing ? "Lokasyonu düzenle" : "Yeni lokasyon"}
      subtitle="Otomat lokasyonları senkronizasyonla oluşur"
      dismissible={!busy}
      testID="location-form"
      footer={
        <>
          <AppButton title="Vazgeç" variant="outline" onPress={guardedClose} disabled={busy} style={styles.flex} />
          <AppButton
            title="Kaydet"
            onPress={save}
            loading={mutation.isPending}
            disabled={deleteMutation.isPending}
            style={styles.flex}
            testID="location-save"
          />
        </>
      }
    >
      {formError ? <AppNotice tone="danger" message={formError} /> : null}
      <AppInput
        label="Lokasyon adı"
        required
        value={name}
        onChangeText={(v) => {
          setName(v);
          if (errors.name) setErrors((e) => ({ ...e, name: undefined }));
        }}
        placeholder="Örn. Merkez Depo"
        maxLength={100}
        autoCapitalize="words"
        error={errors.name}
        testID="location-name"
      />
      <AppSelect<ManualType>
        label="Tip"
        required
        options={MANUAL_LOCATION_TYPES.map((t) => ({ value: t, label: STOCK_LOCATION_TYPE_LABELS[t] }))}
        value={type}
        onChange={setType}
        error={errors.location_type}
        testID="location-type"
      />
      <AppSwitchRow
        label="Aktif"
        description="Pasif lokasyonlar hareket formlarında listelenmez"
        value={active}
        onChange={setActive}
        testID="location-active"
      />
      {location ? (
        <AppButton
          title="Lokasyonu sil"
          icon="trash-2"
          variant="dangerOutline"
          onPress={() => setDeleteOpen(true)}
          disabled={busy}
          testID="location-delete"
        />
      ) : null}
      <AppConfirmSheet
        visible={deleteOpen}
        title="Lokasyonu sil"
        // Sunucu (web ile aynı) stok bakiyesi veya hareket geçmişi olan lokasyonu reddeder (400/409 + detail);
        // ret mesajı `deleteError` ile onay sayfasında gösterilir.
        message="Stok bakiyesi veya hareket geçmişi olan lokasyon silinemez; bunun yerine pasif yapabilirsiniz. Rotada kullanılan lokasyon da silinemeyebilir."
        summary={location ? [{ label: "Lokasyon", value: location.name }, { label: "Tip", value: STOCK_LOCATION_TYPE_LABELS[location.location_type] }] : []}
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

const useStyles = makeStyles(() => StyleSheet.create({ flex: { flex: 1 } }));
