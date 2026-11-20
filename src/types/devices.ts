/**
 * POS cihaz domain tipleri — backend `vennex_mobile/serializers/pos_device.py` ve
 * `views/pos_devices.py` (docs/API_CONTRACTS.md §2.5, §3.4, §3.6, §3.9, §3.11) ile birebir.
 *
 * Para alanları: view'ların elle kurduğu dict'ler number döner; ModelSerializer DecimalField'ları
 * (işlem `amount`, slot/ürün `price`) string döner → `Money` tipi, okurken `toNumber` kullanın.
 */
import type { PageResponse } from "@/api/pagination";

/** Backend'den string ("25.00") veya number gelebilen para değeri */
export type Money = number | string;

/* ------------------------------------------------------------------ Liste */

/** `fill_rate` — ürün/slot yoksa liste satırında `null` */
export interface FillRate {
  /** Kapasite 0 ise null */
  pct: number | null;
  qty: number;
  max: number;
  /**
   * Kahve otomatı: bileşen (hazne) doluluğu, web "Bileşenler" göstergesi.
   * Yalnız `/products/` (stok modu) yanıtında; slot kapasitesi yoksa doluluk budur.
   */
  containers_pct?: number | null;
  /** Liste: yüzde bileşenlerden geldiyse "containers" */
  source?: "containers";
}

/** `act_macstat` (BE-api: 0 START, 1 ENABLE, 2 IDLE, 3 VEND, 4 DISABLED, 5 INACTIVE) */
export type MachineStatusCode = 0 | 1 | 2 | 3 | 4 | 5;

/** `GET pos-devices/` satırı. NOT: `id` ve `pos_odemetip` listede YOK (§3.9). */
export interface PosDeviceListItem {
  sn: string;
  pos_name: string | null;
  stat: boolean;
  online: boolean;
  company_id: number | null;
  company_name: string | null;
  location_id: number | null;
  location_name: string | null;
  act_vmc: string | null;
  act_macstat: number | null;
  last_seen: string | null;
  sort_order: number;
  today_revenue: number | null;
  today_tx_count: number | null;
  yesterday_tx_count: number | null;
  this_month_tx_count: number | null;
  last_month_tx_count: number | null;
  yesterday_revenue: number | null;
  this_month_revenue: number | null;
  last_month_revenue: number | null;
  last_transaction: string | null;
  fill_rate: FillRate | null;
}

export interface PosDeviceListResponse extends PageResponse<PosDeviceListItem> {
  online_count: number | null;
  offline_count: number | null;
  total_count: number | null;
}

/** Backend `SORT_OPTIONS` anahtarları (views/pos_devices.py:126-140) */
export const DEVICE_SORT_KEYS = [
  "default",
  "today_revenue_desc",
  "today_revenue_asc",
  "yesterday_revenue_desc",
  "yesterday_revenue_asc",
  "this_month_revenue_desc",
  "this_month_revenue_asc",
  "last_month_revenue_desc",
  "last_month_revenue_asc",
  "fill_rate_desc",
  "fill_rate_asc",
  "last_transaction_desc",
  "last_transaction_asc",
] as const;

export type DeviceSortBy = (typeof DEVICE_SORT_KEYS)[number];

/** `GET pos-devices/` sorgu parametreleri. Sayfa boyutu sunucuda sabit 25 — `page_size` yok. */
export interface DeviceListQuery {
  q?: string;
  /** Konumlar — web gibi çoklu; virgülle gönderilir (`location_ids=1,2`) */
  location_ids?: number[];
  online?: boolean;
  /** Makine tipi (web ile aynı): 0 Snack, 1 Kahve */
  machine_type?: 0 | 1;
  sort_by?: DeviceSortBy;
}

/* ------------------------------------------------------------------ Detay */

