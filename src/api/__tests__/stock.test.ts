import MockAdapter from "axios-mock-adapter";
import { apiClient, type ApiError } from "@/api/client";
import {
  buildMovementRequest,
  movementDirection,
  normalizeInventoryRow,
  normalizeMovement,
  normalizeQuantity,
  normalizeSku,
  stockApi,
  toApiQuantity,
  validateMovementInput,
} from "@/api/stock";

describe("stock normalizer'ları", () => {
  it("QuantityField miktarını int/float/string olarak kabul eder, geçersizde null döner", () => {
    expect(normalizeQuantity(5)).toBe(5);
    expect(normalizeQuantity(641.8)).toBe(641.8);
    expect(normalizeQuantity("12.500")).toBe(12.5);
    expect(normalizeQuantity(-2)).toBe(-2);
    expect(normalizeQuantity(null)).toBeNull();
    expect(normalizeQuantity("abc")).toBeNull();
  });

  it("envanter satırında sözleşmedeki `sku` alanını okur (sku_id değil)", () => {
    const row = normalizeInventoryRow({
      id: 9,
      sku: 42,
      sku_name: "Çekirdek Kahve",
      sku_code: "BIL-KHV",
      location: 3,
      location_type: "vehicle",
      quantity: 850.25,
    });
    expect(row).toMatchObject({ id: 9, sku: 42, location: 3, quantity: 850.25, location_type: "vehicle" });
  });

  it("eski şema `sku_id` yalnız yedek olarak okunur", () => {
    expect(normalizeInventoryRow({ id: 1, sku_id: 7, quantity: 3 }).sku).toBe(7);
    expect(normalizeInventoryRow({ id: 1, sku: 8, sku_id: 7, quantity: 3 }).sku).toBe(8);
  });

  it("SKU para alanlarını string olarak korur, package_size'ı sayıya çevirir", () => {
    const s = normalizeSku({ id: 1, name: "Su", sku_code: "SU", unit_cost: "4.50", sale_price: "10.00", vat_rate: "20.00", kind: "simple", base_unit: "piece", package_size: 24 });
    expect(s).toMatchObject({ unit_cost: "4.50", sale_price: "10.00", vat_rate: "20.00", package_size: 24, base_unit: "piece" });
    expect(normalizeSku({ id: 2, kind: "bilinmeyen", base_unit: "kg" })).toMatchObject({ kind: "simple", base_unit: "piece" });
  });

  it("hareket satırında Flutter alias'larına düşer ve miktarı mutlak alır", () => {
    const m = normalizeMovement({ id: 5, type: "adjustment", sku: 3, from_location: 1, to_location: null, from_name: "Depo", quantity: "4", datetime: "2026-11-18T10:00:00Z" });
    expect(m).toMatchObject({ movement_type: "adjustment", from_location_name: "Depo", quantity: 4, created_at: "2026-11-18T10:00:00Z" });
  });

  it("hareket yönünü tipe/lokasyona göre doğru işaretler", () => {
    expect(movementDirection({ from_location: null, to_location: 2 })).toBe(1); // giriş
    expect(movementDirection({ from_location: 2, to_location: null })).toBe(-1); // düzeltme çıkışı / tüketim
    expect(movementDirection({ from_location: 1, to_location: 2 })).toBe(0); // transfer
    expect(movementDirection({ from_location: 1, to_location: 2 }, 2)).toBe(1);
    expect(movementDirection({ from_location: 1, to_location: 2 }, 1)).toBe(-1);
  });
});

