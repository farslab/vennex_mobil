import {
  daysBetweenInclusive,
  formatDate,
  formatDateTime,
  formatRelative,
  parseApiDate,
  parseUserDate,
  toApiDate,
} from "@/utils/date";
import { fullName, initials, normalizeForSearch } from "@/utils/text";

describe("tarih yardımcıları", () => {
  it("toApiDate yerel günü verir (UTC kayması yok)", () => {
    expect(toApiDate(new Date(2026, 0, 1, 0, 30))).toBe("2026-01-01");
    expect(toApiDate(new Date(2026, 11, 31, 23, 59))).toBe("2026-12-31");
  });

  it.each([
    ["25.08.2026", [2026, 7, 25]],
    ["5.8.2026", [2026, 7, 5]],
    ["2026-08-25", [2026, 7, 25]],
    ["25/08/2026", [2026, 7, 25]],
  ])("parseUserDate(%p)", (input, [y, m, d]) => {
    const date = parseUserDate(input)!;
    expect([date.getFullYear(), date.getMonth(), date.getDate()]).toEqual([y, m, d]);
  });

  it.each(["31.02.2026", "2026-13-01", "abc", "", "25.08.26", null])("geçersiz tarih %p → null", (input) => {
    expect(parseUserDate(input as string)).toBeNull();
  });

  it("formatDate / formatDateTime", () => {
    const d = new Date(2026, 10, 18, 9, 5);
    expect(formatDate(d)).toBe("18.11.2026");
    expect(formatDateTime(d)).toBe("18.11.2026 09:05");
    expect(formatDate(null)).toBe("—");
    expect(formatDate("geçersiz")).toBe("—");
  });

  it("parseApiDate geçersiz değerde null", () => {
    expect(parseApiDate("not-a-date")).toBeNull();
    expect(parseApiDate("2026-11-18T10:00:00Z")).toBeInstanceOf(Date);
  });

  it("formatRelative", () => {
    const now = new Date(2026, 10, 18, 12, 0, 0);
    expect(formatRelative(new Date(2026, 10, 18, 11, 59, 30), now)).toBe("az önce");
    expect(formatRelative(new Date(2026, 10, 18, 11, 55), now)).toBe("5 dk önce");
    expect(formatRelative(new Date(2026, 10, 18, 9, 0), now)).toBe("3 sa önce");
    expect(formatRelative(new Date(2026, 10, 16, 12, 0), now)).toBe("2 gün önce");
    expect(formatRelative(new Date(2026, 5, 1), now)).toBe("01.06.2026");
    expect(formatRelative(null, now)).toBe("—");
  });

  it("daysBetweenInclusive", () => {
    expect(daysBetweenInclusive(new Date(2026, 0, 1), new Date(2026, 0, 1))).toBe(1);
    expect(daysBetweenInclusive(new Date(2026, 0, 1), new Date(2026, 0, 31))).toBe(31);
  });
});

describe("metin yardımcıları", () => {
  it("normalizeForSearch Türkçe karakterleri eşler", () => {
    expect(normalizeForSearch("İSTANBUL Çay  Şeker")).toBe("istanbul cay seker");
    expect(normalizeForSearch("ığüşöç")).toBe("igusoc");
    expect(normalizeForSearch(null)).toBe("");
  });

  it("fullName ve initials", () => {
    expect(fullName("Ali", " ")).toBe("Ali");
    expect(fullName(null, "Veli")).toBe("Veli");
    expect(initials("ali veli yılmaz")).toBe("AY");
    expect(initials("ışık")).toBe("IŞ");
    expect(initials("")).toBe("?");
  });
});
