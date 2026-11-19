/**
 * Yeni rapor formu: durum, doğrulama ve POST gövdesi üretimi (saf fonksiyonlar → test edilebilir).
 *
 * Web formuyla BİREBİR (`theme/templates/v2/pages/reporting.html`, `reporting/validators.py:parse_filters`):
 * - Tipler: Özet (varsayılan) · Detay · PersonelKart Hareketleri (+ "Aylık Analiz" alt seçeneği → `nfc_monthly_analysis`)
 * - Şirket TEKİL `company` (oturumdaki şirket önseçili, "Tümü" seçilebilir)
 * - Bölge/konum yalnız kapsamı işaretler: seçilen bölge/konumdaki cihazlar `devices` olarak gider (web `applyScope`)
 * - İşlem durumu `true` / `false` (varsayılan Başarılı); başka değer backend'de SESSİZCE yok sayılır
 */
import { parseDecimal, toApiDecimal } from "@/utils/number";
import { businessToday, formatDate, parseUserDate, toApiDate } from "@/utils/date";
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
  /** null = tüm şirketler (web "Tümü") */
  company: number | null;
  /** Kapsam işaretleyiciler: seçilen bölge/konumların cihazları rapora girer */
  regions: number[];
  locations: number[];
  /** Açıkça seçilen seri numaraları (kapsamdan önceliklidir) */
  devices: string[];
  transactionStatus: ReportTransactionStatus;
  /** "" = hepsi */
  paymentType: string;
  minAmount: string;
  failureReason: ReportFailureReason | "";
  nfcSource: string;
  nfcOperation: string;
  /** PersonelKart "Aylık Analiz" (web checkbox) */
  nfcMonthly: boolean;
  /** 1-12 */
  analysisMonth: number;
  analysisYear: number;
  /** Boş = tüm kartlar */
  nfcCardUids: string[];
}

export type ReportFormErrors = Partial<
  Record<"reportType" | "startInput" | "endInput" | "range" | "minAmount" | "customName" | "scope", string>
>;

export const CUSTOM_NAME_MAX = 200; // `reporting.py:126` [:200]
/** Backend sınırları (`reporting/validators.py:18-20`) — istemcide de erken uyarı */
export const MAX_DATE_RANGE_DAYS = 365;
export const MAX_DEVICE_COUNT = 1000;

export const NFC_LOGS = "nfc_balance_logs";
export const NFC_MONTHLY = "nfc_monthly_analysis";

export function initialReportForm(today: Date = businessToday(), companyId: number | null = null): ReportFormState {
  const t = formatDate(today);
  return {
    reportType: "",
    customName: "",
    startInput: t,
    endInput: t,
    company: companyId,
    regions: [],
    locations: [],
    devices: [],
    transactionStatus: "success", // web varsayılanı: Başarılı
    paymentType: "",
    minAmount: "",
    failureReason: "",
    nfcSource: "",
    nfcOperation: "",
    nfcMonthly: false,
    analysisMonth: today.getMonth() + 1,
    analysisYear: today.getFullYear(),
    nfcCardUids: [],
  };
}

export const isNfcReport = (type: string) => type === NFC_LOGS || type === NFC_MONTHLY;

/* ------------------------------------------------------- Report types (web sırası ve adları) */

export interface ReportTypeCard {
  value: string;
  label: string;
  description: string;
}

const WEB_REPORT_TYPES: ReportTypeCard[] = [
  { value: "pos_summary", label: "Özet", description: "POS cihazı/şirket bazlı satış adetleri ve cirolar" },
  { value: "pos_detail", label: "Detay", description: "Her işlem ayrı satır (kart no, ürün, durum dahil)" },
  {
    value: NFC_LOGS,
    label: "PersonelKart Hareketleri",
    description: "Yükleme, satış, iade, düzeltme, silme dahil tüm bakiye hareketleri",
  },
];

/**
 * Formda gösterilecek tipler: web ile aynı sıra/ad; yalnız sunucunun tanıdığı tipler.
 * PersonelKart yalnız şirkette PersonelKart özellikli POS varsa (web gizler).
 * "Aylık Analiz" ayrı tip değil, PersonelKart'ın alt seçeneği.
 */
