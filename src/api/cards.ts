/**
 * Personel kart modülü HTTP katmanı. Sözleşme: docs/API_CONTRACTS.md §2.8, §3.9, §3.10 ve
 * backend-ref vennex_mobile/views/personnel_cards.py (doğruluk kaynağı).
 *
 * Toplu işlemler: birleşik `POST cards/bulk/` view'ı isteği `request._request` ile alt view'a
 * devrediyor (views/personnel_cards.py:409); DRF gövdeyi zaten okuduğu için JSON gövdesi alt
 * view'da yeniden okunamaz (RawPostDataException riski). Bu yüzden aynı serializer'ı kullanan
 * doğrudan uçlar (`cards/bulk/balance|delete|groups/`) çağrılır.
 */
import { apiClient } from "./client";
import { unwrapResults, type PageResponse } from "./pagination";
import { toApiDecimal } from "@/utils/number";
import type {
  CardBalanceLog,
  GroupQuotaCreatePayload,
  GroupQuotaResult,
  BulkBalanceOperation,
  BulkGroupsOperation,
  BulkResult,
  CardCreatePayload,
  CardGroup,
  CardGroupDetail,
  CardGroupPayload,
  CardGroupRef,
  CardListParams,
  CardListResponse,
  CardQuota,
  CardQuotaCreatePayload,
  CardQuotaUpdatePayload,
  CardTransaction,
  CardTransactionsResponse,
  CardUpdatePayload,
  CreatedIdsResponse,
  DeviceOption,
  DeviceOptionSource,
  PersonnelCard,
  PosDeviceRef,
  QuotaPeriod,
  RecurringBalancePayload,
  RecurringBalanceRule,
  RecurringQuotaPayload,
  RecurringQuotaRule,
} from "@/types/cards";

/* -------------------------------------------------------------- yardımcılar */

type Raw = Record<string, unknown>;

function asObject(value: unknown): Raw {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Raw) : {};
}
function str(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}
function int(value: unknown, fallback = 0): number {
  const n = typeof value === "number" ? value : typeof value === "string" ? Number(value) : NaN;
  return Number.isFinite(n) ? Math.trunc(n) : fallback;
}
function intOrNull(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = int(value, NaN);
  return Number.isFinite(n) ? n : null;
}
function money(value: unknown): string | number {
  if (typeof value === "number" || typeof value === "string") return value;
  return "0.00";
}
function moneyOrNull(value: unknown): string | number | null {
  return typeof value === "number" || typeof value === "string" ? value : null;
}
function idList(value: unknown): number[] {
  return Array.isArray(value) ? value.map((v) => intOrNull(v)).filter((v): v is number => v != null) : [];
}

/** Sayfalı yanıtı güvenli hale getirir (sayılar number, results dizi) */
export function normalizePage<T>(raw: unknown, mapItem: (item: unknown) => T): PageResponse<T> {
  const o = asObject(raw);
  const results = Array.isArray(o.results) ? o.results.map(mapItem) : [];
  return {
    count: int(o.count, results.length),
    page: int(o.page, 1),
    num_pages: int(o.num_pages, 1),
    page_size: o.page_size == null ? undefined : int(o.page_size),
    results,
  };
}

/* -------------------------------------------------------------- normalizer */

export function normalizeCardGroupRef(raw: unknown): CardGroupRef {
  const o = asObject(raw);
  return { id: int(o.id), name: str(o.name) ?? "", pos_device_ids: idList(o.pos_device_ids) };
}

export function normalizeCard(raw: unknown): PersonnelCard {
  const o = asObject(raw);
  const first = str(o.first_name);
  const last = str(o.last_name);
  const full = str(o.full_name) ?? ([first, last].filter(Boolean).join(" ").trim() || null);
  return {
    id: int(o.id),
    uid: str(o.uid) ?? "",
    first_name: first || null,
    last_name: last || null,
    full_name: full || null,
    balance: money(o.balance),
    customer_no: int(o.customer_no),
    is_active: o.is_active === true,
    created_at: str(o.created_at) ?? "",
    groups: Array.isArray(o.groups) ? o.groups.map(normalizeCardGroupRef) : [],
  };
}

