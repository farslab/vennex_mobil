/** Kart alanı yardımcıları — yalnız istemci doğrulaması; asıl kontrol sunucuda ve bankada */

export function digitsOnly(value: string): string {
  return value.replace(/\D/g, "");
}

/** "5456160140225418" → "5456 1601 4022 5418" (en fazla 16 hane; Amex 15) */
export function formatCardNumber(value: string): string {
  const d = digitsOnly(value).slice(0, 16);
  return d.replace(/(\d{4})(?=\d)/g, "$1 ");
}

/** Luhn denetimi (yanlış yazılmış numarayı bankaya gitmeden yakalar) */
export function luhnValid(value: string): boolean {
  const d = digitsOnly(value);
  if (d.length < 15 || d.length > 16) return false;
  let sum = 0;
  for (let i = 0; i < d.length; i++) {
    let n = Number(d[d.length - 1 - i]);
    if (i % 2 === 1) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
  }
  return sum % 10 === 0;
}

/** "0128" / "01/28" → "01/28" */
export function formatExpiry(value: string): string {
  const d = digitsOnly(value).slice(0, 4);
  return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
}

/** "MM/YY" → { month: "01", year: "2028" }; geçersiz/süresi geçmişse null */
export function parseExpiry(value: string, now: Date = new Date()): { month: string; year: string } | null {
  const d = digitsOnly(value);
  if (d.length !== 4) return null;
  const m = Number(d.slice(0, 2));
  const y = 2000 + Number(d.slice(2));
  if (m < 1 || m > 12) return null;
  const endOfMonth = new Date(y, m, 0, 23, 59, 59);
  if (endOfMonth < now) return null;
  return { month: String(m).padStart(2, "0"), year: String(y) };
}

/** Türkçe tutar girişi: "1.250,50" / "1250.50" → 1250.5 (geçersizse NaN) */
export function parseAmountTr(value: string): number {
  const v = value.trim().replace(/\s/g, "");
  if (!v) return NaN;
  const normalized = v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v;
  return /^\d+(\.\d{1,2})?$/.test(normalized) ? Number(normalized) : NaN;
}

/** Sayıyı Türkçe tutar giriş metnine: 1250.5 → "1250,50" */
export function amountInputTr(n: number): string {
  return n.toFixed(2).replace(".", ",");
}

export interface CardForm {
  amount: string;
  holder: string;
  number: string;
  expiry: string;
  cvv: string;
}

export function validateCardForm(f: CardForm, maxAmount: number, now: Date = new Date()): Partial<Record<keyof CardForm, string>> {
  const e: Partial<Record<keyof CardForm, string>> = {};
  const amount = parseAmountTr(f.amount);
  if (!(amount > 0)) e.amount = "Geçerli bir tutar girin.";
  else if (amount > maxAmount + 1e-9) e.amount = "Tutar borçtan fazla olamaz.";
  if (f.holder.trim().split(/\s+/).length < 2) e.holder = "Kart üzerindeki ad ve soyadı girin.";
  if (!luhnValid(f.number)) e.number = "Kart numarası geçersiz.";
  if (!parseExpiry(f.expiry, now)) e.expiry = "Son kullanma tarihi geçersiz (AA/YY).";
  if (!/^\d{3,4}$/.test(f.cvv)) e.cvv = "CVV 3 veya 4 haneli olmalı.";
  return e;
}
