import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { makeUser, renderWithProviders } from "@/test/utils";
import DashboardScreen from "@/screens/dashboard/DashboardScreen";
import type { OverviewBundle } from "@/types/overview";

// İkon fontu yükleyicisi (expo-font/expo-asset) testte gereksiz
jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

const mockNavigate = jest.fn();
const mockSetOptions = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), setOptions: mockSetOptions }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));

const salesBundle = (over: Partial<OverviewBundle> = {}): OverviewBundle => ({
  summary: {
    period: "today",
    period_label: "Bugün",
    start: "2026-11-18T00:00:00+03:00",
    end: "2026-11-18T14:00:00+03:00",
    sales_visible: true,
    devices: { total: 6, online: 4, offline: 2 },
    revenue: 12345.5,
    previous_revenue: 10000,
    change_pct: 23.455,
    change_positive: true,
    comparison_label: "Dün bu saatte",
    transactions: { total: 120, success: 110, failed: 10 },
    failures: { timeout: 3, bank: 5, technical: 1, other: 1 },
  },
  revenue_timeseries: { mode: "hourly", labels: ["09:00", "10:00"], amounts: [100, 250.5] },
  payment_breakdown: { results: [{ pt_type: 1, label: "Kredi/Banka Kartı", color: "#1E88E5", amount: 9000, count: 80 }] },
  top_devices: { results: [{ sn: "SN-TOP-1", pos_name: "Lobi Otomat", revenue: 5000, tx_count: 40 }] },
  error_breakdown: { results: [] },
  recent_transactions: {
    results: [
      {
        id: 1,
        pt_id: "T1",
        datetime: "2026-11-18T10:00:00Z",
        sn: "SN-TOP-1",
        pos_name: "Lobi Otomat",
        product_name: "Su 0,5 L",
        amount: 15,
        status: false,
        pt_type: 0,
        pt_type_label: "Nakit",
        card_pan: "",
      },
    ],
  },
  ...over,
});

const hiddenBundle: OverviewBundle = {
  summary: { period: "today", period_label: "Bugün", sales_visible: false, devices: { total: 3, online: 3, offline: 0 } },
  revenue_timeseries: null,
  payment_breakdown: null,
  top_devices: null,
  error_breakdown: null,
  recent_transactions: null,
};

const dashboardGets = (mock: MockAdapter) => mock.history.get.filter((r) => r.url === "/overview/dashboard/");

