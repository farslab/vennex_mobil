/**
 * Overview / Dashboard API — backend `views/overview.py`, docs/API_CONTRACTS.md §2.4, §3.8.
 *
 * Kural: anasayfa yalnızca bundle ucunu (`/overview/dashboard/`) çağırır; ayrı overview/* uçları
 * paralel çağrılmaz (sunucu yükü). `overview/locations/` yalnız konum filtresi içindir.
 */
import { apiClient } from "./client";
import { toNumber } from "@/utils/number";
import type { ApiPeriod } from "@/types/common";
import type {
  DashboardData,
  ErrorBreakdownItem,
  OverviewBundle,
  OverviewLocation,
  PaymentBreakdownItem,
  RecentTransaction,
  TopDevice,
} from "@/types/overview";

export interface DashboardParams {
  period: ApiPeriod;
  top_limit?: number;
  recent_limit?: number;
  /** Konumlar — web Genel Bakış gibi çoklu; boş = tümü. Bölge seçimi istemcide konumlara açılır.
   *  Backend `location_ids=1,2` (`parse_location_ids`); eski tek `location_id` de kabul edilir. */
  location_ids?: number[];
  start_date?: string; // yalnızca period === 'custom' iken (YYYY-MM-DD)
  end_date?: string; // yalnızca period === 'custom' iken (YYYY-MM-DD, dahil)
  /** Pull-to-refresh: 30 sn Redis cache'ini atlar (`cache.py:129-132`) */
  nocache?: boolean;
}

export function buildDashboardQuery(params: DashboardParams): Record<string, string | number> {
  const query: Record<string, string | number> = {
    period: params.period,
    top_limit: params.top_limit ?? 5,
    recent_limit: params.recent_limit ?? 5,
  };
  if (params.location_ids?.length) query.location_ids = [...params.location_ids].sort((a, b) => a - b).join(",");
  if (params.period === "custom" && params.start_date) query.start_date = params.start_date;
  if (params.period === "custom" && params.end_date) query.end_date = params.end_date;
  if (params.nocache) query.nocache = 1;
  return query;
}

export const overviewApi = {
  /** Ham bundle */
  dashboard: (params: DashboardParams, signal?: AbortSignal) =>
    apiClient
      .get<OverviewBundle>("/overview/dashboard/", { params: buildDashboardQuery(params), signal })
      .then((r) => r.data),

  /** Normalize edilmiş dashboard modeli (ekranlar bunu kullanır) */
  dashboardData: (params: DashboardParams, signal?: AbortSignal) =>
    overviewApi.dashboard(params, signal).then(normalizeDashboard),

  /** Konum filtresi seçenekleri — cache 300 sn (`overview.py:350-356`) */
  locations: (signal?: AbortSignal) =>
    apiClient
      .get<{ results: OverviewLocation[] }>("/overview/locations/", { signal })
      .then((r) => extractResultsList(r.data).filter((l) => l && typeof l.id === "number")),
};

// Bundle içindeki alanlar {results:[...]} veya doğrudan dizi olarak gelebilir (doküman notu) — normalize eder
export function extractResultsList<T>(node: { results?: T[] | null } | T[] | null | undefined): T[] {
  if (!node) return [];
  if (Array.isArray(node)) return node;
  return Array.isArray(node.results) ? node.results : [];
}

const str = (v: unknown): string | null => (typeof v === "string" && v.trim() ? v : null);

/**
 * Ham bundle → ekran modeli. Satış alanları yalnızca `summary.sales_visible === true` iken doldurulur;
 * aksi halde `sales = null` (hiçbir tutar gösterilmez). Eksik sayılar uydurulmaz → null.
 */
export function normalizeDashboard(raw: OverviewBundle | null | undefined): DashboardData {
  const s = raw?.summary;
  const devices = {
    total: toNumber(s?.devices?.total),
    online: toNumber(s?.devices?.online),
    offline: toNumber(s?.devices?.offline),
  };
  const base = {
    period: s?.period ?? "",
    periodLabel: s?.period_label ?? "",
    start: str(s?.start),
    end: str(s?.end),
    devices,
  };
  if (!s || s.sales_visible !== true) return { ...base, sales: null };

  const labels = Array.isArray(raw?.revenue_timeseries?.labels) ? raw!.revenue_timeseries!.labels : [];
  const amounts = Array.isArray(raw?.revenue_timeseries?.amounts) ? raw!.revenue_timeseries!.amounts : [];
  const points = labels.map((label, i) => ({ label: String(label), amount: toNumber(amounts[i]) ?? 0 }));

  const payment = extractResultsList<PaymentBreakdownItem>(raw?.payment_breakdown).map((p) => ({
    ...p,
    pt_type: toNumber(p.pt_type) ?? -1,
    amount: toNumber(p.amount) ?? 0,
    count: toNumber(p.count) ?? 0,
  }));
  const top = extractResultsList<TopDevice>(raw?.top_devices).map((d) => ({
    ...d,
    revenue: toNumber(d.revenue) ?? 0,
    tx_count: toNumber(d.tx_count) ?? 0,
  }));
  const errors = extractResultsList<ErrorBreakdownItem>(raw?.error_breakdown).map((e) => ({
    ...e,
    count: toNumber(e.count) ?? 0,
  }));
  const recent = extractResultsList<RecentTransaction>(raw?.recent_transactions).map((t) => ({
    ...t,
    amount: toNumber(t.amount) ?? 0,
    status: t.status === true,
  }));

  return {
    ...base,
    sales: {
      revenue: toNumber(s.revenue),
      previousRevenue: toNumber(s.previous_revenue),
      changePct: toNumber(s.change_pct),
      comparisonLabel: str(s.comparison_label),
      transactions: {
        total: toNumber(s.transactions?.total),
        success: toNumber(s.transactions?.success),
        failed: toNumber(s.transactions?.failed),
      },
      failures: {
        timeout: toNumber(s.failures?.timeout),
        bank: toNumber(s.failures?.bank),
        technical: toNumber(s.failures?.technical),
        other: toNumber(s.failures?.other),
      },
      timeseries: { mode: raw?.revenue_timeseries?.mode === "hourly" ? "hourly" : "daily", points },
      paymentBreakdown: payment,
      topDevices: top,
      errorBreakdown: errors,
      recentTransactions: recent,
    },
  };
}
