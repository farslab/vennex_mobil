/**
 * POS cihaz API'si — docs/API_CONTRACTS.md §2.5, §3.4, §3.6, §3.9, §3.11.
 * Tüm yanıtlar burada normalize edilir; ekranlar backend'in ham şekline dokunmaz.
 *
 * Sayfa boyutları sunucuda sabittir (liste 25, işlemler 50) — `page_size` GÖNDERİLMEZ.
 */
import { apiClient } from "./client";
import { unwrapResults } from "./pagination";
import { toNumber } from "@/utils/number";
import type {
  AssignTemplateResult,
  BulkQuantityUpdate,
  CashHistoryItem,
  CollectCashResult,
  CountRevenueResult,
  DetailMessage,
  DeviceListQuery,
  DeviceLocationOption,
  DeviceSettingsPatch,
  DeviceSkuOption,
  DeviceSummary,
  FillRate,
  NormalProductPayload,
  PeriodSummary,
  PosDeviceDetail,
  PosDeviceListItem,
  PosDeviceListResponse,
  PosProduct,
  PosProductsResponse,
  PosTransaction,
  ProductWritePayload,
  RevenueCountItem,
  SaveAsTemplateResult,
  SourceLocationOption,
  StockSlotPayload,
  TransactionFilters,
  TransactionsResponse,
  TxReceiptState,
  DeviceStats,
  DeviceStatsParams,
  MachineTypeOption,
} from "@/types/devices";

/* ------------------------------------------------------------ yardımcılar */

type Raw = Record<string, unknown>;

const asObj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const asObjOrNull = (v: unknown): Raw | null => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : null);
const str = (v: unknown): string | null => (typeof v === "string" ? v : typeof v === "number" ? String(v) : null);
const int = (v: unknown): number | null => {
  const n = toNumber(v);
  return n == null ? null : Math.trunc(n);
};
const bool = (v: unknown): boolean => v === true;
const boolOrNull = (v: unknown): boolean | null => (typeof v === "boolean" ? v : null);
/** Para alanı: string ("25.00") veya number korunur, geçersizse null */
const money = (v: unknown): number | string | null =>
  typeof v === "number" || typeof v === "string" ? (toNumber(v) == null ? null : v) : null;
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

function boolMap<K extends string>(v: unknown): Partial<Record<K, boolean>> | null {
  const o = asObjOrNull(v);
  if (!o) return null;
  const out: Partial<Record<K, boolean>> = {};
  for (const [k, val] of Object.entries(o)) if (typeof val === "boolean") out[k as K] = val;
  return out;
}

function numberMap(v: unknown): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [k, val] of Object.entries(asObj(v))) {
    const n = toNumber(val);
    if (n != null) out[k] = n;
  }
  return out;
}

function pageMeta(o: Raw, resultsLength: number) {
  return {
    count: int(o.count) ?? resultsLength,
    page: int(o.page) ?? 1,
    num_pages: int(o.num_pages) ?? 1,
    page_size: int(o.page_size) ?? undefined,
  };
}

/* ---------------------------------------------------------- normalizasyon */

export function normalizeDeviceFillRate(v: unknown): FillRate | null {
  const o = asObjOrNull(v);
  if (!o) return null;
  const out: FillRate = { pct: toNumber(o.pct), qty: toNumber(o.qty) ?? 0, max: toNumber(o.max) ?? 0 };
  // Kahve otomatı: bileşen (hazne) doluluğu — /products/ stok modu ve liste kaynağı
  const containersPct = toNumber(o.containers_pct);
  if (containersPct != null) out.containers_pct = containersPct;
  if (o.source === "containers") out.source = "containers";
  return out;
}

