/**
 * Yeni rapor formu: durum, doğrulama ve POST gövdesi üretimi (saf fonksiyonlar → test edilebilir).
 * Sözleşme: backend `reporting.py:65-140`, `API_REFERENCE.md:1450-1464` (çoğul diziler).
 */
import { parseDecimal, toApiDecimal } from "@/utils/number";
import { formatDate, parseUserDate, toApiDate } from "@/utils/date";
import type {
  CreateReportPayload,
  ReportFailureReason,
  ReportFilterOptions,
  ReportTransactionStatus,
} from "@/types/reports";

export interface ReportFormState {
  reportType: string;
  customName: string;
  /** GG.AA.YYYY */
  startInput: string;
  endInput: string;
  companies: number[];
  regions: number[];
  locations: number[];
  /** Seri numaraları */
  devices: string[];
  transactionStatus: ReportTransactionStatus;
  /** "" = hepsi */
  paymentType: string;
  minAmount: string;
  failureReason: ReportFailureReason | "";
  nfcSource: string;
  nfcOperation: string;
}

export type ReportFormErrors = Partial<Record<"reportType" | "startInput" | "endInput" | "range" | "minAmount" | "customName", string>>;

export const CUSTOM_NAME_MAX = 200; // `reporting.py:126` [:200]

export function initialReportForm(today: Date = new Date()): ReportFormState {
  const t = formatDate(today);
  return {
    reportType: "",
    customName: "",
    startInput: t,
    endInput: t,
    companies: [],
    regions: [],
    locations: [],
    devices: [],
    transactionStatus: "all",
    paymentType: "",
    minAmount: "",
    failureReason: "",
    nfcSource: "",
    nfcOperation: "",
  };
}

export const isNfcReport = (type: string) => type === "nfc_balance_logs";

/** Varsayılan tip: backend listesindeki ilk seçilebilir tip (özet öncelikli) */
export function defaultReportType(options: ReportFilterOptions | undefined): string {
  const types = (options?.report_types ?? []).filter((t) => !isNfcReport(t.value) || options?.has_personel_kart_pos);
  return types.find((t) => t.value === "pos_summary")?.value ?? types[0]?.value ?? "";
}

/* ------------------------------------------------------- Date presets */

export type DatePresetKey = "today" | "yesterday" | "last7" | "thisMonth" | "lastMonth";

export const DATE_PRESETS: { key: DatePresetKey; label: string }[] = [
  { key: "today", label: "Bugün" },
  { key: "yesterday", label: "Dün" },
  { key: "last7", label: "Son 7 gün" },
  { key: "thisMonth", label: "Bu ay" },
  { key: "lastMonth", label: "Geçen ay" },
];

export function presetRange(key: DatePresetKey, today: Date = new Date()): { start: Date; end: Date } {
  const y = today.getFullYear();
  const m = today.getMonth();
  const d = today.getDate();
  switch (key) {
    case "today":
      return { start: new Date(y, m, d), end: new Date(y, m, d) };
    case "yesterday":
      return { start: new Date(y, m, d - 1), end: new Date(y, m, d - 1) };
    case "last7":
      return { start: new Date(y, m, d - 6), end: new Date(y, m, d) };
    case "thisMonth":
      return { start: new Date(y, m, 1), end: new Date(y, m, d) };
    case "lastMonth":
      return { start: new Date(y, m - 1, 1), end: new Date(y, m, 0) };
  }
}

/* ------------------------------------------------------- Cascading */

export function availableRegions(options: ReportFilterOptions | undefined, companies: number[]) {
  const all = options?.regions ?? [];
  return companies.length ? all.filter((r) => r.company_id != null && companies.includes(r.company_id)) : all;
}

export function availableLocations(options: ReportFilterOptions | undefined, companies: number[], regions: number[]) {
  const regionIds = regions.length ? regions : companies.length ? availableRegions(options, companies).map((r) => r.id) : null;
  const all = options?.locations ?? [];
  return regionIds ? all.filter((l) => l.region_id != null && regionIds.includes(l.region_id)) : all;
}

