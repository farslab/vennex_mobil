import MockAdapter from "axios-mock-adapter";
import { apiClient } from "@/api/client";
import { devicesApi } from "@/api/devices";
import { templatesApi } from "@/api/templates";

describe("devicesApi", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => mock.restore());

  it("liste: page_size GÖNDERMEZ, boş/varsayılan parametreleri atar, boolean'ları string yapar", async () => {
    mock.onGet("/pos-devices/").reply(200, { count: 0, page: 1, num_pages: 1, results: [] });

    await devicesApi.list({ page: 2, page_size: 50, q: "  kahve ", online: false, machine_type: 0, sort_by: "default", location_ids: [9, 3] });

    const params = mock.history.get[0].params;
    expect(params).toEqual({ page: 2, q: "kahve", online: "false", machine_type: 0, location_ids: "3,9" });
    expect(params).not.toHaveProperty("page_size");
    expect(params).not.toHaveProperty("sort_by");
  });

  it("liste: sort_by backend anahtarıyla gider; satırlar ve sayaçlar normalize edilir", async () => {
    mock.onGet("/pos-devices/").reply(200, {
      count: 2,
      page: 1,
      num_pages: 1,
      page_size: 25,
      online_count: 1,
      offline_count: 1,
      total_count: 2,
      results: [
        { sn: "A1", pos_name: "Otomat", stat: true, online: true, today_revenue: "125.50", today_tx_count: 4, fill_rate: { pct: 40, qty: 4, max: 10 }, sort_order: 2 },
        { sn: "B2", pos_name: null, stat: false, online: false, fill_rate: null },
        { pos_name: "SN'siz satır atılır" },
      ],
    });

    const res = await devicesApi.list({ sort_by: "fill_rate_asc" });

    expect(mock.history.get[0].params).toEqual({ page: 1, sort_by: "fill_rate_asc" });
    expect(res.online_count).toBe(1);
    expect(res.total_count).toBe(2);
    expect(res.results).toHaveLength(2);
    expect(res.results[0]).toMatchObject({ sn: "A1", today_revenue: 125.5, fill_rate: { pct: 40, qty: 4, max: 10 }, sort_order: 2 });
    // eksik alanlara UYDURMA değer yazılmaz
    expect(res.results[1]).toMatchObject({ sn: "B2", today_revenue: null, today_tx_count: null, fill_rate: null, last_seen: null });
  });

  it("işlemler: filtre parametreleri ve summary normalizasyonu; tutar string korunur", async () => {
    mock.onGet("/pos-devices/SN%201/transactions/").reply(200, {
      count: 1,
      page: 1,
      num_pages: 3,
      page_size: 50,
      summary: { total: 10, success: 8, failed: 2, revenue: 300.5 },
      results: [{ id: 7, amount: "25.00", status: false, iptalNo: 2, pt_type: 1, pt_pan: "" }],
    });

    const res = await devicesApi.transactions("SN 1", {
      page: 2,
      start_date: "2026-11-01",
      end_date: "2026-11-18",
      tx_status: "fail",
      pt_type: 0,
      card_last4: "",
    });

    expect(mock.history.get[0].params).toEqual({
      page: 2,
      start_date: "2026-11-01",
      end_date: "2026-11-18",
      tx_status: "fail",
      pt_type: 0,
    });
    expect(res.summary).toEqual({ total: 10, success: 8, failed: 2, revenue: 300.5 });
    expect(res.num_pages).toBe(3);
    expect(res.results[0]).toMatchObject({ id: 7, amount: "25.00", status: false, iptalNo: 2, pt_pan: null });
  });

  it("ürünler: kapasite yoksa pct null kalır, mod korunur", async () => {
    mock.onGet("/pos-devices/X/products/").reply(200, {
      mode: "stock",
      items: [{ id: 1, urun_no: null, is_wildcard: true, price: "10.00", quantity: 0, max_quantity: 0, stock_sku: 5, stock_sku_name: "Su" }],
      fill: { qty: 0, max: 0, pct: null },
    });
    const res = await devicesApi.products("X");
    expect(res.mode).toBe("stock");
    expect(res.fill).toEqual({ qty: 0, max: 0, pct: null });
    expect(res.items[0]).toMatchObject({ is_wildcard: true, urun_no: null, price: "10.00", stock_sku: 5 });
  });

  it("ayarlar PATCH: gövde aynen gider, _warnings okunur", async () => {
    mock.onPatch("/pos-devices/X/").reply(200, { sn: "X", pos_odemetip: 1, _warnings: ["machine_type_id atlandı"] });
    const res = await devicesApi.updateSettings("X", { pos_odemetip: 1, price_management: 2 });
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ pos_odemetip: 1, price_management: 2 });
    expect(res._warnings).toEqual(["machine_type_id atlandı"]);
    expect(res.sales_visible).toBeUndefined();
  });

  it("nakit toplama: not yoksa boş gövde; tutar number", async () => {
    mock.onPost("/pos-devices/X/collect-cash/").reply(200, { detail: "ok", amount_collected: 150.25 });
    const res = await devicesApi.collectCash("X", "   ");
    expect(JSON.parse(mock.history.post[0].data)).toEqual({});
    expect(res.amount_collected).toBe(150.25);
  });

  it("dolum: kaynak lokasyon yalnız verildiğinde gönderilir", async () => {
    mock.onPost("/pos-devices/X/fill-all-stock/").reply(200, { detail: "3 slot dolduruldu.", filled_count: 3 });
    mock.onPost("/pos-devices/X/products/bulk-quantities/").reply(200, { detail: "1", updated_count: 1 });
    await devicesApi.fillAllStock("X", null);
    await devicesApi.bulkQuantities("X", [{ slot_id: 4, quantity: 9 }], 12);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({});
    expect(JSON.parse(mock.history.post[1].data)).toEqual({ source_location_id: 12, updates: [{ slot_id: 4, quantity: 9 }] });
  });

  it("SKU seçici: q parametresi gider, bileşen (ingredient) türü elenir", async () => {
    mock.onGet("/stock/skus/").reply(200, {
      results: [
        { id: 1, name: "Su", kind: "simple" },
        { id: 2, name: "Süt tozu", kind: "ingredient" },
        { id: 3, name: "Latte", kind: "composite" },
      ],
    });
    const res = await devicesApi.skus(" su ");
    expect(mock.history.get[0].params).toEqual({ q: "su" });
    expect(res.map((s) => s.id)).toEqual([1, 3]);
  });

  it("kaynak lokasyonlar: yalnız aktif depo/araç/ara depo", async () => {
    mock.onGet("/stock/locations/").reply(200, {
      results: [
        { id: 1, name: "Depo", location_type: "warehouse", is_active: true },
        { id: 2, name: "Otomat", location_type: "vending_machine", is_active: true },
        { id: 3, name: "Araç", location_type: "vehicle", is_active: false },
      ],
    });
    expect((await devicesApi.sourceLocations()).map((l) => l.id)).toEqual([1]);
  });
});

