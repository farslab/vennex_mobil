import MockAdapter from "axios-mock-adapter";
import { apiClient } from "@/api/client";
import {
  cardsApi,
  normalizeCard,
  normalizeCardGroupDetail,
  normalizeCardList,
  normalizeRecurringBalance,
} from "@/api/cards";

const rawCard = (over: Record<string, unknown> = {}) => ({
  id: 7,
  uid: "04 A2 3B 1C",
  first_name: "Ayşe",
  last_name: "Yılmaz",
  full_name: "Ayşe Yılmaz",
  balance: "125.50",
  customer_no: 42,
  is_active: true,
  created_at: "2026-11-01T10:00:00+03:00",
  groups: [{ id: 1, name: "Ofis", pos_device_ids: [101, 102] }],
  ...over,
});

describe("cardsApi", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => mock.restore());

  it("list: status/q/group_id/page parametrelerini gönderir, page_size göndermez", async () => {
    mock.onGet("/cards/").reply(200, { count: 1, page: 2, num_pages: 3, page_size: 30, active_count: 61, pending_count: 4, results: [rawCard()] });
    const res = await cardsApi.list({ status: "pending", q: "  ayşe ", group_id: 3, page: 2 });
    expect(mock.history.get[0].params).toEqual({ status: "pending", q: "ayşe", group_id: 3, page: 2 });
    expect(res.active_count).toBe(61);
    expect(res.pending_count).toBe(4);
    expect(res.results[0].balance).toBe("125.50");
  });

  it("list: boş q ve null grup parametre olarak gitmez", async () => {
    mock.onGet("/cards/").reply(200, { count: 0, page: 1, num_pages: 1, results: [] });
    await cardsApi.list({ q: "   ", group_id: null });
    expect(mock.history.get[0].params).toEqual({ status: "active", page: 1 });
  });

  it("bulkBalance: tek istek, tutar string ondalık ve doğrudan uç", async () => {
    mock.onPost("/cards/bulk/balance/").reply(200, { detail: "2 kart güncellendi.", count: 2 });
    const res = await cardsApi.bulkBalance([1, 2], "subtract", 12.5);
    expect(mock.history.post).toHaveLength(1);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ card_ids: [1, 2], operation: "subtract", amount: "12.50" });
    expect(res).toEqual({ detail: "2 kart güncellendi.", count: 2 });
  });

  it("bulkBalance: 0.1+0.2 gibi kayan nokta değerleri 2 haneye yuvarlanır", async () => {
    mock.onPost("/cards/bulk/balance/").reply(200, { detail: "", count: 1 });
    await cardsApi.bulkBalance([9], "set", 0.1 + 0.2);
    expect(JSON.parse(mock.history.post[0].data).amount).toBe("0.30");
  });

  it("bulkDelete ve bulkGroups tam gövdeleri", async () => {
    mock.onPost("/cards/bulk/delete/").reply(200, { detail: "", count: 3 });
    mock.onPost("/cards/bulk/groups/").reply(200, { detail: "", count: 2 });
    await cardsApi.bulkDelete([1, 2, 3]);
    await cardsApi.bulkGroups([1, 2], [5], "remove_groups");
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ card_ids: [1, 2, 3] });
    expect(JSON.parse(mock.history.post[1].data)).toEqual({ card_ids: [1, 2], group_ids: [5], operation: "remove_groups" });
  });

  it("approve reverse_uid gönderir; rejectAllPending sayıyı döndürür", async () => {
    mock.onPost("/cards/7/approve/").reply(200, rawCard());
    mock.onPost("/cards/reject-all-pending/").reply(200, { detail: "4 bekleyen kart silindi.", count: 4 });
    await cardsApi.approve(7, true);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ reverse_uid: true });
    expect((await cardsApi.rejectAllPending()).count).toBe(4);
  });

  it("transactions: limit üst sınırı 500", async () => {
    mock.onGet("/cards/7/transactions/").reply(200, { card: rawCard(), transactions: [{ id: 1, amount: "5.00", status: false, iptalNo: 2 }], success_count: 0, fail_count: 1 });
    const res = await cardsApi.transactions(7, 9999);
    expect(mock.history.get[0].params).toEqual({ limit: 500 });
    expect(res.transactions[0]).toMatchObject({ amount: "5.00", status: false, iptalNo: 2, display_name: null });
  });

  it("deviceOptions: filter-options kaynağı seçili şirkete göre süzülür", async () => {
    mock.onGet("/reports/filter-options/").reply(200, {
      devices: [
        { id: 1, sn: "A", pos_name: "Bir", company_id: 10 },
        { id: 2, sn: "B", pos_name: "İki", company_id: 11 },
      ],
    });
    const opts = await cardsApi.deviceOptions("report-filter-options", 10);
    expect(opts).toEqual([{ id: 1, sn: "A", pos_name: "Bir" }]);
  });

  it("deviceOptions: assignable-options id ve açıklama döner", async () => {
    mock.onGet("/users/assignable-options/").reply(200, {
      pos_devices: [{ id: 100, sn: "PAV1", pos_name: "Otomat 1", company_name: "Demo", location_name: "Ofis" }],
    });
    expect(await cardsApi.deviceOptions("assignable-options", 10)).toEqual([
      { id: 100, sn: "PAV1", pos_name: "Otomat 1", description: "Ofis · Demo" },
    ]);
  });

  it("recurringBalance.create gövdeyi olduğu gibi (string tutar, start_date) gönderir", async () => {
    mock.onPost("/recurring-balance/").reply(201, { id: 3, amount: "150.00", start_date: "2026-12-01", next_run: "2026-12-01T00:00:00+03:00" });
    const res = await cardsApi.recurringBalance.create({
      name: "Aylık",
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
    expect(JSON.parse(mock.history.post[0].data)).toMatchObject({ amount: "150.00", start_date: "2026-12-01", target_group: 2 });
    expect(res.next_run).toBe("2026-12-01T00:00:00+03:00");
  });

  it("quotas.create created_ids yanıtını normalize eder", async () => {
    mock.onPost("/card-quotas/").reply(201, { detail: "0 kota oluşturuldu.", created_ids: [] });
    const res = await cardsApi.quotas.create({ card: 1, group: 2, product_no: "*", period: "daily", quantity: 1, is_active: true });
    expect(res).toEqual({ detail: "0 kota oluşturuldu.", created_ids: [] });
  });
});

