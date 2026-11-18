/**
 * Stok API — backend `vennex_mobile/views/stock.py` (tümü `CanManageStock`).
 *
 * Sözleşme notları (docs/API_CONTRACTS.md §2.9, §3.2):
 * - Sayfasız uçlar `{results}`; hareket listeleri `{count,page,num_pages,results}` (25'lik sabit sayfa).
 * - Envanter satırı FK alanı `sku` (sku_id değil); overview satırı `sku_id`.
 * - POST gövdeleri `sku_id`, `*_location_id`; miktar `QuantityField` (Decimal(12,3)) → string gönderilir.
 * - Hareket OLUŞTURMA tipe özel uçlarla yapılır (`transfers/`, `receipts/`, `adjustments/`).
 *   SÖZLEŞME: doğrulanamadı — birleşik `POST stock/movements/` iç view'ı `view.as_view()(request._request)`
 *   ile çağırıyor (views/stock.py:493). Dış view gövdeyi zaten okuduğu için iç DRF Request'in gövdeyi
 *   yeniden okuması RawPostDataException/boş gövde riski taşır; Flutter da henüz bu uca geçmedi.
 *   Okuma (GET) için birleşik uç kullanılır (type filtresi + sayfalama, gövde yok).
 */
import { apiClient, type ApiError } from "./client";
import { unwrapResults, type PageResponse } from "./pagination";
import { toApiDecimal, toNumber } from "@/utils/number";
import type {
  StockBaseUnit,
  StockInventoryRow,
  StockLocation,
  StockLocationInventory,
  StockLocationType,
  StockLocationWritePayload,
  StockMovement,
  StockMovementInput,
  StockMovementType,
  StockOverviewRow,
  StockSku,
  StockSkuKind,
  StockSkuWritePayload,
  SyncVendingResult,
} from "@/types/stock";

/* ------------------------------------------------------------------ normalizers */

type Raw = Record<string, unknown>;

const asRecord = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const str = (v: unknown): string => (typeof v === "string" ? v : v == null ? "" : String(v));
const strOrNull = (v: unknown): string | null => (typeof v === "string" && v !== "" ? v : null);
const idOrNull = (v: unknown): number | null => {
  const n = toNumber(v);
  return n == null ? null : n;
};

/**
 * QuantityField miktarı: int (adet) veya float (gram/ml). Eski/alternatif istemciler için
 * string ("5.000") de kabul edilir. Geçersizse null (uydurma 0 değil).
 */
export function normalizeQuantity(value: unknown): number | null {
  return toNumber(value);
}

const LOCATION_TYPES: StockLocationType[] = ["warehouse", "vehicle", "depot", "vending_machine"];
const SKU_KINDS: StockSkuKind[] = ["simple", "composite", "ingredient"];
const BASE_UNITS: StockBaseUnit[] = ["piece", "gram", "ml"];

export function normalizeLocation(raw: unknown): StockLocation {
  const r = asRecord(raw);
  const type = LOCATION_TYPES.includes(r.location_type as StockLocationType)
    ? (r.location_type as StockLocationType)
    : "warehouse";
  return {
    id: Number(r.id),
    name: str(r.name),
    location_type: type,
    location_type_display: strOrNull(r.location_type_display) ?? undefined,
    is_active: r.is_active !== false,
    pos_device: idOrNull(r.pos_device),
    pos_device_sn: strOrNull(r.pos_device_sn),
    created_at: strOrNull(r.created_at) ?? undefined,
    updated_at: strOrNull(r.updated_at) ?? undefined,
  };
}

export function normalizeSku(raw: unknown): StockSku {
  const r = asRecord(raw);
  const kind = SKU_KINDS.includes(r.kind as StockSkuKind) ? (r.kind as StockSkuKind) : "simple";
  const baseUnit = BASE_UNITS.includes(r.base_unit as StockBaseUnit) ? (r.base_unit as StockBaseUnit) : "piece";
  return {
    id: Number(r.id),
    name: str(r.name),
    sku_code: str(r.sku_code),
    barcode: strOrNull(r.barcode),
    unit_cost: (r.unit_cost as string | number | null | undefined) ?? null,
    kind,
    kind_display: strOrNull(r.kind_display) ?? undefined,
    base_unit: baseUnit,
    unit_short: strOrNull(r.unit_short) ?? undefined,
    package_size: normalizeQuantity(r.package_size),
    package_label: str(r.package_label),
    sale_price: (r.sale_price as string | number | null | undefined) ?? null,
    vat_rate: (r.vat_rate as string | number | null | undefined) ?? null,
    sale_price_excl_vat: (r.sale_price_excl_vat as string | number | null | undefined) ?? null,
    vat_amount: (r.vat_amount as string | number | null | undefined) ?? null,
    created_at: strOrNull(r.created_at) ?? undefined,
    updated_at: strOrNull(r.updated_at) ?? undefined,
  };
}