describe("templatesApi", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => mock.restore());

  it("liste {results} zarfını açar ve makine tipini 0/1 olarak normalize eder", async () => {
    mock.onGet("/product-templates/").reply(200, {
      results: [{ id: 3, name: "Kahve", machine_type: 1, item_count: 4, assigned_device_count: 2 }],
    });
    const res = await templatesApi.list();
    expect(res).toEqual([
      expect.objectContaining({ id: 3, machine_type: 1, item_count: 4, assigned_device_count: 2, description: null }),
    ]);
  });

  it("kalem ekleme TEK obje gönderir ({items:[…]} değil)", async () => {
    mock.onPost("/product-templates/5/items/").reply(201, { id: 9, price: "12.50", name: "Su" });
    const payload = { urun_no: 3, is_wildcard: false, stock_sku: 7, price: "12.50", max_quantity: 8, quantity: 0 };
    const item = await templatesApi.createItem(5, payload);
    const body = JSON.parse(mock.history.post[0].data);
    expect(body).toEqual(payload);
    expect(body).not.toHaveProperty("items");
    expect(item).toMatchObject({ id: 9, price: "12.50" });
  });

  it("kalem PATCH/DELETE doğru uca gider; atama sonucu type_mismatch taşır", async () => {
    mock.onPatch("/product-templates/5/items/9/").reply(200, { id: 9 });
    mock.onDelete("/product-templates/5/items/9/").reply(204);
    mock.onPost("/product-templates/5/assign/").reply(200, { detail: "1 cihaza eşlendi.", assigned_count: 1, type_mismatch: ["Otomat 2"] });
    await templatesApi.updateItem(5, 9, { urun_no: 1, is_wildcard: false, name: "Su", price: "10.00", max_quantity: 5, quantity: 0 });
    await templatesApi.deleteItem(5, 9);
    const res = await templatesApi.assignDevices(5, ["A", "B"]);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ device_sns: ["A", "B"] });
    expect(res).toEqual({ detail: "1 cihaza eşlendi.", assigned_count: 1, type_mismatch: ["Otomat 2"] });
    expect(mock.history.delete).toHaveLength(1);
  });
});
