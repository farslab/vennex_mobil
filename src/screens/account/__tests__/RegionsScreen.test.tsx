import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { normalizeRegion } from "@/api/regions";
import { useAuthStore } from "@/store/authStore";
import RegionsScreen from "@/screens/account/RegionsScreen";
import { makeUser, renderWithProviders } from "@/test/utils";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

type RawRegion = Record<string, unknown>;
const regions: RawRegion[] = [
  {
    id: 1,
    name: "İstanbul Avrupa",
    description: "Plaza lokasyonları",
    total_pos_device_count: 5,
    created_at: "2026-01-10T09:00:00+03:00",
    locations: [
      { id: 11, name: "Merkez Plaza", address: "Deneme Cad. 1", latitude: "41.008200", longitude: "28.978400", is_active: true, pos_device_count: 3 },
      { id: 12, name: "Teknopark", address: "", latitude: null, longitude: null, is_active: false, pos_device_count: 2 },
    ],
  },
];

describe("normalizeRegion", () => {
  it("decimal koordinatları sayıya çevirir, boş açıklamayı null yapar, toplamı hesaplar", () => {
    const r = normalizeRegion({ id: "3", name: "X", description: "  ", locations: [{ id: 1, name: "A", latitude: "41.5", pos_device_count: 2 }, { id: 2, name: "B", pos_device_count: 4 }] });
    expect(r.description).toBeNull();
    expect(r.total_pos_device_count).toBe(6);
    expect(r.locations[0].latitude).toBe(41.5);
    expect(r.locations[1].latitude).toBeNull();
    expect(r.locations[1].is_active).toBe(true);
  });
});

