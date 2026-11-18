import React, { useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import {
  AppButton,
  AppConfirmSheet,
  AppEmptyState,
  AppErrorState,
  AppIconButton,
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
import type { CardQuota, CardQuotaCreatePayload, PersonnelCard, QuotaPeriod } from "@/types/cards";
import { cardKeys } from "../hooks/cardKeys";
import { fieldErrorsOf, generalErrorOf, useLockedMutation } from "../hooks/useLockedMutation";
import { ActiveBadge, ListFooter, RuleRow } from "../components/Common";
import { CardPicker, GroupPicker, type PickedRef } from "../components/Pickers";
import { GroupFilterSheet, type GroupFilter } from "../components/GroupFilterSheet";
import { QuotaBatchSheet } from "../components/QuotaBatchSheet";
import { QUOTA_PERIOD_LABELS, normalizeProductNo, validatePositiveInt } from "../components/format";
import { useOnOpen, useOnValueChange } from "../hooks/useOnOpen";

export const QUOTA_PERIOD_OPTIONS = (Object.keys(QUOTA_PERIOD_LABELS) as QuotaPeriod[]).map((k) => ({
  value: k,
  label: QUOTA_PERIOD_LABELS[k],
}));

function productText(p: string) {
  return p === "*" ? "Tüm ürünler" : `Ürün ${p}`;
}

/** İstihkak (kart kotası) listesi: arama + grup filtresi, 25'lik sayfa */
export function CardQuotasTab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 350).trim();
  const [group, setGroup] = useState<GroupFilter | null>(null);
  const [groupSheet, setGroupSheet] = useState(false);
  const [editing, setEditing] = useState<CardQuota | null>(null);
  const [creating, setCreating] = useState(false);

  const filters = { q: debounced, group_id: group?.id ?? null };
  const list = usePagedList<CardQuota>({
    queryKey: cardKeys.quotas(filters),
    fetchPage: (page, signal) => cardsApi.quotas.list({ ...filters, page }, signal),
  });

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <AppSearchField value={q} onChangeText={setQ} placeholder="Kart UID, ad veya grup ara" testID="quota-search" />
        <View style={styles.toolbar}>
          <AppButton
            size="sm"
            variant={group ? "secondary" : "outline"}
            icon="filter"
            title={group ? group.name : "Tüm gruplar"}
            onPress={() => setGroupSheet(true)}
            style={styles.grow}
          />
          {group ? <AppIconButton icon="x" label="Grup filtresini kaldır" onPress={() => setGroup(null)} /> : null}
          <AppButton size="sm" icon="plus" title="Yeni istihkak" onPress={() => setCreating(true)} testID="quota-create" />
        </View>
        {list.firstPage ? (
          <AppText variant="caption" color="textTertiary">
            {formatInteger(list.total)} istihkak
          </AppText>
        ) : null}
      </View>
      {list.isLoading ? (
        <AppListSkeleton rows={5} />
      ) : list.isError ? (
        <AppErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />
      ) : (
        <FlatList
          testID="quota-list"
          data={list.items}
          keyExtractor={(r) => String(r.id)}
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.5}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={list.isRefreshing} onRefresh={list.refresh} tintColor={colors.primary} colors={[colors.primary]} />}
          renderItem={({ item }) => (
            <RuleRow
              testID={`quota-row-${item.id}`}
              title={item.card_uid ?? `Kart #${item.card}`}
              badge={<ActiveBadge active={item.is_active} />}
              subtitle={`${item.group_name ?? "Grup yok"} · ${productText(item.product_no)}`}
              right={
                <>
                  <AppText variant="numeric">{formatInteger(item.quantity)} adet</AppText>
                  <AppText variant="caption" color="textTertiary">
                    {item.period_display ?? QUOTA_PERIOD_LABELS[item.period]}
                  </AppText>
                </>
              }
              onPress={() => setEditing(item)}
            />
          )}
          ListEmptyComponent={
            <AppEmptyState
              icon="package"
              title={debounced || group ? "Eşleşen istihkak yok" : "Tanımlı istihkak yok"}
              description={debounced || group ? undefined : "Kartlara ürün bazlı dönemsel kullanım hakkı tanımlayın."}
            />
          }
          ListFooterComponent={<ListFooter loading={list.isFetchingMore} />}
        />
      )}

      <GroupFilterSheet
        visible={groupSheet}
        selectedId={group?.id ?? null}
        onClose={() => setGroupSheet(false)}
        onSelect={(g) => {
          setGroup(g);
          setGroupSheet(false);
        }}
      />
      <QuotaEditSheet quota={editing} onClose={() => setEditing(null)} />
      <QuotaCreateSheet visible={creating} onClose={() => setCreating(false)} />
    </View>
  );
}

