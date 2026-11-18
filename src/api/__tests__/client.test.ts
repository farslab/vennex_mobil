import MockAdapter from "axios-mock-adapter";
import { AxiosError, AxiosHeaders } from "axios";
import { apiClient, normalizeError, registerCompanyProvider, registerUnauthorizedHandler, API_PREFIX } from "@/api/client";
import { tokenStorage } from "@/utils/tokenStorage";
import { API_BASE_URL } from "@/config/env";
import { resetSecureStore } from "@/test/utils";
import type { ApiErrorBody } from "@/types/auth";

describe("apiClient", () => {
  let mock: MockAdapter;
  const onUnauthorized = jest.fn();

  beforeEach(() => {
    resetSecureStore();
    mock = new MockAdapter(apiClient);
    registerUnauthorizedHandler(onUnauthorized);
  });

  afterEach(() => mock.restore());

  it("baseURL ortam adresini ve vennexmobile prefix'ini içerir", () => {
    expect(apiClient.defaults.baseURL).toBe(`${API_BASE_URL}${API_PREFIX}`);
  });

  it("test ortamı asla canlı sunucuyu hedeflemez", () => {
    expect(API_BASE_URL).not.toContain("tms.vennex.com.tr");
  });

  it("access token varsa Authorization header ekler", async () => {
    await tokenStorage.setTokens("ACCESS-1", "REFRESH-1");
    mock.onGet("/auth/me/").reply((config) => [200, { auth: config.headers?.Authorization }]);

    const { data } = await apiClient.get("/auth/me/");
    expect(data.auth).toBe("Bearer ACCESS-1");
  });

  it("skipAuth: true isteklerinde Authorization eklemez", async () => {
    await tokenStorage.setTokens("ACCESS-1", "REFRESH-1");
    mock.onPost("/auth/login/").reply((config) => [200, { auth: config.headers?.Authorization ?? null }]);

    const { data } = await apiClient.post("/auth/login/", {}, { skipAuth: true });
    expect(data.auth).toBeNull();
  });

  it("401 alınca token'ı yeniler ve isteği yeni token ile tekrarlar", async () => {
    await tokenStorage.setTokens("OLD", "REFRESH-1");
    mock.onPost("/auth/refresh/").reply(200, { access: "NEW", refresh: "REFRESH-2" });
    mock.onGet("/pos-devices/").reply((config) =>
      config.headers?.Authorization === "Bearer NEW" ? [200, { ok: true }] : [401, { detail: "expired" }]
    );

    const { data } = await apiClient.get("/pos-devices/");

    expect(data).toEqual({ ok: true });
    expect(await tokenStorage.getAccess()).toBe("NEW");
    expect(await tokenStorage.getRefresh()).toBe("REFRESH-2");
    expect(onUnauthorized).not.toHaveBeenCalled();
  });

  it("eşzamanlı 401'lerde yalnızca tek refresh isteği atar", async () => {
    await tokenStorage.setTokens("OLD", "REFRESH-1");
    let refreshCalls = 0;
    mock.onPost("/auth/refresh/").reply(async () => {
      refreshCalls += 1;
      await new Promise((r) => setTimeout(r, 20));
      return [200, { access: "NEW", refresh: "REFRESH-2" }];
    });
    mock.onGet(/\/(a|b|c)\//).reply((config) =>
      config.headers?.Authorization === "Bearer NEW" ? [200, { url: config.url }] : [401, {}]
    );

    const results = await Promise.all([apiClient.get("/a/"), apiClient.get("/b/"), apiClient.get("/c/")]);

    expect(results.map((r) => r.data.url)).toEqual(["/a/", "/b/", "/c/"]);
    expect(refreshCalls).toBe(1);
  });

  it("refresh başarısız olursa token'ları siler ve unauthorized handler'ı çağırır", async () => {
    await tokenStorage.setTokens("OLD", "REFRESH-1");
    mock.onPost("/auth/refresh/").reply(401, { detail: "Token geçersiz" });
    mock.onGet("/cards/").reply(401, { detail: "Oturum süresi doldu" });

    await expect(apiClient.get("/cards/")).rejects.toMatchObject({
      message: "Oturum süresi doldu",
      status: 401,
    });
    expect(await tokenStorage.getAccess()).toBeNull();
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
  });

  it("refresh token yoksa doğrudan unauthorized handler'ı çağırır", async () => {
    mock.onGet("/cards/").reply(401, {});

    await expect(apiClient.get("/cards/")).rejects.toMatchObject({ status: 401 });
    expect(onUnauthorized).toHaveBeenCalledTimes(1);
    expect(mock.history.post).toHaveLength(0);
  });

  it("401 dışındaki hataları normalize ederek döndürür", async () => {
    mock.onGet("/stock/skus/").reply(400, { detail: "Geçersiz filtre" });

    await expect(apiClient.get("/stock/skus/")).rejects.toMatchObject({
      message: "Geçersiz filtre",
      status: 400,
      body: { detail: "Geçersiz filtre" },
    });
  });
});

