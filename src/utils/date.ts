/**
 * Tarih yardımcıları. Backend ISO 8601 (UTC veya offset'li) döndürür; filtrelerde
 * YYYY-MM-DD bekler. Kullanıcıya gösterim yerel saat dilimindedir (cihaz: Europe/Istanbul).
 */
import { EMPTY_VALUE } from "./number";

export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

const pad = (n: number) => String(n).padStart(2, "0");

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
  const d = value instanceof Date ? value : parseApiDate(value);
  if (!d) return EMPTY_VALUE;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}

/** 18.11.2026 14:05 */
export function formatDateTime(value: string | Date | null | undefined): string {
  const d = value instanceof Date ? value : parseApiDate(value);
  if (!d) return EMPTY_VALUE;
  return `${formatDate(d)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 14:05 */
export function formatTime(value: string | Date | null | undefined): string {
  const d = value instanceof Date ? value : parseApiDate(value);
  if (!d) return EMPTY_VALUE;
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** "az önce", "5 dk önce", "3 sa önce", "2 gün önce", daha eskiyse tarih */
export function formatRelative(value: string | Date | null | undefined, now: Date = new Date()): string {
  const d = value instanceof Date ? value : parseApiDate(value);
  if (!d) return EMPTY_VALUE;
  const diffSec = Math.round((now.getTime() - d.getTime()) / 1000);
  if (diffSec < 0) return formatDateTime(d);
  if (diffSec < 60) return "az önce";
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min} dk önce`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} sa önce`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} gün önce`;
  return formatDate(d);
}

/** İki tarih arasındaki gün sayısı (dahil) */
export function daysBetweenInclusive(start: Date, end: Date): number {
  const a = Date.UTC(start.getFullYear(), start.getMonth(), start.getDate());
  const b = Date.UTC(end.getFullYear(), end.getMonth(), end.getDate());
  return Math.floor((b - a) / 86_400_000) + 1;
}
