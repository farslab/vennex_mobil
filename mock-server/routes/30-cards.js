/**
 * Personel kartları, kart grupları, periyodik bakiye, istihkak ve istihkak yenileme —
 * backend vennex_mobile/views/personnel_cards.py + serializers/personnel_card.py sözleşmesine göre.
 * Tüm veriler KURGUSALDIR (şirket 1: "Demo Otomat A.Ş."). Para alanları DecimalField gibi string döner.
 */
const CARD_PAGE = 30;
const RULE_PAGE = 25;

// 50-users.js ile aynı kurgusal cihaz kimlikleri (users/assignable-options id kaynağı)
const DEVICES = Array.from({ length: 14 }, (_, i) => ({ id: 100 + i, sn: `PAV${240100 + i}`, pos_name: `Otomat ${i + 1}` }));

const FIRST = ["Ayşe", "Mehmet", "Zeynep", "Mustafa", "Elif", "Ahmet", "Fatma", "Emre", "Selin", "Burak", "Deniz", "Cem", "Ece", "Kaan", "Derya"];
const LAST = ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Yıldız", "Aydın", "Öztürk", "Arslan", "Doğan", "Kılıç", "Aslan"];
const QUOTA_PERIODS = { daily: "Günlük", weekly: "Haftalık", monthly: "Aylık", "3month": "3 Aylık", "6month": "6 Aylık", "9month": "9 Aylık", "12month": "12 Aylık" };

const money = (n) => (Math.round(Number(n) * 100) / 100).toFixed(2);
const hex = (n) => n.toString(16).toUpperCase().padStart(2, "0");
const iso = (daysAgo, hour = 9) => {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  d.setHours(hour, 0, 0, 0);
  return d.toISOString();
};
const dateOnly = (daysFromToday) => {
  const d = new Date();
  d.setDate(d.getDate() + daysFromToday);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};
const midnight = (ymd) => new Date(`${ymd}T00:00:00`).toISOString();

function seed() {
  const groups = [
    { id: 1, name: "Merkez Ofis", device_ids: [101, 102, 104] },
    { id: 2, name: "Fabrika Vardiya A", device_ids: [105, 107] },
    { id: 3, name: "Fabrika Vardiya B", device_ids: [105, 107, 108] },
    { id: 4, name: "Misafir", device_ids: [] },
  ].map((g, i) => ({ ...g, created_at: iso(200 - i * 20) }));

  const cards = Array.from({ length: 60 }, (_, i) => {
    const id = 1000 + i;
    const pending = i >= 52;
    const noName = i % 17 === 5;
    return {
      id,
      uid: `04 ${hex((i * 37) % 256)} ${hex((i * 91 + 13) % 256)} ${hex((i * 53 + 7) % 256)}`,
      first_name: noName ? null : FIRST[i % FIRST.length],
      last_name: noName ? null : LAST[(i * 7) % LAST.length],
      balance: money(pending ? 0 : ((i * 137) % 900) + (i % 4) * 0.25),
      customer_no: i % 3 === 0 ? 0 : 5000 + i,
      is_active: !pending,
      created_at: iso(120 - i),
      group_ids: pending ? [] : i % 9 === 0 ? [] : [((i % 4) + 1), ...(i % 10 === 0 ? [4] : [])],
    };
  });

  const recurringBalance = [
    { id: 1, name: "Aylık yemek bakiyesi", amount: "750.00", update_type: "set", period: "monthly", target_type: "group", target_card: null, target_group: 1, is_active: true, start_date: dateOnly(-60), run_count: 2, description: "Her ay başı bakiye sıfırlanıp atanır" },
    { id: 2, name: "Vardiya A haftalık", amount: "150.00", update_type: "add", period: "weekly", target_type: "group", target_card: null, target_group: 2, is_active: true, start_date: dateOnly(-21), run_count: 3, description: null },
    { id: 3, name: "Günlük çay-kahve", amount: "25.50", update_type: "add", period: "daily", target_type: "card", target_card: 1001, target_group: null, is_active: false, start_date: dateOnly(3), run_count: 0, description: null },
  ];

  const quotas = [];
  let qid = 1;
  for (const c of cards.filter((c) => c.is_active).slice(0, 18)) {
    const gid = c.group_ids[0];
    if (!gid) continue;
    quotas.push({ id: qid++, card: c.id, group: gid, product_no: qid % 3 === 0 ? "12" : "*", period: qid % 2 ? "daily" : "monthly", quantity: qid % 2 ? 2 : 20, is_active: true, created_at: iso(30 - qid) });
  }

  const recurringQuota = [
    { id: 1, name: "Vardiya A günlük içecek", group: 2, product_no: "20-40", period: "daily", quantity: 2, target_type: "group", target_card: null, is_active: true, start_date: dateOnly(-10), run_count: 9, description: null },
    { id: 2, name: "Ofis aylık atıştırmalık", group: 1, product_no: "*", period: "monthly", quantity: 15, target_type: "group", target_card: null, is_active: true, start_date: dateOnly(-40), run_count: 1, description: "Ay başında yenilenir" },
  ];

  return { groups, cards, recurringBalance, quotas, recurringQuota, seq: { card: 2000, group: 10, rb: 10, quota: 500, rq: 10 } };
}