describe("normalizeError", () => {
  const makeError = (status: number | undefined, data: unknown, message = "Request failed") =>
    new AxiosError<ApiErrorBody>(
      message,
      "ERR",
      undefined,
      undefined,
      status
        ? ({ status, data, statusText: "", headers: {}, config: { headers: new AxiosHeaders() } } as never)
        : undefined
    );

  it.each([
    [{ detail: "D", message: "M", error: "E" }, "D"],
    [{ message: "M", error: "E" }, "M"],
    [{ error: "E" }, "E"],
    [{}, "Request failed"],
  ])("mesaj önceliği detail → message → error → axios mesajı (%j)", (body, expected) => {
    expect(normalizeError(makeError(400, body)).message).toBe(expected);
  });

  it("DRF alan hatalarını fieldErrors olarak çıkarır ve ilkini mesaj yapar", () => {
    const err = normalizeError(
      makeError(400, { new_password: ["Bu parola çok kısa."], email: ["Geçerli bir e-posta girin."] })
    );
    expect(err.fieldErrors).toEqual({ new_password: "Bu parola çok kısa.", email: "Geçerli bir e-posta girin." });
    expect(err.message).toBe("Bu parola çok kısa.");
  });

  it("iç içe non_field_errors mesajını bulur", () => {
    expect(normalizeError(makeError(400, { non_field_errors: [["İç hata"]] })).message).toBe("İç hata");
  });

  it("gövdesiz durumlarda Türkçe durum mesajı verir", () => {
    expect(normalizeError(makeError(403, {}, "")).message).toBe("Bu işlem için yetkiniz yok.");
    expect(normalizeError(makeError(500, {}, "")).message).toBe(
      "Sunucuda bir hata oluştu. Lütfen daha sonra tekrar deneyin."
    );
  });

  it("ağ hatasında anlaşılır Türkçe mesaj ve isNetworkError", () => {
    const err = normalizeError(makeError(undefined, undefined, "Network Error"));
    expect(err.message).toBe("Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.");
    expect(err.isNetworkError).toBe(true);
    expect(err.status).toBeUndefined();
  });

  it("zaman aşımı mesajı", () => {
    const e = new AxiosError<ApiErrorBody>("timeout", "ECONNABORTED");
    expect(normalizeError(e).message).toMatch(/zaman aşımı/);
  });
});

describe("X-Company-Id header", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    resetSecureStore();
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => {
    mock.restore();
    registerCompanyProvider(() => null);
  });

  it("seçili şirketi her isteğe ekler", async () => {
    registerCompanyProvider(() => 42);
    mock.onGet("/pos-devices/").reply((config) => [200, { company: config.headers?.["X-Company-Id"] }]);
    const { data } = await apiClient.get("/pos-devices/");
    expect(data.company).toBe("42");
  });

  it("şirket seçili değilse header eklemez", async () => {
    registerCompanyProvider(() => null);
    mock.onGet("/pos-devices/").reply((config) => [200, { company: config.headers?.["X-Company-Id"] ?? null }]);
    const { data } = await apiClient.get("/pos-devices/");
    expect(data.company).toBeNull();
  });
});
