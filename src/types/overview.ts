export interface OverviewSummary {
  period: string;
  period_label: string;
  sales_visible: boolean;
  devices: { total: number; online: number; offline: number };
  revenue: number | null;
  previous_revenue: number | null;
  change_pct: number | null;
  change_positive: boolean | null;
  comparison_label: string | null;
  transactions: { total: number | null; success: number | null; failed: number | null };
  failures: {
    timeout: number | null;
    bank: number | null;
    technical: number | null;
    other: number | null;
  };
  start: string | null;
  end: string | null;
}

export interface RevenueTimeseries {
  mode: "hourly" | "daily";
  labels: string[];
  amounts: number[];
}

export interface PaymentBreakdownItem {
  pt_type: number;
  label: string;
  color: string;
  amount: number;
  count: number;
}

export interface TopDevice {
  sn: string;
  pos_name: string;
  revenue: number;
  tx_count: number;
}

export interface ErrorBreakdownItem {
  sn: string;
  pos_name: string;
  count: number;
}

export interface RecentTransaction {
  id: number;
  pt_id: string;
  datetime: string;
  sn: string;
  pos_name: string;
  product_name: string;
  amount: number;
  status: boolean;
  pt_type: number;
  pt_type_label: string;
  card_pan?: string | null;
}

export interface OverviewLocation {
  id: number;
  name: string;
  region_id?: number | null;
  region_name?: string | null;
}

// GET /overview/dashboard/ tam bundle yanıtı
export interface OverviewBundle {
  summary: OverviewSummary;
  revenue_timeseries: RevenueTimeseries | null;
  payment_breakdown: { results: PaymentBreakdownItem[] } | PaymentBreakdownItem[] | null;
  top_devices: { results: TopDevice[] } | TopDevice[] | null;
  error_breakdown: { results: ErrorBreakdownItem[] } | ErrorBreakdownItem[] | null;
  recent_transactions: { results: RecentTransaction[] } | RecentTransaction[] | null;
}
