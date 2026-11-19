import MockAdapter from "axios-mock-adapter";
import { apiClient } from "@/api/client";
import { authApi } from "@/api/auth";
import { accountApi } from "@/api/account";
import { legalApi } from "@/api/legal";
import { makeUser } from "@/test/utils";

describe("authApi — hesap uçları", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => mock.restore());

  it("change-password gövdesi ve 200 {detail} yanıtı", async () => {
    mock.onPost("/auth/change-password/").reply(200, { detail: "Parola güncellendi." });
    await expect(authApi.changePassword("eski-sifre1", "yeni-sifre1")).resolves.toEqual({
      detail: "Parola güncellendi.",
      sessionKept: false,
    });
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ current_password: "eski-sifre1", new_password: "yeni-sifre1" });
  });

  it("change-password yeni token çiftini saklar → bu cihazda oturum açık kalır", async () => {
    const { tokenStorage } = jest.requireActual("@/utils/tokenStorage") as typeof import("@/utils/tokenStorage");
    const spy = jest.spyOn(tokenStorage, "setTokens").mockResolvedValue();
    mock.onPost("/auth/change-password/").reply(200, { detail: "Parola güncellendi.", access: "a2", refresh: "r2" });
    await expect(authApi.changePassword("eski-sifre1", "yeni-sifre1")).resolves.toEqual({
      detail: "Parola güncellendi.",
      sessionKept: true,
    });
    expect(spy).toHaveBeenCalledWith("a2", "r2");
    spy.mockRestore();
  });

  it("change-password alan hatasını fieldErrors olarak taşır", async () => {
    mock.onPost("/auth/change-password/").reply(400, { current_password: ["Mevcut parola hatalı."] });
    await expect(authApi.changePassword("x", "yeni-sifre1")).rejects.toMatchObject({
      status: 400,
      fieldErrors: { current_password: "Mevcut parola hatalı." },
    });
  });

  it("PATCH me yalnız verilen alanları gönderir ve AuthUser döner", async () => {
    const user = makeUser({ first_name: "Yeni" });
    mock.onPatch("/auth/me/").reply(200, user);
    await expect(authApi.updateMe({ first_name: "Yeni", phone: null })).resolves.toEqual(user);
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ first_name: "Yeni", phone: null });
  });

  it("hesap silme talebi: parola + platform/sürüm gönderilir; 201 yeni, 200 zaten var", async () => {
    const body = { id: 7, status: "new", status_display: "Yeni", created_at: "2026-11-19T10:00:00Z" };
    mock.onPost("/auth/delete/").replyOnce(201, body).onPost("/auth/delete/").replyOnce(200, body);
    await expect(authApi.requestAccountDeletion("parolam123")).resolves.toMatchObject({ id: 7, already: false });
    await expect(authApi.requestAccountDeletion("parolam123")).resolves.toMatchObject({ id: 7, already: true });
    expect(mock.history.post[0].url).toBe("/auth/delete/");
    expect(JSON.parse(mock.history.post[0].data)).toMatchObject({ password: "parolam123" });
    expect(mock.history.post.some((r) => r.url === "/auth/deactivate/")).toBe(false);
    expect("deactivate" in authApi).toBe(false);
  });

  it("silme talebi hatalı parolada alan hatası verir", async () => {
    mock.onPost("/auth/delete/").reply(400, { password: ["Parola hatalı."] });
    await expect(authApi.requestAccountDeletion("yanlis")).rejects.toMatchObject({ fieldErrors: { password: "Parola hatalı." } });
  });

  it("2FA setup → enable → disable gövdeleri", async () => {
    mock.onPost("/auth/2fa/setup/").reply(200, { device_id: 1, secret: "ABCD", otpauth_url: "otpauth://totp/x", is_enabled: false });
    mock.onPost("/auth/2fa/enable/").reply(200, { detail: "ok", is_enabled: true });
    mock.onPost("/auth/2fa/disable/").reply(200, { detail: "ok", is_enabled: false });

    await expect(authApi.setup2FA()).resolves.toMatchObject({ secret: "ABCD" });
    await expect(authApi.enable2FA("123456")).resolves.toMatchObject({ is_enabled: true });
    await expect(authApi.disable2FA("parolam123")).resolves.toMatchObject({ is_enabled: false });
    expect(JSON.parse(mock.history.post[1].data)).toEqual({ otp: "123456" });
    expect(JSON.parse(mock.history.post[2].data)).toEqual({ password: "parolam123" });
  });

  it("bildirim tercihleri kısmi PATCH", async () => {
    mock.onPatch("/me/notification-preferences/").reply(200, { technical_errors: false });
    await authApi.updateNotificationPreferences({ technical_errors: false });
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ technical_errors: false });
  });
});

describe("accountApi & legalApi", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => mock.restore());

  it("cari faturaları {results} zarfından açar", async () => {
    mock.onGet("/cari/invoices/").reply(200, { results: [{ id: 1 }] });
    mock.onGet("/companies/").reply(200, { results: [{ id: 10 }] });
    await expect(accountApi.cariInvoices()).resolves.toEqual([{ id: 1 }]);
    await expect(accountApi.companies()).resolves.toEqual([{ id: 10 }]);
  });

  it("şirket detayı ve PDF uçları", async () => {
    mock.onGet("/companies/10/").reply(200, { id: 10, name: "A" });
    mock.onGet("/cari/invoices/5/pdf/").reply(200, { pdf_url: "https://example.com/x.pdf" });
    await expect(accountApi.company(10)).resolves.toMatchObject({ id: 10 });
    await expect(accountApi.cariInvoicePdf(5)).resolves.toEqual({ pdf_url: "https://example.com/x.pdf" });
  });

  it("legal accept sürümü yalnız varsa gönderir", async () => {
    mock.onPost("/legal/accept/").reply(200, makeUser());
    await legalApi.accept("kvkk", 3);
    await legalApi.accept("terms", null);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ slug: "kvkk", version: 3 });
    expect(JSON.parse(mock.history.post[1].data)).toEqual({ slug: "terms" });
  });
});
