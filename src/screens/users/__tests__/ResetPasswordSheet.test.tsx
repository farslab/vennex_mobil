import React from "react";
import { Alert, type AlertButton } from "react-native";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { useToastStore } from "@/design-system";
import { renderWithProviders } from "@/test/utils";
import { ResetPasswordSheet } from "@/screens/users/form/ResetPasswordSheet";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));
// Paralel koşuda ilk testin soğuk modül dönüşümü 5 sn varsayılanını aşabiliyor
jest.setTimeout(20_000);

const URL = "/users/7/reset-password/";
const STRONG = "Guclu.Sifre1";

describe("ResetPasswordSheet", () => {
  let mock: MockAdapter;
  let alertSpy: jest.SpyInstance;
  const onClose = jest.fn();

  const el = (visible: boolean) => <ResetPasswordSheet visible={visible} userId={7} username="ali.tech" onClose={onClose} />;
  async function open() {
    const r = await renderWithProviders(el(false));
    await r.rerender(el(true));
    return r;
  }
  async function fill(password: string, confirm: string) {
    await fireEvent.changeText(screen.getByTestId("reset-password-input"), password);
    await fireEvent.changeText(screen.getByTestId("reset-password-confirm"), confirm);
  }
  const submit = () => fireEvent.press(screen.getByTestId("reset-password-submit"));

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    useToastStore.setState({ current: null });
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });
  afterEach(() => {
    mock.restore();
    alertSpy.mockRestore();
  });

  it("başlık, kullanıcı adı ve gizli şifre alanları gösterilir", async () => {
    await open();
    expect(screen.getAllByText("Şifreyi sıfırla").length).toBeGreaterThan(0);
    expect(screen.getByText("@ali.tech")).toBeOnTheScreen();
    expect(screen.getByTestId("reset-password-input").props.secureTextEntry).toBe(true);
    expect(screen.getByTestId("reset-password-confirm").props.secureTextEntry).toBe(true);
  });

  it.each([
    ["", "", "Şifre gerekli.", "Şifreyi tekrar girin."],
    ["kisa1", "kisa1", "Şifre en az 8 karakter olmalı.", null],
    ["12345678", "12345678", "Şifre yalnızca rakamlardan oluşamaz.", null],
    [" Bosluklu1 ", " Bosluklu1 ", "Şifre başında veya sonunda boşluk olamaz.", null],
    [STRONG, "Baska.Sifre1", null, "Şifreler eşleşmiyor."],
  ])("geçersiz giriş ('%s' / '%s') istek atmadan hata gösterir", async (password, confirm, pwError, confirmError) => {
    await open();
    await fill(password, confirm);
    await submit();
    if (pwError) expect(screen.getByText(pwError)).toBeOnTheScreen();
    if (confirmError) expect(screen.getByText(confirmError)).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("geçerli şifre new_password olarak gönderilir, bildirim gösterilip kapanır", async () => {
    mock.onPost(URL).reply(200, { detail: "Şifre güncellendi." });
    await open();
    await fill(STRONG, STRONG);
    await submit();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mock.history.post).toHaveLength(1);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ new_password: STRONG });
    expect(useToastStore.getState().current?.message).toBe(
      "Şifre sıfırlandı. Yeni şifreyi kullanıcıyla güvenli bir şekilde paylaşın."
    );
  });

  it("çift dokunuşta tek istek gider", async () => {
    mock.onPost(URL).reply(() => new Promise<[number, unknown]>((resolve) => setTimeout(() => resolve([200, {}]), 30)));
    await open();
    await fill(STRONG, STRONG);
    await submit();
    await submit();
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mock.history.post).toHaveLength(1);
  });

  it("backend new_password hatası şifre alanının altında gösterilir", async () => {
    mock.onPost(URL).reply(400, { new_password: ["Bu şifre çok yaygın."] });
    await open();
    await fill(STRONG, STRONG);
    await submit();
    expect(await screen.findByText("Bu şifre çok yaygın.")).toBeOnTheScreen();
    expect(screen.queryByText("Sıfırlanamadı")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("alan dışı backend hatası 'Sıfırlanamadı' uyarısıyla gösterilir", async () => {
    mock.onPost(URL).reply(403, { detail: "Bu kullanıcının şifresini sıfırlayamazsınız." });
    await open();
    await fill(STRONG, STRONG);
    await submit();
    expect(await screen.findByText("Sıfırlanamadı")).toBeOnTheScreen();
    expect(screen.getByText("Bu kullanıcının şifresini sıfırlayamazsınız.")).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("yazılmış şifre varken Vazgeç onay ister; 'Çık' ile kapanır", async () => {
    await open();
    await fireEvent.changeText(screen.getByTestId("reset-password-input"), "abc");
    await fireEvent.press(screen.getByText("Vazgeç"));
    expect(alertSpy).toHaveBeenCalledWith("Değişiklikler kaydedilmedi", "Çıkarsanız girdiğiniz bilgiler kaybolur.", expect.any(Array));
    expect(onClose).not.toHaveBeenCalled();
    const buttons = alertSpy.mock.calls[0][2] as AlertButton[];
    buttons.find((b) => b.text === "Çık")?.onPress?.();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("boş formda Vazgeç doğrudan kapatır", async () => {
    await open();
    await fireEvent.press(screen.getByText("Vazgeç"));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("yeniden açılışta alanlar ve hatalar temizlenir", async () => {
    const r = await open();
    await fill("kisa", "x");
    await submit();
    expect(screen.getByText("Şifreler eşleşmiyor.")).toBeOnTheScreen();
    await r.rerender(el(false));
    await r.rerender(el(true));
    expect(screen.getByTestId("reset-password-input").props.value).toBe("");
    expect(screen.getByTestId("reset-password-confirm").props.value).toBe("");
    expect(screen.queryByText("Şifreler eşleşmiyor.")).toBeNull();
  });
});
