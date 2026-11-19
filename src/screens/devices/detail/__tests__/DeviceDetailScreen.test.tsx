import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { makeUser, renderWithProviders } from "@/test/utils";
import DeviceDetailScreen from "@/screens/devices/detail/DeviceDetailScreen";
import type { RootScreenProps } from "@/navigation/types";
import type { Permission } from "@/auth/permissions";

const mockPreventRemove = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), dispatch: jest.fn() }),
  usePreventRemove: (...args: unknown[]) => mockPreventRemove(...args),
}));

const SN = "PAV1";
const navigation = { setOptions: jest.fn(), navigate: jest.fn(), goBack: jest.fn() };
const props = { route: { key: "k", name: "DeviceDetail", params: { sn: SN } }, navigation } as unknown as RootScreenProps<"DeviceDetail">;

const detailBody = (o: Record<string, unknown> = {}) => ({
  sn: SN,
  pos_name: "Lobi Otomatı",
  stat: true,
  is_online: true,
  last_seen: new Date().toISOString(),
  company: { id: 10, name: "Test Şirketi" },
  location: { id: 3, name: "Lobi" },
  machine_type: { id: 1, name: "Spiral" },
  act_vmc: "Crane",
  act_vmcsn: "VMC-1",
  act_macstat: 1,
  act_sim_pw: 21,
  app_vers: "3.5.0",
  tp_vers: "2.1.0",
  pos_odemetip: 0,
  price_management: 0,
  pos_updprd: 5,
  sales_notification_enabled: false,
  sales_notification_interval: 60,
  operating_hours_mode: 0,
  payment_methods: { chip: true, contactless: true, qrcode: false },
  device_toggles: { audio: true, auto_select: false },
  commands: { and_reset: false, eod_trig: false, mdb_reset: false, apk_reset: false },
  operating_hours: null,
  timeouts: { vend_timeout: 60, pos_timeout: 30, pos_eod: "23:30" },
  sales_visible: true,
  permissions: { manage_device_settings: true, manage_stock: true },
  ...o,
});

const productsBody = {
  mode: "stock",
  items: [
    { id: 11, urun_no: 1, is_wildcard: false, price: "15.00", quantity: 3, max_quantity: 10, stock_sku: 7, stock_sku_name: "Su", stock_sku_code: "SU-1" },
    { id: 12, urun_no: 2, is_wildcard: false, price: "20.00", quantity: 8, max_quantity: 8, stock_sku: 8, stock_sku_name: "Kola", stock_sku_code: "KL-1" },
  ],
  fill: { qty: 11, max: 18, pct: 61 },
};

function setUser(perms: Permission[], role: "owner" | "tech" = "owner") {
  useAuthStore.setState({ user: makeUser({ role, permissions: perms }), selectedCompanyId: 10 });
}

