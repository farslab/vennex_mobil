import React, { useMemo, useState } from "react";
import { useCardAccess } from "../hooks/useCardAccess";
import { StyleSheet } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  AppButton,
  AppConfirmSheet,
  AppInput,
  AppNotice,
  AppSelect,
  AppSheet,
  makeStyles,
  toast,
  useFormDirty,
  useGuardedClose,
} from "@/design-system";
import { cardsApi } from "@/api/cards";
import { formatCurrency, toApiDecimal } from "@/utils/number";
import type { CardCreatePayload, CardUpdatePayload, PersonnelCard } from "@/types/cards";
import { cardKeys } from "../hooks/cardKeys";
import { fieldErrorsOf, generalErrorOf, useLockedMutation } from "../hooks/useLockedMutation";
import { validateAmount } from "./format";
import { useOnOpen } from "../hooks/useOnOpen";

const FIELDS = ["uid", "first_name", "last_name", "customer_no", "balance", "group_ids"];

interface FormState {
  uid: string;
  first_name: string;
  last_name: string;
  customer_no: string;
  balance: string;
  group_ids: number[];
}

function initialState(card: PersonnelCard | null): FormState {
  return {
    uid: card?.uid ?? "",
    first_name: card?.first_name ?? "",
    last_name: card?.last_name ?? "",
    customer_no: card && card.customer_no ? String(card.customer_no) : "",
    balance: "",
    group_ids: card?.groups.map((g) => g.id) ?? [],
  };
}

type Errors = Partial<Record<keyof FormState, string>>;

function validate(form: FormState, isCreate: boolean, allowBalance: boolean): { errors: Errors; balance: number } {
  const errors: Errors = {};
  const uid = form.uid.trim();
  if (!uid) errors.uid = "UID zorunludur.";
  else if (uid.length > 50) errors.uid = "UID en fazla 50 karakter olabilir.";
  if (form.first_name.trim().length > 100) errors.first_name = "Ad en fazla 100 karakter olabilir.";
  if (form.last_name.trim().length > 100) errors.last_name = "Soyad en fazla 100 karakter olabilir.";
  if (form.customer_no.trim() && !/^\d+$/.test(form.customer_no.trim()))
    errors.customer_no = "Kullanıcı no 0 veya pozitif tam sayı olmalı.";
  let balance = 0;
  if (isCreate && allowBalance && form.balance.trim()) {
    const res = validateAmount(form.balance, { allowZero: true });
    if ("error" in res) errors.balance = res.error;
    else balance = res.value;
  }
  return { errors, balance };
}

export interface CardFormSheetProps {
  visible: boolean;
  /** null → yeni kart */
  card: PersonnelCard | null;
  canChangeBalance: boolean;
  onClose: () => void;
  onSaved?: (card: PersonnelCard) => void;
}

