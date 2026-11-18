import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import EditProfileScreen from "@/screens/account/EditProfileScreen";
import { createTestQueryClient, makeUser, renderWithProviders } from "@/test/utils";

/** Mutasyon gc zamanlayıcısı (varsayılan 5 dk) jest sürecini açık tutmasın */
function makeClient() {
  const client = createTestQueryClient();
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { retry: false, gcTime: Infinity } });
  return client;
}

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack, setOptions: jest.fn() }),
}));

describe("EditProfileScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    useAuthStore.setState({
      status: "authenticated",
      user: makeUser({ first_name: "Test", last_name: "Kullanıcı", email: "test@example.com", phone: "" }),
      selectedCompanyId: 10,
    });
  });
  afterEach(() => mock.restore());

  it("değişiklik yokken kaydet pasif; yalnız değişen alanları PATCH eder ve setUser çağırır", async () => {
    const updated = makeUser({ first_name: "Yeni", phone: "05321234567" });
    mock.onPatch("/auth/me/").reply(200, updated);
    await renderWithProviders(<EditProfileScreen />, { queryClient: makeClient() });

    expect(screen.getByTestId("profile-save")).toBeDisabled();
    await fireEvent.changeText(screen.getByTestId("input-first-name"), "Yeni");
    await fireEvent.changeText(screen.getByTestId("input-phone"), "0532 123 45 67");
    await fireEvent.press(screen.getByTestId("profile-save"));

    await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ first_name: "Yeni", phone: "05321234567" });
    expect(useAuthStore.getState().user?.first_name).toBe("Yeni");
  });

  it("istemci doğrulaması geçersiz e-postayı engeller", async () => {
    await renderWithProviders(<EditProfileScreen />, { queryClient: makeClient() });
    await fireEvent.changeText(screen.getByTestId("input-email"), "gecersiz@");
    await fireEvent.press(screen.getByTestId("profile-save"));
    expect(await screen.findByText("Geçerli bir e-posta adresi girin.")).toBeOnTheScreen();
    expect(mock.history.patch).toHaveLength(0);
  });

  it("sunucu alan hatalarını ilgili alanda gösterir, formu korur", async () => {
    mock.onPatch("/auth/me/").reply(400, { email: ["Bu e-posta kullanılamaz."] });
    await renderWithProviders(<EditProfileScreen />, { queryClient: makeClient() });
    await fireEvent.changeText(screen.getByTestId("input-email"), "baska@example.com");
    await fireEvent.press(screen.getByTestId("profile-save"));

    expect(await screen.findByText("Bu e-posta kullanılamaz.")).toBeOnTheScreen();
    expect(screen.getByTestId("input-email").props.value).toBe("baska@example.com");
    expect(mockGoBack).not.toHaveBeenCalled();
  });
});
