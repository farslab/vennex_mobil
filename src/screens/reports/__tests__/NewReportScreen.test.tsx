import React from "react";
import MockAdapter from "axios-mock-adapter";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import NewReportScreen from "@/screens/reports/NewReportScreen";
import { useAuthStore } from "@/store/authStore";
import { makeUser, renderWithProviders } from "@/test/utils";
import { businessToday, formatDate, toApiDate } from "@/utils/date";

// İkon fontu yükleyicisi (expo-font/expo-asset) testte gereksiz
jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

const mockNavigate = jest.fn();
const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: mockGoBack, setOptions: jest.fn() }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));
jest.mock("expo-file-system", () => ({ Paths: {}, Directory: jest.fn(), File: { downloadFileAsync: jest.fn() } }));

/** Host öğeden yukarı doğru en yakın `onPress` prop'unu bulur (fireEvent her çağrıda ayrı act açar) */
function pressHandlerOf(instance: unknown): () => void {
  type Fiber = { memoizedProps?: { onPress?: unknown }; return: Fiber | null };
  let fiber = (instance as { unstable_fiber?: Fiber }).unstable_fiber ?? null;
  while (fiber) {
    const handler = fiber.memoizedProps?.onPress;
    if (typeof handler === "function") return handler as () => void;
    fiber = fiber.return;
  }
  throw new Error("onPress bulunamadı");
}

const filterOptions = {
  report_types: [
    { value: "pos_summary", label: "Cihaz Bazlı Özet" },
    { value: "pos_detail", label: "Detaylı İşlem Listesi" },
    { value: "nfc_balance_logs", label: "PersonelKart Hareketleri" },
  ],
  companies: [{ id: 1, name: "Şirket A" }],
  regions: [{ id: 2, name: "Bölge", company_id: 1 }],
  locations: [{ id: 3, name: "Konum", region_id: 2, region_name: "Bölge" }],
  devices: [
    { id: 4, sn: "SN-1", pos_name: "Otomat 1", company_id: 1, location_id: 3 },
    { id: 5, sn: "SN-2", pos_name: "Otomat 2", company_id: 1, location_id: 3 },
  ],
  has_personel_kart_pos: false,
  nfc_sources: [],
  nfc_operations: [],
};

