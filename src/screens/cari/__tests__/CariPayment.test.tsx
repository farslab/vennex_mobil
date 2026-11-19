import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { makeUser, renderWithProviders } from "@/test/utils";
import CariPaymentScreen, { RETURN_URL_RE } from "@/screens/cari/CariPaymentScreen";
import {
  amountInputTr,
  formatCardNumber,
  formatExpiry,
  luhnValid,
  parseAmountTr,
  parseExpiry,
  validateCardForm,
} from "@/screens/cari/card";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));
const mockGoBack = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ goBack: mockGoBack, navigate: jest.fn() }),
}));
// Web görünümü: props yakalanır, banka dönüşü testte tetiklenir
const mockWebView: { props: Record<string, unknown> | null } = { props: null };
jest.mock("react-native-webview", () => {
  const { View } = jest.requireActual("react-native");
  return {
    WebView: (p: Record<string, unknown>) => {
      mockWebView.props = p;
      return <View testID={p.testID as string} />;
    },
  };
});

// QNBpay test kartı (gerçek kart değil)
const TEST_CARD = "5456160140225418";

describe("kart yardımcıları", () => {
  it("biçim ve doğrulama", () => {
    expect(formatCardNumber("5456160140225418")).toBe("5456 1601 4022 5418");
    expect(luhnValid(TEST_CARD)).toBe(true);
    expect(luhnValid("5456160140225419")).toBe(false);
    expect(formatExpiry("0130")).toBe("01/30");
    const now = new Date(2026, 10, 20);
    expect(parseExpiry("0130", now)).toEqual({ month: "01", year: "2030" });
    expect(parseExpiry("1026", now)).toBeNull(); // süresi geçmiş
    expect(parseExpiry("1326", now)).toBeNull();
    expect(parseAmountTr("1.250,50")).toBe(1250.5);
    expect(parseAmountTr("1250.50")).toBe(1250.5);
    expect(Number.isNaN(parseAmountTr("12,345"))).toBe(true);
    expect(amountInputTr(1250.5)).toBe("1250,50");
    expect(RETURN_URL_RE.test("https://sp.serpetpay.com/cari-odeme/success/?x=1")).toBe(true);
    expect(RETURN_URL_RE.test("https://bank.example/3d")).toBe(false);
  });

  it("form kuralları", () => {
    const ok = { amount: "100,00", holder: "Ali Veli", number: TEST_CARD, expiry: "0130", cvv: "123" };
    expect(validateCardForm(ok, 150, new Date(2026, 10, 20))).toEqual({});
    const e = validateCardForm({ ...ok, amount: "200", holder: "Ali", cvv: "1" }, 150, new Date(2026, 10, 20));
    expect(Object.keys(e).sort()).toEqual(["amount", "cvv", "holder"]);
  });
});

describe("CariPaymentScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mockWebView.props = null;
    mockGoBack.mockReset();
    useAuthStore.setState({ status: "authenticated", user: makeUser({ role: "owner" }), selectedCompanyId: 10 });
    mock.onGet("/cari/summary/").reply(200, { cari_state: 2, all_total: 1250.5, overdue_total: 1250.5, invoice_count: 1 });
  });
  afterEach(() => mock.restore());

  async function fillAndPay() {
    await renderWithProviders(<CariPaymentScreen />);
    expect(await screen.findByTestId("cari-pay-total")).toHaveTextContent("₺1.250,50");
    await fireEvent.changeText(screen.getByTestId("cari-pay-holder"), "Ali Veli");
    await fireEvent.changeText(screen.getByTestId("cari-pay-number"), "5456 1601 4022 5418");
    await fireEvent.changeText(screen.getByTestId("cari-pay-expiry"), "01/30");
    await fireEvent.changeText(screen.getByTestId("cari-pay-cvv"), "276");
    await fireEvent.press(screen.getByTestId("cari-pay-submit"));
  }

  it("3D formu açar, banka dönüşünde sonucu sorgular ve başarıyı gösterir", async () => {
    mock.onPost("/cari/pay/").reply(200, { success: true, bank_html: "<form></form>", client_ref_code: "CARI-10-abc" });
    mock.onGet("/cari/payments/CARI-10-abc/").reply(200, {
      client_ref_code: "CARI-10-abc",
      status: "success",
      amount: 1250.5,
      reference_code: "ORD-1",
      completed_at: null,
    });
    await fillAndPay();

    expect(await screen.findByTestId("cari-pay-3d")).toBeOnTheScreen();
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      amount: "1250,50",
      card_number: TEST_CARD,
      card_holder_name: "Ali Veli",
      month: "01",
      year: "2030",
      cvv: "276",
    });
    expect((mockWebView.props?.source as { html: string }).html).toBe("<form></form>");

    // banka doğrulamasından sonra sunucunun dönüş sayfası yüklendi
    const onNav = mockWebView.props?.onNavigationStateChange as (n: { url: string; loading: boolean }) => void;
    await waitFor(() => onNav({ url: "https://sp.serpetpay.com/cari-odeme/success/", loading: false }));
    expect(await screen.findByText("Ödemeniz alındı")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("cari-pay-done"));
    expect(mockGoBack).toHaveBeenCalled();
  });

  it("geçersiz kartta istek göndermez", async () => {
    await renderWithProviders(<CariPaymentScreen />);
    await screen.findByTestId("cari-pay-total");
    await fireEvent.changeText(screen.getByTestId("cari-pay-holder"), "Ali Veli");
    await fireEvent.changeText(screen.getByTestId("cari-pay-number"), "5456160140225419");
    await fireEvent.changeText(screen.getByTestId("cari-pay-expiry"), "01/30");
    await fireEvent.changeText(screen.getByTestId("cari-pay-cvv"), "276");
    await fireEvent.press(screen.getByTestId("cari-pay-submit"));
    expect(await screen.findByText("Kart numarası geçersiz.")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);
  });

  it("sunucu hatası gösterilir; kart numarası ve CVV temizlenir", async () => {
    mock.onPost("/cari/pay/").reply(400, { error: "Geçersiz tutar." });
    await fillAndPay();
    expect(await screen.findByText("Geçersiz tutar.")).toBeOnTheScreen();
    expect(screen.getByTestId("cari-pay-number").props.value).toBe("");
    expect(screen.getByTestId("cari-pay-cvv").props.value).toBe("");
  });

  it("banka doğrulamasından vazgeçilirse iptal sonucu", async () => {
    mock.onPost("/cari/pay/").reply(200, { success: true, bank_html: "<form></form>", client_ref_code: "CARI-10-x" });
    mock.onGet("/cari/payments/CARI-10-x/").reply(200, { client_ref_code: "CARI-10-x", status: "pending", amount: 1250.5, reference_code: null, completed_at: null });
    await fillAndPay();
    await fireEvent.press(await screen.findByTestId("cari-pay-3d-cancel"));
    expect(await screen.findByText("Ödeme iptal edildi")).toBeOnTheScreen();
  });
});
