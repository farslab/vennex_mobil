import {
  formatCurrency,
  formatCurrencyAxis,
  formatCurrencyCompact,
  formatInteger,
  formatPercent,
  formatQuantity,
  parseDecimal,
  percentChange,
  toApiDecimal,
  toNumber,
} from "@/utils/number";

// Intl çıktısındaki dar boşlukları (U+00A0/U+202F) normalize eder
const n = (s: string) => s.replace(/[  ]/g, " ");

describe("toNumber", () => {
  it.each([
    [12, 12],
    ["12.50", 12.5],
    [" 7 ", 7],
    ["", null],
    [null, null],
    [undefined, null],
    ["abc", null],
    [NaN, null],
    [Infinity, null],
    [{}, null],
  ])("%p → %p", (input, expected) => {
    expect(toNumber(input)).toBe(expected);
  });
});

describe("formatCurrency", () => {
  it("TL biçiminde formatlar", () => {
    expect(n(formatCurrency(1234.5))).toBe("₺1.234,50");
    expect(n(formatCurrency("1234.5"))).toBe("₺1.234,50");
  });

  it("0 gerçek bir değerdir, gizlenmez", () => {
    expect(n(formatCurrency(0))).toBe("₺0,00");
  });

  it("değer yoksa uydurma rakam yerine — döner", () => {
    expect(formatCurrency(null)).toBe("—");
    expect(formatCurrency(undefined)).toBe("—");
    expect(formatCurrency("geçersiz")).toBe("—");
  });

  it("negatif değerleri korur", () => {
    expect(n(formatCurrency(-50))).toContain("50,00");
    expect(formatCurrency(-50)).toContain("-");
  });
});

describe("formatCurrencyCompact", () => {
  it("küçük değerlerde tam format kullanır", () => {
    expect(n(formatCurrencyCompact(9999))).toBe("₺9.999,00");
  });
  it("büyük değerlerde kompakt format kullanır", () => {
    expect(formatCurrencyCompact(1_250_000)).toMatch(/^₺1,3/);
  });
});

describe("diğer formatlar", () => {
  it("formatInteger", () => {
    expect(formatInteger(12345)).toBe("12.345");
    expect(formatInteger(null)).toBe("—");
  });
  it("formatQuantity gereksiz sıfır göstermez", () => {
    expect(formatQuantity("12.500")).toBe("12,5");
    expect(formatQuantity(3)).toBe("3");
  });
  it("formatPercent", () => {
    expect(formatPercent(12.345)).toBe("%12,3");
  });
});

describe("parseDecimal (Türkçe ondalık girişi)", () => {
  it.each([
    ["12,5", 12.5],
    ["12.5", 12.5],
    ["1.234,50", 1234.5],
    ["1,234.50", 1234.5],
    ["1.234", 1234],
    ["1.234.567", 1234567],
    ["0,05", 0.05],
    ["-3,25", -3.25],
    ["₺ 45,90", 45.9],
    ["100", 100],
  ])("%p → %p", (input, expected) => {
    expect(parseDecimal(input)).toBeCloseTo(expected as number);
  });

  it.each(["", "  ", "abc", "12,5,3", "1.23.4", "12a", null, undefined])("geçersiz giriş %p → null", (input) => {
    expect(parseDecimal(input as string)).toBeNull();
  });
});

describe("toApiDecimal / percentChange", () => {
  it("float hassasiyet sorunu olmadan string üretir", () => {
    expect(toApiDecimal(0.1 + 0.2)).toBe("0.30");
    expect(toApiDecimal(12.5)).toBe("12.50");
  });
  it("percentChange", () => {
    expect(percentChange(150, 100)).toBe(50);
    expect(percentChange(50, 100)).toBe(-50);
    expect(percentChange(10, 0)).toBeNull();
    expect(percentChange(10, null)).toBeNull();
  });
});

describe("formatCurrencyAxis", () => {
  it("kısa eksen etiketleri üretir", () => {
    expect(formatCurrencyAxis(500)).toBe("₺500");
    expect(formatCurrencyAxis(1000).replace(/\s/g, " ")).toMatch(/^₺1 B$/);
    expect(formatCurrencyAxis(1500).replace(/\s/g, " ")).toMatch(/^₺1,5 B$/);
    expect(formatCurrencyAxis(null)).toBe("—");
  });
});
