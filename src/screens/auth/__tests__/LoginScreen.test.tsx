import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import LoginScreen from "@/screens/auth/LoginScreen";
import { useAuthStore } from "@/store/authStore";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => {
  const actual = jest.requireActual("@react-navigation/native");
  return { ...actual, useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn() }) };
});

const initialState = useAuthStore.getState();

describe("LoginScreen", () => {
  const login = jest.fn();

  beforeEach(() => {
    login.mockReset();
    mockNavigate.mockReset();
    useAuthStore.setState({ ...initialState, login }, true);
  });

  it("boş alanlarda alan bazlı hata gösterir ve login çağırmaz", async () => {
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByTestId("login-submit"));

    expect(screen.getByText("Kullanıcı adı veya e-posta gerekli.")).toBeOnTheScreen();
    expect(screen.getByText("Şifre gerekli.")).toBeOnTheScreen();
    expect(login).not.toHaveBeenCalled();
  });

  it("kullanıcı adını kırparak login çağırır, şifreye dokunmaz", async () => {
    login.mockResolvedValueOnce(undefined);
    await render(<LoginScreen />);

    await fireEvent.changeText(screen.getByTestId("login-username"), "  test.user ");
    await fireEvent.changeText(screen.getByTestId("login-password"), " gizli123");
    await fireEvent.press(screen.getByTestId("login-submit"));

    await waitFor(() => expect(login).toHaveBeenCalledWith("test.user", " gizli123"));
  });

  it("istek sürerken ikinci dokunuş yeni istek başlatmaz", async () => {
    let resolve: () => void = () => {};
    login.mockImplementation(() => new Promise<void>((r) => (resolve = r)));
    await render(<LoginScreen />);

    await fireEvent.changeText(screen.getByTestId("login-username"), "u");
    await fireEvent.changeText(screen.getByTestId("login-password"), "p");
    const first = fireEvent.press(screen.getByTestId("login-submit"));
    await waitFor(() => expect(login).toHaveBeenCalledTimes(1));
    // İstek sürerken buton kilitli (accessibilityState.busy) ve handler yeniden girmez
    expect(screen.getByTestId("login-submit")).toBeDisabled();
    const second = fireEvent.press(screen.getByTestId("login-submit"));
    resolve();
    await Promise.all([first, second]);
    expect(login).toHaveBeenCalledTimes(1);
  });

  it("login hatasını banner olarak gösterir", async () => {
    login.mockRejectedValueOnce(new Error("Kullanıcı adı veya parola hatalı."));
    await render(<LoginScreen />);

    await fireEvent.changeText(screen.getByTestId("login-username"), "x");
    await fireEvent.changeText(screen.getByTestId("login-password"), "y");
    await fireEvent.press(screen.getByTestId("login-submit"));

    expect(await screen.findByText("Kullanıcı adı veya parola hatalı.")).toBeOnTheScreen();
  });

  it("oturum sona erdi mesajını gösterir", async () => {
    useAuthStore.setState({ errorMessage: "Oturumunuz sona erdi, lütfen tekrar giriş yapın." });
    await render(<LoginScreen />);
    expect(screen.getByText("Oturumunuz sona erdi, lütfen tekrar giriş yapın.")).toBeOnTheScreen();
  });

  it("şifremi unuttum ekranına gider", async () => {
    await render(<LoginScreen />);
    await fireEvent.press(screen.getByText("Şifremi unuttum"));
    expect(mockNavigate).toHaveBeenCalledWith("ForgotPassword");
  });

  it("şifre göster/gizle düğmesi çalışır", async () => {
    await render(<LoginScreen />);
    const input = screen.getByTestId("login-password");
    expect(input).toHaveProp("secureTextEntry", true);
    await fireEvent.press(screen.getByLabelText("Şifreyi göster"));
    expect(screen.getByTestId("login-password")).toHaveProp("secureTextEntry", false);
  });
});
