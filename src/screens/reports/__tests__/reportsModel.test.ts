import MockAdapter from "axios-mock-adapter";
import { apiClient } from "@/api/client";
import {
  ensureXlsxExtension,
  fallbackReportFileName,
  parseContentDispositionFileName,
  reportsApi,
} from "@/api/reports";
import { tokenStorage } from "@/utils/tokenStorage";
import { resetSecureStore } from "@/test/utils";
import { initialReportForm, pruneSelections, validateReportForm } from "@/screens/reports/reportForm";
import { nextPollDelay } from "@/screens/reports/useReportsPolling";
import type { ReportFilterOptions } from "@/types/reports";

const mockDownloadFileAsync = jest.fn();
const mockRename = jest.fn();
jest.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache" },
  Directory: jest.fn().mockImplementation(() => ({ create: jest.fn() })),
  File: { downloadFileAsync: (...args: unknown[]) => mockDownloadFileAsync(...args) },
}));

const job = {
  id: 7,
  report_type: "pos_summary",
  custom_name: "",
  status: "completed",
  progress_pct: 100,
  row_count: 10,
  estimated_rows: 10,
  file_size_bytes: 100,
  error_message: null,
  created_at: "2026-11-18T09:05:00",
  finished_at: null,
  expires_at: null,
  is_active: false,
  is_downloadable: true,
  download_count: 0,
};

describe("reportForm", () => {
  const today = new Date(2026, 10, 18);

  it("boş filtreleri göndermez, tarihleri ISO yapar", () => {
    const form = { ...initialReportForm(today), reportType: "pos_summary", startInput: "01.11.2026", endInput: "18.11.2026" };
    expect(validateReportForm(form, today)).toEqual({
      ok: true,
      payload: { report_type: "pos_summary", start_date: "2026-11-01", end_date: "2026-11-18" },
    });
  });

  it("çoğul dizi anahtarları, ondalık tutar ve başarısızlık nedeni", () => {
    const form = {
      ...initialReportForm(today),
      reportType: "pos_detail",
      customName: "  Kasım  ",
      startInput: "01.11.2026",
      endInput: "02.11.2026",
      companies: [1],
      regions: [2],
      locations: [3],
      devices: ["PAV1"],
      transactionStatus: "fail" as const,
      paymentType: "1",
      minAmount: "12,5",
      failureReason: "2" as const,
    };
    const res = validateReportForm(form, today);
    expect(res).toEqual({
      ok: true,
      payload: {
        report_type: "pos_detail",
        custom_name: "Kasım",
        start_date: "2026-11-01",
        end_date: "2026-11-02",
        companies: [1],
        regions: [2],
        locations: [3],
        devices: ["PAV1"],
        transaction_status: "fail",
        payment_type: "1",
        min_amount: "12.50",
        failure_reason: "2",
      },
    });
  });

  it("NFC raporunda yalnız NFC filtreleri gönderilir", () => {
    const form = {
      ...initialReportForm(today),
      reportType: "nfc_balance_logs",
      devices: ["PAV1"],
      nfcSource: "pos",
      minAmount: "abc",
    };
    const res = validateReportForm(form, today);
    expect(res.ok && res.payload).toEqual({
      report_type: "nfc_balance_logs",
      start_date: "2026-11-18",
      end_date: "2026-11-18",
      nfc_source: "pos",
    });
  });

  it("ters aralık, gelecek tarih ve geçersiz tutar hata verir", () => {
    const base = { ...initialReportForm(today), reportType: "pos_detail" };
    expect(validateReportForm({ ...base, startInput: "10.11.2026", endInput: "01.11.2026" }, today)).toMatchObject({
      ok: false,
      errors: { range: expect.any(String) },
    });
    expect(validateReportForm({ ...base, endInput: "19.11.2026" }, today)).toMatchObject({
      ok: false,
      errors: { endInput: expect.any(String) },
    });
    expect(validateReportForm({ ...base, minAmount: "-3" }, today)).toMatchObject({
      ok: false,
      errors: { minAmount: expect.any(String) },
    });
  });

  it("şirket değişince geçersiz alt seçimleri temizler", () => {
    const options = {
      regions: [
        { id: 1, name: "A", company_id: 1 },
        { id: 2, name: "B", company_id: 2 },
      ],
      locations: [
        { id: 10, name: "L1", region_id: 1, region_name: "A" },
        { id: 20, name: "L2", region_id: 2, region_name: "B" },
      ],
      devices: [
        { id: 1, sn: "S1", pos_name: null, company_id: 1, location_id: 10 },
        { id: 2, sn: "S2", pos_name: null, company_id: 2, location_id: 20 },
      ],
    } as unknown as ReportFilterOptions;
    const form = { ...initialReportForm(today), companies: [1], regions: [1, 2], locations: [10, 20], devices: ["S1", "S2"] };
    expect(pruneSelections(form, options)).toMatchObject({ regions: [1], locations: [10], devices: ["S1"] });
  });
});

