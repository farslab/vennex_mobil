/**
 * Hesap / güvenlik / şirket / cari tipleri.
 * Kaynak: backend `views/auth.py`, `views/companies.py`, `views/payments.py`, `serializers/misc.py`.
 */

/** Backend'in `{detail}` döndüren basit yanıtları */
export interface DetailResponse {
  detail?: string;
}

/** POST /auth/delete/ yanıtı (hesap silme talebi kaydı) */
export interface AccountDeletionRequest {
  id: number;
  status: string;
  status_display: string;
  created_at: string;
  detail?: string;
}

/** PATCH auth/me/ — `serializers/auth.py::ProfileUpdateSerializer` (kısmi) */
export interface ProfileUpdatePayload {
  first_name?: string;
  last_name?: string;
  email?: string;
  /** ≤20 karakter; null/"" → backend None yazar */
  phone?: string | null;
}

export interface TwoFactorStatus {
  is_enabled: boolean;
}

/** POST auth/2fa/setup/ — unconfirmed TOTP cihazı */
export interface TwoFactorSetup {
  device_id: number;
  /** RFC 4648 Base32 (padding'siz) */
  secret: string;
  /** otpauth://totp/... — doğrulama uygulamaları için */
  otpauth_url: string;
  is_enabled: false;
}

export interface TwoFactorToggleResponse {
  detail?: string;
  is_enabled: boolean;
}

/** GET companies/ ve companies/{id}/ — `_serialize_company_full` (boş alanlar "") */
export interface CompanyDetail {
  id: number;
  name: string;
  address: string;
  phone: string;
  email: string;
  tax_number: string;
  uye_isyeri: string;
  uye_isyeri_kisa_ad: string;
  cari_state: number;
  has_personnel_card_device: boolean;
  uses_stock_mode: boolean;
}

/** GET cari/summary/ (IsOwner) — tutarlar view'da float() → number */
export interface CariSummary {
  enabled: boolean;
  company_name: string;
  cari_state: number;
  is_locked: boolean;
  overdue_total: number | string;
  all_total: number | string;
  invoice_count: number;
  /** Fatura yoksa toplam Paraşüt bakiyesinden gelir */
  balance_only: boolean;
  contact_id: number | null;
}

export type CariPaymentStatus = "overdue" | "not_due" | "unscheduled";

/** GET cari/invoices/ satırı — ModelSerializer DecimalField'ları string döner */
export interface CariInvoice {
  id: number;
  parasut_invoice_id: number;
  /** Modelde yok, backend her zaman null döner */
  issue_date: string | null;
  due_date: string | null;
  /** Para birimi yanıtta yok (model `currency` alanı serializer'da değil) */
  net_total: string | number;
  remaining_in_trl: string | number;
  payment_status: CariPaymentStatus | string;
  e_document_type: string;
  e_document_id: number | null;
}

export interface CariInvoicePdf {
  pdf_url: string;
}
