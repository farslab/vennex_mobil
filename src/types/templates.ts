/**
 * Ürün şablonu tipleri — backend `serializers/product_template.py`, `views/product_templates.py`
 * (docs/API_CONTRACTS.md §2.7, §3.1, §3.2, §3.10).
 */
import type { Money } from "./devices";

/** 0 = Snack, 1 = Kahve (ProductTemplate.machine_type, POSDevice.pos_odemetip ile aynı choices) */
export type TemplateMachineType = 0 | 1;

/** `GET product-templates/` satırı — `items` / `assigned_devices` YOK */
export interface ProductTemplateSummary {
  id: number;
  name: string;
  description: string | null;
  machine_type: TemplateMachineType;
  item_count: number | null;
  assigned_device_count: number | null;
  created_at: string | null;
  updated_at: string | null;
}

export interface TemplateItem {
  id: number;
  urun_no: number | null;
  is_wildcard: boolean;
  stock_sku: number | null;
  stock_sku_name: string | null;
  stock_sku_code: string | null;
  name: string;
  /** DecimalField → string "15.00" */
  price: Money | null;
  max_quantity: number;
  quantity: number;
  order: number;
}

export interface TemplateAssignedDevice {
  sn: string;
  pos_name: string | null;
}

/** `GET product-templates/{id}/` */
export interface ProductTemplateDetail {
  id: number;
  name: string;
  description: string | null;
  machine_type: TemplateMachineType;
  items: TemplateItem[];
  assigned_devices: TemplateAssignedDevice[];
  created_at: string | null;
  updated_at: string | null;
}

export interface TemplateWritePayload {
  name: string;
  description?: string | null;
  machine_type?: TemplateMachineType;
}

/**
 * `POST product-templates/{id}/items/` — TEK kalem objesi (TemplateItemWriteSerializer).
 * - `price` zorunlu ("15.00")
 * - stok modunda `stock_sku` zorunlu (ad SKU'dan üretilir); normal modda `name` zorunlu (≤50)
 * - `is_wildcard` yalnız stok modunda etkili; true ise `urun_no` null'a zorlanır
 */
export interface TemplateItemPayload {
  urun_no: number | null;
  is_wildcard: boolean;
  stock_sku?: number | null;
  name?: string;
  price: string;
  max_quantity: number;
  quantity: number;
  order?: number;
}

export interface TemplateAssignResult {
  detail: string;
  assigned_count: number;
  /** Makine tipi uyuşmadığı için atlanan cihaz adları/SN'leri */
  type_mismatch: string[];
}

export interface TemplateSendResult {
  detail: string;
  created: number;
}
