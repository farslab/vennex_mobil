/**
 * Rapor (async export) şemaları.
 * Kaynak: backend `views/reporting.py` (tüm uçlar CanViewSales), docs/API_CONTRACTS.md §2.10, §3.7,
 * backend dokümanı `docs/VENNEX_MANAGEMENT_APP_API_REFERENCE.md:1438-1535`.
 */

/** Bilinen tipler (`reporting.py:68`). Geçerli liste ve etiketler `filter-options.report_types`'tan gelir. */
export type KnownReportType = "pos_detail" | "pos_summary" | "nfc_balance_logs" | "nfc_monthly_analysis";
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
 * POST /reports/ gövdesi — `reporting/validators.py:parse_filters` (web formuyla aynı anahtarlar).
 * `company` TEKİL; bölge/konum istemcide cihaz listesine çevrilir (web `applyScope`).
 * Boş filtreler hiç gönderilmez: view tekil değerleri `str(v)` ile QueryDict'e koyar
 * (`reporting.py:91-96`) → `null` "None" string'ine dönüşürdü.
 */
export interface CreateReportPayload {
  report_type: ReportType;
  start_date: string;
  end_date: string;
  custom_name?: string;
  company?: number;
  /** Seri numaraları */
  devices?: string[];
  /** Backend yalnız "true" / "false" tanır (`querybuilder.py:76-78`) */
  transaction_status?: "true" | "false";
  /** "" (hepsi) veya 0-5 (web formu) */
  payment_type?: string;
  /** Ondalık string ("12.50") */
  min_amount?: string;
  failure_reason?: ReportFailureReason;
  // nfc_balance_logs / nfc_monthly_analysis
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

/** Web arayüzündeki adlar (`reporting.html:31-72`, `reports_list_v2.html`) */
export const REPORT_TYPE_LABELS: Record<KnownReportType, string> = {
  pos_summary: "Özet",
  pos_detail: "Detay",
  nfc_balance_logs: "PersonelKart Hareketleri",
  nfc_monthly_analysis: "PersonelKart Aylık Analiz",
};

/** Web adı öncelikli; bilinmeyen tipte sunucunun etiketi */
export function reportTypeLabel(type: string, options?: ReportOption[] | null): string {
  return (REPORT_TYPE_LABELS as Record<string, string>)[type] ?? options?.find((o) => o.value === type)?.label ?? type;
}

/** Ödeme tipi filtresi — web rapor formuyla aynı liste ve adlar (`reporting.html:240-248`) */
export const REPORT_PAYMENT_TYPES: ReportOption[] = [
  { value: "0", label: "Nakit" },
  { value: "1", label: "Kredi Kartı" },
  { value: "2", label: "İstanbulKart" },
  { value: "3", label: "Multinet" },
  { value: "4", label: "Metropol" },
  { value: "5", label: "Personel Kart (NFC)" },
];

/** `iptalNo`: 1 zaman aşımı, 2 banka reddi, 3 teknik (`overview.py:81-84`) */
export const REPORT_FAILURE_REASONS: { value: ReportFailureReason; label: string }[] = [
  { value: "1", label: "Zaman Aşımı" },
  { value: "2", label: "Banka Reddi" },
  { value: "3", label: "Teknik Hata" },
  { value: "other", label: "Diğer" },
];

export const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
