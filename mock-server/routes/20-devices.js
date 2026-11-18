/**
 * POS cihazları — backend views/pos_devices.py + serializers/pos_device.py sözleşmesine göre.
 * TÜM VERİLER KURGUSALDIR (seri no, ad, konum, ciro). Canlı sunucuyla ilgisi yoktur.
 *
 * Şirket 1 stok modunda (slot), şirket 2 normal modda (ürün) — state.companies[].uses_stock_mode.
 * Not: /stock/skus/, /stock/locations/, /overview/locations/ uçları stok/overview mock dosyalarındadır;
 * burada yalnız slotların başvurduğu kurgusal SKU kimlikleri (state.db.skus yoksa) tohumlanır.
 */
const state = require("../state");

/* ------------------------------------------------------------- yardımcılar */

let seed = 20261118;
function rnd() {
  seed = (seed * 1664525 + 1013904223) % 4294967296;
  return seed / 4294967296;
}
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];
const money = (n) => Math.round(n * 100) / 100;
const dec = (n) => money(n).toFixed(2);
const now = () => new Date();
const iso = (d) => d.toISOString();
const PAGE = 25;
const TX_PAGE = 50;

function dayStart(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function dayEnd(d) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}
function parseDay(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || "")) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}
const has = (user, perm) => Array.isArray(user && user.permissions) && user.permissions.includes(perm);
const usesStock = (companyId) => !!(state.companies.find((c) => c.id === companyId) || {}).uses_stock_mode;

/* -------------------------------------------------------------- tohum veri */

if (!state.db.skus) {
  const names = [
    ["Su 500 ml", "SU-500"], ["Maden Suyu", "MS-200"], ["Kola 330 ml", "KL-330"], ["Gazoz 330 ml", "GZ-330"],
    ["Soğuk Çay Şeftali", "SC-SFT"], ["Çikolatalı Gofret", "GF-CKL"], ["Bisküvi Sade", "BS-SDE"], ["Kraker", "KR-001"],
    ["Fındıklı Bar", "BR-FND"], ["Cips Klasik", "CP-KLS"], ["Kek Kakaolu", "KK-KAK"], ["Sakız", "SK-NAN"],
    ["Türk Kahvesi", "TK-001"], ["Filtre Kahve", "FK-001"], ["Latte", "LT-001"], ["Sıcak Çikolata", "SC-001"],
  ];
  state.db.skus = names.map(([name, code], i) => ({
    id: 900 + i,
    name,
    sku_code: code,
    barcode: null,
    kind: i >= 12 ? "composite" : "simple",
    kind_display: i >= 12 ? "Reçeteli" : "Basit",
    sale_price: dec(15 + i * 2.5),
  }));
}
const skuById = (id) => (state.db.skus || []).find((s) => s.id === Number(id)) || null;

const LOCATIONS = [
  { id: 11, name: "Merkez Plaza Kat 2", company_id: 1 },
  { id: 12, name: "Teknopark B Blok", company_id: 1 },
  { id: 13, name: "Organize Sanayi Yemekhane", company_id: 1 },
  { id: 14, name: "Hastane Bekleme Salonu", company_id: 1 },
  { id: 21, name: "Kafe Şube 1", company_id: 2 },
  { id: 22, name: "Kafe Şube 2", company_id: 2 },
];

function makeDevice(i) {
  const companyId = i < 30 ? 1 : 2;
  const locs = LOCATIONS.filter((l) => l.company_id === companyId);
  const loc = rnd() < 0.9 ? pick(locs) : null;
  const coffee = companyId === 2 || rnd() < 0.25;
  const minutesAgo = rnd() < 0.75 ? Math.floor(rnd() * 5) : Math.floor(60 + rnd() * 6000);
  const lastSeen = rnd() < 0.05 ? null : new Date(Date.now() - minutesAgo * 60000);
  return {
    id: 1000 + i,
    sn: `PAV${String(240100 + i * 7)}`,
    pos_name: `${coffee ? "Kahve" : "Snack"} Otomat ${String(i + 1).padStart(2, "0")}`,
    stat: rnd() > 0.08,
    company_id: companyId,
    location_id: loc ? loc.id : null,
    act_vmc: coffee ? pick(["Necta Krea", "Bianchi Lei"]) : pick(["Crane Merchant", "Sielaff FK"]),
    act_vmcsn: `VMC-${100000 + i * 13}`,
    act_macstat: pick([1, 2, 2, 2, 3, 4]),
    act_sim_pw: Math.floor(rnd() * 31),
    app_vers: pick(["3.4.1", "3.4.2", "3.5.0"]),
    tp_vers: pick(["2.1.0", "2.1.3"]),
    last_seen: lastSeen,
    pos_updprd: 5,
    sort_order: 0,
    machine_type: coffee ? { id: 2, name: "Sıcak İçecek" } : { id: 1, name: "Spiral Snack" },
    pos_odemetip: coffee ? 1 : 0,
    price_management: pick([0, 0, 1, 2]),
    sales_notification_enabled: rnd() < 0.3,
    sales_notification_interval: 60,
    operating_hours_mode: rnd() < 0.2 ? 1 : 0,
    schedule: [0, 1, 2, 3, 4].map((d) => ({ day: d, start: "08:00", end: "19:00" })),
    payment_methods: {
      magnetic: true, chip: true, contactless: true, qrcode: rnd() < 0.5, personel_card: companyId === 1,
      vennex_wallet: rnd() < 0.4, istanbul_kart: rnd() < 0.3, metropol: rnd() < 0.5, multinet: rnd() < 0.5,
      setcard: rnd() < 0.3, ticket: rnd() < 0.3, pluxee: rnd() < 0.3, tokenflex: false, refund: true,
    },
    device_toggles: { audio: true, auto_select: rnd() < 0.5, login_button: false, cancel_button: true },
    commands: { and_reset: false, eod_trig: false, mdb_reset: false, apk_reset: false },
    timeouts: { vend_timeout: 60, pos_timeout: 30, pos_eod: "23:30" },
    coffee,
    template_id: null,
  };
}

