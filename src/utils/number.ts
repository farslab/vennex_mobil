/**
 * Sayı/para yardımcıları.
 *
 * Backend para alanlarını çoğunlukla string ("1234.50") olarak döndürür (DecimalField).
 * Bu yüzden tüm format fonksiyonları string | number | null kabul eder ve geçersiz
 * değerlerde UYDURMA bir sayı göstermek yerine "—" döndürür.
 */

export const EMPTY_VALUE = "—";

/** Backend'den gelen sayısal değeri güvenle number'a çevirir. Geçersizse null. */
export function toNumber(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "string") {
    const n = Number(value.trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

const tryFormatter = new Intl.NumberFormat("tr-TR", {
  style: "currency",
  currency: "TRY",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 });

/** ₺1.234,50 — değer yoksa "—" (0 değeri geçerlidir ve ₺0,00 gösterilir) */
export function formatCurrency(value: unknown): string {
  const n = toNumber(value);
  return n == null ? EMPTY_VALUE : tryFormatter.format(n);
}

/** Kompakt para: ₺12,4 B / ₺1,2 Mn — KPI'larda dar alan için */
export function formatCurrencyCompact(value: unknown): string {
  const n = toNumber(value);
  if (n == null) return EMPTY_VALUE;
  if (Math.abs(n) < 10_000) return formatCurrency(n);
  return (
    "₺" +
    new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 }).format(n)
  );
}

/** Grafik ekseni: kuruşsuz ve kısa — ₺500, ₺1,5 B, ₺2,3 Mn */
export function formatCurrencyAxis(value: unknown): string {
  const n = toNumber(value);
  if (n == null) return EMPTY_VALUE;
  if (Math.abs(n) < 1000) return "₺" + new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 0 }).format(n);
  return "₺" + new Intl.NumberFormat("tr-TR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

/** Tam sayı: 12.345 */
export function formatInteger(value: unknown): string {
  const n = toNumber(value);
  return n == null ? EMPTY_VALUE : integerFormatter.format(n);
}

/** Ondalıklı miktar (stok): 12,5 — gereksiz sıfır göstermez */
export function formatQuantity(value: unknown, maxFractionDigits = 3): string {
  const n = toNumber(value);
  if (n == null) return EMPTY_VALUE;
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: maxFractionDigits }).format(n);
}

/** %12,5 */
export function formatPercent(value: unknown, fractionDigits = 1): string {
  const n = toNumber(value);
  if (n == null) return EMPTY_VALUE;
  return "%" + new Intl.NumberFormat("tr-TR", { maximumFractionDigits: fractionDigits }).format(n);
}

/**
 * Kullanıcının yazdığı ondalık değeri ayrıştırır. Türkçe ("12,5", "1.234,50")
 * ve noktalı ("12.5") girişleri destekler. Geçersizse null.
 *
 * Kural: hem nokta hem virgül varsa son görülen ayraç ondalıktır.
 * Yalnızca nokta varsa ve noktadan sonra tam 3 hane gruplanmışsa ("1.234") binlik kabul edilir.
 */
export function parseDecimal(input: string | null | undefined): number | null {
  if (input == null) return null;
  let s = String(input).trim().replace(/\s/g, "").replace(/₺/g, "");
  if (!s) return null;
  if (!/^[-+]?[\d.,]+$/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma >= 0 && lastDot >= 0) {
    const decimalSep = lastComma > lastDot ? "," : ".";
    const thousandSep = decimalSep === "," ? "." : ",";
    s = s.split(thousandSep).join("");
    s = s.replace(decimalSep, ".");
  } else if (lastComma >= 0) {
    if ((s.match(/,/g) ?? []).length > 1) return null;
    s = s.replace(",", ".");
  } else if (lastDot >= 0) {
    const dots = (s.match(/\./g) ?? []).length;
    if (dots > 1 || /^[-+]?\d{1,3}\.\d{3}$/.test(s)) {
      // "1.234" veya "1.234.567" → binlik ayraç
      if (!/^[-+]?\d{1,3}(\.\d{3})+$/.test(s)) return null;
      s = s.split(".").join("");
    }
  }

  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Backend'e gönderilecek ondalık string ("12.50"). DecimalField'lar için
 * float hassasiyet sorunlarını önler.
 */
export function toApiDecimal(value: number, fractionDigits = 2): string {
  return value.toFixed(fractionDigits);
}

/** İki sayı arasındaki yüzde değişim; önceki 0 veya yoksa null */
export function percentChange(current: unknown, previous: unknown): number | null {
  const c = toNumber(current);
  const p = toNumber(previous);
  if (c == null || p == null || p === 0) return null;
  return ((c - p) / Math.abs(p)) * 100;
}
