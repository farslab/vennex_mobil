/**
 * Cihaz listesi alt sayfaları: özel sıralama (DeviceOrderSheet) ve filtre (DeviceFiltersSheet).
 * DevicesListScreen.test.tsx'in kapsadığı akışlar (aşağı taşı+kaydet, çevrim/durum/sıralama → parametre)
 * burada tekrarlanmaz.
 */
import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { useToastStore } from "@/design-system";
import { renderWithProviders } from "@/test/utils";
import { DeviceOrderSheet } from "@/screens/devices/list/DeviceOrderSheet";
import {
  DEFAULT_FILTERS,
  DeviceFiltersSheet,
  activeFilterCount,
  type DeviceFilters,
} from "@/screens/devices/list/DeviceFiltersSheet";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

type El = ReturnType<typeof screen.getByTestId>;
type Reply = [number, unknown];

const row = (sn: string, name: string | null) => ({
  sn,
  pos_name: name,
  stat: true,
  online: true,
  company_id: 10,
  location_id: 1,
  location_name: "Kat 1",
  act_macstat: 1,
  last_seen: null,
  sort_order: 0,
  fill_rate: null,
});

const page = (results: unknown[], extra: Record<string, unknown> = {}) => ({
  count: results.length,
  page: 1,
  num_pages: 1,
  page_size: 25,
  online_count: results.length,
  offline_count: 0,
  total_count: results.length,
  results,
  ...extra,
});

function deferred() {
  let release: (r: Reply) => void = () => {};
  const promise = new Promise<Reply>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

/** FlatList'in onEndReached taşıyan host ScrollView'ini satırdan yukarı yürüyerek bulur */
function scrollHostOf(el: El): El {
  type Walk = { props: Record<string, unknown>; parent: Walk | null };
  let node: Walk | null = el as unknown as Walk;
  while (node && typeof node.props.onEndReached !== "function") node = node.parent;
  if (!node) throw new Error("onEndReached taşıyan liste bulunamadı");
  return node as unknown as El;
}

const listGets = (mock: MockAdapter) => mock.history.get.filter((r) => r.url === "/pos-devices/");
const toastState = () => useToastStore.getState().current;

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
  useToastStore.setState({ current: null });
});
afterEach(() => mock.restore());

/* ------------------------------------------------------------ Özel sıralama */

