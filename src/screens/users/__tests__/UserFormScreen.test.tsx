import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import UserFormScreen from "@/screens/users/UserFormScreen";
import { createTestQueryClient, makeUser, renderWithProviders } from "@/test/utils";

/** Mutasyon gc zamanlayıcısı (varsayılan 5 dk) jest sürecini açık tutmasın */
function makeClient() {
  const client = createTestQueryClient();
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { retry: false, gcTime: Infinity } });
  return client;
}

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

const mockGoBack = jest.fn();
let mockParams: { userId?: number } | undefined;
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: jest.fn(), goBack: mockGoBack, setOptions: jest.fn() }),
  useRoute: () => ({ key: "UserForm", name: "UserForm", params: mockParams }),
}));

const options = {
  available_groups: ["Cihaz Ayarları", "Stok Yönetimi"],
  always_available_groups: ["Satış Görüntüleme"],
  pos_devices: [{ id: 5, sn: "PAV1", pos_name: "Otomat 1", company_name: "Test", location_name: null }],
  stock_locations: [{ id: 3, name: "Merkez Depo", location_type: "warehouse" }],
  regions: [],
};

const staff = {
  id: 7,
  username: "ali.tek",
  first_name: "Ali",
  last_name: "Tek",
  email: "",
  phone: "",
  is_active: true,
  group_names: ["Satış Görüntüleme", "Özel Grup"],
  pos_devices: [{ id: 5, sn: "PAV1", pos_name: "Otomat 1" }],
  default_stock_locations: [],
};

describe("UserFormScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet("/users/assignable-options/").reply(200, options);
    useAuthStore.setState({ status: "authenticated", user: makeUser({ role: "owner" }), selectedCompanyId: 10 });
  });
  afterEach(() => mock.restore());

  describe("oluşturma", () => {
    beforeEach(() => {
      mockParams = {};
    });

    it("zorunlu alanları ve 8 karakter şifre kuralını doğrular", async () => {
      await renderWithProviders(<UserFormScreen />, { queryClient: makeClient() });
      await fireEvent.press(await screen.findByTestId("user-form-submit"));
      expect(screen.getByText("Kullanıcı adı gerekli.")).toBeOnTheScreen();
      expect(screen.getByText("Şifre gerekli.")).toBeOnTheScreen();

      await fireEvent.changeText(screen.getByTestId("user-password"), "abc1234");
      await fireEvent.press(screen.getByTestId("user-form-submit"));
      expect(screen.getByText("Şifre en az 8 karakter olmalı.")).toBeOnTheScreen();
      expect(mock.history.post).toHaveLength(0);
    });

    it("geçerli formu seçili gruplarla gönderir", async () => {
      mock.onPost("/users/").reply(201, { ...staff, id: 50, username: "yeni.tek" });
      await renderWithProviders(<UserFormScreen />, { queryClient: makeClient() });

      await fireEvent.changeText(await screen.findByTestId("user-username"), "yeni.tek");
      await fireEvent.changeText(screen.getByTestId("user-password"), "Guclu1234");
      await fireEvent.press(screen.getByTestId("group-Stok Yönetimi"));
      await fireEvent.press(screen.getByTestId("user-form-submit"));

      await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
      expect(JSON.parse(mock.history.post[0].data)).toEqual({
        username: "yeni.tek",
        password: "Guclu1234",
        first_name: "",
        last_name: "",
        pos_device_ids: [],
        group_names: ["Stok Yönetimi"],
        default_stock_location_ids: [],
      });
    });

    it("kullanıcı adı çakışmasını alana taşır", async () => {
      mock.onPost("/users/").reply(400, { detail: '"yeni.tek" kullanıcı adı zaten kullanılıyor.' });
      await renderWithProviders(<UserFormScreen />, { queryClient: makeClient() });
      await fireEvent.changeText(await screen.findByTestId("user-username"), "yeni.tek");
      await fireEvent.changeText(screen.getByTestId("user-password"), "Guclu1234");
      await fireEvent.press(screen.getByTestId("user-form-submit"));
      expect(await screen.findByText('"yeni.tek" kullanıcı adı zaten kullanılıyor.')).toBeOnTheScreen();
      expect(mockGoBack).not.toHaveBeenCalled();
    });
  });

  describe("düzenleme", () => {
    beforeEach(() => {
      mockParams = { userId: 7 };
      mock.onGet("/users/7/").reply(200, staff);
    });

    it("yalnız değişen alanları PATCH eder; yönetilemeyen grubu kilitli gösterir", async () => {
      mock.onPatch("/users/7/").reply(200, { ...staff, last_name: "Yeni" });
      await renderWithProviders(<UserFormScreen />, { queryClient: makeClient() });

      expect(await screen.findByText("Özel Grup")).toBeOnTheScreen();
      expect(screen.queryByTestId("user-password")).toBeNull();
      expect(screen.getByTestId("user-form-submit")).toBeDisabled();

      await fireEvent.changeText(screen.getByTestId("user-last-name"), "Yeni");
      await fireEvent.press(screen.getByTestId("user-form-submit"));

      await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
      expect(JSON.parse(mock.history.patch[0].data)).toEqual({ last_name: "Yeni" });
    });

    it("silme onay sayfasından sonra DELETE gönderir", async () => {
      mock.onDelete("/users/7/").reply(204);
      await renderWithProviders(<UserFormScreen />, { queryClient: makeClient() });

      await fireEvent.press(await screen.findByTestId("user-delete"));
      expect(screen.getByText("Bu işlem geri alınamaz.")).toBeOnTheScreen();
      expect(mock.history.delete).toHaveLength(0);
      await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));

      await waitFor(() => expect(mock.history.delete).toHaveLength(1));
      await waitFor(() => expect(mockGoBack).toHaveBeenCalled());
    });

    it("şifre sıfırlama 8 karakter ve eşleşme kuralını uygular", async () => {
      mock.onPost("/users/7/reset-password/").reply(200, { detail: "Şifre güncellendi." });
      await renderWithProviders(<UserFormScreen />, { queryClient: makeClient() });

      await fireEvent.press(await screen.findByTestId("user-reset-password"));
      await fireEvent.changeText(screen.getByTestId("reset-password-input"), "1234567");
      await fireEvent.press(screen.getByTestId("reset-password-submit"));
      expect(screen.getByText("Şifre en az 8 karakter olmalı.")).toBeOnTheScreen();

      await fireEvent.changeText(screen.getByTestId("reset-password-input"), "YeniSifre12");
      await fireEvent.changeText(screen.getByTestId("reset-password-confirm"), "YeniSifre12");
      await fireEvent.press(screen.getByTestId("reset-password-submit"));
      await waitFor(() => expect(mock.history.post).toHaveLength(1));
      expect(JSON.parse(mock.history.post[0].data)).toEqual({ new_password: "YeniSifre12" });
    });
  });

  it("sahip olmayan kullanıcı formu göremez", async () => {
    mockParams = {};
    useAuthStore.setState({ user: makeUser({ role: "tech" }) });
    await renderWithProviders(<UserFormScreen />, { queryClient: makeClient() });
    expect(screen.getByText("Erişiminiz yok")).toBeOnTheScreen();
    expect(mock.history.get).toHaveLength(0);
  });
});
