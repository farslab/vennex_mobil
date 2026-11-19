import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { makeUser, renderWithProviders } from "@/test/utils";
import ProductTemplatesScreen from "@/screens/devices/templates/ProductTemplatesScreen";
import TemplateEditorScreen from "@/screens/devices/templates/TemplateEditorScreen";
import { buildTemplateItemPayload, itemFormFrom } from "@/screens/devices/templates/TemplateItemSheet";
import type { RootScreenProps } from "@/navigation/types";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), setOptions: jest.fn() }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));

const templates = [
  { id: 1, name: "Ofis Snack", description: "Kat dizilimi", machine_type: 0, item_count: 9, assigned_device_count: 4, created_at: null, updated_at: null },
  { id: 2, name: "Kahve Menüsü", description: null, machine_type: 1, item_count: 4, assigned_device_count: 0, created_at: null, updated_at: null },
];

describe("ProductTemplatesScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mockNavigate.mockReset();
    useAuthStore.setState({ user: makeUser({ permissions: ["owner", "manage_device_settings"] }), selectedCompanyId: 10 });
  });
  afterEach(() => mock.restore());

  it("liste alanlarıyla çizer; şablon başına detay isteği atmaz", async () => {
    mock.onGet("/product-templates/").reply(200, { results: templates });

    await renderWithProviders(<ProductTemplatesScreen />);

    expect(await screen.findByText("Ofis Snack")).toBeOnTheScreen();
    expect(screen.getByText("9 kalem · 4 POS cihazı")).toBeOnTheScreen();
    expect(screen.getAllByText("Kahve").length).toBeGreaterThanOrEqual(2); // filtre + rozet
    expect(mock.history.get.map((r) => r.url)).toEqual(["/product-templates/"]);
  });

  it("tip filtresi istemcide uygulanır ve satır editöre gider", async () => {
    mock.onGet("/product-templates/").reply(200, { results: templates });
    await renderWithProviders(<ProductTemplatesScreen />);
    await screen.findByText("Ofis Snack");

    await fireEvent.press(screen.getAllByText("Kahve")[0]);
    await waitFor(() => expect(screen.queryByText("Ofis Snack")).toBeNull());
    await fireEvent.press(screen.getByTestId("template-row-2"));
    expect(mockNavigate).toHaveBeenCalledWith("TemplateProductsEdit", { templateId: 2, title: "Kahve Menüsü" });
  });

  it("silme onay sayfası özet gösterir; onayda DELETE", async () => {
    mock.onGet("/product-templates/").reply(200, { results: templates });
    mock.onDelete("/product-templates/1/").reply(204);
    await renderWithProviders(<ProductTemplatesScreen />);

    await fireEvent.press(await screen.findByTestId("template-actions-1"));
    await fireEvent.press(await screen.findByText("Sil"));
    expect(await screen.findByText("Şablonu sil")).toBeOnTheScreen();
    expect(screen.getByText("Eşli POS cihazı")).toBeOnTheScreen();
    expect(mock.history.delete).toHaveLength(0);

    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.delete.map((r) => r.url)).toEqual(["/product-templates/1/"]));
  });

  it("yetki yoksa oluşturma ve işlem menüsü gizlidir", async () => {
    useAuthStore.setState({ user: makeUser({ permissions: ["tech"] }) });
    mock.onGet("/product-templates/").reply(200, { results: templates });
    await renderWithProviders(<ProductTemplatesScreen />);
    await screen.findByText("Ofis Snack");
    expect(screen.queryByTestId("template-new")).toBeNull();
    expect(screen.queryByTestId("template-actions-1")).toBeNull();
  });

  it("yeni şablon: makine tipi 0/1 ile POST", async () => {
    mock.onGet("/product-templates/").reply(200, { results: [] });
    mock.onPost("/product-templates/").reply(201, { id: 9, name: "Yeni", machine_type: 1, items: [], assigned_devices: [] });
    await renderWithProviders(<ProductTemplatesScreen />);

    await fireEvent.press(await screen.findByTestId("template-new"));
    await fireEvent.changeText(await screen.findByTestId("template-name"), "Yeni");
    await fireEvent.press(within(screen.getByTestId("template-machine-type")).getByText("Kahve"));
    await fireEvent.press(screen.getByTestId("template-form-submit"));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ name: "Yeni", description: null, machine_type: 1 });
    expect(mockNavigate).toHaveBeenCalledWith("TemplateProductsEdit", { templateId: 9, title: "Yeni" });
  });
});