describe("DeviceOrderSheet", () => {
  it("kapalıyken istek atmaz; açılınca sunucu sırasını sort_by'sız çeker; değişiklik yokken Kaydet ve uç düğmeler pasif", async () => {
    mock.onGet("/pos-devices/").reply(200, page([row("SN1", "Otomat 1"), row("SN2", "Otomat 2"), row("SN3", "  ")]));
    const onClose = jest.fn();

    const { rerender } = await renderWithProviders(<DeviceOrderSheet visible={false} onClose={onClose} />);
    expect(mock.history.get).toHaveLength(0);

    await rerender(<DeviceOrderSheet visible onClose={onClose} />);
    expect(await screen.findByText("Otomat 1")).toBeOnTheScreen();
    expect(listGets(mock)).toHaveLength(1);
    expect(listGets(mock)[0].params).toEqual({ page: 1 });

    // adı boş cihazın başlığı seri no
    expect(within(screen.getByTestId("order-row-SN3")).getAllByText("SN3")).toHaveLength(2);
    expect(within(screen.getByTestId("order-row-SN3")).getByText("3")).toBeOnTheScreen();

    expect(screen.getByTestId("device-order-save")).toBeDisabled();
    expect(screen.getByTestId("order-up-SN1")).toBeDisabled();
    expect(screen.getByTestId("order-down-SN3")).toBeDisabled();
    expect(screen.getByTestId("order-down-SN1")).toBeEnabled();
    // tümü yüklüyse kısmi yükleme uyarısı yok
    expect(screen.queryByText(/tanesi yüklendi/)).toBeNull();
  });

  it("yukarı taşı + kaydet: yüklü sıra 1'den numaralanır; başarıda sunucu mesajı toast olur ve sayfa kapanır", async () => {
    mock.onGet("/pos-devices/").reply(200, page([row("SN1", "Otomat 1"), row("SN2", "Otomat 2"), row("SN3", "Otomat 3")]));
    mock.onPost("/pos-devices/sort/").reply(200, { detail: "Sıralama güncellendi." });
    const onClose = jest.fn();

    await renderWithProviders(<DeviceOrderSheet visible onClose={onClose} />);
    await fireEvent.press(await screen.findByTestId("order-up-SN3"));
    expect(within(screen.getByTestId("order-row-SN3")).getByText("2")).toBeOnTheScreen();
    expect(screen.getByTestId("device-order-save")).toBeEnabled();
    await fireEvent.press(screen.getByTestId("device-order-save"));

    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mock.history.post).toHaveLength(1);
    expect(mock.history.post[0].url).toBe("/pos-devices/sort/");
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      device_orders: [
        { sn: "SN1", sort_order: 1 },
        { sn: "SN3", sort_order: 2 },
        { sn: "SN2", sort_order: 3 },
      ],
    });
    expect(toastState()).toMatchObject({ message: "Sıralama güncellendi.", tone: "success" });
    // yazma sonrası cihaz önbelleği geçersizlenir → sıra kaynağı yeniden çekilir
    await waitFor(() => expect(listGets(mock)).toHaveLength(2));
  });

  it("kaydetme hatası toast.error ile bildirilir ve sayfa açık kalır", async () => {
    mock.onGet("/pos-devices/").reply(200, page([row("SN1", "Otomat 1"), row("SN2", "Otomat 2")]));
    mock.onPost("/pos-devices/sort/").reply(403, { detail: "Bazı cihazlara erişim yetkiniz yok." });
    const onClose = jest.fn();

    await renderWithProviders(<DeviceOrderSheet visible onClose={onClose} />);
    await fireEvent.press(await screen.findByTestId("order-down-SN1"));
    await fireEvent.press(screen.getByTestId("device-order-save"));

    await waitFor(() => expect(toastState()).toMatchObject({ message: "Bazı cihazlara erişim yetkiniz yok.", tone: "danger" }));
    expect(onClose).not.toHaveBeenCalled();
    expect(screen.getByTestId("device-order-save")).toBeEnabled();
  });

  it("kaydederken Kaydet kilitlenir; tekrar basış ikinci istek atmaz", async () => {
    mock.onGet("/pos-devices/").reply(200, page([row("SN1", "Otomat 1"), row("SN2", "Otomat 2")]));
    const d = deferred();
    mock.onPost("/pos-devices/sort/").reply(() => d.promise);
    const onClose = jest.fn();

    await renderWithProviders(<DeviceOrderSheet visible onClose={onClose} />);
    await fireEvent.press(await screen.findByTestId("order-down-SN1"));
    await fireEvent.press(screen.getByTestId("device-order-save"));
    await waitFor(() => expect(screen.getByTestId("device-order-save")).toBeDisabled());
    // işlem sürerken taşıma da kilitli
    expect(screen.getByTestId("order-up-SN1")).toBeDisabled();
    await fireEvent.press(screen.getByTestId("device-order-save"));
    expect(mock.history.post).toHaveLength(1);

    d.release([200, { detail: "" }]);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(toastState()?.message).toBe("Sıralama kaydedildi.");
  });

  // BİLİNEN HATA (DeviceOrderSheet.tsx:108): onPress={() => save.mutate()} ref kilidi yok;
  it("kaydet: yeniden çizim beklenmeden gelen art arda iki dokunuş tek istek atmalı", async () => {
    mock.onGet("/pos-devices/").reply(200, page([row("SN1", "Otomat 1"), row("SN2", "Otomat 2")]));
    const d = deferred();
    mock.onPost("/pos-devices/sort/").reply(() => d.promise);
    const onClose = jest.fn();

    await renderWithProviders(<DeviceOrderSheet visible onClose={onClose} />);
    await fireEvent.press(await screen.findByTestId("order-down-SN1"));
    const save = screen.getByTestId("device-order-save");
    jest.useFakeTimers();
    try {
      await fireEvent.press(save);
      await fireEvent.press(save);
      d.release([200, { detail: "" }]);
      await waitFor(() => expect(onClose).toHaveBeenCalled());
    } finally {
      jest.useRealTimers();
    }
    expect(mock.history.post).toHaveLength(1);
  });

  it("sıfırla onay sayfası arkasındadır; onayda POST sort/reset/ {} ve kapanır", async () => {
    mock.onGet("/pos-devices/").reply(200, page([row("SN1", "Otomat 1")]));
    mock.onPost("/pos-devices/sort/reset/").reply(200, { detail: "Sıralama sıfırlandı." });
    const onClose = jest.fn();

    await renderWithProviders(<DeviceOrderSheet visible onClose={onClose} />);
    await screen.findByText("Otomat 1");
    await fireEvent.press(screen.getByText("Sıfırla"));

    expect(await screen.findByText("Sıralamayı sıfırla")).toBeOnTheScreen();
    expect(screen.getByText("Tüm POS cihazlarının özel sırası kaldırılır; liste ada göre sıralanır.")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);

    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(mock.history.post.map((r) => r.url)).toEqual(["/pos-devices/sort/reset/"]);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({});
    expect(toastState()?.message).toBe("Sıralama sıfırlandı.");
    await waitFor(() => expect(listGets(mock)).toHaveLength(2));
  });

  it("sıfırlama hatası onay sayfasında gösterilir; vazgeçip yeniden açınca eski hata görünmez", async () => {
    mock.onGet("/pos-devices/").reply(200, page([row("SN1", "Otomat 1")]));
    mock.onPost("/pos-devices/sort/reset/").reply(500, { detail: "Sıralama sıfırlanamadı." });
    const onClose = jest.fn();

    await renderWithProviders(<DeviceOrderSheet visible onClose={onClose} />);
    await screen.findByText("Otomat 1");
    await fireEvent.press(screen.getByText("Sıfırla"));
    await fireEvent.press(await screen.findByTestId("confirm-sheet-confirm"));

    expect(await screen.findByText("Sıralama sıfırlanamadı.")).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByText("Vazgeç"));
    await waitFor(() => expect(screen.queryByText("Sıralamayı sıfırla")).toBeNull());
    await fireEvent.press(screen.getByText("Sıfırla"));
    expect(await screen.findByText("Sıralamayı sıfırla")).toBeOnTheScreen();
    expect(screen.queryByText("Sıralama sıfırlanamadı.")).toBeNull();
  });

  it("yükleme hatasında sunucu mesajı ve Tekrar dene; yeniden denemede liste gelir", async () => {
    mock.onGet("/pos-devices/").replyOnce(500, { detail: "Sunucu hatası" });
    mock.onGet("/pos-devices/").reply(200, page([row("SN1", "Otomat 1")]));

    await renderWithProviders(<DeviceOrderSheet visible onClose={jest.fn()} />);

    expect(await screen.findByText("Sunucu hatası")).toBeOnTheScreen();
    expect(screen.getByTestId("device-order-save")).toBeDisabled();
    await fireEvent.press(screen.getByText("Tekrar dene"));
    expect(await screen.findByText("Otomat 1")).toBeOnTheScreen();
    expect(listGets(mock)).toHaveLength(2);
  });

  it("kısmi yüklemede uyarı gösterir; sonraki sayfa taşınan sıranın sonuna eklenir ve kaydedilir", async () => {
    mock.onGet("/pos-devices/").reply((config) => {
      const p = Number(config.params.page);
      return p === 1
        ? [200, page([row("SN1", "Otomat 1"), row("SN2", "Otomat 2")], { count: 30, total_count: 30, num_pages: 2 })]
        : [200, page([row("SN26", "Otomat 26")], { count: 30, total_count: 30, num_pages: 2, page: 2 })];
    });
    mock.onPost("/pos-devices/sort/").reply(200, { detail: "ok" });

    await renderWithProviders(<DeviceOrderSheet visible onClose={jest.fn()} />);

    expect(await screen.findByText(/^30 POS cihazından 2 tanesi yüklendi\./)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("order-up-SN2"));
    await fireEvent(scrollHostOf(screen.getByTestId("order-row-SN1")), "onEndReached");

    expect(await screen.findByText("Otomat 26")).toBeOnTheScreen();
    expect(listGets(mock).map((r) => r.params.page)).toEqual([1, 2]);
    expect(screen.getByText(/^30 POS cihazından 3 tanesi yüklendi\./)).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("device-order-save"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      device_orders: [
        { sn: "SN2", sort_order: 1 },
        { sn: "SN1", sort_order: 2 },
        { sn: "SN26", sort_order: 3 },
      ],
    });
  });

  it("kaydedilmeden kapatılıp yeniden açılınca taşıma atılır, sunucu sırası gelir", async () => {
    mock.onGet("/pos-devices/").reply(200, page([row("SN1", "Otomat 1"), row("SN2", "Otomat 2")]));
    const onClose = jest.fn();

    const { rerender } = await renderWithProviders(<DeviceOrderSheet visible onClose={onClose} />);
    await fireEvent.press(await screen.findByTestId("order-down-SN1"));
    expect(within(screen.getByTestId("order-row-SN1")).getByText("2")).toBeOnTheScreen();

    await rerender(<DeviceOrderSheet visible={false} onClose={onClose} />);
    await rerender(<DeviceOrderSheet visible onClose={onClose} />);

    expect(await screen.findByTestId("order-row-SN1")).toBeOnTheScreen();
    expect(within(screen.getByTestId("order-row-SN1")).getByText("1")).toBeOnTheScreen();
    expect(screen.getByTestId("device-order-save")).toBeDisabled();
    expect(mock.history.post).toHaveLength(0);
  });
});

