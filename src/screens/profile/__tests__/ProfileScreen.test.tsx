import React from "react";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { useAuthStore } from "@/store/authStore";
import { useThemePreference, useToastStore } from "@/design-system";
import ProfileScreen from "@/screens/profile/ProfileScreen";
import { createTestQueryClient, makeUser, renderWithProviders } from "@/test/utils";
import { queryKeys } from "@/api/queryKeys";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), setOptions: jest.fn() }),
}));

const mockLogout = jest.fn(async () => {});

describe("ProfileScreen", () => {
  beforeEach(() => {
    useAuthStore.setState({
      status: "unauthenticated", // bildirim sayacı sorgusu tetiklenmesin
      user: makeUser({ role: "owner", first_name: "Ayşe", last_name: "Yılmaz", username: "ayse" }),
      selectedCompanyId: 10,
      logout: mockLogout,
    });
  });

  it("kimlik kartını ve sahip bölümlerini gösterir", async () => {
    await renderWithProviders(<ProfileScreen />);
    expect(screen.getByText("Ayşe Yılmaz")).toBeOnTheScreen();
    expect(screen.getByText("@ayse")).toBeOnTheScreen();
    expect(screen.getByText("Sahip")).toBeOnTheScreen();
    expect(screen.getByText("Cari: Temiz")).toBeOnTheScreen();
    expect(screen.getByTestId("row-users")).toBeOnTheScreen();
    expect(screen.getByTestId("row-company-account")).toBeOnTheScreen();
    expect(screen.getByTestId("row-regions")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("row-regions"));
    expect(mockNavigate).toHaveBeenCalledWith("Regions");
    await fireEvent.press(screen.getByTestId("row-legal-kvkk"));
    expect(mockNavigate).toHaveBeenCalledWith("LegalDocument", { slug: "kvkk" });
  });

  it("teknisyende kullanıcılar ve şirket/cari satırları gizlidir", async () => {
    useAuthStore.setState({ user: makeUser({ role: "tech" }) });
    await renderWithProviders(<ProfileScreen />);
    expect(screen.getByText("Teknisyen")).toBeOnTheScreen();
    expect(screen.queryByTestId("row-users")).toBeNull();
    expect(screen.queryByTestId("row-company-account")).toBeNull();
    expect(screen.queryByTestId("row-regions")).toBeNull();
    expect(screen.getByTestId("row-reports")).toBeOnTheScreen();
  });

  it("bölge satırı sunucudaki modül listesine uyar (web ile aynı kaynak)", async () => {
    const queryClient = createTestQueryClient();
    // Sunucu modülü kapattıysa sahipte bile gizlenir
    queryClient.setQueryData(queryKeys.appConfig(), { modules: [{ key: "devices" }], capabilities: {}, enums: {}, features: {} });
    useAuthStore.setState({ status: "authenticated" });
    await renderWithProviders(<ProfileScreen />, { queryClient });
    expect(screen.getByTestId("row-company-account")).toBeOnTheScreen();
    expect(screen.queryByTestId("row-regions")).toBeNull();
  });

  it("çıkış onay ister; vazgeçince çıkış yapılmaz, onaylayınca logout çağrılır", async () => {
    await renderWithProviders(<ProfileScreen />);

    await fireEvent.press(screen.getByTestId("row-logout"));
    expect(screen.getByText("Oturumu kapat")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Vazgeç"));
    expect(mockLogout).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId("row-logout"));
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mockLogout).toHaveBeenCalledTimes(1));
  });

  it("çıkış beklenmedik hata verirse işlenmemiş ret olmaz, kullanıcıya bildirilir", async () => {
    mockLogout.mockRejectedValueOnce(new Error("ağ"));
    await renderWithProviders(<ProfileScreen />);
    await fireEvent.press(screen.getByTestId("row-logout"));
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(useToastStore.getState().current?.tone).toBe("danger"));
    useToastStore.setState({ current: null });
  });

  it("tema tercihini değiştirir", async () => {
    await renderWithProviders(<ProfileScreen />);
    await fireEvent.press(screen.getByText("Koyu"));
    expect(useThemePreference.getState().preference).toBe("dark");
    await fireEvent.press(screen.getByText("Sistem"));
    expect(useThemePreference.getState().preference).toBe("system");
  });
});
