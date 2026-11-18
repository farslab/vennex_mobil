import React from "react";
import MockAdapter from "axios-mock-adapter";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import ReportsListScreen from "@/screens/reports/ReportsListScreen";
import { useAuthStore } from "@/store/authStore";
import { makeUser, renderWithProviders } from "@/test/utils";
import type { ReportJob } from "@/types/reports";

// İkon fontu yükleyicisi (expo-font/expo-asset) testte gereksiz
jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), setOptions: jest.fn(), setParams: jest.fn() }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));

const mockDownloadFileAsync = jest.fn();
jest.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache" },
  Directory: jest.fn().mockImplementation(() => ({ create: jest.fn() })),
  File: { downloadFileAsync: (...args: unknown[]) => mockDownloadFileAsync(...args) },
}));
jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(async () => true),
  shareAsync: jest.fn(async () => undefined),
}));

const job = (over: Partial<ReportJob>): ReportJob => ({
  id: 1,
  report_type: "pos_summary",
  custom_name: "",
  status: "completed",
  progress_pct: 100,
  row_count: 120,
  estimated_rows: 120,
  file_size_bytes: 20480,
  error_message: null,
  created_at: "2026-11-18T09:00:00Z",
  finished_at: "2026-11-18T09:01:00Z",
  expires_at: "2099-01-01T00:00:00Z",
  is_active: false,
  is_downloadable: true,
  download_count: 0,
  ...over,
});

const listResponse = (results: ReportJob[]) => ({ retention_hours: 24, user_report_limit: 20, results });
const listGets = (mock: MockAdapter) => mock.history.get.filter((r) => r.url === "/reports/");

