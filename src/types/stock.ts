/**
 * Stok domain şemaları — backend `vennex_mobile/serializers/stock.py`, `views/stock.py`,
 * `api/models.py` (StockSKU / StockLocation / StockInventory / StockMovement).
 *
 * - Miktarlar `QuantityField` → number (tam ise int, gramajlı ise float). Yine de istemci
 *   `toNumber` ile okur (api/stock.ts normalizer'ları).
 * - Para alanları DRF `DecimalField` → string ("25.00"); `number | string` kabul edilir.
 */

export type StockLocationType = "warehouse" | "vehicle" | "depot" | "vending_machine";

export const STOCK_LOCATION_TYPES: StockLocationType[] = ["warehouse", "depot", "vehicle", "vending_machine"];

/** Backend `StockLocation.LOCATION_TYPE_CHOICES` etiketleri */
export const STOCK_LOCATION_TYPE_LABELS: Record<StockLocationType, string> = {
  warehouse: "Ana Depo",
  vehicle: "Araç",
  depot: "Ara Depo",
  vending_machine: "Otomat",
};

/** Elle oluşturulabilen tipler (otomat lokasyonu yalnız `sync-vending` ile oluşur — views/stock.py:115-119) */
export const MANUAL_LOCATION_TYPES: Exclude<StockLocationType, "vending_machine">[] = ["warehouse", "depot", "vehicle"];

export interface StockLocation {
  id: number;
  name: string;
  location_type: StockLocationType;
  location_type_display?: string;
  is_active: boolean;
  /** Otomat lokasyonunda bağlı POSDevice id; diğerlerinde null */
  pos_device?: number | null;
  pos_device_sn?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface StockLocationWritePayload {
  name: string;
  location_type: Exclude<StockLocationType, "vending_machine">;
  is_active: boolean;
}

export interface SyncVendingResult {
  detail: string;
  created: number;
  updated: number;
}

export type StockSkuKind = "simple" | "composite" | "ingredient";
export type StockBaseUnit = "piece" | "gram" | "ml";

/** Backend `StockSKU.KIND_CHOICES` */
export const SKU_KIND_LABELS: Record<StockSkuKind, string> = {
  simple: "Ürün",
  composite: "Reçeteli Ürün",
  ingredient: "Bileşen",
};

/** Backend `StockSKU.BASE_UNIT_CHOICES` */
export const BASE_UNIT_LABELS: Record<StockBaseUnit, string> = {
  piece: "Adet",
  gram: "Gram",
  ml: "Mililitre",
};

/** Backend `StockSKU.BASE_UNIT_SHORT` */
export const BASE_UNIT_SHORT: Record<StockBaseUnit, string> = {
  piece: "adet",
  gram: "g",
  ml: "ml",
};

type Money = number | string;

export interface StockSku {
  id: number;
  name: string;
  sku_code: string;
  barcode?: string | null;
  /** KDV dahil alış fiyatı (DecimalField → string) */
  unit_cost?: Money | null;
  kind: StockSkuKind;
  kind_display?: string;
  base_unit: StockBaseUnit;
  unit_short?: string;
  /** QuantityField → number */
  package_size?: number | null;
  package_label?: string;
  /** KDV dahil satış fiyatı */
  sale_price?: Money | null;
  vat_rate?: Money | null;
  sale_price_excl_vat?: Money | null;
  vat_amount?: Money | null;
  created_at?: string;
  updated_at?: string;
}

/** POST/PATCH `stock/skus/` gövdesi (serializers/stock.py:40-71). Ondalıklar string. */
export interface StockSkuWritePayload {
  name?: string;
  sku_code?: string;
  barcode?: string | null;
  unit_cost?: string;
  sale_price?: string;
  vat_rate?: string;
  kind?: StockSkuKind;
  base_unit?: StockBaseUnit;
  package_size?: string;
  package_label?: string;
}

/** GET `stock/overview/` satırı (views/stock.py:63-69) — reçeteli ürünler hariç, birim alanı YOK */
export interface StockOverviewRow {
  sku_id: number;
  sku_name: string;
  sku_code: string;
  /** Tüm lokasyonların toplamı (negatif olabilir) */
  total: number;
}

/** GET `stock/locations/{id}/inventory/` satırı — FK alanı `sku` (sku_id DEĞİL; API_CONTRACTS §3.2) */
export interface StockInventoryRow {
  id: number;
  sku: number;
  sku_name: string;
  sku_code: string;
  location: number;
  location_name?: string;
  location_type?: StockLocationType;
  /** Negatif olabilir (StockInventory: "Negatif stok engellenmez") */
  quantity: number;
  updated_at?: string;
}

export interface StockLocationInventory {
  location: StockLocation | null;
  results: StockInventoryRow[];
}

/** Backend `StockMovement.MOVEMENT_TYPE_CHOICES` */
export type StockMovementType = "receipt" | "transfer" | "adjustment" | "refill" | "consumption";

export const MOVEMENT_TYPE_LABELS: Record<StockMovementType, string> = {
  receipt: "Stok Girişi",
  transfer: "Transfer",
  adjustment: "Düzeltme",
  refill: "Dolum",
  consumption: "Satış Tüketimi",
};

/** MovementListSerializer (serializers/stock.py:134-170) */
export interface StockMovement {
  id: number;
  movement_type: StockMovementType | string;
  movement_type_display?: string;
  sku: number;
  sku_name: string;
  from_location: number | null;
  from_location_name: string | null;
  to_location: number | null;
  to_location_name: string | null;
  /** Her zaman pozitif (düzeltmede abs(delta)); yön from/to'dan çıkar */
  quantity: number;
  reason: string | null;
  created_at: string;
  created_by_username: string | null;
}

/** Elle oluşturulabilen hareket tipleri */
export type StockMovementInput =
  | { type: "transfer"; from_location_id: number; to_location_id: number; sku_id: number; quantity: number; unit: StockBaseUnit }
  | { type: "receipt"; to_location_id: number; sku_id: number; quantity: number; unit: StockBaseUnit }
  | { type: "adjustment"; location_id: number; sku_id: number; quantity: number; reason?: string; unit: StockBaseUnit };
