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

const log = (id: number, over: Record<string, unknown> = {}) => ({
  id,
  created_at: "2026-11-17T12:30:00+03:00",
  amount: "-12.50",
  balance_before: "50.00",
  balance_after: "37.50",
  source: "pos_sale",
  source_label: "POS Satış",
  operation: "subtract",
  operation_label: "Düş",
  description: null,
  user: null,
  pos_device: { id: 1, sn: "PAV1", pos_name: "Otomat 1" },
  ...over,
});
const logsPage = (results: unknown[], page = 1, num_pages = 1, count = results.length) => ({ count, page, num_pages, page_size: 25, results });

describe("CardDetailScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    goBack.mockReset();
    loginAs(FULL);
  });
  afterEach(() => mock.restore());

  it("detay ve web ile aynı bakiye hareketlerini gösterir (POS işlem listesi değil)", async () => {
    mock.onGet("/cards/5/").reply(200, cardJson(5, { balance: "1234.5" }));
    mock.onGet("/cards/5/balance-logs/").reply(200, logsPage([log(1), log(2, { amount: "25.00", operation_label: "Ekle", source_label: "Dashboard Manuel", pos_device: null, user: { id: 3, name: "Ayşe" }, balance_after: "62.50" })]));
    await renderWithProviders(<CardDetailScreen {...props(5)} />);
    expect(await screen.findByText("₺1.234,50")).toBeOnTheScreen();
    expect(screen.getByText("04 AA BB 05")).toBeOnTheScreen();
    expect(await screen.findByText("Düş")).toBeOnTheScreen();
    expect(screen.getByText(/POS Satış · Otomat 1/)).toBeOnTheScreen();
    expect(screen.getByText("+₺25,00")).toBeOnTheScreen();
    expect(screen.getByText(/Dashboard Manuel · Ayşe/)).toBeOnTheScreen();
    expect(screen.getByText("Bakiye ₺62,50")).toBeOnTheScreen();
    expect(screen.getByText("2 / 2 hareket")).toBeOnTheScreen();
    expect(mock.history.get.some((r) => r.url === "/cards/5/transactions/")).toBe(false);
  });

  it("'Daha fazla göster' sonraki sayfayı ister; toplam sayı sunucudan", async () => {
    mock.onGet("/cards/5/").reply(200, cardJson(5));
    mock.onGet("/cards/5/balance-logs/").reply((config) => {
      const page = config.params.page;
      const rows = Array.from({ length: 25 }, (_, i) => log((page - 1) * 25 + i + 1));
      return [200, logsPage(rows, page, 3, 60)];
    });
    await renderWithProviders(<CardDetailScreen {...props(5)} />);
    expect(await screen.findByText("25 / 60 hareket")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("logs-more"));
    await waitFor(() => expect(screen.getByText("50 / 60 hareket")).toBeOnTheScreen());
  });

  it("tek kart bakiye işlemi toplu uca tek id ile gider", async () => {
    mock.onGet("/cards/5/").reply(200, cardJson(5, { balance: "20.00" }));
    mock.onGet("/cards/5/balance-logs/").reply(200, logsPage([]));
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
    mock.onGet("/cards/5/balance-logs/").reply(200, logsPage([]));
    await renderWithProviders(<CardDetailScreen {...props(5)} />);
    await screen.findByTestId("detail-edit");
    expect(screen.queryByTestId("detail-balance")).toBeNull();
  });

  it("düzenleme yalnız değişen alanları PATCH eder", async () => {
    mock.onGet("/cards/5/").reply(200, cardJson(5));
    mock.onGet("/cards/5/balance-logs/").reply(200, logsPage([]));
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
    mock.onGet("/cards/5/balance-logs/").reply(200, logsPage([]));
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
