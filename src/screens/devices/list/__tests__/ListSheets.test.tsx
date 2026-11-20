/**
 * Cihaz listesi alt sayfası: filtre (DeviceFiltersSheet).
 * DevicesListScreen.test.tsx'in kapsadığı akışlar (çevrim/durum/sıralama → parametre)
 * burada tekrarlanmaz.
 */
import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { useToastStore } from "@/design-system";
import { renderWithProviders } from "@/test/utils";
import {
  DEFAULT_FILTERS,
  DeviceFiltersSheet,
  activeFilterCount,
  type DeviceFilters,
} from "@/screens/devices/list/DeviceFiltersSheet";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
  useToastStore.setState({ current: null });
});
afterEach(() => mock.restore());

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
