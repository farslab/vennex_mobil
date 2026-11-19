import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { renderWithProviders } from "@/test/utils";
import { RecurringBalanceTab } from "@/screens/cards/tabs/RecurringBalanceTab";
import { RecurringQuotaTab } from "@/screens/cards/tabs/RecurringQuotaTab";
import { CardQuotasTab } from "@/screens/cards/tabs/CardQuotasTab";
import { CardGroupsTab } from "@/screens/cards/tabs/CardGroupsTab";
import { FULL, loginAs, NO_BALANCE } from "./fixtures";

const page = (results: unknown[], over: Record<string, unknown> = {}) => ({ count: results.length, page: 1, num_pages: 1, results, ...over });
const groups = { results: [{ id: 2, name: "Vardiya A", active_cards_count: 2, pos_device_count: 1, created_at: null }] };

describe("Bakiye yükleme sekmesi", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    loginAs(FULL);
  });
  afterEach(() => mock.restore());

  it("yeni kural: özet onayı sonrası ilk çalışma tarihi (start_date) ve string tutar gönderilir", async () => {
    mock.onGet("/recurring-balance/").reply(200, page([]));
    mock.onGet("/card-groups/").reply(200, groups);
    mock.onPost("/recurring-balance/").reply(201, { id: 5, name: "Aylık", amount: "150.00", start_date: "2026-12-01" });
    await renderWithProviders(<RecurringBalanceTab />);
    await fireEvent.press(await screen.findByTestId("rb-create"));
    await fireEvent.changeText(screen.getByTestId("rb-name"), "Aylık yemek");
    await fireEvent.changeText(screen.getByTestId("rb-amount"), "150,00");
    await fireEvent.press(screen.getByTestId("rb-group"));
    await fireEvent.press(await screen.findByText("Vardiya A"));
    await fireEvent.changeText(screen.getByTestId("rb-start"), "01.12.2026");
    await fireEvent.press(screen.getByTestId("rb-submit"));

    expect(screen.getByText("Bakiye kuralını onayla")).toBeOnTheScreen();
    expect(screen.getByText("01.12.2026")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      name: "Aylık yemek",
      amount: "150.00",
      update_type: "add",
      period: "monthly",
      target_type: "group",
      target_card: null,
      target_group: 2,
      is_active: true,
      start_date: "2026-12-01",
      description: null,
    });
  });

  it("geçersiz tarih ve eksik hedef istek atmadan gösterilir", async () => {
    mock.onGet("/recurring-balance/").reply(200, page([]));
    await renderWithProviders(<RecurringBalanceTab />);
    await fireEvent.press(await screen.findByTestId("rb-create"));
    await fireEvent.changeText(screen.getByTestId("rb-name"), "X");
    await fireEvent.changeText(screen.getByTestId("rb-amount"), "10");
    await fireEvent.changeText(screen.getByTestId("rb-start"), "31.02.2026");
    await fireEvent.press(screen.getByTestId("rb-submit"));
    expect(screen.getByText("Geçerli bir tarih girin (GG.AA.YYYY).")).toBeOnTheScreen();
    expect(screen.getByText("Grup seçin.")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);
  });

  it("backend alan hatası (start_date) ilgili alana eşlenir", async () => {
    mock.onGet("/recurring-balance/").reply(200, page([]));
    mock.onGet("/card-groups/").reply(200, groups);
    mock.onPost("/recurring-balance/").reply(400, { start_date: ["Tarih biçimi hatalı."] });
    await renderWithProviders(<RecurringBalanceTab />);
    await fireEvent.press(await screen.findByTestId("rb-create"));
    await fireEvent.changeText(screen.getByTestId("rb-name"), "X");
    await fireEvent.changeText(screen.getByTestId("rb-amount"), "10");
    await fireEvent.press(screen.getByTestId("rb-group"));
    await fireEvent.press(await screen.findByText("Vardiya A"));
    await fireEvent.press(screen.getByTestId("rb-submit"));
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    expect(await screen.findByText("Tarih biçimi hatalı.")).toBeOnTheScreen();
  });

  it("düzenlemede yalnız değişen alanlar PATCH edilir; hedef değişirse target_type da gider", async () => {
    mock.onGet("/recurring-balance/").reply(
      200,
      page([
        { id: 3, name: "Haftalık", amount: "50.00", update_type: "add", period: "weekly", target_type: "card", target_card: 9, target_card_uid: "04 01", target_group: null, target_group_name: null, is_active: true, start_date: "2026-11-01", next_run: "2026-11-22T00:00:00+03:00", last_run: null, run_count: 2, description: null, created_at: null },
      ])
    );
    mock.onPatch("/recurring-balance/3/").reply(200, {});
    await renderWithProviders(<RecurringBalanceTab />);
    await fireEvent.press(await screen.findByTestId("rb-row-3"));
    await fireEvent.changeText(screen.getByTestId("rb-amount"), "75");
    await fireEvent.press(screen.getByTestId("rb-submit"));
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ amount: "75.00" });
  });

  it("change_card_balance yoksa kural oluşturma/düzenleme kapalı", async () => {
    loginAs(NO_BALANCE, "tech");
    mock.onGet("/recurring-balance/").reply(200, page([]));
    await renderWithProviders(<RecurringBalanceTab />);
    expect(await screen.findByText("Bakiye değiştirme yetkiniz olmadığı için kuralları yalnızca görüntüleyebilirsiniz.")).toBeOnTheScreen();
    expect(screen.queryByTestId("rb-create")).toBeNull();
  });

  it("sonsuz kaydırma 25'lik sayfaları sırayla ister", async () => {
    const rule = (id: number) => ({ id, name: `Kural ${id}`, amount: "1.00", update_type: "add", period: "daily", target_type: "group", target_group: 2, target_group_name: "G", is_active: true, start_date: "2026-11-01", run_count: 0 });
    mock.onGet("/recurring-balance/", { params: { page: 1 } }).reply(200, page([rule(1)], { count: 26, num_pages: 2 }));
    mock.onGet("/recurring-balance/", { params: { page: 2 } }).reply(200, page([rule(2)], { count: 26, page: 2, num_pages: 2 }));
    await renderWithProviders(<RecurringBalanceTab />);
    await screen.findByText("Kural 1");
    await fireEvent(screen.getByTestId("rb-list"), "onEndReached");
    expect(await screen.findByText("Kural 2")).toBeOnTheScreen();
  });
});

