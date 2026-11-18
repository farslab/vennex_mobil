import React, { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import {
  AppButton,
  AppConfirmSheet,
  AppEmptyState,
  AppErrorState,
  AppInput,
  AppListSkeleton,
  AppNotice,
  AppSearchField,
  AppSegmented,
  AppSheet,
  AppSwitchRow,
  AppText,
  makeStyles,
  toast,
  useTheme,
  useFormDirty,
  useGuardedClose,
} from "@/design-system";
import { cardsApi } from "@/api/cards";
import { errorMessage } from "@/api/client";
import { usePagedList } from "@/hooks/usePagedList";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency, formatInteger, toApiDecimal } from "@/utils/number";
import { formatDate, formatDateTime } from "@/utils/date";
import type {
  RecurringBalancePayload,
  RecurringBalanceRule,
  RecurringPeriod,
  RecurringTargetType,
  RecurringUpdateType,
} from "@/types/cards";
import { cardKeys } from "../hooks/cardKeys";
import { useCardAccess } from "../hooks/useCardAccess";
import { fieldErrorsOf, generalErrorOf, useLockedMutation } from "../hooks/useLockedMutation";
import { ActiveBadge, DateField, ListFooter, RuleRow, apiDateToUser, userDateToApi } from "../components/Common";
import { CardPicker, GroupPicker, type PickedRef } from "../components/Pickers";
import { RECURRING_PERIOD_LABELS, UPDATE_TYPE_LABELS, validateAmount } from "../components/format";
import { useOnOpen } from "../hooks/useOnOpen";

function targetLabel(rule: RecurringBalanceRule): string {
  return rule.target_type === "card"
    ? `Kart: ${rule.target_card_uid ?? "—"}`
    : `Grup: ${rule.target_group_name ?? "—"}`;
}

/** Periyodik bakiye yükleme kuralları (`recurring-balance/`, 25'lik sayfa) */
export function RecurringBalanceTab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const access = useCardAccess();
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 350).trim();
  const [form, setForm] = useState<{ rule: RecurringBalanceRule | null } | null>(null);

  const list = usePagedList<RecurringBalanceRule>({
    queryKey: cardKeys.recurringBalance({ q: debounced }),
    fetchPage: (page, signal) => cardsApi.recurringBalance.list({ page, q: debounced }, signal),
  });

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <AppSearchField value={q} onChangeText={setQ} placeholder="Kural, kart UID veya grup ara" testID="rb-search" />
        <View style={styles.toolbar}>
          <AppText variant="caption" color="textTertiary" style={styles.flex}>
            {list.firstPage ? `${formatInteger(list.total)} kural` : " "}
          </AppText>
          {access.canChangeBalance ? (
            <AppButton size="sm" icon="plus" title="Yeni kural" onPress={() => setForm({ rule: null })} testID="rb-create" />
          ) : null}
        </View>
        {!access.canChangeBalance ? (
          <AppNotice tone="info" message="Bakiye değiştirme yetkiniz olmadığı için kuralları yalnızca görüntüleyebilirsiniz." />
        ) : null}
      </View>
      {list.isLoading ? (
        <AppListSkeleton rows={5} />
      ) : list.isError ? (
        <AppErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : (
        <FlatList
          testID="rb-list"
          data={list.items}
          keyExtractor={(r) => String(r.id)}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={list.isRefreshing} onRefresh={list.refresh} tintColor={colors.primary} colors={[colors.primary]} />}
          renderItem={({ item }) => (
            <RuleRow
              testID={`rb-row-${item.id}`}
              title={item.name}
              badge={<ActiveBadge active={item.is_active} />}
              subtitle={`${targetLabel(item)} · ${RECURRING_PERIOD_LABELS[item.period]}`}
              meta={`Sonraki: ${formatDateTime(item.next_run)} · ${formatInteger(item.run_count)} kez çalıştı`}
              right={
                <>
                  <AppText variant="numeric">{formatCurrency(item.amount)}</AppText>
                  <AppText variant="caption" color="textTertiary">
                    {item.update_type === "set" ? "Ata" : "Ekle"}
                  </AppText>
                </>
              }
              onPress={access.canChangeBalance ? () => setForm({ rule: item }) : undefined}
            />
          )}
          ListEmptyComponent={
            <AppEmptyState
              icon="repeat"
              title={debounced ? "Eşleşen kural yok" : "Bakiye yükleme kuralı yok"}
              description={debounced ? undefined : "Kartlara veya gruplara günlük, haftalık ya da aylık otomatik bakiye yükleyin."}
            />
          }
          ListFooterComponent={<ListFooter loading={list.isFetchingMore} />}
        />
      )}
      <RecurringBalanceFormSheet state={form} onClose={() => setForm(null)} />
    </View>
  );
}

