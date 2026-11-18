/**
 * Overview / Dashboard backend şemaları.
 * Kaynak: docs/API_CONTRACTS.md §2.4, §3.8 · backend `views/overview.py:55-247, 362-402`.
 *
 * Not: View'lar elle dict kurduğu için para alanları `float(...)` → number döner;
 * yine de savunmacı olarak `toNumber` ile okunur (normalizeDashboard).
 */

/** Ham summary — `sales_visible=false` iken yalnız {period, period_label, devices, sales_visible} gelir (`overview.py:61-71`) */
export interface OverviewSummaryRaw {
  period: string;
  period_label: string;
  sales_visible: boolean;
  devices: { total: number; online: number; offline: number };
  start?: string | null;
  end?: string | null;
  revenue?: number | string | null;
  previous_revenue?: number | string | null;
  /** Önceki dönem cirosu 0 ise null (`overview.py:97-105`) */
  change_pct?: number | null;
  change_positive?: boolean | null;
  comparison_label?: string | null;
  transactions?: { total?: number | null; success?: number | null; failed?: number | null };
  failures?: { timeout?: number | null; bank?: number | null; technical?: number | null; other?: number | null };
}

/** Eski ad — geriye dönük uyumluluk */
export type OverviewSummary = OverviewSummaryRaw;

export interface RevenueTimeseries {
  mode: "hourly" | "daily";
  labels: string[];
  amounts: number[];
}

export interface PaymentBreakdownItem {
  pt_type: number;
  label: string;
  /** Backend hex renk; bilinmeyen tipte "gray" gelebilir (`overview.py:161`) — UI tema paletini kullanır */
  color: string;
  amount: number;
  count: number;
}

export interface TopDevice {
  sn: string;
  pos_name: string | null;
  revenue: number;
  tx_count: number;
}

/** Teknik hata (iptalNo=3) veren cihazlar (`overview.py:196-216`) */
export interface ErrorBreakdownItem {
  sn: string;
  pos_name: string | null;
  count: number;
}

export interface RecentTransaction {
  id: number;
  pt_id: string;
  datetime: string | null;
  sn: string | null;
  pos_name: string | null;
  product_name: string | null;
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

type ResultsNode<T> = { results: T[] } | T[] | null | undefined;

/** GET /overview/dashboard/ ham bundle yanıtı — satış yetkisi yoksa 5 alan `null` (`overview.py:392-401`) */
export interface OverviewBundle {
  summary: OverviewSummaryRaw;
  revenue_timeseries: RevenueTimeseries | null;
  payment_breakdown: ResultsNode<PaymentBreakdownItem>;
  top_devices: ResultsNode<TopDevice>;
  error_breakdown: ResultsNode<ErrorBreakdownItem>;
  recent_transactions: ResultsNode<RecentTransaction>;
}

/* ------------------------------------------------------- Normalize model */

export interface DashboardSales {
  revenue: number | null;
  previousRevenue: number | null;
  /** Yalnız backend hesapladıysa (önceki dönem > 0) */
  changePct: number | null;
  comparisonLabel: string | null;
  transactions: { total: number | null; success: number | null; failed: number | null };
  failures: { timeout: number | null; bank: number | null; technical: number | null; other: number | null };
  timeseries: { mode: "hourly" | "daily"; points: { label: string; amount: number }[] };
  paymentBreakdown: PaymentBreakdownItem[];
  topDevices: TopDevice[];
  errorBreakdown: ErrorBreakdownItem[];
  recentTransactions: RecentTransaction[];
}

export interface DashboardData {
  period: string;
  periodLabel: string;
  start: string | null;
  end: string | null;
  devices: { total: number | null; online: number | null; offline: number | null };
  /** Satış verisi yalnız backend `sales_visible=true` döndüyse dolu; aksi halde null (hiçbir tutar gösterilmez) */
  sales: DashboardSales | null;
}
