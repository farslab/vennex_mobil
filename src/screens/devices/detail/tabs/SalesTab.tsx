/**
 * Satışlar — `GET pos-devices/{sn}/transactions/` filtreleri birebir (views/pos_devices.py:466-516):
 * start_date/end_date (YYYY-MM-DD; saat filtresi YOK), tx_status, pt_type, cancel_reason, card_last4.
 * 50'lik sabit sayfa, sonsuz kaydırma. Özet yanıttaki `summary`'den (tarih aralığına göre).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { useOnOpen } from "@/components/devices/useOnOpen";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import {
  AppBadge,
  AppButton,
  AppEmptyState,
  AppErrorState,
  AppIcon,
  AppIconButton,
  AppInput,
  AppListSkeleton,
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
import {
  CANCEL_REASON_LABELS,
  PT_TYPE_OPTIONS,
  entryModeBadge,
  ptBadge,
  txStatusLabel,
} from "@/components/devices/deviceHelpers";
import { formatCurrency, formatInteger } from "@/utils/number";
import { amountFontSize } from "@/utils/amountFontSize";
import { HERO_MUTED, HeroSurface } from "@/components/dashboard/HeroSurface";
import { formatDate, formatDateTimeSeconds, parseUserDate, toApiDate } from "@/utils/date";
import type {
  CancelReasonFilter,
  PosTransaction,
  TransactionFilters,
  TransactionsResponse,
  TxStatusFilter,
} from "@/types/devices";
import { TransactionDetailSheet } from "../components/TransactionDetailSheet";
import { STATS_PRESET_OPTIONS, statsPresetRange, type StatsPreset } from "../components/StatsPeriodFilter";
import { useBusinessDay } from "../useBusinessDay";
import { webBadgeColors } from "@/components/devices/webBadgeColors";
import { ListLoadMoreFooter } from "@/components/ListLoadMoreFooter";

type StatusKey = "all" | TxStatusFilter;

const SHEET_HANDOFF_MS = 450;

/**
 * Görünüm denemesi: "cards" — ciro özet kartı + ayrı işlem kartları;
 * "compact" — üç sütunlu özet şeridi + tek yüzeyde sıkı işlem satırları (sol durum şeridi);
 * "timeline" — lacivert özet kartı + saat başlıklarıyla gruplu zaman çizelgesi;
 * "avatar" — özet şeridi + ödeme tipi renginde simgeli satırlar (tek yüzey), çok günlükte gün başlıkları;
 * "ledger" — ortalı büyük ciro + üç küçük sayaç; banka ekstresi gibi sade satırlar (başarılıda durum yazısı yok).
 */
type SalesDesign = "cards" | "compact" | "timeline" | "avatar" | "ledger";
/**
 * Özet ve satırlar ayrı seçilir. Beğenilen adaylar: "compact"; özet olarak "ledger".
 * Şu an: özet "ledger" (ortalı ciro + sayaç kapsülleri), satırlar "avatar" (ödeme tipi renkli simge).
 */
const SALES_SUMMARY = "ledger" as SalesDesign;
const SALES_ROWS = "avatar" as SalesDesign;

const STATUS_ITEMS: { key: StatusKey; label: string }[] = [
  { key: "all", label: "Tümü" },
  { key: "success", label: "Başarılı" },
  { key: "fail", label: "Başarısız" },
];

export interface SalesFilterState {
  /** Web ve İstatistikler sekmesiyle aynı hızlı seçimler: Bugün · Dün · Bu Hafta · Bu Ay · Geçen Ay · Özel */
  preset: StatsPreset;
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

/**
 * UI filtresi → backend sorgu parametreleri (tarih her zaman açıkça gönderilir).
 * Hızlı seçim aralığı `now` anından (TR iş günü) her çağrıda yeniden hesaplanır.
 */
export function toTransactionFilters(f: SalesFilterState, cardLast4: string, now: Date = new Date()): TransactionFilters {
  const range =
    f.preset === "custom" && f.customStart && f.customEnd
      ? { start: toApiDate(f.customStart), end: toApiDate(f.customEnd) }
      : statsPresetRange(f.preset === "custom" ? "today" : f.preset, now);
  const last4 = cardLast4.trim();
  return {
    start_date: range.start,
    end_date: range.end,
    tx_status: f.status === "all" ? undefined : f.status,
    pt_type: f.ptType ?? undefined,
    cancel_reason: f.status === "fail" && f.cancelReason ? f.cancelReason : undefined,
    card_last4: /^\d{4}$/.test(last4) ? last4 : undefined,
  };
}

export function SalesTab({ sn }: { sn: string }) {
  const styles = useStyles();
  const { colors, isDark } = useTheme();
  const [filters, setFilters] = useState<SalesFilterState>(INITIAL);
  const [moreOpen, setMoreOpen] = useState(false);
  const [customOpen, setCustomOpen] = useState(false);
  const [selected, setSelected] = useState<PosTransaction | null>(null);
  // Dönem menüsü kapanmadan özel aralık sayfası açılırsa iOS'ta görünmez kalabilir
  const customTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => (customTimer.current ? clearTimeout(customTimer.current) : undefined), []);
  const debouncedLast4 = useDebouncedValue(filters.cardLast4, 350);

