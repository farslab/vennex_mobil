import MockAdapter from "axios-mock-adapter";
import { apiClient } from "@/api/client";
import { reportsApi } from "@/api/reports";
import { tokenStorage } from "@/utils/tokenStorage";

const mockDownload = jest.fn();
jest.mock("expo-file-system", () => ({
  Paths: { cache: "cache" },
  Directory: jest.fn().mockImplementation(() => ({ create: jest.fn() })),
  File: { downloadFileAsync: (...args: unknown[]) => mockDownload(...args) },
}));

const job = { id: 5, report_type: "pos_summary", custom_name: "", created_at: "2026-11-19T01:21:00+03:00" };

describe("reportsApi.download", () => {
  let mock: MockAdapter;
  beforeEach(async () => {
    mock = new MockAdapter(apiClient);
    mockDownload.mockReset();
    await tokenStorage.setTokens("erisim-token", "yenileme-token");
  });
  afterEach(() => mock.restore());

  it("Accept */* gönderir (backend görünümü xlsx Accept'ini 406 ile reddeder) ve token ekler", async () => {
    mock.onGet("/reports/5/").reply(200, { ...job, status: "SUCCESS", is_downloadable: true });
    mockDownload.mockResolvedValue({ name: "pos_ozet.xlsx", uri: "file:///cache/pos_ozet.xlsx", rename: jest.fn() });

    const res = await reportsApi.download(job);

    const [url, , opts] = mockDownload.mock.calls[0] as [string, unknown, { headers: Record<string, string> }];
    expect(url).toMatch(/\/reports\/5\/download\/$/);
    expect(opts.headers.Accept).toBe("*/*");
    expect(opts.headers.Authorization).toBe("Bearer erisim-token");
    expect(res.fileName).toBe("pos_ozet.xlsx");
  });

  it("406 yanıtını anlaşılır hataya çevirir", async () => {
    mock.onGet("/reports/5/").reply(200, { ...job, status: "SUCCESS", is_downloadable: true });
    mockDownload.mockRejectedValue(new Error("UnableToDownloadException: response has status 406"));
    await expect(reportsApi.download(job)).rejects.toMatchObject({ status: 406 });
  });

  it("indirilemez rapor için dosya isteği atmaz", async () => {
    mock.onGet("/reports/5/").reply(200, { ...job, status: "EXPIRED", is_downloadable: false });
    await expect(reportsApi.download(job)).rejects.toMatchObject({ status: 404 });
    expect(mockDownload).not.toHaveBeenCalled();
  });
});
