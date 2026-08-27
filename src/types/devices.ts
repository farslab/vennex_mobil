export interface FillRate {
  pct: number;
  qty: number;
  max: number;
}

export interface PosDeviceListItem {
  sn: string;
  pos_name: string;
  stat: boolean;
  online: boolean;
  company_id?: number | null;
  company_name?: string | null;
  location_id?: number | null;
  location_name?: string | null;
  act_vmc?: string | null;
  act_macstat?: number | null;
  last_seen?: string | null;
  sort_order: number;
  today_revenue?: number | null;
  today_tx_count?: number | null;
  yesterday_revenue?: number | null;
  this_month_revenue?: number | null;
  last_month_revenue?: number | null;
  last_transaction?: string | null;
  fill_rate?: FillRate | null;
}

export interface PosProduct {
  id: number;
  urun_no?: number | null;
  is_wildcard: boolean;
  price: number;
  quantity: number;
  max_quantity: number;
  name?: string | null;
  stock_sku?: number | null;
  stock_sku_name?: string | null;
  stock_sku_code?: string | null;
}

export interface PosProductsResponse {
  mode: "stock" | "normal";
  items: PosProduct[];
  fill: { pct: number; qty: number; max: number };
}

export interface PosTransaction {
  id: number;
  pt_id: string;
  pt_datetime: string;
  amount: number;
  pt_type: number;
  status: boolean;
  iptalNo?: number | null;
  product_no?: number | null;
  pt_pan?: string | null;
  bankRefNo?: string | null;
  display_name?: string | null;
}

export interface CashHistoryItem {
  id: number;
  datetime: string | null;
  amount: number;
  notes: string;
  collected_by: string | null;
}

export interface RevenueCountItem {
  id: number;
  datetime: string | null;
  total_revenue: number;
  notes: string;
  counted_by: string | null;
  by_pt_type: Record<string, number>;
}

