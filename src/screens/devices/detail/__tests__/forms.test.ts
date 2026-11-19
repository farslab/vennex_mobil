import { buildSettingsPatch, formFromDetail } from "@/screens/devices/detail/settingsForm";
import { buildProductPayload, type SlotFormState } from "@/screens/devices/detail/components/SlotFormSheet";
import { validateBulk } from "@/screens/devices/detail/components/BulkQuantitiesSheet";
import { fillAllEstimate } from "@/screens/devices/detail/tabs/StockTab";
import { toTransactionFilters, type SalesFilterState } from "@/screens/devices/detail/tabs/SalesTab";
import { resolveStatsRange } from "@/screens/devices/detail/components/StatsPeriodFilter";
import { normalizeDeviceDetail } from "@/api/devices";
import type { PosProduct } from "@/types/devices";

const detail = normalizeDeviceDetail({
  sn: "S1",
  pos_name: "Otomat 1",
  stat: true,
  pos_odemetip: 0,
  price_management: 0,
  pos_updprd: 5,
  sales_notification_enabled: false,
  sales_notification_interval: 60,
  operating_hours_mode: 0,
  operating_hours: null,
  payment_methods: { chip: true, qrcode: false },
  device_toggles: { audio: true },
  timeouts: { vend_timeout: 60, pos_timeout: 30, pos_eod: "23:30" },
});

describe("ayarlar PATCH gövdesi", () => {
  it("değişiklik yoksa boş gövde", () => {
    const base = formFromDetail(detail);
    expect(buildSettingsPatch(base, { ...base })).toEqual({ patch: {}, errors: {} });
  });

  it("Snack/Kahve 0/1, fiyat yönetimi 0/1/2 kodlarıyla; salt okunur alanlar asla gönderilmez", () => {
    const base = formFromDetail(detail);
    const { patch, errors } = buildSettingsPatch(base, {
      ...base,
      pos_odemetip: 1,
      price_management: 2,
      payment_methods: { ...base.payment_methods, qrcode: true },
    });
    expect(errors).toEqual({});
    expect(patch).toEqual({ pos_odemetip: 1, price_management: 2, payment_methods: { qrcode: true } });
    expect(patch).not.toHaveProperty("pos_updprd");
    expect(patch).not.toHaveProperty("timeouts");
  });

  it("Snack seçimi 0 gönderir (1 değil)", () => {
    const kahve = formFromDetail({ ...detail, pos_odemetip: 1 });
    expect(buildSettingsPatch(kahve, { ...kahve, pos_odemetip: 0 }).patch).toEqual({ pos_odemetip: 0 });
  });

  it("alan doğrulama: ad boş/30+, aralık < 1, geçersiz ödeme tipi", () => {
    const base = formFromDetail(detail);
    const { patch, errors } = buildSettingsPatch(base, {
      ...base,
      pos_name: " ",
      sales_notification_interval: "0",
      pos_odemetip: 5,
    });
    expect(patch).toEqual({});
    expect(Object.keys(errors).sort()).toEqual(["pos_name", "pos_odemetip", "sales_notification_interval"]);
    expect(buildSettingsPatch(base, { ...base, pos_name: "x".repeat(31) }).errors.pos_name).toBeTruthy();
  });

  it("çalışma saatleri: mode + '0'..'6' anahtarlı schedule (replace)", () => {
    const base = formFromDetail(detail);
    const week = base.oh_week.map(() => [] as { start: string; end: string }[]);
    week[0] = [{ start: "08:00", end: "18:00" }];
    week[4] = [{ start: "09:00", end: "12:00" }];
    expect(buildSettingsPatch(base, { ...base, oh_mode: 1, oh_week: week }).patch).toEqual({
      operating_hours: { mode: 1, schedule: { "0": [{ start: "08:00", end: "18:00" }], "4": [{ start: "09:00", end: "12:00" }] } },
    });
    week[1] = [{ start: "8", end: "" }];
    expect(buildSettingsPatch(base, { ...base, oh_mode: 1, oh_week: week }).errors.operating_hours).toBeTruthy();
  });
});

const slotForm = (o: Partial<SlotFormState> = {}): SlotFormState => ({
  urunNo: "3",
  wildcard: false,
  skuId: 7,
  skuName: "Su",
  name: "",
  price: "12,5",
  quantity: "0",
  maxQuantity: "10",
  ...o,
});

describe("slot / ürün payload", () => {
  it("stok modu: stock_sku_id + '12.50' fiyat; wildcard'da urun_no null", () => {
    expect(buildProductPayload("stock", slotForm()).payload).toEqual({
      urun_no: 3,
      is_wildcard: false,
      stock_sku_id: 7,
      price: "12.50",
      max_quantity: 10,
    });
    expect(buildProductPayload("stock", slotForm({ wildcard: true, urunNo: "" })).payload).toMatchObject({ urun_no: null, is_wildcard: true });
  });

  it("stok modu: SKU ve fiyat zorunlu", () => {
    const { payload, errors } = buildProductPayload("stock", slotForm({ skuId: null, price: "abc" }));
    expect(payload).toBeNull();
    expect(errors).toHaveProperty("stock_sku_id");
    expect(errors).toHaveProperty("price");
  });

  it("normal mod: ad zorunlu, miktar gönderilir", () => {
    expect(buildProductPayload("normal", slotForm({ name: "Kek", quantity: "4" })).payload).toEqual({
      urun_no: 3,
      name: "Kek",
      price: "12.50",
      quantity: 4,
      max_quantity: 10,
    });
    expect(buildProductPayload("normal", slotForm()).errors).toHaveProperty("name");
  });
});