describe("hareket gövdeleri ve istemci doğrulaması", () => {
  it("miktarı birime göre ondalık string'e çevirir", () => {
    expect(toApiQuantity(24, "piece")).toBe("24");
    expect(toApiQuantity(12.5, "gram")).toBe("12.500");
    expect(toApiQuantity(-3, "piece")).toBe("-3");
  });

  it("transfer gövdesi backend TransferSerializer anahtarlarını kullanır", () => {
    expect(
      buildMovementRequest({ type: "transfer", from_location_id: 1, to_location_id: 2, sku_id: 9, quantity: 1250.5, unit: "gram" })
    ).toEqual({ url: "/stock/transfers/", body: { from_location_id: 1, to_location_id: 2, sku_id: 9, quantity: "1250.500" } });
  });

  it("düzeltme negatif miktar ve kırpılmış açıklama gönderir; boş açıklamayı göndermez", () => {
    expect(buildMovementRequest({ type: "adjustment", location_id: 4, sku_id: 1, quantity: -3, reason: "  fire ", unit: "piece" })).toEqual({
      url: "/stock/adjustments/",
      body: { location_id: 4, sku_id: 1, quantity: "-3", reason: "fire" },
    });
    expect(buildMovementRequest({ type: "adjustment", location_id: 4, sku_id: 1, quantity: 2, reason: "  ", unit: "piece" }).body).not.toHaveProperty("reason");
  });

  it("aynı lokasyonlar arası transferi reddeder", () => {
    expect(
      validateMovementInput({ type: "transfer", from_location_id: 3, to_location_id: 3, sku_id: 1, quantity: 5, unit: "piece" })
    ).toEqual({ to_location_id: "Kaynak ve hedef lokasyon aynı olamaz." });
  });

  it("adet bazlı üründe kesirli, transfer/girişte sıfır veya negatif miktarı reddeder", () => {
    expect(validateMovementInput({ type: "receipt", to_location_id: 1, sku_id: 1, quantity: 1.5, unit: "piece" })?.quantity).toBe(
      "Adet bazlı üründe kesirli miktar girilemez."
    );
    expect(validateMovementInput({ type: "receipt", to_location_id: 1, sku_id: 1, quantity: -1, unit: "gram" })?.quantity).toBe("Miktar pozitif olmalı.");
    expect(validateMovementInput({ type: "adjustment", location_id: 1, sku_id: 1, quantity: 0, unit: "gram" })?.quantity).toBe(
      "Miktar sıfırdan farklı olmalı."
    );
    expect(validateMovementInput({ type: "receipt", to_location_id: 1, sku_id: 1, quantity: 0.0005, unit: "gram" })?.quantity).toBe(
      "En fazla 3 ondalık hane girilebilir."
    );
    expect(validateMovementInput({ type: "adjustment", location_id: 1, sku_id: 1, quantity: -2.25, unit: "ml" })).toBeNull();
  });
});