export function normalizeDeviceListItem(v: unknown): PosDeviceListItem {
  const o = asObj(v);
  return {
    sn: str(o.sn) ?? "",
    pos_name: str(o.pos_name),
    stat: bool(o.stat),
    online: bool(o.online),
    company_id: int(o.company_id),
    company_name: str(o.company_name),
    location_id: int(o.location_id),
    location_name: str(o.location_name),
    act_vmc: str(o.act_vmc),
    act_macstat: int(o.act_macstat),
    last_seen: str(o.last_seen),
    sort_order: int(o.sort_order) ?? 0,
    today_revenue: toNumber(o.today_revenue),
    today_tx_count: int(o.today_tx_count),
    yesterday_tx_count: int(o.yesterday_tx_count),
    this_month_tx_count: int(o.this_month_tx_count),
    last_month_tx_count: int(o.last_month_tx_count),
    yesterday_revenue: toNumber(o.yesterday_revenue),
    this_month_revenue: toNumber(o.this_month_revenue),
    last_month_revenue: toNumber(o.last_month_revenue),
    last_transaction: str(o.last_transaction),
    fill_rate: normalizeDeviceFillRate(o.fill_rate),
  };
}

export function normalizeDeviceList(v: unknown): PosDeviceListResponse {
  const o = asObj(v);
  const results = arr(o.results).map(normalizeDeviceListItem).filter((d) => d.sn);
  return {
    ...pageMeta(o, results.length),
    online_count: int(o.online_count),
    offline_count: int(o.offline_count),
    total_count: int(o.total_count),
    results,
  };
}

function normalizeOperatingHours(v: unknown): PosDeviceDetail["operating_hours"] {
  const o = asObjOrNull(v);
  if (!o) return null;
  const schedule: Record<string, { start: string; end: string }[]> = {};
  for (const [day, ranges] of Object.entries(asObj(o.schedule))) {
    schedule[day] = arr(ranges)
      .map((r) => asObj(r))
      .map((r) => ({ start: str(r.start) ?? "", end: str(r.end) ?? "" }))
      .filter((r) => r.start && r.end);
  }
  return { mode: str(o.mode) ?? "", schedule };
}

export function normalizeDeviceDetail(v: unknown): PosDeviceDetail {
  const o = asObj(v);
  const idName = (x: unknown) => {
    const n = asObjOrNull(x);
    const id = n ? int(n.id) : null;
    return n && id != null ? { id, name: str(n.name) ?? "" } : null;
  };
  const timeouts = asObjOrNull(o.timeouts);
  const perms = asObjOrNull(o.permissions);
  const warnings = arr(o._warnings).filter((w): w is string => typeof w === "string");
  return {
    sn: str(o.sn) ?? "",
    pos_name: str(o.pos_name),
    pos_text: str(o.pos_text),
    stat: bool(o.stat),
    is_online: boolOrNull(o.is_online),
    last_seen: str(o.last_seen),
    company: idName(o.company),
    location: idName(o.location),
    machine_type: idName(o.machine_type),
    act_vmc: str(o.act_vmc),
    act_vmcsn: str(o.act_vmcsn),
    act_macstat: int(o.act_macstat),
    act_sim_pw: int(o.act_sim_pw),
    app_vers: str(o.app_vers),
    tp_vers: str(o.tp_vers),
    pos_odemetip: int(o.pos_odemetip),
    price_management: int(o.price_management),
    pos_updprd: int(o.pos_updprd),
    sales_notification_enabled: boolOrNull(o.sales_notification_enabled),
    sales_notification_interval: int(o.sales_notification_interval),
    operating_hours_mode: int(o.operating_hours_mode),
    payment_methods: boolMap(o.payment_methods),
    device_toggles: boolMap(o.device_toggles),
    commands: boolMap(o.commands),
    operating_hours: normalizeOperatingHours(o.operating_hours),
    timeouts: timeouts
      ? { vend_timeout: int(timeouts.vend_timeout), pos_timeout: int(timeouts.pos_timeout), pos_eod: str(timeouts.pos_eod) }
      : null,
    ...(typeof o.sales_visible === "boolean" ? { sales_visible: o.sales_visible } : {}),
    ...(perms
      ? { permissions: { manage_device_settings: bool(perms.manage_device_settings), manage_stock: bool(perms.manage_stock) } }
      : {}),
    ...(warnings.length ? { _warnings: warnings } : {}),
  };
}

function normalizePeriod(v: unknown): PeriodSummary {
  const o = asObj(v);
  return { revenue: toNumber(o.revenue), count: int(o.count) };
}

