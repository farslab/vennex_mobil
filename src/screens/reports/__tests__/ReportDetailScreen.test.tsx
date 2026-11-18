import React from "react";
import MockAdapter from "axios-mock-adapter";
import * as Sharing from "expo-sharing";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { useToastStore } from "@/design-system";
import ReportDetailScreen from "@/screens/reports/ReportDetailScreen";
import { useAuthStore } from "@/store/authStore";
import { makeUser, renderWithProviders } from "@/test/utils";
import { XLSX_MIME, type ReportJob } from "@/types/reports";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));
// Paralel koşuda ilk testin soğuk modül dönüşümü 5 sn varsayılanını aşabiliyor
jest.setTimeout(20_000);

const mockRoute: { params: { id: unknown } } = { params: { id: 5 } };
const mockGoBack = jest.fn();
const mockSetParams = jest.fn((p: { id: number }) => {
  mockRoute.params = { ...mockRoute.params, ...p };
});
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack, setOptions: jest.fn(), setParams: mockSetParams }),
  useRoute: () => mockRoute,
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

const job = (over: Partial<ReportJob> = {}): ReportJob => ({
  id: 5,
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
  download_count: 3,
  ...over,
});
const ACTIVE = { is_active: true, is_downloadable: false, finished_at: null };

const detailGets = (mock: MockAdapter, id = 5) => mock.history.get.filter((r) => r.url === `/reports/${id}/`);
const toastMessage = () => useToastStore.getState().current?.message ?? null;

