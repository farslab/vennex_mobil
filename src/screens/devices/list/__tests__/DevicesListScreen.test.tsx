import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { makeUser, renderWithProviders } from "@/test/utils";
import DevicesListScreen from "@/screens/devices/list/DevicesListScreen";

const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), setOptions: mockSetOptions }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));

const row = (i: number, o: Record<string, unknown> = {}) => ({
  sn: `SN${i}`,
  pos_name: `Otomat ${i}`,
  stat: true,
  online: i % 2 === 0,
  company_id: 10,
  company_name: "Test",
  location_id: 1,
  location_name: "Kat 1",
  act_vmc: null,
  act_macstat: 1,
  last_seen: new Date(Date.now() - 5 * 60000).toISOString(),
  sort_order: 0,
  today_revenue: 1234.5,
  today_tx_count: 12,
  yesterday_revenue: 99,
  this_month_revenue: 5000,
  last_month_revenue: 4000,
  last_transaction: null,
  fill_rate: { pct: 72, qty: 36, max: 50 },
  ...o,
});

const page = (results: unknown[], extra: Record<string, unknown> = {}) => ({
  count: 30,
  page: 1,
  num_pages: 2,
  page_size: 25,
  online_count: 21,
  offline_count: 9,
  total_count: 30,
  results,
  ...extra,
});

const listRequests = (mock: MockAdapter) => mock.history.get.filter((r) => r.url === "/pos-devices/");

