import { apiClient } from "./client";
import type { ApiPeriod } from "@/types/common";
import type { OverviewBundle, OverviewLocation, RecentTransaction } from "@/types/overview";

export interface DashboardParams {
  period: ApiPeriod;
  top_limit?: number;
  recent_limit?: number;
  location_id?: number;
  start_date?: string; // yalnızca period === 'custom' iken
  end_date?: string; // yalnızca period === 'custom' iken
  nocache?: boolean; // pull-to-refresh
}

export const overviewApi = {
  dashboard: (params: DashboardParams) => {
    const query: Record<string, string | number> = {
      period: params.period,
      top_limit: params.top_limit ?? 5,
      recent_limit: params.recent_limit ?? 5,
    };
    if (params.location_id != null) query.location_id = params.location_id;
    if (params.period === "custom" && params.start_date) query.start_date = params.start_date;
    if (params.period === "custom" && params.end_date) query.end_date = params.end_date;
    if (params.nocache) query.nocache = 1;

    return apiClient.get<OverviewBundle>("/overview/dashboard/", { params: query }).then((r) => r.data);
  },

  recentTransactions: (period: ApiPeriod = "today", limit = 5) =>
    apiClient
      .get<{ results: RecentTransaction[] }>("/overview/recent-transactions/", {
        params: { period, limit },
      })
      .then((r) => r.data.results),

  locations: () =>
    apiClient.get<{ results: OverviewLocation[] }>("/overview/locations/").then((r) => r.data.results),
};

// Bundle içindeki alanlar {results:[...]} veya doğrudan dizi olarak gelebilir (doküman notu) — normalize eder
export function extractResultsList<T>(node: { results: T[] } | T[] | null | undefined): T[] {
  if (!node) return [];
  if (Array.isArray(node)) return node;
  return node.results ?? [];
}
