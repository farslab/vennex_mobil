import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { makeUser, renderWithProviders } from "@/test/utils";
import StockLocationDetailScreen from "@/screens/stock/StockLocationDetailScreen";
import type { RootScreenProps } from "@/navigation/types";
import { inventory, locations, movement, skus } from "./fixtures";

// Form sheet'in aldığı prop'ları kaydeder (kapanışta modun korunduğunu doğrulamak için); gerçek bileşen çizilir
const sheetProps: { visible: boolean; mode: string }[] = [];
jest.mock("@/screens/stock/components/MovementFormSheet", () => {
  const actual = jest.requireActual("@/screens/stock/components/MovementFormSheet");
  const R = jest.requireActual<typeof import("react")>("react");
  return {
    ...actual,
    MovementFormSheet: (p: { visible: boolean; mode: string }) => {
      sheetProps.push({ visible: p.visible, mode: p.mode });
      return R.createElement(actual.MovementFormSheet, p);
    },
  };
});

const setOptions = jest.fn();
const props = (locationId: number, name?: string) =>
  ({
    route: { key: "k", name: "StockLocationDetail", params: { locationId, name } },
    navigation: { setOptions, navigate: jest.fn(), goBack: jest.fn() },
  }) as unknown as RootScreenProps<"StockLocationDetail">;

describe("StockLocationDetailScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    setOptions.mockReset();
    useAuthStore.setState({ user: makeUser({ permissions: ["manage_stock"] }) });
    mock.onGet("/stock/skus/").reply(200, { results: skus });
  });
  afterEach(() => mock.restore());

  it("envanteri `sku` alanıyla eşleyip birimle gösterir, başlığı ayarlar", async () => {
    mock.onGet("/stock/locations/1/inventory/").reply(200, inventory(1));
    await renderWithProviders(<StockLocationDetailScreen {...props(1, "Merkez")} />);

    expect(await screen.findByText("120 adet")).toBeOnTheScreen();
    expect(await screen.findByText("2.500,5 g")).toBeOnTheScreen();
    await waitFor(() => expect(setOptions).toHaveBeenLastCalledWith({ title: "Merkez Depo" }));
    expect(screen.getByTestId("detail-transfer")).toBeOnTheScreen();
    // hareket geçmişi sekme açılana kadar çekilmez
    expect(mock.history.get.some((r) => r.url === "/stock/locations/1/movements/")).toBe(false);
  });

  it("hareketleri bu lokasyona göre +/− işaretler ve sayfalı çeker", async () => {
    mock.onGet("/stock/locations/3/inventory/").reply(200, inventory(3));
    mock.onGet("/stock/locations/3/movements/").reply(200, {
      count: 2,
      page: 1,
      num_pages: 1,
      results: [
        movement({ id: 1, from_location: 1, to_location: 3, quantity: 10 }),
        movement({ id: 2, movement_type: "refill", from_location: 3, from_location_name: "Servis Aracı", to_location: 4, to_location_name: "Otomat", quantity: 4 }),
      ],
    });
    await renderWithProviders(<StockLocationDetailScreen {...props(3)} />);
    expect(await screen.findByText("-2 adet")).toBeOnTheScreen();
    expect(screen.getAllByText("Negatif")).toHaveLength(2); // sayaç etiketi + satır rozeti

    await fireEvent.press(screen.getByText("Hareketler"));
    expect(await screen.findByTestId("movement-qty-1")).toHaveTextContent("+10 adet");
    expect(screen.getByTestId("movement-qty-2")).toHaveTextContent("−4 adet");
    expect(mock.history.get.find((r) => r.url === "/stock/locations/3/movements/")?.params).toEqual({ page: 1 });
  });

  it("yetki yoksa hareket aksiyonlarını göstermez", async () => {
    useAuthStore.setState({ user: makeUser({ permissions: [] }) });
    mock.onGet("/stock/locations/1/inventory/").reply(200, inventory(1));
    await renderWithProviders(<StockLocationDetailScreen {...props(1)} />);
    await screen.findByText("120 adet");
    expect(screen.queryByTestId("detail-transfer")).toBeNull();
    expect(screen.queryByTestId("detail-adjustment")).toBeNull();
  });

  it("hareket formu kapanırken son modu korur (Transfer olarak yeniden mount olmaz)", async () => {
    mock.onGet("/stock/locations/").reply(200, { results: locations });
    mock.onGet(/\/stock\/locations\/\d+\/inventory\//).reply(200, inventory(1));
    await renderWithProviders(<StockLocationDetailScreen {...props(1)} />);
    await screen.findByText("120 adet");

    await fireEvent.press(screen.getByTestId("detail-adjustment"));
    expect(await screen.findByText("Stok Düzeltme")).toBeOnTheScreen();
    sheetProps.length = 0;

    await fireEvent.press(screen.getByText("Vazgeç"));
    await waitFor(() => expect(sheetProps.some((p) => !p.visible)).toBe(true));
    // Kapanış render'larında mod "adjustment" kalır
    expect(sheetProps.filter((p) => !p.visible).every((p) => p.mode === "adjustment")).toBe(true);
    // "Transfer" yalnız aksiyon butonunda; form başlığı olarak yeniden çizilmez
    expect(screen.queryAllByText("Transfer", { includeHiddenElements: true })).toHaveLength(1);
  });

  it("pasif lokasyonda hareket butonlarını gizler ve ipucu gösterir", async () => {
    mock.onGet("/stock/locations/2/inventory/").reply(200, { ...inventory(2), location: { ...locations[1], is_active: false } });
    await renderWithProviders(<StockLocationDetailScreen {...props(2)} />);
    expect(await screen.findByText("Pasif lokasyonda stok hareketi yapılamaz. Hareket için lokasyonu Lokasyonlar sekmesinden aktif yapın.")).toBeOnTheScreen();
    expect(screen.getByText("Pasif")).toBeOnTheScreen();
    expect(screen.queryByTestId("detail-transfer")).toBeNull();
    expect(screen.queryByTestId("detail-receipt")).toBeNull();
    expect(screen.queryByTestId("detail-adjustment")).toBeNull();
  });

  it("aktif lokasyonda pasif ipucu gösterilmez", async () => {
    mock.onGet("/stock/locations/1/inventory/").reply(200, inventory(1));
    await renderWithProviders(<StockLocationDetailScreen {...props(1)} />);
    await screen.findByText("120 adet");
    expect(screen.queryByText(/Pasif lokasyonda stok hareketi/)).toBeNull();
  });

  it("boş envanter ve hata/tekrar dene durumları", async () => {
    mock.onGet("/stock/locations/2/inventory/").replyOnce(404, { detail: "Bulunamadı." });
    mock.onGet("/stock/locations/2/inventory/").reply(200, inventory(2));
    await renderWithProviders(<StockLocationDetailScreen {...props(2)} />);
    expect(await screen.findByText("Bulunamadı.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Tekrar dene"));
    expect(await screen.findByText("Bu lokasyonda stok yok")).toBeOnTheScreen();
  });
});
