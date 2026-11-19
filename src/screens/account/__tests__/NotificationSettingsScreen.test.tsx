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
  technical_errors: true,
  report_ready: true,
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
    mock.onPatch("/me/notification-preferences/").reply(200, { ...prefs, report_ready: false });
    const { queryClient } = await renderWithProviders(<NotificationSettingsScreen />, { queryClient: makeClient() });

    const toggle = await screen.findByTestId("pref-report_ready");
    expect(toggle.props.value).toBe(true);
    await fireEvent(toggle, "valueChange", false);

    await waitFor(() => expect(screen.getByTestId("pref-report_ready").props.value).toBe(false));
    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ report_ready: false });
    await waitFor(() =>
      expect(queryClient.getQueryData<NotificationPreferences>(queryKeys.notifications.preferences())?.report_ready).toBe(false)
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

    await fireEvent(await screen.findByTestId("pref-technical_errors"), "valueChange", false);
    // istek sürerken iyimser değer
    await waitFor(() => expect(screen.getByTestId("pref-technical_errors").props.value).toBe(false));
    await waitFor(() => expect(release).not.toBeNull());
    await act(async () => {
      release?.();
    });

    await waitFor(() => expect(screen.getByTestId("pref-technical_errors").props.value).toBe(true));
    expect(mock.history.patch).toHaveLength(1);
  });

  it("yalnız teknik hata ve rapor hazır tercihlerini gösterir", async () => {
    await renderWithProviders(<NotificationSettingsScreen />, { queryClient: makeClient() });
    expect(await screen.findByTestId("pref-technical_errors")).toBeOnTheScreen();
    expect(screen.getByTestId("pref-report_ready")).toBeOnTheScreen();
    for (const hidden of ["device_offline", "stock_low", "transaction_alerts", "card_pending", "cari_overdue"]) {
      expect(screen.queryByTestId(`pref-${hidden}`)).toBeNull();
    }
    expect(screen.queryByText("Yeni işlemler")).toBeNull();
  });

  it("yükleme hatasında tekrar dene sunar", async () => {
    mock.resetHandlers();
    mock.onGet("/me/notification-preferences/").reply(500, { detail: "Sunucu hatası" });
    await renderWithProviders(<NotificationSettingsScreen />, { queryClient: makeClient() });
    expect(await screen.findByText("Sunucu hatası")).toBeOnTheScreen();
    expect(screen.getByText("Tekrar dene")).toBeOnTheScreen();
  });
});