export interface PaymentMethods {
  magnetic: boolean;
  chip: boolean;
  contactless: boolean;
  qrcode: boolean;
  personel_card: boolean;
  vennex_wallet: boolean;
  istanbul_kart: boolean;
  metropol: boolean;
  multinet: boolean;
  setcard: boolean;
  ticket: boolean;
  pluxee: boolean;
  tokenflex: boolean;
  refund: boolean;
}
export type PaymentMethodKey = keyof PaymentMethods;

export interface DeviceToggles {
  audio: boolean;
  /** Sunucu döndürür; web ayarlar formunda yok → mobilde de gösterilmez */
  auto_select: boolean;
  /** Web "Başlat Butonu" (pos_button) */
  login_button: boolean;
  /** Web "Vazgeç Butonu" (pos_cnButton) */
  cancel_button: boolean;
  /** Web "Ücretsiz Vend" (pos_free_mode) */
  free_mode: boolean;
  /** Web "Dil Seçici" (pos_language_selector) */
  language_selector: boolean;
}
export type DeviceToggleKey = keyof DeviceToggles;

/** Komut bayrakları. `apk_reset` yalnız okunur. true = cihazın alması bekleniyor. */
export interface DeviceCommands {
  and_reset: boolean;
  eod_trig: boolean;
  mdb_reset: boolean;
  apk_reset?: boolean;
}
export type DeviceCommandKey = "and_reset" | "eod_trig" | "mdb_reset";

export interface TimeRange {
  start: string;
  end: string;
}

/**
 * Çalışma saatleri — OKUMA şekli (`POSDevice.get_operating_hours_json`, api/models.py:996-1020):
 * mode 0 iken `null`; aksi halde `{mode: "working"|"non_working", schedule: {monday: [...], ...}}`.
 * YAZMA şekli farklıdır → `OperatingHoursWrite`.
 */
export interface OperatingHoursRead {
  mode: "working" | "non_working" | string;
  schedule: Record<string, TimeRange[]>;
}

/** 0 = Kapalı, 1 = Çalışma saatleri, 2 = Çalışmama saatleri */
export type OperatingHoursMode = 0 | 1 | 2;

/** PATCH şekli: gün anahtarları "0".."6" (0 = Pazartesi), replace semantiği */
export interface OperatingHoursWrite {
  mode: OperatingHoursMode;
  schedule: Record<string, TimeRange[]>;
}

export interface DeviceTimeouts {
  vend_timeout: number | null;
  pos_timeout: number | null;
  pos_eod: string | null;
}

export interface PosDeviceDetail {
  sn: string;
  pos_name: string | null;
  /** Web "Marka Yazısı" — cihaz ekranında; boşsa null */
  pos_text: string | null;
  stat: boolean;
  is_online: boolean | null;
  last_seen: string | null;
  company: { id: number; name: string } | null;
  location: { id: number; name: string } | null;
  /** MachineType FK (`pos_mType`) — Snack/Kahve DEĞİL */
  machine_type: { id: number; name: string } | null;
  act_vmc: string | null;
  act_vmcsn: string | null;
  act_macstat: number | null;
  act_sim_pw: number | null;
  app_vers: string | null;
  tp_vers: string | null;
  /** 0 = Snack, 1 = Kahve (api/models.py:703-711) */
  pos_odemetip: number | null;
  /** 0 Otomattan Al, 1 Otomat Öncelikli, 2 Sadece Server (api/models.py:621-631) */
  price_management: number | null;
  /** Yalnız okunur (PATCH serializer'da yok) */
  pos_updprd: number | null;
  sales_notification_enabled: boolean | null;
  sales_notification_interval: number | null;
  operating_hours_mode: number | null;
  payment_methods: Partial<PaymentMethods> | null;
  device_toggles: Partial<DeviceToggles> | null;
  commands: Partial<DeviceCommands> | null;
  operating_hours: OperatingHoursRead | null;
  timeouts: DeviceTimeouts | null;
  /** Yalnız GET yanıtında (PATCH yanıtında yok) */
  sales_visible?: boolean;
  permissions?: { manage_device_settings: boolean; manage_stock: boolean };
  /** PATCH yanıtında yetkisiz atlanan alanlar */
  _warnings?: string[];
}

