import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import TwoFactorScreen from "@/screens/auth/TwoFactorScreen";
import { useAuthStore } from "@/store/authStore";

const initialState = useAuthStore.getState();

describe("TwoFactorScreen", () => {
  const verify2FA = jest.fn();
  const cancel2FA = jest.fn();

  beforeEach(() => {
    verify2FA.mockReset();
    useAuthStore.setState(
      { ...initialState, status: "requires_2fa", sessionToken: "S1", attemptsLeft: 3, verify2FA, cancel2FA },
      true
    );
  });

  it("kalan deneme hakkını gösterir", async () => {
    await render(<TwoFactorScreen />);
    expect(screen.getByText("Kalan deneme hakkı: 3")).toBeOnTheScreen();
  });

  it("6 hane girilmeden doğrulamaz", async () => {
    await render(<TwoFactorScreen />);
    await fireEvent.changeText(screen.getByTestId("otp-input"), "123");
    await fireEvent.press(screen.getByText("Doğrula"));
    expect(verify2FA).not.toHaveBeenCalled();
  });

  it("rakam dışı karakterleri ayıklar ve 6. hanede otomatik doğrular", async () => {
    verify2FA.mockResolvedValueOnce(undefined);
    await render(<TwoFactorScreen />);
    await fireEvent.changeText(screen.getByTestId("otp-input"), "12-34 56");
    await waitFor(() => expect(verify2FA).toHaveBeenCalledWith("123456"));
    expect(verify2FA).toHaveBeenCalledTimes(1);
  });

  it("store hata mesajını gösterir", async () => {
    useAuthStore.setState({ errorMessage: "Geçersiz kod." });
    await render(<TwoFactorScreen />);
    expect(screen.getByText("Geçersiz kod.")).toBeOnTheScreen();
  });

  it("farklı hesapla giriş akışı iptal eder", async () => {
    await render(<TwoFactorScreen />);
    await fireEvent.press(screen.getByText("Farklı hesapla giriş yap"));
    expect(cancel2FA).toHaveBeenCalled();
  });
});
