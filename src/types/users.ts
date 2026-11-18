/**
 * Personel (tech) kullanıcı yönetimi — backend `vennex_mobile/views/users.py::_serialize_staff`.
 * Liste ve detay aynı şemayı döner; sayaç alanı YOKTUR (sayılar dizilerden türetilir, §3.3).
 */

export interface StaffPosDeviceRef {
  id: number;
  sn: string;
  pos_name: string;
}

export type StockLocationType = "warehouse" | "vehicle" | "depot";

export interface StaffStockLocationRef {
  id: number;
  name: string;
  /** warehouse | vehicle | depot (api/models.py LOCATION_TYPE_CHOICES) */
  location_type: StockLocationType | string;
}

/** Backend'in döndürdüğü ham şema */
export interface StaffUserRaw {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  /** Backend boşsa "" döner */
  phone: string;
  is_active: boolean;
  /** Django grup adları — kullanıcıya gösterilen gerçek etiketlerdir (ör. "Satış Görüntüleme") */
  group_names: string[];
  pos_devices: StaffPosDeviceRef[];
  default_stock_locations: StaffStockLocationRef[];
}

/** Normalize edilmiş kullanıcı: ham alanlar + diziden türetilen id/sayı alanları */
export interface StaffUser extends StaffUserRaw {
  pos_device_ids: number[];
  pos_device_count: number;
  default_stock_location_ids: number[];
}

export interface AssignablePosDevice {
  id: number;
  sn: string;
  pos_name: string;
  company_name?: string | null;
  location_name?: string | null;
}

export interface AssignableOptions {
  /** Owner'ın atayabileceği gruplar (kendi grupları ∪ ALWAYS_AVAILABLE) ∩ TECH_GROUPS */
  available_groups: string[];
  always_available_groups: string[];
  pos_devices: AssignablePosDevice[];
  stock_locations: StaffStockLocationRef[];
  regions: { id: number; name: string }[];
}

export interface CreateStaffUserPayload {
  username: string;
  password: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  phone?: string | null;
  pos_device_ids: number[];
  group_names: string[];
  default_stock_location_ids: number[];
}

/** PATCH users/{id}/ — kısmi; username ve parola bu uçtan değişmez */
export type UpdateStaffUserPayload = Partial<
  Pick<
    CreateStaffUserPayload,
    "first_name" | "last_name" | "email" | "phone" | "pos_device_ids" | "group_names" | "default_stock_location_ids"
  >
>;

export const STOCK_LOCATION_TYPE_LABELS: Record<StockLocationType, string> = {
  warehouse: "Ana Depo",
  vehicle: "Araç",
  depot: "Ara Depo",
};

export function stockLocationTypeLabel(type: string | null | undefined): string {
  if (!type) return "—";
  return STOCK_LOCATION_TYPE_LABELS[type as StockLocationType] ?? type;
}