describe("poll delays", () => {
  it("3 → 5 → 10 → 15 sn, sonra sabit", () => {
    expect([0, 1, 2, 3, 4, 9].map(nextPollDelay)).toEqual([3000, 5000, 10000, 15000, 15000, 15000]);
  });
});

describe("dosya adı yardımcıları", () => {
  it("uzantıyı garanti eder ve Content-Disposition'u ayrıştırır", () => {
    expect(ensureXlsxExtension("Rapor")).toBe("Rapor.xlsx");
    expect(ensureXlsxExtension("Rapor.XLSX")).toBe("Rapor.XLSX");
    expect(ensureXlsxExtension('a/b:c"d')).toBe("a b c d.xlsx");
    expect(parseContentDispositionFileName('attachment; filename="POS_ozet.xlsx"')).toBe("POS_ozet.xlsx");
    expect(parseContentDispositionFileName("attachment; filename*=UTF-8''Kas%C4%B1m.xlsx")).toBe("Kasım.xlsx");
    expect(parseContentDispositionFileName(null)).toBeNull();
  });

  it("yedek ad tip + tarih damgası içerir", () => {
    expect(fallbackReportFileName(job)).toBe("POS_ozet_20261118_0905.xlsx");
    expect(fallbackReportFileName({ ...job, custom_name: "Kasım" })).toBe("Kasım_20261118_0905.xlsx");
  });
});

describe("reportsApi", () => {
  let mock: MockAdapter;
  beforeEach(async () => {
    mock = new MockAdapter(apiClient);
    resetSecureStore();
    await tokenStorage.setTokens("ACCESS", "REFRESH");
  });
  afterEach(() => mock.restore());

  it("liste ve filtre seçeneklerini normalize eder", async () => {
    mock.onGet("/reports/").reply(200, { retention_hours: 24, user_report_limit: 20, results: [{ ...job, progress_pct: "50" }, null] });
    const list = await reportsApi.list();
    expect(list.results).toHaveLength(1);
    expect(list.results[0].progress_pct).toBe(50);

    mock.onGet("/reports/filter-options/").reply(200, { report_types: [{ value: "pos_detail", label: "Detay" }], devices: [{ id: 1 }] });
    const opts = await reportsApi.filterOptions();
    expect(opts.report_types).toEqual([{ value: "pos_detail", label: "Detay" }]);
    expect(opts.devices).toEqual([]); // sn'siz cihaz atılır
    expect(opts.has_personel_kart_pos).toBe(false);
  });

  it("retry yeni job döner", async () => {
    mock.onPost("/reports/7/retry/").reply(202, { ...job, id: 99, status: "pending", is_active: true });
    await expect(reportsApi.retry(7)).resolves.toMatchObject({ id: 99, is_active: true });
  });

  it("indirme: Authorization header'ı ile indirir ve .xlsx uzantısı ekler", async () => {
    mock.onGet("/reports/7/").reply(200, job);
    mockDownloadFileAsync.mockResolvedValue({ name: "POS_ozet_20261118", uri: "file:///cache/reports/x/POS_ozet_20261118", rename: mockRename });
    const res = await reportsApi.download(job);
    const [url, , options] = mockDownloadFileAsync.mock.calls[0];
    expect(url).toMatch(/\/reports\/7\/download\/$/);
    expect(options.headers.Authorization).toBe("Bearer ACCESS");
    expect(mockRename).toHaveBeenCalledWith("POS_ozet_20261118.xlsx");
    expect(res.fileName).toBe("POS_ozet_20261118.xlsx");
  });

  it("indirme: indirilemez job'da dosya isteği atmaz", async () => {
    mock.onGet("/reports/7/").reply(200, { ...job, is_downloadable: false });
    await expect(reportsApi.download(job)).rejects.toThrow(/indirilemez/);
    expect(mockDownloadFileAsync).not.toHaveBeenCalled();
  });

  it("indirme: native 404 hatası anlaşılır mesaja çevrilir", async () => {
    mock.onGet("/reports/7/").reply(200, job);
    mockDownloadFileAsync.mockRejectedValue(new Error("UnableToDownload: status code 404"));
    await expect(reportsApi.download(job)).rejects.toMatchObject({ status: 404, message: expect.stringMatching(/saklama süresi/) });
  });
});
