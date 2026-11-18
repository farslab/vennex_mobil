/**
 * Rapor API — backend `views/reporting.py`, docs/API_CONTRACTS.md §2.10, §3.7.
 * Tüm uçlar `CanViewSales`. Eşzamanlı yalnız 1 aktif iş (429). `retry` YENİ job id döner.
 */
import { Directory, File, Paths } from "expo-file-system";
import { apiClient, type ApiError } from "./client";
import { tokenStorage } from "@/utils/tokenStorage";
import { toNumber } from "@/utils/number";
import {
  XLSX_MIME,
  type CreateReportPayload,
  type CreateReportResponse,
  type ReportFilterOptions,
  type ReportJob,
  type ReportListResponse,
  type ReportOption,
} from "@/types/reports";

/* ----------------------------------------------------------- Normalize */

export function normalizeJob(raw: Partial<ReportJob> & { id: number }): ReportJob {
  return {
    id: raw.id,
    report_type: String(raw.report_type ?? ""),
    custom_name: typeof raw.custom_name === "string" ? raw.custom_name : "",
    status: String(raw.status ?? ""),
    progress_pct: toNumber(raw.progress_pct),
    row_count: toNumber(raw.row_count),
    estimated_rows: toNumber(raw.estimated_rows),
    file_size_bytes: toNumber(raw.file_size_bytes),
    error_message: typeof raw.error_message === "string" && raw.error_message ? raw.error_message : null,
    created_at: String(raw.created_at ?? ""),
    finished_at: raw.finished_at ?? null,
    expires_at: raw.expires_at ?? null,
    is_active: raw.is_active === true,
    is_downloadable: raw.is_downloadable === true,
    download_count: toNumber(raw.download_count) ?? 0,
  };
}

function normalizeOptions(list: unknown): ReportOption[] {
  if (!Array.isArray(list)) return [];
  return list
    .filter((o): o is { value: unknown; label: unknown } => !!o && typeof o === "object")
    .map((o) => ({ value: String(o.value ?? ""), label: String(o.label ?? o.value ?? "") }))
    .filter((o) => o.value !== "");
}

const arr = <T>(v: unknown): T[] => (Array.isArray(v) ? (v as T[]) : []);

export function normalizeFilterOptions(raw: Partial<ReportFilterOptions> | null | undefined): ReportFilterOptions {
  return {
    report_types: normalizeOptions(raw?.report_types),
    companies: arr<ReportFilterOptions["companies"][number]>(raw?.companies),
    regions: arr<ReportFilterOptions["regions"][number]>(raw?.regions).map((r) => ({ ...r, company_id: r.company_id ?? null })),
    locations: arr<ReportFilterOptions["locations"][number]>(raw?.locations).map((l) => ({
      ...l,
      region_id: l.region_id ?? null,
      region_name: l.region_name ?? null,
    })),
    devices: arr<ReportFilterOptions["devices"][number]>(raw?.devices)
      .filter((d) => typeof d?.sn === "string" && d.sn)
      .map((d) => ({ ...d, pos_name: d.pos_name ?? null, company_id: d.company_id ?? null, location_id: d.location_id ?? null })),
    has_personel_kart_pos: raw?.has_personel_kart_pos === true,
    nfc_sources: normalizeOptions(raw?.nfc_sources),
    nfc_operations: normalizeOptions(raw?.nfc_operations),
  };
}

/* ------------------------------------------------------------- Download */

export interface DownloadProgressInfo {
  bytesWritten: number;
  /** Content-Length yoksa null */
  totalBytes: number | null;
  /** 0–1, toplam bilinmiyorsa null */
  ratio: number | null;
}

export interface DownloadResult {
  uri: string;
  fileName: string;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Flutter ile aynı yedek ad şeması (`FL:reports_screen.dart:123-137`) */
const TYPE_FILE_PREFIX: Record<string, string> = {
  pos_summary: "POS_ozet",
  pos_detail: "POS_islem_detayi",
  nfc_balance_logs: "PersonelKart_Hareketleri",
};

/** Dosya sistemi için güvenli ad (Türkçe harfler korunur, ayraçlar temizlenir) */
export function sanitizeFileName(name: string): string {
  return name
    .replace(/[\\/:*?"<>|\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
}

/** Uzantıyı garanti eder: backend XLSX döner (`reporting.py:172-175`) */
export function ensureXlsxExtension(name: string): string {
  const clean = sanitizeFileName(name);
  return /\.xlsx$/i.test(clean) ? clean : `${clean.replace(/\.+$/, "")}.xlsx`;
}

/** Content-Disposition yoksa kullanılacak ad: `<ad|tip>_YYYYMMDD_HHMM.xlsx` */
export function fallbackReportFileName(job: Pick<ReportJob, "id" | "report_type" | "custom_name" | "created_at">): string {
  const d = new Date(job.created_at);
  const stamp = Number.isNaN(d.getTime())
    ? String(job.id)
    : `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}_${pad(d.getHours())}${pad(d.getMinutes())}`;
  const base = sanitizeFileName(job.custom_name || "") || TYPE_FILE_PREFIX[job.report_type] || `rapor_${job.id}`;
  return ensureXlsxExtension(`${base}_${stamp}`);
}

/** `Content-Disposition: attachment; filename="..."` (+ RFC 5987 filename*) ayrıştırıcı */
export function parseContentDispositionFileName(header: string | null | undefined): string | null {
  if (!header) return null;
  const star = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header);
  if (star) {
    try {
      return decodeURIComponent(star[1].trim().replace(/^"|"$/g, ""));
    } catch {
      // bozuk kodlama → düz filename'e düş
    }
  }
  const plain = /filename\s*=\s*"([^"]*)"|filename\s*=\s*([^;]+)/i.exec(header);
  const value = (plain?.[1] ?? plain?.[2] ?? "").trim();
  return value || null;
}

