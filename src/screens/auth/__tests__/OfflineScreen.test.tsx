import React from "react";
import { AppState } from "react-native";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import OfflineScreen from "@/screens/auth/OfflineScreen";
import { useAuthStore } from "@/store/authStore";

const initialState = useAuthStore.getState();

describe("OfflineScreen", () => {
  const bootstrap = jest.fn();
  const logout = jest.fn();

  let appStateSpy: jest.SpyInstance;

  beforeEach(() => {
    appStateSpy = jest
      .spyOn(AppState, "addEventListener")
      .mockReturnValue({ remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>);
    bootstrap.mockReset().mockResolvedValue(undefined);
    logout.mockReset().mockResolvedValue(undefined);
    useAuthStore.setState(
      {
        ...initialState,
        status: "offline",
        errorMessage: "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin.",
        bootstrap,
        logout,
      },
      true
    );
  });
  afterEach(() => appStateSpy.mockRestore());

  it("hata mesajını gösterir; giriş formu göstermez", async () => {
    await render(<OfflineScreen />);
    expect(screen.getByText("Bağlantı kurulamadı")).toBeOnTheScreen();
    expect(screen.getByText(/Sunucuya ulaşılamadı/)).toBeOnTheScreen();
    expect(screen.queryByTestId("login-password")).toBeNull();
  });

  it("Tekrar dene oturumu yeniden doğrular", async () => {
    await render(<OfflineScreen />);
    await fireEvent.press(screen.getByTestId("offline-retry"));
    expect(bootstrap).toHaveBeenCalledTimes(1);
  });

  it("uygulama öne alınınca otomatik tekrar dener", async () => {
    await render(<OfflineScreen />);
    const handler = appStateSpy.mock.calls.find(([type]) => type === "change")?.[1] as (s: string) => void;
    await act(async () => handler("active"));
    await waitFor(() => expect(bootstrap).toHaveBeenCalledTimes(1));
  });

  it("Çıkış yap oturumu kapatır", async () => {
    await render(<OfflineScreen />);
    await fireEvent.press(screen.getByTestId("offline-logout"));
    expect(logout).toHaveBeenCalled();
  });
});