  // Her çizimde hesaplanır (ucuz; sorgu anahtarı derin karşılaştırılır): gece yarısından sonra veya
  // uygulama ön plana dönünce "Bugün" yeni güne geçer
  useBusinessDay();
  const params = toTransactionFilters(filters, debouncedLast4);

  const list = usePagedList<PosTransaction, TransactionsResponse>({
    queryKey: queryKeys.devices.transactions(sn, { ...params }),
    fetchPage: (page, signal) => devicesApi.transactions(sn, { ...params, page }, signal),
  });

  const summary = list.firstPage?.summary ?? null;
  const moreCount = (filters.status !== "all" ? 1 : 0) + (filters.ptType != null ? 1 : 0) + (filters.cancelReason && filters.status === "fail" ? 1 : 0) + (params.card_last4 ? 1 : 0);
  const rangeLabel =
    params.start_date === params.end_date
      ? formatDate(params.start_date ?? null)
      : `${formatDate(params.start_date ?? null)} – ${formatDate(params.end_date ?? null)}`;

  const lastIndex = list.items.length - 1;
  const items = list.items;
  const singleDay = params.start_date === params.end_date;
  const renderItem = useCallback(
    ({ item, index }: { item: PosTransaction; index: number }) =>
      SALES_ROWS === "ledger" ? (
        <TxLedgerRow
          tx={item}
          onPress={setSelected}
          dayLabel={!singleDay && dayKey(item) !== (index > 0 ? dayKey(items[index - 1]) : null) ? dayKey(item) : null}
          first={index === 0 || (!singleDay && dayKey(item) !== dayKey(items[index - 1]))}
          last={index === lastIndex || (!singleDay && dayKey(item) !== dayKey(items[index + 1]))}
        />
      ) : SALES_ROWS === "timeline" ? (
        <TxTimelineItem
          tx={item}
          onPress={setSelected}
          // Saat değişince grup başlığı (ör. "11:00"; çok günlük aralıkta "20.11 · 11:00")
          groupLabel={hourKey(item) !== (index > 0 ? hourKey(items[index - 1]) : null) ? hourLabel(item, singleDay) : null}
          last={index === lastIndex}
        />
      ) : SALES_ROWS === "avatar" ? (
        <TxAvatarRow
          tx={item}
          onPress={setSelected}
          dayLabel={!singleDay && dayKey(item) !== (index > 0 ? dayKey(items[index - 1]) : null) ? dayKey(item) : null}
          first={index === 0 || (!singleDay && dayKey(item) !== dayKey(items[index - 1]))}
          last={index === lastIndex || (!singleDay && dayKey(item) !== dayKey(items[index + 1]))}
        />
      ) : SALES_ROWS === "compact" ? (
        <TxLine tx={item} onPress={setSelected} first={index === 0} last={index === lastIndex} />
      ) : (
        <TxRow tx={item} onPress={setSelected} />
      ),
    [lastIndex, items, singleDay]
  );

  const total = summary?.total ?? null;
  const successPct = total && summary?.success != null ? (summary.success / total) * 100 : null;

