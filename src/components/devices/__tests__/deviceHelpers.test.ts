import {
  fillInfo,
  isKnownMachineType,
  machineTypeLabel,
  operatingModeOf,
  presetRange,
  priceManagementLabel,
  ptTypeLabel,
  revenueColumnForSort,
  scheduleFromDetail,
  scheduleToWrite,
  slotFill,
  isValidHHMM,
} from "@/components/devices/deviceHelpers";
import { toApiDate } from "@/utils/date";

describe("makine tipi (pos_odemetip / machine_type)", () => {
  it("0 = Snack, 1 = Kahve; diğer/boş değerler varsayılan tipe DÜŞMEZ", () => {
    expect(machineTypeLabel(0)).toBe("Snack");
    expect(machineTypeLabel(1)).toBe("Kahve");
    expect(machineTypeLabel("1")).toBe("Kahve");
    expect(machineTypeLabel(2)).toBe("—");
    expect(machineTypeLabel(null)).toBe("—");
    expect(machineTypeLabel(undefined)).toBe("—");
    expect(isKnownMachineType(0)).toBe(true);
    expect(isKnownMachineType(2)).toBe(false);
  });

  it("fiyat yönetimi 0/1/2 ve ödeme türü etiketleri (0–10)", () => {
    expect(priceManagementLabel(0)).toBe("Otomattan al");
    expect(priceManagementLabel(2)).toBe("Sadece sunucu");
    expect(priceManagementLabel(3)).toBe("—");
    expect(ptTypeLabel(0)).toBe("Nakit");
    expect(ptTypeLabel(9)).toBe("VennexSelf");
    expect(ptTypeLabel(10)).toBe("TokenFlex");
    expect(ptTypeLabel(42)).toBe("Tür 42");
  });
});

describe("doluluk", () => {
  it("fill_rate yoksa veya pct null ise '—' gösterir, uydurmaz", () => {
    expect(fillInfo(null)).toEqual({ pct: null, tone: "neutral", label: "—", detail: null });
    expect(fillInfo({ pct: null, qty: 0, max: 0 }).label).toBe("—");
  });

  it("yüzdeye göre ton ve etiket; 0–100 aralığına kırpar", () => {
    expect(fillInfo({ pct: 12, qty: 3, max: 25 })).toMatchObject({ pct: 12, tone: "danger", label: "%12", detail: "3 / 25" });
    expect(fillInfo({ pct: 40, qty: 4, max: 10 }).tone).toBe("warning");
    expect(fillInfo({ pct: 130, qty: 13, max: 10 }).pct).toBe(100);
    expect(slotFill({ quantity: 5, max_quantity: 10 }).label).toBe("%50");
    expect(slotFill({ quantity: 5, max_quantity: 0 }).pct).toBeNull();
  });
});

describe("liste ciro sütunu sıralamayı takip eder", () => {
  it.each([
    ["default", "today_revenue"],
    ["fill_rate_desc", "today_revenue"],
    ["yesterday_revenue_asc", "yesterday_revenue"],
    ["this_month_revenue_desc", "this_month_revenue"],
    ["last_month_revenue_desc", "last_month_revenue"],
  ] as const)("%s → %s", (sort, key) => {
    expect(revenueColumnForSort(sort).key).toBe(key);
  });
});

describe("çalışma saatleri dönüşümü", () => {
  it("okuma (monday..) → yazma ('0'..'6'), boş günler atlanır", () => {
    const detail = {
      operating_hours_mode: 2,
      operating_hours: { mode: "non_working", schedule: { monday: [{ start: "00:00", end: "06:00" }], sunday: [{ start: "12:00", end: "13:00" }] } },
    };
    const week = scheduleFromDetail(detail);
    expect(week).toHaveLength(7);
    expect(week[0]).toEqual([{ start: "00:00", end: "06:00" }]);
    expect(scheduleToWrite(week)).toEqual({ "0": [{ start: "00:00", end: "06:00" }], "6": [{ start: "12:00", end: "13:00" }] });
    expect(operatingModeOf(detail)).toBe(2);
    expect(operatingModeOf({ operating_hours_mode: null, operating_hours: { mode: "working", schedule: {} } })).toBe(1);
    expect(operatingModeOf({ operating_hours_mode: null, operating_hours: null })).toBe(0);
  });

  it("SS:DD doğrulaması", () => {
    expect(isValidHHMM("08:30")).toBe(true);
    expect(isValidHHMM("24:00")).toBe(false);
    expect(isValidHHMM("8:30")).toBe(false);
  });
});

describe("tarih ön ayarları", () => {
  it("yerel gün aralıkları", () => {
    const now = new Date(2026, 10, 18, 15, 0);
    expect(toApiDate(presetRange("today", now).start)).toBe("2026-11-18");
    expect(toApiDate(presetRange("yesterday", now).end)).toBe("2026-11-17");
    expect(toApiDate(presetRange("last7", now).start)).toBe("2026-11-12");
    expect(toApiDate(presetRange("this_month", now).start)).toBe("2026-11-01");
  });
});
