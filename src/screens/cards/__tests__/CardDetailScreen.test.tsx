import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { renderWithProviders } from "@/test/utils";
import CardDetailScreen from "@/screens/cards/CardDetailScreen";
import type { RootScreenProps } from "@/navigation/types";
import { cardJson, FULL, loginAs, NO_BALANCE } from "./fixtures";

const goBack = jest.fn();
function props(id: number) {
  return {
    route: { key: "CardDetail-1", name: "CardDetail", params: { id } },
    navigation: { goBack, navigate: jest.fn(), setOptions: jest.fn() },
  } as unknown as Pick<RootScreenProps<"CardDetail">, "route" | "navigation">;
}

const tx = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  pt_id: `T${id}`,
  pt_datetime: "2026-11-17T12:30:00+03:00",
  amount: "12.50",
  pt_type: 5,
  status: true,
  iptalNo: 0,
  product_no: "14",
  pt_pan: "04 AA BB 05",
  bankRefNo: null,
  display_name: `Otomat 1 · Ürün ${id}`,
  ...over,
});

describe("CardDetailScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    goBack.mockReset();
    loginAs(FULL);
  });
  afterEach(() => mock.restore());

  it("detay ve işlem geçmişini gösterir; başarısız işlemde neden yazar", async () => {
    mock.onGet("/cards/5/").reply(200, cardJson(5, { balance: "1234.5" }));
    mock.onGet("/cards/5/transactions/").reply(200, {
      card: cardJson(5),
      transactions: [tx(1), tx(2, { status: false, iptalNo: 2 })],
      success_count: 1,
      fail_count: 1,
    });
    await renderWithProviders(<CardDetailScreen {...props(5)} />);
    expect(await screen.findByText("₺1.234,50")).toBeOnTheScreen();
    expect(screen.getByText("04 AA BB 05")).toBeOnTheScreen();
    expect(await screen.findByText("Otomat 1 · Ürün 1")).toBeOnTheScreen();
    expect(screen.getByText(/Banka reddi/)).toBeOnTheScreen();
    expect(screen.getByText("1 başarılı")).toBeOnTheScreen();
    expect(mock.history.get.find((r) => r.url === "/cards/5/transactions/")?.params).toEqual({ limit: 100 });
  });

  it("100 işlem dolunca 'Daha fazla göster' limit=500 ister", async () => {
    mock.onGet("/cards/5/").reply(200, cardJson(5));
    mock.onGet("/cards/5/transactions/").reply((config) => {
      const n = config.params.limit === 500 ? 120 : 100;
      return [200, { card: cardJson(5), transactions: Array.from({ length: n }, (_, i) => tx(i + 1)), success_count: n, fail_count: 0 }];
    });
    await renderWithProviders(<CardDetailScreen {...props(5)} />);
    await fireEvent.press(await screen.findByTestId("tx-more"));
    await waitFor(() => expect(screen.getByText("Son 120 işlem")).toBeOnTheScreen());
  });

  it("tek kart bakiye işlemi toplu uca tek id ile gider", async () => {
    mock.onGet("/cards/5/").reply(200, cardJson(5, { balance: "20.00" }));
    mock.onGet("/cards/5/transactions/").reply(200, { card: cardJson(5), transactions: [], success_count: 0, fail_count: 0 });
    mock.onPost("/cards/bulk/balance/").reply(200, { detail: "1 kart güncellendi.", count: 1 });
    await renderWithProviders(<CardDetailScreen {...props(5)} />);
    await fireEvent.press(await screen.findByTestId("detail-balance"));
    await fireEvent.changeText(screen.getByTestId("balance-amount"), "30");
    await fireEvent.press(screen.getByTestId("balance-continue"));
    expect(screen.getByText("Yeni bakiye")).toBeOnTheScreen();
    expect(screen.getByText("₺50,00")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ card_ids: [5], operation: "add", amount: "30.00" });
  });

  it("bakiye yetkisi yoksa bakiye işlemi butonu yok", async () => {
    loginAs(NO_BALANCE, "tech");
    mock.onGet("/cards/5/").reply(200, cardJson(5));
    mock.onGet("/cards/5/transactions/").reply(200, { card: cardJson(5), transactions: [], success_count: 0, fail_count: 0 });
    await renderWithProviders(<CardDetailScreen {...props(5)} />);
    await screen.findByTestId("detail-edit");
    expect(screen.queryByTestId("detail-balance")).toBeNull();
  });

  it("düzenleme yalnız değişen alanları PATCH eder", async () => {
    mock.onGet("/cards/5/").reply(200, cardJson(5));
    mock.onGet("/cards/5/transactions/").reply(200, { card: cardJson(5), transactions: [], success_count: 0, fail_count: 0 });
    mock.onGet("/card-groups/").reply(200, { results: [{ id: 1, name: "Ofis", active_cards_count: 1, pos_device_count: 1 }] });
    mock.onPatch("/cards/5/").reply(200, cardJson(5, { first_name: "Yeni" }));
    await renderWithProviders(<CardDetailScreen {...props(5)} />);
    await fireEvent.press(await screen.findByTestId("detail-edit"));
    await fireEvent.changeText(screen.getByTestId("card-form-first-name"), "Yeni");
    await fireEvent.press(screen.getByTestId("card-form-submit"));
    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ first_name: "Yeni" });
  });

  it("silme onaylanınca DELETE atar ve geri döner", async () => {
    mock.onGet("/cards/5/").reply(200, cardJson(5));
    mock.onGet("/cards/5/transactions/").reply(200, { card: cardJson(5), transactions: [], success_count: 0, fail_count: 0 });
    mock.onDelete("/cards/5/").reply(204);
    await renderWithProviders(<CardDetailScreen {...props(5)} />);
    await fireEvent.press(await screen.findByTestId("detail-delete"));
    expect(screen.getByText("Bu işlem geri alınamaz.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(goBack).toHaveBeenCalled());
    expect(mock.history.delete).toHaveLength(1);
  });

  it("404 hatasında hata durumu ve tekrar dene", async () => {
    mock.onGet("/cards/5/").reply(404, { detail: "Bulunamadı." });
    await renderWithProviders(<CardDetailScreen {...props(5)} />);
    expect(await screen.findByText("Bulunamadı.")).toBeOnTheScreen();
    expect(screen.getByText("Tekrar dene")).toBeOnTheScreen();
  });
});
