import MockAdapter from "axios-mock-adapter";
import { apiClient } from "@/api/client";
import { normalizeDashboard, overviewApi } from "@/api/overview";
import { MAX_CUSTOM_RANGE_DAYS, validateCustomRange } from "@/screens/dashboard/dashboardPeriod";
import type { OverviewBundle } from "@/types/overview";

describe("normalizeDashboard", () => {
  it("sales_visible=false iken satış modeli null olur", () => {
    const d = normalizeDashboard({
      summary: { period: "today", period_label: "Bugün", sales_visible: false, devices: { total: 2, online: 1, offline: 1 } },
      revenue_timeseries: null,
      payment_breakdown: null,
      top_devices: null,
      error_breakdown: null,
      recent_transactions: null,
    });
    expect(d.sales).toBeNull();
    expect(d.devices).toEqual({ total: 2, online: 1, offline: 1 });
  });

  it("string sayıları ve düz dizi zarflarını normalize eder, eksik değer uydurmaz", () => {
    const raw = {
      summary: {
        period: "today",
        period_label: "Bugün",
        sales_visible: true,
        devices: { total: 1, online: 1, offline: 0 },
        revenue: "10.50",
        previous_revenue: 0,
        change_pct: null,
        transactions: { total: 3, success: 2, failed: 1 },
        failures: {},
      },
      revenue_timeseries: { mode: "daily", labels: ["01.11", "02.11"], amounts: ["5", null] },
      payment_breakdown: [{ pt_type: 1, label: "Kart", color: "gray", amount: "10.5", count: "2" }],
      top_devices: { results: [] },
      error_breakdown: null,
      recent_transactions: { results: [] },
    } as unknown as OverviewBundle;
    const d = normalizeDashboard(raw);
    expect(d.sales?.revenue).toBe(10.5);
    expect(d.sales?.changePct).toBeNull();
    expect(d.sales?.failures.timeout).toBeNull();
    expect(d.sales?.timeseries.points).toEqual([
      { label: "01.11", amount: 5 },
      { label: "02.11", amount: 0 },
    ]);
    expect(d.sales?.paymentBreakdown[0]).toMatchObject({ amount: 10.5, count: 2 });
    expect(d.sales?.errorBreakdown).toEqual([]);
  });
});

describe("overviewApi", () => {
  let mock: MockAdapter;
  beforeEach(() => (mock = new MockAdapter(apiClient)));
  afterEach(() => mock.restore());

  it("dashboardData nocache=1 ile cache'i atlar", async () => {
    mock.onGet("/overview/dashboard/").reply(200, {
      summary: { period: "today", period_label: "Bugün", sales_visible: false, devices: { total: 0, online: 0, offline: 0 } },
    });
    await overviewApi.dashboardData({ period: "today", nocache: true });
    expect(mock.history.get[0].params).toEqual({ period: "today", top_limit: 5, recent_limit: 5, nocache: 1 });
  });

  it("locations {results} zarfını açar", async () => {
    mock.onGet("/overview/locations/").reply(200, { results: [{ id: 1, name: "A", region_id: null, region_name: null }] });
    await expect(overviewApi.locations()).resolves.toEqual([{ id: 1, name: "A", region_id: null, region_name: null }]);
  });
});

describe("validateCustomRange", () => {
  const today = new Date(2026, 10, 18);
  it("geçerli aralığı YYYY-MM-DD'ye çevirir", () => {
    expect(validateCustomRange("01.11.2026", "18.11.2026", today)).toEqual({
      ok: true,
      range: { start: "2026-11-01", end: "2026-11-18" },
    });
  });
  it("hatalı tarih, ters aralık, gelecek ve azami aralık reddedilir", () => {
    expect(validateCustomRange("32.11.2026", "18.11.2026", today)).toMatchObject({ ok: false, field: "start" });
    expect(validateCustomRange("10.11.2026", "01.11.2026", today)).toMatchObject({ ok: false, field: "range" });
    expect(validateCustomRange("10.11.2026", "19.11.2026", today)).toMatchObject({ ok: false, field: "end" });
    const start = new Date(2026, 10, 18 - MAX_CUSTOM_RANGE_DAYS);
    const s = `${String(start.getDate()).padStart(2, "0")}.${String(start.getMonth() + 1).padStart(2, "0")}.${start.getFullYear()}`;
    expect(validateCustomRange(s, "18.11.2026", today)).toMatchObject({ ok: false, field: "range" });
  });
});
