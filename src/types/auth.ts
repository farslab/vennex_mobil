export type UserRole = "owner" | "tech" | "admin";

// Kaynak: authentication.py `serialize_company()` — birebir eşleşiyor.
// Not: device_count / logo_url backend'de YOK; UI bunlara güvenmemeli.
export interface Company {
  id: number;
  name: string;
  cari_state: number; // 0=Temiz,1=Sarı,2=Kırmızı,3=Uyarı,4=Kilitli
  has_personnel_card_device: boolean;
  uses_stock_mode: boolean;
}

export interface AuthUser {
  id: number;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  role: UserRole;
  permissions: string[];
  companies: Company[];
  pending_legal_docs: string[]; // slug listesi: privacy/kvkk/terms
}

export interface LoginResponse {
  access?: string;
  refresh?: string;
  user?: AuthUser;
  requires_2fa?: boolean;
  session_token?: string;
  attempts_left?: number;
  detail?: string;
}

export interface NotificationPreferences {
  device_offline: boolean;
  transaction_alerts: boolean;
  stock_low: boolean;
  card_pending: boolean;
  report_ready: boolean;
  cari_overdue: boolean;
  updated_at?: string | null;
}

// Backend hata zarfı (ApiException karşılığı)
export interface ApiErrorBody {
  detail?: string;
  message?: string;
  error?: string;
  [field: string]: unknown; // field-level validation hataları
}