export function normalizeOverviewRow(raw: unknown): StockOverviewRow {
  const r = asRecord(raw);
  return {
    sku_id: Number(r.sku_id ?? r.sku),
    sku_name: str(r.sku_name),
    sku_code: str(r.sku_code),
    total: normalizeQuantity(r.total) ?? 0,
  };
}

/** Envanter satırı: sözleşme `sku`; eski/hatalı istemci şeması `sku_id` yalnız yedek olarak okunur */
export function normalizeInventoryRow(raw: unknown): StockInventoryRow {
  const r = asRecord(raw);
  const locType = LOCATION_TYPES.includes(r.location_type as StockLocationType)
    ? (r.location_type as StockLocationType)
    : undefined;
  return {
    id: Number(r.id),
    sku: Number(r.sku ?? r.sku_id),
    sku_name: str(r.sku_name),
    sku_code: str(r.sku_code),
    location: Number(r.location),
    location_name: strOrNull(r.location_name) ?? undefined,
    location_type: locType,
    quantity: normalizeQuantity(r.quantity) ?? 0,
    updated_at: strOrNull(r.updated_at) ?? undefined,
  };
}

export function normalizeMovement(raw: unknown): StockMovement {
  const r = asRecord(raw);
  return {
    id: Number(r.id),
    movement_type: str(r.movement_type ?? r.type),
    movement_type_display: strOrNull(r.movement_type_display) ?? undefined,
    sku: Number(r.sku ?? r.sku_id),
    sku_name: str(r.sku_name),
    from_location: idOrNull(r.from_location),
    from_location_name: strOrNull(r.from_location_name ?? r.from_name),
    to_location: idOrNull(r.to_location),
    to_location_name: strOrNull(r.to_location_name ?? r.to_name),
    quantity: Math.abs(normalizeQuantity(r.quantity) ?? 0),
    reason: strOrNull(r.reason),
    created_at: str(r.created_at ?? r.datetime),
    created_by_username: strOrNull(r.created_by_username),
  };
}

function normalizePage<T>(raw: unknown, map: (row: unknown) => T): PageResponse<T> {
  const r = asRecord(raw);
  const results = Array.isArray(r.results) ? r.results.map(map) : [];
  return {
    count: toNumber(r.count) ?? results.length,
    page: toNumber(r.page) ?? 1,
    num_pages: toNumber(r.num_pages) ?? 1,
    results,
  };
}

/* --------------------------------------------------------------- movement input */

/** Hareketin bir lokasyona göre yönü: +1 giriş, -1 çıkış, 0 lokasyonlar arası (transfer/dolum) */
export function movementDirection(m: Pick<StockMovement, "from_location" | "to_location">, locationId?: number): 1 | -1 | 0 {
  if (locationId != null) {
    if (m.to_location === locationId) return 1;
    if (m.from_location === locationId) return -1;
    return 0;
  }
  if (m.from_location != null && m.to_location != null) return 0;
  if (m.to_location != null) return 1;
  if (m.from_location != null) return -1;
  return 0;
}

/** Bir sayının en fazla `digits` ondalık haneye sahip olup olmadığı */
function hasAtMostDecimals(n: number, digits: number): boolean {
  const f = 10 ** digits;
  return Math.abs(n * f - Math.round(n * f)) < 1e-6;
}

/** Miktarı birime göre API string'ine çevirir: adet → "5", gram/ml → "12.500" */
export function toApiQuantity(n: number, unit: StockBaseUnit): string {
  return unit === "piece" ? toApiDecimal(n, 0) : toApiDecimal(n, 3);
}

/**
 * Birime göre miktar doğrulaması (backend `_assert_whole`, QuantityField(12,3), MIN 0.001).
 * `allowNegative` yalnız düzeltme için.
 */
export function validateQuantity(
  quantity: number | null,
  unit: StockBaseUnit,
  { allowNegative = false }: { allowNegative?: boolean } = {}
): string | null {
  if (quantity == null || !Number.isFinite(quantity)) return "Geçerli bir miktar girin.";
  if (quantity === 0) return "Miktar sıfırdan farklı olmalı.";
  if (!allowNegative && quantity < 0) return "Miktar pozitif olmalı.";
  if (unit === "piece" && !Number.isInteger(quantity)) return "Adet bazlı üründe kesirli miktar girilemez.";
  if (!hasAtMostDecimals(quantity, 3)) return "En fazla 3 ondalık hane girilebilir.";
  if (Math.abs(quantity) >= 1e9) return "Miktar çok büyük.";
  return null;
}