describe("stockApi HTTP", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => mock.restore());

  it("overview satırlarını normalize eder", async () => {
    mock.onGet("/stock/overview/").reply(200, { results: [{ sku_id: 3, sku_name: "Kola", sku_code: "K", total: 12.0 }] });
    await expect(stockApi.overview()).resolves.toEqual([{ sku_id: 3, sku_name: "Kola", sku_code: "K", total: 12 }]);
  });

  it("lokasyon listesinde active_only yalnız false iken gönderilir", async () => {
    mock.onGet("/stock/locations/").reply(200, { results: [] });
    await stockApi.locations.list();
    await stockApi.locations.list({ active_only: false, location_type: "vehicle" });
    expect(mock.history.get[0].params).toEqual({ active_only: undefined, location_type: undefined });
    expect(mock.history.get[1].params).toEqual({ active_only: "false", location_type: "vehicle" });
  });

  it("SKU aramasını q ve stockable ile sunucuya iletir", async () => {
    mock.onGet("/stock/skus/").reply(200, { results: [{ id: 1, name: "Kahve", sku_code: "K", kind: "ingredient", base_unit: "gram" }] });
    const res = await stockApi.skus.list({ q: "  kahve ", stockable: true });
    expect(mock.history.get[0].params).toEqual({ q: "kahve", stockable: "true", active_only: undefined });
    expect(res[0]).toMatchObject({ id: 1, base_unit: "gram" });
  });

  it("envanter yanıtındaki lokasyon başlığını ve satırları döndürür", async () => {
    mock.onGet("/stock/locations/7/inventory/").reply(200, {
      location: { id: 7, name: "Araç 1", location_type: "vehicle", is_active: true, pos_device: null },
      results: [{ id: 1, sku: 4, sku_name: "Su", sku_code: "SU", location: 7, quantity: 10 }],
    });
    const d = await stockApi.locations.inventoryDetail(7);
    expect(d.location).toMatchObject({ id: 7, location_type: "vehicle" });
    expect(d.results[0]).toMatchObject({ sku: 4, quantity: 10 });
  });

  it("birleşik hareket listesini type ve page ile çeker", async () => {
    mock.onGet("/stock/movements/").reply(200, { count: 30, page: 2, num_pages: 2, results: [{ id: 1, movement_type: "receipt", sku: 1, to_location: 1, quantity: 5 }] });
    const page = await stockApi.movements.list({ type: "receipt", page: 2 });
    expect(mock.history.get[0].params).toEqual({ type: "receipt", page: 2 });
    expect(page).toMatchObject({ count: 30, page: 2, num_pages: 2 });
    expect(page.results[0].quantity).toBe(5);
  });

  it("lokasyon hareketleri 25'lik sayfa için yalnız page gönderir", async () => {
    mock.onGet("/stock/locations/3/movements/").reply(200, { count: 0, page: 1, num_pages: 1, results: [] });
    await stockApi.locations.movements(3, 1);
    expect(mock.history.get[0].params).toEqual({ page: 1 });
  });

  it("transferi tipe özel uca string miktarla gönderir", async () => {
    mock.onPost("/stock/transfers/").reply(201, { id: 99, movement_type: "transfer", sku: 9, from_location: 1, to_location: 2, quantity: 24 });
    const res = await stockApi.movements.create({ type: "transfer", from_location_id: 1, to_location_id: 2, sku_id: 9, quantity: 24, unit: "piece" });
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ from_location_id: 1, to_location_id: 2, sku_id: 9, quantity: "24" });
    expect(res.id).toBe(99);
  });

  it("stok girişi ve düzeltme gövdeleri", async () => {
    mock.onPost("/stock/receipts/").reply(201, { id: 1 });
    mock.onPost("/stock/adjustments/").reply(201, { id: 2 });
    await stockApi.movements.create({ type: "receipt", to_location_id: 5, sku_id: 2, quantity: 2.5, unit: "ml" });
    await stockApi.movements.create({ type: "adjustment", location_id: 5, sku_id: 2, quantity: -1, reason: "Sayım", unit: "piece" });
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ to_location_id: 5, sku_id: 2, quantity: "2.500" });
    expect(JSON.parse(mock.history.post[1].data)).toEqual({ location_id: 5, sku_id: 2, quantity: "-1", reason: "Sayım" });
  });

  it("geçersiz girişte istek atmadan alan hatasıyla reddeder", async () => {
    await expect(
      stockApi.movements.create({ type: "transfer", from_location_id: 2, to_location_id: 2, sku_id: 1, quantity: 1, unit: "piece" })
    ).rejects.toMatchObject({ fieldErrors: { to_location_id: "Kaynak ve hedef lokasyon aynı olamaz." } } as Partial<ApiError>);
    expect(mock.history.post).toHaveLength(0);
  });

  it("backend 400 detail mesajını iletir", async () => {
    mock.onPost("/stock/transfers/").reply(400, { detail: "Yetersiz stok. Mevcut: 3" });
    await expect(
      stockApi.movements.create({ type: "transfer", from_location_id: 1, to_location_id: 2, sku_id: 1, quantity: 5, unit: "piece" })
    ).rejects.toThrow("Yetersiz stok. Mevcut: 3");
  });

  it("SKU oluşturma gövdesini olduğu gibi POST eder ve sync-vending sonucunu okur", async () => {
    mock.onPost("/stock/skus/").reply(201, { id: 5, name: "Yeni", sku_code: "Y", kind: "simple", base_unit: "piece", unit_cost: "1.00" });
    mock.onPost("/stock/locations/sync-vending/").reply(200, { detail: "Senkronizasyon tamamlandı.", created: 2, updated: 1 });
    await stockApi.skus.create({ name: "Yeni", sku_code: "Y", unit_cost: "1.00", vat_rate: "20.00", kind: "simple", base_unit: "piece" });
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ name: "Yeni", sku_code: "Y", unit_cost: "1.00", vat_rate: "20.00", kind: "simple", base_unit: "piece" });
    await expect(stockApi.locations.syncVending()).resolves.toEqual({ detail: "Senkronizasyon tamamlandı.", created: 2, updated: 1 });
  });
});