describe("DeviceDetailScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    navigation.setOptions.mockReset();
    mock.onGet(`/pos-devices/${SN}/products/`).reply(200, productsBody);
    mock.onGet(`/pos-devices/${SN}/cash-history/`).reply(200, { results: [] });
    mock.onGet(`/pos-devices/${SN}/revenue-counts/`).reply(200, { results: [] });
  });
  afterEach(() => mock.restore());

  it("Genel: gerçek detay + özet verisini gösterir, başlığı setOptions ile verir", async () => {
    setUser(["owner", "view_sales", "manage_device_settings"]);
    mock.onGet(`/pos-devices/${SN}/`).reply(200, detailBody());
    mock.onGet(`/pos-devices/${SN}/summary/`).reply(200, {
      today: { revenue: 250.5, count: 7 },
      yesterday: { revenue: 100, count: 3 },
      this_month: { revenue: 4000, count: 120 },
      last_month: { revenue: 3500, count: 110 },
    });

    await renderWithProviders(<DeviceDetailScreen {...props} />);

    expect(await screen.findByText("₺250,50")).toBeOnTheScreen();
    expect(screen.getByText("7 işlem")).toBeOnTheScreen();
    expect(screen.getByText("Crane")).toBeOnTheScreen();
    expect(screen.getByTestId("general-fill-pct")).toHaveTextContent("%61");
    expect(screen.getAllByText("Snack").length).toBeGreaterThan(0);
    expect(navigation.setOptions).toHaveBeenCalledWith({ title: "Lobi Otomatı" });
    // tüm sekmeler görünür
    for (const t of ["Genel", "Nakit & Ciro", "Satışlar", "Stok", "İstatistikler", "Ayarlar"]) expect(screen.getByText(t)).toBeOnTheScreen();
  });

  it("eksik alanlarda yedek sayı göstermez; view_sales yoksa özet istenmez ve satış sekmeleri gizlenir", async () => {
    setUser(["tech"], "tech");
    mock.onGet(`/pos-devices/${SN}/`).reply(200, {
      sn: SN,
      pos_name: null,
      stat: true,
      is_online: null,
      last_seen: null,
      payment_methods: null,
      sales_visible: false,
      permissions: { manage_device_settings: false, manage_stock: false },
    });
    mock.onGet(`/pos-devices/${SN}/products/`).reply(200, { mode: "normal", items: [], fill: { qty: 0, max: 0, pct: null } });

    await renderWithProviders(<DeviceDetailScreen {...props} />);

    expect(await screen.findByText("Bu cihazda tanımlı ürün/slot yok.")).toBeOnTheScreen();
    expect(screen.getByText("Ödeme yöntemi bilgisi yok.")).toBeOnTheScreen();
    expect(screen.queryByText("Ciro özeti")).toBeNull();
    expect(screen.queryByText(/₺/)).toBeNull();
    expect(screen.getAllByText("—").length).toBeGreaterThan(3);
    expect(screen.queryByText("Satışlar")).toBeNull();
    // Web: teknisyen nakit panelini görür (tutarlar gizli)
    expect(screen.getByText("Nakit & Ciro")).toBeOnTheScreen();
    expect(screen.queryByText("İstatistikler")).toBeNull();
    expect(mock.history.get.some((r) => r.url?.endsWith("/summary/"))).toBe(false);
    expect(navigation.setOptions).toHaveBeenCalledWith({ title: SN });
  });

  it("Nakit topla: onay sayfası özet gösterir, onayda POST collect-cash; bekleyen tutar uydurulmaz", async () => {
    setUser(["owner", "view_sales", "manage_device_settings"]);
    mock.onGet(`/pos-devices/${SN}/`).reply(200, detailBody());
    mock.onGet(`/pos-devices/${SN}/summary/`).reply(200, {});
    mock.onPost(`/pos-devices/${SN}/collect-cash/`).reply(200, { detail: "ok", amount_collected: 320 });

    await renderWithProviders(<DeviceDetailScreen {...props} />);
    await fireEvent.press(await screen.findByText("Nakit & Ciro"));
    await fireEvent.press(await screen.findByTestId("collect-cash-button"));

    expect(await screen.findByText("Nakit toplama")).toBeOnTheScreen();
    expect(screen.getByText("Sunucu hesaplar")).toBeOnTheScreen();
    expect(screen.getByText("Bu işlem geri alınamaz.")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);

    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(mock.history.post[0].url).toBe(`/pos-devices/${SN}/collect-cash/`);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({});
  });

  it("Nakit topla: 400 hatası onay sayfasında gösterilir", async () => {
    setUser(["owner", "view_sales", "manage_device_settings"]);
    mock.onGet(`/pos-devices/${SN}/`).reply(200, detailBody());
    mock.onGet(`/pos-devices/${SN}/summary/`).reply(200, {});
    mock.onPost(`/pos-devices/${SN}/collect-cash/`).reply(400, { detail: "Toplanacak nakit bulunmamaktadır." });

    await renderWithProviders(<DeviceDetailScreen {...props} />);
    await fireEvent.press(await screen.findByText("Nakit & Ciro"));
    await fireEvent.press(await screen.findByTestId("collect-cash-button"));
    await fireEvent.press(await screen.findByTestId("confirm-sheet-confirm"));

    expect(await screen.findByText("Toplanacak nakit bulunmamaktadır.")).toBeOnTheScreen();
  });

  it("Satışlar: özet yanıttaki summary'den, satır detayı açılır", async () => {
    setUser(["owner", "view_sales"]);
    mock.onGet(`/pos-devices/${SN}/`).reply(200, detailBody());
    mock.onGet(`/pos-devices/${SN}/summary/`).reply(200, {});
    mock.onGet(`/pos-devices/${SN}/transactions/`).reply(200, {
      count: 1,
      page: 1,
      num_pages: 1,
      page_size: 50,
      summary: { total: 9, success: 8, failed: 1, revenue: 412.5 },
      results: [{ id: 5, pt_id: "TX5", pt_datetime: "2026-11-18T08:15:00Z", amount: "12.50", pt_type: 1, status: true, iptalNo: 0, product_no: 4, pt_pan: "5400********1234", bankRefNo: "BR1", display_name: "Su" }],
    });

    await renderWithProviders(<DeviceDetailScreen {...props} />);
    await fireEvent.press(await screen.findByText("Satışlar"));

    const summary = await screen.findByTestId("sales-summary");
    await waitFor(() => expect(within(summary).getByText("₺412,50")).toBeOnTheScreen());
    expect(within(summary).getByText("9")).toBeOnTheScreen();
    const req = mock.history.get.find((r) => r.url === `/pos-devices/${SN}/transactions/`);
    expect(req?.params).toMatchObject({ page: 1, start_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
    expect(req?.params).not.toHaveProperty("page_size");

    await fireEvent.press(screen.getByTestId("tx-row-5"));
    expect(await screen.findByText("İşlem detayı")).toBeOnTheScreen();
    expect(screen.getByText("BR1")).toBeOnTheScreen();
  });

  it("Ayarlar: yalnız değişen alanlar doğru kodlarla PATCH edilir ve _warnings gösterilir", async () => {
    setUser(["owner", "manage_device_settings"]);
    mock.onGet(`/pos-devices/${SN}/`).reply(200, detailBody());
    mock.onGet("/overview/locations/").reply(200, { results: [{ id: 3, name: "Lobi" }] });
    mock.onPatch(`/pos-devices/${SN}/`).reply(200, { ...detailBody({ pos_odemetip: 1 }), _warnings: ["machine_type_id atlandı: select_machine_type izni yok."] });

    await renderWithProviders(<DeviceDetailScreen {...props} />);
    await fireEvent.press(await screen.findByText("Ayarlar"));
    await fireEvent.press(within(screen.getByTestId("settings-odemetip")).getByText("Kahve"));
    await fireEvent.changeText(screen.getByTestId("settings-interval"), "15");
    await fireEvent.press(screen.getByTestId("settings-save"));

    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ pos_odemetip: 1, sales_notification_interval: 15 });
    expect(await screen.findByText("Bazı değişiklikler uygulanmadı")).toBeOnTheScreen();
    expect(screen.getByText("machine_type_id atlandı: select_machine_type izni yok.")).toBeOnTheScreen();
  });

  it("cihaz ayarı yetkisi yoksa Ayarlar sekmesi hiç yok (web `pos_device_detail.html:53`)", async () => {
    setUser(["owner", "view_sales"]);
    mock.onGet(`/pos-devices/${SN}/`).reply(200, detailBody({ permissions: { manage_device_settings: false, manage_stock: false } }));
    mock.onGet(`/pos-devices/${SN}/summary/`).reply(200, {});

    await renderWithProviders(<DeviceDetailScreen {...props} />);
    expect(await screen.findByText("Genel")).toBeOnTheScreen();
    expect(screen.queryByText("Ayarlar")).toBeNull();
    expect(screen.queryByTestId("command-eod_trig")).toBeNull();
  });

  it("send_device_commands tek başına komut göstermez; komutlar cihaz ayarı yetkisi ister (web)", async () => {
    setUser(["tech", "send_device_commands"]);
    mock.onGet(`/pos-devices/${SN}/`).reply(200, detailBody({ permissions: { manage_device_settings: false, manage_stock: false } }));
    mock.onGet(`/pos-devices/${SN}/summary/`).reply(200, {});

    await renderWithProviders(<DeviceDetailScreen {...props} />);
    expect(await screen.findByText("Genel")).toBeOnTheScreen();
    expect(screen.queryByText("Ayarlar")).toBeNull();
    expect(screen.queryByTestId("command-eod_trig")).toBeNull();
  });

  it("Ayarlar: gün sonu komutu onay sayfası arkasında, PATCH {commands:{eod_trig:true}}", async () => {
    // Web: komutlar Ayarlar sekmesinde, cihaz ayarı yetkisiyle
    setUser(["owner", "manage_device_settings", "send_device_commands"]);
    mock.onGet(`/pos-devices/${SN}/`).reply(200, detailBody());
    mock.onGet("/overview/locations/").reply(200, { results: [] });
    mock.onPatch(`/pos-devices/${SN}/`).reply(200, detailBody({ commands: { eod_trig: true } }));

    await renderWithProviders(<DeviceDetailScreen {...props} />);
    await fireEvent.press(await screen.findByText("Ayarlar"));
    await fireEvent.press(await screen.findByTestId("command-eod_trig"));

    expect(await screen.findByText(/banka gün sonu \(EOD\)/)).toBeOnTheScreen();
    expect(screen.getByText("Bu işlem geri alınamaz.")).toBeOnTheScreen();
    expect(mock.history.patch).toHaveLength(0);
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ commands: { eod_trig: true } });
  });

  it("Stok: tümünü doldur onaylı; teknisyen varsayılan kaynakla boş gövde gönderir", async () => {
    setUser(["tech", "manage_stock"], "tech");
    mock.onGet(`/pos-devices/${SN}/`).reply(200, detailBody({ sales_visible: false, permissions: { manage_device_settings: false, manage_stock: true } }));
    mock.onGet("/stock/locations/").reply(200, { results: [{ id: 4, name: "Ana Depo", location_type: "warehouse", is_active: true }] });
    mock.onPost(`/pos-devices/${SN}/fill-all-stock/`).reply(200, { detail: "1 slot dolduruldu.", filled_count: 1 });

    await renderWithProviders(<DeviceDetailScreen {...props} />);
    await fireEvent.press(await screen.findByText("Stok"));
    expect(await screen.findByText("Su")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("fill-all-button"));

    expect(await screen.findByText("Dolacak slot (tahmini)")).toBeOnTheScreen();
    expect(screen.getByText("7 adet")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({});
    // şablon işlemleri manage_device_settings ister
    expect(screen.queryByTestId("assign-template-button")).toBeNull();
  });

  const renderStockWithTemplate = async (template: unknown) => {
    setUser(["owner", "manage_stock", "manage_device_settings"]);
    mock.resetHandlers();
    mock.onGet(`/pos-devices/${SN}/`).reply(200, detailBody());
    mock.onGet("/stock/locations/").reply(200, { results: [] });
    mock.onGet(`/pos-devices/${SN}/products/`).reply(200, { ...productsBody, template });
    await renderWithProviders(<DeviceDetailScreen {...props} />);
    await fireEvent.press(await screen.findByText("Stok"));
  };

  it("Stok/şablon: eşli cihazda şablon adı ve yalnız 'Eşlemeyi kaldır' (web kuralı)", async () => {
    await renderStockWithTemplate({ id: 3, name: "Kahve Şablonu" });
    expect(await screen.findByTestId("mapped-template")).toHaveTextContent("Bu cihaz Kahve Şablonu şablonuna eşli.");
    expect(screen.getByTestId("unassign-template-button")).toBeOnTheScreen();
    expect(screen.queryByTestId("assign-template-button")).toBeNull();
    expect(screen.queryByTestId("save-as-template-button")).toBeNull();
    expect(screen.queryByText(/API/)).toBeNull();
  });

  it("Stok/şablon: eşli değilken 'Şablon ata' ve 'Şablon olarak kaydet', 'Eşlemeyi kaldır' yok (web kuralı)", async () => {
    await renderStockWithTemplate(null);
    expect(await screen.findByTestId("mapped-template-none")).toBeOnTheScreen();
    expect(screen.getByTestId("assign-template-button")).toBeOnTheScreen();
    expect(screen.getByTestId("save-as-template-button")).toBeOnTheScreen();
    expect(screen.queryByTestId("unassign-template-button")).toBeNull();
  });

  it("Stok: owner kaynak lokasyon seçmeden dolum yapamaz; slot silme onay ister", async () => {
    setUser(["owner", "manage_stock", "manage_device_settings"]);
    mock.onGet(`/pos-devices/${SN}/`).reply(200, detailBody({ sales_visible: false }));
    mock.onGet("/stock/locations/").reply(200, { results: [{ id: 4, name: "Ana Depo", location_type: "warehouse", is_active: true }] });
    mock.onDelete(`/pos-devices/${SN}/products/11/`).reply(204);

    await renderWithProviders(<DeviceDetailScreen {...props} />);
    await fireEvent.press(await screen.findByText("Stok"));
    expect(await screen.findByText("Dolum için önce kaynak lokasyon seçin.")).toBeOnTheScreen();
    expect(screen.getByTestId("fill-all-button")).toBeDisabled();

    await fireEvent.press(screen.getByTestId("slot-row-11"));
    await fireEvent.press(await screen.findByText("Sil"));
    expect(await screen.findByText("Silinsin mi?")).toBeOnTheScreen();
    expect(mock.history.delete).toHaveLength(0);
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.delete).toHaveLength(1));
  });

  it("404'te anlaşılır hata", async () => {
    setUser(["owner"]);
    mock.onGet(`/pos-devices/${SN}/`).reply(404, { detail: "Bulunamadı." });
    await renderWithProviders(<DeviceDetailScreen {...props} />);
    expect(await screen.findByText("Cihaz bulunamadı")).toBeOnTheScreen();
  });
});