describe("DevicesListScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mockNavigate.mockReset();
    useAuthStore.setState({ user: makeUser({ permissions: ["owner", "view_sales", "manage_device_settings"] }), selectedCompanyId: 10 });
  });
  afterEach(() => mock.restore());

  it("satırları ve ilk sayfadaki sayaçları gösterir; satır başına /products/ isteği atmaz", async () => {
    mock.onGet("/pos-devices/").reply(200, page([row(1), row(2), row(3)]));

    await renderWithProviders(<DevicesListScreen />);

    expect(await screen.findByText("Otomat 1")).toBeOnTheScreen();
    expect(screen.getByTestId("devices-count-total")).toHaveTextContent("30 POS cihazı");
    expect(screen.getByTestId("devices-count-online")).toHaveTextContent("21 çevrimiçi");
    expect(screen.getByTestId("devices-count-offline")).toHaveTextContent("9 çevrimdışı");
    expect(screen.getAllByText("%72").length).toBe(3);
    expect(screen.getAllByText("₺1.234,50").length).toBe(3);
    expect(mock.history.get.some((r) => (r.url ?? "").includes("/products/"))).toBe(false);
    expect(listRequests(mock)[0].params).toEqual({ page: 1 });
  });

  it("web gibi: çevrimiçi cihazın makinesi DISABLED/INACTIVE ise bağlantı rozetinde ünlem", async () => {
    mock.onGet("/pos-devices/").reply(
      200,
      page([
        row(2, { act_macstat: 4 }), // çevrimiçi + DISABLED → ünlem
        row(4, { act_macstat: 1 }), // çevrimiçi + ENABLE → yok
        row(3, { act_macstat: 5 }), // çevrimdışı → yok (web de yalnız çevrimiçide gösterir)
      ])
    );
    await renderWithProviders(<DevicesListScreen />);
    expect(await screen.findByTestId("device-conn-SN2")).toHaveProp("accessibilityLabel", "Çevrimiçi, makine DISABLED");
    expect(screen.getByTestId("device-conn-SN4")).toHaveProp("accessibilityLabel", "Çevrimiçi");
    expect(screen.getByTestId("device-conn-SN3")).toHaveProp("accessibilityLabel", "Çevrimdışı");
  });

  it("Excel düğmesi Genel Bakış gibi başlıkta (bildirim zilinin yanında), sayfa içinde değil", async () => {
    mockSetOptions.mockReset();
    mock.onGet("/pos-devices/").reply(200, page([row(1)]));
    await renderWithProviders(<DevicesListScreen />);
    await screen.findByText("Otomat 1");
    expect(screen.queryByText("Excel")).toBeNull();
    const calls = mockSetOptions.mock.calls.filter((c) => "header" in (c[0] as object));
    const header = (calls[calls.length - 1][0] as { header: () => React.ReactElement }).header();
    const right = (header.props as { title: string; right: React.ReactElement<{ icon: string; testID: string }> }).right;
    expect((header.props as { title: string }).title).toBe("POS Cihazları");
    expect(right.props).toMatchObject({ icon: "excel", testID: "header-excel" });
  });

  it("doluluk bilgisi olmayan cihazda boş doluluk çubuğu gösterilmez", async () => {
    mock.onGet("/pos-devices/").reply(200, page([row(1), row(2, { fill_rate: null })]));
    await renderWithProviders(<DevicesListScreen />);
    expect(await screen.findByTestId("device-fill-SN1")).toBeOnTheScreen();
    expect(screen.queryByTestId("device-fill-SN2")).toBeNull();
  });

  it("view_sales yoksa ciro gösterilmez ve ciro gizleme düğmesi yoktur", async () => {
    useAuthStore.setState({ user: makeUser({ permissions: ["tech"] }) });
    mock.onGet("/pos-devices/").reply(200, page([row(1)]));

    await renderWithProviders(<DevicesListScreen />);

    expect(await screen.findByText("Otomat 1")).toBeOnTheScreen();
    expect(screen.queryByText("₺1.234,50")).toBeNull();
    expect(screen.queryByTestId("devices-toggle-revenue")).toBeNull();
    // Web: özel sıralama herkese açık; ürün şablonları cihaz ayarı yetkisi ister (yoksa 403 olurdu)
    expect(screen.getByText("Özel sıralama")).toBeOnTheScreen();
    expect(screen.queryByText("Ürün şablonları")).toBeNull();
  });

  it("arama debounce'ludur: art arda yazımda tek istek, q parametresiyle", async () => {
    mock.onGet("/pos-devices/").reply(200, page([row(1)]));
    await renderWithProviders(<DevicesListScreen />);
    await screen.findByText("Otomat 1");

    const input = screen.getByTestId("devices-search");
    await fireEvent.changeText(input, "Ka");
    await fireEvent.changeText(input, "Kah");
    await fireEvent.changeText(input, "Kahve");

    await waitFor(() => expect(listRequests(mock).some((r) => r.params.q === "Kahve")).toBe(true), { timeout: 2000 });
    const searchRequests = listRequests(mock).filter((r) => r.params.q);
    expect(searchRequests).toHaveLength(1);
    expect(searchRequests[0].params).toEqual({ page: 1, q: "Kahve" });
    // arama sırasında input sökülmez
    expect(screen.getByTestId("devices-search")).toBeOnTheScreen();
  });

  it("filtreler sunucu parametresine çevrilir (online=false, machine_type=1, sort_by)", async () => {
    mock.onGet("/pos-devices/").reply(200, page([row(1)]));
    await renderWithProviders(<DevicesListScreen />);
    await screen.findByText("Otomat 1");

    await fireEvent.press(screen.getByTestId("devices-filter-button"));
    await fireEvent.press(await screen.findByTestId("filter-online"));
    const offline = await screen.findAllByText("Çevrimdışı"); // listedeki rozetler de aynı metni taşır
    await fireEvent.press(offline[offline.length - 1]);
    await fireEvent.press(screen.getByTestId("filter-machine-type"));
    await fireEvent.press(await screen.findByText("Kahve"));
    await fireEvent.press(screen.getByTestId("filter-sort"));
    await fireEvent.press(await screen.findByText("Doluluk (Düşük → Yüksek)"));
    await fireEvent.press(screen.getByTestId("device-filters-apply"));

    await waitFor(() =>
      expect(
        listRequests(mock).some((r) => r.params.online === "false" && r.params.machine_type === 1 && r.params.sort_by === "fill_rate_asc")
      ).toBe(true)
    );
    expect(listRequests(mock).every((r) => !("page_size" in r.params) && !("stat" in r.params))).toBe(true);
  });

  it("listenin sonunda sonraki sayfayı (page=2) yükler", async () => {
    mock.onGet("/pos-devices/").reply((config) => {
      const p = Number(config.params.page);
      return [200, page(p === 1 ? [row(1), row(2)] : [row(26)], { page: p })];
    });
    await renderWithProviders(<DevicesListScreen />);
    await screen.findByText("Otomat 1");

    await fireEvent(screen.getByTestId("devices-list"), "onEndReached");

    expect(await screen.findByText("Otomat 26")).toBeOnTheScreen();
    expect(listRequests(mock).map((r) => r.params.page)).toEqual([1, 2]);
  });

  it("satıra basınca cihaz detayına, çipe basınca şablonlara gider", async () => {
    mock.onGet("/pos-devices/").reply(200, page([row(1)]));
    await renderWithProviders(<DevicesListScreen />);

    await fireEvent.press(await screen.findByTestId("device-row-SN1"));
    expect(mockNavigate).toHaveBeenCalledWith("DeviceDetail", { sn: "SN1", name: "Otomat 1" });

    await fireEvent.press(screen.getByText("Ürün şablonları"));
    expect(mockNavigate).toHaveBeenCalledWith("ProductTemplates");
  });

  it("hata durumunda tekrar dene gösterir; boş listede boş durum", async () => {
    mock.onGet("/pos-devices/").replyOnce(500, { detail: "Sunucu hatası" });
    mock.onGet("/pos-devices/").reply(200, page([], { count: 0, total_count: 0, online_count: 0, offline_count: 0, num_pages: 1 }));
    await renderWithProviders(<DevicesListScreen />);

    expect(await screen.findByText("Sunucu hatası")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Tekrar dene"));
    expect(await screen.findByText("Henüz POS cihazı yok")).toBeOnTheScreen();
  });

  it("özel sıralama: aşağı taşı + kaydet → POST pos-devices/sort/", async () => {
    mock.onGet("/pos-devices/").reply(200, page([row(1), row(2)], { count: 2, total_count: 2, num_pages: 1 }));
    mock.onPost("/pos-devices/sort/").reply(200, { detail: "Sıralama güncellendi." });
    await renderWithProviders(<DevicesListScreen />);
    await screen.findByText("Otomat 1");

    await fireEvent.press(screen.getByText("Özel sıralama"));
    await fireEvent.press(await screen.findByTestId("order-down-SN1"));
    await fireEvent.press(screen.getByTestId("device-order-save"));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      device_orders: [
        { sn: "SN2", sort_order: 1 },
        { sn: "SN1", sort_order: 2 },
      ],
    });
  });
});