/** PATCH yalnız miktar ve aktiflik (views/personnel_cards.py:785-795) */
function QuotaEditSheet({ quota, onClose }: { quota: CardQuota | null; onClose: () => void }) {
  const styles = useStyles();
  const [quantity, setQuantity] = useState("");
  const [active, setActive] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  // Kaydedilmemiş değişiklik: kapatırken onay iste
  const dirty = useFormDirty(quota != null, { quantity, active });

  useOnValueChange(quota, (q) => {
    if (!q) return;
    setQuantity(String(q.quantity));
    setActive(q.is_active);
    setError(null);
    setDeleting(false);
  });

  const save = useLockedMutation({
    mutationFn: (vars: { id: number; quantity?: number; is_active?: boolean }) =>
      cardsApi.quotas.update(vars.id, { quantity: vars.quantity, is_active: vars.is_active }),
    successMessage: "İstihkak güncellendi.",
    onSuccess: onClose,
    onError: (err) => {
      const fe = fieldErrorsOf(err);
      if (fe.quantity) setError(fe.quantity);
    },
  });
  const remove = useLockedMutation({
    mutationFn: (id: number) => cardsApi.quotas.remove(id),
    successMessage: "İstihkak silindi.",
    onSuccess: () => {
      setDeleting(false);
      onClose();
    },
  });

  const submit = () => {
    if (!quota) return;
    const res = validatePositiveInt(quantity);
    if ("error" in res) return setError(res.error);
    const vars: { id: number; quantity?: number; is_active?: boolean } = { id: quota.id };
    if (res.value !== quota.quantity) vars.quantity = res.value;
    if (active !== quota.is_active) vars.is_active = active;
    if (vars.quantity == null && vars.is_active == null) {
      toast.info("Değişiklik yapılmadı.");
      onClose();
      return;
    }
    save.run(vars);
  };

  return (
    <AppSheet
      visible={quota != null}
      onClose={onClose}
      dirty={dirty}
      title="İstihkakı düzenle"
      subtitle={quota ? `${quota.card_uid ?? `Kart #${quota.card}`} · ${quota.group_name ?? ""}` : undefined}
      dismissible={!save.isPending}
      footer={
        <>
          <AppButton
            title="Sil"
            variant="dangerOutline"
            icon="trash-2"
            onPress={() => {
              remove.reset();
              setDeleting(true);
            }}
            style={styles.flex}
            testID="quota-delete"
          />
          <AppButton title="Kaydet" onPress={submit} loading={save.isPending} style={styles.flex} testID="quota-edit-submit" />
        </>
      }
    >
      {generalErrorOf(save.error, ["quantity"]) ? (
        <AppNotice tone="danger" message={generalErrorOf(save.error, ["quantity"]) ?? ""} />
      ) : null}
      {quota ? (
        <AppNotice
          tone="info"
          message={`${productText(quota.product_no)} · ${quota.period_display ?? QUOTA_PERIOD_LABELS[quota.period]}. Ürün ve periyot değiştirilemez; gerekirse silip yeniden oluşturun.`}
        />
      ) : null}
      <AppInput
        label="Miktar (adet)"
        required
        value={quantity}
        onChangeText={(t) => {
          setQuantity(t);
          setError(null);
        }}
        keyboardType="number-pad"
        error={error}
        testID="quota-edit-quantity"
      />
      <AppSwitchRow label="İstihkak aktif" value={active} onChange={setActive} />
      <AppConfirmSheet
        visible={deleting}
        title="İstihkakı sil"
        summary={quota ? [{ label: "Kart", value: quota.card_uid ?? `#${quota.card}` }, { label: "Ürün", value: productText(quota.product_no) }] : []}
        confirmLabel="Sil"
        destructive
        irreversible
        loading={remove.isPending}
        error={generalErrorOf(remove.error)}
        onCancel={() => setDeleting(false)}
        onConfirm={() => quota && remove.run(quota.id)}
      />
    </AppSheet>
  );
}

type TargetMode = "card" | "group_all";
const CREATE_FIELDS = ["card", "group", "product_no", "period", "quantity", "is_active"];

function QuotaCreateSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const styles = useStyles();
  const [group, setGroup] = useState<PickedRef | null>(null);
  const [mode, setMode] = useState<TargetMode>("card");
  const [card, setCard] = useState<PickedRef | null>(null);
  const [productNo, setProductNo] = useState("*");
  const [period, setPeriod] = useState<QuotaPeriod>("monthly");
  const [quantity, setQuantity] = useState("1");
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string | undefined>>({});
  const [batch, setBatch] = useState<{ cards: PersonnelCard[]; base: Omit<CardQuotaCreatePayload, "card"> } | null>(null);
  const [loadingCards, setLoadingCards] = useState(false);
  // Kaydedilmemiş değişiklik: kapatırken onay iste
  const dirty = useFormDirty(visible, { group: group?.id ?? null, mode, card: card?.id ?? null, productNo, period, quantity, active });
  const guardedClose = useGuardedClose(dirty, onClose);

  useOnOpen(visible, () => {
    setGroup(null);
    setMode("card");
    setCard(null);
    setProductNo("*");
    setPeriod("monthly");
    setQuantity("1");
    setActive(true);
    setErrors({});
    setBatch(null);
  });

  const save = useLockedMutation({
    mutationFn: (payload: CardQuotaCreatePayload) => cardsApi.quotas.create(payload),
    successMessage: (res) => (res.created_ids.length > 0 ? res.detail || "İstihkak oluşturuldu." : null),
    onSuccess: (res) => {
      if (res.created_ids.length === 0) toast.info("Bu kart için aynı istihkak zaten tanımlı.");
      onClose();
    },
    onError: (err) => {
      const fe = fieldErrorsOf(err);
      const mapped: Record<string, string> = {};
      for (const k of CREATE_FIELDS) if (fe[k]) mapped[k] = fe[k];
      if (Object.keys(mapped).length) setErrors(mapped);
    },
  });

  const submit = async () => {
    const errs: Record<string, string> = {};
    if (!group) errs.group = "Grup seçimi zorunludur.";
    if (mode === "card" && !card) errs.card = "Kart seçin.";
    const pn = normalizeProductNo(productNo);
    if ("error" in pn) errs.product_no = pn.error;
    const qty = validatePositiveInt(quantity);
    if ("error" in qty) errs.quantity = qty.error;
    setErrors(errs);
    if (Object.keys(errs).length || !group || !("value" in pn) || !("value" in qty)) return;
    const base = { group: group.id, product_no: pn.value, period, quantity: qty.value, is_active: active };
    if (mode === "card" && card) {
      save.run({ ...base, card: card.id });
      return;
    }
    setLoadingCards(true);
    try {
      const cards = await cardsApi.allCardsInGroup(group.id);
      if (cards.length === 0) {
        setErrors({ group: "Bu grupta aktif kart yok." });
        return;
      }
      setBatch({ cards, base });
    } catch (e) {
      setErrors({ group: errorMessage(e) });
    } finally {
      setLoadingCards(false);
    }
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      dirty={dirty}
      title="Yeni istihkak"
      dismissible={!save.isPending && !loadingCards}
      footer={
        <>
          <AppButton title="Vazgeç" variant="outline" onPress={guardedClose} style={styles.flex} />
          <AppButton
            title={mode === "group_all" ? "Devam" : "Oluştur"}
            onPress={submit}
            loading={save.isPending || loadingCards}
            style={styles.flex}
            testID="quota-create-submit"
          />
        </>
      }
    >
      {generalErrorOf(save.error, CREATE_FIELDS) ? (
        <AppNotice tone="danger" title="Oluşturulamadı" message={generalErrorOf(save.error, CREATE_FIELDS) ?? ""} />
      ) : null}
      <GroupPicker
        value={group}
        onChange={(g) => {
          setGroup(g);
          setCard(null);
          setErrors((e) => ({ ...e, group: undefined }));
        }}
        required
        error={errors.group}
        testID="quota-group"
      />
      <AppSegmented<TargetMode>
        items={[
          { key: "card", label: "Tek kart" },
          { key: "group_all", label: "Gruptaki tüm kartlar" },
        ]}
        value={mode}
        onChange={setMode}
        testID="quota-mode"
      />
      {mode === "card" ? (
        <CardPicker
          value={card}
          onChange={(c) => {
            setCard(c);
            setErrors((e) => ({ ...e, card: undefined }));
          }}
          groupId={group?.id ?? null}
          disabled={!group}
          required
          error={errors.card ?? (!group ? "Önce grup seçin." : null)}
          testID="quota-card"
        />
      ) : (
        <AppNotice
          tone="warning"
          message="Toplu istihkak backend'de desteklenmiyor: gruptaki her aktif kart için ayrı istek gönderilir ve ilerleme tek tek gösterilir."
        />
      )}
      <AppInput
        label="Ürün no"
        value={productNo}
        onChangeText={(t) => {
          setProductNo(t);
          setErrors((e) => ({ ...e, product_no: undefined }));
        }}
        autoCapitalize="none"
        helper="* tüm ürünler · 12 · 1,2,3 · 20-40 (her parça ayrı istihkak)"
        error={errors.product_no}
        testID="quota-product"
      />
      <AppSelect<QuotaPeriod> label="Periyot" value={period} onChange={setPeriod} options={QUOTA_PERIOD_OPTIONS} required />
      <AppInput
        label="Miktar (adet)"
        required
        value={quantity}
        onChangeText={(t) => {
          setQuantity(t);
          setErrors((e) => ({ ...e, quantity: undefined }));
        }}
        keyboardType="number-pad"
        error={errors.quantity}
        testID="quota-quantity"
      />
      <AppSwitchRow label="İstihkak aktif" value={active} onChange={setActive} />

      <QuotaBatchSheet
        visible={batch != null}
        cards={batch?.cards ?? []}
        base={batch?.base ?? null}
        summary={
          batch
            ? [
                { label: "Grup", value: group?.label ?? "—" },
                { label: "Kart sayısı", value: `${batch.cards.length} kart` },
                { label: "Ürün", value: productText(batch.base.product_no) },
                { label: "Periyot", value: QUOTA_PERIOD_LABELS[batch.base.period] },
                { label: "Miktar", value: `${batch.base.quantity} adet` },
              ]
            : []
        }
        onClose={() => {
          setBatch(null);
          onClose();
        }}
      />
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    grow: { flexGrow: 1, flexShrink: 1 },
    header: { gap: t.spacing.sm, paddingHorizontal: t.layout.screenPadding, paddingTop: t.spacing.md, paddingBottom: t.spacing.sm },
    toolbar: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
  })
);