function db(state, companyId) {
  state.db.cards = state.db.cards || {};
  if (!state.db.cards[companyId]) {
    state.db.cards[companyId] = companyId === 1 ? seed() : { groups: [], cards: [], recurringBalance: [], quotas: [], recurringQuota: [], seq: { card: 2000, group: 10, rb: 10, quota: 500, rq: 10 } };
  }
  return state.db.cards[companyId];
}

const can = (user, perm) => Array.isArray(user.permissions) && user.permissions.includes(perm);
const forbidden = [403, { detail: "Bu işlem için yetkiniz yok." }];
const notFound = [404, { detail: "Bulunamadı." }];

function paginate(list, query, size) {
  const count = list.length;
  const num_pages = Math.max(1, Math.ceil(count / size));
  let page = parseInt(query.page, 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (page > num_pages) page = num_pages; // Django Paginator.get_page davranışı
  return { count, page, num_pages, results: list.slice((page - 1) * size, page * size) };
}

function groupRef(d, gid) {
  const g = d.groups.find((x) => x.id === gid);
  return g ? { id: g.id, name: g.name, pos_device_ids: [...g.device_ids] } : null;
}

function serializeCard(d, c) {
  const full = [c.first_name, c.last_name].filter(Boolean).join(" ").trim();
  return {
    id: c.id,
    uid: c.uid,
    first_name: c.first_name,
    last_name: c.last_name,
    full_name: full || null,
    balance: c.balance,
    customer_no: c.customer_no,
    is_active: c.is_active,
    created_at: c.created_at,
    groups: c.group_ids.map((gid) => groupRef(d, gid)).filter(Boolean),
  };
}

const activeCount = (d, g) => d.cards.filter((c) => c.is_active && c.group_ids.includes(g.id)).length;
const groupList = (d, g) => ({ id: g.id, name: g.name, active_cards_count: activeCount(d, g), pos_device_count: g.device_ids.length, created_at: g.created_at });
const groupDetail = (d, g) => ({
  id: g.id,
  name: g.name,
  active_cards_count: activeCount(d, g),
  pos_devices: g.device_ids.map((id) => DEVICES.find((x) => x.id === id)).filter(Boolean),
  created_at: g.created_at,
});

function parseAmount(v) {
  const s = typeof v === "number" ? String(v) : typeof v === "string" ? v.trim() : "";
  if (!/^-?\d{1,8}(\.\d{1,2})?$/.test(s)) return null;
  return Number(s);
}
function validDate(v) {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(new Date(v).getTime());
}
function productTokens(raw) {
  const s = (raw || "").trim() || "*";
  const parts = s.split(",").map((p) => p.trim()).filter(Boolean);
  const out = [];
  for (const p of parts) {
    if (p === "*" || /^\d+$/.test(p) || /^\d+-\d+$/.test(p)) out.push(p);
    else return { error: `Geçersiz ürün no "${p}". Format: "*", "12", "1,2,3" veya "20-40".` };
  }
  return { tokens: [...new Set(out)] };
}

const serializeRB = (d, r) => ({
  ...r,
  target_card_uid: r.target_card ? d.cards.find((c) => c.id === r.target_card)?.uid ?? null : null,
  target_group_name: r.target_group ? d.groups.find((g) => g.id === r.target_group)?.name ?? null : null,
  last_run: r.run_count > 0 ? iso(1, 0) : null,
  next_run: r.next_run ?? midnight(r.start_date),
  created_at: r.created_at ?? iso(30),
});
const serializeQuota = (d, q) => ({
  ...q,
  card_uid: d.cards.find((c) => c.id === q.card)?.uid ?? null,
  group_name: d.groups.find((g) => g.id === q.group)?.name ?? null,
  period_display: QUOTA_PERIODS[q.period] ?? q.period,
});
const serializeRQ = (d, r) => ({
  ...r,
  group_name: d.groups.find((g) => g.id === r.group)?.name ?? null,
  period_display: QUOTA_PERIODS[r.period] ?? r.period,
  target_card_uid: r.target_card ? d.cards.find((c) => c.id === r.target_card)?.uid ?? null : null,
  last_run: r.run_count > 0 ? iso(1, 0) : null,
  next_run: r.next_run ?? midnight(r.start_date),
  created_at: r.created_at ?? iso(20),
});

function guard(user) {
  return can(user, "manage_personel_card") ? null : forbidden;
}

function bulkBalance(d, user, body) {
  if (!can(user, "change_card_balance")) return forbidden;
  const ids = Array.isArray(body.card_ids) ? body.card_ids : [];
  if (ids.length === 0) return [400, { card_ids: ["Bu liste boş olamaz."] }];
  const op = body.operation || "add";
  if (!["add", "subtract", "set"].includes(op)) return [400, { operation: [`"${op}" geçerli bir seçim değil.`] }];
  const amount = parseAmount(body.amount);
  if (amount == null) return [400, { amount: ["Geçerli bir sayı giriniz."] }];
  const cards = d.cards.filter((c) => ids.includes(c.id));
  for (const c of cards) {
    const b = Number(c.balance);
    c.balance = money(op === "set" ? amount : op === "subtract" ? Math.max(0, b - amount) : b + amount);
  }
  return [200, { detail: `${cards.length} kart güncellendi.`, count: cards.length }];
}
function bulkDelete(d, body) {
  const ids = Array.isArray(body.card_ids) ? body.card_ids : [];
  if (ids.length === 0) return [400, { card_ids: ["Bu liste boş olamaz."] }];
  const before = d.cards.length;
  d.cards = d.cards.filter((c) => !ids.includes(c.id));
  const deleted = before - d.cards.length;
  return [200, { detail: `${deleted} kart silindi.`, count: deleted }];
}
function bulkGroups(d, body) {
  const ids = Array.isArray(body.card_ids) ? body.card_ids : [];
  const gids = Array.isArray(body.group_ids) ? body.group_ids.filter((g) => d.groups.some((x) => x.id === g)) : [];
  if (ids.length === 0) return [400, { card_ids: ["Bu liste boş olamaz."] }];
  if (!Array.isArray(body.group_ids) || body.group_ids.length === 0) return [400, { group_ids: ["Bu liste boş olamaz."] }];
  const op = body.operation || "add_groups";
  const cards = d.cards.filter((c) => ids.includes(c.id));
  for (const c of cards) {
    c.group_ids = op === "remove_groups" ? c.group_ids.filter((g) => !gids.includes(g)) : [...new Set([...c.group_ids, ...gids])];
  }
  return [200, { detail: `${cards.length} kartın grupları güncellendi.`, count: cards.length }];
}

module.exports = [
  /* ------------------------------------------------------------ kartlar */
  {
    method: "GET",
    path: "/cards/",
    handler: ({ query, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const isActive = query.status !== "pending";
      const q = (query.q || "").trim().toLocaleLowerCase("tr");
      const gid = query.group_id ? Number(query.group_id) : null;
      let list = d.cards.filter((c) => c.is_active === isActive);
      if (q) list = list.filter((c) => [c.uid, c.first_name, c.last_name].some((v) => (v || "").toLocaleLowerCase("tr").includes(q)));
      if (gid) list = list.filter((c) => c.group_ids.includes(gid));
      list = [...list].sort((a, b) => b.created_at.localeCompare(a.created_at));
      const page = paginate(list, query, CARD_PAGE);
      return [
        200,
        {
          count: page.count,
          page: page.page,
          num_pages: page.num_pages,
          page_size: CARD_PAGE,
          active_count: d.cards.filter((c) => c.is_active).length,
          pending_count: d.cards.filter((c) => !c.is_active).length,
          results: page.results.map((c) => serializeCard(d, c)),
        },
      ];
    },
  },
  {
    method: "POST",
    path: "/cards/",
    handler: ({ body, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const uid = typeof body.uid === "string" ? body.uid.trim() : "";
      if (!uid) return [400, { uid: ["Bu alan zorunlu."] }];
      if (uid.length > 50) return [400, { uid: ["Bu alanın 50 karakterden fazla karakter içermediğinden emin olun."] }];
      if (Object.values(state.db.cards).some((x) => x.cards.some((c) => c.uid === uid))) return [400, { detail: `"${uid}" UID zaten kayıtlı.` }];
      let balance = body.balance == null ? 0 : parseAmount(body.balance);
      if (balance == null) return [400, { balance: ["Geçerli bir sayı giriniz."] }];
      if (!can(user, "change_card_balance")) balance = 0;
      const card = {
        id: ++d.seq.card,
        uid,
        first_name: (body.first_name || "").trim() || null,
        last_name: (body.last_name || "").trim() || null,
        balance: money(balance),
        customer_no: Number(body.customer_no) || 0,
        is_active: true,
        created_at: new Date().toISOString(),
        group_ids: (body.group_ids || []).filter((gid) => d.groups.some((x) => x.id === gid)),
      };
      d.cards.push(card);
      return [201, serializeCard(d, card)];
    },
  },
  { method: "POST", path: "/cards/bulk/balance/", handler: ({ body, user, companyId, state }) => guard(user) || bulkBalance(db(state, companyId), user, body) },
  { method: "POST", path: "/cards/bulk/delete/", handler: ({ body, user, companyId, state }) => guard(user) || bulkDelete(db(state, companyId), body) },
  { method: "POST", path: "/cards/bulk/groups/", handler: ({ body, user, companyId, state }) => guard(user) || bulkGroups(db(state, companyId), body) },
  {
    method: "POST",
    path: "/cards/bulk/",
    handler: ({ body, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      if (body.action === "balance") return bulkBalance(d, user, body);
      if (body.action === "delete") return bulkDelete(d, body);
      if (body.action === "groups") return bulkGroups(d, body);
      return [400, { detail: "Geçersiz veya eksik 'action' (balance|delete|groups)." }];
    },
  },
  {
    method: "POST",
    path: "/cards/reject-all-pending/",
    handler: ({ user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const count = d.cards.filter((c) => !c.is_active).length;
      d.cards = d.cards.filter((c) => c.is_active);
      return [200, { detail: `${count} bekleyen kart silindi.`, count }];
    },
  },
  {
    method: "GET",
    path: "/cards/:id/",
    handler: ({ params, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const c = d.cards.find((x) => x.id === Number(params.id));
      return c ? [200, serializeCard(d, c)] : notFound;
    },
  },
  {
    method: "PATCH",
    path: "/cards/:id/",
    handler: ({ params, body, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const c = d.cards.find((x) => x.id === Number(params.id));
      if (!c) return notFound;
      if ("uid" in body) {
        const uid = String(body.uid || "").trim();
        if (!uid) return [400, { uid: ["Bu alan boş bırakılamaz."] }];
        if (d.cards.some((x) => x.uid === uid && x.id !== c.id)) return [400, { detail: `"${uid}" UID başka bir karta ait.` }];
        c.uid = uid;
      }
      for (const k of ["first_name", "last_name"]) if (k in body) c[k] = (body[k] || "").trim() || null;
      if ("customer_no" in body) {
        const n = Number(body.customer_no);
        if (!Number.isInteger(n) || n < 0) return [400, { customer_no: ["Bu değerin 0'a eşit veya daha büyük olduğundan emin olun."] }];
        c.customer_no = n;
      }
      if ("balance" in body && can(user, "change_card_balance")) {
        const b = parseAmount(body.balance);
        if (b == null) return [400, { balance: ["Geçerli bir sayı giriniz."] }];
        c.balance = money(b);
      }
      if (Array.isArray(body.group_ids)) c.group_ids = body.group_ids.filter((gid) => d.groups.some((x) => x.id === gid));
      return [200, serializeCard(d, c)];
    },
  },
  {
    method: "DELETE",
    path: "/cards/:id/",
    handler: ({ params, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const before = d.cards.length;
      d.cards = d.cards.filter((x) => x.id !== Number(params.id));
      return before === d.cards.length ? notFound : [204, undefined];
    },
  },
  {
    method: "POST",
    path: "/cards/:id/approve/",
    handler: ({ params, body, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const c = d.cards.find((x) => x.id === Number(params.id));
      if (!c) return notFound;
      if (body.reverse_uid === true) {
        const parts = c.uid.split(/\s+/);
        if (parts.length > 1) {
          const rev = parts.reverse().join(" ");
          if (d.cards.some((x) => x.uid === rev && x.id !== c.id)) return [400, { detail: "Ters UID başka bir karta ait." }];
          c.uid = rev;
        }
      }
      c.is_active = true;
      return [200, serializeCard(d, c)];
    },
  },
  {
    method: "POST",
    path: "/cards/:id/reject/",
    handler: ({ params, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const before = d.cards.length;
      d.cards = d.cards.filter((x) => x.id !== Number(params.id));
      return before === d.cards.length ? notFound : [200, { detail: "Kart reddedildi." }];
    },
  },
  {
    method: "GET",
    path: "/cards/:id/transactions/",
    handler: ({ params, query, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const c = d.cards.find((x) => x.id === Number(params.id));
      if (!c) return notFound;
      const limit = Math.min(parseInt(query.limit, 10) || 100, 500);
      const total = c.is_active ? (c.id % 7) * 9 + 3 : 0;
      const txs = Array.from({ length: Math.min(total, limit) }, (_, i) => {
        const ok = (c.id + i) % 6 !== 0;
        const dev = DEVICES[(c.id + i) % DEVICES.length];
        const d0 = new Date();
        d0.setHours(d0.getHours() - i * 7);
        return {
          id: c.id * 1000 + i,
          pt_id: `${dev.sn}-${90000 + i}`,
          pt_datetime: d0.toISOString(),
          amount: money(10 + ((c.id + i * 3) % 40)),
          pt_type: 5,
          status: ok,
          iptalNo: ok ? 0 : ((i % 3) + 1),
          product_no: String(10 + (i % 30)),
          pt_pan: c.uid,
          bankRefNo: null,
          display_name: `${dev.pos_name} · Ürün ${10 + (i % 30)}`,
        };
      });
      const success = txs.filter((t) => t.status).length;
      return [200, { card: serializeCard(d, c), transactions: txs, success_count: success, fail_count: txs.length - success }];
    },
  },

  /* ------------------------------------------------------------- gruplar */
  {
    method: "GET",
    path: "/card-groups/",
    handler: ({ query, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const q = (query.q || "").trim().toLocaleLowerCase("tr");
      const list = d.groups
        .filter((x) => !q || x.name.toLocaleLowerCase("tr").includes(q))
        .sort((a, b) => a.name.localeCompare(b.name, "tr"));
      return [200, { results: list.map((x) => groupList(d, x)) }];
    },
  },
  {
    method: "POST",
    path: "/card-groups/",
    handler: ({ body, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return [400, { name: ["Bu alan zorunlu."] }];
      if (name.length > 50) return [400, { name: ["Bu alanın 50 karakterden fazla karakter içermediğinden emin olun."] }];
      if (d.groups.some((x) => x.name === name)) return [400, { detail: `"${name}" grubu zaten mevcut.` }];
      const grp = {
        id: ++d.seq.group,
        name,
        device_ids: (body.pos_device_ids || []).filter((id) => DEVICES.some((x) => x.id === id)),
        created_at: new Date().toISOString(),
      };
      d.groups.push(grp);
      return [201, groupDetail(d, grp)];
    },
  },
  {
    method: "GET",
    path: "/card-groups/:id/",
    handler: ({ params, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const grp = d.groups.find((x) => x.id === Number(params.id));
      return grp ? [200, groupDetail(d, grp)] : notFound;
    },
  },
  {
    method: "PATCH",
    path: "/card-groups/:id/",
    handler: ({ params, body, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const grp = d.groups.find((x) => x.id === Number(params.id));
      if (!grp) return notFound;
      if ("name" in body) {
        const name = String(body.name || "").trim();
        if (!name) return [400, { name: ["Bu alan boş bırakılamaz."] }];
        if (d.groups.some((x) => x.name === name && x.id !== grp.id)) return [400, { detail: `"${name}" grubu zaten mevcut.` }];
        grp.name = name;
      }
      if (Array.isArray(body.pos_device_ids)) grp.device_ids = body.pos_device_ids.filter((id) => DEVICES.some((x) => x.id === id));
      return [200, groupDetail(d, grp)];
    },
  },
  {
    method: "DELETE",
    path: "/card-groups/:id/",
    handler: ({ params, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const gid = Number(params.id);
      if (!d.groups.some((x) => x.id === gid)) return notFound;
      d.groups = d.groups.filter((x) => x.id !== gid);
      for (const c of d.cards) c.group_ids = c.group_ids.filter((x) => x !== gid);
      d.recurringBalance = d.recurringBalance.filter((r) => r.target_group !== gid);
      d.quotas = d.quotas.filter((q) => q.group !== gid);
      d.recurringQuota = d.recurringQuota.filter((r) => r.group !== gid);
      return [204, undefined];
    },
  },

  /* ---------------------------------------------------- periyodik bakiye */
  {
    method: "GET",
    path: "/recurring-balance/",
    handler: ({ query, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const q = (query.q || "").trim().toLocaleLowerCase("tr");
      const list = d.recurringBalance
        .map((r) => serializeRB(d, r))
        .filter((r) => !q || [r.name, r.target_card_uid, r.target_group_name, r.description].some((v) => (v || "").toLocaleLowerCase("tr").includes(q)))
        .sort((a, b) => b.id - a.id);
      return [200, paginate(list, query, RULE_PAGE)];
    },
  },
  {
    method: "POST",
    path: "/recurring-balance/",
    handler: ({ body, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const errors = {};
      if (!body.name || !String(body.name).trim()) errors.name = ["Bu alan zorunlu."];
      if (parseAmount(body.amount) == null) errors.amount = ["Geçerli bir sayı giriniz."];
      if (!["daily", "weekly", "monthly"].includes(body.period)) errors.period = ["Geçerli bir seçim değil."];
      if (!["card", "group"].includes(body.target_type)) errors.target_type = ["Geçerli bir seçim değil."];
      if (!validDate(body.start_date)) errors.start_date = ["Tarih biçimi hatalı. YYYY-MM-DD kullanın."];
      if (Object.keys(errors).length) return [400, errors];
      if (body.target_type === "card" && !d.cards.some((c) => c.id === body.target_card)) return body.target_card ? notFound : [400, { detail: "target_card zorunlu." }];
      if (body.target_type === "group" && !d.groups.some((x) => x.id === body.target_group)) return body.target_group ? notFound : [400, { detail: "target_group zorunlu." }];
      const r = {
        id: ++d.seq.rb,
        name: String(body.name).trim(),
        amount: money(body.amount),
        update_type: body.update_type === "set" ? "set" : "add",
        period: body.period,
        target_type: body.target_type,
        target_card: body.target_type === "card" ? body.target_card : null,
        target_group: body.target_type === "group" ? body.target_group : null,
        is_active: body.is_active !== false,
        start_date: body.start_date,
        run_count: 0,
        description: (body.description || "").trim() || null,
        created_at: new Date().toISOString(),
      };
      r.next_run = midnight(r.start_date);
      d.recurringBalance.push(r);
      return [201, serializeRB(d, r)];
    },
  },
  {
    method: "PATCH",
    path: "/recurring-balance/:id/",
    handler: ({ params, body, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const r = d.recurringBalance.find((x) => x.id === Number(params.id));
      if (!r) return notFound;
      if ("amount" in body) {
        if (parseAmount(body.amount) == null) return [400, { amount: ["Geçerli bir sayı giriniz."] }];
        r.amount = money(body.amount);
      }
      if ("start_date" in body && !validDate(body.start_date)) return [400, { start_date: ["Tarih biçimi hatalı. YYYY-MM-DD kullanın."] }];
      const oldPeriod = r.period;
      for (const k of ["name", "update_type", "period", "is_active", "start_date"]) if (k in body) r[k] = body[k];
      if ("description" in body) r.description = (body.description || "").trim() || null;
      if ("target_type" in body) {
        r.target_type = body.target_type;
        r.target_card = body.target_type === "card" ? body.target_card : null;
        r.target_group = body.target_type === "group" ? body.target_group : null;
      }
      // Backend ile aynı: next_run yalnız periyot değişince/boşken yeniden hesaplanır
      if (!r.next_run || r.period !== oldPeriod) r.next_run = midnight(r.start_date);
      return [200, serializeRB(d, r)];
    },
  },
  {
    method: "DELETE",
    path: "/recurring-balance/:id/",
    handler: ({ params, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const before = d.recurringBalance.length;
      d.recurringBalance = d.recurringBalance.filter((x) => x.id !== Number(params.id));
      return before === d.recurringBalance.length ? notFound : [204, undefined];
    },
  },

  /* ---------------------------------------------------------- istihkak */
  {
    method: "GET",
    path: "/card-quotas/",
    handler: ({ query, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const q = (query.q || "").trim().toLocaleLowerCase("tr");
      let list = d.quotas.map((x) => ({ raw: x, card: d.cards.find((c) => c.id === x.card) }));
      if (q)
        list = list.filter(({ raw, card }) =>
          [card?.uid, card?.first_name, card?.last_name, d.groups.find((x) => x.id === raw.group)?.name].some((v) => (v || "").toLocaleLowerCase("tr").includes(q))
        );
      if (query.group_id) list = list.filter(({ raw }) => raw.group === Number(query.group_id));
      if (query.card_id) list = list.filter(({ raw }) => raw.card === Number(query.card_id));
      const sorted = list.map(({ raw }) => serializeQuota(d, raw)).sort((a, b) => b.id - a.id);
      return [200, paginate(sorted, query, RULE_PAGE)];
    },
  },
  {
    method: "POST",
    path: "/card-quotas/",
    handler: ({ body, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      if (!Number.isInteger(body.card)) return [400, { card: ["Bu alan zorunlu."] }];
      if (!Object.keys(QUOTA_PERIODS).includes(body.period)) return [400, { period: ["Geçerli bir seçim değil."] }];
      const quantity = body.quantity == null ? 1 : body.quantity;
      if (!Number.isInteger(quantity) || quantity < 1) return [400, { quantity: ["Bu değerin 1'e eşit veya daha büyük olduğundan emin olun."] }];
      if (!d.cards.some((c) => c.id === body.card)) return notFound;
      if (!body.group) return [400, { detail: "Grup seçimi zorunludur." }];
      if (!d.groups.some((x) => x.id === body.group)) return notFound;
      const parsed = productTokens(body.product_no);
      if (parsed.error) return [400, { detail: parsed.error }];
      const created_ids = [];
      for (const pno of parsed.tokens) {
        const exists = d.quotas.some((x) => x.card === body.card && x.group === body.group && x.product_no === pno && x.period === body.period);
        if (exists) continue;
        const qd = { id: ++d.seq.quota, card: body.card, group: body.group, product_no: pno, period: body.period, quantity, is_active: body.is_active !== false, created_at: new Date().toISOString() };
        d.quotas.push(qd);
        created_ids.push(qd.id);
      }
      return [201, { detail: `${created_ids.length} kota oluşturuldu.`, created_ids }];
    },
  },
  {
    method: "PATCH",
    path: "/card-quotas/:id/",
    handler: ({ params, body, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const qd = d.quotas.find((x) => x.id === Number(params.id));
      if (!qd) return notFound;
      if ("quantity" in body) {
        if (!Number.isInteger(body.quantity) || body.quantity < 1) return [400, { quantity: ["Bu değerin 1'e eşit veya daha büyük olduğundan emin olun."] }];
        qd.quantity = body.quantity;
      }
      if ("is_active" in body) qd.is_active = body.is_active === true;
      return [200, serializeQuota(d, qd)];
    },
  },
  {
    method: "DELETE",
    path: "/card-quotas/:id/",
    handler: ({ params, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const before = d.quotas.length;
      d.quotas = d.quotas.filter((x) => x.id !== Number(params.id));
      return before === d.quotas.length ? notFound : [204, undefined];
    },
  },

  /* ------------------------------------------------- istihkak yenileme */
  {
    method: "GET",
    path: "/recurring-quota/",
    handler: ({ query, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const q = (query.q || "").trim().toLocaleLowerCase("tr");
      const list = d.recurringQuota
        .map((r) => serializeRQ(d, r))
        .filter((r) => !q || [r.name, r.target_card_uid, r.group_name, r.description].some((v) => (v || "").toLocaleLowerCase("tr").includes(q)))
        .sort((a, b) => b.id - a.id);
      return [200, paginate(list, query, RULE_PAGE)];
    },
  },
  {
    method: "POST",
    path: "/recurring-quota/",
    handler: ({ body, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const errors = {};
      if (!body.name || !String(body.name).trim()) errors.name = ["Bu alan zorunlu."];
      if (!Number.isInteger(body.group)) errors.group = ["Bu alan zorunlu."];
      if (!Object.keys(QUOTA_PERIODS).includes(body.period)) errors.period = ["Geçerli bir seçim değil."];
      if (!validDate(body.start_date)) errors.start_date = ["Tarih biçimi hatalı. YYYY-MM-DD kullanın."];
      const quantity = body.quantity == null ? 1 : body.quantity;
      if (!Number.isInteger(quantity) || quantity < 1) errors.quantity = ["Bu değerin 1'e eşit veya daha büyük olduğundan emin olun."];
      if (Object.keys(errors).length) return [400, errors];
      if (!d.groups.some((x) => x.id === body.group)) return notFound;
      const targetType = body.target_type === "card" ? "card" : "group";
      if (targetType === "card" && !body.target_card) return [400, { detail: "target_card zorunlu." }];
      const parsed = productTokens(body.product_no);
      if (parsed.error) return [400, { detail: parsed.error }];
      const created_ids = parsed.tokens.map((pno) => {
        const r = {
          id: ++d.seq.rq,
          name: String(body.name).trim(),
          group: body.group,
          product_no: pno,
          period: body.period,
          quantity,
          target_type: targetType,
          target_card: targetType === "card" ? body.target_card : null,
          is_active: body.is_active !== false,
          start_date: body.start_date,
          run_count: 0,
          description: (body.description || "").trim() || null,
          created_at: new Date().toISOString(),
        };
        r.next_run = midnight(r.start_date);
        d.recurringQuota.push(r);
        return r.id;
      });
      return [201, { detail: `${created_ids.length} kayıt oluşturuldu.`, created_ids }];
    },
  },
  {
    method: "PATCH",
    path: "/recurring-quota/:id/",
    handler: ({ params, body, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const r = d.recurringQuota.find((x) => x.id === Number(params.id));
      if (!r) return notFound;
      if ("start_date" in body && !validDate(body.start_date)) return [400, { start_date: ["Tarih biçimi hatalı. YYYY-MM-DD kullanın."] }];
      const oldPeriod = r.period;
      for (const k of ["name", "period", "quantity", "is_active", "start_date", "product_no"]) if (k in body) r[k] = body[k];
      if ("description" in body) r.description = (body.description || "").trim() || null;
      if ("target_type" in body) {
        r.target_type = body.target_type;
        if (body.target_type === "card") {
          if (!body.target_card) return [400, { detail: "target_card zorunlu." }];
          r.target_card = body.target_card;
        } else r.target_card = null;
      }
      if (!r.next_run || r.period !== oldPeriod) r.next_run = midnight(r.start_date);
      return [200, serializeRQ(d, r)];
    },
  },
  {
    method: "DELETE",
    path: "/recurring-quota/:id/",
    handler: ({ params, user, companyId, state }) => {
      const g = guard(user);
      if (g) return g;
      const d = db(state, companyId);
      const before = d.recurringQuota.length;
      d.recurringQuota = d.recurringQuota.filter((x) => x.id !== Number(params.id));
      return before === d.recurringQuota.length ? notFound : [204, undefined];
    },
  },
];
