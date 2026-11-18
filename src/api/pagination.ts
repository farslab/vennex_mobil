/**
 * Backend sayfalama sözleşmesi (docs/API_CONTRACTS.md §1.5):
 *   { count, page, num_pages, results, ...extra }
 * Sayfa boyutu sunucuda SABİTTİR (cihaz 25, işlem 50, kart 30 …); `page_size` gönderilmez.
 * Hiçbir endpoint next/previous döndürmez.
 */
export interface PageResponse<T> {
  count: number;
  page: number;
  num_pages: number;
  page_size?: number;
  results: T[];
}

/** useInfiniteQuery için sonraki sayfa numarası; son sayfadaysa undefined */
export function nextPageParam<T>(last: PageResponse<T> | undefined): number | undefined {
  if (!last) return undefined;
  const page = Number(last.page) || 1;
  const numPages = Number(last.num_pages);
  if (Number.isFinite(numPages) && numPages > 0) return page < numPages ? page + 1 : undefined;
  // num_pages yoksa: sonuç geldiyse ve toplam sayıya ulaşılmadıysa devam et
  return last.results?.length ? page + 1 : undefined;
}

/** Sayfasız `{results: [...]}` ya da düz dizi gelen uçlar için güvenli açıcı */
export function unwrapResults<T>(node: { results?: T[] | null } | T[] | null | undefined): T[] {
  if (!node) return [];
  if (Array.isArray(node)) return node;
  return Array.isArray(node.results) ? node.results : [];
}