export function normalizeCardList(raw: unknown): CardListResponse {
  const o = asObject(raw);
  return {
    ...normalizePage(raw, normalizeCard),
    active_count: int(o.active_count),
    pending_count: int(o.pending_count),
  };
}

export function normalizeBalanceLog(raw: unknown): CardBalanceLog {
  const o = asObject(raw);
  const u = o.user && typeof o.user === "object" ? asObject(o.user) : null;
  const d = o.pos_device && typeof o.pos_device === "object" ? asObject(o.pos_device) : null;
  return {
    id: int(o.id),
    created_at: str(o.created_at) ?? "",
    amount: money(o.amount),
    balance_before: money(o.balance_before),
    balance_after: money(o.balance_after),
    source: str(o.source) ?? "",
    source_label: str(o.source_label) ?? str(o.source) ?? "",
    operation: str(o.operation) ?? "",
    operation_label: str(o.operation_label) ?? str(o.operation) ?? "",
    description: str(o.description) || null,
    user: u ? { id: int(u.id), name: str(u.name) ?? "" } : null,
    pos_device: d ? { id: int(d.id), sn: str(d.sn) ?? "", pos_name: str(d.pos_name) || null } : null,
  };
}

export function normalizeTransaction(raw: unknown): CardTransaction {
  const o = asObject(raw);
  return {
    id: int(o.id),
    pt_id: (typeof o.pt_id === "string" || typeof o.pt_id === "number" ? o.pt_id : null),
    pt_datetime: str(o.pt_datetime),
    amount: moneyOrNull(o.amount),
    pt_type: intOrNull(o.pt_type),
    status: o.status === true,
    iptalNo: intOrNull(o.iptalNo),
    product_no: (typeof o.product_no === "string" || typeof o.product_no === "number" ? o.product_no : null),
    pt_pan: str(o.pt_pan),
    bankRefNo: str(o.bankRefNo),
    display_name: str(o.display_name),
  };
}

export function normalizeCardGroup(raw: unknown): CardGroup {
  const o = asObject(raw);
  return {
    id: int(o.id),
    name: str(o.name) ?? "",
    active_cards_count: int(o.active_cards_count),
    pos_device_count: int(o.pos_device_count),
    created_at: str(o.created_at),
  };
}

function normalizePosDevice(raw: unknown): PosDeviceRef {
  const o = asObject(raw);
  return { id: int(o.id), sn: str(o.sn) ?? "", pos_name: str(o.pos_name) };
}

/** Detay `pos_device_ids` dönmez → `pos_devices`'tan türetilir (API_CONTRACTS §3.10) */
export function normalizeCardGroupDetail(raw: unknown): CardGroupDetail {
  const o = asObject(raw);
  const devices = Array.isArray(o.pos_devices) ? o.pos_devices.map(normalizePosDevice) : [];
  return {
    id: int(o.id),
    name: str(o.name) ?? "",
    active_cards_count: int(o.active_cards_count),
    pos_devices: devices,
    pos_device_ids: devices.map((d) => d.id),
    created_at: str(o.created_at),
  };
}

const QUOTA_PERIODS: QuotaPeriod[] = ["daily", "weekly", "monthly", "3month", "6month", "9month", "12month"];
function quotaPeriod(value: unknown): QuotaPeriod {
  return QUOTA_PERIODS.includes(value as QuotaPeriod) ? (value as QuotaPeriod) : "monthly";
}

export function normalizeRecurringBalance(raw: unknown): RecurringBalanceRule {
  const o = asObject(raw);
  const period = o.period === "daily" || o.period === "weekly" ? o.period : "monthly";
  return {
    id: int(o.id),
    name: str(o.name) ?? "",
    amount: money(o.amount),
    update_type: o.update_type === "set" ? "set" : "add",
    period,
    target_type: o.target_type === "card" ? "card" : "group",
    target_card: intOrNull(o.target_card),
    target_card_uid: str(o.target_card_uid),
    target_group: intOrNull(o.target_group),
    target_group_name: str(o.target_group_name),
    is_active: o.is_active !== false,
    start_date: str(o.start_date) ?? "",
    last_run: str(o.last_run),
    next_run: str(o.next_run),
    run_count: int(o.run_count),
    description: str(o.description),
    created_at: str(o.created_at),
  };
}