describe("TemplateEditorScreen", () => {
  let mock: MockAdapter;
  const navigation = { setOptions: jest.fn(), navigate: jest.fn(), goBack: jest.fn() };
  const props = { route: { key: "k", name: "TemplateProductsEdit", params: { templateId: 1, title: "Ofis Snack" } }, navigation } as unknown as RootScreenProps<"TemplateProductsEdit">;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    useAuthStore.setState({ user: makeUser({ permissions: ["owner", "manage_device_settings", "manage_stock"] }), selectedCompanyId: 10 });
    mock.onGet("/product-templates/1/").reply(200, {
      id: 1,
      name: "Ofis Snack",
      description: null,
      machine_type: 0,
      items: [],
      assigned_devices: [{ sn: "PAV1", pos_name: "Lobi" }],
    });
    mock.onGet("/product-templates/1/items/").reply(200, {
      results: [{ id: 50, urun_no: 1, is_wildcard: false, stock_sku: 7, stock_sku_name: "Su", stock_sku_code: "SU-1", name: "Su", price: "15.00", max_quantity: 10, quantity: 0, order: 0 }],
    });
  });
  afterEach(() => mock.restore());

  it("gerçek kalemleri ve eşli cihazları gösterir; başlığı setOptions ile verir", async () => {
    await renderWithProviders(<TemplateEditorScreen {...props} />);
    expect(await screen.findByText("Su")).toBeOnTheScreen();
    expect(screen.getByText("₺15,00")).toBeOnTheScreen();
    expect(screen.getByText("Lobi")).toBeOnTheScreen();
    expect(navigation.setOptions).toHaveBeenCalledWith({ title: "Ofis Snack" });
    // sahte reçete/bileşen arayüzü yok
    expect(screen.queryByText(/bileşen ekle/i)).toBeNull();
  });

  it("kalem ekleme: gerçek SKU listesinden seçim + tek obje POST (fiyat '12.50')", async () => {
    mock.onGet("/stock/skus/").reply(200, { results: [{ id: 8, name: "Kola 330", sku_code: "KL", kind: "simple", sale_price: "20.00" }] });
    mock.onPost("/product-templates/1/items/").reply(201, { id: 51, name: "Kola 330", price: "12.50" });

    await renderWithProviders(<TemplateEditorScreen {...props} />);
    await fireEvent.press(await screen.findByTestId("editor-add-item"));
    await fireEvent.press(await screen.findByTestId("template-item-sku"));
    await fireEvent.press(await screen.findByText("Kola 330"));
    await fireEvent.changeText(screen.getByTestId("template-item-urun-no"), "3");
    await fireEvent.changeText(screen.getByTestId("template-item-price"), "12,5");
    await fireEvent.changeText(screen.getByTestId("template-item-max"), "8");
    await fireEvent.press(screen.getByTestId("template-item-save"));

    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      urun_no: 3,
      is_wildcard: false,
      stock_sku: 8,
      price: "12.50",
      max_quantity: 8,
      quantity: 0,
      order: 1,
    });
  });

  it("fiyatsız kalem gönderilmez", async () => {
    await renderWithProviders(<TemplateEditorScreen {...props} />);
    await fireEvent.press(await screen.findByTestId("editor-add-item"));
    await fireEvent.press(await screen.findByTestId("template-item-save"));
    expect(await screen.findByText("Fiyat zorunlu.")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);
  });
});

describe("buildTemplateItemPayload", () => {
  it("normal mod: name zorunlu, stock_sku gönderilmez", () => {
    const f = { ...itemFormFrom(null), name: "Kek", price: "7", urunNo: "2" };
    expect(buildTemplateItemPayload(false, f).payload).toEqual({
      urun_no: 2,
      is_wildcard: false,
      price: "7.00",
      max_quantity: 0,
      quantity: 0,
      name: "Kek",
    });
    expect(buildTemplateItemPayload(false, { ...f, name: "" }).errors).toHaveProperty("name");
  });

  it("stok modu wildcard: urun_no null; SKU zorunlu", () => {
    const f = { ...itemFormFrom(null), skuId: 4, wildcard: true, urunNo: "5", price: "1,25" };
    expect(buildTemplateItemPayload(true, f).payload).toMatchObject({ urun_no: null, is_wildcard: true, stock_sku: 4, price: "1.25" });
    expect(buildTemplateItemPayload(true, { ...f, skuId: null }).errors).toHaveProperty("stock_sku");
  });
});
