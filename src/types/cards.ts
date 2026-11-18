/**
 * Personel kartları, kart grupları, periyodik bakiye, istihkak (kota) ve istihkak yenileme.
 *
 * Kaynak (yalnız okunur backend kopyası):
 *   vennex_mobile/views/personnel_cards.py, serializers/personnel_card.py, api/models.py
 * Para alanları DRF DecimalField → string ("125.50"); okurken toNumber/formatCurrency kullanın.
 */
import type { PageResponse } from "@/api/pagination";

/** DecimalField okuma tipi — backend string döner, mock/eski yanıtlar number olabilir */
export type MoneyValue = string | number;

/* ------------------------------------------------------------------ Kart */

/** `status` sorgu parametresi: backend yalnız "pending"i ayırır, diğer her şey aktif */
export type CardStatus = "active" | "pending";

/** Kart satırındaki grup özeti (serializers/personnel_card.py:41-51) */
export interface CardGroupRef {
  id: number;
  name: string;
  pos_device_ids: number[];
}

/** NFCCardListSerializer (serializers/personnel_card.py:17-35) */
export interface PersonnelCard {
  id: number;
  uid: string;
  first_name: string | null;
  last_name: string | null;
  /** Ad + soyad; ikisi de boşsa null */
  full_name: string | null;
  balance: MoneyValue;
  customer_no: number;
  is_active: boolean;
  created_at: string;
  groups: CardGroupRef[];
}

/** GET cards/ — 30'luk sabit sayfa + sayaçlar (views/personnel_cards.py:106-120) */
export interface CardListResponse extends PageResponse<PersonnelCard> {
  active_count: number;
  pending_count: number;
}

export interface CardListParams {
  status?: CardStatus;
  q?: string;
  group_id?: number | null;
  page?: number;
}

/**
 * NFCCardWriteSerializer (serializers/personnel_card.py:54-62).
 * uid ≤50 zorunlu (POST), ad/soyad ≤100, customer_no ≥0, balance Decimal(10,2) string.
 * `balance` yalnız `change_card_balance` ile etkili; yetki yoksa backend sessizce 0/korur.
 */
export interface CardCreatePayload {
  uid: string;
  first_name?: string | null;
  last_name?: string | null;
  customer_no?: number;
  /** "12.50" — toApiDecimal ile */
  balance?: string;
  group_ids?: number[];
}

/** PATCH cards/{id}/ — kısmi; bakiye bu formdan değil toplu bakiye ucundan değiştirilir */
export type CardUpdatePayload = Partial<Omit<CardCreatePayload, "balance">>;

/** POSTransactionSerializer (serializers/pos_device.py:274-292) */
export interface CardTransaction {
  id: number;
  pt_id: string | number | null;
  pt_datetime: string | null;
  amount: MoneyValue | null;
  pt_type: number | null;
  status: boolean;
  iptalNo: number | null;
  product_no: string | number | null;
  pt_pan: string | null;
  bankRefNo: string | null;
  display_name: string | null;
}

/** GET cards/{id}/transactions/?limit= — sayfasız, limit 100 (max 500) (views:289-311) */
export interface CardTransactionsResponse {
  card: PersonnelCard;
  transactions: CardTransaction[];
  success_count: number;
  fail_count: number;
}

export type BulkBalanceOperation = "add" | "subtract" | "set";
export type BulkGroupsOperation = "add_groups" | "remove_groups";

/** Toplu uçların ortak yanıtı — `count` kapsam içindeki (gerçekten işlenen) kart sayısıdır */
export interface BulkResult {
  detail: string;
  count: number;
}

/* ------------------------------------------------------------ Kart grubu */

/** NFCCardGroupListSerializer (serializers/personnel_card.py:94-104) — cihaz listesi YOK */
export interface CardGroup {
  id: number;
  name: string;
  active_cards_count: number;
  pos_device_count: number;
  created_at: string | null;
}

export interface PosDeviceRef {
  id: number;
  sn: string;
  pos_name: string | null;
}

/** NFCCardGroupDetailSerializer (serializers/personnel_card.py:107-117) — pos_device_ids dönmez */
export interface CardGroupDetail {
  id: number;
  name: string;
  active_cards_count: number;
  pos_devices: PosDeviceRef[];
  /** İstemcide pos_devices'tan türetilir */
  pos_device_ids: number[];
  created_at: string | null;
}

/** NFCCardGroupWriteSerializer: name ≤50, pos_device_ids[] (şirket dışı id'ler sessizce atlanır) */
export interface CardGroupPayload {
  name?: string;
  pos_device_ids?: number[];
}