describe("İstihkak yenileme sekmesi", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    loginAs(FULL);
  });
  afterEach(() => mock.restore());

  it("yeni kural ilk yenileme tarihini start_date olarak gönderir", async () => {
    mock.onGet("/recurring-quota/").reply(200, page([]));
    mock.onGet("/card-groups/").reply(200, groups);
    mock.onPost("/recurring-quota/").reply(201, { detail: "2 kayıt oluşturuldu.", created_ids: [1, 2] });
    await renderWithProviders(<RecurringQuotaTab />);
    await fireEvent.press(await screen.findByTestId("rq-create"));
    await fireEvent.changeText(screen.getByTestId("rq-name"), "İçecek");
    await fireEvent.press(screen.getByTestId("rq-group"));
    await fireEvent.press(await screen.findByText("Vardiya A"));
    await fireEvent.changeText(screen.getByTestId("rq-product"), "1, 20-40");
    await fireEvent.changeText(screen.getByTestId("rq-quantity"), "3");
    await fireEvent.changeText(screen.getByTestId("rq-start"), "05.01.2027");
    await fireEvent.press(screen.getByTestId("rq-submit"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      name: "İçecek",
      group: 2,
      product_no: "1,20-40",
      period: "monthly",
      quantity: 3,
      target_type: "group",
      target_card: null,
      is_active: true,
      start_date: "2027-01-05",
      description: null,
      dagitim: "ayri",
    });
  });

  it("düzenlemede ürün no salt okunur ve PATCH'e girmez (backend ayrıştırma/çakışma kontrolü yapmaz)", async () => {
    mock.onGet("/recurring-quota/").reply(
      200,
      page([
        { id: 6, name: "İçecek", group: 2, group_name: "Vardiya A", product_no: "1-5", period: "monthly", period_display: "Aylık", quantity: 3, target_type: "group", target_card: null, target_card_uid: null, is_active: true, start_date: "2027-01-05", last_run: null, next_run: null, run_count: 0, description: null, created_at: null },
      ])
    );
    mock.onGet("/card-groups/").reply(200, groups);
    mock.onPatch("/recurring-quota/6/").reply(200, {});
    await renderWithProviders(<RecurringQuotaTab />);
    await fireEvent.press(await screen.findByTestId("rq-row-6"));
    const product = screen.getByTestId("rq-product");
    expect(product.props.editable).toBe(false);
    expect(product.props.value).toBe("1-5");
    expect(screen.getByText("Ürün no düzenlenemez; gerekirse kuralı silip yeniden oluşturun.")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("rq-quantity"), "4");
    await fireEvent.press(screen.getByTestId("rq-submit"));
    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ quantity: 4 });
  });
});

