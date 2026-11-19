import React from "react";
import MockAdapter from "axios-mock-adapter";
import { screen } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import CompanyAccountScreen from "@/screens/account/CompanyAccountScreen";
import { makeUser, renderWithProviders } from "@/test/utils";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn() }),
}));

const company = {
  id: 10,
  name: "Test Şirketi",
  address: "",
  phone: "",
  email: "muhasebe@example.com",
  tax_number: "1234567890",
  uye_isyeri: "",
  uye_isyeri_kisa_ad: "",
  cari_state: 2,
  has_personnel_card_device: true,
  uses_stock_mode: true,
};

describe("CompanyAccountScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet("/companies/10/").reply(200, company);
  });
  afterEach(() => mock.restore());

  it("sahip: şirket bilgisi, cari özeti ve açık faturaları gösterir", async () => {
    useAuthStore.setState({ status: "authenticated", user: makeUser({ role: "owner" }), selectedCompanyId: 10 });
    mock.onGet("/cari/summary/").reply(200, {
      enabled: true,
      company_name: "Test Şirketi",
      cari_state: 2,
      is_locked: false,
      overdue_total: 4800,
      all_total: 6000.25,
      invoice_count: 2,
      balance_only: false,
      contact_id: 1,
    });
    mock.onGet("/cari/invoices/").reply(200, {
      results: [
        {
          id: 71,
          parasut_invoice_id: 880011,
          issue_date: null,
          due_date: "2026-10-15",
          net_total: "4800.00",
          remaining_in_trl: "4800.00",
          payment_status: "overdue",
          e_document_type: "e_archives",
          e_document_id: 5,
        },
      ],
    });

    await renderWithProviders(<CompanyAccountScreen />);

    expect(await screen.findByText("1234567890")).toBeOnTheScreen();
    expect(await screen.findByText("Fatura #880011")).toBeOnTheScreen();
    expect(screen.getByText("Vadesi geçti")).toBeOnTheScreen();
    expect(screen.getByText("Kırmızı")).toBeOnTheScreen();
    // boş adres uydurulmaz
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });

  it("cari uçları 403 dönerse anlaşılır mesaj gösterir", async () => {
    useAuthStore.setState({ status: "authenticated", user: makeUser({ role: "owner" }), selectedCompanyId: 10 });
    mock.onGet("/cari/summary/").reply(403, { detail: "Yetki yok" });
    mock.onGet("/cari/invoices/").reply(403, { detail: "Yetki yok" });

    await renderWithProviders(<CompanyAccountScreen />);

    expect((await screen.findAllByText("Bu bilgiyi görüntüleme yetkiniz yok.")).length).toBe(2);
    expect(screen.queryByText("Tekrar dene")).toBeNull();
  });

  it("teknisyen için cari istekleri atılmaz", async () => {
    useAuthStore.setState({ status: "authenticated", user: makeUser({ role: "tech" }), selectedCompanyId: 10 });
    await renderWithProviders(<CompanyAccountScreen />);
    expect(await screen.findByText("Cari ve fatura bilgileri yalnızca şirket sahibine gösterilir.")).toBeOnTheScreen();
    expect(mock.history.get.map((r) => r.url)).toEqual(["/companies/10/"]);
  });
});
