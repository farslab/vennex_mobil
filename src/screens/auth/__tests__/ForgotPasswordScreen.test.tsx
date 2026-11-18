import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, render, screen } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import ForgotPasswordScreen from "@/screens/auth/ForgotPasswordScreen";

jest.mock("@react-navigation/native", () => {
  const actual = jest.requireActual("@react-navigation/native");
  return { ...actual, useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }) };
});

describe("ForgotPasswordScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => mock.restore());

  it("geçersiz e-postada istek atmaz", async () => {
    await render(<ForgotPasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText("E-posta"), "gecersiz");
    await fireEvent.press(screen.getByText("Sıfırlama bağlantısı gönder"));
    expect(screen.getByText("Geçerli bir e-posta adresi girin.")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);
  });

  it("geçerli e-postada yetkisiz istek atar ve backend mesajını gösterir", async () => {
    mock.onPost("/auth/password-reset/").reply(200, { detail: "Eğer e-posta sistemde kayıtlıysa, sıfırlama bağlantısı gönderildi." });
    await render(<ForgotPasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText("E-posta"), " kisi@ornek.com ");
    await fireEvent.press(screen.getByText("Sıfırlama bağlantısı gönder"));

    expect(await screen.findByText("Eğer e-posta sistemde kayıtlıysa, sıfırlama bağlantısı gönderildi.")).toBeOnTheScreen();
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ email: "kisi@ornek.com" });
    expect(mock.history.post[0].headers?.Authorization).toBeUndefined();
  });

  it("rate limit (429) mesajını gösterir", async () => {
    mock.onPost("/auth/password-reset/").reply(429, {});
    await render(<ForgotPasswordScreen />);
    await fireEvent.changeText(screen.getByLabelText("E-posta"), "kisi@ornek.com");
    await fireEvent.press(screen.getByText("Sıfırlama bağlantısı gönder"));
    expect(await screen.findByText(/Çok fazla istek/)).toBeOnTheScreen();
  });
});
