/**
 * Rapor (async export) şemaları.
 * Kaynak: backend `views/reporting.py` (tüm uçlar CanViewSales), docs/API_CONTRACTS.md §2.10, §3.7,
 * backend dokümanı `docs/VENNEX_MANAGEMENT_APP_API_REFERENCE.md:1438-1535`.
 */

/** Bilinen tipler (`reporting.py:68`). Geçerli liste ve etiketler `filter-options.report_types`'tan gelir. */
export type KnownReportType = "pos_detail" | "pos_summary" | "nfc_balance_logs";
export type ReportType = KnownReportType | (string & {});

/** `pending | running | completed | failed | cancelled` (`API_REFERENCE.md:1491`) */
export type ReportStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

/** Ham durumu güvenle daraltır (bilinmeyen değerler "pending" kabul edilir → polling devam eder) */
export function normalizeReportStatus(raw: string | null | undefined): ReportStatus {
  const v = (raw || "").toLowerCase();
  if (["running", "started", "retry", "progress"].includes(v)) return "running";
  if (["completed", "success", "done"].includes(v)) return "completed";
  if (["failed", "failure", "error"].includes(v)) return "failed";
  if (["cancelled", "canceled", "revoked"].includes(v)) return "cancelled";
  return "pending";
}

/** `_serialize_job` (`reporting.py:30-47`) */
export interface ReportJob {
  id: number;
  report_type: ReportType;
  custom_name: string;
  status: string;
  progress_pct: number | null;
  row_count: number | null;
  estimated_rows: number | null;
  file_size_bytes: number | null;
  error_message: string | null;
  created_at: string;
  finished_at: string | null;
  expires_at: string | null;
  is_active: boolean;
  is_downloadable: boolean;
  download_count: number;
}

/** GET /reports/ — sayfasız (`reporting.py:55-62`) */
export interface ReportListResponse {
  retention_hours: number | null;
  user_report_limit: number | null;
  results: ReportJob[];
}

export interface ReportOption {
  value: string;
  label: string;
}

/** GET /reports/filter-options/ (`reporting.py:238-285`) */
export interface ReportFilterOptions {
  report_types: ReportOption[];
  companies: { id: number; name: string }[];
  regions: { id: number; name: string; company_id: number | null }[];
  locations: { id: number; name: string; region_id: number | null; region_name: string | null }[];
  devices: { id: number; sn: string; pos_name: string | null; company_id: number | null; location_id: number | null }[];
  has_personel_kart_pos: boolean;
  nfc_sources: ReportOption[];
  nfc_operations: ReportOption[];
}

export type ReportTransactionStatus = "all" | "success" | "fail";
export type ReportFailureReason = "1" | "2" | "3" | "other";

/**
 * POST /reports/ gövdesi.
 * SÖZLEŞME: doğrulanamadı — `reporting.validators.parse_filters` backend kopyasında yok.
 * Anahtarlar backend dokümanından (`API_REFERENCE.md:1450-1464`, çoğul diziler) alınmıştır;
 * Flutter dokümanı tekil `company/region/location` diyor (çelişki, API_CONTRACTS §3.7).
 * Boş filtreler hiç gönderilmez: view tekil değerleri `str(v)` ile QueryDict'e koyar
 * (`reporting.py:91-96`) → `null` "None" string'ine dönüşürdü.
 */
export interface CreateReportPayload {
  report_type: ReportType;
  start_date: string;
  end_date: string;
  custom_name?: string;
  companies?: number[];
  regions?: number[];
  locations?: number[];
  /** Seri numaraları (doküman örneği: `["PAV200000884"]`) */
  devices?: string[];
  transaction_status?: ReportTransactionStatus;
  /** "" (hepsi) veya 0-7 (doküman) */
  payment_type?: string;
  /** Ondalık string ("12.50") */
  min_amount?: string;
  failure_reason?: ReportFailureReason;
  // nfc_balance_logs
  nfc_source?: string;
  nfc_operation?: string;
  nfc_card_uids?: string[];
}

/** 202 yanıtı (`reporting.py:132-140`) */
export interface CreateReportResponse {
  detail: string;
  job_id: number;
  status: string;
  estimated_rows: number | null;
}

/** filter-options gelmeden önce / bilinmeyen tipte kullanılan yedek etiketler */
export const REPORT_TYPE_LABELS: Record<KnownReportType, string> = {
  pos_summary: "Cihaz bazlı özet",
  pos_detail: "Detaylı işlem listesi",
  nfc_balance_logs: "PersonelKart hareketleri",
};

export const REPORT_TYPE_DESCRIPTIONS: Record<KnownReportType, string> = {
  pos_summary: "Cihaz ve şirket bazında satış adetleri ve cirolar",
  pos_detail: "Her işlem ayrı satır: kart, ürün, durum ve tutar",
  nfc_balance_logs: "Yükleme, satış, iade ve düzeltme dahil tüm bakiye hareketleri",
};

export function reportTypeLabel(type: string, options?: ReportOption[] | null): string {
  const fromBackend = options?.find((o) => o.value === type)?.label;
  if (fromBackend) return fromBackend;
  return (REPORT_TYPE_LABELS as Record<string, string>)[type] ?? type;
}

/**
 * Ödeme tipi filtresi. Etiketler backend `services.py:22-33` (PT_TYPE_LABELS);
 * rapor validator'ı yalnız 0-7 kabul ediyor (`API_REFERENCE.md:1461`) → 8 ve 10 sunulmaz.
 */
export const REPORT_PAYMENT_TYPES: ReportOption[] = [
  { value: "0", label: "Nakit" },
  { value: "1", label: "Kredi/Banka Kartı" },
  { value: "2", label: "İstanbulKart" },
  { value: "3", label: "Multinet" },
  { value: "4", label: "Metropol" },
  { value: "5", label: "Personel Kart" },
  { value: "6", label: "Setcard" },
  { value: "7", label: "Ticket" },
];

/** `iptalNo`: 1 zaman aşımı, 2 banka reddi, 3 teknik (`overview.py:81-84`) */
export const REPORT_FAILURE_REASONS: { value: ReportFailureReason; label: string }[] = [
  { value: "1", label: "Zaman aşımı" },
  { value: "2", label: "Banka reddi" },
  { value: "3", label: "Teknik hata" },
  { value: "other", label: "Diğer" },
];

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
