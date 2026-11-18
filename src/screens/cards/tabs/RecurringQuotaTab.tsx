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
  AppSelect,
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
import { formatInteger } from "@/utils/number";
import { formatDate, formatDateTime } from "@/utils/date";
import type { CreatedIdsResponse, QuotaPeriod, RecurringQuotaPayload, RecurringQuotaRule, RecurringTargetType } from "@/types/cards";
import { cardKeys } from "../hooks/cardKeys";
import { fieldErrorsOf, generalErrorOf, useLockedMutation } from "../hooks/useLockedMutation";
import { ActiveBadge, DateField, ListFooter, RuleRow, apiDateToUser, userDateToApi } from "../components/Common";
import { CardPicker, GroupPicker, type PickedRef } from "../components/Pickers";
import { QUOTA_PERIOD_LABELS, normalizeProductNo, validatePositiveInt } from "../components/format";
import { useOnOpen } from "../hooks/useOnOpen";

const PERIOD_OPTIONS = (Object.keys(QUOTA_PERIOD_LABELS) as QuotaPeriod[]).map((k) => ({ value: k, label: QUOTA_PERIOD_LABELS[k] }));

function productText(p: string) {
  return p === "*" ? "Tüm ürünler" : `Ürün ${p}`;
}

/** İstihkak yenileme kuralları (`recurring-quota/`, 25'lik sayfa) */
export function RecurringQuotaTab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 350).trim();
  const [form, setForm] = useState<{ rule: RecurringQuotaRule | null } | null>(null);

  const list = usePagedList<RecurringQuotaRule>({
    queryKey: cardKeys.recurringQuota({ q: debounced }),
    fetchPage: (page, signal) => cardsApi.recurringQuota.list({ page, q: debounced }, signal),
  });

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <AppSearchField value={q} onChangeText={setQ} placeholder="Kural, kart UID veya grup ara" testID="rq-search" />
        <View style={styles.toolbar}>
          <AppText variant="caption" color="textTertiary" style={styles.flex}>
            {list.firstPage ? `${formatInteger(list.total)} kural` : " "}
          </AppText>
          <AppButton size="sm" icon="plus" title="Yeni kural" onPress={() => setForm({ rule: null })} testID="rq-create" />
        </View>
      </View>
      {list.isLoading ? (
        <AppListSkeleton rows={5} />
      ) : list.isError ? (
        <AppErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : (
        <FlatList
          testID="rq-list"
          data={list.items}
          keyExtractor={(r) => String(r.id)}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={list.isRefreshing} onRefresh={list.refresh} tintColor={colors.primary} colors={[colors.primary]} />}
          renderItem={({ item }) => (
            <RuleRow
              testID={`rq-row-${item.id}`}
              title={item.name}
              badge={<ActiveBadge active={item.is_active} />}
              subtitle={`${item.group_name ?? "—"} · ${item.target_type === "card" ? `Kart ${item.target_card_uid ?? "—"}` : "Grubun tüm kartları"}`}
              meta={`${productText(item.product_no)} · Sonraki: ${formatDateTime(item.next_run)}`}
              right={
                <>
                  <AppText variant="numeric">{formatInteger(item.quantity)} adet</AppText>
                  <AppText variant="caption" color="textTertiary">
                    {item.period_display ?? QUOTA_PERIOD_LABELS[item.period]}
                  </AppText>
                </>
              }
              onPress={() => setForm({ rule: item })}
            />
          )}
          ListEmptyComponent={
            <AppEmptyState
              icon="refresh-cw"
              title={debounced ? "Eşleşen kural yok" : "İstihkak yenileme kuralı yok"}
              description={debounced ? undefined : "Grup veya kart istihkaklarını dönemsel olarak otomatik yenileyin."}
            />
          }
          ListFooterComponent={<ListFooter loading={list.isFetchingMore} />}
        />
      )}
      <RecurringQuotaFormSheet state={form} onClose={() => setForm(null)} />
    </View>
  );
}

const FIELDS = ["name", "group", "product_no", "period", "quantity", "target_type", "target_card", "start_date", "description"];

interface FormState {
  name: string;
  group: PickedRef | null;
  target_type: RecurringTargetType;
  card: PickedRef | null;
  product_no: string;
  period: QuotaPeriod;
  quantity: string;
  start: string;
  is_active: boolean;
  description: string;
}