  const header = (
    <View style={styles.header}>
      {/* Filtre çubuğu (Genel Bakış gibi): dönem açılır menüsü | filtreler (durum, ödeme türü, kart) */}
      <View style={[styles.filterBar, isDark ? styles.cardDark : styles.cardLight]}>
        <View style={styles.flexMin}>
          <AppSelect<StatsPreset>
            sheetTitle="Dönem"
            options={STATS_PRESET_OPTIONS.map((p) => ({
              value: p.key,
              label: p.key === "custom" && filters.preset === "custom" ? rangeLabel : p.label,
            }))}
            value={filters.preset}
            searchable={false}
            onChange={(p) => {
              if (p === "custom") {
                if (customTimer.current) clearTimeout(customTimer.current);
                customTimer.current = setTimeout(() => setCustomOpen(true), SHEET_HANDOFF_MS);
              } else setFilters((f) => ({ ...f, preset: p }));
            }}
            testID="sales-period"
            variant="bare"
            icon="calendar"
          />
        </View>
        <View style={styles.barDivider} />
        <AppIconButton
          icon="filter"
          label={moreCount ? `Filtreler, ${moreCount} etkin` : "Filtreler"}
          badge={moreCount || undefined}
          onPress={() => setMoreOpen(true)}
          testID="sales-more-filters"
        />
      </View>

      {SALES_SUMMARY === "ledger" ? (
        <View style={[styles.ledgerSummary, isDark ? styles.cardDark : styles.cardLight]} testID="sales-summary">
          <AppText variant="caption" color="textTertiary">
            Ciro · {rangeLabel}
          </AppText>
          <AppText numberOfLines={1} style={[styles.ledgerAmount, { fontSize: amountFontSize(summary?.revenue, 32) }]}>
            {formatCurrency(summary?.revenue)}
          </AppText>
          <View style={styles.ledgerPills}>
            <View style={[styles.ledgerPill, styles.ledgerPillNeutral]}>
              <AppText variant="caption" weight="700">
                {formatInteger(total)}
              </AppText>
              <AppText variant="caption" color="textSecondary">
                işlem
              </AppText>
            </View>
            <View style={[styles.ledgerPill, styles.ledgerPillOk]}>
              <AppText variant="caption" weight="700" color="success">
                {formatInteger(summary?.success)}
              </AppText>
              <AppText variant="caption" color="success">
                başarılı
              </AppText>
            </View>
            <View style={[styles.ledgerPill, styles.ledgerPillFail]}>
              <AppText variant="caption" weight="700" color="danger">
                {formatInteger(summary?.failed)}
              </AppText>
              <AppText variant="caption" color="danger">
                başarısız
              </AppText>
            </View>
          </View>
        </View>
      ) : SALES_SUMMARY === "timeline" ? (
        <HeroSurface style={styles.heroSummary} testID="sales-summary">
          <View style={styles.summaryTop}>
            <View style={styles.flexMin}>
              <AppText variant="caption" style={styles.heroMuted}>
                Ciro · {rangeLabel}
              </AppText>
              <AppText numberOfLines={1} style={[styles.heroAmount, { fontSize: amountFontSize(summary?.revenue, 28) }]}>
                {formatCurrency(summary?.revenue)}
              </AppText>
            </View>
            <View style={styles.summaryCount}>
              <AppText style={styles.heroCount}>{formatInteger(total)}</AppText>
              <AppText variant="caption" style={styles.heroMuted}>
                işlem
              </AppText>
            </View>
          </View>
          <View style={styles.heroRate}>
            <View style={[styles.dot, { backgroundColor: "#4ADE80" }]} />
            <AppText variant="caption" style={styles.heroMuted}>
              {successPct == null ? "—" : `%${successPct.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`} başarılı
            </AppText>
            <View style={[styles.dot, { backgroundColor: "#F87171" }]} />
            <AppText variant="caption" style={styles.heroMuted}>
              {formatInteger(summary?.failed)} başarısız
            </AppText>
          </View>
        </HeroSurface>
      ) : SALES_SUMMARY === "compact" || SALES_SUMMARY === "avatar" ? (
        <>
      {/* Özet şeridi: ciro · işlem · başarı oranı (tarih aralığına göre) */}
      <View style={[styles.strip, isDark ? styles.cardDark : styles.cardLight]} testID="sales-summary">
        <View style={styles.stripCol}>
          <AppText variant="caption" color="textTertiary">
            Ciro
          </AppText>
          <AppText variant="numeric" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.7} style={styles.stripValue}>
            {formatCurrency(summary?.revenue)}
          </AppText>
        </View>
        <View style={[styles.stripCol, styles.stripDivider]}>
          <AppText variant="caption" color="textTertiary">
            İşlem
          </AppText>
          <AppText variant="numeric" style={styles.stripValue}>
            {formatInteger(total)}
          </AppText>
        </View>
        <View style={[styles.stripCol, styles.stripDivider]}>
          <AppText variant="caption" color="textTertiary">
            Başarı
          </AppText>
          <AppText variant="numeric" style={[styles.stripValue, { color: successPct == null ? colors.text : successPct >= 90 ? colors.success : colors.danger }]}>
            {successPct == null ? "—" : `%${successPct.toLocaleString("tr-TR", { maximumFractionDigits: 1 })}`}
          </AppText>
          <AppText variant="caption" color="textTertiary">
            {formatInteger(summary?.failed)} başarısız
          </AppText>
        </View>
      </View>

        </>
      ) : (
        <>
      {/* Özet: ciro büyük, işlem sayısı ve başarı oranı (tarih aralığına göre) */}
      <View style={[styles.summaryCard, isDark ? styles.cardDark : styles.cardLight]} testID="sales-summary">
        <View style={styles.summaryTop}>
          <View style={styles.flexMin}>
            <AppText variant="caption" color="textTertiary">
              Ciro · {rangeLabel}
            </AppText>
            <AppText variant="numeric" numberOfLines={1} style={[styles.summaryAmount, { fontSize: amountFontSize(summary?.revenue, 26) }]}>
              {formatCurrency(summary?.revenue)}
            </AppText>
          </View>
          <View style={styles.summaryCount}>
            <AppText variant="numeric" style={styles.summaryCountValue}>
              {formatInteger(total)}
            </AppText>
            <AppText variant="caption" color="textTertiary">
              işlem
            </AppText>
          </View>
        </View>
        <View style={styles.rateTrack}>
          {successPct != null ? <View style={[styles.rateFill, { width: `${successPct}%` }]} /> : null}
        </View>
        <View style={styles.rateRow}>
          <View style={styles.inline}>
            <View style={[styles.dot, { backgroundColor: colors.success }]} />
            <AppText variant="caption" color="textSecondary">
              {formatInteger(summary?.success)} başarılı
            </AppText>
          </View>
          <View style={styles.inline}>
            <View style={[styles.dot, { backgroundColor: colors.danger }]} />
            <AppText variant="caption" color="textSecondary">
              {formatInteger(summary?.failed)} başarısız
            </AppText>
          </View>
        </View>
      </View>

        </>
      )}
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
      style={({ pressed }) => [styles.txCard, isDark ? styles.cardDark : styles.cardLight, pressed && styles.pressed]}
      testID={`tx-row-${tx.id}`}
    >
      {/* Durum simgesi · ürün ve tarih · tutar ve durum */}
      <View style={styles.txTop}>
        <View style={[styles.txStatus, tx.status ? styles.txStatusOk : styles.txStatusFail]}>
          <AppIcon name={tx.status ? "check" : "x"} size={16} color={tx.status ? "success" : "danger"} />
        </View>
        <View style={styles.flexMin}>
          <AppText variant="calloutStrong" numberOfLines={2}>
            {name}
          </AppText>
          <AppText variant="caption" color="textTertiary">
            {when}
          </AppText>
          {showProductNo ? (
            <AppText variant="caption" color="textTertiary">
              Ürün No {tx.product_no}
            </AppText>
          ) : null}
        </View>
        <View style={styles.txRight}>
          <AppText variant="numeric" style={[styles.txAmount, !tx.status && styles.txAmountFail]}>
            {formatCurrency(tx.amount)}
          </AppText>
          <AppText variant="caption" weight="700" color={tx.status ? "success" : "danger"}>
            {statusLabel}
          </AppText>
        </View>
      </View>
      {/* Kart no · ödeme tipi · okuma şekli · son iade durumu */}
      <View style={styles.txBadges}>
        {tx.pt_pan ? (
          <View style={[styles.panChip, tx.pt_type === 1 ? styles.panInfo : tx.pt_type === 5 ? styles.panSuccess : null]}>
            <AppText variant="mono" style={styles.panText}>
              {cardLabel(tx)}
            </AppText>
          </View>
        ) : null}
        <AppBadge size="sm" label={pt.label} colors={webBadgeColors(pt.color, isDark)} />
        {entry ? <AppBadge size="sm" label={entry.label} colors={webBadgeColors(entry.color, isDark)} /> : null}
        {tx.refund_label ? <AppBadge size="sm" tone="info" label={tx.refund_label} /> : null}
      </View>
    </Pressable>
  );
}