export function normalizeDeviceSummary(v: unknown): DeviceSummary {
  const o = asObj(v);
  return {
    today: normalizePeriod(o.today),
    yesterday: normalizePeriod(o.yesterday),
    this_month: normalizePeriod(o.this_month),
    last_month: normalizePeriod(o.last_month),
  };
}

export function normalizeDeviceTransaction(v: unknown): PosTransaction {
  const o = asObj(v);
  return {
    id: int(o.id) ?? 0,
    pt_id: str(o.pt_id),
    pt_datetime: str(o.pt_datetime),
    amount: money(o.amount),
    pt_type: int(o.pt_type),
    status: bool(o.status),
    iptalNo: int(o.iptalNo),
    product_no: int(o.product_no),
    pt_pan: str(o.pt_pan) || null,
    bankRefNo: str(o.bankRefNo) || null,
    display_name: str(o.display_name) || null,
    entry_mode: int(o.entry_mode),
    rr_show: o.rr_show === true,
    refund_label: str(o.refund_label) ?? "",
  };
}

export function normalizeDeviceTransactions(v: unknown): TransactionsResponse {
  const o = asObj(v);
  const results = arr(o.results).map(normalizeDeviceTransaction);
  const s = asObjOrNull(o.summary);
  return {
    ...pageMeta(o, results.length),
    summary: s
      ? { total: int(s.total), success: int(s.success), failed: int(s.failed), revenue: toNumber(s.revenue) }
      : null,
    results,
    receipts_refund_enabled: o.receipts_refund_enabled === true,
  };
}

export function normalizeDeviceProduct(v: unknown): PosProduct {
  const o = asObj(v);
  return {
    id: int(o.id) ?? 0,
    urun_no: int(o.urun_no),
    is_wildcard: bool(o.is_wildcard),
    name: str(o.name) || null,
    price: money(o.price),
    quantity: toNumber(o.quantity) ?? 0,
    max_quantity: toNumber(o.max_quantity) ?? 0,
    stock_sku: int(o.stock_sku),
    stock_sku_name: str(o.stock_sku_name) || null,
    stock_sku_code: str(o.stock_sku_code) || null,
  };
}

export function normalizeDeviceProducts(v: unknown): PosProductsResponse {
  const o = asObj(v);
  return {
    mode: o.mode === "stock" ? "stock" : "normal",
    items: arr(o.items).map(normalizeDeviceProduct),
    fill: normalizeDeviceFillRate(o.fill),
    template: normalizeTemplateRef(o),
  };
}

function normalizeTemplateRef(o: Record<string, unknown>): PosProductsResponse["template"] {
  if (!("template" in o)) return undefined;
  const t = asObjOrNull(o.template);
  const id = t ? int(t.id) : null;
  return t && id != null ? { id, name: str(t.name) || `Şablon #${id}` } : null;
}

function normalizeCashItem(v: unknown): CashHistoryItem {
  const o = asObj(v);
  return {
    id: int(o.id) ?? 0,
    datetime: str(o.datetime),
    amount: toNumber(o.amount),
    notes: str(o.notes) ?? "",
    collected_by: str(o.collected_by),
  };
}

function normalizeRevenueCount(v: unknown): RevenueCountItem {
  const o = asObj(v);
  return {
    id: int(o.id) ?? 0,
    datetime: str(o.datetime),
    total_revenue: toNumber(o.total_revenue),
    notes: str(o.notes) ?? "",
    counted_by: str(o.counted_by),
    by_pt_type: numberMap(o.by_pt_type),
  };
}

function normalizeSku(v: unknown): DeviceSkuOption {
  const o = asObj(v);
  return {
    id: int(o.id) ?? 0,
    name: str(o.name) ?? "",
    sku_code: str(o.sku_code),
    barcode: str(o.barcode),
    kind: str(o.kind),
    kind_display: str(o.kind_display),
    sale_price: money(o.sale_price),
  };
}

function normalizeSourceLocation(v: unknown): SourceLocationOption {
  const o = asObj(v);
  return {
    id: int(o.id) ?? 0,
    name: str(o.name) ?? "",
    location_type: str(o.location_type) ?? "",
    location_type_display: str(o.location_type_display),
    is_active: o.is_active !== false,
  };
}

