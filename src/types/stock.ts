export type StockLocationType = "warehouse" | "vehicle" | "depot" | "vending_machine";

export const STOCK_LOCATION_TYPE_LABELS: Record<StockLocationType, string> = {
  warehouse: "Ana Depo",
  vehicle: "Araç",
  depot: "Ara Depo",
  vending_machine: "Otomat",
};

export interface StockLocation {
  id: number;
  name: string;
  location_type: StockLocationType;
  is_active: boolean;
  pos_device_sn?: string | null;
}

export interface RecipeSummary {
  component_count: number;
  margin_percent: number | null;
}

export interface StockSku {
  id: number;
  name: string;
  sku_code: string;
  barcode?: string | null;
  unit_cost?: number | null;
  kind: "simple" | "composite" | "ingredient";
  kind_display: string;
  base_unit: string;
  unit_short: string;
  package_size: number;
  package_label: string;
  sale_price: number;
  vat_rate: number;
  sale_price_excl_vat: number;
  vat_amount: number;
  recipe_summary?: RecipeSummary | null;  // backend eklemesi yapılmadıysa undefined kalır
  created_at: string;
  updated_at: string;
}

export const SKU_KIND_LABELS: Record<StockSku["kind"], string> = {
  simple: "Ürünler",
  composite: "Reçeteli",
  ingredient: "Bileşenler",
};

export interface StockOverviewRow {
  sku_id: number;
  sku_name: string;
  sku_code: string;
  total: number;
}

export type StockMovementType = "transfer" | "receipt" | "adjustment" | "refill";

export interface StockMovement {
  id: number;
  type: StockMovementType;
  sku_name: string;
  quantity: number; // negatif = çıkış
  datetime: string;
  from_name?: string | null;
  to_name?: string | null;
  reason?: string | null;
}

export interface StockInventoryRow {
  sku_id: number;
  sku_name: string;
  quantity: number;
}

