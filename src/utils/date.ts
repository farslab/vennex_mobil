/**
 * Tarih yardımcıları. Backend ISO 8601 (UTC veya offset'li) döndürür; filtrelerde
 * YYYY-MM-DD bekler ve günleri Europe/Istanbul takvimine göre keser.
 *
 * Web ile aynı görünsün diye SUNUCU ZAMANLARI (string) her zaman Türkiye saatiyle gösterilir —
 * telefon başka saat dilimindeyse de. Türkiye 2016'dan beri kalıcı UTC+3 (yaz saati yok).
 * Kullanıcının seçtiği takvim tarihleri (`Date` nesnesi, yerel gece yarısı) olduğu gibi gösterilir.
 * "Bugün" de Türkiye takvimine göredir (`businessToday`).
 */
import { EMPTY_VALUE } from "./number";

/** Saat içeren ama dilim belirtmeyen ISO (Django naive) → Türkiye saati kabul edilir */
const NAIVE_DATETIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const v = NAIVE_DATETIME.test(value) ? `${value.replace(" ", "T")}+03:00` : value;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Europe/Istanbul sabit ofseti (DST yok) */
export const TR_OFFSET_MS = 3 * 60 * 60 * 1000;

interface Parts {
  y: number;
  m: number;
  d: number;
  hh: number;
  mm: number;
}

/** Sunucu anı → Türkiye saatindeki takvim/saat alanları */
function trParts(d: Date): Parts {
  const t = new Date(d.getTime() + TR_OFFSET_MS);
  return { y: t.getUTCFullYear(), m: t.getUTCMonth() + 1, d: t.getUTCDate(), hh: t.getUTCHours(), mm: t.getUTCMinutes() };
}

function localParts(d: Date): Parts {
  return { y: d.getFullYear(), m: d.getMonth() + 1, d: d.getDate(), hh: d.getHours(), mm: d.getMinutes() };
}

/** string (sunucu anı) → Türkiye saati; Date (takvim değeri) → yerel alanlar */
function partsOf(value: string | Date | null | undefined): Parts | null {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : localParts(value);
  const d = parseApiDate(value);
  return d ? trParts(d) : null;
}

/** Türkiye takvimindeki bugün (yerel gece yarısı Date olarak — takvim hesapları için) */
export function businessToday(now: Date = new Date()): Date {
  const p = trParts(now);
  return new Date(p.y, p.m - 1, p.d);
}

/** Yerel takvim gününü YYYY-MM-DD olarak verir (toISOString UTC kayması yapmaz) */
export function toApiDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** "GG.AA.YYYY" veya "YYYY-MM-DD" girişini doğrulayıp Date'e çevirir. Geçersizse null. */
export function parseUserDate(input: string | null | undefined): Date | null {
  if (!input) return null;
  const s = input.trim();
  let y: number, m: number, d: number;
  let match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (match) {
    [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])];
  } else {
    match = /^(\d{1,2})[./](\d{1,2})[./](\d{4})$/.exec(s);
    if (!match) return null;
    [d, m, y] = [Number(match[1]), Number(match[2]), Number(match[3])];
  }
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
}

/** 18.11.2026 */
export function formatDate(value: string | Date | null | undefined): string {
  const p = partsOf(value);
  if (!p) return EMPTY_VALUE;
  return `${pad(p.d)}.${pad(p.m)}.${p.y}`;
}

/** 18.11.2026 14:05 */
export function formatDateTime(value: string | Date | null | undefined): string {
  const p = partsOf(value);
  if (!p) return EMPTY_VALUE;
  return `${pad(p.d)}.${pad(p.m)}.${p.y} ${pad(p.hh)}:${pad(p.mm)}`;
}

/** 14:05 */
export function formatTime(value: string | Date | null | undefined): string {
  const p = partsOf(value);
  if (!p) return EMPTY_VALUE;
  return `${pad(p.hh)}:${pad(p.mm)}`;
}

/** "dd.MM.yyyy HH:mm:ss" (Türkiye saati) — web işlem listesiyle aynı biçim */
export function formatDateTimeSeconds(value: string | null | undefined): string {
  const d = parseApiDate(value);
  if (!d) return EMPTY_VALUE;
  const p = trParts(d);
  return `${pad(p.d)}.${pad(p.m)}.${p.y} ${pad(p.hh)}:${pad(p.mm)}:${pad(d.getUTCSeconds())}`;
}

/** "az önce", "5 dk önce", "3 sa önce", "2 gün önce", daha eskiyse tarih */
export function formatRelative(value: string | Date | null | undefined, now: Date = new Date()): string {
  const d = value instanceof Date ? value : parseApiDate(value);
  if (!d) return EMPTY_VALUE;
  const diffSec = Math.round((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 0) return formatDateTime(value);
  if (diffSec < 60) return "az önce";
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min} dk önce`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} gün önce`;
  return formatDate(value);
}

/** İki tarih arasındaki gün sayısı (dahil) */
export function daysBetweenInclusive(start: Date, end: Date): number {
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((b - a) / 86_400_000) + 1;
}
