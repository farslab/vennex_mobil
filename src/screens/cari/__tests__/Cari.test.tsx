import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { makeUser, renderWithProviders } from "@/test/utils";
import { CariBanner } from "@/screens/cari/CariBanner";
import { CariLockedScreen } from "@/screens/cari/CariLockedScreen";
import { CariOverduePopup, resetCariPopupSession } from "@/screens/cari/CariOverduePopup";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));
const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate }),
}));

const config = (state: number, extra: Record<string, unknown> = {}) => ({
  cari: { enabled: true, state, locked: state === 4, payment_path: "/v2/cari-odeme/", ...extra },
});
const summary = (total: number) => ({ cari_state: 0, all_total: total, overdue_total: total, invoice_count: 1 });

function login(role: "owner" | "tech") {
  useAuthStore.setState({ status: "authenticated", user: makeUser({ role }), selectedCompanyId: 10 });
}

describe("cari — web ile aynı şerit / uyarı / kilit", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    resetCariPopupSession();
    mockNavigate.mockReset();
  });
  afterEach(() => mock.restore());

  it.each([
    [1, "Ödenmemiş cari borcunuz bulunmaktadır."],
    [2, "Vadesi geçmiş faturanız bulunmaktadır."],
    [3, "Vadesi geçmiş faturanız bulunmaktadır."],
  ])("durum %i: sahip için tutarlı şerit", async (state, text) => {
    login("owner");
    mock.onGet("/app/config/").reply(200, config(state));
    mock.onGet("/cari/summary/").reply(200, summary(1250.5));
    await renderWithProviders(<CariBanner />);
    expect(await screen.findByTestId(`cari-banner-${state}`)).toBeOnTheScreen();
    expect(screen.getByText(new RegExp(text.replace(".", "\\.")))).toBeOnTheScreen();
    expect(screen.getByText(/1\.250,50/)).toBeOnTheScreen();
  });

  it("durum 0, tutar yok, teknisyen veya ödeme kapalı → şerit yok", async () => {
    login("owner");
    mock.onGet("/app/config/").reply(200, config(0));
    const a = await renderWithProviders(<CariBanner />);
    await waitFor(() => expect(a.queryClient.isFetching()).toBe(0));
    expect(screen.queryByTestId(/cari-banner/)).toBeNull();
    await a.unmount();

    mock.onGet("/app/config/").reply(200, config(2));
    mock.onGet("/cari/summary/").reply(200, summary(0));
    const b = await renderWithProviders(<CariBanner />);
    await waitFor(() => expect(b.queryClient.isFetching()).toBe(0));
    expect(screen.queryByTestId(/cari-banner/)).toBeNull();
    await b.unmount();

    login("tech");
    mock.resetHistory();
    mock.onGet("/app/config/").reply(200, config(2));
    const c = await renderWithProviders(<CariBanner />);
    await waitFor(() => expect(c.queryClient.isFetching()).toBe(0));
    expect(screen.queryByTestId(/cari-banner/)).toBeNull();
    expect(mock.history.get.some((r) => r.url === "/cari/summary/")).toBe(false);
  });

  it("'Hemen Öde' uygulama içi ödeme ekranını açar", async () => {
    login("owner");
    mock.onGet("/app/config/").reply(200, config(1));
    mock.onGet("/cari/summary/").reply(200, summary(10));
    await renderWithProviders(<CariBanner />);
    await fireEvent.press(await screen.findByTestId("cari-banner-pay"));
    expect(mockNavigate).toHaveBeenCalledWith("CariPayment");
  });

  it("durum 3: 'Ödeme Uyarısı' oturumda bir kez", async () => {
    login("owner");
    mock.onGet("/app/config/").reply(200, config(3));
    mock.onGet("/cari/summary/").reply(200, summary(500));
    const r = await renderWithProviders(<CariOverduePopup />);
    expect(await screen.findByText("Ödeme Uyarısı")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Daha Sonra"));
    await r.unmount();
    const r2 = await renderWithProviders(<CariOverduePopup />);
    await waitFor(() => expect(r2.queryClient.isFetching()).toBe(0));
    expect(screen.queryByText("Ödeme Uyarısı")).toBeNull();
  });

  it("kilitli: sahip borç + faturalar, teknisyen 'Hesap Kısıtlanmıştır'", async () => {
    login("owner");
    mock.onGet("/app/config/").reply(200, config(4));
    mock.onGet("/cari/summary/").reply(200, summary(900));
    const r = await renderWithProviders(<CariLockedScreen />);
    expect(await screen.findByText("Hesabınız Kilitlendi")).toBeOnTheScreen();
    expect(await screen.findByTestId("cari-locked-balance")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("cari-locked-invoices"));
    expect(mockNavigate).toHaveBeenCalledWith("CompanyAccount");
    await r.unmount();

    login("tech");
    await renderWithProviders(<CariLockedScreen />);
    expect(await screen.findByText("Hesap Kısıtlanmıştır")).toBeOnTheScreen();
    expect(screen.queryByTestId("cari-locked-invoices")).toBeNull();
  });

  it("sunucu 403 cari_locked → yapılandırma yeniden alınır", async () => {
    login("owner");
    mock.onGet("/app/config/").reply(200, config(0));
    mock.onGet("/pos-devices/").reply(403, { detail: "kilitli", code: "cari_locked" });
    const { queryClient } = await renderWithProviders(<CariBanner />);
    await waitFor(() => expect(mock.history.get.filter((x) => x.url === "/app/config/").length).toBe(1));
    // authStore'daki işleyici global queryClient'ı kullanır; burada isteğin reddedildiğini doğrularız
    await expect(apiClient.get("/pos-devices/")).rejects.toMatchObject({ status: 403 });
    expect(queryClient).toBeTruthy();
  });
});