function makeItems(device) {
  const count = device.coffee ? 6 : 8 + Math.floor(rnd() * 12);
  const items = [];
  const stock = usesStock(device.company_id);
  for (let n = 1; n <= count; n++) {
    const sku = device.coffee ? state.db.skus[12 + (n % 4)] : state.db.skus[n % 12];
    const max = device.coffee ? 0 : 8 + Math.floor(rnd() * 8);
    const qty = max ? Math.floor(rnd() * (max + 1)) : 0;
    items.push({
      id: device.id * 100 + n,
      urun_no: n,
      is_wildcard: false,
      name: stock ? null : sku.name,
      price: dec(Number(sku.sale_price)),
      quantity: qty,
      max_quantity: max,
      stock_sku: stock ? sku.id : null,
    });
  }
  return items;
}

function makeTransactions(device) {
  const list = [];
  const days = 45;
  let id = device.id * 10000;
  for (let d = days; d >= 0; d--) {
    const perDay = device.stat ? Math.floor(rnd() * 14) : 0;
    for (let k = 0; k < perDay; k++) {
      const t = new Date();
      t.setDate(t.getDate() - d);
      t.setHours(7 + Math.floor(rnd() * 14), Math.floor(rnd() * 60), Math.floor(rnd() * 60), 0);
      if (t > now()) continue;
      const ok = rnd() > 0.07;
      const pt = pick([0, 0, 1, 1, 1, 2, 3, 4, 5, 8]);
      const product = 1 + Math.floor(rnd() * 8);
      list.push({
        id: ++id,
        pt_id: `T${device.id}${id}`,
        pt_datetime: t,
        amount: money(10 + rnd() * 40),
        pt_type: pt,
        status: ok,
        iptalNo: ok ? 0 : pick([1, 2, 3, 4]),
        product_no: product,
        pt_pan: pt === 1 ? `5400${String(1000 + Math.floor(rnd() * 8999))}12${String(1000 + Math.floor(rnd() * 8999))}` : pt === 5 ? "04A1B2C3" : "",
        bankRefNo: pt === 1 && ok ? `BR${id}` : null,
      });
    }
  }
  return list.sort((a, b) => b.pt_datetime - a.pt_datetime);
}

if (!state.db.devices) {
  state.db.devices = Array.from({ length: 40 }, (_, i) => makeDevice(i));
  state.db.deviceItems = {};
  state.db.transactions = {};
  state.db.cashCollections = {};
  state.db.revenueCounts = {};
  for (const d of state.db.devices) {
    state.db.deviceItems[d.sn] = makeItems(d);
    state.db.transactions[d.sn] = makeTransactions(d);
    state.db.cashCollections[d.sn] = [];
    state.db.revenueCounts[d.sn] = [];
  }
  state.db.nextItemId = 5_000_000;
}

/* --------------------------------------------------------- serileştirme */

const isOnline = (d) => !!d.last_seen && d.last_seen.getTime() + (d.pos_updprd + 2) * 60000 > Date.now();
const devicesOf = (companyId) => state.db.devices.filter((d) => d.company_id === companyId);
const findDevice = (sn, companyId) => devicesOf(companyId).find((d) => d.sn === sn) || null;
const locName = (id) => (LOCATIONS.find((l) => l.id === id) || {}).name || null;
const companyName = (id) => (state.companies.find((c) => c.id === id) || {}).name || null;

