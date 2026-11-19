/**
 * Satışlar — `GET pos-devices/{sn}/transactions/` filtreleri birebir (views/pos_devices.py:466-516):
 * start_date/end_date (YYYY-MM-DD; saat filtresi YOK), tx_status, pt_type, cancel_reason, card_last4.
 * 50'lik sabit sayfa, sonsuz kaydırma. Özet yanıttaki `summary`'den (tarih aralığına göre).
 */
import React, { useCallback, useMemo, useState } from "react";
import { useOnOpen } from "@/components/devices/useOnOpen";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import {
  AppBadge,
  AppButton,
  AppChip,
  AppEmptyState,
  AppErrorState,
  AppIconButton,
  AppInput,
  AppListSkeleton,
  AppNotice,
  AppSegmented,
  AppSelect,
  AppSheet,
  AppText,
  makeStyles,
  useTheme,
} from "@/design-system";
import { devicesApi } from "@/api/devices";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { usePagedList } from "@/hooks/usePagedList";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { MetricCell } from "@/components/devices/DeviceUi";
import {
  CANCEL_REASON_LABELS,
  DATE_PRESETS,
  PT_TYPE_OPTIONS,
  entryModeBadge,
  presetRange,
  ptBadge,
  txStatusLabel,
  type DatePreset,
} from "@/components/devices/deviceHelpers";
import { formatCurrency, formatInteger } from "@/utils/number";
import { businessToday, formatDate, formatDateTimeSeconds, parseUserDate, toApiDate } from "@/utils/date";
import type {
  CancelReasonFilter,
  PosTransaction,
  TransactionFilters,
  TransactionsResponse,
  TxStatusFilter,
} from "@/types/devices";
import { TransactionDetailSheet } from "../components/TransactionDetailSheet";
import { webBadgeColors } from "@/components/devices/webBadgeColors";
import { ListLoadMoreFooter } from "@/components/ListLoadMoreFooter";

type StatusKey = "all" | TxStatusFilter;

export interface SalesFilterState {
  preset: DatePreset;
  customStart: Date | null;
  customEnd: Date | null;
  status: StatusKey;
  ptType: number | null;
  cancelReason: CancelReasonFilter | null;
  cardLast4: string;
}

const INITIAL: SalesFilterState = {
  preset: "today",
  customStart: null,
  customEnd: null,
  status: "all",
  ptType: null,
  cancelReason: null,
  cardLast4: "",
};

/** UI filtresi → backend sorgu parametreleri (tarih her zaman açıkça gönderilir) */
export function toTransactionFilters(f: SalesFilterState, cardLast4: string, now: Date = businessToday()): TransactionFilters {
  const range =
    f.preset === "custom" && f.customStart && f.customEnd
      ? { start: f.customStart, end: f.customEnd }
      : presetRange(f.preset === "custom" ? "today" : f.preset, now);
  const last4 = cardLast4.trim();
  return {
    start_date: toApiDate(range.start),
    end_date: toApiDate(range.end),
    tx_status: f.status === "all" ? undefined : f.status,
    pt_type: f.ptType ?? undefined,
    cancel_reason: f.status === "fail" && f.cancelReason ? f.cancelReason : undefined,
    card_last4: /^\d{4}$/.test(last4) ? last4 : undefined,
  };
}