const slot = (id: number, quantity: number, max: number, sku: number | null = 1): PosProduct => ({
  id,
  urun_no: id,
  is_wildcard: false,
  name: null,
  price: "10.00",
  quantity,
  max_quantity: max,
  stock_sku: sku,
  stock_sku_name: `SKU ${id}`,
  stock_sku_code: null,
});

describe("toplu dolum doğrulaması", () => {
  it("değişmeyenleri atlar, mevcuttan düşük ve kapasite üstü değerleri reddeder", () => {
    const items = [slot(1, 3, 10), slot(2, 5, 8), slot(3, 2, 6)];
    const { updates, errors } = validateBulk(items, { 1: "10", 2: "4", 3: "2" });
    expect(updates).toEqual([{ slot_id: 1, quantity: 10 }]);
    expect(errors).toEqual({ 2: "En az 5" });
    expect(validateBulk(items, { 3: "7" }).errors).toEqual({ 3: "En fazla 6" });
  });

  it("tümünü doldur tahmini: SKU'lu ve eksik slotlar", () => {
    expect(fillAllEstimate([slot(1, 3, 10), slot(2, 8, 8), slot(3, 0, 5, null)])).toEqual({ slots: 1, units: 7 });
  });
});

describe("satış filtreleri", () => {
  const base: SalesFilterState = {
    preset: "today",
    customStart: null,
    customEnd: null,
    status: "all",
    ptType: null,
    cancelReason: null,
    cardLast4: "",
  };
  const now = new Date(2026, 10, 18, 10);

  it("tarih her zaman açıkça gönderilir; boş filtreler gönderilmez", () => {
    expect(toTransactionFilters(base, "", now)).toEqual({
      start_date: "2026-11-18",
      end_date: "2026-11-18",
      tx_status: undefined,
      pt_type: undefined,
      cancel_reason: undefined,
      card_last4: undefined,
    });
  });

  it("hızlı seçimler web/İstatistikler ile aynı: Bu Hafta pazartesiden, Geçen Ay tam ay", () => {
    // 18.11.2026 çarşamba
    expect(toTransactionFilters({ ...base, preset: "this_week" }, "", now)).toMatchObject({ start_date: "2026-11-16", end_date: "2026-11-18" });
    expect(toTransactionFilters({ ...base, preset: "this_month" }, "", now)).toMatchObject({ start_date: "2026-11-01", end_date: "2026-11-18" });
    expect(toTransactionFilters({ ...base, preset: "last_month" }, "", now)).toMatchObject({ start_date: "2026-10-01", end_date: "2026-10-31" });
    expect(toTransactionFilters({ ...base, preset: "yesterday" }, "", now)).toMatchObject({ start_date: "2026-11-17", end_date: "2026-11-17" });
    expect(
      toTransactionFilters({ ...base, preset: "custom", customStart: new Date(2026, 9, 3), customEnd: new Date(2026, 9, 9) }, "", now)
    ).toMatchObject({ start_date: "2026-10-03", end_date: "2026-10-09" });
  });

  it("'Bugün' sorgu anında hesaplanır: gece yarısından sonra yeni güne geçer (TR saati)", () => {
    const beforeMidnight = new Date("2026-11-18T20:59:00Z"); // TR 23:59
    const afterMidnight = new Date("2026-11-18T21:01:00Z"); // TR 00:01 (19.11)
    expect(toTransactionFilters(base, "", beforeMidnight)).toMatchObject({ start_date: "2026-11-18", end_date: "2026-11-18" });
    expect(toTransactionFilters(base, "", afterMidnight)).toMatchObject({ start_date: "2026-11-19", end_date: "2026-11-19" });
    expect(resolveStatsRange({ preset: "today", range: { start: "2026-11-18", end: "2026-11-18" } }, afterMidnight)).toEqual({ start: "2026-11-19", end: "2026-11-19" });
    // özel aralık saklandığı gibi kalır
    expect(resolveStatsRange({ preset: "custom", range: { start: "2026-10-01", end: "2026-10-02" } }, afterMidnight)).toEqual({ start: "2026-10-01", end: "2026-10-02" });
  });

  it("hata nedeni yalnız başarısız durumda; kart son 4 yalnız 4 hane ise", () => {
    expect(toTransactionFilters({ ...base, status: "fail", cancelReason: "2", ptType: 0 }, "1234", now)).toMatchObject({
      tx_status: "fail",
      cancel_reason: "2",
      pt_type: 0,
      card_last4: "1234",
    });
    expect(toTransactionFilters({ ...base, status: "success", cancelReason: "2" }, "12", now)).toMatchObject({
      tx_status: "success",
      cancel_reason: undefined,
      card_last4: undefined,
    });
  });
});