export function visibleReportTypes(options: ReportFilterOptions | undefined): ReportTypeCard[] {
  const known = new Set((options?.report_types ?? []).map((t) => t.value));
  return WEB_REPORT_TYPES.filter((t) => known.has(t.value) && (t.value !== NFC_LOGS || options?.has_personel_kart_pos));
}

export function monthlyAnalysisAvailable(options: ReportFilterOptions | undefined): boolean {
  return !!options?.has_personel_kart_pos && (options?.report_types ?? []).some((t) => t.value === NFC_MONTHLY);
}

export function defaultReportType(options: ReportFilterOptions | undefined): string {
  return visibleReportTypes(options)[0]?.value ?? "";
}

/** Web ay seçicisi: içinde bulunulan yıl ve önceki 4 yıl */
export function analysisYears(today: Date = businessToday()): number[] {
  const y = today.getFullYear();
  return [y, y - 1, y - 2, y - 3, y - 4];
}

export const MONTH_NAMES = [
  "Ocak",
  "Şubat",
  "Mart",
  "Nisan",
  "Mayıs",
  "Haziran",
  "Temmuz",
  "Ağustos",
  "Eylül",
  "Ekim",
  "Kasım",
  "Aralık",
];

/** Seçilen ayın tamamı (1'i – ay sonu) — web `syncMonthlyAnalysisUI` */
export function monthRange(month: number, year: number): { start: Date; end: Date } {
  return { start: new Date(year, month - 1, 1), end: new Date(year, month, 0) };
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

export function presetRange(key: DatePresetKey, today: Date = businessToday()): { start: Date; end: Date } {
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

/* ------------------------------------------------------- Scope (şirket → bölge → konum → cihaz) */

export function availableRegions(options: ReportFilterOptions | undefined, company: number | null) {
  const all = options?.regions ?? [];
  return company != null ? all.filter((r) => r.company_id === company) : all;
}

export function availableLocations(options: ReportFilterOptions | undefined, company: number | null, regions: number[]) {
  const regionIds = new Set((regions.length ? regions : availableRegions(options, company).map((r) => r.id)) as number[]);
  const all = options?.locations ?? [];
  if (!regions.length && company == null) return all;
  return all.filter((l) => l.region_id != null && regionIds.has(l.region_id));
}

/** Şirkete göre görünen cihazlar (web: şirket seçimi listeyi süzer, bölge/konum yalnız işaretler) */
export function availableDevices(options: ReportFilterOptions | undefined, company: number | null) {
  const list = options?.devices ?? [];
  return company != null ? list.filter((d) => d.company_id === company) : list;
}

/** Seçilen bölge/konumların kapsadığı cihazlar (web `applyScope`) — kapsam yoksa null */
export function scopeDevices(options: ReportFilterOptions | undefined, form: Pick<ReportFormState, "company" | "regions" | "locations">): string[] | null {
  if (!form.regions.length && !form.locations.length) return null;
  const locIds = new Set<number>(
    form.locations.length ? form.locations : availableLocations(options, form.company, form.regions).map((l) => l.id)
  );
  return availableDevices(options, form.company)
    .filter((d) => d.location_id != null && locIds.has(d.location_id))
    .map((d) => d.sn);
}

/** Üst filtre değişince artık geçerli olmayan alt seçimleri temizler */
export function pruneSelections(form: ReportFormState, options: ReportFilterOptions | undefined): ReportFormState {
  const regionIds = new Set(availableRegions(options, form.company).map((r) => r.id));
  const regions = form.regions.filter((id) => regionIds.has(id));
  const locationIds = new Set(availableLocations(options, form.company, regions).map((l) => l.id));
  const locations = form.locations.filter((id) => locationIds.has(id));
  const deviceSns = new Set(availableDevices(options, form.company).map((d) => d.sn));
  const devices = form.devices.filter((sn) => deviceSns.has(sn));
  return { ...form, regions, locations, devices };
}

/* ------------------------------------------------------- Validation */

const dayDiff = (a: Date, b: Date) => Math.round((b.getTime() - a.getTime()) / 86_400_000);

export function validateReportForm(
  form: ReportFormState,
  options?: ReportFilterOptions,
  today: Date = businessToday()
): { ok: true; payload: CreateReportPayload } | { ok: false; errors: ReportFormErrors } {
  const errors: ReportFormErrors = {};
  if (!form.reportType) errors.reportType = "Rapor tipi seçin.";

  const nfc = isNfcReport(form.reportType);
  const monthly = nfc && form.nfcMonthly;

  let start: Date | null;
  let end: Date | null;
  if (monthly) {
    ({ start, end } = monthRange(form.analysisMonth, form.analysisYear));
  } else {
    start = parseUserDate(form.startInput);
    end = parseUserDate(form.endInput);
    if (!start) errors.startInput = "Geçerli bir tarih girin (GG.AA.YYYY).";
    if (!end) errors.endInput = "Geçerli bir tarih girin (GG.AA.YYYY).";
    const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (start && end) {
      if (start.getTime() > end.getTime()) errors.range = "Başlangıç tarihi bitiş tarihinden sonra olamaz.";
      else if (end.getTime() > todayStart.getTime()) errors.endInput = "Bitiş tarihi bugünden sonra olamaz.";
      else if (dayDiff(start, end) > MAX_DATE_RANGE_DAYS) errors.range = `Tarih aralığı en fazla ${MAX_DATE_RANGE_DAYS} gün olabilir.`;
    }
  }

  const name = form.customName.trim();
  if (name.length > CUSTOM_NAME_MAX) errors.customName = `En fazla ${CUSTOM_NAME_MAX} karakter.`;

  let minAmount: number | null = null;
  if (!nfc && form.minAmount.trim()) {
    minAmount = parseDecimal(form.minAmount);
    if (minAmount == null || minAmount < 0) errors.minAmount = "Geçerli bir tutar girin (ör. 12,50).";
  }

  // Cihaz kapsamı: açık seçim > bölge/konum kapsamı > şirket
  let devices: string[] = [];
  if (!nfc) {
    if (form.devices.length) devices = form.devices;
    else {
      const scoped = scopeDevices(options, form);
      if (scoped && scoped.length === 0) errors.scope = "Seçilen bölge/konumlarda POS cihazı yok.";
      devices = scoped ?? [];
    }
    if (devices.length > MAX_DEVICE_COUNT) errors.scope = `En fazla ${MAX_DEVICE_COUNT} POS cihazı seçilebilir.`;
  }

  if (Object.keys(errors).length || !start || !end) return { ok: false, errors };

  // Boş filtreler hiç gönderilmez (view tekil değerleri str() ile QueryDict'e koyar → null "None" olurdu)
  const payload: CreateReportPayload = {
    report_type: monthly ? NFC_MONTHLY : form.reportType,
    start_date: toApiDate(start),
    end_date: toApiDate(end),
  };
  if (name) payload.custom_name = name;
  if (form.company != null) payload.company = form.company;

  if (nfc) {
    if (!monthly) {
      // Web: aylık analizde kaynak/işlem filtreleri gizlenir
      if (form.nfcSource) payload.nfc_source = form.nfcSource;
      if (form.nfcOperation) payload.nfc_operation = form.nfcOperation;
    }
    if (form.nfcCardUids.length) payload.nfc_card_uids = form.nfcCardUids;
    return { ok: true, payload };
  }

  if (devices.length) payload.devices = devices;
  if (form.transactionStatus !== "all") payload.transaction_status = form.transactionStatus === "success" ? "true" : "false";
  if (form.paymentType !== "") payload.payment_type = form.paymentType;
  if (minAmount != null && minAmount > 0) payload.min_amount = toApiDecimal(minAmount);
  if (form.transactionStatus === "fail" && form.failureReason) payload.failure_reason = form.failureReason;
  return { ok: true, payload };
}
