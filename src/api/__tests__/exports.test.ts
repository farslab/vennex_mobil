import MockAdapter from "axios-mock-adapter";
import { apiClient } from "@/api/client";
import { downloadExport, EXPORTS } from "@/api/exports";
import { useAuthStore } from "@/store/authStore";
import { tokenStorage } from "@/utils/tokenStorage";
import { makeUser, resetSecureStore } from "@/test/utils";

const mockDownload = jest.fn();
jest.mock("expo-file-system", () => ({
  Paths: { cache: "file:///cache" },
  Directory: jest.fn().mockImplementation(() => ({ create: jest.fn() })),
  File: { downloadFileAsync: (...a: unknown[]) => mockDownload(...a) },
}));

describe("Excel dışa aktarma (web Excel butonlarının karşılığı)", () => {
  let mock: MockAdapter;
  beforeEach(async () => {
    resetSecureStore();
    mock = new MockAdapter(apiClient);
    mock.onGet("/auth/me/").reply(200, makeUser());
    await tokenStorage.setTokens("ACC", "REF");
    useAuthStore.setState({ selectedCompanyId: 7 });
    mockDownload.mockReset();
  });
  afterEach(() => mock.restore());

  it("doğru uca token, şirket ve Accept */* ile gider; sunucunun dosya adı korunur", async () => {
    mockDownload.mockResolvedValue({ name: "pos_cihazlari_20261119_101500.xlsx", uri: "file:///x", rename: jest.fn() });
    const res = await downloadExport(EXPORTS.devices);
    const [url, , opts] = mockDownload.mock.calls[0];
    expect(String(url)).toMatch(/\/pos-devices\/export\/$/);
    expect(opts.headers).toEqual({ Accept: "*/*", Authorization: "Bearer ACC", "X-Company-Id": "7" });
    expect(res.fileName).toBe("pos_cihazlari_20261119_101500.xlsx");
  });

  it("Genel Bakış Excel'i ekran filtresini sorgu olarak taşır", () => {
    expect(EXPORTS.overview({ period: "custom", start_date: "2026-11-01", end_date: "2026-11-19", location_id: 4 }).path).toBe(
      "/overview/excel/?period=custom&start_date=2026-11-01&end_date=2026-11-19&location_id=4"
    );
    expect(EXPORTS.overview({ period: "today" }).name).toBe("genel_bakis");
  });

  it("cihaz ürünleri ucu seri numarasını kodlar", () => {
    expect(EXPORTS.deviceProducts("PAV 1/2").path).toBe("/pos-devices/PAV%201%2F2/export-products/");
  });

  it("403 → yetki mesajı, 500 → sunucu mesajı (ham hata gösterilmez)", async () => {
    mockDownload.mockRejectedValueOnce(new Error("UnableToDownload: 403"));
    await expect(downloadExport(EXPORTS.cards)).rejects.toMatchObject({ status: 403, message: "Bu dosyayı indirme yetkiniz yok." });
    mockDownload.mockRejectedValueOnce(new Error("UnableToDownload: 502"));
    await expect(downloadExport(EXPORTS.stockOverview)).rejects.toMatchObject({ status: 502 });
  });
});
