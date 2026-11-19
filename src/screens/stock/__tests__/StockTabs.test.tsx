import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { canManageStock } from "@/auth/permissions";
import { useToastStore } from "@/design-system";
import { makeUser, renderWithProviders } from "@/test/utils";
import type { AuthUser } from "@/types/auth";
import { OverviewTab } from "@/screens/stock/tabs/OverviewTab";
import { SkusTab } from "@/screens/stock/tabs/SkusTab";
import { LocationsTab } from "@/screens/stock/tabs/LocationsTab";
import { MovementsTab } from "@/screens/stock/tabs/MovementsTab";
import { inventory, locations, movement, skus } from "./fixtures";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), setOptions: jest.fn() }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));

type Reply = [number, unknown];

function deferred(reply: Reply) {
  let release: () => void = () => {};
  const promise = new Promise<Reply>((resolve) => {
    release = () => resolve(reply);
  });
  return { promise, release: () => release() };
}

const getCalls = (mock: MockAdapter, url: string) => mock.history.get.filter((r) => r.url === url);

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
  mockNavigate.mockReset();
  useToastStore.setState({ current: null });
});
afterEach(() => mock.restore());

/* ------------------------------------------------------------------ Özet */

describe("OverviewTab", () => {
  const sugar = { ...skus[1], id: 4, name: "Toz Şeker", sku_code: "BIL-SKR" };
  const rows = [
    { sku_id: 1, sku_name: "Su 500 ml", sku_code: "SU-500", total: 1200 },
    { sku_id: 2, sku_name: "Çekirdek Kahve", sku_code: "BIL-KHV", total: 2500.5 },
    { sku_id: 4, sku_name: "Toz Şeker", sku_code: "BIL-SKR", total: 0 },
    { sku_id: 9, sku_name: "Gazoz", sku_code: "GAZ", total: -3 },
  ];

  beforeEach(() => {
    mock.onGet("/stock/skus/").reply(200, { results: [...skus, sugar] });
    mock.onGet(/\/stock\/locations\/\d+\/inventory\//).reply((cfg) => [200, inventory(Number(/locations\/(\d+)\//.exec(cfg.url ?? "")?.[1]))]);
  });

  it("yüklenirken iskelet ve '—' sayaçları gösterir; overview ve SKU dizinini birer kez çeker", async () => {
    const d = deferred([200, { results: rows }]);
    mock.onGet("/stock/overview/").reply(() => d.promise);
    await renderWithProviders(<OverviewTab />);

    expect(screen.getByLabelText("Yükleniyor")).toBeOnTheScreen();
    expect(screen.getByLabelText("Ürün: —")).toBeOnTheScreen();
    d.release();

    expect(await screen.findByLabelText("Ürün: 4")).toBeOnTheScreen();
    expect(getCalls(mock, "/stock/overview/")).toHaveLength(1);
    const skuCalls = getCalls(mock, "/stock/skus/");
    expect(skuCalls).toHaveLength(1);
    expect(skuCalls[0].params).toEqual({ q: undefined, stockable: undefined, active_only: undefined });
  });

  it("toplamları Türkçe sayı biçimi ve birimle eşler; sayaç ve rozetleri hesaplar", async () => {
    mock.onGet("/stock/overview/").reply(200, { results: rows });
    await renderWithProviders(<OverviewTab />);

    expect(await screen.findByText("1.200 adet")).toBeOnTheScreen();
    expect(screen.getByText("2.500,5 g")).toBeOnTheScreen();
    expect(screen.getByText("0 g")).toBeOnTheScreen();
    expect(screen.getByText("-3")).toBeOnTheScreen(); // birimi bilinmeyen ürün → yalnız sayı
    expect(screen.getByLabelText("Tükenen: 1")).toBeOnTheScreen();
    expect(screen.getByLabelText("Negatif: 1")).toBeOnTheScreen();
    expect(screen.getByText("Tükenen (1)")).toBeOnTheScreen();
    expect(screen.getByText("Negatif (1)")).toBeOnTheScreen();
    expect(screen.getByLabelText("Toz Şeker, BIL-SKR, toplam 0 g, Tükendi")).toBeOnTheScreen();
    expect(screen.getByLabelText("Gazoz, GAZ, toplam -3, Negatif")).toBeOnTheScreen();
    expect(screen.getByLabelText("Su 500 ml, SU-500, toplam 1.200 adet")).toBeOnTheScreen();
  });

  it("aramayı istemcide, Türkçe karakter duyarsız uygular (yeni istek yok)", async () => {
    mock.onGet("/stock/overview/").reply(200, { results: rows });
    await renderWithProviders(<OverviewTab />);
    await screen.findByText("Gazoz");

    await fireEvent.changeText(screen.getByTestId("overview-search"), "cekirdek");
    expect(screen.getByText("Çekirdek Kahve")).toBeOnTheScreen();
    expect(screen.queryByText("Gazoz")).toBeNull();

    await fireEvent.changeText(screen.getByTestId("overview-search"), "ŞEKER");
    expect(screen.getByText("Toz Şeker")).toBeOnTheScreen();
    expect(screen.queryByText("Çekirdek Kahve")).toBeNull();

    await fireEvent.changeText(screen.getByTestId("overview-search"), "su-500");
    expect(screen.getByText("Su 500 ml")).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId("overview-search"), "yokboyle");
    expect(screen.getByText("Sonuç yok")).toBeOnTheScreen();
    expect(getCalls(mock, "/stock/overview/")).toHaveLength(1);
  });

  it("Tükenen ve Negatif filtreleri yalnız ilgili satırları bırakır", async () => {
    mock.onGet("/stock/overview/").reply(200, { results: rows });
    await renderWithProviders(<OverviewTab />);
    await screen.findByText("Gazoz");

    await fireEvent.press(screen.getByText("Tükenen (1)"));
    expect(screen.getByText("Toz Şeker")).toBeOnTheScreen();
    expect(screen.queryByText("Gazoz")).toBeNull();
    expect(screen.queryByText("Su 500 ml")).toBeNull();

    await fireEvent.press(screen.getByText("Negatif (1)"));
    expect(screen.getByText("Gazoz")).toBeOnTheScreen();
    expect(screen.queryByText("Toz Şeker")).toBeNull();

    await fireEvent.press(screen.getByText("Tümü"));
    expect(screen.getByText("Su 500 ml")).toBeOnTheScreen();
  });

  it("hata gövdesinde detay yoksa durum koduna göre Türkçe mesaj gösterir ve tekrar dener", async () => {
    mock.onGet("/stock/overview/").replyOnce(403, {});
    mock.onGet("/stock/overview/").reply(200, { results: [] });
    await renderWithProviders(<OverviewTab />);

    expect(await screen.findByText("Bu işlem için yetkiniz yok.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Tekrar dene"));
    expect(await screen.findByText("Stok kaydı yok")).toBeOnTheScreen();
    expect(getCalls(mock, "/stock/overview/")).toHaveLength(2);
  });

  it("dağılım paneli açılıp kapanır; bakiyesiz üründe bilgi notu gösterir", async () => {
    mock.onGet("/stock/overview/").reply(200, { results: rows });
    mock.onGet("/stock/locations/").reply(200, { results: locations });
    await renderWithProviders(<OverviewTab />);

    const row = await screen.findByTestId("overview-row-4");
    expect(row).toBeCollapsed();
    await fireEvent.press(row);
    expect(screen.getByTestId("overview-row-4")).toBeExpanded();
    const panel = await screen.findByTestId("breakdown-4");
    expect(within(panel).getByText("Hiçbir lokasyonda bakiye yok.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("overview-row-4"));
    expect(screen.queryByTestId("breakdown-4")).toBeNull();
  });

  it("dağılım yüklenemezse panel içinde hata ve tekrar dene gösterir", async () => {
    mock.onGet("/stock/overview/").reply(200, { results: rows });
    mock.onGet("/stock/locations/").replyOnce(500, { detail: "Lokasyonlar alınamadı." });
    mock.onGet("/stock/locations/").reply(200, { results: locations });
    await renderWithProviders(<OverviewTab />);

    await fireEvent.press(await screen.findByTestId("overview-row-2"));
    expect(await screen.findByText("Lokasyonlar alınamadı.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Tekrar dene"));

    const panel = await screen.findByTestId("breakdown-2");
    expect(within(panel).getByText("Merkez Depo")).toBeOnTheScreen();
    expect(within(panel).getByText("2.500,5 g")).toBeOnTheScreen();
    expect(within(panel).queryByText("Otomatlar ve pasif lokasyonlar")).toBeNull(); // fark 0
  });
});

/* -------------------------------------------------------------- Ürünler */

describe("SkusTab", () => {
  it("sunucu aramayı kestiyse (ilk 50) uyarı gösterir ve tür sayılarını göstermez (yanlış sayı olmasın)", async () => {
    mock.onGet("/stock/skus/").reply(200, { results: skus, truncated: true });
    await renderWithProviders(<SkusTab canManage />);
    expect(await screen.findByText(/ilk 50 ürün gösteriliyor/)).toBeOnTheScreen();
    expect(screen.queryByText("Ürün (1)")).toBeNull();
    expect(screen.getAllByText("Ürün").length).toBeGreaterThan(0);
  });

  it("satırları Türkçe para/yüzde biçimi, birim ve tür rozetiyle eşler", async () => {
    mock.onGet("/stock/skus/").reply(200, { results: skus });
    await renderWithProviders(<SkusTab canManage />);

    expect(await screen.findByText("Adet · 24'lü koli · Alış ₺4,50 · KDV %20")).toBeOnTheScreen();
    expect(screen.getByText("SU-500 · 8690001")).toBeOnTheScreen();
    expect(screen.getByText("₺10,00")).toBeOnTheScreen();
    // Bileşen: satış fiyatı yok, rozet birimi gösterir
    expect(screen.getByText("Gram · 1 kg · Alış ₺0,62 · KDV %10")).toBeOnTheScreen();
    expect(screen.getByText("Bileşen · g")).toBeOnTheScreen();
    expect(screen.getByLabelText("Çekirdek Kahve, BIL-KHV, Bileşen")).toBeOnTheScreen();
    // Reçeteli: alış maliyeti gösterilmez
    expect(screen.getByText("Adet · KDV %10")).toBeOnTheScreen();
    expect(screen.getByLabelText("Latte, SC-LTE, Reçeteli Ürün, satış ₺45,00")).toBeOnTheScreen();
    expect(screen.getByText("Ürün (1)")).toBeOnTheScreen();
    expect(screen.getByText("Reçeteli Ürün (1)")).toBeOnTheScreen();
    expect(screen.getByText("Bileşen (1)")).toBeOnTheScreen();

    const calls = getCalls(mock, "/stock/skus/");
    expect(calls).toHaveLength(1);
    expect(calls[0].params?.q).toBeUndefined();
  });

  it("boş katalogda 'Ürün ekle' formu açar; yetkisizde aksiyon yok", async () => {
    mock.onGet("/stock/skus/").reply(200, { results: [] });
    const { unmount } = await renderWithProviders(<SkusTab canManage />);
    expect(await screen.findByText("Henüz ürün yok")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Ürün ekle"));
    expect(await screen.findByText("Yeni ürün")).toBeOnTheScreen();
    await unmount();

    await renderWithProviders(<SkusTab canManage={false} />);
    expect(await screen.findByText("Henüz ürün yok")).toBeOnTheScreen();
    expect(screen.queryByText("Ürün ekle")).toBeNull();
    expect(screen.queryByTestId("sku-new")).toBeNull();
  });

  it("aramada sonuç yoksa arama boş durumunu gösterir", async () => {
    mock.onGet("/stock/skus/").reply((cfg) => [200, { results: cfg.params?.q ? [] : skus }]);
    await renderWithProviders(<SkusTab canManage />);
    await screen.findByText("Latte");

    await fireEvent.changeText(screen.getByTestId("sku-search"), "  zzz  ");
    expect(await screen.findByText("Ürün bulunamadı", {}, { timeout: 2000 })).toBeOnTheScreen();
    expect(getCalls(mock, "/stock/skus/").some((r) => r.params?.q === "zzz")).toBe(true); // kırpılarak gönderilir
  });

  it("hata durumunda mesaj ve tekrar dene; arama kutusu korunur", async () => {
    mock.onGet("/stock/skus/").replyOnce(500, { detail: "Ürünler alınamadı." });
    mock.onGet("/stock/skus/").reply(200, { results: skus });
    await renderWithProviders(<SkusTab canManage />);

    expect(await screen.findByText("Ürünler alınamadı.")).toBeOnTheScreen();
    expect(screen.getByTestId("sku-search")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Tekrar dene"));
    expect(await screen.findByText("Latte")).toBeOnTheScreen();
  });

  it("satıra basınca düzenleme formu kayıtlı değerlerle açılır", async () => {
    mock.onGet("/stock/skus/").reply(200, { results: skus });
    await renderWithProviders(<SkusTab canManage />);
    await fireEvent.press(await screen.findByTestId("sku-row-2"));

    expect(await screen.findByText("Ürünü düzenle")).toBeOnTheScreen();
    expect(screen.getByTestId("sku-name").props.value).toBe("Çekirdek Kahve");
    expect(screen.getByTestId("sku-unit")).toHaveProp("accessibilityLabel", "Birim: Gram");
    expect(screen.getByTestId("sku-unit")).not.toBeDisabled();
    expect(screen.getByTestId("sku-package-size").props.value).toBe("1000");
    expect(screen.getByTestId("sku-unit-cost").props.value).toBe("0,62");
  });

  it("yetkisiz kullanıcıda satırlar düzenlemeye açılmaz, form mount edilmez", async () => {
    mock.onGet("/stock/skus/").reply(200, { results: skus });
    await renderWithProviders(<SkusTab canManage={false} />);
    expect(await screen.findByLabelText("Su 500 ml, SU-500, Ürün, satış ₺10,00")).toBeOnTheScreen();
    expect(screen.queryByTestId("sku-row-1")).toBeNull();
    expect(screen.queryByTestId("sku-form")).toBeNull();
  });
});

/* ----------------------------------------------------------- Lokasyonlar */

describe("LocationsTab", () => {
  const inactive = { id: 5, name: "Eski Depo", location_type: "warehouse", location_type_display: "Ana Depo", is_active: false, pos_device: null, pos_device_sn: null };

  const replyLocations = () =>
    mock.onGet("/stock/locations/").reply((cfg) => {
      const all = cfg.params?.active_only === "false" ? [...locations, inactive] : locations;
      return [200, { results: all.filter((l) => !cfg.params?.location_type || l.location_type === cfg.params.location_type) }];
    });

  it("varsayılan olarak yalnız aktifleri ister; otomatta cihaz seri numarasını gösterir", async () => {
    replyLocations();
    await renderWithProviders(<LocationsTab canManage />);

    expect(await screen.findByText("Otomat Kampüs")).toBeOnTheScreen();
    expect(screen.getByText("· VX-T-1")).toBeOnTheScreen();
    expect(screen.getByLabelText("Otomat Kampüs, Otomat, cihaz VX-T-1")).toBeOnTheScreen();
    expect(screen.queryByText("Pasif")).toBeNull();
    const calls = getCalls(mock, "/stock/locations/");
    expect(calls).toHaveLength(1);
    expect(calls[0].params).toEqual({ active_only: undefined, location_type: undefined });
  });

  it("'Pasifleri göster' active_only=false gönderir ve pasif rozetini gösterir", async () => {
    replyLocations();
    await renderWithProviders(<LocationsTab canManage />);
    await screen.findByText("Merkez Depo");

    await fireEvent.press(screen.getByText("Pasifleri göster"));
    expect(await screen.findByText("Eski Depo")).toBeOnTheScreen();
    expect(screen.getByText("Pasif")).toBeOnTheScreen();
    expect(screen.getByLabelText("Eski Depo, Ana Depo, pasif")).toBeOnTheScreen();
    expect(getCalls(mock, "/stock/locations/").some((r) => r.params?.active_only === "false")).toBe(true);
  });

  it("boş listede filtreye göre farklı açıklama gösterir", async () => {
    mock.onGet("/stock/locations/").reply(200, { results: [] });
    await renderWithProviders(<LocationsTab canManage />);
    expect(await screen.findByText("Depo, ara depo veya araç ekleyin; otomatlar senkronizasyonla gelir.")).toBeOnTheScreen();

    await fireEvent.press(screen.getByText("Otomat"));
    expect(await screen.findByText("Filtreyle eşleşen lokasyon yok.")).toBeOnTheScreen();
    expect(getCalls(mock, "/stock/locations/").some((r) => r.params?.location_type === "vending_machine")).toBe(true);
  });

  it("hata durumunda tekrar dene ile yeniden çeker", async () => {
    mock.onGet("/stock/locations/").replyOnce(502, {});
    replyLocations();
    await renderWithProviders(<LocationsTab canManage />);
    expect(await screen.findByText("Sunucuya şu anda ulaşılamıyor.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Tekrar dene"));
    expect(await screen.findByText("Servis Aracı")).toBeOnTheScreen();
  });

  it("senkronizasyon hatasını onay sayfasında gösterir; tekrar denemede çift basış tek istek atar", async () => {
    replyLocations();
    const d = deferred([200, { detail: "Senkronizasyon tamamlandı.", created: 0, updated: 3 }]);
    mock.onPost("/stock/locations/sync-vending/").replyOnce(500, { detail: "POS cihazları okunamadı." });
    mock.onPost("/stock/locations/sync-vending/").reply(() => d.promise);
    await renderWithProviders(<LocationsTab canManage />);

    await fireEvent.press(await screen.findByTestId("location-sync"));
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    expect(await screen.findByText("POS cihazları okunamadı.")).toBeOnTheScreen();
    expect(screen.getByText("İşlem başarısız")).toBeOnTheScreen();

    const confirm = screen.getByTestId("confirm-sheet-confirm");
    await fireEvent.press(confirm);
    await fireEvent.press(confirm);
    await waitFor(() => expect(mock.history.post).toHaveLength(2));
    expect(screen.queryByText("POS cihazları okunamadı.")).toBeNull(); // yeni denemede eski hata temizlenir
    d.release();

    await waitFor(() => expect(useToastStore.getState().current?.message).toBe("Senkronizasyon tamamlandı: 0 yeni, 3 güncellendi."));
    expect(mock.history.post).toHaveLength(2);
  });

  it("senkronizasyon onayından vazgeçince istek atılmaz", async () => {
    replyLocations();
    await renderWithProviders(<LocationsTab canManage />);
    await fireEvent.press(await screen.findByTestId("location-sync"));
    expect(screen.getByText(/Mevcut bakiyeler değişmez/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Vazgeç"));
    expect(screen.queryByText(/Mevcut bakiyeler değişmez/)).toBeNull();
    expect(mock.history.post).toHaveLength(0);
  });

  it("düzenle butonu formu seçili lokasyonla, Yeni butonu boş formla açar", async () => {
    replyLocations();
    await renderWithProviders(<LocationsTab canManage />);
    await fireEvent.press(await screen.findByTestId("location-edit-3"));
    expect(screen.getByText("Lokasyonu düzenle")).toBeOnTheScreen();
    expect(screen.getByTestId("location-name").props.value).toBe("Servis Aracı");
    expect(mockNavigate).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("Vazgeç"));
    await fireEvent.press(screen.getByTestId("location-new"));
    expect(screen.getByText("Yeni lokasyon")).toBeOnTheScreen();
    expect(screen.getByTestId("location-name").props.value).toBe("");
  });

  describe("yetki matrisi", () => {
    const cases: [string, boolean, AuthUser][] = [
      ["admin rolü ama manage_stock yok", false, makeUser({ role: "admin", permissions: [] })],
      ["owner rolü ama yalnız view_sales", false, makeUser({ role: "owner", permissions: ["owner", "view_sales"] })],
      ["teknisyen + manage_stock", true, makeUser({ role: "tech", permissions: ["tech", "manage_stock"] })],
    ];

    it.each(cases)("%s → yazma aksiyonları görünür: %s", async (_name, expected, user) => {
      replyLocations();
      const canManage = canManageStock(user);
      expect(canManage).toBe(expected);
      await renderWithProviders(<LocationsTab canManage={canManage} />);
      await screen.findByText("Servis Aracı");

      expect(!!screen.queryByTestId("location-new")).toBe(expected);
      expect(!!screen.queryByTestId("location-sync")).toBe(expected);
      expect(!!screen.queryByTestId("location-edit-1")).toBe(expected);
      expect(screen.queryByTestId("location-edit-4")).toBeNull(); // otomat hiçbir rolde düzenlenmez

      // Detaya gitmek herkese açık
      await fireEvent.press(screen.getByTestId("location-row-4"));
      expect(mockNavigate).toHaveBeenCalledWith("StockLocationDetail", { locationId: 4, name: "Otomat Kampüs" });
    });
  });
});

/* ------------------------------------------------------------ Hareketler */

describe("MovementsTab", () => {
  beforeEach(() => {
    mock.onGet("/stock/skus/").reply(200, { results: skus });
    mock.onGet("/stock/locations/").reply(200, { results: locations });
  });

  it("ilk sayfayı type olmadan page=1 ile ister; toplamı Türkçe biçimde, nedeni tırnakla gösterir", async () => {
    mock.onGet("/stock/movements/").reply(200, {
      count: 1234,
      page: 1,
      num_pages: 1,
      results: [
        movement({ id: 1 }),
        movement({ id: 2, movement_type: "adjustment", sku: 2, sku_name: "Çekirdek Kahve", to_location: null, to_location_name: null, quantity: "-12.500", reason: "Fire" }),
      ],
    });
    await renderWithProviders(<MovementsTab canManage />);

    expect(await screen.findByText("1.234 hareket")).toBeOnTheScreen();
    expect(screen.getByText("Transfer · Merkez Depo → Servis Aracı")).toBeOnTheScreen();
    expect(screen.getByTestId("movement-qty-2")).toHaveTextContent("−12,5 g");
    expect(screen.getByText("“Fire”")).toBeOnTheScreen();
    const calls = getCalls(mock, "/stock/movements/");
    expect(calls).toHaveLength(1);
    expect(calls[0].params).toEqual({ type: undefined, page: 1 });
  });

  it("liste sonuna gelince sonraki sayfayı ister ve ekler; son sayfada durur", async () => {
    mock.onGet("/stock/movements/").reply((cfg) => [
      200,
      cfg.params?.page === 2
        ? { count: 2, page: 2, num_pages: 2, results: [movement({ id: 2, quantity: 7 })] }
        : { count: 2, page: 1, num_pages: 2, results: [movement({ id: 1, quantity: 5 })] },
    ]);
    await renderWithProviders(<MovementsTab canManage />);
    const first = await screen.findByTestId("movement-qty-1");

    await fireEvent(first, "endReached");
    expect(await screen.findByTestId("movement-qty-2")).toHaveTextContent("7 adet");
    expect(screen.getByTestId("movement-qty-1")).toHaveTextContent("5 adet");

    await fireEvent(screen.getByTestId("movement-qty-2"), "endReached");
    const pages = getCalls(mock, "/stock/movements/").map((r) => r.params?.page);
    expect(pages).toEqual([1, 2]);
  });

  it("boş durumda filtreye göre açıklama değişir; tip filtresi sunucuya gider", async () => {
    mock.onGet("/stock/movements/").reply(200, { count: 0, page: 1, num_pages: 1, results: [] });
    await renderWithProviders(<MovementsTab canManage />);
    expect(await screen.findByText("Transfer, stok girişi ve düzeltmeler burada listelenir.")).toBeOnTheScreen();
    expect(screen.getByText("0 hareket")).toBeOnTheScreen();

    await fireEvent.press(screen.getByText("Dolum"));
    expect(await screen.findByText("Bu tipte kayıtlı hareket yok.")).toBeOnTheScreen();
    expect(getCalls(mock, "/stock/movements/").some((r) => r.params?.type === "refill" && r.params?.page === 1)).toBe(true);
  });

  it("hata durumunda tekrar dene ile yeniden çeker", async () => {
    mock.onGet("/stock/movements/").replyOnce(500, { detail: "Hareketler alınamadı." });
    mock.onGet("/stock/movements/").reply(200, { count: 1, page: 1, num_pages: 1, results: [movement({ id: 1 })] });
    await renderWithProviders(<MovementsTab canManage />);

    expect(await screen.findByText("Hareketler alınamadı.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Tekrar dene"));
    expect(await screen.findByTestId("movement-qty-1")).toHaveTextContent("10 adet");
  });

  it("aksiyon butonları formu doğru modda açar", async () => {
    mock.onGet("/stock/movements/").reply(200, { count: 0, page: 1, num_pages: 1, results: [] });
    await renderWithProviders(<MovementsTab canManage />);
    await screen.findByText("0 hareket");

    await fireEvent.press(screen.getByTestId("movement-new-receipt"));
    expect(await screen.findByText("Tedarikten gelen ürünü lokasyona ekleyin")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Vazgeç"));

    await fireEvent.press(screen.getByTestId("movement-new-adjustment"));
    expect(await screen.findByText("Sayım farkı, fire veya hasar düzeltmesi")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Vazgeç"));

    await fireEvent.press(screen.getByTestId("movement-new-transfer"));
    expect(await screen.findByText("Lokasyonlar arası stok aktarımı")).toBeOnTheScreen();
  });

  it("yetkisiz kullanıcıda hareket butonları yok, liste okunabilir", async () => {
    mock.onGet("/stock/movements/").reply(200, { count: 1, page: 1, num_pages: 1, results: [movement({ id: 1 })] });
    await renderWithProviders(<MovementsTab canManage={canManageStock(makeUser({ permissions: ["view_sales"] }))} />);
    expect(await screen.findByTestId("movement-qty-1")).toBeOnTheScreen();
    expect(screen.queryByTestId("movement-new-transfer")).toBeNull();
    expect(screen.queryByTestId("movement-new-receipt")).toBeNull();
    expect(screen.queryByTestId("movement-new-adjustment")).toBeNull();
  });
});