describe("İstihkak sekmesi — gruptaki tüm kartlar", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    loginAs(FULL);
  });
  afterEach(() => mock.restore());

  it("gruptaki tüm kartlar: kart listesi çekilmez, onaydan sonra TEK istek (web ile aynı); dağıtım gider", async () => {
    mock.onGet("/card-quotas/").reply(200, page([]));
    mock.onGet("/card-groups/").reply(200, groups);
    mock.onPost("/card-quotas/").reply(201, { detail: "ok", created: 40, skipped: 2, cards: 21 });
    await renderWithProviders(<CardQuotasTab />);
    await fireEvent.press(await screen.findByTestId("quota-create"));
    await fireEvent.press(screen.getByTestId("quota-group"));
    await fireEvent.press(await screen.findByText("Vardiya A"));
    await fireEvent.press(screen.getByText("Gruptaki tüm kartlar"));
    await fireEvent.changeText(screen.getByTestId("quota-product"), "1,2,3");
    await fireEvent.press(screen.getByText("Havuz (tek hak)"));
    await fireEvent.press(screen.getByTestId("quota-create-submit"));

    expect(await screen.findByText("Gruptaki tüm kartlara istihkak tanımlansın mı?")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);
    expect(mock.history.get.some((r) => r.url === "/cards/")).toBe(false);
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      group: 2,
      product_no: "1,2,3",
      period: "monthly",
      quantity: 1,
      is_active: true,
      dagitim: "havuz",
    });
  });

  it("grup istihkakı çakışırsa sunucu mesajı gösterilir, hiçbiri yazılmaz", async () => {
    mock.onGet("/card-quotas/").reply(200, page([]));
    mock.onGet("/card-groups/").reply(200, groups);
    mock.onPost("/card-quotas/").reply(400, { detail: "Mevcut istihkakla çakışıyor: 04 01" });
    await renderWithProviders(<CardQuotasTab />);
    await fireEvent.press(await screen.findByTestId("quota-create"));
    await fireEvent.press(screen.getByTestId("quota-group"));
    await fireEvent.press(await screen.findByText("Vardiya A"));
    await fireEvent.press(screen.getByText("Gruptaki tüm kartlar"));
    await fireEvent.press(screen.getByTestId("quota-create-submit"));
    await fireEvent.press(await screen.findByTestId("confirm-sheet-confirm"));
    expect(await screen.findByText("Mevcut istihkakla çakışıyor: 04 01")).toBeOnTheScreen();
  });

  it("istihkak düzenleme yalnız miktar/aktiflik PATCH eder", async () => {
    mock.onGet("/card-quotas/").reply(200, page([{ id: 4, card: 1, card_uid: "04 01", group: 2, group_name: "Vardiya A", product_no: "*", period: "daily", period_display: "Günlük", quantity: 2, is_active: true }]));
    mock.onPatch("/card-quotas/4/").reply(200, {});
    await renderWithProviders(<CardQuotasTab />);
    await fireEvent.press(await screen.findByTestId("quota-row-4"));
    await fireEvent.changeText(screen.getByTestId("quota-edit-quantity"), "5");
    await fireEvent.press(screen.getByTestId("quota-edit-submit"));
    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ quantity: 5 });
  });
});

