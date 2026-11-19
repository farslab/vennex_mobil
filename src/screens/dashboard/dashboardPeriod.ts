/**
 * Dashboard dönem seçenekleri ve özel aralık doğrulaması.
 * Backend dönemleri: `services.py:49-58` (PERIOD_CHOICES); custom → start_date/end_date YYYY-MM-DD,
 * bitiş günü dahil (`services.py:144-147`).
 */
import { PERIOD_LABELS, type ApiPeriod } from "@/types/common";
import { businessToday, daysBetweenInclusive, formatDate, parseUserDate, toApiDate } from "@/utils/date";

export const PERIOD_ORDER: ApiPeriod[] = [
  "today",
  "yesterday",
  "this_week",
  "last_week",
  "this_month",
  "last_month",
  "last_30",
  "custom",
];

export const PERIOD_OPTIONS = PERIOD_ORDER.map((key) => ({
  key,
  label: key === "custom" ? "Özel aralık" : PERIOD_LABELS[key],
}));

/**
 * Backend custom aralığa sınır koymuyor (`services.py:143-151`); sunucu yükünü sınırlamak için
 * istemci tarafında 92 gün üst sınırı uygulanır (raporlanan backend riski).
 */
export const MAX_CUSTOM_RANGE_DAYS = 92;

export interface CustomRange {
  /** YYYY-MM-DD */
  start: string;
  /** YYYY-MM-DD (dahil) */
  end: string;
}

export type RangeValidation =
  | { ok: true; range: CustomRange }
  | { ok: false; field: "start" | "end" | "range"; message: string };

/** Kullanıcı girişini (GG.AA.YYYY) doğrular */
export function validateCustomRange(startInput: string, endInput: string, today: Date = businessToday()): RangeValidation {
  const start = parseUserDate(startInput);
  if (!start) return { ok: false, field: "start", message: "Geçerli bir başlangıç tarihi girin (GG.AA.YYYY)." };
  const end = parseUserDate(endInput);
  if (!end) return { ok: false, field: "end", message: "Geçerli bir bitiş tarihi girin (GG.AA.YYYY)." };
  if (start.getTime() > end.getTime()) {
    return { ok: false, field: "range", message: "Başlangıç tarihi bitiş tarihinden sonra olamaz." };
  }
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  if (end.getTime() > todayStart.getTime()) {
    return { ok: false, field: "end", message: "Bitiş tarihi bugünden sonra olamaz." };
  }
  if (daysBetweenInclusive(start, end) > MAX_CUSTOM_RANGE_DAYS) {
    return { ok: false, field: "range", message: `Tarih aralığı en fazla ${MAX_CUSTOM_RANGE_DAYS} gün olabilir.` };
  }
  return { ok: true, range: { start: toApiDate(start), end: toApiDate(end) } };
}

/** "12.11.2026 – 18.11.2026" */
export function formatRangeLabel(range: CustomRange): string {
  const a = parseUserDate(range.start);
  const b = parseUserDate(range.end);
  if (!a || !b) return "Özel aralık";
  if (range.start === range.end) return formatDate(a);
  return `${formatDate(a)} – ${formatDate(b)}`;
}

/** YYYY-MM-DD → GG.AA.YYYY (input ön doldurma) */
export function apiDateToInput(value: string | null | undefined): string {
  const d = parseUserDate(value ?? "");
  return d ? formatDate(d) : "";
}