function revenueStats(d) {
  const txs = state.db.transactions[d.sn].filter((t) => t.status);
  const n = now();
  const today = dayStart(n);
  const yest = new Date(today);
  yest.setDate(yest.getDate() - 1);
  const monthStart = new Date(n.getFullYear(), n.getMonth(), 1);
  const lastMonthStart = new Date(n.getFullYear(), n.getMonth() - 1, 1);
  const sum = (from, to) => txs.filter((t) => t.pt_datetime >= from && t.pt_datetime <= to);
  const agg = (arr) => ({ revenue: money(arr.reduce((s, t) => s + t.amount, 0)), count: arr.length });
  return {
    today: agg(sum(today, n)),
    yesterday: agg(sum(yest, dayEnd(yest))),
    this_month: agg(sum(monthStart, n)),
    last_month: agg(sum(lastMonthStart, new Date(monthStart.getTime() - 1))),
    last_tx: state.db.transactions[d.sn][0] ? state.db.transactions[d.sn][0].pt_datetime : null,
  };
}

function fillOf(d) {
  const items = state.db.deviceItems[d.sn];
  if (!items.length) return null;
  const qty = items.reduce((s, i) => s + i.quantity, 0);
  const max = items.reduce((s, i) => s + i.max_quantity, 0);
  return { pct: max > 0 ? Math.round((100 * qty) / max) : null, qty, max };
}

function listItem(d) {
  const r = revenueStats(d);
  return {
    sn: d.sn,
    pos_name: d.pos_name,
    stat: d.stat,
    company_id: d.company_id,
    company_name: companyName(d.company_id),
    location_id: d.location_id,
    location_name: locName(d.location_id),
    act_vmc: d.act_vmc,
    act_macstat: d.act_macstat,
    last_seen: d.last_seen ? iso(d.last_seen) : null,
    sort_order: d.sort_order,
    online: isOnline(d),
    today_revenue: r.today.revenue,
    today_tx_count: r.today.count,
    yesterday_revenue: r.yesterday.revenue,
    this_month_revenue: r.this_month.revenue,
    last_month_revenue: r.last_month.revenue,
    last_transaction: r.last_tx ? iso(r.last_tx) : null,
    fill_rate: fillOf(d),
  };
}

const DAYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"];

function detailOf(d) {
  const schedule = {};
  for (const s of d.schedule) (schedule[DAYS[s.day]] = schedule[DAYS[s.day]] || []).push({ start: s.start, end: s.end });
  return {
    sn: d.sn,
    pos_name: d.pos_name,
    stat: d.stat,
    is_online: isOnline(d),
    last_seen: d.last_seen ? iso(d.last_seen) : null,
    company: { id: d.company_id, name: companyName(d.company_id) },
    location: d.location_id ? { id: d.location_id, name: locName(d.location_id) } : null,
    machine_type: d.machine_type,
    act_vmc: d.act_vmc,
    act_vmcsn: d.act_vmcsn,
    act_macstat: d.act_macstat,
    act_sim_pw: d.act_sim_pw,
    app_vers: d.app_vers,
    tp_vers: d.tp_vers,
    pos_odemetip: d.pos_odemetip,
    price_management: d.price_management,
    pos_updprd: d.pos_updprd,
    sales_notification_enabled: d.sales_notification_enabled,
    sales_notification_interval: d.sales_notification_interval,
    operating_hours_mode: d.operating_hours_mode,
    payment_methods: { ...d.payment_methods },
    device_toggles: { ...d.device_toggles },
    commands: { ...d.commands },
    operating_hours: d.operating_hours_mode === 0 ? null : { mode: d.operating_hours_mode === 1 ? "working" : "non_working", schedule },
    timeouts: { ...d.timeouts },
  };
}

function itemOut(item) {
  const sku = item.stock_sku != null ? skuById(item.stock_sku) : null;
  return {
    id: item.id,
    urun_no: item.urun_no,
    is_wildcard: item.is_wildcard,
    ...(item.name != null || item.stock_sku == null ? { name: item.name || "" } : {}),
    price: item.price,
    quantity: item.quantity,
    max_quantity: item.max_quantity,
    stock_sku: item.stock_sku,
    stock_sku_name: sku ? sku.name : undefined,
    stock_sku_code: sku ? sku.sku_code : undefined,
  };
}

function txOut(t) {
  const pan = t.pt_pan && t.pt_type !== 5 && t.pt_pan.length > 8 ? `${t.pt_pan.slice(0, 4)}********${t.pt_pan.slice(-4)}` : t.pt_pan || "";
  return {
    id: t.id,
    pt_id: t.pt_id,
    pt_datetime: iso(t.pt_datetime),
    amount: dec(t.amount),
    pt_type: t.pt_type,
    status: t.status,
    iptalNo: t.iptalNo,
    product_no: t.product_no,
    pt_pan: pan,
    bankRefNo: t.bankRefNo,
    display_name: (skuById(900 + (t.product_no % 16)) || {}).name || null,
  };
}