/** Grup formu için cihaz seçeneği (id veren kaynaklardan) */
export interface DeviceOption {
  id: number;
  sn: string;
  pos_name: string | null;
  /** Ek bilgi (şirket / lokasyon adı) */
  description?: string;
}

/**
 * Cihaz kimliği kaynağı (API_CONTRACTS §3.9): `pos-devices/` listesinde `id` YOK.
 * - owner → users/assignable-options (IsOwner)
 * - view_sales → reports/filter-options (CanViewSales), company_id ile süzülür
 * - diğerleri → kaynak yok (backend boşluğu)
 */
export type DeviceOptionSource = "assignable-options" | "report-filter-options";

/* ----------------------------------------------------- Periyodik bakiye */

export type RecurringPeriod = "daily" | "weekly" | "monthly";
export type RecurringUpdateType = "add" | "set";
export type RecurringTargetType = "card" | "group";

/** RecurringBalanceListSerializer (serializers/personnel_card.py:128-153) */
export interface RecurringBalanceRule {
  id: number;
  name: string;
  amount: MoneyValue;
  update_type: RecurringUpdateType;
  period: RecurringPeriod;
  target_type: RecurringTargetType;
  target_card: number | null;
  target_card_uid: string | null;
  target_group: number | null;
  target_group_name: string | null;
  is_active: boolean;
  /** YYYY-MM-DD — ilk çalışma bu günün 00:00'ında (models.py:1364-1371) */
  start_date: string;
  last_run: string | null;
  /** Sunucu hesaplar, salt okunur */
  next_run: string | null;
  run_count: number;
  description: string | null;
  created_at: string | null;
}

/**
 * RecurringBalanceWriteSerializer (serializers/personnel_card.py:156-166).
 * `next_run` yazılamaz — ilk çalışma tarihi `start_date` ile belirlenir.
 */
export interface RecurringBalancePayload {
  name: string;
  /** "150.00" */
  amount: string;
  update_type: RecurringUpdateType;
  period: RecurringPeriod;
  target_type: RecurringTargetType;
  target_card: number | null;
  target_group: number | null;
  is_active: boolean;
  start_date: string;
  description: string | null;
}

/* ------------------------------------------------------ İstihkak (kota) */

/** QUOTA_PERIOD_CHOICES (api/models.py:1590-1598) */
export type QuotaPeriod = "daily" | "weekly" | "monthly" | "3month" | "6month" | "9month" | "12month";

/** CardQuotaListSerializer (serializers/personnel_card.py:172-192) */
export interface CardQuota {
  id: number;
  card: number;
  card_uid: string | null;
  group: number | null;
  group_name: string | null;
  product_no: string;
  period: QuotaPeriod;
  period_display: string | null;
  quantity: number;
  is_active: boolean;
  created_at: string | null;
}

/** CardQuotaWriteSerializer — POST tek kart; grup zorunlu (views:741-744) */
export interface CardQuotaCreatePayload {
  card: number;
  group: number;
  product_no: string;
  period: QuotaPeriod;
  quantity: number;
  is_active: boolean;
}

/** PATCH card-quotas/{id}/ yalnız bu iki alanı işler (views:785-795) */
export interface CardQuotaUpdatePayload {
  quantity?: number;
  is_active?: boolean;
}

/** POST card-quotas/ ve recurring-quota/ yanıtı — kayıt değil, oluşturulan id'ler */
export interface CreatedIdsResponse {
  detail: string;
  created_ids: number[];
}

/* ---------------------------------------------------- İstihkak yenileme */

/** RecurringQuotaListSerializer (serializers/personnel_card.py:207-234) */
export interface RecurringQuotaRule {
  id: number;
  name: string;
  group: number;
  group_name: string | null;
  product_no: string;
  period: QuotaPeriod;
  period_display: string | null;
  quantity: number;
  target_type: RecurringTargetType;
  target_card: number | null;
  target_card_uid: string | null;
  is_active: boolean;
  start_date: string;
  last_run: string | null;
  next_run: string | null;
  run_count: number;
  description: string | null;
  created_at: string | null;
}

/** RecurringQuotaWriteSerializer (serializers/personnel_card.py:237-247) */
export interface RecurringQuotaPayload {
  name: string;
  group: number;
  product_no: string;
  period: QuotaPeriod;
  quantity: number;
  target_type: RecurringTargetType;
  target_card: number | null;
  is_active: boolean;
  start_date: string;
  description: string | null;
}

export type PagedRecurringBalance = PageResponse<RecurringBalanceRule>;
export type PagedCardQuotas = PageResponse<CardQuota>;
export type PagedRecurringQuota = PageResponse<RecurringQuotaRule>;