function downloadError(message: string, status?: number): ApiError {
  const err = new Error(message) as ApiError;
  err.status = status;
  return err;
}

/** expo-file-system hata mesajından HTTP durum kodunu çıkarır ("UnableToDownload ... 404") */
function mapNativeDownloadError(e: unknown): ApiError {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  if (e instanceof Error && e.name === "AbortError") return downloadError("İndirme iptal edildi.");
  const status = Number(/\b(4\d\d|5\d\d)\b/.exec(msg)?.[1]) || undefined;
  if (status === 401) return downloadError("Oturumunuzun süresi doldu. Tekrar giriş yapıp deneyin.", 401);
  if (status === 403) return downloadError("Bu raporu indirme yetkiniz yok.", 403);
  if (status === 404) return downloadError("Rapor dosyası bulunamadı ya da saklama süresi doldu.", 404);
  if (status && status >= 500) return downloadError("Sunucu dosyayı şu anda veremiyor. Biraz sonra tekrar deneyin.", status);
  return downloadError("Rapor indirilemedi. Bağlantınızı kontrol edip tekrar deneyin.", status);
}

/* ----------------------------------------------------------------- API */

export const reportsApi = {
  list: (signal?: AbortSignal) =>
    apiClient.get<ReportListResponse>("/reports/", { signal }).then(
      (r): ReportListResponse => ({
        retention_hours: toNumber(r.data?.retention_hours),
        user_report_limit: toNumber(r.data?.user_report_limit),
        results: arr<ReportJob>(r.data?.results).filter((j) => typeof j?.id === "number").map(normalizeJob),
      })
    ),

  filterOptions: (signal?: AbortSignal) =>
    apiClient.get<ReportFilterOptions>("/reports/filter-options/", { signal }).then((r) => normalizeFilterOptions(r.data)),

  /** 202 {detail, job_id, status, estimated_rows}; 400/403/404/429 → ApiError (status ile) */
  create: (payload: CreateReportPayload) =>
    apiClient.post<CreateReportResponse>("/reports/", payload).then(
      (r): CreateReportResponse => ({
        detail: r.data?.detail ?? "",
        job_id: Number(r.data?.job_id),
        status: String(r.data?.status ?? "pending"),
        estimated_rows: toNumber(r.data?.estimated_rows),
      })
    ),

  detail: (id: number, signal?: AbortSignal) =>
    apiClient.get<ReportJob>(`/reports/${id}/`, { signal }).then((r) => normalizeJob(r.data)),

  /** Güncel job döner; aktif değilse 400 (`reporting.py:184-199`) */
  cancel: (id: number) => apiClient.post<ReportJob>(`/reports/${id}/cancel/`).then((r) => normalizeJob(r.data)),

  /** 202 + YENİ job (yeni `id`) — eski id artık izlenmez (`reporting.py:202-224`) */
  retry: (id: number) => apiClient.post<ReportJob>(`/reports/${id}/retry/`).then((r) => normalizeJob(r.data)),

  /** 204; aktif job silinemez (400) (`reporting.py:150-155`) */
  remove: (id: number) => apiClient.delete(`/reports/${id}/`).then(() => undefined),

  /**
   * XLSX dosyasını önbellek dizinine indirir (expo-file-system SDK 57 `File`/`Directory` API'si).
   * 1) `detail` ile apiClient üzerinden durum + token tazeliği doğrulanır (401'de tek refresh yapılır),
   * 2) dosya Authorization header'ı ile indirilir, ad Content-Disposition'dan alınır, `.xlsx` garanti edilir.
   */
  download: async (
    job: Pick<ReportJob, "id" | "report_type" | "custom_name" | "created_at">,
    opts: { onProgress?: (p: DownloadProgressInfo) => void; signal?: AbortSignal } = {}
  ): Promise<DownloadResult> => {
    const fresh = await reportsApi.detail(job.id, opts.signal);
    if (!fresh.is_downloadable) {
      throw downloadError("Rapor indirilemez: henüz tamamlanmamış veya saklama süresi dolmuş.", 404);
    }

    const access = await tokenStorage.getAccess();
    const url = `${apiClient.defaults.baseURL ?? ""}/reports/${job.id}/download/`;
    const headers: Record<string, string> = { Accept: XLSX_MIME };
    if (access) headers.Authorization = `Bearer ${access}`;

    let file: File;
    try {
      // Her indirme kendi alt dizinine: aynı adlı dosya çakışmaz, ad sunucu başlığından gelir
      const dir = new Directory(Paths.cache, "reports", `${job.id}-${Date.now()}`);
      dir.create({ intermediates: true, idempotent: true });
      file = await File.downloadFileAsync(url, dir, {
        headers,
        idempotent: true,
        signal: opts.signal,
        onProgress: opts.onProgress
          ? ({ bytesWritten, totalBytes }) => {
              const total = totalBytes > 0 ? totalBytes : null;
              opts.onProgress?.({
                bytesWritten,
                totalBytes: total,
                ratio: total ? Math.min(1, bytesWritten / total) : null,
              });
            }
          : undefined,
      });
    } catch (e) {
      throw mapNativeDownloadError(e);
    }

    const nativeName = file.name || "";
    const looksGeneric = !nativeName || /^download(\.\w+)?$/i.test(nativeName);
    const fileName = looksGeneric ? fallbackReportFileName(job) : ensureXlsxExtension(nativeName);
    if (fileName !== nativeName) {
      try {
        file.rename(fileName);
      } catch {
        // yeniden adlandırılamazsa mevcut adla paylaş
        return { uri: file.uri, fileName: nativeName };
      }
    }
    return { uri: file.uri, fileName };
  },
};