/** İstemci tarafı doğrulama — hata yoksa null. Aynı lokasyonlar arası transfer reddedilir. */
export function validateMovementInput(input: StockMovementInput): Record<string, string> | null {
  const errors: Record<string, string> = {};
  if (!input.sku_id) errors.sku_id = "Ürün seçin.";
  if (input.type === "transfer") {
    if (!input.from_location_id) errors.from_location_id = "Kaynak lokasyon seçin.";
    if (!input.to_location_id) errors.to_location_id = "Hedef lokasyon seçin.";
    if (input.from_location_id && input.from_location_id === input.to_location_id)
      errors.to_location_id = "Kaynak ve hedef lokasyon aynı olamaz.";
  } else if (input.type === "receipt") {
    if (!input.to_location_id) errors.to_location_id = "Hedef lokasyon seçin.";
  } else {
    if (!input.location_id) errors.location_id = "Lokasyon seçin.";
    if ((input.reason ?? "").length > 200) errors.reason = "Açıklama en fazla 200 karakter olabilir.";
  }
  const qErr = validateQuantity(input.quantity, input.unit, { allowNegative: input.type === "adjustment" });
  if (qErr) errors.quantity = qErr;
  return Object.keys(errors).length ? errors : null;
}

/** Tipe göre uç + gövde (backend TransferSerializer / ReceiptSerializer / AdjustmentSerializer) */
export function buildMovementRequest(input: StockMovementInput): { url: string; body: Record<string, unknown> } {
  const quantity = toApiQuantity(input.quantity, input.unit);
  switch (input.type) {
    case "transfer":
      return {
        url: "/stock/transfers/",
        body: {
          from_location_id: input.from_location_id,
          to_location_id: input.to_location_id,
          sku_id: input.sku_id,
          quantity,
        },
      };
    case "receipt":
      return { url: "/stock/receipts/", body: { to_location_id: input.to_location_id, sku_id: input.sku_id, quantity } };
    case "adjustment": {
      const body: Record<string, unknown> = { location_id: input.location_id, sku_id: input.sku_id, quantity };
      const reason = input.reason?.trim();
      if (reason) body.reason = reason;
      return { url: "/stock/adjustments/", body };
    }
  }
}

function validationError(fieldErrors: Record<string, string>): ApiError {
  const err = new Error(Object.values(fieldErrors)[0]) as ApiError;
  err.fieldErrors = fieldErrors;
  err.status = 400;
  return err;
}

/* ------------------------------------------------------------------------- api */

export interface StockLocationListParams {
  /** Backend varsayılanı true; yalnız false pasifleri de getirir */
  active_only?: boolean;
  location_type?: StockLocationType;
}

export interface StockSkuListParams {
  q?: string;
  /** true → reçeteli ürünler hariç (stok hareketi formları için) */
  stockable?: boolean;
  /** Geriye dönük; backend artık SKU'da aktif/pasif tutmuyor (services_stock.py:39-42) */
  active_only?: boolean;
}

