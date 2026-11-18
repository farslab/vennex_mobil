import MockAdapter from "axios-mock-adapter";
import { apiClient } from "@/api/client";
import { notificationsApi } from "@/api/notifications";
import { resolveNotificationTarget } from "@/screens/notifications/notificationTarget";
import { makeUser } from "@/test/utils";

describe("notificationsApi", () => {
  let mock: MockAdapter;
  beforeEach(() => (mock = new MockAdapter(apiClient)));
  afterEach(() => mock.restore());

  it("liste yanıtını normalize eder (data null-safe, unread_count sayı)", async () => {
    mock.onGet("/notifications/").reply(200, {
      count: "2",
      page: 1,
      num_pages: 1,
      unread_count: "1",
      results: [
        { id: 1, timestamp: null, verb: "v", description: "d", unread: true, data: null },
        { id: 2, timestamp: null, verb: "v", description: null, unread: false, data: ["bozuk"] },
      ],
    });
    const res = await notificationsApi.list({ page: 2 });
    expect(mock.history.get[0].params).toEqual({ page: 2 });
    expect(res.unread_count).toBe(1);
    expect(res.count).toBe(2);
    expect(res.results[1].data).toBeNull();
  });

  it("markAllRead sayıyı döner", async () => {
    mock.onPost("/notifications/read-all/").reply(200, { detail: "3 bildirim", count: 3 });
    await expect(notificationsApi.markAllRead()).resolves.toEqual({ detail: "3 bildirim", count: 3 });
  });
});

describe("resolveNotificationTarget", () => {
  const owner = makeUser({ role: "owner", permissions: ["owner", "view_sales", "manage_personel_card"] });
  const tech = makeUser({ role: "tech", permissions: ["tech"] });

  it("cihaz event'leri sn varsa cihaz detayına eşlenir", () => {
    for (const event of ["device.offline", "transaction.new", "stock.low"]) {
      expect(resolveNotificationTarget({ data: { event, sn: "PAV1" } }, tech)).toEqual({
        name: "DeviceDetail",
        params: { sn: "PAV1" },
      });
    }
    expect(resolveNotificationTarget({ data: { event: "device.offline" } }, tech)).toBeNull();
  });

  it("kart, rapor ve cari event'leri yetkiye göre eşlenir", () => {
    expect(resolveNotificationTarget({ data: { event: "card.pending", card_id: "42" } }, owner)).toEqual({
      name: "CardDetail",
      params: { id: 42 },
    });
    expect(resolveNotificationTarget({ data: { event: "card.pending", card_id: "abc" } }, owner)).toBeNull();
    expect(resolveNotificationTarget({ data: { event: "card.pending", card_id: "42" } }, tech)).toBeNull();
    expect(resolveNotificationTarget({ data: { event: "report.ready", url: "x" } }, owner)).toEqual({ name: "Reports" });
    expect(resolveNotificationTarget({ data: { event: "report.ready" } }, tech)).toBeNull();
    expect(resolveNotificationTarget({ data: { event: "cari.overdue", company_id: "1" } }, owner)).toEqual({
      name: "CompanyAccount",
    });
    expect(resolveNotificationTarget({ data: { event: "cari.overdue" } }, tech)).toBeNull();
  });

  it("bilinmeyen/null data eşlenmez", () => {
    expect(resolveNotificationTarget({ data: null }, owner)).toBeNull();
    expect(resolveNotificationTarget({ data: { event: "test" } }, owner)).toBeNull();
  });
});