export function SalesTab({ sn }: { sn: string }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [filters, setFilters] = useState<SalesFilterState>(INITIAL);
  const [moreOpen, setMoreOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [selected, setSelected] = useState<PosTransaction | null>(null);
  const debouncedLast4 = useDebouncedValue(filters.cardLast4, 350);

  const params = useMemo(() => toTransactionFilters(filters, debouncedLast4), [filters, debouncedLast4]);

  const list = usePagedList<PosTransaction, TransactionsResponse>({
    queryKey: queryKeys.devices.transactions(sn, { ...params }),
    fetchPage: (page, signal) => devicesApi.transactions(sn, { ...params, page }, signal),
  });

  const summary = list.firstPage?.summary ?? null;
  const moreCount = (filters.ptType != null ? 1 : 0) + (filters.cancelReason && filters.status === "fail" ? 1 : 0) + (params.card_last4 ? 1 : 0);
  const rangeLabel =
    params.start_date === params.end_date
      ? formatDate(params.start_date ?? null)
      : `${formatDate(params.start_date ?? null)} – ${formatDate(params.end_date ?? null)}`;

  const renderItem = useCallback(
    ({ item }: { item: PosTransaction }) => <TxRow tx={item} onPress={setSelected} />,
    []
  );

  const header = (
    <View style={styles.header}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {DATE_PRESETS.map((p) => (
          <AppChip
            key={p.key}
            label={p.key === "custom" && filters.preset === "custom" ? rangeLabel : p.label}
            icon={p.key === "custom" ? "calendar" : undefined}
            selected={filters.preset === p.key}
            onPress={() => (p.key === "custom" ? setCustomOpen(true) : setFilters((f) => ({ ...f, preset: p.key })))}
          />
        ))}
      </ScrollView>
      <View style={styles.statusRow}>
        <View style={styles.flex}>
          <AppSegmented<StatusKey>
            testID="sales-status"
            value={filters.status}
            onChange={(status) => setFilters((f) => ({ ...f, status, cancelReason: status === "fail" ? f.cancelReason : null }))}
            items={[
              { key: "all", label: "Tümü" },
              { key: "success", label: "Başarılı" },
              { key: "fail", label: "Başarısız" },
            ]}
          />
        </View>
        <AppIconButton
          icon="filter"
          label={moreCount ? `Diğer filtreler, ${moreCount} etkin` : "Diğer filtreler"}
          badge={moreCount || undefined}
          onPress={() => setMoreOpen(true)}
          testID="sales-more-filters"
        />
      </View>

      <View style={styles.summary} testID="sales-summary">
        <View style={styles.summaryGrid}>
          <MetricCell label="İşlem" value={formatInteger(summary?.total)} />
          <MetricCell label="Başarılı" value={formatInteger(summary?.success)} />
          <MetricCell label="Başarısız" value={formatInteger(summary?.failed)} />
          <MetricCell label="Ciro" value={formatCurrency(summary?.revenue)} />
        </View>
        <AppText variant="caption" color="textTertiary">
          {rangeLabel} · özet tarih aralığına göredir, durum/ödeme filtrelerinden etkilenmez.
        </AppText>
      </View>
      {list.items.length > 0 ? (
        <AppText variant="overline" color="textTertiary" style={styles.listTitle}>
          {formatInteger(list.total)} kayıt
        </AppText>
      ) : null}
    </View>
  );

  return (
    <View style={styles.root} testID="tab-sales">
      <FlatList
        data={list.items}
        keyExtractor={(t) => String(t.id)}
        renderItem={renderItem}
        ListHeaderComponent={header}
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.5}
        initialNumToRender={15}
        ListEmptyComponent={
          list.isLoading ? (
            <AppListSkeleton rows={6} />
          ) : list.isError ? (
            <AppErrorState compact message={errorMessage(list.error)} onRetry={() => list.refetch()} />
          ) : (
            <AppEmptyState compact icon="credit-card" title="İşlem yok" description="Seçili tarih ve filtrelerde işlem bulunamadı." />
          )
        }
        ListFooterComponent={<ListLoadMoreFooter loading={list.isFetchingMore} error={list.loadMoreError} onRetry={list.retryLoadMore} />}
        refreshControl={<RefreshControl refreshing={list.isRefreshing} onRefresh={list.refresh} tintColor={colors.primary} colors={[colors.primary]} />}
      />

      <MoreFiltersSheet visible={moreOpen} value={filters} onClose={() => setMoreOpen(false)} onApply={setFilters} />
      <CustomRangeSheet
        visible={customOpen}
        onClose={() => setCustomOpen(false)}
        onApply={(start, end) => setFilters((f) => ({ ...f, preset: "custom", customStart: start, customEnd: end }))}
      />
      <TransactionDetailSheet
        tx={selected}
        onClose={() => setSelected(null)}
        sn={sn}
        receiptsEnabled={list.firstPage?.receipts_refund_enabled === true}
      />
    </View>
  );
}

