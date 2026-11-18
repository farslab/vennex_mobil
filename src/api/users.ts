import { apiClient } from "./client";
import type { PageResponse } from "./pagination";
import type {
  AssignableOptions,
  CreateStaffUserPayload,
  StaffPosDeviceRef,
  StaffStockLocationRef,
  StaffUser,
  UpdateStaffUserPayload,
} from "@/types/users";

/**
 * Personel kullanıcı API'si (backend `views/users.py`, tümü IsOwner).
 * Sözleşme §2.13 / §3.3: yanıt `pos_devices[]` ve `default_stock_locations[]` döner;
 * sayaç alanı yoktur. Normalizasyon yalnız bu gerçek alanlardan id/sayı türetir.
 */

function asString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function asRefArray<T extends { id: number }>(value: unknown): T[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is T => !!v && typeof v === "object" && typeof (v as { id?: unknown }).id === "number");
}

export function normalizeStaffUser(raw: Record<string, unknown>): StaffUser {
  const posDevices = asRefArray<StaffPosDeviceRef>(raw.pos_devices);
  const stockLocations = asRefArray<StaffStockLocationRef>(raw.default_stock_locations);
  return {
    id: raw.id as number,
    username: asString(raw.username),
    first_name: asString(raw.first_name),
    last_name: asString(raw.last_name),
    email: asString(raw.email),
    phone: asString(raw.phone),
    // Backend her yanıtta döndürür (views/users.py:29); yalnız açık `false` pasif sayılır.
    is_active: raw.is_active !== false,
    group_names: Array.isArray(raw.group_names) ? raw.group_names.filter((g): g is string => typeof g === "string") : [],
    pos_devices: posDevices,
    default_stock_locations: stockLocations,
    pos_device_ids: posDevices.map((d) => d.id),
    pos_device_count: posDevices.length,
    default_stock_location_ids: stockLocations.map((l) => l.id),
  };
}

export const usersApi = {
  /** GET users/ — sayfa boyutu sunucuda sabit 25; arama/filtre parametresi YOK */
  list: (page = 1, signal?: AbortSignal): Promise<PageResponse<StaffUser>> =>
    apiClient
      .get<PageResponse<Record<string, unknown>>>("/users/", { params: { page }, signal })
      .then((r) => ({ ...r.data, results: (r.data.results ?? []).map(normalizeStaffUser) })),

  detail: (id: number, signal?: AbortSignal) =>
    apiClient.get<Record<string, unknown>>(`/users/${id}/`, { signal }).then((r) => normalizeStaffUser(r.data)),

  create: (payload: CreateStaffUserPayload) =>
    apiClient.post<Record<string, unknown>>("/users/", payload).then((r) => normalizeStaffUser(r.data)),

  /** Yalnız değişen alanlar gönderilir (bkz. screens/users/form/userFormModel.ts) */
  update: (id: number, patch: UpdateStaffUserPayload) =>
    apiClient.patch<Record<string, unknown>>(`/users/${id}/`, patch).then((r) => normalizeStaffUser(r.data)),

  remove: (id: number) => apiClient.delete(`/users/${id}/`).then(() => undefined),

  resetPassword: (id: number, new_password: string) =>
    apiClient.post<{ detail?: string }>(`/users/${id}/reset-password/`, { new_password }).then((r) => r.data),

  assignableOptions: (signal?: AbortSignal): Promise<AssignableOptions> =>
    apiClient.get<Partial<AssignableOptions>>("/users/assignable-options/", { signal }).then((r) => ({
      available_groups: r.data.available_groups ?? [],
      always_available_groups: r.data.always_available_groups ?? [],
      pos_devices: r.data.pos_devices ?? [],
      stock_locations: r.data.stock_locations ?? [],
      regions: r.data.regions ?? [],
    })),
};
