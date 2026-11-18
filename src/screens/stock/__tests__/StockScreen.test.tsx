import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { useToastStore } from "@/design-system";
import { useAuthStore } from "@/store/authStore";
import { makeUser, renderWithProviders } from "@/test/utils";
import StockScreen from "@/screens/stock/StockScreen";
import { inventory, locations, movement, skus } from "./fixtures";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), setOptions: jest.fn() }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));

const asManager = () => useAuthStore.setState({ user: makeUser({ permissions: ["owner", "manage_stock"] }) });
const asViewer = () => useAuthStore.setState({ user: makeUser({ permissions: ["owner", "view_sales"] }) });

const getCalls = (mock: MockAdapter, url: string) => mock.history.get.filter((r) => r.url === url);

describe("StockScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mockNavigate.mockReset();
    useToastStore.setState({ current: null });
    asManager();
    mock.onGet("/stock/skus/").reply(200, { results: skus });
    // Backend gibi location_type filtresini uygular (views/stock.py:104-106)
    mock.onGet("/stock/locations/").reply((cfg) => [
      200,
      { results: locations.filter((l) => !cfg.params?.location_type || l.location_type === cfg.params.location_type) },
    ]);
    mock.onGet(/\/stock\/locations\/\d+\/inventory\//).reply((cfg) => {
      const id = Number(/locations\/(\d+)\//.exec(cfg.url ?? "")?.[1]);
      return [200, inventory(id)];
    });
  });
  afterEach(() => mock.restore());

  describe("Özet", () => {
    it("toplamları birimle gösterir, negatif/tükenen rozetlerini işaretler", async () => {
      mock.onGet("/stock/overview/").reply(200, {
        results: [
          { sku_id: 1, sku_name: "Su 500 ml", sku_code: "SU-500", total: 118 },
          { sku_id: 2, sku_name: "Çekirdek Kahve", sku_code: "BIL-KHV", total: 2500.5 },
          { sku_id: 9, sku_name: "Gazoz", sku_code: "GAZ", total: -3 },
        ],
      });
      await renderWithProviders(<StockScreen />);

      expect(await screen.findByText("118 adet")).toBeOnTheScreen();
      expect(await screen.findByText("2.500,5 g")).toBeOnTheScreen();
      // SKU listesinde olmayan ürün: birim bilinmiyor → yalnız sayı (uydurma birim yok)
      expect(screen.getByText("-3")).toBeOnTheScreen();
      expect(screen.getAllByText("Negatif").length).toBeGreaterThan(0);
    });

    it("satır açılınca dağılımı lokasyon bazlı tek seferde çeker; otomatları çekmez", async () => {
      mock.onGet("/stock/overview/").reply(200, { results: [{ sku_id: 1, sku_name: "Su 500 ml", sku_code: "SU-500", total: 124 }] });
      await renderWithProviders(<StockScreen />);
      expect(getCalls(mock, "/stock/locations/")).toHaveLength(0);

      await fireEvent.press(await screen.findByTestId("overview-row-1"));

      const panel = await screen.findByTestId("breakdown-1");
      expect(await within(panel).findByText("Merkez Depo")).toBeOnTheScreen();
      expect(within(panel).getByText("120 adet")).toBeOnTheScreen();
      expect(within(panel).getByText("-2 adet")).toBeOnTheScreen();
      // 124 - (120 - 2) = 6 → otomat/pasif farkı
      expect(within(panel).getByText("Otomatlar ve pasif lokasyonlar")).toBeOnTheScreen();
      expect(within(panel).getByText("6 adet")).toBeOnTheScreen();
      expect(mock.history.get.some((r) => r.url === "/stock/locations/4/inventory/")).toBe(false);

      await fireEvent.press(within(panel).getByText("Merkez Depo"));
      expect(mockNavigate).toHaveBeenCalledWith("StockLocationDetail", { locationId: 1, name: "Merkez Depo" });
    });

    it("boş durum gösterir", async () => {
      mock.onGet("/stock/overview/").reply(200, { results: [] });
      await renderWithProviders(<StockScreen />);
      expect(await screen.findByText("Stok kaydı yok")).toBeOnTheScreen();
    });

    it("hata durumunda tekrar dene ile yeniden çeker", async () => {
      mock.onGet("/stock/overview/").replyOnce(500, { detail: "Sunucu hatası" });
      mock.onGet("/stock/overview/").reply(200, { results: [{ sku_id: 1, sku_name: "Su 500 ml", sku_code: "SU-500", total: 5 }] });
      await renderWithProviders(<StockScreen />);

      expect(await screen.findByText("Sunucu hatası")).toBeOnTheScreen();
      await fireEvent.press(screen.getByText("Tekrar dene"));
      expect(await screen.findByText("5 adet")).toBeOnTheScreen();
    });
  });

  describe("sekmeler ve yetki", () => {
    beforeEach(() => {
      mock.onGet("/stock/overview/").reply(200, { results: [] });
    });

    it("sekmeleri ilk ziyarette mount eder (lokasyonlar sekmesine geçmeden istek yok)", async () => {
      await renderWithProviders(<StockScreen />);
      await screen.findByText("Stok kaydı yok");
      expect(getCalls(mock, "/stock/locations/")).toHaveLength(0);

      await fireEvent.press(screen.getByText("Lokasyonlar"));
      expect(await screen.findByText("Servis Aracı")).toBeOnTheScreen();
      expect(getCalls(mock, "/stock/locations/")).toHaveLength(1);
      expect(screen.getByText("VX-T-1", { exact: false })).toBeOnTheScreen();
    });

    it("manage_stock yoksa yazma aksiyonlarını göstermez", async () => {
      asViewer();
      await renderWithProviders(<StockScreen />);
      expect(await screen.findByText("Salt görüntüleme")).toBeOnTheScreen();

      await fireEvent.press(screen.getByText("Lokasyonlar"));
      await screen.findByText("Servis Aracı");
      expect(screen.queryByText("Otomatları senkronize et")).toBeNull();
      expect(screen.queryByTestId("location-new")).toBeNull();
      expect(screen.queryByTestId("location-edit-1")).toBeNull();

      await fireEvent.press(screen.getByText("Ürünler"));
      await screen.findByText("Su 500 ml");
      expect(screen.queryByTestId("sku-new")).toBeNull();
      expect(screen.queryByTestId("sku-row-1")).toBeNull(); // satırlar düzenlemeye açılmaz

      mock.onGet("/stock/movements/").reply(200, { count: 0, page: 1, num_pages: 1, results: [] });
      await fireEvent.press(screen.getByText("Hareketler"));
      await screen.findByText("Hareket bulunamadı");
      expect(screen.queryByTestId("movement-new-transfer")).toBeNull();
      expect(screen.queryByTestId("movement-new-receipt")).toBeNull();
      expect(screen.queryByTestId("movement-new-adjustment")).toBeNull();
    });

    it("yetkili kullanıcıda yazma aksiyonları görünür; otomat lokasyonu düzenlenemez", async () => {
      await renderWithProviders(<StockScreen />);
      await fireEvent.press(screen.getByText("Lokasyonlar"));
      await screen.findByText("Servis Aracı");
      expect(screen.getByText("Otomatları senkronize et")).toBeOnTheScreen();
      expect(screen.getByTestId("location-edit-1")).toBeOnTheScreen();
      expect(screen.queryByTestId("location-edit-4")).toBeNull();
      expect(screen.queryByText("Salt görüntüleme")).toBeNull();
    });
  });

  describe("Lokasyonlar", () => {
    beforeEach(() => {
      mock.onGet("/stock/overview/").reply(200, { results: [] });
    });

    it("otomat senkronizasyonu onay sonrası tek istek atar ve sonucu bildirir", async () => {
      mock.onPost("/stock/locations/sync-vending/").reply(200, { detail: "Senkronizasyon tamamlandı.", created: 2, updated: 1 });
      await renderWithProviders(<StockScreen />);
      await fireEvent.press(screen.getByText("Lokasyonlar"));
      await fireEvent.press(await screen.findByTestId("location-sync"));
      expect(mock.history.post).toHaveLength(0);

      await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
      await waitFor(() => expect(useToastStore.getState().current?.message).toBe("Senkronizasyon tamamlandı: 2 yeni, 1 güncellendi."));
      expect(mock.history.post.map((r) => r.url)).toEqual(["/stock/locations/sync-vending/"]);
    });

    it("tip filtresini sunucuya location_type olarak iletir, satıra basınca detaya gider", async () => {
      await renderWithProviders(<StockScreen />);
      await fireEvent.press(screen.getByText("Lokasyonlar"));
      await screen.findByText("Servis Aracı");
      await fireEvent.press(screen.getAllByText("Araç")[0]);
      await waitFor(() => expect(getCalls(mock, "/stock/locations/").some((r) => r.params?.location_type === "vehicle")).toBe(true));

      // Filtre query key'ini değiştirir → yeni yanıt gelene kadar liste iskelet gösterir; satırı bekle
      const row = await screen.findByTestId("location-row-3");
      expect(screen.queryByTestId("location-row-1")).toBeNull();
      await fireEvent.press(row);
      expect(mockNavigate).toHaveBeenCalledWith("StockLocationDetail", { locationId: 3, name: "Servis Aracı" });
    });

    it("yeni lokasyon formu boş adı reddeder, geçerli gövdeyi POST eder", async () => {
      mock.onPost("/stock/locations/").reply(201, { id: 9, name: "Yeni Depo", location_type: "warehouse", is_active: true });
      await renderWithProviders(<StockScreen />);
      await fireEvent.press(screen.getByText("Lokasyonlar"));
      await fireEvent.press(await screen.findByTestId("location-new"));
      await fireEvent.press(screen.getByTestId("location-save"));
      expect(screen.getByText("Lokasyon adı gerekli.")).toBeOnTheScreen();
      expect(mock.history.post).toHaveLength(0);

      await fireEvent.changeText(screen.getByTestId("location-name"), "  Yeni Depo ");
      await fireEvent.press(screen.getByTestId("location-save"));
      await waitFor(() => expect(mock.history.post).toHaveLength(1));
      expect(JSON.parse(mock.history.post[0].data)).toEqual({ name: "Yeni Depo", location_type: "warehouse", is_active: true });
    });
  });

  describe("Ürünler", () => {
    beforeEach(() => {
      mock.onGet("/stock/overview/").reply(200, { results: [] });
    });

    it("aramayı debounce ile sunucuya q olarak iletir; arama kutusu yüklenirken kalır", async () => {
      await renderWithProviders(<StockScreen />);
      await fireEvent.press(screen.getByText("Ürünler"));
      await screen.findByText("Çekirdek Kahve");

      const input = screen.getByTestId("sku-search");
      await fireEvent.changeText(input, "k");
      await fireEvent.changeText(input, "ka");
      await fireEvent.changeText(input, "kahve");
      expect(screen.getByTestId("sku-search")).toBeOnTheScreen();

      await waitFor(() => expect(getCalls(mock, "/stock/skus/").some((r) => r.params?.q === "kahve")).toBe(true), { timeout: 2000 });
      const qs = getCalls(mock, "/stock/skus/").map((r) => r.params?.q);
      expect(qs).not.toContain("k");
      expect(qs).not.toContain("ka");
      expect(screen.getByTestId("sku-search").props.value).toBe("kahve");
    });

    it("tür filtresi istemcide uygulanır (yeni istek yok)", async () => {
      await renderWithProviders(<StockScreen />);
      await fireEvent.press(screen.getByText("Ürünler"));
      await screen.findByText("Latte");
      const before = getCalls(mock, "/stock/skus/").length;
      await fireEvent.press(screen.getByText("Bileşen (1)"));
      expect(screen.queryByText("Latte")).toBeNull();
      expect(screen.getByText("Çekirdek Kahve")).toBeOnTheScreen();
      expect(getCalls(mock, "/stock/skus/").length).toBe(before);
    });

    it("yeni SKU oluşturur: ondalıklar string, satılabilir ürün birimi adet", async () => {
      mock.onPost("/stock/skus/").reply(201, { ...skus[0], id: 50 });
      await renderWithProviders(<StockScreen />);
      await fireEvent.press(screen.getByText("Ürünler"));
      await fireEvent.press(await screen.findByTestId("sku-new"));

      await fireEvent.changeText(screen.getByTestId("sku-name"), "Ayran");
      await fireEvent.changeText(screen.getByTestId("sku-code"), "AYR-1");
      await fireEvent.changeText(screen.getByTestId("sku-unit-cost"), "7,5");
      await fireEvent.changeText(screen.getByTestId("sku-sale-price"), "17,50");
      await fireEvent.press(screen.getByTestId("sku-save"));

      await waitFor(() => expect(mock.history.post).toHaveLength(1));
      expect(JSON.parse(mock.history.post[0].data)).toEqual({
        name: "Ayran",
        sku_code: "AYR-1",
        barcode: null,
        kind: "simple",
        base_unit: "piece",
        package_size: "1.000",
        package_label: "",
        unit_cost: "7.50",
        sale_price: "17.50",
        vat_rate: "20.00",
      });
      await waitFor(() => expect(useToastStore.getState().current?.message).toBe("Ürün oluşturuldu."));
    });

    it("düzenlemede yalnız değişen alanları PATCH eder; silme onaylı", async () => {
      mock.onPatch("/stock/skus/1/").reply(200, { ...skus[0], name: "Su 0,5 L" });
      mock.onDelete("/stock/skus/1/").reply(204);
      await renderWithProviders(<StockScreen />);
      await fireEvent.press(screen.getByText("Ürünler"));
      await fireEvent.press(await screen.findByTestId("sku-row-1"));

      await fireEvent.changeText(screen.getByTestId("sku-name"), "Su 0,5 L");
      await fireEvent.press(screen.getByTestId("sku-save"));
      await waitFor(() => expect(mock.history.patch).toHaveLength(1));
      expect(JSON.parse(mock.history.patch[0].data)).toEqual({ name: "Su 0,5 L" });

      await fireEvent.press(await screen.findByTestId("sku-row-1"));
      await fireEvent.press(screen.getByTestId("sku-delete"));
      expect(screen.getByText("Bu işlem geri alınamaz.")).toBeOnTheScreen();
      expect(mock.history.delete).toHaveLength(0);
      await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
      await waitFor(() => expect(mock.history.delete.map((r) => r.url)).toEqual(["/stock/skus/1/"]));
    });
  });

  describe("Hareketler", () => {
    beforeEach(() => {
      mock.onGet("/stock/overview/").reply(200, { results: [] });
    });

    it("hareketleri tipine göre işaretli gösterir ve tip filtresini sunucuya iletir", async () => {
      mock.onGet("/stock/movements/").reply(200, {
        count: 3,
        page: 1,
        num_pages: 1,
        results: [
          movement({ id: 1, movement_type: "transfer", quantity: 10 }),
          movement({ id: 2, movement_type: "receipt", from_location: null, from_location_name: null, to_location: 1, to_location_name: "Merkez Depo", quantity: 24 }),
          movement({ id: 3, movement_type: "adjustment", sku: 2, sku_name: "Çekirdek Kahve", from_location: 1, to_location: null, to_location_name: null, quantity: 12.5 }),
        ],
      });
      await renderWithProviders(<StockScreen />);
      await fireEvent.press(screen.getByText("Hareketler"));

      expect(await screen.findByTestId("movement-qty-1")).toHaveTextContent("10 adet");
      expect(screen.getByTestId("movement-qty-2")).toHaveTextContent("+24 adet");
      expect(screen.getByTestId("movement-qty-3")).toHaveTextContent("−12,5 g");
      expect(screen.getByText("3 hareket")).toBeOnTheScreen();

      await fireEvent.press(screen.getByText("Stok Girişi"));
      await waitFor(() =>
        expect(getCalls(mock, "/stock/movements/").some((r) => r.params?.type === "receipt" && r.params?.page === 1)).toBe(true)
      );
    });
  });
});
