import { apiClient } from "./client";
import type { ResultsWrapper } from "@/types/common";
import type {
  StockInventoryRow,
  StockLocation,
  StockLocationType,
  StockOverviewRow,
  StockSku,
} from "@/types/stock";

export const stockApi = {
  overview: () =>
    apiClient.get<ResultsWrapper<StockOverviewRow>>("/stock/overview/").then((r) => r.data.results),

  locations: {
    list: (params: { active_only?: boolean; location_type?: StockLocationType } = {}) =>
      apiClient
        .get<ResultsWrapper<StockLocation>>("/stock/locations/", {
          params: { active_only: params.active_only ?? true, location_type: params.location_type },
        })
        .then((r) => r.data.results),

    create: (payload: { name: string; location_type: StockLocationType; is_active?: boolean }) =>
      apiClient
        .post<StockLocation>("/stock/locations/", { is_active: true, ...payload })
        .then((r) => r.data),

    update: (id: number, patch: Record<string, unknown>) =>
      apiClient.patch<StockLocation>(`/stock/locations/${id}/`, patch).then((r) => r.data),

    remove: (id: number) => apiClient.delete(`/stock/locations/${id}/`),

    syncVending: () => apiClient.post("/stock/locations/sync-vending/"),

    inventory: (id: number) =>
      apiClient
        .get<ResultsWrapper<StockInventoryRow>>(`/stock/locations/${id}/inventory/`)
        .then((r) => r.data.results),

    movements: (id: number, page = 1) =>
      apiClient.get(`/stock/locations/${id}/movements/`, { params: { page } }).then((r) => r.data),
  },

  skus: {
    list: (params: { active_only?: boolean; q?: string } = {}) =>
      apiClient
        .get<ResultsWrapper<StockSku>>("/stock/skus/", {
          params: { active_only: params.active_only ?? true, q: params.q || undefined },
        })
        .then((r) => r.data.results),

    create: (payload: {
      name: string;
      sku_code: string;
      barcode?: string;
      unit_cost?: number;
      is_active?: boolean;
    }) =>
      apiClient
        .post<StockSku>("/stock/skus/", {
          is_active: true,
          ...payload,
          unit_cost: payload.unit_cost != null ? payload.unit_cost.toFixed(2) : undefined,
        })
        .then((r) => r.data),

    update: (id: number, patch: Record<string, unknown>) =>
      apiClient.patch<StockSku>(`/stock/skus/${id}/`, patch).then((r) => r.data),

    remove: (id: number) => apiClient.delete(`/stock/skus/${id}/`),
  },

  transfers: {
    list: (page = 1) => apiClient.get("/stock/transfers/", { params: { page } }).then((r) => r.data),
    create: (payload: {
      from_location_id: number;
      to_location_id: number;
      sku_id: number;
      quantity: number;
    }) => apiClient.post("/stock/transfers/", payload),
  },

  receipts: {
    list: (page = 1) => apiClient.get("/stock/receipts/", { params: { page } }).then((r) => r.data),
    create: (payload: { to_location_id: number; sku_id: number; quantity: number }) =>
      apiClient.post("/stock/receipts/", payload),
  },

  adjustments: {
    list: (page = 1) => apiClient.get("/stock/adjustments/", { params: { page } }).then((r) => r.data),
    create: (payload: { location_id: number; sku_id: number; quantity: number; reason: string }) =>
      apiClient.post("/stock/adjustments/", payload),
  },
};
