/**
 * Ürün şablonları API'si — docs/API_CONTRACTS.md §2.7, §3.1, §3.2.
 * Kalemler TEK TEK yazılır: POST items/ (yeni), PATCH|DELETE items/{id}/.
 * Reçete/bileşen uçları mobil API'de YOK (RECETE_STOK_SISTEMI.md) — burada da yok.
 */
import { apiClient } from "./client";
import { unwrapResults } from "./pagination";
import { toNumber } from "@/utils/number";
import type {
  ProductTemplateDetail,
  ProductTemplateSummary,
  TemplateAssignResult,
  TemplateItem,
  TemplateItemPayload,
  TemplateMachineType,
  TemplateSendResult,
  TemplateWritePayload,
} from "@/types/templates";

type Raw = Record<string, unknown>;
const asObj = (v: unknown): Raw => (v && typeof v === "object" && !Array.isArray(v) ? (v as Raw) : {});
const str = (v: unknown): string | null => (typeof v === "string" ? v : typeof v === "number" ? String(v) : null);
const int = (v: unknown): number | null => {
  const n = toNumber(v);
  return n == null ? null : Math.trunc(n);
};
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** @deprecated Geriye dönük uyumluluk takma adları — `@/types/templates` kullanın */
export type ProductTemplate = ProductTemplateSummary & Partial<Pick<ProductTemplateDetail, "items" | "assigned_devices">>;
/** @deprecated `TemplateItem` kullanın */
export type ProductTemplateItem = TemplateItem;

/** Backend: 0 = Snack, 1 = Kahve. Model alanı yalnız 0|1 kabul eder (serializers/product_template.py:77-78; default 0). */
export function toTemplateMachineType(v: unknown): TemplateMachineType {
  return int(v) === 1 ? 1 : 0;
}

export function normalizeTemplateSummary(v: unknown): ProductTemplateSummary {
  const o = asObj(v);
  return {
    id: int(o.id) ?? 0,
    name: str(o.name) ?? "",
    description: str(o.description) || null,
    machine_type: toTemplateMachineType(o.machine_type),
    item_count: int(o.item_count),
    assigned_device_count: int(o.assigned_device_count),
    created_at: str(o.created_at),
    updated_at: str(o.updated_at),
  };
}

export function normalizeTemplateItem(v: unknown): TemplateItem {
  const o = asObj(v);
  const price = o.price;
  return {
    id: int(o.id) ?? 0,
    urun_no: int(o.urun_no),
    is_wildcard: o.is_wildcard === true,
    stock_sku: int(o.stock_sku),
    stock_sku_name: str(o.stock_sku_name) || null,
    stock_sku_code: str(o.stock_sku_code) || null,
    name: str(o.name) ?? "",
    price: (typeof price === "string" || typeof price === "number") && toNumber(price) != null ? price : null,
    max_quantity: toNumber(o.max_quantity) ?? 0,
    quantity: toNumber(o.quantity) ?? 0,
    order: int(o.order) ?? 0,
  };
}

export function normalizeTemplateDetail(v: unknown): ProductTemplateDetail {
  const o = asObj(v);
  return {
    id: int(o.id) ?? 0,
    name: str(o.name) ?? "",
    description: str(o.description) || null,
    machine_type: toTemplateMachineType(o.machine_type),
    items: arr(o.items).map(normalizeTemplateItem),
    assigned_devices: arr(o.assigned_devices)
      .map((d) => asObj(d))
      .map((d) => ({ sn: str(d.sn) ?? "", pos_name: str(d.pos_name) }))
      .filter((d) => d.sn),
    created_at: str(o.created_at),
    updated_at: str(o.updated_at),
  };
}

export const templatesApi = {
  /** `{results:[...]}` sayfasız; `item_count`, `assigned_device_count`, `machine_type` içerir */
  list: (signal?: AbortSignal) =>
    apiClient
      .get<unknown>("/product-templates/", { signal })
      .then((r) => unwrapResults(r.data as { results?: unknown[] } | unknown[]).map(normalizeTemplateSummary).filter((t) => t.id > 0)),

  detail: (id: number, signal?: AbortSignal) =>
    apiClient.get<unknown>(`/product-templates/${id}/`, { signal }).then((r) => normalizeTemplateDetail(r.data)),

  create: (payload: TemplateWritePayload) =>
    apiClient.post<unknown>("/product-templates/", payload).then((r) => normalizeTemplateDetail(r.data)),

  /** Kısmi; cihazlara eşliyken `machine_type` değişemez (400) */
  update: (id: number, payload: Partial<TemplateWritePayload>) =>
    apiClient.patch<unknown>(`/product-templates/${id}/`, payload).then((r) => normalizeTemplateDetail(r.data)),

  remove: (id: number) => apiClient.delete(`/product-templates/${id}/`).then(() => undefined),

  items: (id: number, signal?: AbortSignal) =>
    apiClient
      .get<unknown>(`/product-templates/${id}/items/`, { signal })
      .then((r) => unwrapResults(r.data as { results?: unknown[] }).map(normalizeTemplateItem)),

  /** TEK kalem objesi; `price` zorunlu */
  createItem: (id: number, payload: TemplateItemPayload) =>
    apiClient.post<unknown>(`/product-templates/${id}/items/`, payload).then((r) => normalizeTemplateItem(r.data)),

  /** Tam payload gönderin (kısmi güncellemede varsayılanlar mevcut değeri ezebilir) */
  updateItem: (id: number, itemId: number, payload: TemplateItemPayload) =>
    apiClient
      .patch<unknown>(`/product-templates/${id}/items/${itemId}/`, payload)
      .then((r) => normalizeTemplateItem(r.data)),

  deleteItem: (id: number, itemId: number) =>
    apiClient.delete(`/product-templates/${id}/items/${itemId}/`).then(() => undefined),

  /** Makine tipi uyuşmayan cihazlar `type_mismatch[]` ile atlanır */
  assignDevices: (id: number, deviceSns: string[]) =>
    apiClient
      .post<Raw>(`/product-templates/${id}/assign/`, { device_sns: deviceSns })
      .then(
        (r): TemplateAssignResult => ({
          detail: str(r.data?.detail) ?? "",
          assigned_count: int(r.data?.assigned_count) ?? 0,
          type_mismatch: arr(r.data?.type_mismatch).map((s) => String(s)),
        })
      ),

  /** Tek cihaza gönder: cihazın mevcut ÜRÜNLERİ silinip şablondan yeniden yaratılır (normal mod). */
  send: (id: number, sn: string) =>
    apiClient
      .post<Raw>(`/product-templates/${id}/send/`, { sn })
      .then((r): TemplateSendResult => ({ detail: str(r.data?.detail) ?? "", created: int(r.data?.created) ?? 0 })),
};