/** Kart oluşturma / düzenleme. Başlangıç bakiyesi yalnız `change_card_balance` ile ve özet onayıyla. */
export function CardFormSheet({ visible, card, canChangeBalance, onClose, onSaved }: CardFormSheetProps) {
  const { scopeRestricted } = useCardAccess();
  const styles = useStyles();
  const isCreate = card == null;
  const [form, setForm] = useState<FormState>(() => initialState(card));
  const [errors, setErrors] = useState<Errors>({});
  const [confirmPayload, setConfirmPayload] = useState<CardCreatePayload | null>(null);
  // Kaydedilmemiş değişiklik: kapatırken onay iste
  const dirty = useFormDirty(visible, form);
  const guardedClose = useGuardedClose(dirty, onClose);

  useOnOpen(visible, () => {
    setForm(initialState(card));
    setErrors({});
    setConfirmPayload(null);
  });

  const groupsQuery = useQuery({
    queryKey: cardKeys.groupList(""),
    queryFn: ({ signal }) => cardsApi.groups.list({}, signal),
    enabled: visible,
  });
  const groupOptions = useMemo(() => {
    const opts = (groupsQuery.data ?? []).map((g) => ({ value: g.id, label: g.name, description: `${g.active_cards_count} aktif kart` }));
    // Kapsam dışı (görülemeyen) mevcut gruplar da seçili kalabilsin
    for (const g of card?.groups ?? []) if (!opts.some((o) => o.value === g.id)) opts.push({ value: g.id, label: g.name, description: "" });
    return opts;
  }, [groupsQuery.data, card]);

  const mutation = useLockedMutation({
    mutationFn: (payload: CardCreatePayload | CardUpdatePayload) =>
      card ? cardsApi.update(card.id, payload) : cardsApi.create(payload as CardCreatePayload),
    successMessage: isCreate ? "Kart oluşturuldu." : "Kart güncellendi.",
    onSuccess: (saved) => {
      setConfirmPayload(null);
      onClose();
      onSaved?.(saved);
    },
    onError: (err) => {
      const fe = fieldErrorsOf(err);
      const mapped: Errors = {};
      for (const key of FIELDS) if (fe[key]) mapped[key as keyof FormState] = fe[key];
      if (Object.keys(mapped).length) {
        setErrors(mapped);
        setConfirmPayload(null);
      }
    },
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = () => {
    const { errors: errs, balance } = validate(form, isCreate, canChangeBalance);
    // Kart grubu kısıtlı teknisyen: kart bir grubuna bağlanmalı (backend 400, web formu zorunlu tutar)
    if (scopeRestricted && form.group_ids.length === 0) errs.group_ids = "Yetkili olduğunuz bir grup seçin.";
    setErrors(errs);
    if (Object.keys(errs).length) return;
    mutation.reset();
    const base = {
      uid: form.uid.trim(),
      first_name: form.first_name.trim() || null,
      last_name: form.last_name.trim() || null,
      customer_no: form.customer_no.trim() ? Number(form.customer_no.trim()) : 0,
      group_ids: form.group_ids,
    };
    if (!card) {
      const payload: CardCreatePayload = { ...base };
      if (canChangeBalance && balance > 0) {
        payload.balance = toApiDecimal(balance);
        setConfirmPayload(payload);
        return;
      }
      mutation.run(payload);
      return;
    }
    const patch: CardUpdatePayload = {};
    if (base.uid !== card.uid) patch.uid = base.uid;
    if (base.first_name !== (card.first_name || null)) patch.first_name = base.first_name;
    if (base.last_name !== (card.last_name || null)) patch.last_name = base.last_name;
    if (base.customer_no !== card.customer_no) patch.customer_no = base.customer_no;
    const before = card.groups.map((g) => g.id).sort().join(",");
    if ([...base.group_ids].sort().join(",") !== before) patch.group_ids = base.group_ids;
    if (Object.keys(patch).length === 0) {
      toast.info("Değişiklik yapılmadı.");
      onClose();
      return;
    }
    mutation.run(patch);
  };

  const generalError = !confirmPayload ? generalErrorOf(mutation.error, FIELDS) : null;

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      dirty={dirty}
      title={isCreate ? "Yeni kart" : "Kartı düzenle"}
      dismissible={!mutation.isPending}
      footer={
        <>
          <AppButton title="Vazgeç" variant="outline" onPress={guardedClose} disabled={mutation.isPending} style={styles.flex} />
          <AppButton
            title={isCreate ? "Kartı oluştur" : "Kaydet"}
            onPress={submit}
            loading={mutation.isPending && !confirmPayload}
            style={styles.flex}
            testID="card-form-submit"
          />
        </>
      }
    >
      {generalError ? <AppNotice tone="danger" title="Kaydedilemedi" message={generalError} /> : null}
      <AppInput
        label="Kart UID"
        required
        value={form.uid}
        onChangeText={(t) => set("uid", t)}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={50}
        placeholder="ör. 04 A2 3B 1C"
        error={errors.uid}
        testID="card-form-uid"
      />
      <AppInput label="Ad" value={form.first_name} onChangeText={(t) => set("first_name", t)} maxLength={100} error={errors.first_name} testID="card-form-first-name" />
      <AppInput label="Soyad" value={form.last_name} onChangeText={(t) => set("last_name", t)} maxLength={100} error={errors.last_name} testID="card-form-last-name" />
      <AppInput
        label="Kullanıcı no"
        value={form.customer_no}
        onChangeText={(t) => set("customer_no", t)}
        keyboardType="number-pad"
        helper="İsteğe bağlı; personel/müşteri numarası"
        error={errors.customer_no}
      />
      <AppSelect<number>
        multiple
        label="Kart grupları"
        required={scopeRestricted}
        value={form.group_ids}
        onChange={(v) => set("group_ids", v)}
        options={groupOptions}
        loading={groupsQuery.isLoading}
        error={errors.group_ids ?? (groupsQuery.isError ? "Gruplar yüklenemedi." : null)}
        placeholder="Grup seçin"
        sheetTitle="Kart grupları"
        searchable
      />
      {isCreate && canChangeBalance ? (
        <AppInput
          label="Başlangıç bakiyesi"
          value={form.balance}
          onChangeText={(t) => set("balance", t)}
          keyboardType="decimal-pad"
          placeholder="0,00"
          suffix="₺"
          helper="Boş bırakılırsa kart 0 ₺ ile açılır"
          error={errors.balance}
          testID="card-form-balance"
        />
      ) : null}
      {isCreate && !canChangeBalance ? (
        <AppNotice tone="info" message="Bakiye değiştirme yetkiniz olmadığından kart 0 ₺ bakiye ile açılır." />
      ) : null}

      <AppConfirmSheet
        visible={confirmPayload != null}
        title="Başlangıç bakiyesini onayla"
        message="Kart, aşağıdaki bakiye ile oluşturulacak ve işlem bakiye geçmişine kaydedilecek."
        summary={
          confirmPayload
            ? [
                { label: "UID", value: confirmPayload.uid },
                { label: "Kart sahibi", value: [confirmPayload.first_name, confirmPayload.last_name].filter(Boolean).join(" ") || "—" },
                { label: "Başlangıç bakiyesi", value: formatCurrency(confirmPayload.balance) },
              ]
            : []
        }
        confirmLabel="Oluştur"
        loading={mutation.isPending}
        error={confirmPayload ? generalErrorOf(mutation.error, FIELDS) : null}
        onCancel={() => setConfirmPayload(null)}
        onConfirm={() => confirmPayload && mutation.run(confirmPayload)}
      />
    </AppSheet>
  );
}

const useStyles = makeStyles(() => StyleSheet.create({ flex: { flex: 1 } }));