describe("NewReportScreen", () => {
  let mock: MockAdapter;
  const today = formatDate(businessToday());
  const todayApi = toApiDate(businessToday());

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet("/reports/filter-options/").reply(200, filterOptions);
    useAuthStore.setState({ user: makeUser({ permissions: ["owner", "view_sales"] }) });
  });
  afterEach(() => {
    mock.restore();
  });

  it("web adlarıyla tipler; sahte cihaz/bölge içermez; PersonelKart POS yoksa NFC tipi gizli", async () => {
    await renderWithProviders(<NewReportScreen />);
    expect(await screen.findByText("Özet")).toBeOnTheScreen();
    expect(screen.getByText("Detay")).toBeOnTheScreen();
    expect(screen.queryByText(/serpetco|PAX3080007269|İstanbul Anadolu/)).toBeNull();
    expect(screen.queryByTestId("report-type-nfc_balance_logs")).toBeNull();
    expect(screen.getByText("Tüm POS cihazları (2)")).toBeOnTheScreen();
  });

  it("doğru gövdeyle rapor oluşturur, buton istek sürerken kilitlenir", async () => {
    let resolve: (v: [number, unknown]) => void = () => {};
    mock.onPost("/reports/").reply(() => new Promise((r) => (resolve = r)));
    await renderWithProviders(<NewReportScreen />);
    await screen.findByText("Özet");

    await fireEvent.press(screen.getByTestId("report-type-pos_detail"));
    await fireEvent.press(screen.getByText("Başarısız"));
    await fireEvent.changeText(screen.getByTestId("report-min-amount"), "12,5");
    await fireEvent.changeText(screen.getByTestId("report-name"), "Kasım");
    await fireEvent.press(screen.getByTestId("submit-report"));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      report_type: "pos_detail",
      custom_name: "Kasım",
      start_date: todayApi,
      end_date: todayApi,
      company: 1,
      transaction_status: "false",
      min_amount: "12.50",
    });
    expect(screen.getByTestId("submit-report")).toBeDisabled();
    await fireEvent.press(screen.getByTestId("submit-report"));
    expect(mock.history.post).toHaveLength(1);

    resolve([202, { detail: "ok", job_id: 77, status: "pending", estimated_rows: 1200 }]);
    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
  });

  it("yeniden çizimden önce gelen çift dokunuşta tek POST atar", async () => {
    let resolve: (v: [number, unknown]) => void = () => {};
    mock.onPost("/reports/").reply(() => new Promise((r) => (resolve = r)));
    await renderWithProviders(<NewReportScreen />);
    await screen.findByText("Özet");

    // Aynı render'ın onPress'i iki kez senkron çağrılır (arada yeniden çizim yok → render'daki isPending false)
    const onPress = pressHandlerOf(screen.getByTestId("submit-report"));
    await act(async () => {
      onPress();
      onPress();
    });
    await waitFor(() => expect(mock.history.post).toHaveLength(1));

    resolve([202, { detail: "ok", job_id: 78, status: "pending", estimated_rows: 1 }]);
    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
    expect(mock.history.post).toHaveLength(1);
  });

  it("hata sonrası kilit açılır, tekrar gönderilebilir", async () => {
    mock.onPost("/reports/").replyOnce(500, {});
    mock.onPost("/reports/").reply(202, { detail: "ok", job_id: 79, status: "pending", estimated_rows: 1 });
    await renderWithProviders(<NewReportScreen />);
    await screen.findByText("Özet");

    await fireEvent.press(screen.getByTestId("submit-report"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    await waitFor(() => expect(screen.getByTestId("submit-report")).toBeEnabled());
    await fireEvent.press(screen.getByTestId("submit-report"));
    await waitFor(() => expect(mock.history.post).toHaveLength(2));
    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
  });

  it("geçersiz aralıkta istek atmaz", async () => {
    await renderWithProviders(<NewReportScreen />);
    await screen.findByText("Özet");
    await fireEvent.changeText(screen.getByTestId("report-start"), "31.12.2999");
    await fireEvent.changeText(screen.getByTestId("report-end"), today);
    await fireEvent.press(screen.getByTestId("submit-report"));
    expect(await screen.findByText("Başlangıç tarihi bitiş tarihinden sonra olamaz.")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);
  });

  it("429'da eşzamanlı rapor uyarısı ve raporlara git aksiyonu gösterir", async () => {
    mock.onPost("/reports/").reply(429, { detail: "Önceki raporunuz hazırlanıyor, lütfen bitmesini bekleyin." });
    await renderWithProviders(<NewReportScreen />);
    await screen.findByText("Özet");
    await fireEvent.press(screen.getByTestId("submit-report"));

    expect(await screen.findByText("Önceki rapor hazırlanıyor")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Raporlara git"));
    expect(mockNavigate).toHaveBeenCalledWith("Reports");
    expect(mockGoBack).not.toHaveBeenCalled();
  });

  it("404'te kayıt bulunamadı mesajı", async () => {
    mock.onPost("/reports/").reply(404, { detail: "Bu filtrelerle hiç kayıt bulunamadı." });
    await renderWithProviders(<NewReportScreen />);
    await screen.findByText("Özet");
    await fireEvent.press(screen.getByTestId("submit-report"));
    expect(await screen.findByText("Kayıt bulunamadı")).toBeOnTheScreen();
  });

  it("oturumdaki şirket önseçili gider; bölge seçimi cihaz listesine çevrilir (web)", async () => {
    mock.onGet("/reports/filter-options/").reply(200, {
      ...filterOptions,
      companies: [
        { id: 1, name: "Şirket A" },
        { id: 2, name: "Şirket B" },
      ],
      regions: [{ id: 7, name: "B Bölge", company_id: 2 }],
      locations: [{ id: 8, name: "B Konum", region_id: 7, region_name: "B Bölge" }],
      devices: [...filterOptions.devices, { id: 9, sn: "SN-B", pos_name: "B Otomat", company_id: 2, location_id: 8 }],
    });
    mock.onPost("/reports/").reply(202, { detail: "ok", job_id: 1, status: "pending", estimated_rows: 1 });
    useAuthStore.setState({ user: makeUser({ permissions: ["owner", "view_sales"] }), selectedCompanyId: 2 });

    await renderWithProviders(<NewReportScreen />);
    await screen.findByText("Özet");
    expect(screen.getByText("Tüm POS cihazları (1)")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("submit-report"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    const body = JSON.parse(mock.history.post[0].data);
    expect(body.company).toBe(2);
    expect(body).not.toHaveProperty("companies");
    expect(body).not.toHaveProperty("regions");
  });
});