function initial(rule: RecurringQuotaRule | null): FormState {
  return {
    name: rule?.name ?? "",
    group: rule ? { id: rule.group, label: rule.group_name ?? `#${rule.group}` } : null,
    target_type: rule?.target_type ?? "group",
    card: rule?.target_card ? { id: rule.target_card, label: rule.target_card_uid ?? `#${rule.target_card}` } : null,
    product_no: rule?.product_no ?? "*",
    period: rule?.period ?? "monthly",
    quantity: rule ? String(rule.quantity) : "1",
    start: rule ? apiDateToUser(rule.start_date) : formatDate(new Date()),
    is_active: rule?.is_active ?? true,
    description: rule?.description ?? "",
  };
}

export function RecurringQuotaFormSheet({
  state,
  onClose,
}: {
  state: { rule: RecurringQuotaRule | null } | null;
  onClose: () => void;
}) {
  const styles = useStyles();
  const rule = state?.rule ?? null;
  const visible = state != null;
  const [f, setF] = useState<FormState>(() => initial(rule));
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [deleting, setDeleting] = useState(false);
  // Kaydedilmemiş değişiklik: kapatırken onay iste
  const dirty = useFormDirty(visible, f);
  const guardedClose = useGuardedClose(dirty, onClose);

  useOnOpen(visible, () => {
    setF(initial(rule));
    setErrors({});
    setDeleting(false);
  });

  const save = useLockedMutation<RecurringQuotaRule | CreatedIdsResponse, Partial<RecurringQuotaPayload>>({
    mutationFn: (payload) =>
      rule ? cardsApi.recurringQuota.update(rule.id, payload) : cardsApi.recurringQuota.create(payload as RecurringQuotaPayload),
    successMessage: (res) =>
      rule ? "Kural güncellendi." : "detail" in res && res.detail ? res.detail : "Kural oluşturuldu.",
    onSuccess: onClose,
    onError: (err) => {
      const fe = fieldErrorsOf(err);
      const mapped: Record<string, string> = {};
      for (const k of FIELDS) if (fe[k]) mapped[k === "target_card" ? "card" : k] = fe[k];
      if (Object.keys(mapped).length) setErrors(mapped);
    },
  });
  const remove = useLockedMutation({
    mutationFn: (id: number) => cardsApi.recurringQuota.remove(id),
    successMessage: "Kural silindi.",
    onSuccess: () => {
      setDeleting(false);
      onClose();
    },
  });

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setF((s) => ({ ...s, [key]: value }));
    setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = () => {
    const errs: Record<string, string> = {};
    const name = f.name.trim();
    if (!name) errs.name = "Kural adı zorunludur.";
    else if (name.length > 100) errs.name = "Kural adı en fazla 100 karakter olabilir.";
    if (!f.group) errs.group = "Grup seçimi zorunludur.";
    if (f.target_type === "card" && !f.card) errs.card = "Kart seçin.";
    const pn = normalizeProductNo(f.product_no);
    if ("error" in pn) errs.product_no = pn.error;
    const qty = validatePositiveInt(f.quantity);
    if ("error" in qty) errs.quantity = qty.error;
    const start = userDateToApi(f.start);
    if (!start) errs.start_date = "Geçerli bir tarih girin (GG.AA.YYYY).";
    setErrors(errs);
    if (Object.keys(errs).length || !f.group || !("value" in pn) || !("value" in qty) || !start) return;

    const full: RecurringQuotaPayload = {
      name,
      group: f.group.id,
      product_no: pn.value,
      period: f.period,
      quantity: qty.value,
      target_type: f.target_type,
      target_card: f.target_type === "card" && f.card ? f.card.id : null,
      is_active: f.is_active,
      // İlk yenileme bu günün 00:00'ında; `next_run` sunucuda hesaplanır (yazılabilir değil)
      start_date: start,
      description: f.description.trim() || null,
    };
    if (!rule) {
      save.run(full);
      return;
    }
    // PATCH grup değiştirmez (views:899-916) — grup salt okunur
    const patch: Partial<RecurringQuotaPayload> = {};
    if (full.name !== rule.name) patch.name = full.name;
    if (full.product_no !== rule.product_no) patch.product_no = full.product_no;
    if (full.period !== rule.period) patch.period = full.period;
    if (full.quantity !== rule.quantity) patch.quantity = full.quantity;
    if (full.is_active !== rule.is_active) patch.is_active = full.is_active;
    if (full.start_date !== rule.start_date) patch.start_date = full.start_date;
    if ((full.description ?? "") !== (rule.description ?? "")) patch.description = full.description;
    if (full.target_type !== rule.target_type || full.target_card !== rule.target_card) {
      patch.target_type = full.target_type;
      patch.target_card = full.target_card;
    }
    if (Object.keys(patch).length === 0) {
      toast.info("Değişiklik yapılmadı.");
      onClose();
      return;
    }
    save.run(patch);
  };

  const general = generalErrorOf(save.error, [...FIELDS, "card"]);

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      dirty={dirty}
      title={rule ? "Yenileme kuralını düzenle" : "Yeni istihkak yenileme kuralı"}
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
              testID="rq-delete"
            />
          ) : (
            <AppButton title="Vazgeç" variant="outline" onPress={guardedClose} style={styles.flex} />
          )}
          <AppButton title="Kaydet" onPress={submit} loading={save.isPending} style={styles.flex} testID="rq-submit" />
        </>
      }
    >
      {general ? <AppNotice tone="danger" title="Kaydedilemedi" message={general} /> : null}
      <AppInput label="Kural adı" required value={f.name} onChangeText={(t) => set("name", t)} maxLength={100} error={errors.name} testID="rq-name" />
      <GroupPicker
        value={f.group}
        onChange={(g) => {
          set("group", g);
          set("card", null);
        }}
        required
        disabled={rule != null}
        error={errors.group}
        testID="rq-group"
      />
      <View style={styles.group}>
        <AppText variant="label" color="textSecondary">Hedef</AppText>
        <AppSegmented<RecurringTargetType>
          items={[
            { key: "group", label: "Grubun tüm kartları" },
            { key: "card", label: "Tek kart" },
          ]}
          value={f.target_type}
          onChange={(k) => set("target_type", k)}
        />
      </View>
      {f.target_type === "card" ? (
        <CardPicker
          value={f.card}
          onChange={(c) => set("card", c)}
          groupId={f.group?.id ?? null}
          disabled={!f.group}
          required
          error={errors.card ?? (!f.group ? "Önce grup seçin." : null)}
          testID="rq-card"
        />
      ) : null}
      <AppInput
        label="Ürün no"
        value={f.product_no}
        onChangeText={(t) => set("product_no", t)}
        autoCapitalize="none"
        helper={rule ? "* · 12 · 1,2,3 · 20-40" : "* tüm ürünler · 12 · 1,2,3 · 20-40 (her parça ayrı kural olur)"}
        error={errors.product_no}
        testID="rq-product"
      />
      <AppSelect<QuotaPeriod> label="Periyot" value={f.period} onChange={(v) => set("period", v)} options={PERIOD_OPTIONS} required />
      <AppInput
        label="Miktar (adet)"
        required
        value={f.quantity}
        onChangeText={(t) => set("quantity", t)}
        keyboardType="number-pad"
        error={errors.quantity}
        testID="rq-quantity"
      />
      <DateField
        label="İlk yenileme tarihi"
        required
        value={f.start}
        onChangeText={(t) => set("start", t)}
        error={errors.start_date}
        helper={
          rule
            ? `Sonraki çalışma (sunucu): ${formatDateTime(rule.next_run)}`
            : "İlk yenileme bu günün 00:00'ında yapılır; sonrakiler periyoda göre sunucuda hesaplanır."
        }
        testID="rq-start"
      />
      <AppSwitchRow label="Kural aktif" value={f.is_active} onChange={(v) => set("is_active", v)} />
      <AppInput label="Açıklama" value={f.description} onChangeText={(t) => set("description", t)} multiline error={errors.description} />

      <AppConfirmSheet
        visible={deleting}
        title="Kuralı sil"
        message="Kural silinir; istihkaklar bundan sonra otomatik yenilenmez."
        summary={rule ? [{ label: "Kural", value: rule.name }, { label: "Grup", value: rule.group_name ?? "—" }] : []}
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
