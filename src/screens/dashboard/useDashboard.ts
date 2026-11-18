import { useCallback, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery, useQueryClient } from "@tanstack/react-query";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { overviewApi, type DashboardParams } from "@/api/overview";
import { queryKeys } from "@/api/queryKeys";
import type { ApiPeriod } from "@/types/common";
import type { CustomRange } from "./dashboardPeriod";

/** Backend cache TTL 30 sn (`overview.py:30`) — bundan sık otomatik yenileme anlamsız */
export const DASHBOARD_STALE_MS = 30_000;
/** Otomatik yenileme: yalnız ekran odaktayken, 60 sn'de bir */
export const DASHBOARD_AUTO_REFRESH_MS = 60_000;
/** nocache=1 ile çekme (pull-to-refresh) arasında en az bu kadar süre */
export const DASHBOARD_NOCACHE_COOLDOWN_MS = 15_000;

export interface DashboardFilterState {
  period: ApiPeriod;
  customRange: CustomRange | null;
  locationId: number | null;
}

export function buildDashboardParams(f: DashboardFilterState): DashboardParams {
  const params: DashboardParams = { period: f.period, top_limit: 5, recent_limit: 5 };
  if (f.locationId != null) params.location_id = f.locationId;
  if (f.period === "custom" && f.customRange) {
    params.start_date = f.customRange.start;
    params.end_date = f.customRange.end;
  }
  return params;
}

/**
 * Dashboard verisi: tek bundle isteği (`GET /overview/dashboard/`).
 * - Dönem/konum değişince yeni anahtar → önceki veri ekranda kalır (keepPreviousData), eski istek iptal edilir.
 * - Pull-to-refresh `nocache=1` ile, en fazla 15 sn'de bir.
 * - Otomatik yenileme yalnız odaktayken 60 sn; odak geri gelince veri 30 sn'den eskiyse tazelenir.
 */
export function useDashboard() {
  const isFocused = useIsFocused();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<DashboardFilterState>({ period: "today", customRange: null, locationId: null });
  const [refreshing, setRefreshing] = useState(false);
  const lastNoCacheAt = useRef(0);

  const params = useMemo(() => buildDashboardParams(filters), [filters]);
  const queryKey = useMemo(() => queryKeys.overview.dashboard({ ...params }), [params]);

  const query = useQuery({
    queryKey,
    queryFn: ({ signal }) => overviewApi.dashboardData(params, signal),
    placeholderData: keepPreviousData,
    staleTime: DASHBOARD_STALE_MS,
    refetchInterval: isFocused ? DASHBOARD_AUTO_REFRESH_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
  });

  const { refetch } = query;
  useFocusEffect(
    useCallback(() => {
      const state = queryClient.getQueryState(queryKey);
      if (state?.dataUpdatedAt && Date.now() - state.dataUpdatedAt > DASHBOARD_STALE_MS) refetch();
    }, [queryClient, queryKey, refetch])
  );

  const setPeriod = useCallback((period: Exclude<ApiPeriod, "custom">) => {
    setFilters((f) => ({ ...f, period, customRange: null }));
  }, []);

  const applyCustomRange = useCallback((range: CustomRange) => {
    setFilters((f) => ({ ...f, period: "custom", customRange: range }));
  }, []);

  const setLocationId = useCallback((locationId: number | null) => {
    setFilters((f) => ({ ...f, locationId }));
  }, []);

  /** Pull-to-refresh: cooldown dışındaysa cache'i atlayarak (nocache=1) çeker. Hata fırlatır. */
  const refresh = useCallback(async () => {
    if (refreshing) return;
    const now = Date.now();
    if (now - lastNoCacheAt.current < DASHBOARD_NOCACHE_COOLDOWN_MS) return;
    lastNoCacheAt.current = now;
    setRefreshing(true);
    try {
      await queryClient.fetchQuery({
        queryKey,
        queryFn: ({ signal }) => overviewApi.dashboardData({ ...params, nocache: true }, signal),
        staleTime: 0,
      });
    } finally {
      setRefreshing(false);
    }
  }, [params, queryClient, queryKey, refreshing]);

  return {
    filters,
    setPeriod,
    applyCustomRange,
    setLocationId,
    data: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    /** Arka planda (dönem değişimi / otomatik) yenileniyor */
    isFetching: query.isFetching,
    isPlaceholderData: query.isPlaceholderData,
    dataUpdatedAt: query.dataUpdatedAt,
    refreshing,
    refresh,
    retry: refetch,
  };
}
