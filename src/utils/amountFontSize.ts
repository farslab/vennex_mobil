import { formatCurrency } from "./number";

/**
 * Büyük tutar yazısının boyutu: uzun tutarlarda (₺1.250.000,00) bir/iki kademe küçülür, satıra sığar.
 * iOS'ta adjustsFontSizeToFit kaydırılan kartlarda tutarı okunamayacak kadar küçültebildiği için
 * boyut metnin uzunluğundan seçilir.
 */
export function amountFontSize(value: number | null | undefined, base: number): number {
  const len = formatCurrency(value).length;
  return len <= 11 ? base : len <= 13 ? base - 4 : base - 8;
}