/* ------------------------------------------------------------------ Filtre */

describe("DeviceFiltersSheet", () => {
  const locations = {
    results: [
      { id: 5, name: "Kat 1", region_id: 2, region_name: "Bölge A" },
      { id: 7, name: "Kat 3", region_id: 2, region_name: "Bölge A" },
      { id: 6, name: "Kat 2", region_id: null, region_name: null },
      { id: 0, name: "Geçersiz" },
    ],
  };

  it("web alanları: Konum, Durum, Makine Tipi, Sırala; Aktif/Pasif yok", async () => {
    mock.onGet("/overview/locations/").reply(200, locations);
    await renderWithProviders(<DeviceFiltersSheet visible value={DEFAULT_FILTERS} canViewSales onApply={jest.fn()} onClose={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId("filter-location")).toHaveProp("accessibilityLabel", "Konum: Tüm konumlar"));
    expect(screen.getByTestId("filter-online")).toHaveProp("accessibilityLabel", "Durum: Tüm Cihazlar");
    expect(screen.getByTestId("filter-machine-type")).toHaveProp("accessibilityLabel", "Makine Tipi: Tüm Tipler");
    expect(screen.getByTestId("filter-sort")).toHaveProp("accessibilityLabel", "Sırala: Varsayılan");
    expect(screen.queryByText("Aktif")).toBeNull();
    expect(screen.queryByText("Pasif")).toBeNull();
  });

  it("kapalıyken konum istenmez; konum çoklu ve bölge gruplu, bölge tüm konumlarını seçer", async () => {
    mock.onGet("/overview/locations/").reply(200, locations);
    const onApply = jest.fn();
    const onClose = jest.fn();
    const props = { value: DEFAULT_FILTERS, canViewSales: true, onApply, onClose };

    const { rerender } = await renderWithProviders(<DeviceFiltersSheet visible={false} {...props} />);
    expect(mock.history.get).toHaveLength(0);
    await rerender(<DeviceFiltersSheet visible {...props} />);
    await waitFor(() => expect(mock.history.get.map((r) => r.url)).toEqual(["/overview/locations/"]));

    await fireEvent.press(await screen.findByTestId("filter-location"));
    await fireEvent.press(await screen.findByTestId("region-r2"));
    expect(screen.queryByText("Geçersiz")).toBeNull();
    await fireEvent.press(screen.getByTestId("location-apply"));
    await waitFor(() => expect(screen.getByTestId("filter-location")).toHaveProp("accessibilityLabel", "Konum: Bölge A"));

    await fireEvent.press(screen.getByTestId("filter-machine-type"));
    await fireEvent.press(await screen.findByText("Kahve"));
    await fireEvent.press(screen.getByTestId("filter-online"));
    await fireEvent.press(await screen.findByText("Çevrimdışı"));
    await fireEvent.press(screen.getByTestId("device-filters-apply"));
    expect(onApply).toHaveBeenCalledWith({ online: "offline", machineType: "1", locationIds: [5, 7], sortBy: "default" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("view_sales yoksa ciro sıralamaları listelenmez; varsa web adlarıyla seçilir", async () => {
    mock.onGet("/overview/locations/").reply(200, { results: [] });
    await renderWithProviders(<DeviceFiltersSheet visible value={DEFAULT_FILTERS} canViewSales={false} onApply={jest.fn()} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId("filter-sort"));
    expect(await screen.findByText("Doluluk (Düşük → Yüksek)")).toBeOnTheScreen();
    expect(screen.getByText("Son İşlem (Yeni → Eski)")).toBeOnTheScreen();
    expect(screen.queryByText(/Ciro/)).toBeNull();
  });

  it("view_sales varsa ciro sıralaması seçilip uygulanabilir", async () => {
    mock.onGet("/overview/locations/").reply(200, { results: [] });
    const onApply = jest.fn();
    await renderWithProviders(<DeviceFiltersSheet visible value={DEFAULT_FILTERS} canViewSales onApply={onApply} onClose={jest.fn()} />);
    await fireEvent.press(screen.getByTestId("filter-sort"));
    await fireEvent.press(await screen.findByText("Geçen Ay Ciro (Düşük → Yüksek)"));
    await fireEvent.press(screen.getByTestId("device-filters-apply"));
    expect(onApply).toHaveBeenCalledWith({ ...DEFAULT_FILTERS, sortBy: "last_month_revenue_asc" });
  });

  it("mevcut değerle açılır; Temizle varsayılanlara döndürür", async () => {
    mock.onGet("/overview/locations/").reply(200, locations);
    const onApply = jest.fn();
    const value: DeviceFilters = { online: "offline", machineType: "0", locationIds: [6], sortBy: "fill_rate_asc" };
    await renderWithProviders(<DeviceFiltersSheet visible value={value} canViewSales onApply={onApply} onClose={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId("filter-location")).toHaveProp("accessibilityLabel", "Konum: Kat 2"));
    expect(screen.getByTestId("filter-online")).toHaveProp("accessibilityLabel", "Durum: Çevrimdışı");
    expect(screen.getByTestId("filter-machine-type")).toHaveProp("accessibilityLabel", "Makine Tipi: Snack");
    expect(screen.getByTestId("filter-sort")).toHaveProp("accessibilityLabel", "Sırala: Doluluk (Düşük → Yüksek)");
    await fireEvent.press(screen.getByText("Temizle"));
    await fireEvent.press(screen.getByTestId("device-filters-apply"));
    expect(onApply).toHaveBeenCalledWith(DEFAULT_FILTERS);
  });

  it("konum listesi yüklenemezse uyarı gösterir", async () => {
    mock.onGet("/overview/locations/").reply(500, { detail: "Sunucu hatası" });
    await renderWithProviders(<DeviceFiltersSheet visible value={DEFAULT_FILTERS} canViewSales onApply={jest.fn()} onClose={jest.fn()} />);
    expect(await screen.findByText("Konum listesi yüklenemedi; konum filtresi kullanılamıyor.")).toBeOnTheScreen();
  });
});

describe("activeFilterCount", () => {
  it("varsayılandan farklı filtreleri sayar; sıralama sayılmaz", () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, sortBy: "fill_rate_desc" })).toBe(0);
    expect(activeFilterCount({ online: "online", machineType: "1", locationIds: [3, 4], sortBy: "default" })).toBe(3);
    expect(activeFilterCount({ ...DEFAULT_FILTERS, machineType: "0" })).toBe(1);
  });
});
