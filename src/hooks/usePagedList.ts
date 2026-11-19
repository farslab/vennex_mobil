import { useCallback, useMemo, useState } from "react";
import { useInfiniteQuery, useQueryClient, type InfiniteData, type QueryKey } from "@tanstack/react-query";
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
 * - Yenilemede yalnızca ilk sayfa yeniden çekilir: önbellek ilk sayfaya kırpılır, sonra refetch
 *   (React Query sonsuz sorguda tüm yüklü sayfaları sırayla yeniden çeker → büyük listede onlarca istek)
 * - Sayfa sınırı YOK: eski `maxPages` 21. sayfada ilk sayfayı sessizce düşürüyor, liste zıplıyordu
 * - Çok sayfa yüklüyken odak/yeniden bağlanmada otomatik tazeleme yapılmaz (yine tüm sayfalar
 *   çekilirdi); kullanıcı aşağı çekerek yeniler
 */
const AUTO_REFETCH_MAX_PAGES = 3;

export function trimToFirstPage<R>(data: InfiniteData<R, number> | undefined): InfiniteData<R, number> | undefined {
  if (!data || data.pages.length <= 1) return data;
  return { pages: data.pages.slice(0, 1), pageParams: data.pageParams.slice(0, 1) };
}

const fewPagesLoaded = (q: { state: { data: unknown } }) =>
  ((q.state.data as InfiniteData<unknown> | undefined)?.pages.length ?? 0) <= AUTO_REFETCH_MAX_PAGES;

export function usePagedList<T, R extends PageResponse<T> = PageResponse<T>>({
  queryKey,
  fetchPage,
  enabled = true,
  staleTime,
}: UsePagedListOptions<T, R>) {
  const [manualRefreshing, setManualRefreshing] = useState(false);
  const queryClient = useQueryClient();

  const query = useInfiniteQuery({
    queryKey,
    queryFn: ({ pageParam, signal }) => fetchPage(pageParam, signal),
    initialPageParam: 1,
    getNextPageParam: (last) => nextPageParam<T>(last),
    enabled,
    staleTime,
    refetchOnWindowFocus: fewPagesLoaded,
    refetchOnReconnect: fewPagesLoaded,
  });

  const items = useMemo(() => query.data?.pages.flatMap((p) => p.results ?? []) ?? [], [query.data]);
  const firstPage = query.data?.pages[0];

  const refresh = useCallback(async () => {
    setManualRefreshing(true);
    try {
      queryClient.setQueryData<InfiniteData<R, number>>(queryKey, trimToFirstPage);
      await query.refetch();
    } finally {
      setManualRefreshing(false);
    }
  }, [query, queryClient, queryKey]);

  const loadMore = useCallback(() => {
    // Sonraki sayfa hata verdiyse liste sonuna her kaydırmada tekrar istemez; "Tekrar dene" ile istenir
    if (query.isFetchNextPageError) return;
    if (query.hasNextPage && !query.isFetchingNextPage && !query.isFetching) query.fetchNextPage();
  }, [query]);
  const retryLoadMore = useCallback(() => {
    if (!query.isFetchingNextPage) query.fetchNextPage();
  }, [query]);

  return {
    items,
    /** İlk sayfa yanıtı — sayaçlar gibi ek alanlar için (ör. online_count) */
    firstPage,
    total: firstPage?.count ?? items.length,
    isLoading: query.isLoading,
    // Yalnız ilk yükleme hatası; sonraki sayfa hatası `loadMoreError` ile ayrı (yüklenen liste kaybolmaz)
    isError: query.isError && !query.isFetchNextPageError,
    error: query.error,
    isRefreshing: manualRefreshing,
    isFetchingMore: query.isFetchingNextPage,
    hasMore: !!query.hasNextPage,
    /** Sonraki sayfa yüklenemedi (ilk sayfa sağlam) — liste altında gösterilir */
    loadMoreError: query.isFetchNextPageError ? query.error : null,
    refresh,
    loadMore,
    retryLoadMore,
    refetch: query.refetch,
  };
}