const FIELDS = ["name", "amount", "update_type", "period", "target_type", "target_card", "target_group", "start_date", "description"];

interface FormState {
  name: string;
  amount: string;
  update_type: RecurringUpdateType;
  period: RecurringPeriod;
  target_type: RecurringTargetType;
  card: PickedRef | null;
  group: PickedRef | null;
  start: string;
  is_active: boolean;
  description: string;
}

function initial(rule: RecurringBalanceRule | null): FormState {
  return {
    name: rule?.name ?? "",
    amount: rule ? String(rule.amount).replace(".", ",") : "",
    update_type: rule?.update_type ?? "add",
    period: rule?.period ?? "monthly",
    target_type: rule?.target_type ?? "group",
    card: rule?.target_card ? { id: rule.target_card, label: rule.target_card_uid ?? `#${rule.target_card}` } : null,
    group: rule?.target_group ? { id: rule.target_group, label: rule.target_group_name ?? `#${rule.target_group}` } : null,
    start: rule ? apiDateToUser(rule.start_date) : formatDate(new Date()),
    is_active: rule?.is_active ?? true,
    description: rule?.description ?? "",
  };
}

type Errors = Partial<Record<string, string>>;

export function RecurringBalanceFormSheet({
  state,
  onClose,
}: {
  state: { rule: RecurringBalanceRule | null } | null;
  onClose: () => void;
}) {
  const styles = useStyles();
  const rule = state?.rule ?? null;
  const visible = state != null;
  const [f, setF] = useState<FormState>(() => initial(rule));
  const [errors, setErrors] = useState<Errors>({});
  const [pending, setPending] = useState<{ payload: Partial<RecurringBalancePayload>; full: RecurringBalancePayload } | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Kaydedilmemiş değişiklik: kapatırken onay iste
  const dirty = useFormDirty(visible, f);
  const guardedClose = useGuardedClose(dirty, onClose);

  useOnOpen(visible, () => {
    setF(initial(rule));
    setErrors({});
    setPending(null);
    setDeleting(false);
  });

  const save = useLockedMutation({
    mutationFn: (payload: Partial<RecurringBalancePayload>) =>
      rule ? cardsApi.recurringBalance.update(rule.id, payload) : cardsApi.recurringBalance.create(payload as RecurringBalancePayload),
    successMessage: rule ? "Bakiye yükleme kuralı güncellendi." : "Bakiye yükleme kuralı oluşturuldu.",
    onSuccess: () => {
      setPending(null);
      onClose();
    },
    onError: (err) => {
      const fe = fieldErrorsOf(err);
      const mapped: Errors = {};
      for (const k of FIELDS) if (fe[k]) mapped[k === "target_card" || k === "target_group" ? "target" : k] = fe[k];
      if (Object.keys(mapped).length) {
        setErrors(mapped);
        setPending(null);
      }
    },
  });

  const remove = useLockedMutation({
    mutationFn: (id: number) => cardsApi.recurringBalance.remove(id),
    successMessage: "Kural silindi.",
    onSuccess: () => {
      setDeleting(false);
      onClose();
    },
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setF((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key === "card" || key === "group" ? "target" : key]: undefined }));
  };

  const submit = () => {
    const errs: Errors = {};
    const name = f.name.trim();
    if (!name) errs.name = "Kural adı zorunludur.";
    else if (name.length > 100) errs.name = "Kural adı en fazla 100 karakter olabilir.";
    const amount = validateAmount(f.amount, { allowZero: f.update_type === "set" });
    if ("error" in amount) errs.amount = amount.error;
    const start = userDateToApi(f.start);
    if (!start) errs.start_date = "Geçerli bir tarih girin (GG.AA.YYYY).";
    const target = f.target_type === "card" ? f.card : f.group;
    if (!target) errs.target = f.target_type === "card" ? "Kart seçin." : "Grup seçin.";
    setErrors(errs);
    if (Object.keys(errs).length || !("value" in amount) || !start || !target) return;

    const full: RecurringBalancePayload = {
      name,
      amount: toApiDecimal(amount.value),
      update_type: f.update_type,
      period: f.period,
      target_type: f.target_type,
      target_card: f.target_type === "card" ? target.id : null,
      target_group: f.target_type === "group" ? target.id : null,
      is_active: f.is_active,
      // İlk çalışma bu günün 00:00'ında; backend `next_run`'ı buradan hesaplar (yazılabilir alan değil)
      start_date: start,
      description: f.description.trim() || null,
    };
    let payload: Partial<RecurringBalancePayload> = full;
    if (rule) {
      const patch: Partial<RecurringBalancePayload> = {};
      if (full.name !== rule.name) patch.name = full.name;
      if (Number(full.amount) !== Number(rule.amount)) patch.amount = full.amount;
      if (full.update_type !== rule.update_type) patch.update_type = full.update_type;
      if (full.period !== rule.period) patch.period = full.period;
      if (full.is_active !== rule.is_active) patch.is_active = full.is_active;
      if (full.start_date !== rule.start_date) patch.start_date = full.start_date;
      if ((full.description ?? "") !== (rule.description ?? "")) patch.description = full.description;
      const targetChanged =
        full.target_type !== rule.target_type ||
        (full.target_type === "card" ? full.target_card !== rule.target_card : full.target_group !== rule.target_group);
      // Backend hedefi yalnız `target_type` geldiğinde işler (views:675-687)
      if (targetChanged) Object.assign(patch, { target_type: full.target_type, target_card: full.target_card, target_group: full.target_group });
      if (Object.keys(patch).length === 0) {
        toast.info("Değişiklik yapılmadı.");
        onClose();
        return;
      }
      payload = patch;
    }
    save.reset();
    setPending({ payload, full });
  };

  const targetText = f.target_type === "card" ? f.card?.label : f.group?.label;

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      dirty={dirty}
      title={rule ? "Bakiye kuralını düzenle" : "Yeni bakiye yükleme kuralı"}
      dismissible={!save.isPending}
      footer={
        <>
          {rule ? (
            <AppButton
              title="Sil"
              variant="dangerOutline"
              icon="trash-2"
              onPress={() => {
                remove.reset();
                setDeleting(true);
              }}
              style={styles.flex}
              testID="rb-delete"
            />
          ) : (
            <AppButton title="Vazgeç" variant="outline" onPress={guardedClose} style={styles.flex} />
          )}
          <AppButton title="Devam" onPress={submit} style={styles.flex} testID="rb-submit" />
        </>
      }
    >
      {!pending && generalErrorOf(save.error, FIELDS) ? (
        <AppNotice tone="danger" title="Kaydedilemedi" message={generalErrorOf(save.error, FIELDS) ?? ""} />
      ) : null}
      <AppInput label="Kural adı" required value={f.name} onChangeText={(t) => set("name", t)} maxLength={100} error={errors.name} testID="rb-name" />
      <View style={styles.group}>
        <AppText variant="label" color="textSecondary">İşlem</AppText>
        <AppSegmented<RecurringUpdateType>
          items={[
            { key: "add", label: UPDATE_TYPE_LABELS.add },
            { key: "set", label: UPDATE_TYPE_LABELS.set },
          ]}
          value={f.update_type}
          onChange={(k) => set("update_type", k)}
        />
      </View>
      <AppInput
        label="Tutar"
        required
        value={f.amount}
        onChangeText={(t) => set("amount", t)}
        keyboardType="decimal-pad"
        suffix="₺"
        placeholder="0,00"
        error={errors.amount}
        testID="rb-amount"
      />
      <View style={styles.group}>
        <AppText variant="label" color="textSecondary">Periyot</AppText>
        <AppSegmented<RecurringPeriod>
          items={(["daily", "weekly", "monthly"] as const).map((k) => ({ key: k, label: RECURRING_PERIOD_LABELS[k] }))}
          value={f.period}
          onChange={(k) => set("period", k)}
        />
      </View>
      <View style={styles.group}>
        <AppText variant="label" color="textSecondary">Hedef</AppText>
        <AppSegmented<RecurringTargetType>
          items={[
            { key: "group", label: "Kart grubu" },
            { key: "card", label: "Tek kart" },
          ]}
          value={f.target_type}
          onChange={(k) => set("target_type", k)}
          testID="rb-target-type"
        />
      </View>
      {f.target_type === "group" ? (
        <GroupPicker value={f.group} onChange={(g) => set("group", g)} required error={errors.target} testID="rb-group" />
      ) : (
        <CardPicker value={f.card} onChange={(c) => set("card", c)} required error={errors.target} testID="rb-card" />
      )}
      <DateField
        label="İlk yükleme tarihi"
        required
        value={f.start}
        onChangeText={(t) => set("start", t)}
        error={errors.start_date}
        helper={
          rule
            ? `Sonraki çalışma (sunucu): ${formatDateTime(rule.next_run)}. Tarih değişikliği, periyot değişmedikçe sonraki çalışmayı güncellemeyebilir.`
            : "İlk yükleme bu günün 00:00'ında yapılır; sonrakiler periyoda göre sunucuda hesaplanır."
        }
        testID="rb-start"
      />
      <AppSwitchRow label="Kural aktif" value={f.is_active} onChange={(v) => set("is_active", v)} />
      <AppInput
        label="Açıklama"
        value={f.description}
        onChangeText={(t) => set("description", t)}
        multiline
        error={errors.description}
      />

      <AppConfirmSheet
        visible={pending != null}
        title={rule ? "Kural değişikliğini onayla" : "Bakiye kuralını onayla"}
        message={
          pending
            ? `${RECURRING_PERIOD_LABELS[pending.full.period]} olarak ${pending.full.update_type === "set" ? "bakiye sıfırlanıp" : "bakiyeye"} ${formatCurrency(pending.full.amount)} ${pending.full.update_type === "set" ? "atanır" : "eklenir"}.`
            : undefined
        }
        summary={
          pending
            ? [
                { label: "Kural", value: pending.full.name },
                { label: "Hedef", value: `${pending.full.target_type === "card" ? "Kart" : "Grup"}: ${targetText ?? "—"}` },
                { label: "İşlem", value: UPDATE_TYPE_LABELS[pending.full.update_type] },
                { label: "Tutar", value: formatCurrency(pending.full.amount) },
                { label: "Periyot", value: RECURRING_PERIOD_LABELS[pending.full.period] },
                { label: "İlk yükleme", value: apiDateToUser(pending.full.start_date) },
                { label: "Durum", value: pending.full.is_active ? "Aktif" : "Pasif" },
              ]
            : []
        }
        confirmLabel={rule ? "Kaydet" : "Kuralı oluştur"}
        loading={save.isPending}
        error={pending ? generalErrorOf(save.error, FIELDS) : null}
        onCancel={() => setPending(null)}
        onConfirm={() => pending && save.run(pending.payload)}
      />
      <AppConfirmSheet
        visible={deleting}
        title="Kuralı sil"
        message="Kural silinir; bundan sonra otomatik bakiye yüklemesi yapılmaz. Daha önce yapılan yüklemeler geri alınmaz."
        summary={rule ? [{ label: "Kural", value: rule.name }, { label: "Tutar", value: formatCurrency(rule.amount) }] : []}
        confirmLabel="Sil"
        destructive
        irreversible
        loading={remove.isPending}
        error={generalErrorOf(remove.error)}
        onCancel={() => setDeleting(false)}
        onConfirm={() => rule && remove.run(rule.id)}
      />
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    header: { gap: t.spacing.sm, paddingHorizontal: t.layout.screenPadding, paddingTop: t.spacing.md, paddingBottom: t.spacing.sm },
    toolbar: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    group: { gap: t.spacing.xs },
  })
);
