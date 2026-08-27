export type ReportType = "pos_detail" | "pos_summary" | "nfc_balance_logs";

export type ReportStatus = "pending" | "running" | "completed" | "failed" | "cancelled";

// Backend hem küçük harf hem Celery-style büyük harf durumları dönebilir — normalize ederiz.
export function normalizeReportStatus(raw: string | null | undefined): ReportStatus {
  const v = (raw || "").toLowerCase();
  if (["running", "started", "retry"].includes(v)) return "running";
  if (["completed", "success"].includes(v)) return "completed";
  if (["failed", "failure"].includes(v)) return "failed";
  if (["cancelled", "canceled", "revoked"].includes(v)) return "cancelled";
  return "pending";
}

export interface ReportJob {
  id: number;
  report_type: ReportType;
  status: string; // ham backend değeri — UI'da normalizeReportStatus ile kullan
  progress_pct: number;
  created_at: string;
  finished_at?: string | null;
  expires_at?: string | null;
  is_downloadable: boolean;
  custom_name?: string | null;
  row_count?: number | null;
  estimated_rows?: number | null;
  file_size_bytes?: number | null;
  error_message?: string | null;
  download_count: number;
}

export interface ReportListResponse {
  results: ReportJob[];
  retention_hours: number;
  user_report_limit: number;
}

export interface ReportFilterOptions {
  report_types: { value: ReportType; label: string }[];
  companies: { id: number; name: string }[];
  regions: { id: number; name: string; company_id?: number | null }[];
  locations: { id: number; name: string; region_id?: number | null; region_name?: string | null }[];
  devices: { id: number; sn: string; pos_name: string; company_id?: number | null; location_id?: number | null }[];
  has_personel_kart_pos: boolean;
  nfc_sources: { value: string; label: string }[];
  nfc_operations: { value: string; label: string }[];
}

export interface CreateReportPayload {
  report_type: ReportType;
  start_date: string;
  end_date: string;
  custom_name?: string;
  company?: number;
  // pos_detail / pos_summary
  region?: number;
  location?: number;
  devices?: string[];
  transaction_status?: string;
  payment_type?: number;
  min_amount?: number;
  failure_reason?: string;
  // nfc_balance_logs
  nfc_source?: string;
  nfc_operation?: string;
  nfc_card_uids?: string[];
}

export const REPORT_TYPE_LABELS: Record<ReportType, string> = {
  pos_detail: "POS işlem detayı",
  pos_summary: "POS işlem özeti",
  nfc_balance_logs: "PersonelKart Hareketleri",
};
