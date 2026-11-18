import React from "react";
import MockAdapter from "axios-mock-adapter";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { useAuthStore } from "@/store/authStore";
import NotificationSettingsScreen from "@/screens/account/NotificationSettingsScreen";
import { createTestQueryClient, makeUser, renderWithProviders } from "@/test/utils";
import type { NotificationPreferences } from "@/types/auth";

/** Mutasyon gc zamanlayıcısı (varsayılan 5 dk) jest sürecini açık tutmasın */
function makeClient() {
  const client = createTestQueryClient();
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { retry: false, gcTime: Infinity } });
  return client;
}

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

const prefs: NotificationPreferences = {
  device_offline: true,
  transaction_alerts: false,
  stock_low: true,
  card_pending: true,
  report_ready: true,
  cari_overdue: true,
  updated_at: "2026-11-18T10:00:00Z",
};

describe("NotificationSettingsScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet("/me/notification-preferences/").reply(200, prefs);
    useAuthStore.setState({ status: "authenticated", user: makeUser({ role: "owner" }), selectedCompanyId: 10 });
  });
  afterEach(() => mock.restore());

  it("iyimser günceller ve yalnız değişen anahtarı PATCH eder", async () => {
    mock.onPatch("/me/notification-preferences/").reply(200, { ...prefs, stock_low: false });
    const { queryClient } = await renderWithProviders(<NotificationSettingsScreen />, { queryClient: makeClient() });

    const toggle = await screen.findByTestId("pref-stock_low");
    expect(toggle.props.value).toBe(true);
    await fireEvent(toggle, "valueChange", false);

    await waitFor(() => expect(screen.getByTestId("pref-stock_low").props.value).toBe(false));
    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ stock_low: false });
    await waitFor(() =>
      expect(queryClient.getQueryData<NotificationPreferences>(queryKeys.notifications.preferences())?.stock_low).toBe(false)
    );
  });

  it("hata durumunda eski değere geri döner", async () => {
    let release: (() => void) | null = null;
    mock.onPatch("/me/notification-preferences/").reply(
      () =>
        new Promise((resolve) => {
          release = () => resolve([500, { detail: "Sunucu hatası" }]);
        })
    );
    await renderWithProviders(<NotificationSettingsScreen />, { queryClient: makeClient() });

    await fireEvent(await screen.findByTestId("pref-device_offline"), "valueChange", false);
    // istek sürerken iyimser değer
    await waitFor(() => expect(screen.getByTestId("pref-device_offline").props.value).toBe(false));
    await waitFor(() => expect(release).not.toBeNull());
    await act(async () => {
      release?.();
    });

    await waitFor(() => expect(screen.getByTestId("pref-device_offline").props.value).toBe(true));
    expect(mock.history.patch).toHaveLength(1);
  });

  it("sahibe gitmeyen push türlerini teknisyene göstermez", async () => {
    useAuthStore.setState({ user: makeUser({ role: "tech" }) });
    await renderWithProviders(<NotificationSettingsScreen />, { queryClient: makeClient() });
    expect(await screen.findByTestId("pref-device_offline")).toBeOnTheScreen();
    expect(screen.queryByTestId("pref-cari_overdue")).toBeNull();
    expect(screen.queryByTestId("pref-transaction_alerts")).toBeNull();
  });

  it("yükleme hatasında tekrar dene sunar", async () => {
    mock.resetHandlers();
    mock.onGet("/me/notification-preferences/").reply(500, { detail: "Sunucu hatası" });
    await renderWithProviders(<NotificationSettingsScreen />, { queryClient: makeClient() });
    expect(await screen.findByText("Sunucu hatası")).toBeOnTheScreen();
    expect(screen.getByText("Tekrar dene")).toBeOnTheScreen();
  });
});
