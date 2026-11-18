/**
 * Overview / Dashboard — backend views/overview.py + services.py sözleşmesine göre (KURGUSAL veri).
 * Uçlar: GET /overview/dashboard/ (bundle), GET /overview/locations/
 */

const PT_LABELS = { 0: "Nakit", 1: "Kredi/Banka Kartı", 2: "İstanbulKart", 3: "Multinet", 5: "Personel Kart", 6: "Setcard" };
const PT_COLORS = { 0: "#9E9E9E", 1: "#1E88E5", 2: "#8E24AA", 3: "#FB8C00", 5: "#43A047", 6: "#E53935" };
const PERIOD_LABELS = {
  today: "Bugün",
  yesterday: "Dün",
  this_week: "Bu Hafta",
  last_week: "Geçen Hafta",
  this_month: "Bu Ay",
  last_month: "Geçen Ay",
  last_30: "Son 30 Gün",
  custom: "Özel Tarih",
};
const COMPARISON_LABELS = {
  today: "Dün bu saatte",
  yesterday: "Evvelsi gün",
  this_week: "Geçen hafta",
  last_week: "Önceki hafta",
  this_month: "Geçen ay aynı gün",
  last_month: "Önceki ay",
  last_30: "Önceki 30 gün",
  custom: "Önceki dönem",
};

const LOCATIONS = [
  { id: 11, name: "Merkez Ofis Lobi", region_id: 1, region_name: "Kurgusal Bölge A" },
  { id: 12, name: "Fabrika Yemekhane", region_id: 1, region_name: "Kurgusal Bölge A" },
  { id: 21, name: "Depo Dinlenme Alanı", region_id: 2, region_name: "Kurgusal Bölge B" },
];

const DEVICES = [
  { sn: "MOCK0000001", pos_name: "Lobi Otomat 1", location_id: 11, online: true },
  { sn: "MOCK0000002", pos_name: "Lobi Kahve 2", location_id: 11, online: true },
  { sn: "MOCK0000003", pos_name: "Yemekhane Snack", location_id: 12, online: false },
  { sn: "MOCK0000004", pos_name: "Yemekhane Kahve", location_id: 12, online: true },
  { sn: "MOCK0000005", pos_name: "Depo Otomat", location_id: 21, online: true },
  { sn: "MOCK0000006", pos_name: "Depo Soğuk İçecek", location_id: 21, online: false },
];

const PRODUCTS = ["Su 0,5 L", "Filtre Kahve", "Çikolatalı Gofret", "Ayran", "Latte", "Kraker"];

