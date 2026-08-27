import { apiClient } from "./client";
import type { Paginated } from "@/types/common";
import type { AssignableOptions, CreateStaffUserPayload, StaffUser } from "@/types/users";

// Doküman notu: backend bu alanlar için birden fazla key adı kullanabiliyor
// (pos_device_count vs pos_devices_count vs device_count vs devices_count, vb.)
// Kartlardaki balance string/number sorununa benzer şekilde burada da normalize ediyoruz
// ki hangi key gelirse gelsin uygulama kararlı çalışsın.
function normalizeStaffUser(raw: Record<string, unknown>): StaffUser {
  const countCandidates = ["pos_device_count", "pos_devices_count", "device_count", "devices_count"];
  const idsCandidates = ["pos_device_ids", "pos_devices", "devices"];
  const stockCandidates = ["default_stock_location_ids", "stock_location_ids", "default_stock_locations"];

  const pickIds = (keys: string[]): number[] => {
    for (const key of keys) {
      const val = raw[key];
      if (Array.isArray(val)) {
        return val.map((v) => (typeof v === "object" && v !== null ? (v as { id: number }).id : (v as number)));
      }
    }
    return [];
  };

  const posDeviceIds = pickIds(idsCandidates);
  let posDeviceCount = 0;
  for (const key of countCandidates) {
    if (typeof raw[key] === "number") {
      posDeviceCount = raw[key] as number;
      break;
    }
  }
  if (!posDeviceCount) posDeviceCount = posDeviceIds.length;

  return {
    id: raw.id as number,
    username: (raw.username as string) ?? "",
    first_name: (raw.first_name as string) ?? "",
    last_name: (raw.last_name as string) ?? "",
    email: (raw.email as string) ?? "",
    phone: (raw.phone as string) ?? null,
    pos_device_count: posDeviceCount,
    group_names: (raw.group_names as string[]) ?? [],
    pos_device_ids: posDeviceIds,
    default_stock_location_ids: pickIds(stockCandidates),
  };
}

export const usersApi = {
  list: (page = 1) =>
    apiClient.get<Paginated<Record<string, unknown>>>("/users/", { params: { page } }).then((r) => ({
      ...r.data,
      results: r.data.results.map(normalizeStaffUser),
    })),

  detail: (id: number) =>
    apiClient.get<Record<string, unknown>>(`/users/${id}/`).then((r) => normalizeStaffUser(r.data)),

  create: (payload: CreateStaffUserPayload) =>
    apiClient.post<Record<string, unknown>>("/users/", payload).then((r) => normalizeStaffUser(r.data)),

  update: (id: number, patch: Record<string, unknown>) =>
    apiClient.patch<Record<string, unknown>>(`/users/${id}/`, patch).then((r) => normalizeStaffUser(r.data)),

  remove: (id: number) => apiClient.delete(`/users/${id}/`),

  resetPassword: (id: number, new_password: string) =>
    apiClient.post(`/users/${id}/reset-password/`, { new_password }),

  assignableOptions: () =>
    apiClient.get<AssignableOptions>("/users/assignable-options/").then((r) => r.data),
};