describe("DashboardScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet("/overview/locations/").reply(200, { results: [] });
    useAuthStore.setState({ user: makeUser({ permissions: ["owner", "view_sales"] }) });
  });
  afterEach(() => {
    mock.restore();
  });

  it("ilk yüklemede iskelet gösterir", async () => {
    mock.onGet("/overview/dashboard/").reply(() => new Promise(() => {}));
    await renderWithProviders(<DashboardScreen />);
    expect(screen.getByTestId("dashboard-skeleton")).toBeOnTheScreen();
  });

  it("KPI'ları, değişimi ve listeleri gösterir; tek bundle isteği atar", async () => {
    mock.onGet("/overview/dashboard/").reply(200, salesBundle());
    await renderWithProviders(<DashboardScreen />);

    expect(await screen.findByText("₺12.345,50")).toBeOnTheScreen();
    expect(screen.getByText(/%23,5/)).toBeOnTheScreen();
    expect(screen.getByText("4 çevrimiçi · 2 çevrimdışı")).toBeOnTheScreen();
    expect(screen.getByTestId("top-device-SN-TOP-1")).toBeOnTheScreen();
    expect(screen.getByText("Başarısızlık nedenleri")).toBeOnTheScreen();
    expect(screen.queryByText(/Grup Dağılımı/)).toBeNull();

    expect(dashboardGets(mock)).toHaveLength(1);
    expect(dashboardGets(mock)[0].params).toEqual({ period: "today", top_limit: 5, recent_limit: 5 });
    // Ayrı overview/* widget uçları çağrılmaz
    expect(mock.history.get.some((r) => /overview\/(summary|revenue|payment|top|recent|error)/.test(r.url ?? ""))).toBe(false);
  });

  it("önceki dönem cirosu yoksa değişim göstermez", async () => {
    const b = salesBundle();
    b.summary = { ...b.summary, previous_revenue: 0, change_pct: null };
    mock.onGet("/overview/dashboard/").reply(200, b);
    await renderWithProviders(<DashboardScreen />);
    await screen.findByText("₺12.345,50");
    expect(screen.queryByText(/▲|▼/)).toBeNull();
  });

  it("grafik verisi yoksa boş durum gösterir (sahte veri çizmez)", async () => {
    mock.onGet("/overview/dashboard/").reply(
      200,
      salesBundle({
        revenue_timeseries: { mode: "hourly", labels: ["09:00", "10:00"], amounts: [0, 0] },
        payment_breakdown: { results: [] },
        top_devices: { results: [] },
        recent_transactions: { results: [] },
      })
    );
    await renderWithProviders(<DashboardScreen />);
    expect((await screen.findAllByText("Bu dönemde satış yok")).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Bu dönemde işlem yok")).toBeOnTheScreen();
  });

  it("backend satışları gizlerse hiçbir tutar göstermez", async () => {
    mock.onGet("/overview/dashboard/").reply(200, hiddenBundle);
    await renderWithProviders(<DashboardScreen />);
    expect(await screen.findByText("Satış verileri gizli")).toBeOnTheScreen();
    expect(screen.queryByText(/₺/)).toBeNull();
    expect(screen.queryByTestId("kpi-revenue")).toBeNull();
  });

  it("kullanıcının view_sales yetkisi yoksa backend veri gönderse bile ciro gizlenir", async () => {
    useAuthStore.setState({ user: makeUser({ role: "tech", permissions: ["tech"] }) });
    mock.onGet("/overview/dashboard/").reply(200, salesBundle());
    await renderWithProviders(<DashboardScreen />);
    expect(await screen.findByText("Satış verileri gizli")).toBeOnTheScreen();
    expect(screen.queryByText(/₺/)).toBeNull();
    expect(screen.getByTestId("kpi-devices")).toBeOnTheScreen();
  });

  it("hata durumunda tekrar dene ile yeniden ister", async () => {
    mock.onGet("/overview/dashboard/").replyOnce(500, { detail: "Sunucu hatası" });
    mock.onGet("/overview/dashboard/").reply(200, salesBundle());
    await renderWithProviders(<DashboardScreen />);

    expect(await screen.findByText("Sunucu hatası")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Tekrar dene"));
    expect(await screen.findByText("₺12.345,50")).toBeOnTheScreen();
    expect(dashboardGets(mock)).toHaveLength(2);
  });

  it("dönem değişince yeni dönem parametresiyle ister", async () => {
    mock.onGet("/overview/dashboard/").reply(200, salesBundle());
    await renderWithProviders(<DashboardScreen />);
    await screen.findByText("₺12.345,50");

    await fireEvent.press(screen.getByText("Geçen Hafta"));
    await waitFor(() => expect(dashboardGets(mock)).toHaveLength(2));
    expect(dashboardGets(mock)[1].params).toEqual({ period: "last_week", top_limit: 5, recent_limit: 5 });
  });

  it("özel aralık doğrulanır, geçerliyse start/end gönderilir", async () => {
    mock.onGet("/overview/dashboard/").reply(200, salesBundle());
    await renderWithProviders(<DashboardScreen />);
    await screen.findByText("₺12.345,50");

    await fireEvent.press(screen.getByText("Özel aralık"));
    await fireEvent.changeText(screen.getByTestId("custom-range-start"), "10.11.2026");
    await fireEvent.changeText(screen.getByTestId("custom-range-end"), "01.11.2026");
    await fireEvent.press(screen.getByTestId("custom-range-apply"));
    expect(screen.getByText("Başlangıç tarihi bitiş tarihinden sonra olamaz.")).toBeOnTheScreen();
    expect(dashboardGets(mock)).toHaveLength(1);

    await fireEvent.changeText(screen.getByTestId("custom-range-end"), "15.11.2026");
    await fireEvent.press(screen.getByTestId("custom-range-apply"));
    await waitFor(() => expect(dashboardGets(mock)).toHaveLength(2));
    expect(dashboardGets(mock)[1].params).toEqual({
      period: "custom",
      top_limit: 5,
      recent_limit: 5,
      start_date: "2026-11-10",
      end_date: "2026-11-15",
    });
  });

  it("cihaz KPI'ı Cihazlar sekmesine, en çok satan cihaz detayına gider", async () => {
    mock.onGet("/overview/dashboard/").reply(200, salesBundle());
    await renderWithProviders(<DashboardScreen />);
    await screen.findByText("₺12.345,50");

    await fireEvent.press(screen.getByTestId("kpi-devices"));
    expect(mockNavigate).toHaveBeenCalledWith("Tabs", { screen: "Devices" });

    await fireEvent.press(screen.getByTestId("top-device-SN-TOP-1"));
    expect(mockNavigate).toHaveBeenCalledWith("DeviceDetail", { sn: "SN-TOP-1", name: "Lobi Otomat" });
  });

  it("konum listesi varsa filtreyi gösterir ve location_id gönderir", async () => {
    mock.onGet("/overview/locations/").reply(200, { results: [{ id: 7, name: "Kampüs A", region_id: 1, region_name: "Bölge" }] });
    mock.onGet("/overview/dashboard/").reply(200, salesBundle());
    await renderWithProviders(<DashboardScreen />);
    await screen.findByText("₺12.345,50");

    await fireEvent.press(await screen.findByTestId("location-select"));
    await fireEvent.press(await screen.findByText("Kampüs A"));
    await waitFor(() => expect(dashboardGets(mock)).toHaveLength(2));
    expect(dashboardGets(mock)[1].params).toMatchObject({ location_id: 7 });
  });

  /** Son setOptions çağrısındaki başlığı çizip içindeki Excel düğmesini döndürür */
  const headerExcel = () => {
    const calls = mockSetOptions.mock.calls.filter((c) => "header" in (c[0] as object));
    const header = (calls[calls.length - 1]?.[0] as { header: () => React.ReactElement }).header();
    const right = (header.props as { right?: React.ReactElement<{ testID: string; label: string; icon: string }> | null }).right;
    return right ?? null;
  };

  it("başlıkta Excel düğmesi: satış yetkisiyle görünür (web ile aynı ikon/etiket)", async () => {
    mockSetOptions.mockReset();
    mock.onGet("/overview/dashboard/").reply(200, salesBundle());
    await renderWithProviders(<DashboardScreen />);
    await screen.findByText("₺12.345,50");
    const btn = headerExcel();
    expect(btn?.props).toMatchObject({ testID: "header-excel", label: "Excel'e aktar", icon: "excel" });
  });

  it("satış yetkisi yoksa başlıkta Excel düğmesi yok", async () => {
    mockSetOptions.mockReset();
    useAuthStore.setState({ user: makeUser({ permissions: ["tech"], role: "tech" }) });
    mock.onGet("/overview/dashboard/").reply(200, hiddenBundle);
    await renderWithProviders(<DashboardScreen />);
    await waitFor(() => expect(mockSetOptions).toHaveBeenCalled());
    expect(headerExcel()).toBeNull();
  });
});