export function availableDevices(options: ReportFilterOptions | undefined, companies: number[], locations: number[]) {
  let list = options?.devices ?? [];
  if (companies.length) list = list.filter((d) => d.company_id != null && companies.includes(d.company_id));
  if (locations.length) list = list.filter((d) => d.location_id != null && locations.includes(d.location_id));
  return list;
}

/** Üst filtre değişince artık geçerli olmayan alt seçimleri temizler */
export function pruneSelections(form: ReportFormState, options: ReportFilterOptions | undefined): ReportFormState {
  const regionIds = new Set(availableRegions(options, form.companies).map((r) => r.id));
  const regions = form.regions.filter((id) => regionIds.has(id));
  const locationIds = new Set(availableLocations(options, form.companies, regions).map((l) => l.id));
  const locations = form.locations.filter((id) => locationIds.has(id));
  const deviceSns = new Set(availableDevices(options, form.companies, locations).map((d) => d.sn));
  const devices = form.devices.filter((sn) => deviceSns.has(sn));
  return { ...form, regions, locations, devices };
}

/* ------------------------------------------------------- Validation */

export function validateReportForm(
  form: ReportFormState,
  today: Date = new Date()
): { ok: true; payload: CreateReportPayload } | { ok: false; errors: ReportFormErrors } {
  const errors: ReportFormErrors = {};
  if (!form.reportType) errors.reportType = "Rapor tipi seçin.";

  const start = parseUserDate(form.startInput);
  const end = parseUserDate(form.endInput);
  if (!start) errors.startInput = "Geçerli bir tarih girin (GG.AA.YYYY).";
  if (!end) errors.endInput = "Geçerli bir tarih girin (GG.AA.YYYY).";
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (start && end) {
    if (start.getTime() > end.getTime()) errors.range = "Başlangıç tarihi bitiş tarihinden sonra olamaz.";
    else if (end.getTime() > todayStart.getTime()) errors.endInput = "Bitiş tarihi bugünden sonra olamaz.";
  }
  // Azami aralık backend validator'ında (kopyada yok) → sunucunun 400 mesajı gösterilir

  const name = form.customName.trim();
  if (name.length > CUSTOM_NAME_MAX) errors.customName = `En fazla ${CUSTOM_NAME_MAX} karakter.`;

  const nfc = isNfcReport(form.reportType);
  let minAmount: number | null = null;
  if (!nfc && form.minAmount.trim()) {
    minAmount = parseDecimal(form.minAmount);
    if (minAmount == null || minAmount < 0) errors.minAmount = "Geçerli bir tutar girin (ör. 12,50).";
  }

  if (Object.keys(errors).length || !start || !end) return { ok: false, errors };

  // Boş filtreler hiç gönderilmez (backend tekil değerleri str() ile QueryDict'e koyar)
  const payload: CreateReportPayload = {
    report_type: form.reportType,
    start_date: toApiDate(start),
    end_date: toApiDate(end),
  };
  if (name) payload.custom_name = name;

  if (nfc) {
    // SÖZLEŞME: doğrulanamadı — NFC raporunun şirket/bölge filtrelerini kabul edip etmediği bilinmiyor
    if (form.nfcSource) payload.nfc_source = form.nfcSource;
    if (form.nfcOperation) payload.nfc_operation = form.nfcOperation;
    return { ok: true, payload };
  }

  if (form.companies.length) payload.companies = form.companies;
  if (form.regions.length) payload.regions = form.regions;
  if (form.locations.length) payload.locations = form.locations;
  if (form.devices.length) payload.devices = form.devices;
  if (form.transactionStatus !== "all") payload.transaction_status = form.transactionStatus;
  if (form.paymentType !== "") payload.payment_type = form.paymentType;
  if (minAmount != null && minAmount > 0) payload.min_amount = toApiDecimal(minAmount);
  if (form.transactionStatus === "fail" && form.failureReason) payload.failure_reason = form.failureReason;
  return { ok: true, payload };
}
