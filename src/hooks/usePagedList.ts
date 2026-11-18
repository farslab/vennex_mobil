import { useCallback, useMemo, useState } from "react";
import { useInfiniteQuery, type QueryKey } from "@tanstack/react-query";
import { nextPageParam, type PageResponse } from "@/api/pagination";

export interface UsePagedListOptions<T, R extends PageResponse<T>> {
  queryKey: QueryKey;
  fetchPage: (page: number, signal?: AbortSignal) => Promise<R>;
  enabled?: boolean;
  staleTime?: number;
}

/**
 * Sayfalı liste: sonsuz kaydırma + pull-to-refresh + ilk sayfanın ek alanları (sayaçlar).
 * - İstek iptali: React Query `signal` iletilir (ekrandan çıkınca/filtre değişince eski istek iptal)
 * - Yenilemede yalnızca ilk sayfa yeniden çekilir (refetch tüm sayfaları çekmesin)
 */
export function usePagedList<T, R extends PageResponse<T> = PageResponse<T>>({
  queryKey,
  fetchPage,
  enabled = true,
  staleTime,
}: UsePagedListOptions<T, R>) {
  const [manualRefreshing, setManualRefreshing] = useState(false);

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => fetchPage(pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => nextPageParam<T>(last),
    enabled,
    staleTime,
    maxPages: 20,
  });

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.results ?? []) ?? [], [query.data]);
  const firstPage = query.data?.pages[0];

  const refresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setManualRefreshing(false);
    }
  }, [query]);

  const loadMore = useCallback(() => {
    if (query.hasNextPage && !query.isFetchingNextPage && !query.isFetching) query.fetchNextPage();
  }, [query]);

  return {
    items,
    /** İlk sayfa yanıtı — sayaçlar gibi ek alanlar için (ör. online_count) */
    firstPage,
    total: firstPage?.count ?? items.length,
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    isRefreshing: manualRefreshing,
    isFetchingMore: query.isFetchingNextPage,
    hasMore: !!query.hasNextPage,
    refresh,
    loadMore,
    refetch: query.refetch,
  };
}