describe("RegionsScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    useAuthStore.setState({ status: "authenticated", user: makeUser({ role: "owner" }), selectedCompanyId: 10 });
  });
  afterEach(() => mock.restore());

  it("bölgeleri listeler; açınca konumları ve pasif rozetini gösterir", async () => {
    mock.onGet("/regions/").reply(200, { results: regions });
    await renderWithProviders(<RegionsScreen />);

    expect(await screen.findByText("İstanbul Avrupa")).toBeOnTheScreen();
    expect(screen.getByText("2 konum")).toBeOnTheScreen();
    expect(screen.getByText("5 POS cihazı")).toBeOnTheScreen();
    expect(screen.queryByText("Merkez Plaza")).toBeNull();

    await fireEvent.press(screen.getByLabelText("İstanbul Avrupa, 2 konum, 5 POS cihazı"));
    expect(await screen.findByText("Merkez Plaza")).toBeOnTheScreen();
    expect(screen.getByText("Pasif")).toBeOnTheScreen();
    expect(screen.getByText("3 POS cihazı")).toBeOnTheScreen();
  });

  it("boş liste için yönlendirici boş durum gösterir", async () => {
    mock.onGet("/regions/").reply(200, { results: [] });
    await renderWithProviders(<RegionsScreen />);
    expect(await screen.findByText("Henüz bölge yok")).toBeOnTheScreen();
  });

  it("yeni bölge oluşturur ve listeyi yeniler", async () => {
    let list: RawRegion[] = regions;
    mock.onGet("/regions/").reply(() => [200, { results: list }]);
    mock.onPost("/regions/").reply((cfg) => {
      const body = JSON.parse(cfg.data);
      const created = { id: 2, name: body.name, description: body.description, total_pos_device_count: 0, locations: [], created_at: null };
      list = [...regions, created];
      return [201, created];
    });
    await renderWithProviders(<RegionsScreen />);
    await screen.findByText("İstanbul Avrupa");

    await fireEvent.press(screen.getByTestId("add-region"));
    await fireEvent.changeText(await screen.findByTestId("region-name"), "  Ankara  ");
    await fireEvent.press(screen.getByTestId("region-save"));

    expect(await screen.findByText("Ankara")).toBeOnTheScreen();
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ name: "Ankara", description: null });
  });

  it("boş adla istek atmaz; aynı ad hatasını sunucudan gösterir", async () => {
    mock.onGet("/regions/").reply(200, { results: regions });
    mock.onPost("/regions/").reply(400, { detail: '"İstanbul Avrupa" bölgesi zaten mevcut.' });
    await renderWithProviders(<RegionsScreen />);
    await screen.findByText("İstanbul Avrupa");

    await fireEvent.press(screen.getByTestId("add-region"));
    await fireEvent.press(await screen.findByTestId("region-save"));
    expect(await screen.findByText("Bölge adı gerekli.")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);

    await fireEvent.changeText(screen.getByTestId("region-name"), "İstanbul Avrupa");
    await fireEvent.press(screen.getByTestId("region-save"));
    expect(await screen.findByText('"İstanbul Avrupa" bölgesi zaten mevcut.')).toBeOnTheScreen();
  });

  it("konum ekler: virgüllü koordinatı 6 haneli ondalığa çevirir", async () => {
    mock.onGet("/regions/").reply(200, { results: regions });
    mock.onPost("/locations/").reply((cfg) => [201, { id: 99, ...JSON.parse(cfg.data), pos_device_count: 0 }]);
    await renderWithProviders(<RegionsScreen />);
    await fireEvent.press(await screen.findByLabelText("İstanbul Avrupa, 2 konum, 5 POS cihazı"));
    await fireEvent.press(await screen.findByText("Konum ekle"));

    await fireEvent.changeText(await screen.findByTestId("location-name"), "Yeni Ofis");
    await fireEvent.changeText(screen.getByPlaceholderText("41,0082"), "41,0123");
    await fireEvent.changeText(screen.getByPlaceholderText("28,9784"), "29,1");
    await fireEvent.press(screen.getByTestId("location-save"));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      region: 1,
      name: "Yeni Ofis",
      address: "",
      latitude: "41.012300",
      longitude: "29.100000",
      is_active: true,
    });
  });

  it("geçersiz ya da tek başına koordinatı reddeder", async () => {
    mock.onGet("/regions/").reply(200, { results: regions });
    await renderWithProviders(<RegionsScreen />);
    await fireEvent.press(await screen.findByLabelText("İstanbul Avrupa, 2 konum, 5 POS cihazı"));
    await fireEvent.press(await screen.findByText("Konum ekle"));

    await fireEvent.changeText(await screen.findByTestId("location-name"), "Ofis");
    await fireEvent.changeText(screen.getByPlaceholderText("41,0082"), "95");
    await fireEvent.press(screen.getByTestId("location-save"));
    expect(await screen.findByText("-90 ile 90 arasında olmalı.")).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByPlaceholderText("41,0082"), "41");
    await fireEvent.press(screen.getByTestId("location-save"));
    expect(await screen.findByText("Enlem ve boylam birlikte girilmeli.")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);
  });

  it("bölge silmeden önce etkisini açıklar ve onayla siler", async () => {
    let list: RawRegion[] = regions;
    mock.onGet("/regions/").reply(() => [200, { results: list }]);
    mock.onDelete("/regions/1/").reply(() => {
      list = [];
      return [204];
    });
    await renderWithProviders(<RegionsScreen />);
    await fireEvent.press(await screen.findByLabelText("İstanbul Avrupa, 2 konum, 5 POS cihazı"));
    await fireEvent.press(await screen.findByLabelText("İstanbul Avrupa bölgesini sil"));

    expect(
      await screen.findByText(
        '"İstanbul Avrupa" ve altındaki 2 konum silinecek. Bu konumlardaki POS cihazlarının konum bilgisi boşalır.'
      )
    ).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Sil"));

    expect(await screen.findByText("Henüz bölge yok")).toBeOnTheScreen();
    expect(mock.history.delete).toHaveLength(1);
  });

  it("403 dönerse hata durumunu gösterir", async () => {
    mock.onGet("/regions/").reply(403, { detail: "Bu işlemi yapmak için izniniz bulunmuyor." });
    await renderWithProviders(<RegionsScreen />);
    expect(await screen.findByText("Bu işlemi yapmak için izniniz bulunmuyor.")).toBeOnTheScreen();
  });
});