/** PATCH pos-devices/{sn}/ — yalnız yazılabilir alanlar (§3.11) */
export interface DeviceSettingsPatch {
  pos_name?: string;
  /** Boş string gönderilirse sunucu temizler (null) */
  pos_text?: string;
  location_id?: number | null;
  machine_type_id?: number | null;
  pos_odemetip?: number;
  price_management?: number;
  sales_notification_enabled?: boolean;
  sales_notification_interval?: number;
  payment_methods?: Partial<PaymentMethods>;
  device_toggles?: Partial<DeviceToggles>;
  commands?: Partial<Record<DeviceCommandKey, boolean>>;
  operating_hours?: OperatingHoursWrite;
}

/** Makine tipi seçeneği — `GET machine-types/` (yalnız select_machine_type) */
export interface MachineTypeOption {
  id: number;
  name: string;
}

/* ---------------------------------------------------------------- Özet */

export interface PeriodSummary {
  revenue: number | null;
  count: number | null;
}

/** `GET pos-devices/{sn}/summary/` (view_sales) */
export interface DeviceSummary {
  today: PeriodSummary;
  yesterday: PeriodSummary;
  this_month: PeriodSummary;
  last_month: PeriodSummary;
}

/* ------------------------------------------------------------- İşlemler */

export interface PosTransaction {
  id: number;
  pt_id: string | null;
  pt_datetime: string | null;
  amount: Money | null;
  pt_type: number | null;
  status: boolean;
  /** 1 Zaman aşımı, 2 Banka reddi, 3 Teknik */
  iptalNo: number | null;
  product_no: number | null;
  pt_pan: string | null;
  bankRefNo: string | null;
  display_name: string | null;
  /** Kart okuma: 7 Temassız, 1/5 Çip, 3 QR Kod, 90 Manyetik (web pt_badge.html) */
  entry_mode: number | null;
  /** Yalnız vennexRN: satırda "Detaylar" (fiş/iade) gösterilsin mi ve son iade isteği etiketi */
  rr_show: boolean;
  refund_label: string;
}

/** Tarih aralığına göre (durum/ödeme filtrelerinden ÖNCE) hesaplanır — views/pos_devices.py:490-496 */
export interface TransactionsSummary {
  total: number | null;
  success: number | null;
  failed: number | null;
  revenue: number | null;
}

export interface TransactionsResponse extends PageResponse<PosTransaction> {
  summary: TransactionsSummary | null;
  /** Web ile aynı: dijital fiş + uzaktan iade yalnız vennexRN cihazlarda */
  receipts_refund_enabled: boolean;
}

/** `GET pos-devices/{sn}/transactions/{id}/receipt/` — web `receipt_refund_state` ile aynı JSON */
export interface TxReceipt {
  kind: string;
  label: string;
  text: string;
  created_at: string;
}
export interface TxRefundRequest {
  id: string;
  status: string;
  label: string;
  executed_label: string;
  waiting_card: boolean;
  card_seconds_left: number | null;
  reject_reason: string | null;
  error_code: string | null;
  message: string | null;
  created_at: string;
  poll: boolean;
}
export interface TxReceiptState {
  tx: { id: number; amount: string; status: boolean; iptal_no: number | null; datetime: string };
  receipts: TxReceipt[];
  refund: TxRefundRequest | null;
  can_refund: boolean;
  refund_block: string;
  message?: string;
}

export type TxStatusFilter = "success" | "fail";
export type CancelReasonFilter = "1" | "2" | "3" | "other";

/** `GET pos-devices/{sn}/transactions/` filtreleri. Tarih yoksa backend BUGÜN kabul eder; saat filtresi yok. */
export interface TransactionFilters {
  start_date?: string;
  end_date?: string;
  tx_status?: TxStatusFilter;
  pt_type?: number;
  cancel_reason?: CancelReasonFilter;
  card_last4?: string;
}

/* --------------------------------------------------------- Ürün / Slot */