describe("ReportsListScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet("/reports/filter-options/").reply(200, {
      report_types: [{ value: "pos_summary", label: "Cihaz Bazlı Özet" }],
    });
    useAuthStore.setState({ user: makeUser({ permissions: ["owner", "view_sales"] }) });
  });
  afterEach(() => {
    mock.restore();
    jest.useRealTimers();
  });

  it("yetki yoksa istek atmadan yetki mesajı gösterir", async () => {
    useAuthStore.setState({ user: makeUser({ role: "tech", permissions: ["tech"] }) });
    await renderWithProviders(<ReportsListScreen />);
    expect(screen.getByText("Rapor yetkiniz yok")).toBeOnTheScreen();
    expect(mock.history.get).toHaveLength(0);
  });

  it("boş liste ve saklama bilgisi", async () => {
    mock.onGet("/reports/").reply(200, listResponse([]));
    await renderWithProviders(<ReportsListScreen />);
    expect(await screen.findByText("Henüz rapor yok")).toBeOnTheScreen();
    expect(screen.getByText("Son 20 rapor listelenir · dosyalar 24 saat saklanır")).toBeOnTheScreen();
  });

  it("hata durumunda tekrar dene", async () => {
    mock.onGet("/reports/").replyOnce(500, { detail: "Sunucu hatası" });
    mock.onGet("/reports/").reply(200, listResponse([job({ id: 3, custom_name: "Ekim" })]));
    await renderWithProviders(<ReportsListScreen />);
    expect(await screen.findByText("Sunucu hatası")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Tekrar dene"));
    expect(await screen.findByText("Ekim")).toBeOnTheScreen();
  });

  it("bekleyen iş varken artan aralıkla poll eder, iş bitince durur", async () => {
    jest.useFakeTimers();
    const responses = [
      listResponse([job({ id: 5, status: "pending", is_active: true, progress_pct: 0, is_downloadable: false })]),
      listResponse([job({ id: 5, status: "running", is_active: true, progress_pct: 40, is_downloadable: false })]),
      listResponse([job({ id: 5, status: "completed" })]),
    ];
    const times: number[] = [];
    mock.onGet("/reports/").reply(() => {
      times.push(Date.now());
      return [200, responses[Math.min(times.length - 1, responses.length - 1)]];
    });

    await renderWithProviders(<ReportsListScreen />);
    expect(await screen.findByText("Sırada")).toBeOnTheScreen();
    expect(listGets(mock)).toHaveLength(1);

    const advance = async (ms: number) => {
      await act(async () => {
        await jest.advanceTimersByTimeAsync(ms);
      });
    };

    // 3 sn'den önce istek yok
    await advance(2900);
    expect(times).toHaveLength(1);
    await advance(200);
    expect(times).toHaveLength(2);
    expect(screen.getByText("%40 tamamlandı")).toBeOnTheScreen();

    // İkinci aralık 5 sn (3 sn sonra henüz istek yok)
    await advance(3000);
    expect(times).toHaveLength(2);
    await advance(2100);
    expect(times).toHaveLength(3);
    expect(screen.getByText("Hazır")).toBeOnTheScreen();

    // Aralıklar artıyor: ~3 sn, ~5 sn
    const gaps = times.slice(1).map((t, i) => t - times[i]);
    expect(gaps[0]).toBeGreaterThanOrEqual(3000);
    expect(gaps[0]).toBeLessThan(3100);
    expect(gaps[1]).toBeGreaterThanOrEqual(5000);
    expect(gaps[1]).toBeLessThan(5100);

    // Aktif iş kalmadı → polling durur
    await advance(60_000);
    expect(times).toHaveLength(3);
    expect(listGets(mock)).toHaveLength(3);
  });

  it("aktif iş yoksa hiç poll etmez", async () => {
    jest.useFakeTimers();
    mock.onGet("/reports/").reply(200, listResponse([job({ id: 6 })]));
    await renderWithProviders(<ReportsListScreen />);
    expect(await screen.findByText("Hazır")).toBeOnTheScreen();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(30_000);
    });
    expect(listGets(mock)).toHaveLength(1);
  });

  it("indirme hatası kart üzerinde gösterilir", async () => {
    mock.onGet("/reports/").reply(200, listResponse([job({ id: 8 })]));
    mock.onGet("/reports/8/").reply(200, job({ id: 8 }));
    mockDownloadFileAsync.mockRejectedValue(new Error("UnableToDownload: HTTP 404"));

    await renderWithProviders(<ReportsListScreen />);
    await fireEvent.press(await screen.findByTestId("report-download-8"));

    expect(await screen.findByTestId("report-download-error-8")).toHaveTextContent(
      "Rapor dosyası bulunamadı ya da saklama süresi doldu."
    );
  });

  it("tekrar dene yeni job oluşturur ve listeyi yeniler", async () => {
    mock
      .onGet("/reports/")
      .replyOnce(200, listResponse([job({ id: 9, status: "failed", is_downloadable: false, error_message: "Zaman aşımı" })]))
      .onGet("/reports/")
      .reply(200, listResponse([job({ id: 10, status: "pending", is_active: true, is_downloadable: false })]));
    mock.onPost("/reports/9/retry/").reply(202, job({ id: 10, status: "pending", is_active: true, is_downloadable: false }));

    await renderWithProviders(<ReportsListScreen />);
    expect(await screen.findByText("Zaman aşımı")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("report-retry-9"));

    await waitFor(() => expect(mock.history.post.map((r) => r.url)).toEqual(["/reports/9/retry/"]));
    expect(await screen.findByTestId("report-job-10")).toBeOnTheScreen();
  });

  it("iptal onay sayfasından sonra cancel çağrılır", async () => {
    mock.onGet("/reports/").reply(200, listResponse([job({ id: 11, status: "running", is_active: true, is_downloadable: false })]));
    mock.onPost("/reports/11/cancel/").reply(200, job({ id: 11, status: "cancelled", is_downloadable: false }));

    await renderWithProviders(<ReportsListScreen />);
    await fireEvent.press(await screen.findByTestId("report-cancel-11"));
    expect(mock.history.post).toHaveLength(0);
    expect(await screen.findByText("Rapor iptal edilsin mi?")).toBeOnTheScreen();
    const buttons = screen.getAllByText("İptal et");
    await fireEvent.press(buttons[buttons.length - 1]);
    await waitFor(() => expect(mock.history.post.map((r) => r.url)).toEqual(["/reports/11/cancel/"]));
  });
});
