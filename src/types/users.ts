export interface StaffUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  pos_device_count: number;
  group_names: string[];
  pos_device_ids: number[];
  default_stock_location_ids: number[];
}

export interface AssignableOptions {
  available_groups: string[];
  always_available_groups: string[];
  pos_devices: {
    id: number;
    sn: string;
    pos_name: string;
    company_name?: string | null;
    location_name?: string | null;
  }[];
  stock_locations: { id: number; name: string; location_type: string }[];
  regions: { id: number; name: string }[];
}

export interface CreateStaffUserPayload {
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  email?: string;
  phone?: string;
  pos_device_ids: number[];
  group_names: string[];
  default_stock_location_ids: number[];
}