export const stockApi = {
  overview: (signal?: AbortSignal): Promise<StockOverviewRow[]> =>
    apiClient.get("/stock/overview/", { signal }).then((r) => unwrapResults<unknown>(r.data).map(normalizeOverviewRow)),

  locations: {
    list: (params: StockLocationListParams = {}, signal?: AbortSignal): Promise<StockLocation[]> =>
      apiClient
        .get("/stock/locations/", {
          params: {
            active_only: params.active_only === false ? "false" : undefined,
            location_type: params.location_type || undefined,
          },
          signal,
        })
        .then((r) => unwrapResults<unknown>(r.data).map(normalizeLocation)),

    get: (id: number, signal?: AbortSignal): Promise<StockLocation> =>
      apiClient.get(`/stock/locations/${id}/`, { signal }).then((r) => normalizeLocation(r.data)),

    create: (payload: StockLocationWritePayload): Promise<StockLocation> =>
      apiClient
        .post("/stock/locations/", { name: payload.name.trim(), location_type: payload.location_type, is_active: payload.is_active })
        .then((r) => normalizeLocation(r.data)),

    update: (id: number, patch: Partial<StockLocationWritePayload>): Promise<StockLocation> =>
      apiClient
        .patch(`/stock/locations/${id}/`, patch.name != null ? { ...patch, name: patch.name.trim() } : patch)
        .then((r) => normalizeLocation(r.data)),

    remove: (id: number): Promise<void> => apiClient.delete(`/stock/locations/${id}/`).then(() => undefined),

    syncVending: (): Promise<SyncVendingResult> =>
      apiClient.post("/stock/locations/sync-vending/").then((r) => {
        const d = asRecord(r.data);
        return { detail: str(d.detail), created: toNumber(d.created) ?? 0, updated: toNumber(d.updated) ?? 0 };
      }),

    /** Envanter + lokasyon başlığı (tek istek) */
    inventoryDetail: (id: number, signal?: AbortSignal): Promise<StockLocationInventory> =>
      apiClient.get(`/stock/locations/${id}/inventory/`, { signal }).then((r) => {
        const d = asRecord(r.data);
        return {
          location: d.location ? normalizeLocation(d.location) : null,
          results: unwrapResults<unknown>(d as { results?: unknown[] }).map(normalizeInventoryRow),
        };
      }),

    /** Yalnız envanter satırları */
    inventory: (id: number, signal?: AbortSignal): Promise<StockInventoryRow[]> =>
      stockApi.locations.inventoryDetail(id, signal).then((d) => d.results),

    movements: (id: number, page = 1, signal?: AbortSignal): Promise<PageResponse<StockMovement>> =>
      apiClient
        .get(`/stock/locations/${id}/movements/`, { params: { page }, signal })
        .then((r) => normalizePage(r.data, normalizeMovement)),
  },

  skus: {
    list: (params: StockSkuListParams = {}, signal?: AbortSignal): Promise<StockSku[]> =>
      apiClient
        .get("/stock/skus/", {
          params: {
            q: params.q?.trim() || undefined,
            stockable: params.stockable ? "true" : undefined,
            active_only: params.active_only ? "true" : undefined,
          },
          signal,
        })
        .then((r) => unwrapResults<unknown>(r.data).map(normalizeSku)),

    get: (id: number, signal?: AbortSignal): Promise<StockSku> =>
      apiClient.get(`/stock/skus/${id}/`, { signal }).then((r) => normalizeSku(r.data)),

    create: (payload: StockSkuWritePayload): Promise<StockSku> =>
      apiClient.post("/stock/skus/", payload).then((r) => normalizeSku(r.data)),

    update: (id: number, patch: StockSkuWritePayload): Promise<StockSku> =>
      apiClient.patch(`/stock/skus/${id}/`, patch).then((r) => normalizeSku(r.data)),

    remove: (id: number): Promise<void> => apiClient.delete(`/stock/skus/${id}/`).then(() => undefined),
  },

  movements: {
    /** Birleşik liste: GET stock/movements/?type=&page= (views/stock.py:469-482) */
    list: (params: { type?: StockMovementType; page?: number } = {}, signal?: AbortSignal): Promise<PageResponse<StockMovement>> =>
      apiClient
        .get("/stock/movements/", { params: { type: params.type || undefined, page: params.page ?? 1 }, signal })
        .then((r) => normalizePage(r.data, normalizeMovement)),

    /** İstemci doğrulamasından geçmeyen giriş için istek ATILMAZ (reject + fieldErrors) */
    create: async (input: StockMovementInput): Promise<StockMovement> => {
      const errors = validateMovementInput(input);
      if (errors) throw validationError(errors);
      const { url, body } = buildMovementRequest(input);
      const r = await apiClient.post(url, body);
      return normalizeMovement(r.data);
    },
  },

  /* ---- Eski ekran (StockOverviewScreen) uyumluluğu — lead silince kaldırılabilir ---- */
  /** @deprecated movements.create kullanın */
  transfers: {
    list: (page = 1) => stockApi.movements.list({ type: "transfer", page }),
    create: (p: { from_location_id: number; to_location_id: number; sku_id: number; quantity: number }) =>
      stockApi.movements.create({ type: "transfer", ...p, unit: "gram" }),
  },
  /** @deprecated movements.create kullanın */
  receipts: {
    list: (page = 1) => stockApi.movements.list({ type: "receipt", page }),
    create: (p: { to_location_id: number; sku_id: number; quantity: number }) =>
      stockApi.movements.create({ type: "receipt", ...p, unit: "gram" }),
  },
  /** @deprecated movements.create kullanın */
  adjustments: {
    list: (page = 1) => stockApi.movements.list({ type: "adjustment", page }),
    create: (p: { location_id: number; sku_id: number; quantity: number; reason: string }) =>
      stockApi.movements.create({ type: "adjustment", ...p, unit: "gram" }),
  },
};