const SORTS = {
  today_revenue: (d) => revenueStats(d).today.revenue,
  yesterday_revenue: (d) => revenueStats(d).yesterday.revenue,
  this_month_revenue: (d) => revenueStats(d).this_month.revenue,
  last_month_revenue: (d) => revenueStats(d).last_month.revenue,
  fill_rate: (d) => (fillOf(d) || {}).pct,
  last_transaction: (d) => (revenueStats(d).last_tx || new Date(0)).getTime(),
};

const notFound = [404, { detail: "Bulunamadı." }];
const noSales = [403, { detail: "Yetkiniz yok." }];

/* ------------------------------------------------------------------ uçlar */

module.exports = [
  {
    method: "GET",
    path: "/pos-devices/",
    handler: ({ query, companyId }) => {
      let qs = devicesOf(companyId);
      const q = (query.q || "").trim().toLocaleLowerCase("tr-TR");
      if (q) qs = qs.filter((d) => [d.sn, d.pos_name, d.act_vmc].some((v) => (v || "").toLocaleLowerCase("tr-TR").includes(q)));
      if (query.location_id) qs = qs.filter((d) => d.location_id === Number(query.location_id));
      if (query.stat === "0" || query.stat === "1") qs = qs.filter((d) => d.stat === (query.stat === "1"));
      if (query.online === "true") qs = qs.filter(isOnline);
      else if (query.online === "false") qs = qs.filter((d) => !isOnline(d));
      const total = qs.length;
      const online = qs.filter(isOnline).length;
      qs = [...qs].sort((a, b) => (a.sort_order || 999999) - (b.sort_order || 999999) || a.pos_name.localeCompare(b.pos_name, "tr"));
      const m = /^(.*)_(desc|asc)$/.exec(query.sort_by || "");
      if (m && SORTS[m[1]]) {
        const desc = m[2] === "desc";
        const key = (d) => {
          const v = SORTS[m[1]](d);
          return v == null ? (desc ? -1 : 101) : v;
        };
        qs.sort((a, b) => (desc ? key(b) - key(a) : key(a) - key(b)));
      }
      const numPages = Math.max(1, Math.ceil(qs.length / PAGE));
      const page = Math.min(Math.max(1, Number(query.page) || 1), numPages);
      return [
        200,
        {
          count: qs.length,
          page,
          num_pages: numPages,
          page_size: PAGE,
          online_count: online,
          offline_count: total - online,
          total_count: total,
          results: qs.slice((page - 1) * PAGE, page * PAGE).map(listItem),
        },
      ];
    },
  },
  {
    method: "POST",
    path: "/pos-devices/sort/",
    handler: ({ body, companyId }) => {
      const orders = Array.isArray(body.device_orders) ? body.device_orders : [];
      if (!orders.length) return [400, { device_orders: ["Bu liste boş olamaz."] }];
      if (orders.some((o) => !o || o.sn == null || o.sort_order == null))
        return [400, { device_orders: ["Her öğede 'sn' ve 'sort_order' alanları olmalı."] }];
      const devs = orders.map((o) => findDevice(String(o.sn), companyId));
      if (devs.some((d) => !d)) return [403, { detail: "Bazı cihazlara erişim yetkiniz yok." }];
      orders.forEach((o, i) => (devs[i].sort_order = Number(o.sort_order) || 0));
      return [200, { detail: "Sıralama güncellendi." }];
    },
  },
  {
    method: "POST",
    path: "/pos-devices/sort/reset/",
    handler: ({ companyId }) => {
      devicesOf(companyId).forEach((d) => (d.sort_order = 0));
      return [200, { detail: "Sıralama sıfırlandı." }];
    },
  },
  {
    method: "GET",
    path: "/pos-devices/:sn/",
    handler: ({ params, companyId, user }) => {
      const d = findDevice(params.sn, companyId);
      if (!d) return notFound;
      return [
        200,
        {
          ...detailOf(d),
          sales_visible: has(user, "view_sales"),
          permissions: { manage_device_settings: has(user, "manage_device_settings"), manage_stock: has(user, "manage_stock") },
        },
      ];
    },
  },
  {
    method: "PATCH",
    path: "/pos-devices/:sn/",
    handler: ({ params, companyId, user, body }) => {
      const d = findDevice(params.sn, companyId);
      if (!d) return notFound;
      const errs = {};
      if ("pos_name" in body && (typeof body.pos_name !== "string" || !body.pos_name.trim() || body.pos_name.length > 30))
        errs.pos_name = ["Bu alan boş olamaz ve en fazla 30 karakter olabilir."];
      if ("pos_odemetip" in body && !(Number.isInteger(body.pos_odemetip) && body.pos_odemetip >= 0 && body.pos_odemetip <= 10))
        errs.pos_odemetip = ["0 ile 10 arasında bir tam sayı girin."];
      if ("price_management" in body && !(Number.isInteger(body.price_management) && body.price_management >= 0 && body.price_management <= 2))
        errs.price_management = ["Bu değerin 2 veya daha az olduğundan emin olun."];
      if ("sales_notification_interval" in body && !(Number.isInteger(body.sales_notification_interval) && body.sales_notification_interval >= 1))
        errs.sales_notification_interval = ["Bu değerin 1 veya daha büyük olduğundan emin olun."];
      if (body.operating_hours && body.operating_hours.mode != null && ![0, 1, 2].includes(body.operating_hours.mode))
        errs.operating_hours = ["operating_hours.mode 0/1/2 olmalı."];
      if (Object.keys(errs).length) return [400, errs];

      const warnings = [];
      if (body.commands) for (const k of ["and_reset", "eod_trig", "mdb_reset"]) if (k in body.commands) d.commands[k] = !!body.commands[k];
      if ("machine_type_id" in body) {
        if (!has(user, "select_machine_type")) warnings.push("machine_type_id atlandı: select_machine_type izni yok.");
        else d.machine_type = body.machine_type_id == null ? null : { id: Number(body.machine_type_id), name: `Tip ${body.machine_type_id}` };
      }
      if (!has(user, "manage_device_settings")) {
        return [200, { ...detailOf(d), _warnings: [...warnings, "Ayar değişikliği yapma yetkiniz yok. Yalnız komutlar/makine tipi kaydedildi."] }];
      }
      if ("pos_name" in body) d.pos_name = body.pos_name.trim();
      if ("location_id" in body) {
        if (body.location_id != null && !LOCATIONS.some((l) => l.id === body.location_id && l.company_id === d.company_id))
          return [400, { detail: "Geçersiz konum." }];
        d.location_id = body.location_id;
      }
      for (const k of ["pos_odemetip", "price_management", "sales_notification_interval", "sales_notification_enabled"]) if (k in body) d[k] = body[k];
      if (body.payment_methods) for (const [k, v] of Object.entries(body.payment_methods)) if (k in d.payment_methods) d.payment_methods[k] = !!v;
      if (body.device_toggles) for (const [k, v] of Object.entries(body.device_toggles)) if (k in d.device_toggles) d.device_toggles[k] = !!v;
      if (body.operating_hours) {
        const oh = body.operating_hours;
        if (oh.mode != null) d.operating_hours_mode = oh.mode;
        d.schedule = [];
        if (d.operating_hours_mode !== 0)
          for (const [day, slots] of Object.entries(oh.schedule || {}))
            for (const s of slots || []) if (s.start && s.end) d.schedule.push({ day: Number(day), start: s.start, end: s.end });
      }
      return [200, warnings.length ? { ...detailOf(d), _warnings: warnings } : detailOf(d)];
    },
  },
  {
    method: "GET",
    path: "/pos-devices/:sn/summary/",
    handler: ({ params, companyId, user }) => {
      if (!has(user, "view_sales")) return noSales;
      const d = findDevice(params.sn, companyId);
      if (!d) return notFound;
      const r = revenueStats(d);
      return [200, { today: r.today, yesterday: r.yesterday, this_month: r.this_month, last_month: r.last_month }];
    },
  },
  {
    method: "GET",
    path: "/pos-devices/:sn/transactions/",
    handler: ({ params, companyId, user, query }) => {
      if (!has(user, "view_sales")) return noSales;
      const d = findDevice(params.sn, companyId);
      if (!d) return notFound;
      const start = dayStart(parseDay(query.start_date) || now());
      const end = dayEnd(parseDay(query.end_date) || now());
      let qs = state.db.transactions[d.sn].filter((t) => t.pt_datetime >= start && t.pt_datetime <= end);
      const summary = {
        total: qs.length,
        success: qs.filter((t) => t.status).length,
        failed: qs.filter((t) => !t.status).length,
        revenue: money(qs.filter((t) => t.status).reduce((s, t) => s + t.amount, 0)),
      };
      if (query.tx_status === "success") qs = qs.filter((t) => t.status);
      else if (query.tx_status === "fail") qs = qs.filter((t) => !t.status);
      if (query.pt_type !== undefined && query.pt_type !== "" && !Number.isNaN(Number(query.pt_type))) qs = qs.filter((t) => t.pt_type === Number(query.pt_type));
      if (query.cancel_reason === "other") qs = qs.filter((t) => !t.status && ![1, 2, 3].includes(t.iptalNo));
      else if (["1", "2", "3"].includes(query.cancel_reason)) qs = qs.filter((t) => !t.status && t.iptalNo === Number(query.cancel_reason));
      if ((query.card_last4 || "").trim()) qs = qs.filter((t) => (t.pt_pan || "").endsWith(query.card_last4.trim()));
      const numPages = Math.max(1, Math.ceil(qs.length / TX_PAGE));
      const page = Math.min(Math.max(1, Number(query.page) || 1), numPages);
      return [200, { count: qs.length, page, num_pages: numPages, page_size: TX_PAGE, summary, results: qs.slice((page - 1) * TX_PAGE, page * TX_PAGE).map(txOut) }];
    },
  },
  {
    method: "GET",
    path: "/pos-devices/:sn/products/",
    handler: ({ params, companyId }) => {
      const d = findDevice(params.sn, companyId);
      if (!d) return notFound;
      const items = [...state.db.deviceItems[d.sn]].sort((a, b) => Number(a.is_wildcard) - Number(b.is_wildcard) || (a.urun_no || 0) - (b.urun_no || 0));
      const qty = items.reduce((s, i) => s + i.quantity, 0);
      const max = items.reduce((s, i) => s + i.max_quantity, 0);
      return [200, { mode: usesStock(companyId) ? "stock" : "normal", items: items.map(itemOut), fill: { qty, max, pct: max > 0 ? Math.round((100 * qty) / max) : null } }];
    },
  },
  {
    method: "POST",
    path: "/pos-devices/:sn/products/create/",
    handler: ({ params, companyId, user, body }) => {
      const d = findDevice(params.sn, companyId);
      if (!d) return notFound;
      const items = state.db.deviceItems[d.sn];
      const price = Number(String(body.price ?? "").replace(",", "."));
      if (!Number.isFinite(price) || price < 0) return [400, { detail: "Geçersiz fiyat." }];
      if (usesStock(companyId)) {
        if (!has(user, "manage_stock")) return [403, { detail: "Stok modunda slot eklemek için stok yetkiniz gerekli." }];
        if (body.stock_sku_id == null) return [400, { stock_sku_id: ["Bu alan zorunludur."] }];
        if (!skuById(body.stock_sku_id)) return [400, { detail: "Geçersiz SKU." }];
        if (body.is_wildcard && items.some((i) => i.is_wildcard)) return [400, { detail: "Bu cihazda zaten bir wildcard slot var." }];
        if (!body.is_wildcard && !(Number(body.urun_no) >= 1)) return [400, { detail: "Ürün no gerekli." }];
        if (!body.is_wildcard && items.some((i) => !i.is_wildcard && i.urun_no === Number(body.urun_no)))
          return [400, { detail: `Ürün no ${body.urun_no} zaten kullanılıyor.` }];
        const item = { id: ++state.db.nextItemId, urun_no: body.is_wildcard ? null : Number(body.urun_no), is_wildcard: !!body.is_wildcard, name: null, price: dec(price), quantity: 0, max_quantity: Math.max(0, Number(body.max_quantity) || 0), stock_sku: Number(body.stock_sku_id) };
        items.push(item);
        return [201, itemOut(item)];
      }
      if (!has(user, "manage_device_settings")) return [403, { detail: "Ürün eklemek için cihaz ayarı yetkiniz gerekli." }];
      if (!body.name || String(body.name).length > 50) return [400, { name: ["Bu alan zorunludur (en fazla 50 karakter)."] }];
      if (items.some((i) => i.urun_no === Number(body.urun_no))) return [400, { detail: `Ürün no ${body.urun_no} zaten kullanılıyor.` }];
      const item = { id: ++state.db.nextItemId, urun_no: Number(body.urun_no), is_wildcard: false, name: String(body.name).trim(), price: dec(price), quantity: Math.max(0, Number(body.quantity) || 0), max_quantity: Math.max(0, Number(body.max_quantity) || 0), stock_sku: null };
      items.push(item);
      return [201, itemOut(item)];
    },
  },
  {
    method: "PATCH",
    path: "/pos-devices/:sn/products/:id/",
    handler: ({ params, companyId, user, body }) => {
      const d = findDevice(params.sn, companyId);
      if (!d) return notFound;
      const item = state.db.deviceItems[d.sn].find((i) => i.id === Number(params.id));
      if (!item) return notFound;
      const stock = usesStock(companyId);
      if (stock ? !has(user, "manage_stock") : !has(user, "manage_device_settings")) return [403, { detail: "Yetkiniz yok." }];
      if ("price" in body) item.price = dec(Number(String(body.price).replace(",", ".")));
      if (stock) {
        // Backend gibi: eksik alanlar sıfırlanır (edit_stock_slot)
        item.is_wildcard = !!body.is_wildcard;
        item.urun_no = item.is_wildcard ? null : body.urun_no ?? null;
        item.max_quantity = Math.max(0, Number(body.max_quantity) || 0);
        if (body.stock_sku_id != null) item.stock_sku = Number(body.stock_sku_id);
      } else {
        for (const k of ["urun_no", "name", "quantity", "max_quantity"]) if (k in body) item[k] = body[k];
      }
      return [200, itemOut(item)];
    },
  },
  {
    method: "DELETE",
    path: "/pos-devices/:sn/products/:id/",
    handler: ({ params, companyId, user }) => {
      const d = findDevice(params.sn, companyId);
      if (!d) return notFound;
      const stock = usesStock(companyId);
      if (stock ? !has(user, "manage_stock") : !has(user, "manage_device_settings")) return [403, { detail: "Yetkiniz yok." }];
      const list = state.db.deviceItems[d.sn];
      const idx = list.findIndex((i) => i.id === Number(params.id));
      if (idx < 0) return notFound;
      list.splice(idx, 1);
      return [204, undefined];
    },
  },
  {
    method: "POST",
    path: "/pos-devices/:sn/products/bulk-quantities/",
    handler: ({ params, companyId, user, body }) => {
      if (!has(user, "manage_stock")) return [403, { detail: "Yetkiniz yok." }];
      const d = findDevice(params.sn, companyId);
      if (!d) return notFound;
      if (user.role !== "tech" && !body.source_location_id) return [400, { detail: "Kaynak lokasyon seçiniz." }];
      let updated = 0;
      for (const u of body.updates || []) {
        const slot = state.db.deviceItems[d.sn].find((i) => i.id === Number(u.slot_id));
        if (!slot) continue;
        const q = Number(u.quantity);
        if (q < slot.quantity) return [400, { detail: `Slot ${slot.urun_no ?? "WILDCARD"}: mevcut miktardan (${slot.quantity}) düşük değer girilemez.` }];
        if (slot.max_quantity && q > slot.max_quantity) return [400, { detail: `Slot ${slot.urun_no}: kapasite ${slot.max_quantity}, daha fazlası girilemez (${q} denendi).` }];
        if (q !== slot.quantity) {
          slot.quantity = q;
          updated++;
        }
      }
      return [200, { detail: `${updated} slot güncellendi.`, updated_count: updated }];
    },
  },
  {
    method: "POST",
    path: "/pos-devices/:sn/fill-all-stock/",
    handler: ({ params, companyId, user, body }) => {
      if (!has(user, "manage_stock")) return [403, { detail: "Yetkiniz yok." }];
      const d = findDevice(params.sn, companyId);
      if (!d) return notFound;
      if (user.role !== "tech" && !body.source_location_id) return [400, { detail: "Kaynak lokasyon seçiniz." }];
      let filled = 0;
      for (const s of state.db.deviceItems[d.sn]) {
        const sku = skuById(s.stock_sku);
        if (!sku || sku.kind === "composite") continue;
        if (s.max_quantity > s.quantity) {
          s.quantity = s.max_quantity;
          filled++;
        }
      }
      return [200, { detail: `${filled} slot dolduruldu.`, filled_count: filled }];
    },
  },
  {
    method: "POST",
    path: "/pos-devices/:sn/assign-template/",
    handler: ({ params, companyId, body }) => {
      const d = findDevice(params.sn, companyId);
      if (!d) return notFound;
      const tpl = (state.db.templates || []).find((t) => t.id === Number(body.template_id) && t.company_id === companyId);
      if (!tpl) return notFound;
      if (tpl.machine_type !== d.pos_odemetip)
        return [400, { detail: `"${tpl.name}" bir ${tpl.machine_type === 1 ? "Kahve" : "Snack"} şablonu; bu cihaz ${d.pos_odemetip === 1 ? "Kahve" : "Snack"} tipinde.` }];
      const before = state.db.deviceItems[d.sn].length;
      state.db.deviceItems[d.sn] = tpl.items.map((it) => ({ id: ++state.db.nextItemId, urun_no: it.urun_no, is_wildcard: it.is_wildcard, name: usesStock(companyId) ? null : it.name, price: it.price, quantity: 0, max_quantity: it.max_quantity, stock_sku: it.stock_sku }));
      d.template_id = tpl.id;
      return [200, { detail: "Şablon atandı.", created: tpl.items.length, updated: 0, deleted: before, skipped: [] }];
    },
  },
  {
    method: "DELETE",
    path: "/pos-devices/:sn/assign-template/",
    handler: ({ params, companyId }) => {
      const d = findDevice(params.sn, companyId);
      if (!d) return notFound;
      d.template_id = null;
      return [200, { detail: "Şablon eşlemesi kaldırıldı." }];
    },
  },
  {
    method: "POST",
    path: "/pos-devices/:sn/save-as-template/",
    handler: ({ params, companyId, body }) => {
      const d = findDevice(params.sn, companyId);
      if (!d) return notFound;
      if (!body.name || !String(body.name).trim()) return [400, { name: ["Bu alan zorunludur."] }];
      const items = state.db.deviceItems[d.sn];
      if (!items.length) return [400, { detail: "Cihazda kaydedilecek ürün yok." }];
      state.db.templates = state.db.templates || [];
      state.db.nextTemplateId = (state.db.nextTemplateId || 100) + 1;
      const tpl = {
        id: state.db.nextTemplateId,
        company_id: companyId,
        name: String(body.name).trim(),
        description: body.description || null,
        machine_type: d.pos_odemetip === 1 ? 1 : 0,
        items: items.map((i, order) => ({ id: ++state.db.nextItemId, urun_no: i.urun_no, is_wildcard: i.is_wildcard, stock_sku: i.stock_sku, name: i.name || (skuById(i.stock_sku) || {}).name || "", price: i.price, max_quantity: i.max_quantity, quantity: 0, order })),
        created_at: iso(now()),
        updated_at: iso(now()),
      };
      state.db.templates.push(tpl);
      return [201, { detail: "Şablon oluşturuldu.", id: tpl.id, name: tpl.name }];
    },
  },
  {
    method: "POST",
    path: "/pos-devices/:sn/collect-cash/",
    handler: ({ params, companyId, user, body }) => {
      if (!has(user, "manage_device_settings")) return [403, { detail: "Yetkiniz yok." }];
      const d = findDevice(params.sn, companyId);
      if (!d) return notFound;
      const last = state.db.cashCollections[d.sn][0];
      const amount = money(
        state.db.transactions[d.sn].filter((t) => t.pt_type === 0 && t.status && (!last || t.pt_datetime > last.datetime)).reduce((s, t) => s + t.amount, 0)
      );
      if (amount <= 0) return [400, { detail: "Toplanacak nakit bulunmamaktadır." }];
      state.db.cashCollections[d.sn].unshift({ id: Date.now(), datetime: now(), amount, notes: body.notes || "", collected_by: user.username });
      return [200, { detail: has(user, "view_sales") ? `${amount.toFixed(2)}₺ nakit toplama işlemi başarıyla kaydedildi.` : "Nakit toplama işlemi başarıyla kaydedildi.", amount_collected: amount }];
    },
  },
  {
    method: "POST",
    path: "/pos-devices/:sn/count-revenue/",
    handler: ({ params, companyId, user, body }) => {
      if (!has(user, "view_sales")) return noSales;
      const d = findDevice(params.sn, companyId);
      if (!d) return notFound;
      const last = state.db.revenueCounts[d.sn][0];
      const txs = state.db.transactions[d.sn].filter((t) => t.status && (!last || t.pt_datetime > last.datetime));
      const total = money(txs.reduce((s, t) => s + t.amount, 0));
      if (total <= 0) return [400, { detail: "Sayılacak ciro bulunmamaktadır." }];
      const by = {};
      for (const t of txs) by[t.pt_type] = money((by[t.pt_type] || 0) + t.amount);
      state.db.revenueCounts[d.sn].unshift({ id: Date.now(), datetime: now(), total_revenue: total, notes: body.notes || "", counted_by: user.username, by });
      return [200, { detail: `${total.toFixed(2)}₺ ciro sayımı kaydedildi.`, total_revenue: total, by_pt_type: by }];
    },
  },
  {
    method: "GET",
    path: "/pos-devices/:sn/cash-history/",
    handler: ({ params, companyId, user, query }) => {
      if (!has(user, "view_sales")) return noSales;
      const d = findDevice(params.sn, companyId);
      if (!d) return notFound;
      const limit = Math.min(Number(query.limit) || 25, 100);
      return [200, { results: state.db.cashCollections[d.sn].slice(0, limit).map((c) => ({ id: c.id, datetime: iso(c.datetime), amount: c.amount, notes: c.notes, collected_by: c.collected_by })) }];
    },
  },
  {
    method: "GET",
    path: "/pos-devices/:sn/revenue-counts/",
    handler: ({ params, companyId, user, query }) => {
      if (!has(user, "view_sales")) return noSales;
      const d = findDevice(params.sn, companyId);
      if (!d) return notFound;
      const limit = Math.min(Number(query.limit) || 25, 100);
      const keys = ["0", "1", "2", "3", "4", "5", "6", "7", "8", "10"];
      return [
        200,
        {
          results: state.db.revenueCounts[d.sn].slice(0, limit).map((c) => ({
            id: c.id,
            datetime: iso(c.datetime),
            total_revenue: c.total_revenue,
            notes: c.notes,
            counted_by: c.counted_by,
            by_pt_type: Object.fromEntries(keys.map((k) => [k, c.by[k] || 0])),
          })),
        },
      ];
    },
  },
];
