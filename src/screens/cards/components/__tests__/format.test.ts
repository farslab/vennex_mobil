import {
  balanceEffectText,
  canReverseUid,
  cardUid,
  normalizeProductNo,
  projectBalances,
  reversedUid,
  validateAmount,
  validatePositiveInt,
} from "../format";

describe("kart format yardımcıları", () => {
  it("kart numarası (UID) web gibi açık ve tam gösterilir", () => {
    expect(cardUid("04 A2 3B 1C")).toBe("04 A2 3B 1C");
    expect(cardUid(" ABCDEF1234 ")).toBe("ABCDEF1234");
    expect(cardUid("")).toBe("—");
    expect(cardUid(null)).toBe("—");
  });

  it("ters UID yalnız çok parçalı UID'de", () => {
    expect(canReverseUid("04 A2 3B")).toBe(true);
    expect(canReverseUid("04A23B")).toBe(false);
    expect(reversedUid("04 A2 3B")).toBe("3B A2 04");
  });

  it("validateAmount Türkçe girişleri ve sınırları doğrular", () => {
    expect(validateAmount("12,5")).toEqual({ value: 12.5 });
    expect(validateAmount("1.234,50")).toEqual({ value: 1234.5 });
    expect(validateAmount("0")).toHaveProperty("error");
    expect(validateAmount("0", { allowZero: true })).toEqual({ value: 0 });
    expect(validateAmount("-5")).toHaveProperty("error");
    expect(validateAmount("abc")).toHaveProperty("error");
    expect(validateAmount("1,234")).toHaveProperty("error");
    expect(validateAmount("100000000")).toHaveProperty("error");
  });

  it("validatePositiveInt", () => {
    expect(validatePositiveInt("3")).toEqual({ value: 3 });
    expect(validatePositiveInt("0")).toHaveProperty("error");
    expect(validatePositiveInt("2.5")).toHaveProperty("error");
  });

  it("normalizeProductNo backend biçimini uygular", () => {
    expect(normalizeProductNo("")).toEqual({ value: "*" });
    expect(normalizeProductNo(" 1, 2 ,20-40 ")).toEqual({ value: "1,2,20-40" });
    expect(normalizeProductNo("40-20")).toHaveProperty("error");
    expect(normalizeProductNo("a1")).toHaveProperty("error");
  });

  it("projectBalances backend kuralını (düşmede taban 0) uygular", () => {
    const cards = [{ balance: "10.00" }, { balance: 50 }];
    expect(projectBalances(cards, "add", 5)).toEqual({ before: 60, after: 70 });
    expect(projectBalances(cards, "subtract", 20)).toEqual({ before: 60, after: 30 });
    expect(projectBalances(cards, "set", 25)).toEqual({ before: 60, after: 50 });
  });

  it("balanceEffectText kart sayısına göre metin üretir", () => {
    expect(balanceEffectText("add", 5, 3)).toContain("3 kartın");
    expect(balanceEffectText("subtract", 5, 1)).toContain("0'ın altına inmez");
  });
});