describe("Kart grupları sekmesi", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    loginAs(FULL);
  });
  afterEach(() => mock.restore());

  it("liste N+1 yapmaz; detay yalnız açılınca çekilir; düzenleme cihaz id'lerini gönderir", async () => {
    mock.onGet("/card-groups/").reply(200, {
      results: [
        { id: 1, name: "Ofis", active_cards_count: 4, pos_device_count: 1, created_at: null },
        { id: 2, name: "Fabrika", active_cards_count: 9, pos_device_count: 0, created_at: null },
      ],
    });
    mock.onGet("/card-groups/1/").reply(200, { id: 1, name: "Ofis", active_cards_count: 4, pos_devices: [{ id: 101, sn: "PAV1", pos_name: "Otomat 1" }] });
    mock.onGet("/users/assignable-options/").reply(200, {
      pos_devices: [
        { id: 101, sn: "PAV1", pos_name: "Otomat 1" },
        { id: 102, sn: "PAV2", pos_name: "Otomat 2" },
      ],
    });
    mock.onPatch("/card-groups/1/").reply(200, { id: 1, name: "Ofis", pos_devices: [] });
    await renderWithProviders(<CardGroupsTab />);
    await screen.findByText("Fabrika");
    // /app/config/ uygulama genelinde önbellekli yapılandırma (kapsam bayrağı) — sayılmaz
    expect(mock.history.get.map((r) => r.url).filter((u) => u !== "/app/config/")).toEqual(["/card-groups/"]);

    await fireEvent.press(screen.getByTestId("group-row-1"));
    expect(await screen.findByText("PAV1")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("group-edit"));
    await waitFor(() => expect(mock.history.get.some((r) => r.url === "/users/assignable-options/")).toBe(true));
    await waitFor(() => expect(screen.queryByText("Yükleniyor…")).toBeNull());
    await fireEvent.press(screen.getByTestId("group-form-devices"));
    await fireEvent.press(await screen.findByText("Otomat 2"));
    await fireEvent.press(screen.getByText(/^Uygula/));
    await fireEvent.press(screen.getByTestId("group-form-submit"));
    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ pos_device_ids: [101, 102] });
  });

  it("cihaz kaynağı olmayan kullanıcıda cihaz alanı gizlenir ve pos_device_ids gönderilmez", async () => {
    loginAs(["tech", "manage_personel_card"], "tech");
    mock.onGet("/card-groups/").reply(200, { results: [] });
    mock.onPost("/card-groups/").reply(201, { id: 9, name: "Yeni", pos_devices: [] });
    await renderWithProviders(<CardGroupsTab />);
    await fireEvent.press(await screen.findByTestId("group-create"));
    expect(screen.queryByTestId("group-form-devices")).toBeNull();
    await fireEvent.changeText(screen.getByTestId("group-form-name"), "Yeni");
    await fireEvent.press(screen.getByTestId("group-form-submit"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ name: "Yeni" });
  });

  it("isim çakışması (detail) genel hata olarak gösterilir", async () => {
    mock.onGet("/card-groups/").reply(200, { results: [] });
    mock.onGet("/users/assignable-options/").reply(200, { pos_devices: [] });
    mock.onPost("/card-groups/").reply(400, { detail: '"Ofis" grubu zaten mevcut.' });
    await renderWithProviders(<CardGroupsTab />);
    await fireEvent.press(await screen.findByTestId("group-create"));
    await fireEvent.changeText(screen.getByTestId("group-form-name"), "Ofis");
    await fireEvent.press(screen.getByTestId("group-form-submit"));
    expect(await screen.findByText('"Ofis" grubu zaten mevcut.')).toBeOnTheScreen();
  });
});