export function normalizeQuota(raw: unknown): CardQuota {
  const o = asObject(raw);
  return {
    id: int(o.id),
    card: int(o.card),
    card_uid: str(o.card_uid),
    group: intOrNull(o.group),
    group_name: str(o.group_name),
    product_no: str(o.product_no) ?? "*",
    period: quotaPeriod(o.period),
    period_display: str(o.period_display),
    quantity: int(o.quantity, 1),
    is_active: o.is_active !== false,
    created_at: str(o.created_at),
  };
}

export function normalizeRecurringQuota(raw: unknown): RecurringQuotaRule {
  const o = asObject(raw);
  return {
    id: int(o.id),
    name: str(o.name) ?? "",
    group: int(o.group),
    group_name: str(o.group_name),
    product_no: str(o.product_no) ?? "*",
    period: quotaPeriod(o.period),
    period_display: str(o.period_display),
    quantity: int(o.quantity, 1),
    target_type: o.target_type === "card" ? "card" : "group",
    target_card: intOrNull(o.target_card),
    target_card_uid: str(o.target_card_uid),
    is_active: o.is_active !== false,
    start_date: str(o.start_date) ?? "",
    last_run: str(o.last_run),
    next_run: str(o.next_run),
    run_count: int(o.run_count),
    description: str(o.description),
    created_at: str(o.created_at),
  };
}

function normalizeBulkResult(raw: unknown): BulkResult {
  const o = asObject(raw);
  return { detail: str(o.detail) ?? "", count: int(o.count) };
}

function normalizeCreatedIds(raw: unknown): CreatedIdsResponse {
  const o = asObject(raw);
  return { detail: str(o.detail) ?? "", created_ids: idList(o.created_ids) };
}

/* -------------------------------------------------------------- parametreler */

function cardListParams(params: CardListParams): Record<string, string | number> {
  const out: Record<string, string | number> = { status: params.status ?? "active", page: params.page ?? 1 };
  const q = params.q?.trim();
  if (q) out.q = q;
  if (params.group_id != null) out.group_id = params.group_id;
  return out;
}

function withQ(params: { page?: number; q?: string } & Record<string, unknown>) {
  const out: Record<string, string | number> = { page: params.page ?? 1 };
  for (const [k, v] of Object.entries(params)) {
    if (k === "page" || v == null || v === "") continue;
    if (k === "q") {
      const q = String(v).trim();
      if (q) out.q = q;
    } else if (typeof v === "string" || typeof v === "number") {
      out[k] = v;
    }
  }
  return out;
}

/* ---------------------------------------------------------------------- API */

export const CARD_PAGE_SIZE = 30;
export const RULE_PAGE_SIZE = 25;
/** cards/{id}/transactions/ limit sınırları (views/personnel_cards.py:294) */
export const CARD_TX_DEFAULT_LIMIT = 100;
export const CARD_TX_MAX_LIMIT = 500;

