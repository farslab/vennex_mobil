import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { useToastStore } from "@/design-system";
import { renderWithProviders } from "@/test/utils";
import { MovementFormSheet, type MovementMode } from "@/screens/stock/components/MovementFormSheet";
import { inventory, locations, skus } from "./fixtures";

/** Lokasyonlar yüklenene kadar AppSelect alanı "Yükleniyor…" gösterir ve basılamaz */
async function waitForLocations() {
  await waitFor(() => expect(screen.queryByText("Yükleniyor…")).toBeNull());
}

async function pickOption(testID: string, label: string) {
  await waitForLocations();
  await fireEvent.press(screen.getByTestId(testID));
  const [option] = await screen.findAllByRole("radio", { name: new RegExp(label) });
  await fireEvent.press(option);
}

async function pickSku(name: string) {
  await fireEvent.press(screen.getByTestId("movement-sku"));
  await fireEvent.press(await screen.findByText(name));
}

const okMovement = { id: 900, movement_type: "transfer", sku: 1, from_location: 1, to_location: 3, quantity: 5 };

describe("MovementFormSheet", () => {
  let mock: MockAdapter;
  const onClose = jest.fn();

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    onClose.mockReset();
    useToastStore.setState({ current: null });
    mock.onGet("/stock/locations/").reply(200, { results: locations });
    mock.onGet("/stock/skus/").reply(200, { results: skus.filter((s) => s.kind !== "composite") });
    mock.onGet(/\/stock\/locations\/\d+\/inventory\//).reply((cfg) => [200, inventory(Number(/locations\/(\d+)\//.exec(cfg.url ?? "")?.[1]))]);
  });
  afterEach(() => mock.restore());

  const renderSheet = (mode: MovementMode, presetLocationId?: number) =>
    renderWithProviders(<MovementFormSheet visible mode={mode} onClose={onClose} presetLocationId={presetLocationId} />);

  it("SKU seçicide stockable=true ile sunucu araması yapar", async () => {
    await renderSheet("receipt");
    await fireEvent.press(screen.getByTestId("movement-sku"));
    await screen.findByText("Su 500 ml");
    await fireEvent.changeText(screen.getByTestId("sku-picker-search"), "kahve");
    await waitFor(
      () => expect(mock.history.get.some((r) => r.url === "/stock/skus/" && r.params?.q === "kahve" && r.params?.stockable === "true")).toBe(true),
      { timeout: 2000 }
    );
  });

  it("aynı kaynak/hedef lokasyonu reddeder ve istek atmaz", async () => {
    await renderSheet("transfer");
    await pickSku("Su 500 ml");
    await pickOption("movement-to", "Servis Aracı");
    await pickOption("movement-from", "Servis Aracı");
    await fireEvent.changeText(screen.getByTestId("movement-quantity"), "1");
    await fireEvent.press(screen.getByTestId("movement-continue"));

    expect(await screen.findByText("Kaynak ve hedef lokasyon aynı olamaz.")).toBeOnTheScreen();
    expect(screen.queryByTestId("confirm-sheet-confirm")).toBeNull();
    expect(mock.history.post).toHaveLength(0);
  });

  it("kaynakta mevcut miktarı gösterir ve fazlasını reddeder; kesirli adeti reddeder", async () => {
    await renderSheet("transfer", 1);
    await pickSku("Su 500 ml");
    expect(await screen.findByText("Kaynakta mevcut: 120 adet")).toBeOnTheScreen();
    await pickOption("movement-to", "Servis Aracı");

    await fireEvent.changeText(screen.getByTestId("movement-quantity"), "121");
    await fireEvent.press(screen.getByTestId("movement-continue"));
    expect(await screen.findByText("Kaynakta yeterli stok yok. Mevcut: 120 adet")).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId("movement-quantity"), "2,5");
    await fireEvent.press(screen.getByTestId("movement-continue"));
    expect(await screen.findByText("Adet bazlı üründe kesirli miktar girilemez.")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);
  });

  it("otomat hedef olarak seçilemez", async () => {
    await renderSheet("transfer", 1);
    await waitForLocations();
    await fireEvent.press(screen.getByTestId("movement-to"));
    expect(await screen.findByText(/Otomata doğrudan transfer yapılamaz/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole("radio", { name: /Otomat Kampüs/ }));
    // devre dışı seçenek seçilmez → alan boş kalır
    expect(screen.getByTestId("movement-to")).toHaveProp("accessibilityLabel", "Hedef lokasyon: seçilmedi");
  });

  it("onay özetini gösterir, tek istek atar ve çift dokunmayı engeller", async () => {
    let release: () => void = () => {};
    mock.onPost("/stock/transfers/").reply(
      () =>
        new Promise((resolve) => {
          release = () => resolve([201, okMovement]);
        })
    );
    await renderSheet("transfer", 1);
    await pickSku("Su 500 ml");
    await screen.findByText("Kaynakta mevcut: 120 adet");
    await pickOption("movement-to", "Servis Aracı");
    await fireEvent.changeText(screen.getByTestId("movement-quantity"), "20");
    await fireEvent.press(screen.getByTestId("movement-continue"));

    // Özet
    expect(await screen.findByText("Transfer özeti")).toBeOnTheScreen();
    expect(screen.getAllByText("Su 500 ml · SU-500")).toHaveLength(2); // alan + özet
    expect(screen.getByText("20 adet")).toBeOnTheScreen();
    expect(screen.getByText("120 adet → 100 adet")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);

    const confirm = screen.getByTestId("confirm-sheet-confirm");
    await fireEvent.press(confirm);
    await fireEvent.press(confirm);
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    release();

    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mock.history.post).toHaveLength(1);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ from_location_id: 1, to_location_id: 3, sku_id: 1, quantity: "20" });
    expect(useToastStore.getState().current?.message).toBe("Transfer kaydedildi.");
  });

  it("backend hatasını onay sayfasında gösterir, formu korur", async () => {
    mock.onPost("/stock/receipts/").reply(400, { detail: '"Su 500 ml" reçeteli bir üründür.' });
    await renderSheet("receipt", 1);
    await pickSku("Su 500 ml");
    await fireEvent.changeText(screen.getByTestId("movement-quantity"), "24");
    await fireEvent.press(screen.getByTestId("movement-continue"));
    await fireEvent.press(await screen.findByTestId("confirm-sheet-confirm"));

    expect(await screen.findByText('"Su 500 ml" reçeteli bir üründür.')).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("movement-quantity").props.value).toBe("24");
  });

  it("düzeltmede çıkarma yönü negatif miktar, gram birimi 3 ondalık gönderir", async () => {
    mock.onPost("/stock/adjustments/").reply(201, { ...okMovement, movement_type: "adjustment" });
    await renderSheet("adjustment", 1);
    await pickSku("Çekirdek Kahve");
    expect(await screen.findByText("Lokasyonda mevcut: 2.500,5 g")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Çıkar (−)"));
    await fireEvent.changeText(screen.getByTestId("movement-quantity"), "12,25");
    await fireEvent.changeText(screen.getByTestId("movement-reason"), "Fire");
    await fireEvent.press(screen.getByTestId("movement-continue"));

    expect(await screen.findByText("−12,25 g")).toBeOnTheScreen();
    expect(screen.getByText("2.500,5 g → 2.488,25 g")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ location_id: 1, sku_id: 2, quantity: "-12.250", reason: "Fire" });
  });
});