/** Deterministik sözde rastgele (aynı istek aynı veriyi döner) */
function rng(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const pad = (n) => String(n).padStart(2, "0");

function resolvePeriod(period, startRaw, endRaw) {
  const p = PERIOD_LABELS[period] ? period : "today";
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = today;
  let end = now;
  let mode = "hourly";
  const dayMs = 86400000;
  if (p === "yesterday") {
    start = new Date(today.getTime() - dayMs);
    end = today;
  } else if (p === "this_week") {
    start = new Date(today.getTime() - ((now.getDay() + 6) % 7) * dayMs);
    mode = "daily";
  } else if (p === "last_week") {
    const monday = new Date(today.getTime() - ((now.getDay() + 6) % 7) * dayMs);
    start = new Date(monday.getTime() - 7 * dayMs);
    end = monday;
    mode = "daily";
  } else if (p === "this_month") {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
    mode = "daily";
  } else if (p === "last_month") {
    start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    end = new Date(now.getFullYear(), now.getMonth(), 1);
    mode = "daily";
  } else if (p === "last_30") {
    start = new Date(today.getTime() - 30 * dayMs);
    mode = "daily";
  } else if (p === "custom") {
    const a = /^\d{4}-\d{2}-\d{2}$/.test(startRaw || "") ? new Date(`${startRaw}T00:00:00`) : null;
    const b = /^\d{4}-\d{2}-\d{2}$/.test(endRaw || "") ? new Date(`${endRaw}T00:00:00`) : null;
    if (a && b && !isNaN(a) && !isNaN(b)) {
      start = a;
      end = new Date(b.getTime() + dayMs);
    }
    mode = end - start <= dayMs ? "hourly" : "daily";
  }
  return { period: p, start, end, mode };
}

function buildDashboard({ query, user }) {
  const { period, start, end, mode } = resolvePeriod(query.period, query.start_date, query.end_date);
  const locationId = query.location_id ? Number(query.location_id) : null;
  const devices = DEVICES.filter((d) => !locationId || d.location_id === locationId);
  const online = devices.filter((d) => d.online).length;
  const salesVisible = Array.isArray(user.permissions) && user.permissions.includes("view_sales");

  const summaryBase = {
    period,
    period_label: PERIOD_LABELS[period],
    devices: { total: devices.length, online, offline: devices.length - online },
  };
  if (!salesVisible) {
    return {
      summary: { ...summaryBase, sales_visible: false },
      revenue_timeseries: null,
      payment_breakdown: null,
      top_devices: null,
      error_breakdown: null,
      recent_transactions: null,
    };
  }

  const rand = rng(start.getTime() / 1000 + (locationId || 0) * 97 + devices.length);
  const labels = [];
  const amounts = [];
  if (mode === "hourly") {
    const nowHour = new Date().getHours();
    const isToday = period === "today";
    for (let h = 0; h < 24; h++) {
      labels.push(`${pad(h)}:00`);
      const busy = h >= 7 && h <= 19 ? 1 : 0.08;
      amounts.push(isToday && h > nowHour ? 0 : Math.round(rand() * 900 * busy * devices.length) / 10);
    }
  } else {
    for (let t = start.getTime(); t < end.getTime(); t += 86400000) {
      const d = new Date(t);
      labels.push(`${pad(d.getDate())}.${pad(d.getMonth() + 1)}`);
      const weekend = d.getDay() === 0 || d.getDay() === 6 ? 0.35 : 1;
      amounts.push(Math.round(rand() * 6000 * weekend * devices.length) / 10);
    }
  }
  const revenue = Math.round(amounts.reduce((a, b) => a + b, 0) * 100) / 100;
  const previous = Math.round(revenue * (0.75 + rand() * 0.5) * 100) / 100;
  const success = Math.round(revenue / 27);
  const failTimeout = Math.round(rand() * 6);
  const failBank = Math.round(rand() * 9);
  const failTech = Math.round(rand() * 4);
  const failOther = Math.round(rand() * 2);
  const failed = failTimeout + failBank + failTech + failOther;

  const shares = [
    [1, 0.46],
    [5, 0.24],
    [0, 0.14],
    [3, 0.09],
    [2, 0.07],
  ];
  const payment = shares
    .map(([pt, share]) => ({
      pt_type: pt,
      label: PT_LABELS[pt],
      color: PT_COLORS[pt],
      amount: Math.round(revenue * share * 100) / 100,
      count: Math.round(success * share),
    }))
    .filter((p) => p.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const topLimit = Math.max(1, Math.min(Number(query.top_limit) || 5, 25));
  const weights = devices.map(() => rand() + 0.2);
  const wSum = weights.reduce((a, b) => a + b, 0) || 1;
  const top = devices
    .map((d, i) => ({
      sn: d.sn,
      pos_name: d.pos_name,
      revenue: Math.round((revenue * weights[i]) / wSum * 100) / 100,
      tx_count: Math.round((success * weights[i]) / wSum),
    }))
    .filter((d) => d.revenue > 0)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, topLimit);

  const errorBreakdown = failTech
    ? devices.slice(0, 2).map((d, i) => ({ sn: d.sn, pos_name: d.pos_name, count: Math.max(1, failTech - i * 2) })).filter((e) => e.count > 0)
    : [];

  const recentLimit = Math.max(1, Math.min(Number(query.recent_limit) || 5, 50));
  const recent = [];
  if (revenue > 0) {
    let t = Math.min(end.getTime(), Date.now());
    for (let i = 0; i < recentLimit; i++) {
      t -= Math.round(rand() * 25 + 2) * 60000;
      const d = devices[Math.floor(rand() * devices.length)];
      const pt = shares[Math.floor(rand() * shares.length)][0];
      const ok = rand() > 0.12;
      recent.push({
        id: 90000 + i,
        pt_id: `MOCK-TX-${t}`,
        datetime: new Date(t).toISOString(),
        sn: d.sn,
        pos_name: d.pos_name,
        product_name: PRODUCTS[Math.floor(rand() * PRODUCTS.length)],
        amount: Math.round((15 + rand() * 60) * 100) / 100,
        status: ok,
        pt_type: pt,
        pt_type_label: PT_LABELS[pt],
        card_pan: pt === 1 ? "4111********1111" : "",
      });
    }
  }

  return {
    summary: {
      ...summaryBase,
      start: start.toISOString(),
      end: end.toISOString(),
      sales_visible: true,
      revenue,
      previous_revenue: previous,
      change_pct: previous > 0 ? ((revenue - previous) / previous) * 100 : null,
      change_positive: revenue >= previous,
      comparison_label: COMPARISON_LABELS[period],
      transactions: { total: success + failed, success, failed },
      failures: { timeout: failTimeout, bank: failBank, technical: failTech, other: failOther },
    },
    revenue_timeseries: { mode, labels, amounts },
    payment_breakdown: { results: payment },
    top_devices: { results: top },
    error_breakdown: { results: errorBreakdown },
    recent_transactions: { results: recent },
  };
}

module.exports = [
  {
    method: "GET",
    path: "/overview/dashboard/",
    handler: (ctx) => [200, buildDashboard(ctx)],
  },
  {
    method: "GET",
    path: "/overview/locations/",
    handler: () => [200, { results: LOCATIONS }],
  },
];
