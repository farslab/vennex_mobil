import { apiClient } from "./client";
import type { Paginated } from "@/types/common";

export interface ProductTemplateItem {
  id?: number;
  urun_no?: number | null;
  is_wildcard?: boolean;
  stock_sku?: number | null;
  stock_sku_name?: string | null;
  stock_sku_code?: string | null;
  name: string;
  price: number | string;
  max_quantity?: number;
  quantity?: number;
  order?: number | string | null;
}

export interface ProductTemplate {
  id: number;
  name: string;
  description: string | null;
  machine_type: 0 | 1; // 0 = Snack, 1 = Kahve
  item_count: number;
  assigned_device_count?: number;
  created_at: string;
  updated_at?: string;
  items?: ProductTemplateItem[];
  assigned_devices?: Array<{ sn: string; pos_name: string }>;
}

export const templatesApi = {
  list: () =>
    apiClient
      .get<Paginated<ProductTemplate> | ProductTemplate[]>("/product-templates/")
      .then((r) => (Array.isArray(r.data) ? r.data : r.data.results)),

  detail: (id: number) =>
    apiClient.get<ProductTemplate>(`/product-templates/${id}/`).then((r) => r.data),

  create: (payload: { name: string; description?: string; machine_type: 0 | 1 }) =>
    apiClient.post<ProductTemplate>("/product-templates/", payload).then((r) => r.data),

  update: (id: number, payload: { name: string; description?: string; machine_type: 0 | 1 }) =>
    apiClient.patch<ProductTemplate>(`/product-templates/${id}/`, payload).then((r) => r.data),

  remove: (id: number) => apiClient.delete(`/product-templates/${id}/`),

  assignDevices: (id: number, deviceSns: string[]) =>
    apiClient.post(`/product-templates/${id}/assign/`, { device_sns: deviceSns }).then((r) => r.data),

  saveItems: (id: number, items: Array<{
    id?: number;
    urun_no?: number | null;
    name?: string;
    price: number | string;
    max_quantity?: number;
    quantity?: number;
    is_wildcard?: boolean;
    stock_sku?: number | null;
  }>) =>
    apiClient.post(`/product-templates/${id}/items/`, { items }).then((r) => r.data),
};