describe("normalizer'lar", () => {
  it("normalizeCard eksik alanları güvenli doldurur, full_name türetir", () => {
    const c = normalizeCard({ id: "5", uid: "X1", first_name: "Can", last_name: null, balance: 10 });
    expect(c).toMatchObject({ id: 5, uid: "X1", full_name: "Can", balance: 10, groups: [], is_active: false, customer_no: 0 });
    expect(normalizeCard({ id: 1, uid: "U" }).full_name).toBeNull();
  });

  it("grup detayında pos_device_ids pos_devices'tan türetilir", () => {
    const g = normalizeCardGroupDetail({ id: 1, name: "Ofis", active_cards_count: 3, pos_devices: [{ id: 101, sn: "S1", pos_name: null }] });
    expect(g.pos_device_ids).toEqual([101]);
    expect(g.pos_devices[0]).toEqual({ id: 101, sn: "S1", pos_name: null });
  });

  it("normalizeCardList sayaçları number yapar", () => {
    const l = normalizeCardList({ count: "2", page: "1", num_pages: "1", active_count: "5", pending_count: null, results: [rawCard()] });
    expect(l).toMatchObject({ count: 2, page: 1, num_pages: 1, active_count: 5, pending_count: 0 });
  });

  it("normalizeRecurringBalance bilinmeyen değerlerde güvenli varsayılan", () => {
    const r = normalizeRecurringBalance({ id: 1, amount: "5.00", update_type: "x", period: "yearly" });
    expect(r).toMatchObject({ update_type: "add", period: "monthly", next_run: null, run_count: 0 });
  });
});
