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
import {
  availableDevices,
  defaultReportType,
  initialReportForm,
  monthlyAnalysisAvailable,
  pruneSelections,
  scopeDevices,
  validateReportForm,
  visibleReportTypes,
} from "@/screens/reports/reportForm";
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

describe("reportForm (web formuyla aynı sözleşme)", () => {
  const today = new Date(2026, 10, 18);
  const options = {
    report_types: [
      { value: "pos_detail", label: "POS işlem detayı" },
      { value: "pos_summary", label: "POS işlem özeti" },
      { value: "nfc_balance_logs", label: "PersonelKart Hareketleri" },
      { value: "nfc_monthly_analysis", label: "PersonelKart Aylık Analiz" },
    ],
    companies: [
      { id: 1, name: "A" },
      { id: 2, name: "B" },
    ],
    regions: [
      { id: 1, name: "R1", company_id: 1 },
      { id: 2, name: "R2", company_id: 2 },
      { id: 3, name: "R3 boş", company_id: 1 },
    ],
    locations: [
      { id: 10, name: "L1", region_id: 1, region_name: "R1" },
      { id: 11, name: "L1b", region_id: 1, region_name: "R1" },
      { id: 20, name: "L2", region_id: 2, region_name: "R2" },
      { id: 30, name: "L3", region_id: 3, region_name: "R3 boş" },
    ],
    devices: [
      { id: 1, sn: "S1", pos_name: null, company_id: 1, location_id: 10 },
      { id: 2, sn: "S2", pos_name: null, company_id: 1, location_id: 11 },
      { id: 3, sn: "S3", pos_name: null, company_id: 2, location_id: 20 },
      { id: 4, sn: "S4", pos_name: null, company_id: 1, location_id: null },
    ],
    has_personel_kart_pos: true,
    nfc_sources: [],
    nfc_operations: [],
  } as ReportFilterOptions;

  it("tipler web sırası ve adlarıyla; aylık analiz ayrı tip değil; varsayılan Özet", () => {
    expect(visibleReportTypes(options).map((t) => `${t.value}:${t.label}`)).toEqual([
      "pos_summary:Özet",
      "pos_detail:Detay",
      "nfc_balance_logs:PersonelKart Hareketleri",
    ]);
    expect(defaultReportType(options)).toBe("pos_summary");
    expect(monthlyAnalysisAvailable(options)).toBe(true);
    const noNfc = { ...options, has_personel_kart_pos: false };
    expect(visibleReportTypes(noNfc).map((t) => t.value)).toEqual(["pos_summary", "pos_detail"]);
    expect(monthlyAnalysisAvailable(noNfc)).toBe(false);
  });

  it("varsayılan durum Başarılı → transaction_status 'true'; şirket tekil", () => {
    const form = { ...initialReportForm(today, 1), reportType: "pos_summary", startInput: "01.11.2026", endInput: "18.11.2026" };
    expect(validateReportForm(form, options, today)).toEqual({
      ok: true,
      payload: {
        report_type: "pos_summary",
        start_date: "2026-11-01",
        end_date: "2026-11-18",
        company: 1,
        transaction_status: "true",
      },
    });
  });

  it("Başarısız → 'false' + sebep; Tümü → durum gönderilmez; tutar ondalık", () => {
    const base = { ...initialReportForm(today), reportType: "pos_detail", startInput: "01.11.2026", endInput: "02.11.2026" };
    const fail = validateReportForm(
      { ...base, transactionStatus: "fail" as const, failureReason: "2" as const, paymentType: "1", minAmount: "12,5", customName: "  Kasım " },
      options,
      today
    );
    expect(fail.ok && fail.payload).toEqual({
      report_type: "pos_detail",
      custom_name: "Kasım",
      start_date: "2026-11-01",
      end_date: "2026-11-02",
      transaction_status: "false",
      payment_type: "1",
      min_amount: "12.50",
      failure_reason: "2",
    });
    const all = validateReportForm({ ...base, transactionStatus: "all" as const }, options, today);
    expect(all.ok && all.payload.transaction_status).toBeUndefined();
  });

  it("bölge/konum çoğul anahtar olarak GİTMEZ; kapsamdaki cihazlara çevrilir (web applyScope)", () => {
    const base = { ...initialReportForm(today, 1), reportType: "pos_detail" };
    const byRegion = validateReportForm({ ...base, regions: [1] }, options, today);
    expect(byRegion.ok && byRegion.payload).toMatchObject({ company: 1, devices: ["S1", "S2"] });
    expect(byRegion.ok && Object.keys(byRegion.payload)).not.toEqual(expect.arrayContaining(["regions", "locations", "companies"]));
    const byLoc = validateReportForm({ ...base, regions: [1], locations: [11] }, options, today);
    expect(byLoc.ok && byLoc.payload.devices).toEqual(["S2"]);
    // Açık cihaz seçimi kapsamdan önceliklidir
    const explicit = validateReportForm({ ...base, regions: [1], devices: ["S4"] }, options, today);
    expect(explicit.ok && explicit.payload.devices).toEqual(["S4"]);
    // Cihazı olmayan bölge: yanlış (tüm şirket) rapor yerine hata
    expect(validateReportForm({ ...base, regions: [3] }, options, today)).toMatchObject({ ok: false, errors: { scope: expect.any(String) } });
  });

  it("PersonelKart: yalnız NFC filtreleri + şirket + kart UID'leri", () => {
    const form = {
      ...initialReportForm(today, 1),
      reportType: "nfc_balance_logs",
      devices: ["S1"],
      nfcSource: "pos_sale",
      nfcOperation: "add",
      minAmount: "abc",
      nfcCardUids: ["U1", "U2"],
    };
    const res = validateReportForm(form, options, today);
    expect(res.ok && res.payload).toEqual({
      report_type: "nfc_balance_logs",
      start_date: "2026-11-18",
      end_date: "2026-11-18",
      company: 1,
      nfc_source: "pos_sale",
      nfc_operation: "add",
      nfc_card_uids: ["U1", "U2"],
    });
  });

  it("Aylık Analiz: nfc_monthly_analysis, ayın tamamı, kaynak/işlem gönderilmez", () => {
    const form = {
      ...initialReportForm(today, 1),
      reportType: "nfc_balance_logs",
      nfcMonthly: true,
      analysisMonth: 2,
      analysisYear: 2024,
      nfcSource: "pos_sale",
      startInput: "bozuk",
    };
    const res = validateReportForm(form, options, today);
    expect(res.ok && res.payload).toEqual({
      report_type: "nfc_monthly_analysis",
      start_date: "2024-02-01",
      end_date: "2024-02-29",
      company: 1,
    });
  });

  it("ters aralık, gelecek tarih, 365 günü aşan aralık ve geçersiz tutar hata verir", () => {
    const base = { ...initialReportForm(today), reportType: "pos_detail" };
    expect(validateReportForm({ ...base, startInput: "10.11.2026", endInput: "01.11.2026" }, options, today)).toMatchObject({
      ok: false,
      errors: { range: expect.any(String) },
    });
    expect(validateReportForm({ ...base, endInput: "19.11.2026" }, options, today)).toMatchObject({
      ok: false,
      errors: { endInput: expect.any(String) },
    });
    expect(validateReportForm({ ...base, startInput: "01.01.2025", endInput: "18.11.2026" }, options, today)).toMatchObject({
      ok: false,
      errors: { range: expect.stringContaining("365") },
    });
    expect(validateReportForm({ ...base, minAmount: "-3" }, options, today)).toMatchObject({
      ok: false,
      errors: { minAmount: expect.any(String) },
    });
  });

  it("şirket değişince geçersiz alt seçimleri temizler", () => {
    const form = { ...initialReportForm(today, 1), regions: [1, 2], locations: [10, 20], devices: ["S1", "S3"] };
    expect(pruneSelections(form, options)).toMatchObject({ regions: [1], locations: [10], devices: ["S1"] });
  });

  it("filtre seçenekleri farklı şirketi içerse de seçili şirketin cihazları listelenir", () => {
    expect(availableDevices(options, 2).map((d) => d.sn)).toEqual(["S3"]);
    expect(availableDevices(options, null)).toHaveLength(4);
    expect(scopeDevices(options, { company: 1, regions: [], locations: [] })).toBeNull();
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