function normalizeLocationOption(v: unknown): DeviceLocationOption {
  const o = asObj(v);
  return {
    id: int(o.id) ?? 0,
    name: str(o.name) ?? "",
    region_id: int(o.region_id),
    region_name: str(o.region_name),
  };
}

/** Kaynak lokasyon olabilecek tipler (services_pos.resolve_source_location) */
const SOURCE_LOCATION_TYPES = new Set(["warehouse", "vehicle", "depot"]);

/* ------------------------------------------------------------------- tipler */

/** Geriye dönük uyumluluk: eski ekranlar `page_size` geçirebilir — GÖNDERİLMEZ. */
export interface DeviceListParams extends DeviceListQuery {
  page?: number;
  /** @deprecated Backend yok sayar (sabit 25); istek parametresine eklenmez. */
  page_size?: number;
}

/** @deprecated `StockSlotPayload` kullanın */
export type CreateProductPayload = StockSlotPayload;

/** Sorgu parametrelerinden boş/undefined değerleri atar */
function cleanParams(params: Record<string, unknown>): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    if (typeof v === "boolean") out[k] = v ? "true" : "false";
    else if (typeof v === "number" || typeof v === "string") out[k] = v;
  }
  return out;
}

/* --------------------------------------------------------------------- api */

export const devicesApi = {
  /** `GET pos-devices/` — 25'lik sabit sayfa; sayaçlar ilk sayfada */
  list: ({ page = 1, page_size: _ignored, ...query }: DeviceListParams = {}, signal?: AbortSignal) =>
    apiClient
      .get<unknown>("/pos-devices/", {
        params: cleanParams({
          page,
          q: query.q?.trim(),
          location_ids: query.location_ids?.length ? [...query.location_ids].sort((a, b) => a - b).join(",") : undefined,
          online: query.online,
          machine_type: query.machine_type,
          sort_by: query.sort_by === "default" ? undefined : query.sort_by,
        }),
        signal,
      })
      .then((r) => normalizeDeviceList(r.data)),

  detail: (sn: string, signal?: AbortSignal) =>
    apiClient.get<unknown>(`/pos-devices/${encodeURIComponent(sn)}/`, { signal }).then((r) => normalizeDeviceDetail(r.data)),

  /** view_sales ister (403) */
  summary: (sn: string, signal?: AbortSignal) =>
    apiClient
      .get<unknown>(`/pos-devices/${encodeURIComponent(sn)}/summary/`, { signal })
      .then((r) => normalizeDeviceSummary(r.data)),

  /** view_sales ister; 50'lik sabit sayfa. Tarih verilmezse backend BUGÜN'ü kullanır. */
  transactions: (sn: string, params: TransactionFilters & { page?: number } = {}, signal?: AbortSignal) =>
    apiClient
      .get<unknown>(`/pos-devices/${encodeURIComponent(sn)}/transactions/`, {
        params: cleanParams({ page: 1, ...params }),
        signal,
      })
      .then((r) => normalizeDeviceTransactions(r.data)),

  /** İstatistikler — web cihaz sayfası ?tab=stats ile aynı (tarih aralığı + günlük saat penceresi) */
  stats: (sn: string, params: DeviceStatsParams, signal?: AbortSignal) =>
    apiClient
      .get<DeviceStats>(`/pos-devices/${encodeURIComponent(sn)}/stats/`, { params: cleanParams({ ...params }), signal })
      .then((r) => r.data),

  /** Dijital fiş + son uzaktan iade durumu (web `receipt_refund_state`); `refund.poll` iken 2–3 sn'de bir tekrar istenir */
  txReceipt: (sn: string, txId: number, signal?: AbortSignal) =>
    apiClient
      .get<TxReceiptState>(`/pos-devices/${encodeURIComponent(sn)}/transactions/${txId}/receipt/`, { signal })
      .then((r) => r.data),

  /** Uzaktan iade başlat — yöntemi cihaz seçer (web ile aynı). Kural dışıysa 409 {detail} */
  txRefund: (sn: string, txId: number) =>
    apiClient
      .post<TxReceiptState>(`/pos-devices/${encodeURIComponent(sn)}/transactions/${txId}/refund/`)
      .then((r) => r.data),

  products: (sn: string, signal?: AbortSignal) =>
    apiClient
      .get<unknown>(`/pos-devices/${encodeURIComponent(sn)}/products/`, { signal })
      .then((r) => normalizeDeviceProducts(r.data)),

  /** Stok modu: StockSlotPayload (manage_stock) · normal mod: NormalProductPayload (manage_device_settings) */
  createProduct: (sn: string, payload: ProductWritePayload) =>
    apiClient
      .post<unknown>(`/pos-devices/${encodeURIComponent(sn)}/products/create/`, payload)
      .then((r) => normalizeDeviceProduct(r.data)),

  /** PATCH — stok modunda backend eksik alanları sıfırladığından tam payload gönderin */
  updateProduct: (sn: string, productId: number, payload: StockSlotPayload | Partial<NormalProductPayload>) =>
    apiClient
      .patch<unknown>(`/pos-devices/${encodeURIComponent(sn)}/products/${productId}/`, payload)
      .then((r) => normalizeDeviceProduct(r.data)),

  deleteProduct: (sn: string, productId: number) =>
    apiClient.delete(`/pos-devices/${encodeURIComponent(sn)}/products/${productId}/`).then(() => undefined),

  /** Kaynak lokasyon owner/admin için zorunlu, teknisyende tek varsayılan lokasyon varsa opsiyonel */
  bulkQuantities: (sn: string, updates: BulkQuantityUpdate[], sourceLocationId?: number | null) =>
    apiClient
      .post<{ updated_count?: unknown; detail?: unknown }>(
        `/pos-devices/${encodeURIComponent(sn)}/products/bulk-quantities/`,
        sourceLocationId != null ? { source_location_id: sourceLocationId, updates } : { updates }
      )
      .then((r) => ({ detail: str(r.data?.detail) ?? "", updated_count: int(r.data?.updated_count) ?? 0 })),

  fillAllStock: (sn: string, sourceLocationId?: number | null) =>
    apiClient
      .post<{ filled_count?: unknown; detail?: unknown }>(
        `/pos-devices/${encodeURIComponent(sn)}/fill-all-stock/`,
        sourceLocationId != null ? { source_location_id: sourceLocationId } : {}
      )
      .then((r) => ({ detail: str(r.data?.detail) ?? "", filled_count: int(r.data?.filled_count) ?? 0 })),

  assignTemplate: (sn: string, templateId: number) =>
    apiClient
      .post<Raw>(`/pos-devices/${encodeURIComponent(sn)}/assign-template/`, { template_id: templateId })
      .then((r): AssignTemplateResult => ({
        detail: str(r.data?.detail) ?? "",
        created: int(r.data?.created) ?? 0,
        updated: int(r.data?.updated) ?? 0,
        deleted: int(r.data?.deleted) ?? 0,
        skipped: arr(r.data?.skipped).map((s) => String(s)),
      })),

  unassignTemplate: (sn: string) =>
    apiClient
      .delete<Raw>(`/pos-devices/${encodeURIComponent(sn)}/assign-template/`)
      .then((r): DetailMessage => ({ detail: str(r.data?.detail) ?? "" })),

  saveAsTemplate: (sn: string, payload: { name: string; description?: string }) =>
    apiClient
      .post<Raw>(`/pos-devices/${encodeURIComponent(sn)}/save-as-template/`, payload)
      .then((r): SaveAsTemplateResult => ({
        detail: str(r.data?.detail) ?? "",
        id: int(r.data?.id) ?? 0,
        name: str(r.data?.name) ?? "",
      })),

  /** Makine tipi seçenekleri (web "Makine Tipi" listesi) — yalnız select_machine_type; aksi 403 */
  machineTypes: (signal?: AbortSignal) =>
    apiClient.get<unknown>("/machine-types/", { signal }).then((r): MachineTypeOption[] =>
      unwrapResults(asObj(r.data) as { results?: unknown[] })
        .map((x) => {
          const o = asObj(x);
          const id = int(o.id);
          return id != null ? { id, name: str(o.name) ?? "" } : null;
        })
        .filter((x): x is MachineTypeOption => x != null)
    ),

  /** Yalnız yazılabilir alanlar (§3.11). Yanıt `_warnings` içerebilir (yetkisiz alanlar sessizce atlanır). */
  updateSettings: (sn: string, patch: DeviceSettingsPatch) =>
    apiClient
      .patch<unknown>(`/pos-devices/${encodeURIComponent(sn)}/`, patch)
      .then((r) => normalizeDeviceDetail(r.data)),

  /** manage_device_settings. Tutarı sunucu hesaplar; 0 ise 400 "Toplanacak nakit bulunmamaktadır." */
  collectCash: (sn: string, notes?: string) =>
    apiClient
      .post<Raw>(`/pos-devices/${encodeURIComponent(sn)}/collect-cash/`, notes?.trim() ? { notes: notes.trim() } : {})
      .then((r): CollectCashResult => ({
        detail: str(r.data?.detail) ?? "",
        amount_collected: toNumber(r.data?.amount_collected),
      })),

  /** view_sales. 0 ise 400 "Sayılacak ciro bulunmamaktadır." */
  countRevenue: (sn: string, notes?: string) =>
    apiClient
      .post<Raw>(`/pos-devices/${encodeURIComponent(sn)}/count-revenue/`, notes?.trim() ? { notes: notes.trim() } : {})
      .then((r): CountRevenueResult => ({
        detail: str(r.data?.detail) ?? "",
        total_revenue: toNumber(r.data?.total_revenue),
        by_pt_type: numberMap(r.data?.by_pt_type),
      })),

  /** view_sales; limit varsayılan 25, en fazla 100 */
  cashHistory: (sn: string, limit = 25, signal?: AbortSignal) =>
    apiClient
      .get<unknown>(`/pos-devices/${encodeURIComponent(sn)}/cash-history/`, { params: { limit }, signal })
      .then((r) => ({ results: unwrapResults(asObj(r.data) as { results?: unknown[] }).map(normalizeCashItem) })),

  /** view_sales; limit varsayılan 25, en fazla 100 */
  revenueCountHistory: (sn: string, limit = 25, signal?: AbortSignal) =>
    apiClient
      .get<unknown>(`/pos-devices/${encodeURIComponent(sn)}/revenue-counts/`, { params: { limit }, signal })
      .then((r) => ({ results: unwrapResults(asObj(r.data) as { results?: unknown[] }).map(normalizeRevenueCount) })),

  /** SKU seçici — `GET stock/skus/` (CanManageStock). Bileşen (ingredient) türleri slota konamaz → elenir. */
  skus: (q?: string, signal?: AbortSignal) =>
    apiClient
      .get<unknown>("/stock/skus/", { params: cleanParams({ q: q?.trim() }), signal })
      .then((r) =>
        unwrapResults(asObj(r.data) as { results?: unknown[] })
          .map(normalizeSku)
          .filter((s) => s.id > 0 && s.kind !== "ingredient")
      ),

  /** Dolum kaynağı — aktif depo/araç/ara depo lokasyonları (`GET stock/locations/`) */
  sourceLocations: (signal?: AbortSignal) =>
    apiClient
      .get<unknown>("/stock/locations/", { signal })
      .then((r) =>
        unwrapResults(asObj(r.data) as { results?: unknown[] })
          .map(normalizeSourceLocation)
          .filter((l) => l.id > 0 && l.is_active && SOURCE_LOCATION_TYPES.has(l.location_type))
      ),

  /** Cihaz konumu seçenekleri — `GET overview/locations/` */
  locationOptions: (signal?: AbortSignal) =>
    apiClient
      .get<unknown>("/overview/locations/", { signal })
      .then((r) => unwrapResults(asObj(r.data) as { results?: unknown[] }).map(normalizeLocationOption).filter((l) => l.id > 0)),

  /** @deprecated templatesApi.list kullanın (aynı uç) */
  templates: (signal?: AbortSignal) =>
    apiClient.get<unknown>("/product-templates/", { signal }).then((r) => unwrapResults(asObj(r.data) as { results?: unknown[] })),

  /** @deprecated revenueCountHistory takma adı */
  revenueCounts: (sn: string, limit = 25, signal?: AbortSignal) => devicesApi.revenueCountHistory(sn, limit, signal),
};
