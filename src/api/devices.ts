import { apiClient } from "./client";
import type { Paginated } from "@/types/common";
import type { PosDeviceListItem, PosProductsResponse, PosTransaction } from "@/types/devices";

export interface DeviceListParams {
  page?: number;
  page_size?: number;
  q?: string;
  location_id?: number;
  stat?: number;
  online?: boolean;
  sort_by?: string;
}

export interface CreateProductPayload {
  urun_no?: number | null;
  is_wildcard?: boolean;
  stock_sku_id: number;
  price: string;
  max_quantity?: number;
}

export const devicesApi = {
  list: (params: DeviceListParams = {}) =>
    apiClient
      .get<Paginated<PosDeviceListItem>>("/pos-devices/", {
        params: { page: 1, page_size: 25, ...params },
      })
      .then((r) => r.data),

  detail: (sn: string) =>
    apiClient.get<Record<string, any>>(`/pos-devices/${sn}/`).then((r) => r.data),

  summary: (sn: string) =>
    apiClient.get<Record<string, any>>(`/pos-devices/${sn}/summary/`).then((r) => r.data),

  transactions: (
    sn: string,
    params: {
      page?: number;
      start_date?: string;
      end_date?: string;
      tx_status?: string;
      pt_type?: number;
      cancel_reason?: string;
      card_last4?: string;
    } = {}
  ) =>
    apiClient
      .get<Paginated<PosTransaction>>(`/pos-devices/${sn}/transactions/`, { params })
      .then((r) => r.data),

  products: (sn: string) =>
    apiClient.get<PosProductsResponse>(`/pos-devices/${sn}/products/`).then((r) => r.data),

  createProduct: (sn: string, payload: CreateProductPayload) =>
    apiClient
      .post(`/pos-devices/${sn}/products/create/`, payload)
      .then((r) => r.data),

  templates: () =>
    apiClient.get(`/product-templates/`).then((r) => r.data),

  assignTemplate: (sn: string, templateId: number) =>
    apiClient
      .post(`/pos-devices/${sn}/assign-template/`, { template_id: templateId })
      .then((r) => r.data),

  unassignTemplate: (sn: string) =>
    apiClient.delete(`/pos-devices/${sn}/assign-template/`).then((r) => r.data),

  updateSettings: (sn: string, patch: Record<string, unknown>) =>
    apiClient.patch(`/pos-devices/${sn}/`, patch).then((r) => r.data),

  collectCash: (sn: string, notes?: string) =>
    apiClient.post(`/pos-devices/${sn}/collect-cash/`, notes ? { notes } : {}).then((r) => r.data),

  countRevenue: (sn: string, notes?: string) =>
    apiClient.post(`/pos-devices/${sn}/count-revenue/`, notes ? { notes } : {}).then((r) => r.data),

  cashHistory: (sn: string, limit = 1) =>
    apiClient
      .get<{ results: Record<string, any>[] }>(`/pos-devices/${sn}/cash-history/`, {
        params: { limit },
      })
      .then((r) => r.data),

  revenueCountHistory: (sn: string, limit = 1) =>
    apiClient
      .get<{ results: Record<string, any>[] }>(`/pos-devices/${sn}/revenue-counts/`, {
        params: { limit },
      })
      .then((r) => r.data),

  updateSortOrders: (deviceOrders: { sn: string; sort_order: number }[]) =>
    apiClient.post("/pos-devices/sort/", { device_orders: deviceOrders }),

  bulkQuantities: (
    sn: string,
    updates: { slot_id: number; quantity: number }[],
    sourceLocationId?: number
  ) =>
    apiClient
      .post<{ updated_count: number; detail: string }>(
        `/pos-devices/${sn}/products/bulk-quantities/`,
        {
          source_location_id: sourceLocationId,
          updates,
        }
      )
      .then((r) => r.data),

  fillAllStock: (sn: string, sourceLocationId: number) =>
    apiClient
      .post<{ filled_count: number; detail: string }>(`/pos-devices/${sn}/fill-all-stock/`, {
        source_location_id: sourceLocationId,
      })
      .then((r) => r.data),
};