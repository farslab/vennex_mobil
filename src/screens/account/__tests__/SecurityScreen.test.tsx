import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import SecurityScreen from "@/screens/account/SecurityScreen";
import { createTestQueryClient, makeUser, renderWithProviders } from "@/test/utils";

/** Mutasyon gc zamanlayıcısı (varsayılan 5 dk) jest sürecini açık tutmasın */
function makeClient() {
  const client = createTestQueryClient();
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { retry: false, gcTime: Infinity } });
  return client;
}

// İkon fontu yükleyicisi (expo-font → expo-asset) testte gereksiz
jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

const mockLogout = jest.fn(async () => {});

describe("SecurityScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet("/auth/2fa/status/").reply(200, { is_enabled: false });
    useAuthStore.setState({ status: "authenticated", user: makeUser(), selectedCompanyId: 10, logout: mockLogout });
  });
  afterEach(() => mock.restore());

  async function fillPassword(current: string, next: string, confirm: string) {
    await fireEvent.changeText(screen.getByTestId("input-current-password"), current);
    await fireEvent.changeText(screen.getByTestId("input-new-password"), next);
    await fireEvent.changeText(screen.getByTestId("input-confirm-password"), confirm);
    await fireEvent.press(screen.getByTestId("change-password-submit"));
  }

  it("şifre en az 8 karakter olmalı; istek gönderilmez", async () => {
    await renderWithProviders(<SecurityScreen />, { queryClient: makeClient() });
    await fillPassword("eskiSifre1", "Ab12345", "Ab12345");
    expect(await screen.findByText("Şifre en az 8 karakter olmalı.")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);
  });

  it("şifreler eşleşmezse ve yeni şifre eskisiyle aynıysa uyarır", async () => {
    await renderWithProviders(<SecurityScreen />, { queryClient: makeClient() });
    await fillPassword("eskiSifre1", "YeniSifre12", "YeniSifre13");
    expect(await screen.findByText("Şifreler eşleşmiyor.")).toBeOnTheScreen();

    await fillPassword("eskiSifre1", "eskiSifre1", "eskiSifre1");
    expect(await screen.findByText("Yeni şifre mevcut şifreden farklı olmalı.")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);
  });

  it("sunucu alan hatasını ilgili inputta gösterir", async () => {
    mock.onPost("/auth/change-password/").reply(400, { current_password: ["Mevcut parola hatalı."] });
    await renderWithProviders(<SecurityScreen />, { queryClient: makeClient() });
    await fillPassword("yanlisSifre", "YeniSifre12", "YeniSifre12");
    expect(await screen.findByText("Mevcut parola hatalı.")).toBeOnTheScreen();
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ current_password: "yanlisSifre", new_password: "YeniSifre12" });
  });

  it("başarılı değişimde diğer oturumların kapanacağını bildirir ve formu temizler", async () => {
    mock.onPost("/auth/change-password/").reply(200, { detail: "Parola güncellendi." });
    await renderWithProviders(<SecurityScreen />, { queryClient: makeClient() });
    await fillPassword("eskiSifre1", "YeniSifre12", "YeniSifre12");
    expect(await screen.findByText("Şifre güncellendi")).toBeOnTheScreen();
    expect(screen.getByTestId("input-new-password").props.value).toBe("");
  });

  it("2FA kurulum akışı: setup → anahtar → kod → etkin", async () => {
    mock.onPost("/auth/2fa/setup/").reply(200, {
      device_id: 1,
      secret: "JBSWY3DPEHPK3PXP",
      otpauth_url: "otpauth://totp/Vennex:test?secret=JBSWY3DPEHPK3PXP",
      is_enabled: false,
    });
    mock.onPost("/auth/2fa/enable/").reply(200, { detail: "2FA aktifleştirildi.", is_enabled: true });

    await renderWithProviders(<SecurityScreen />, { queryClient: makeClient() });
    expect(await screen.findByText("Kapalı")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("two-factor-setup"));

    expect(await screen.findByText("JBSW Y3DP EHPK 3PXP")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("two-factor-otp"), "123456");
    await fireEvent.press(screen.getByTestId("two-factor-enable"));

    expect(await screen.findByText("Etkin")).toBeOnTheScreen();
    expect(JSON.parse(mock.history.post[1].data)).toEqual({ otp: "123456" });
    expect(screen.queryByText("JBSW Y3DP EHPK 3PXP")).toBeNull();
  });

  it("2FA geçersiz kodda hata gösterir ve kurulumda kalır", async () => {
    mock.onPost("/auth/2fa/setup/").reply(200, { device_id: 1, secret: "ABCDEFGH", otpauth_url: "", is_enabled: false });
    mock.onPost("/auth/2fa/enable/").reply(400, { detail: "Geçersiz kod." });

    await renderWithProviders(<SecurityScreen />, { queryClient: makeClient() });
    await fireEvent.press(await screen.findByTestId("two-factor-setup"));
    await fireEvent.changeText(await screen.findByTestId("two-factor-otp"), "000000");
    await fireEvent.press(screen.getByTestId("two-factor-enable"));

    expect(await screen.findByText("Geçersiz kod.")).toBeOnTheScreen();
    expect(screen.getByText("ABCD EFGH")).toBeOnTheScreen();
  });

  it("hesap silme: parola onayı → POST delete → çıkış", async () => {
    mock.onPost("/auth/delete/").reply(204);
    await renderWithProviders(<SecurityScreen />, { queryClient: makeClient() });

    await fireEvent.press(await screen.findByTestId("row-delete-account"));
    expect(screen.getByText("Bu işlem geri alınamaz.")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("password-confirm-input"), "parolam123");
    await fireEvent.press(screen.getByTestId("password-confirm-submit"));

    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
    expect(mock.history.post[0].url).toBe("/auth/delete/");
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ password: "parolam123" });
  });

  it("hesap dondurmada hatalı parola alan hatası olarak gösterilir, çıkış yapılmaz", async () => {
    mock.onPost("/auth/deactivate/").reply(400, { password: ["Parola hatalı."] });
    await renderWithProviders(<SecurityScreen />, { queryClient: makeClient() });

    await fireEvent.press(await screen.findByTestId("row-deactivate"));
    await fireEvent.press(screen.getByTestId("password-confirm-submit"));
    expect(screen.getByText("Devam etmek için parolanızı girin.")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId("password-confirm-input"), "yanlis");
    await fireEvent.press(screen.getByTestId("password-confirm-submit"));
    expect(await screen.findByText("Parola hatalı.")).toBeOnTheScreen();
    expect(mockLogout).not.toHaveBeenCalled();
  });
});
