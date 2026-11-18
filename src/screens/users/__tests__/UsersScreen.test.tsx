import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import UsersScreen from "@/screens/users/UsersScreen";
import { makeUser, renderWithProviders } from "@/test/utils";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), setOptions: jest.fn() }),
}));

const staff = (id: number, overrides: Record<string, unknown> = {}) => ({
  id,
  username: `tek${id}`,
  first_name: `Ad${id}`,
  last_name: "Soyad",
  email: "",
  phone: "",
  is_active: true,
  group_names: ["Satış Görüntüleme"],
  pos_devices: [{ id: 1, sn: "PAV1", pos_name: "Otomat 1" }],
  default_stock_locations: [],
  ...overrides,
});

describe("UsersScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => mock.restore());

  it("sahip olmayan kullanıcıya erişim yok gösterir ve istek atmaz", async () => {
    useAuthStore.setState({ status: "authenticated", user: makeUser({ role: "tech" }), selectedCompanyId: 10 });
    await renderWithProviders(<UsersScreen />);
    expect(screen.getByText("Erişiminiz yok")).toBeOnTheScreen();
    expect(mock.history.get).toHaveLength(0);
  });

  it("listeyi grup rozetleri, pasif rozeti ve cihaz sayısıyla gösterir; satıra basınca düzenler", async () => {
    useAuthStore.setState({ status: "authenticated", user: makeUser({ role: "owner" }), selectedCompanyId: 10 });
    mock.onGet("/users/").reply(200, {
      count: 2,
      page: 1,
      num_pages: 1,
      results: [staff(1), staff(2, { is_active: false, group_names: [] })],
    });

    await renderWithProviders(<UsersScreen />);

    expect(await screen.findByText("Ad1 Soyad")).toBeOnTheScreen();
    expect(screen.getByText("Satış Görüntüleme")).toBeOnTheScreen();
    expect(screen.getByText("Pasif")).toBeOnTheScreen();
    expect(screen.getByText("Yetki grubu yok")).toBeOnTheScreen();
    expect(screen.getByText("2 teknisyen")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("user-row-2"));
    expect(mockNavigate).toHaveBeenCalledWith("UserForm", { userId: 2 });
  });

  it("istemci tarafı arama yüklenen kayıtları süzer", async () => {
    useAuthStore.setState({ status: "authenticated", user: makeUser({ role: "owner" }), selectedCompanyId: 10 });
    mock.onGet("/users/").reply(200, { count: 2, page: 1, num_pages: 1, results: [staff(1), staff(2)] });
    await renderWithProviders(<UsersScreen />);
    await screen.findByText("Ad1 Soyad");

    await fireEvent.changeText(screen.getByTestId("users-search"), "tek2");
    expect(screen.queryByText("Ad1 Soyad")).toBeNull();
    expect(screen.getByText("Ad2 Soyad")).toBeOnTheScreen();
    expect(mock.history.get).toHaveLength(1);
  });

  it("boş listede teknisyen ekleme aksiyonu sunar", async () => {
    useAuthStore.setState({ status: "authenticated", user: makeUser({ role: "owner" }), selectedCompanyId: 10 });
    mock.onGet("/users/").reply(200, { count: 0, page: 1, num_pages: 1, results: [] });
    await renderWithProviders(<UsersScreen />);
    await fireEvent.press(await screen.findByText("Teknisyen ekle"));
    expect(mockNavigate).toHaveBeenCalledWith("UserForm", {});
  });
});