export const cardsApi = {
  list: (params: CardListParams = {}, signal?: AbortSignal): Promise<CardListResponse> =>
    apiClient.get("/cards/", { params: cardListParams(params), signal }).then((r) => normalizeCardList(r.data)),

  detail: (id: number, signal?: AbortSignal): Promise<PersonnelCard> =>
    apiClient.get(`/cards/${id}/`, { signal }).then((r) => normalizeCard(r.data)),

  create: (payload: CardCreatePayload): Promise<PersonnelCard> =>
    apiClient.post("/cards/", payload).then((r) => normalizeCard(r.data)),

  update: (id: number, patch: CardUpdatePayload): Promise<PersonnelCard> =>
    apiClient.patch(`/cards/${id}/`, patch).then((r) => normalizeCard(r.data)),

  remove: (id: number): Promise<void> => apiClient.delete(`/cards/${id}/`).then(() => undefined),

  approve: (id: number, reverseUid = false): Promise<PersonnelCard> =>
    apiClient.post(`/cards/${id}/approve/`, { reverse_uid: reverseUid }).then((r) => normalizeCard(r.data)),

  reject: (id: number): Promise<{ detail: string }> =>
    apiClient.post(`/cards/${id}/reject/`).then((r) => ({ detail: str(asObject(r.data).detail) ?? "" })),

  rejectAllPending: (): Promise<BulkResult> =>
    apiClient.post("/cards/reject-all-pending/").then((r) => normalizeBulkResult(r.data)),

  /** Bakiye hareketleri (web kart geçmişi), 25/sayfa, en yeni önce */
  balanceLogs: (id: number, page = 1, signal?: AbortSignal): Promise<PageResponse<CardBalanceLog>> =>
    apiClient.get(`/cards/${id}/balance-logs/`, { params: { page }, signal }).then((r) => normalizePage(r.data, normalizeBalanceLog)),

  transactions: (id: number, limit = CARD_TX_DEFAULT_LIMIT, signal?: AbortSignal): Promise<CardTransactionsResponse> =>
    apiClient
      .get(`/cards/${id}/transactions/`, { params: { limit: Math.min(limit, CARD_TX_MAX_LIMIT) }, signal })
      .then((r) => {
        const o = asObject(r.data);
        return {
          card: normalizeCard(o.card),
          transactions: Array.isArray(o.transactions) ? o.transactions.map(normalizeTransaction) : [],
          success_count: int(o.success_count),
          fail_count: int(o.fail_count),
        };
      }),

  /** `amount` sayı olarak alınır, backend'e "12.50" string gönderilir */
  bulkBalance: (cardIds: number[], operation: BulkBalanceOperation, amount: number): Promise<BulkResult> =>
    apiClient
      .post("/cards/bulk/balance/", { card_ids: cardIds, operation, amount: toApiDecimal(amount) })
      .then((r) => normalizeBulkResult(r.data)),

  bulkDelete: (cardIds: number[]): Promise<BulkResult> =>
    apiClient.post("/cards/bulk/delete/", { card_ids: cardIds }).then((r) => normalizeBulkResult(r.data)),

  bulkGroups: (cardIds: number[], groupIds: number[], operation: BulkGroupsOperation): Promise<BulkResult> =>
    apiClient
      .post("/cards/bulk/groups/", { card_ids: cardIds, group_ids: groupIds, operation })
      .then((r) => normalizeBulkResult(r.data)),

  /**
   * Bir gruptaki tüm aktif kartların id'leri — tüm sayfalar gezilir (yalnız 1. sayfa değil).
   * Grup bazlı istihkak ataması için; backend'de toplu/grup seçeneği yok.
   */

  groups: {
    list: (params: { q?: string } = {}, signal?: AbortSignal): Promise<CardGroup[]> => {
      const q = params.q?.trim();
      return apiClient
        .get("/card-groups/", { params: q ? { q } : undefined, signal })
        .then((r) => unwrapResults<unknown>(r.data as { results?: unknown[] }).map(normalizeCardGroup));
    },
    detail: (id: number, signal?: AbortSignal): Promise<CardGroupDetail> =>
      apiClient.get(`/card-groups/${id}/`, { signal }).then((r) => normalizeCardGroupDetail(r.data)),
    create: (payload: { name: string; pos_device_ids?: number[] }): Promise<CardGroupDetail> =>
      apiClient.post("/card-groups/", payload).then((r) => normalizeCardGroupDetail(r.data)),
    update: (id: number, patch: CardGroupPayload): Promise<CardGroupDetail> =>
      apiClient.patch(`/card-groups/${id}/`, patch).then((r) => normalizeCardGroupDetail(r.data)),
    remove: (id: number): Promise<void> => apiClient.delete(`/card-groups/${id}/`).then(() => undefined),
  },

  /**
   * Kart grubuna atanabilir cihazlar (id içeren kaynak). `pos-devices/` listesi `id` dönmediği
   * için kullanılamaz (API_CONTRACTS §3.9).
   */
  deviceOptions: async (
    source: DeviceOptionSource,
    companyId: number | null,
    signal?: AbortSignal
  ): Promise<DeviceOption[]> => {
    if (source === "assignable-options") {
      const { data } = await apiClient.get("/users/assignable-options/", { signal });
      const list = asObject(data).pos_devices;
      return (Array.isArray(list) ? list : []).map((raw) => {
        const o = asObject(raw);
        const parts = [str(o.location_name), str(o.company_name)].filter(Boolean);
        return {
          id: int(o.id),
          sn: str(o.sn) ?? "",
          pos_name: str(o.pos_name),
          description: parts.length ? parts.join(" · ") : undefined,
        };
      });
    }
    const { data } = await apiClient.get("/reports/filter-options/", { signal });
    const list = asObject(data).devices;
    return (Array.isArray(list) ? list : [])
      .map((raw) => asObject(raw))
      // Backend şirket dışı cihaz id'lerini sessizce atlar (views:512-514) → yalnız seçili şirket
      .filter((o) => companyId == null || intOrNull(o.company_id) === companyId)
      .map((o) => ({ id: int(o.id), sn: str(o.sn) ?? "", pos_name: str(o.pos_name) }));
  },

  recurringBalance: {
    list: (params: { page?: number; q?: string } = {}, signal?: AbortSignal): Promise<PageResponse<RecurringBalanceRule>> =>
      apiClient
        .get("/recurring-balance/", { params: withQ(params), signal })
        .then((r) => normalizePage(r.data, normalizeRecurringBalance)),
    create: (payload: RecurringBalancePayload): Promise<RecurringBalanceRule> =>
      apiClient.post("/recurring-balance/", payload).then((r) => normalizeRecurringBalance(r.data)),
    update: (id: number, patch: Partial<RecurringBalancePayload>): Promise<RecurringBalanceRule> =>
      apiClient.patch(`/recurring-balance/${id}/`, patch).then((r) => normalizeRecurringBalance(r.data)),
    remove: (id: number): Promise<void> => apiClient.delete(`/recurring-balance/${id}/`).then(() => undefined),
  },

  quotas: {
    list: (
      params: { page?: number; q?: string; group_id?: number | null; card_id?: number | null } = {},
      signal?: AbortSignal
    ): Promise<PageResponse<CardQuota>> =>
      apiClient.get("/card-quotas/", { params: withQ(params), signal }).then((r) => normalizePage(r.data, normalizeQuota)),
    create: (payload: CardQuotaCreatePayload, signal?: AbortSignal): Promise<CreatedIdsResponse> =>
      apiClient.post("/card-quotas/", payload, { signal }).then((r) => normalizeCreatedIds(r.data)),
    /** Gruptaki tüm aktif kartlar — tek istek; çakışmada hiçbiri yazılmaz (400) */
    createForGroup: (payload: GroupQuotaCreatePayload): Promise<GroupQuotaResult> =>
      apiClient.post("/card-quotas/", payload).then((r) => {
        const o = asObject(r.data);
        return { created: int(o.created), skipped: int(o.skipped), cards: int(o.cards), detail: str(o.detail) ?? "" };
      }),
    update: (id: number, patch: CardQuotaUpdatePayload): Promise<CardQuota> =>
      apiClient.patch(`/card-quotas/${id}/`, patch).then((r) => normalizeQuota(r.data)),
    remove: (id: number): Promise<void> => apiClient.delete(`/card-quotas/${id}/`).then(() => undefined),
  },

  recurringQuota: {
    list: (params: { page?: number; q?: string } = {}, signal?: AbortSignal): Promise<PageResponse<RecurringQuotaRule>> =>
      apiClient
        .get("/recurring-quota/", { params: withQ(params), signal })
        .then((r) => normalizePage(r.data, normalizeRecurringQuota)),
    create: (payload: RecurringQuotaPayload): Promise<CreatedIdsResponse> =>
      apiClient.post("/recurring-quota/", payload).then((r) => normalizeCreatedIds(r.data)),
    update: (id: number, patch: Partial<RecurringQuotaPayload>): Promise<RecurringQuotaRule> =>
      apiClient.patch(`/recurring-quota/${id}/`, patch).then((r) => normalizeRecurringQuota(r.data)),
    remove: (id: number): Promise<void> => apiClient.delete(`/recurring-quota/${id}/`).then(() => undefined),
  },
};