/**
 * İşlem kartı — web POS cihazı sayfasının mobil görünümüyle aynı bilgi ve sıra:
 * kart no + ödeme tipi (+ okuma şekli) · durum / tarih-saat / ürün + ürün no · tutar / son iade durumu.
 * Karta dokununca detay (fiş + iade) açılır; ayrı "Detaylar" yazısı yok.
 */
function TxRow({ tx, onPress }: { tx: PosTransaction; onPress: (t: PosTransaction) => void }) {
  const styles = useStyles();
  const name = tx.display_name ?? "—";
  const pt = ptBadge(tx.pt_type);
  const entry = entryModeBadge(tx.pt_type, tx.entry_mode);
  const { isDark } = useTheme();
  const statusLabel = txStatusLabel(tx.status, tx.pt_type, tx.iptalNo);
  const when = formatDateTimeSeconds(tx.pt_datetime);
  const showProductNo = tx.product_no != null && tx.product_no !== 65535;
  return (
    <Pressable
      onPress={() => onPress(tx)}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${formatCurrency(tx.amount)}, ${statusLabel}, ${when}, ${pt.label}`}
      style={({ pressed }) => [styles.txCard, pressed && styles.pressed]}
      testID={`tx-row-${tx.id}`}
    >
      <View style={styles.txTop}>
        <View style={styles.txBadges}>
          {tx.pt_pan ? (
            <View style={[styles.panChip, tx.pt_type === 1 ? styles.panInfo : tx.pt_type === 5 ? styles.panSuccess : null]}>
              <AppText variant="mono" style={styles.panText}>
                {tx.pt_pan}
              </AppText>
            </View>
          ) : null}
          <AppBadge size="sm" label={pt.label} colors={webBadgeColors(pt.color, isDark)} />
          {entry ? <AppBadge size="sm" label={entry.label} colors={webBadgeColors(entry.color, isDark)} /> : null}
        </View>
        <AppBadge size="sm" tone={tx.status ? "success" : "danger"} label={statusLabel} />
      </View>
      <AppText variant="caption" color="textTertiary">
        {when}
      </AppText>
      <View style={styles.txBottom}>
        <View style={styles.flex}>
          <AppText variant="calloutStrong" numberOfLines={2}>
            {name}
          </AppText>
          {showProductNo ? (
            <AppText variant="caption" color="textTertiary">
              Ürün No {tx.product_no}
            </AppText>
          ) : null}
        </View>
        <AppText variant="numeric" style={styles.txAmount}>
          {formatCurrency(tx.amount)}
        </AppText>
      </View>
      {tx.refund_label ? (
        <View style={styles.txRr}>
          <AppBadge size="sm" tone="info" label={tx.refund_label} />
        </View>
      ) : null}
    </Pressable>
  );
}

function MoreFiltersSheet({
  visible,
  value,
  onClose,
  onApply,
}: {
  visible: boolean;
  value: SalesFilterState;
  onClose: () => void;
  onApply: (f: SalesFilterState) => void;
}) {
  const styles = useStyles();
  const [draft, setDraft] = useState(value);
  useOnOpen(visible, () => setDraft(value));

  const last4Error = draft.cardLast4 && !/^\d{4}$/.test(draft.cardLast4) ? "Kartın son 4 hanesini girin." : null;

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title="Diğer filtreler"
      footer={
        <>
          <AppButton
            title="Temizle"
            variant="outline"
            onPress={() => setDraft((d) => ({ ...d, ptType: null, cancelReason: null, cardLast4: "" }))}
            style={styles.flex}
          />
          <AppButton
            title="Uygula"
            testID="sales-filters-apply"
            disabled={!!last4Error}
            onPress={() => {
              onApply(draft);
              onClose();
            }}
            style={styles.flex}
          />
        </>
      }
    >
      <AppSelect<number>
        label="Ödeme türü"
        testID="sales-pt-type"
        options={[{ value: -1, label: "Tümü" }, ...PT_TYPE_OPTIONS]}
        value={draft.ptType ?? -1}
        onChange={(v) => setDraft((d) => ({ ...d, ptType: v === -1 ? null : v }))}
      />
      {draft.status === "fail" ? (
        <AppSelect<string>
          label="Hata nedeni"
          options={[{ value: "", label: "Tümü" }, ...Object.entries(CANCEL_REASON_LABELS).map(([v, l]) => ({ value: v, label: l }))]}
          value={draft.cancelReason ?? ""}
          onChange={(v) => setDraft((d) => ({ ...d, cancelReason: (v || null) as CancelReasonFilter | null }))}
        />
      ) : (
        <AppText variant="caption" color="textTertiary">
          Hata nedeni filtresi için durumu “Başarısız” seçin.
        </AppText>
      )}
      <AppInput
        label="Kartın son 4 hanesi"
        testID="sales-card-last4"
        value={draft.cardLast4}
        onChangeText={(t) => setDraft((d) => ({ ...d, cardLast4: t.replace(/\D/g, "").slice(0, 4) }))}
        keyboardType="number-pad"
        maxLength={4}
        error={last4Error}
        placeholder="1234"
      />
      <AppNotice tone="info" message="Saat aralığı filtresi API tarafından desteklenmiyor; filtreleme gün bazındadır." />
    </AppSheet>
  );
}

function CustomRangeSheet({
  visible,
  onClose,
  onApply,
}: {
  visible: boolean;
  onClose: () => void;
  onApply: (start: Date, end: Date) => void;
}) {
  const styles = useStyles();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [error, setError] = useState<string | null>(null);

  const apply = () => {
    const s = parseUserDate(start);
    const e = parseUserDate(end || start);
    if (!s || !e) return setError("Tarihleri GG.AA.YYYY biçiminde girin.");
    if (s > e) return setError("Başlangıç tarihi bitişten sonra olamaz.");
    setError(null);
    onApply(s, e);
    onClose();
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title="Özel tarih aralığı"
      footer={
        <>
          <AppButton title="Vazgeç" variant="outline" onPress={onClose} style={styles.flex} />
          <AppButton title="Uygula" onPress={apply} style={styles.flex} testID="sales-custom-apply" />
        </>
      }
    >
      <AppInput label="Başlangıç" value={start} onChangeText={setStart} placeholder="GG.AA.YYYY" keyboardType="numbers-and-punctuation" testID="sales-custom-start" />
      <AppInput label="Bitiş" value={end} onChangeText={setEnd} placeholder="GG.AA.YYYY (boşsa başlangıç)" keyboardType="numbers-and-punctuation" error={error} testID="sales-custom-end" />
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1 },
    flex: { flex: 1 },
    header: { gap: t.spacing.sm, paddingBottom: t.spacing.sm },
    chips: { gap: t.spacing.sm, paddingHorizontal: t.layout.screenPadding, paddingTop: t.spacing.md },
    statusRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.xs, paddingLeft: t.layout.screenPadding, paddingRight: t.spacing.sm },
    summary: { gap: t.spacing.xs, paddingHorizontal: t.layout.screenPadding },
    summaryGrid: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm },
    listTitle: { paddingHorizontal: t.layout.screenPadding, marginTop: t.spacing.sm },
    footer: { paddingVertical: t.spacing.lg },
    txCard: {
      gap: t.spacing.xs,
      paddingHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.md,
      backgroundColor: t.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    pressed: { backgroundColor: t.colors.surfacePressed },
    txTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: t.spacing.sm },
    txBadges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: t.spacing.xs, flex: 1 },
    panChip: { borderRadius: t.radius.xs, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: t.colors.surfaceMuted },
    panInfo: { backgroundColor: t.colors.infoSubtle },
    panSuccess: { backgroundColor: t.colors.successSubtle },
    panText: { fontSize: 12 },
    txBottom: { flexDirection: "row", alignItems: "flex-end", gap: t.spacing.sm, marginTop: t.spacing.xs },
    txAmount: { fontWeight: "700" },
    txRr: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, marginTop: t.spacing.xs },
  })
);