export interface PosProduct {
  id: number;
  urun_no: number | null;
  is_wildcard: boolean;
  /** Normal modda ürün adı; stok modunda yok → `stock_sku_name` */
  name: string | null;
  price: Money | null;
  quantity: number;
  max_quantity: number;
  stock_sku: number | null;
  stock_sku_name: string | null;
  stock_sku_code: string | null;
}

export type ProductsMode = "stock" | "normal";

export interface PosProductsResponse {
  mode: ProductsMode;
  items: PosProduct[];
  fill: FillRate | null;
  /**
   * Cihazın eşli olduğu ürün şablonu (web rozeti). `null` = eşli değil;
   * `undefined` = sunucu bu bilgiyi göndermiyor (eski backend).
   */
  template?: { id: number; name: string } | null;
}

/** Stok modu slot yazımı (StockSlotWriteSerializer). PATCH'te de TÜM alanlar gönderilmeli (backend eksikleri sıfırlar). */
export interface StockSlotPayload {
  urun_no: number | null;
  is_wildcard: boolean;
  stock_sku_id: number;
  /** "12.50" */
  price: string;
  max_quantity: number;
}

/** Normal mod ürün yazımı (NormalProductWriteSerializer) */
export interface NormalProductPayload {
  urun_no: number;
  name: string;
  price: string;
  quantity: number;
  max_quantity: number;
}

export type ProductWritePayload = StockSlotPayload | NormalProductPayload;

export interface BulkQuantityUpdate {
  slot_id: number;
  quantity: number;
}

/* ------------------------------------------------------- Kasa & Ciro */

export interface CashHistoryItem {
  id: number;
  datetime: string | null;
  amount: number | null;
  notes: string;
  collected_by: string | null;
}

export interface RevenueCountItem {
  id: number;
  datetime: string | null;
  total_revenue: number | null;
  notes: string;
  counted_by: string | null;
  by_pt_type: Record<string, number>;
}

export interface CollectCashResult {
  detail: string;
  amount_collected: number | null;
}

export interface CountRevenueResult {
  detail: string;
  total_revenue: number | null;
  by_pt_type: Record<string, number>;
}

export interface DetailMessage {
  detail: string;
}

export interface AssignTemplateResult {
  detail: string;
  created: number;
  updated: number;
  deleted: number;
  skipped: string[];
}

export interface SaveAsTemplateResult {
  detail: string;
  id: number;
  name: string;
}

/* -------------------------------------------------- Yardımcı seçenekler */

/** `GET stock/skus/` satırının bu modülün kullandığı kısmı */
export interface DeviceSkuOption {
  id: number;
  name: string;
  sku_code: string | null;
  barcode: string | null;
  kind: string | null;
  kind_display: string | null;
  sale_price: Money | null;
}

/** `GET stock/locations/` satırının bu modülün kullandığı kısmı (kaynak lokasyon seçimi) */
export interface SourceLocationOption {
  id: number;
  name: string;
  location_type: string;
  location_type_display: string | null;
  is_active: boolean;
}

/** `GET overview/locations/` — cihaz konumu seçimi */
export interface DeviceLocationOption {
  id: number;
  name: string;
  region_id: number | null;
  region_name: string | null;
}


/** `GET pos-devices/{sn}/stats/` — web cihaz İstatistikler sekmesiyle aynı hesap */
export interface DeviceStatsParams {
  start_date: string;
  end_date: string;
  /** "HH:MM" — günlük saat penceresi (yoksa tüm gün; başlangıç > bitiş ise gece aşırı) */
  start_time?: string;
  end_time?: string;
}
export interface DeviceStats {
  summary: { revenue: number; total: number; success: number; failed: number };
  payment_types: { pt_type: number; label: string; revenue: number; count: number }[];
  failure_reasons: { key: string; label: string; count: number; amount: number }[];
  product_sales: { product_no: number; name: string | null; qty: number; revenue: number }[];
  period: { start_date: string; end_date: string; start_time: string; end_time: string };
}