describe("ReportDetailScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet("/reports/filter-options/").reply(200, { report_types: [{ value: "pos_summary", label: "Cihaz Bazlı Özet" }] });
    mockRoute.params = { id: 5 };
    useAuthStore.setState({ user: makeUser({ permissions: ["owner", "view_sales"] }) });
    useToastStore.setState({ current: null });
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(true);
  });
  afterEach(() => {
    mock.restore();
    jest.useRealTimers();
  });

  /* -------------------------------------------------------- erişim/geçerlilik */

  it("view_sales yetkisi yoksa istek atmadan yetki mesajı gösterir", async () => {
    useAuthStore.setState({ user: makeUser({ role: "owner", permissions: ["owner"] }) });
    await renderWithProviders(<ReportDetailScreen />);
    expect(screen.getByText("Rapor yetkiniz yok")).toBeOnTheScreen();
    expect(mock.history.get).toHaveLength(0);
  });

  it.each([["abc"], [0], [-3], [1.5]])("geçersiz id (%p) için istek atmadan 'Rapor bulunamadı'", async (id) => {
    mockRoute.params = { id };
    await renderWithProviders(<ReportDetailScreen />);
    expect(screen.getByText("Rapor bulunamadı")).toBeOnTheScreen();
    expect(mock.history.get).toHaveLength(0);
  });

  /* ---------------------------------------------------------------- durumlar */

  it("tamamlanmış rapor: başlık, tip, satır/boyut, bitiş ve indirme sayısı gösterilir", async () => {
    mock.onGet("/reports/5/").reply(200, job({ custom_name: "Ekim satışları" }));
    await renderWithProviders(<ReportDetailScreen />);
    expect(await screen.findByText("Ekim satışları")).toBeOnTheScreen();
    expect(screen.getByText("Hazır")).toBeOnTheScreen();
    expect(await screen.findByText(/^Cihaz Bazlı Özet · /)).toBeOnTheScreen();
    expect(screen.getByText(/^120 satır · 20 KB · \d+ gün içinde silinecek$/)).toBeOnTheScreen();
    expect(screen.getByText(/Bitiş: .* · 3 kez indirildi/)).toBeOnTheScreen();
    expect(screen.getByTestId("report-download-5")).toBeOnTheScreen();
    expect(screen.getByTestId("report-delete-5")).toBeOnTheScreen();
    expect(screen.queryByTestId("report-cancel-5")).toBeNull();
    expect(screen.queryByTestId("report-retry-5")).toBeNull();
  });

  it.each([
    ["pending", { status: "pending", progress_pct: 0, ...ACTIVE }, "Sırada", "Sırada bekliyor", { cancel: true, retry: false, del: false, dl: false }],
    ["running", { status: "running", progress_pct: 40, ...ACTIVE }, "Hazırlanıyor", "%40 tamamlandı", { cancel: true, retry: false, del: false, dl: false }],
    ["failed", { status: "failed", is_downloadable: false, error_message: "Zaman aşımı" }, "Başarısız", "Zaman aşımı", { cancel: false, retry: true, del: true, dl: false }],
    ["cancelled", { status: "cancelled", is_downloadable: false }, "İptal edildi", null, { cancel: false, retry: true, del: true, dl: false }],
    ["süresi dolmuş", { status: "completed", is_downloadable: false }, "Süresi doldu", null, { cancel: false, retry: true, del: true, dl: false }],
  ])("%s durumu doğru rozet ve aksiyonlarla gösterilir", async (_name, over, badge, extra, a) => {
    mock.onGet("/reports/5/").reply(200, job(over as Partial<ReportJob>));
    await renderWithProviders(<ReportDetailScreen />);
    expect(await screen.findByText(badge)).toBeOnTheScreen();
    if (extra) expect(screen.getByText(extra)).toBeOnTheScreen();
    expect(!!screen.queryByTestId("report-cancel-5")).toBe(a.cancel);
    expect(!!screen.queryByTestId("report-retry-5")).toBe(a.retry);
    expect(!!screen.queryByTestId("report-delete-5")).toBe(a.del);
    expect(!!screen.queryByTestId("report-download-5")).toBe(a.dl);
  });

  it("yükleme hatasında hata durumu ve tekrar dene", async () => {
    mock.onGet("/reports/5/").replyOnce(404, { detail: "Bulunamadı." });
    mock.onGet("/reports/5/").reply(200, job());
    await renderWithProviders(<ReportDetailScreen />);
    expect(await screen.findByText("Bulunamadı.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Tekrar dene"));
    expect(await screen.findByText("Hazır")).toBeOnTheScreen();
    expect(detailGets(mock)).toHaveLength(2);
  });

  it("aktif işte 3 sn sonra yeniden çeker; iş bitince polling durur", async () => {
    jest.useFakeTimers();
    mock
      .onGet("/reports/5/")
      .replyOnce(200, job({ status: "running", progress_pct: 40, ...ACTIVE }))
      .onGet("/reports/5/")
      .reply(200, job());
    await renderWithProviders(<ReportDetailScreen />);
    expect(await screen.findByText("%40 tamamlandı")).toBeOnTheScreen();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(2900);
    });
    expect(detailGets(mock)).toHaveLength(1);
    await act(async () => {
      await jest.advanceTimersByTimeAsync(200);
    });
    expect(detailGets(mock)).toHaveLength(2);
    expect(screen.getByText("Hazır")).toBeOnTheScreen();
    await act(async () => {
      await jest.advanceTimersByTimeAsync(60_000);
    });
    expect(detailGets(mock)).toHaveLength(2);
  });

  /* ------------------------------------------------------------------ indir */

  it("indir: güncel durumu doğrular, dosyayı indirir ve XLSX olarak paylaşır", async () => {
    mock.onGet("/reports/5/").reply(200, job());
    mockDownloadFileAsync.mockResolvedValue({ name: "pos_ozet.xlsx", uri: "file:///cache/reports/5/pos_ozet.xlsx", rename: jest.fn() });
    await renderWithProviders(<ReportDetailScreen />);
    await fireEvent.press(await screen.findByTestId("report-download-5"));
    await waitFor(() => expect(Sharing.shareAsync).toHaveBeenCalledTimes(1));
    expect(Sharing.shareAsync).toHaveBeenCalledWith(
      "file:///cache/reports/5/pos_ozet.xlsx",
      expect.objectContaining({ mimeType: XLSX_MIME, dialogTitle: "pos_ozet.xlsx" })
    );
    expect(mockDownloadFileAsync).toHaveBeenCalledTimes(1);
    expect(String(mockDownloadFileAsync.mock.calls[0][0])).toMatch(/\/reports\/5\/download\/$/);
    // İlk yükleme + indirme öncesi tazelik kontrolü
    expect(detailGets(mock).length).toBeGreaterThanOrEqual(2);
  });

  it("paylaşım desteklenmiyorsa bilgi bildirimi gösterilir", async () => {
    (Sharing.isAvailableAsync as jest.Mock).mockResolvedValue(false);
    mock.onGet("/reports/5/").reply(200, job());
    mockDownloadFileAsync.mockResolvedValue({ name: "pos_ozet.xlsx", uri: "file:///x.xlsx", rename: jest.fn() });
    await renderWithProviders(<ReportDetailScreen />);
    await fireEvent.press(await screen.findByTestId("report-download-5"));
    await waitFor(() =>
      expect(toastMessage()).toBe("Dosya indirildi (pos_ozet.xlsx) ancak bu cihazda paylaşım desteklenmiyor.")
    );
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it("indirme anında rapor artık indirilemezse dosya istenmez, hata kart üzerinde gösterilir", async () => {
    mock.onGet("/reports/5/").replyOnce(200, job()).onGet("/reports/5/").reply(200, job({ is_downloadable: false }));
    await renderWithProviders(<ReportDetailScreen />);
    await fireEvent.press(await screen.findByTestId("report-download-5"));
    expect(await screen.findByTestId("report-download-error-5")).toHaveTextContent(
      "Rapor indirilemez: henüz tamamlanmamış veya saklama süresi dolmuş."
    );
    expect(mockDownloadFileAsync).not.toHaveBeenCalled();
  });

  /* ------------------------------------------------------------------ iptal */

  it("iptal: onay sayfası özetiyle açılır, Vazgeç'te istek atılmaz", async () => {
    mock.onGet("/reports/5/").reply(200, job({ status: "running", progress_pct: 10, ...ACTIVE }));
    await renderWithProviders(<ReportDetailScreen />);
    await fireEvent.press(await screen.findByTestId("report-cancel-5"));
    expect(screen.getByText("Rapor iptal edilsin mi?")).toBeOnTheScreen();
    expect(screen.getAllByText("Cihaz Bazlı Özet").length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByText("Vazgeç"));
    expect(screen.queryByText("Rapor iptal edilsin mi?")).toBeNull();
    expect(mock.history.post).toHaveLength(0);
  });

  it("iptal onaylanınca cancel çağrılır ve güncel durum gösterilir", async () => {
    mock
      .onGet("/reports/5/")
      .replyOnce(200, job({ status: "running", progress_pct: 10, ...ACTIVE }))
      .onGet("/reports/5/")
      .reply(200, job({ status: "cancelled", is_downloadable: false }));
    mock.onPost("/reports/5/cancel/").reply(200, job({ status: "cancelled", is_downloadable: false }));
    await renderWithProviders(<ReportDetailScreen />);
    await fireEvent.press(await screen.findByTestId("report-cancel-5"));
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.post.map((r) => r.url)).toEqual(["/reports/5/cancel/"]));
    expect(await screen.findByText("İptal edildi")).toBeOnTheScreen();
    expect(screen.queryByText("Rapor iptal edilsin mi?")).toBeNull();
    expect(toastMessage()).toBe("Rapor iptal edildi.");
  });

  it("iptal hatası bildirim olarak gösterilir", async () => {
    mock.onGet("/reports/5/").reply(200, job({ status: "running", progress_pct: 10, ...ACTIVE }));
    mock.onPost("/reports/5/cancel/").reply(400, { detail: "Rapor zaten tamamlandı." });
    await renderWithProviders(<ReportDetailScreen />);
    await fireEvent.press(await screen.findByTestId("report-cancel-5"));
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(toastMessage()).toBe("Rapor zaten tamamlandı."));
  });

  /* ------------------------------------------------------------ tekrar dene */

  it("tekrar dene YENİ job döndürür; ekran yeni id'ye geçer", async () => {
    mock.onGet("/reports/5/").reply(200, job({ status: "failed", is_downloadable: false, error_message: "Zaman aşımı" }));
    mock.onGet("/reports/10/").reply(200, job({ id: 10, status: "pending", progress_pct: 0, ...ACTIVE }));
    mock.onPost("/reports/5/retry/").reply(202, job({ id: 10, status: "pending", ...ACTIVE }));
    const r = await renderWithProviders(<ReportDetailScreen />);
    await fireEvent.press(await screen.findByTestId("report-retry-5"));
    await waitFor(() => expect(mockSetParams).toHaveBeenCalledWith({ id: 10 }));
    expect(mock.history.post.map((x) => x.url)).toEqual(["/reports/5/retry/"]);
    expect(toastMessage()).toBe("Rapor yeniden kuyruğa alındı.");

    await r.rerender(<ReportDetailScreen />);
    expect(await screen.findByTestId("report-job-10")).toBeOnTheScreen();
    expect(screen.getByText("Sırada bekliyor")).toBeOnTheScreen();
  });

  it("başka aktif iş varken (429) tekrar dene hatası gösterilir, ekran değişmez", async () => {
    mock.onGet("/reports/5/").reply(200, job({ status: "failed", is_downloadable: false, error_message: "Zaman aşımı" }));
    mock.onPost("/reports/5/retry/").reply(429, { detail: "Devam eden bir raporunuz var." });
    await renderWithProviders(<ReportDetailScreen />);
    await fireEvent.press(await screen.findByTestId("report-retry-5"));
    await waitFor(() => expect(toastMessage()).toBe("Devam eden bir raporunuz var."));
    expect(mockSetParams).not.toHaveBeenCalled();
  });

  /* -------------------------------------------------------------------- sil */

  it("sil: geri alınamaz uyarılı onaydan sonra DELETE atar ve geri döner", async () => {
    mock.onGet("/reports/5/").reply(200, job());
    mock.onDelete("/reports/5/").reply(204);
    const { queryClient } = await renderWithProviders(<ReportDetailScreen />);
    await fireEvent.press(await screen.findByTestId("report-delete-5"));
    expect(screen.getByText("Rapor silinsin mi?")).toBeOnTheScreen();
    expect(screen.getByText("Bu işlem geri alınamaz.")).toBeOnTheScreen();
    expect(mock.history.delete).toHaveLength(0);
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mockGoBack).toHaveBeenCalledTimes(1));
    expect(mock.history.delete.map((r) => r.url)).toEqual(["/reports/5/"]);
    expect(toastMessage()).toBe("Rapor silindi.");
    // Testte goBack ekranı kaldırmadığı için invalidate sonrası yeniden çekim bitene kadar bekle
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));  });

  it("silme hatasında geri dönülmez, hata bildirilir", async () => {
    mock.onGet("/reports/5/").reply(200, job());
    mock.onDelete("/reports/5/").reply(400, { detail: "Aktif rapor silinemez." });
    await renderWithProviders(<ReportDetailScreen />);
    await fireEvent.press(await screen.findByTestId("report-delete-5"));
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(toastMessage()).toBe("Aktif rapor silinemez."));
    expect(mockGoBack).not.toHaveBeenCalled();
    expect(screen.getByText("Rapor silinsin mi?")).toBeOnTheScreen();
  });
});
