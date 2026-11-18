import { useCallback, useMemo, useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { queryKeys } from "@/api/queryKeys";
import { stockApi, type StockLocationListParams } from "@/api/stock";
import type { StockSku } from "@/types/stock";

/**
 * Yerel query key'ler — merkezi `queryKeys.stock` üzerine kurulur; hepsi `queryKeys.stock.all`
 * kökü altındadır, yazma sonrası tek invalidate yeterlidir.
 */
export const stockKeys = {
  overview: () => queryKeys.stock.overview(),
  locations: (params: StockLocationListParams = {}) =>
    [...queryKeys.stock.locations(), { active_only: params.active_only !== false, type: params.location_type ?? null }] as const,
  /** Birim/tür eşlemesi için tüm SKU'lar (aramasız) */
  skuIndex: () => queryKeys.stock.skus({ scope: "all" }),
  skuSearch: (filters: { q: string; stockable?: boolean }) => queryKeys.stock.skus({ scope: "search", ...filters }),
  inventory: (locationId: number) => queryKeys.stock.inventory(locationId),
  locationMovements: (locationId: number) => queryKeys.stock.locationMovements(locationId),
  movements: (filters: { type: string | null }) => queryKeys.stock.movements(filters),
};

/** Lokasyon listesi (sayfasız, backend cache 600 sn) */
export function useStockLocations(params: StockLocationListParams = {}, enabled = true) {
  return useQuery({
    queryKey: stockKeys.locations(params),
    queryFn: ({ signal }) => stockApi.locations.list(params, signal),
    staleTime: 60_000,
    enabled,
  });
}

/** Tüm SKU'lar → id eşlemesi (overview/envanter satırlarında birim göstermek için; tek istek) */
export function useSkuIndex(enabled = true) {
  const query = useQuery({
    queryKey: stockKeys.skuIndex(),
    queryFn: ({ signal }) => stockApi.skus.list({}, signal),
    staleTime: 5 * 60_000,
    enabled,
  });
  const byId = useMemo(() => {
    const map = new Map<number, StockSku>();
    for (const s of query.data ?? []) map.set(s.id, s);
    return map;
  }, [query.data]);
  return { ...query, byId };
}

/**
 * Yazma mutasyonu: başarıda stok kökünü invalidate eder, retry yok (queryClient varsayılanı).
 * `run` çift dokunmaya karşı ref kilidi kullanır: isPending render'ı beklenmeden ikinci çağrı yutulur.
 */
export function useStockMutation<TVars, TResult>(fn: (vars: TVars) => Promise<TResult>) {
  const queryClient = useQueryClient();
  const lock = useRef(false);
  const mutation = useMutation({
    mutationFn: fn,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.stock.all }),
    onSettled: () => {
      lock.current = false;
    },
  });
  const { mutate } = mutation;
  const run = useCallback(
    (vars: TVars, opts?: { onSuccess?: (r: TResult) => void; onError?: (e: Error) => void }) => {
      if (lock.current) return;
      lock.current = true;
      mutate(vars, { onSuccess: opts?.onSuccess, onError: opts?.onError });
    },
    [mutate]
  );
  return { ...mutation, run };
}