/**
 * Satırdaki kart numarası: kredi kartında yalnız son 4 hane (maskeli "0000********1234" → "1234");
 * diğer ödeme tiplerinde (İstanbulKart vb.) gelen numara olduğu gibi. Tam maskeli hali işlem detayında.
 */
export function cardLabel(tx: Pick<PosTransaction, "pt_pan" | "pt_type">): string {
  const pan = (tx.pt_pan ?? "").trim();
  if (tx.pt_type === 1 && pan.length > 4) return pan.slice(-4);
  return pan;
}

/** "GG.AA.YYYY" — gün grubu anahtarı (başlıkta da bu gösterilir) */
function dayKey(tx: PosTransaction | undefined): string | null {
  return tx ? formatDateTimeSeconds(tx.pt_datetime).slice(0, 10) : null;
}

/**
 * Simgeli satır ("avatar"): solda ödeme tipi renginde yuvarlak kart simgesi (başarısızda kırmızı çarpı),
 * ürün ve saat · ürün no; kart no · ödeme tipi · okuma şekli; sağda tutar ve durum. Gün grupları tek yüzeyde.
 */
function TxAvatarRow({
  tx,
  onPress,
  dayLabel,
  first,
  last,
}: {
  tx: PosTransaction;
  onPress: (t: PosTransaction) => void;
  dayLabel: string | null;
  first: boolean;
  last: boolean;
}) {
  const styles = useStyles();
  const { isDark } = useTheme();
  const name = tx.display_name ?? "—";
  const pt = ptBadge(tx.pt_type);
  const ptColors = webBadgeColors(pt.color, isDark);
  const entry = entryModeBadge(tx.pt_type, tx.entry_mode);
  const statusLabel = txStatusLabel(tx.status, tx.pt_type, tx.iptalNo);
  const when = formatDateTimeSeconds(tx.pt_datetime);
  const showProductNo = tx.product_no != null && tx.product_no !== 65535;
  return (
    <View>
      {dayLabel ? (
        <AppText variant="overline" color="textTertiary" style={styles.dayHead}>
          {dayLabel}
        </AppText>
      ) : null}
      <Pressable
        onPress={() => onPress(tx)}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${formatCurrency(tx.amount)}, ${statusLabel}, ${when}, ${pt.label}`}
        style={({ pressed }) => [
          styles.av,
          first && styles.lineFirst,
          last && styles.lineLast,
          !last && styles.lineDivider,
          pressed && styles.linePressed,
        ]}
        testID={`tx-row-${tx.id}`}
      >
        <View style={[styles.avIcon, { backgroundColor: tx.status ? ptColors.bg : undefined }, !tx.status && styles.txStatusFail]}>
          <AppIcon name={tx.status ? "credit-card" : "x"} size={18} color={tx.status ? ptColors.fg : "danger"} />
        </View>
        <View style={styles.flexMin}>
          <AppText variant="calloutStrong" numberOfLines={1}>
            {name}
          </AppText>
          <View style={styles.lineMeta}>
            <AppText variant="caption" color="textTertiary">
              {when.slice(11)}
            </AppText>
            {showProductNo ? (
              <>
                <AppText variant="caption" color="textTertiary">
                  ·
                </AppText>
                <AppText variant="caption" color="textTertiary">
                  Ürün No {tx.product_no}
                </AppText>
              </>
            ) : null}
          </View>
          <View style={styles.lineMeta}>
            {tx.pt_pan ? (
              <AppText variant="mono" color="textSecondary" style={styles.panText}>
                {cardLabel(tx)}
              </AppText>
            ) : null}
            <AppText variant="caption" weight="600" style={{ color: ptColors.fg }}>
              {pt.label}
            </AppText>
            {entry ? (
              <AppText variant="caption" color="textTertiary">
                {entry.label}
              </AppText>
            ) : null}
          </View>
        </View>
        <View style={styles.txRight}>
          <AppText variant="numeric" style={[styles.txAmount, !tx.status && styles.txAmountFail]}>
            {formatCurrency(tx.amount)}
          </AppText>
          <AppText variant="caption" weight="700" color={tx.status ? "success" : "danger"}>
            {statusLabel}
          </AppText>
          {tx.refund_label ? <AppBadge size="sm" tone="info" label={tx.refund_label} /> : null}
        </View>
      </Pressable>
    </View>
  );
}

/**
 * Ekstre satırı ("ledger"): solda saat:dakika, ortada ürün ve tek satır künye (kart no · ödeme tipi · okuma
 * şekli · ürün no), sağda tutar. Başarılı işlemde durum yazısı yok; başarısızda soluk satır + kırmızı neden.
 */
function TxLedgerRow({
  tx,
  onPress,
  dayLabel,
  first,
  last,
}: {
  tx: PosTransaction;
  onPress: (t: PosTransaction) => void;
  dayLabel: string | null;
  first: boolean;
  last: boolean;
}) {
  const styles = useStyles();
  const { isDark } = useTheme();
  const name = tx.display_name ?? "—";
  const pt = ptBadge(tx.pt_type);
  const ptColor = webBadgeColors(pt.color, isDark).fg;
  const entry = entryModeBadge(tx.pt_type, tx.entry_mode);
  const statusLabel = txStatusLabel(tx.status, tx.pt_type, tx.iptalNo);
  const when = formatDateTimeSeconds(tx.pt_datetime);
  const showProductNo = tx.product_no != null && tx.product_no !== 65535;
  return (
    <View>
      {dayLabel ? (
        <AppText variant="overline" color="textTertiary" style={styles.dayHead}>
          {dayLabel}
        </AppText>
      ) : null}
      <Pressable
        onPress={() => onPress(tx)}
        accessibilityRole="button"
        accessibilityLabel={`${name}, ${formatCurrency(tx.amount)}, ${statusLabel}, ${when}, ${pt.label}`}
        style={({ pressed }) => [
          styles.ledger,
          first && styles.lineFirst,
          last && styles.lineLast,
          !last && styles.lineDivider,
          pressed && styles.linePressed,
        ]}
        testID={`tx-row-${tx.id}`}
      >
        <AppText variant="numericSm" weight="700" color={tx.status ? "text" : "textTertiary"} style={styles.ledgerTime}>
          {when.slice(11, 16)}
        </AppText>
        <View style={styles.flexMin}>
          <AppText variant="callout" weight="600" numberOfLines={1} color={tx.status ? "text" : "textTertiary"}>
            {name}
          </AppText>
          <View style={styles.lineMeta}>
            {tx.pt_pan ? (
              <AppText variant="mono" color="textTertiary" style={styles.panText}>
                {cardLabel(tx)}
              </AppText>
            ) : null}
            <AppText variant="caption" weight="600" style={{ color: ptColor }}>
              {pt.label}
            </AppText>
            {entry ? (
              <AppText variant="caption" color="textTertiary">
                {entry.label}
              </AppText>
            ) : null}
            {showProductNo ? (
              <AppText variant="caption" color="textTertiary">
                Ürün No {tx.product_no}
              </AppText>
            ) : null}
          </View>
          {!tx.status ? (
            <AppText variant="caption" weight="700" color="danger">
              {statusLabel}
            </AppText>
          ) : null}
        </View>
        <View style={styles.txRight}>
          <AppText variant="numeric" style={[styles.txAmount, !tx.status && styles.txAmountFail]}>
            {formatCurrency(tx.amount)}
          </AppText>
          {tx.refund_label ? <AppBadge size="sm" tone="info" label={tx.refund_label} /> : null}
        </View>
      </Pressable>
    </View>
  );
}

/** "GG.AA.YYYY SS" — saat grubu anahtarı */
function hourKey(tx: PosTransaction): string {
  return formatDateTimeSeconds(tx.pt_datetime).slice(0, 13);
}
function hourLabel(tx: PosTransaction, singleDay: boolean): string {
  const s = formatDateTimeSeconds(tx.pt_datetime); // "GG.AA.YYYY SS:DD:ss"
  if (s.length < 13) return "—";
  const hour = `${s.slice(11, 13)}:00`;
  return singleDay ? hour : `${s.slice(0, 5)} · ${hour}`;
}

/**
 * Zaman çizelgesi öğesi ("timeline"): solda saat:dakika ve durum renkli nokta (dikey çizgi üzerinde),
 * sağda beyaz kart — ürün, ürün no, kart no · ödeme tipi · okuma şekli; tutar ve durum.
 */
function TxTimelineItem({
  tx,
  onPress,
  groupLabel,
  last,
}: {
  tx: PosTransaction;
  onPress: (t: PosTransaction) => void;
  groupLabel: string | null;
  last: boolean;
}) {
  const styles = useStyles();
  const { isDark, colors } = useTheme();
  const name = tx.display_name ?? "—";
  const pt = ptBadge(tx.pt_type);
  const ptColor = webBadgeColors(pt.color, isDark).fg;
  const entry = entryModeBadge(tx.pt_type, tx.entry_mode);
  const statusLabel = txStatusLabel(tx.status, tx.pt_type, tx.iptalNo);
  const when = formatDateTimeSeconds(tx.pt_datetime);
  const showProductNo = tx.product_no != null && tx.product_no !== 65535;
  return (
    <View>
      {groupLabel ? (
        <View style={styles.tlGroup}>
          <AppIcon name="clock" size={13} color="textTertiary" />
          <AppText variant="caption" weight="700" color="textSecondary">
            {groupLabel}
          </AppText>
        </View>
      ) : null}
      <View style={styles.tlRow}>
        <View style={styles.tlTime}>
          <AppText variant="numericSm" weight="700">
            {when.slice(11, 16)}
          </AppText>
          <AppText variant="caption" color="textTertiary">
            {when.slice(17, 19)}
          </AppText>
        </View>
        <View style={styles.tlRail}>
          <View style={[styles.tlDot, { backgroundColor: tx.status ? colors.success : colors.danger }]} />
          {!last ? <View style={styles.tlLine} /> : null}
        </View>
        <Pressable
          onPress={() => onPress(tx)}
          accessibilityRole="button"
          accessibilityLabel={`${name}, ${formatCurrency(tx.amount)}, ${statusLabel}, ${when}, ${pt.label}`}
          style={({ pressed }) => [styles.tlCard, isDark ? styles.cardDark : styles.cardLight, pressed && styles.pressed]}
          testID={`tx-row-${tx.id}`}
        >
          <View style={styles.tlCardTop}>
            <View style={styles.flexMin}>
              <AppText variant="calloutStrong" numberOfLines={1}>
                {name}
              </AppText>
              {showProductNo ? (
                <AppText variant="caption" color="textTertiary">
                  Ürün No {tx.product_no}
                </AppText>
              ) : null}
            </View>
            <View style={styles.txRight}>
              <AppText variant="numeric" style={[styles.txAmount, !tx.status && styles.txAmountFail]}>
                {formatCurrency(tx.amount)}
              </AppText>
              <AppText variant="caption" weight="700" color={tx.status ? "success" : "danger"}>
                {statusLabel}
              </AppText>
            </View>
          </View>
          <View style={styles.lineMeta}>
            {tx.pt_pan ? (
              <AppText variant="mono" color="textSecondary" style={styles.panText}>
                {cardLabel(tx)}
              </AppText>
            ) : null}
            <View style={[styles.dot, { backgroundColor: ptColor }]} />
            <AppText variant="caption" weight="600" style={{ color: ptColor }}>
              {pt.label}
            </AppText>
            {entry ? (
              <AppText variant="caption" color="textTertiary">
                {entry.label}
              </AppText>
            ) : null}
            {tx.refund_label ? <AppBadge size="sm" tone="info" label={tx.refund_label} /> : null}
          </View>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * Sıkı işlem satırı ("compact"): tek beyaz yüzeyde, solda durum rengi şerit · ürün, tarih-saat, ürün no ·
 * kart no, ödeme tipi, okuma şekli · sağda tutar, durum ve son iade. Dokununca detay (fiş + iade).
 */
function TxLine({ tx, onPress, first, last }: { tx: PosTransaction; onPress: (t: PosTransaction) => void; first: boolean; last: boolean }) {
  const styles = useStyles();
  const { isDark, colors } = useTheme();
  const name = tx.display_name ?? "—";
  const pt = ptBadge(tx.pt_type);
  const ptColor = webBadgeColors(pt.color, isDark).fg;
  const entry = entryModeBadge(tx.pt_type, tx.entry_mode);
  const statusLabel = txStatusLabel(tx.status, tx.pt_type, tx.iptalNo);
  const when = formatDateTimeSeconds(tx.pt_datetime);
  const showProductNo = tx.product_no != null && tx.product_no !== 65535;
  return (
    <Pressable
      onPress={() => onPress(tx)}
      accessibilityRole="button"
      accessibilityLabel={`${name}, ${formatCurrency(tx.amount)}, ${statusLabel}, ${when}, ${pt.label}`}
      style={({ pressed }) => [
        styles.line,
        first && styles.lineFirst,
        last && styles.lineLast,
        !last && styles.lineDivider,
        pressed && styles.linePressed,
      ]}
      testID={`tx-row-${tx.id}`}
    >
      <View style={[styles.lineStripe, { backgroundColor: tx.status ? colors.success : colors.danger }]} />
      <View style={styles.flexMin}>
        <AppText variant="calloutStrong" numberOfLines={1}>
          {name}
        </AppText>
        <View style={styles.lineMeta}>
          <AppText variant="caption" color="textTertiary">
            {when}
          </AppText>
          {showProductNo ? (
            <>
              <AppText variant="caption" color="textTertiary">
                ·
              </AppText>
              <AppText variant="caption" color="textTertiary">
                Ürün No {tx.product_no}
              </AppText>
            </>
          ) : null}
        </View>
        <View style={styles.lineMeta}>
          {tx.pt_pan ? (
            <AppText variant="mono" color="textSecondary" style={styles.panText}>
              {cardLabel(tx)}
            </AppText>
          ) : null}
          <View style={[styles.dot, { backgroundColor: ptColor }]} />
          <AppText variant="caption" weight="600" style={{ color: ptColor }}>
            {pt.label}
          </AppText>
          {entry ? (
            <AppText variant="caption" color="textTertiary">
              {entry.label}
            </AppText>
          ) : null}
        </View>
      </View>
      <View style={styles.txRight}>
        <AppText variant="numeric" style={[styles.txAmount, !tx.status && styles.txAmountFail]}>
          {formatCurrency(tx.amount)}
        </AppText>
        <AppText variant="caption" weight="700" color={tx.status ? "success" : "danger"}>
          {statusLabel}
        </AppText>
        {tx.refund_label ? <AppBadge size="sm" tone="info" label={tx.refund_label} /> : null}
      </View>
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
      title="Filtreler"
      footer={
        <>
          <AppButton
            title="Temizle"
            variant="outline"
            onPress={() => setDraft((d) => ({ ...d, status: "all", ptType: null, cancelReason: null, cardLast4: "" }))}
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
      <View style={styles.sheetField}>
        <AppText variant="label" color="textSecondary">
          Durum
        </AppText>
        <AppSegmented<StatusKey>
          testID="sales-status"
          value={draft.status}
          onChange={(status) => setDraft((d) => ({ ...d, status, cancelReason: status === "fail" ? d.cancelReason : null }))}
          items={STATUS_ITEMS}
        />
      </View>
      <AppSelect<number>
        label="Ödeme türü"
        testID="sales-pt-type"
        searchable={false}
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
    flexMin: { flex: 1, minWidth: 0 },
    header: { gap: t.spacing.md, paddingBottom: t.spacing.sm },
    cardLight: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.07,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    cardDark: { borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border },
    summaryCard: {
      marginHorizontal: t.layout.screenPadding,
      padding: t.spacing.md,
      gap: t.spacing.sm,
      borderRadius: 18,
      backgroundColor: t.colors.surface,
    },
    summaryTop: { flexDirection: "row", alignItems: "flex-end", gap: t.spacing.md },
    summaryAmount: { fontWeight: "700", lineHeight: 32 },
    summaryCount: { alignItems: "flex-end" },
    summaryCountValue: { fontWeight: "700", fontSize: 20 },
    rateTrack: { height: 6, borderRadius: 3, backgroundColor: t.colors.dangerSubtle, overflow: "hidden" },
    rateFill: { height: 6, borderRadius: 3, backgroundColor: t.colors.success },
    rateRow: { flexDirection: "row", gap: t.spacing.lg },
    inline: { flexDirection: "row", alignItems: "center", gap: 6 },
    dot: { width: 8, height: 8, borderRadius: 4 },
    listTitle: { paddingHorizontal: t.layout.screenPadding },
    ledgerSummary: {
      marginHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.lg,
      paddingHorizontal: t.spacing.md,
      alignItems: "center",
      gap: 4,
      borderRadius: 18,
      backgroundColor: t.colors.surface,
    },
    ledgerAmount: { color: t.colors.text, fontWeight: "700", lineHeight: 40, letterSpacing: -0.5 },
    ledgerPills: { flexDirection: "row", gap: t.spacing.sm, marginTop: t.spacing.xs },
    ledgerPill: { flexDirection: "row", alignItems: "center", gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
    ledgerPillNeutral: { backgroundColor: t.colors.surfaceMuted },
    ledgerPillOk: { backgroundColor: t.colors.successSubtle },
    ledgerPillFail: { backgroundColor: t.colors.dangerSubtle },
    ledger: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      marginHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.spacing.md,
      backgroundColor: t.colors.surface,
    },
    ledgerTime: { width: 44 },
    dayHead: { paddingHorizontal: t.layout.screenPadding, paddingTop: t.spacing.sm, paddingBottom: t.spacing.xs },
    av: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      marginHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.spacing.md,
      backgroundColor: t.colors.surface,
    },
    avIcon: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
    heroSummary: { marginHorizontal: t.layout.screenPadding, padding: t.spacing.md, gap: t.spacing.sm },
    heroMuted: { color: HERO_MUTED },
    heroAmount: { color: "#FFFFFF", fontWeight: "700", lineHeight: 36, letterSpacing: -0.5 },
    heroCount: { color: "#FFFFFF", fontWeight: "700", fontSize: 22, lineHeight: 28 },
    heroRate: { flexDirection: "row", alignItems: "center", gap: 6 },
    tlGroup: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: t.layout.screenPadding, paddingTop: t.spacing.sm, paddingBottom: t.spacing.xs },
    tlRow: { flexDirection: "row", paddingHorizontal: t.layout.screenPadding },
    tlTime: { width: 46, alignItems: "flex-end", paddingTop: t.spacing.md },
    tlRail: { width: 22, alignItems: "center" },
    tlDot: { width: 10, height: 10, borderRadius: 5, marginTop: t.spacing.md + 4 },
    tlLine: { flex: 1, width: 2, borderRadius: 1, backgroundColor: t.colors.border, marginTop: 4 },
    tlCard: {
      flex: 1,
      minWidth: 0,
      marginBottom: t.spacing.sm,
      padding: t.spacing.md,
      gap: 6,
      borderRadius: 14,
      backgroundColor: t.colors.surface,
    },
    tlCardTop: { flexDirection: "row", alignItems: "flex-start", gap: t.spacing.sm },
    filterBar: {
      flexDirection: "row",
      alignItems: "center",
      marginHorizontal: t.layout.screenPadding,
      marginTop: t.spacing.md,
      paddingLeft: 4,
      paddingRight: 2,
      borderRadius: 999,
      backgroundColor: t.colors.surface,
    },
    barDivider: { width: StyleSheet.hairlineWidth, height: 24, backgroundColor: t.colors.border, marginHorizontal: 4 },
    sheetField: { gap: t.spacing.xs },
    strip: {
      flexDirection: "row",
      marginHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.spacing.md,
      borderRadius: 18,
      backgroundColor: t.colors.surface,
    },
    stripCol: { flex: 1, minWidth: 0, gap: 1 },
    stripDivider: { paddingLeft: t.spacing.md, marginLeft: t.spacing.sm, borderLeftWidth: StyleSheet.hairlineWidth, borderLeftColor: t.colors.border },
    stripValue: { fontWeight: "700", fontSize: 18 },
    line: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      marginHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.md,
      paddingRight: t.spacing.md,
      backgroundColor: t.colors.surface,
    },
    lineFirst: { borderTopLeftRadius: 16, borderTopRightRadius: 16 },
    lineLast: { borderBottomLeftRadius: 16, borderBottomRightRadius: 16, marginBottom: t.spacing.md },
    lineDivider: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    linePressed: { backgroundColor: t.colors.surfacePressed },
    lineStripe: { width: 3, alignSelf: "stretch", borderRadius: 2, marginLeft: t.spacing.sm },
    lineMeta: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
    footer: { paddingVertical: t.spacing.lg },
    txCard: {
      marginHorizontal: t.layout.screenPadding,
      marginBottom: t.spacing.sm,
      padding: t.spacing.md,
      gap: t.spacing.sm,
      borderRadius: 16,
      backgroundColor: t.colors.surface,
    },
    pressed: { opacity: 0.85 },
    txTop: { flexDirection: "row", alignItems: "flex-start", gap: t.spacing.md },
    txStatus: { width: 34, height: 34, borderRadius: 17, alignItems: "center", justifyContent: "center" },
    txStatusOk: { backgroundColor: t.colors.successSubtle },
    txStatusFail: { backgroundColor: t.colors.dangerSubtle },
    txRight: { alignItems: "flex-end", gap: 2 },
    txAmount: { fontWeight: "700" },
    txAmountFail: { color: t.colors.textTertiary, textDecorationLine: "line-through" },
    txBadges: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", gap: t.spacing.xs, paddingLeft: 34 + t.spacing.md },
    panChip: { borderRadius: t.radius.xs, paddingHorizontal: 6, paddingVertical: 2, backgroundColor: t.colors.surfaceMuted },
    panInfo: { backgroundColor: t.colors.infoSubtle },
    panSuccess: { backgroundColor: t.colors.successSubtle },
    panText: { fontSize: 12 },
  })
);
