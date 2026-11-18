/**
 * Bildirim inbox'ı — backend views/notifications.py sözleşmesine göre (KURGUSAL veri).
 * Sayfa boyutu 25, `unread=true` filtresi, liste yanıtında `unread_count`.
 */

const PAGE_SIZE = 25;

function seed() {
  const now = Date.now();
  const min = 60000;
  const base = [
    { verb: "Cihaz çevrimdışı", description: "Yemekhane Snack (MOCK0000003) 15 dakikadır çevrimdışı.", data: { event: "device.offline", sn: "MOCK0000003" }, ago: 12 * min, unread: true },
    { verb: "Rapor hazır", description: "“Kasım satışları” raporunuz indirilmeye hazır.", data: { event: "report.ready", url: "https://example.invalid/report" }, ago: 40 * min, unread: true },
    { verb: "Stok azaldı", description: "Lobi Otomat 1 · Slot 12 · Su 0,5 L: 2 adet kaldı.", data: { event: "stock.low", sn: "MOCK0000001", slot: "12", sku_name: "Su 0,5 L", qty: "2" }, ago: 2 * 60 * min, unread: true },
    { verb: "Kart onayı bekliyor", description: "Yeni personel kartı (UID 04A1…) onay bekliyor.", data: { event: "card.pending", card_id: "501", uid: "04A1B2C3" }, ago: 5 * 60 * min, unread: false },
    { verb: "Yeni işlem", description: "Lobi Kahve 2 cihazında ₺42,50 tutarında işlem.", data: { event: "transaction.new", pt_id: "MOCK-TX-1", sn: "MOCK0000002" }, ago: 26 * 60 * min, unread: false },
    { verb: "Cari gecikme", description: "Demo Otomat A.Ş. carisinde vadesi geçmiş fatura var.", data: { event: "cari.overdue", company_id: "1" }, ago: 3 * 24 * 60 * min, unread: false },
    { verb: "Duyuru", description: "Planlı bakım: Pazar 03:00–04:00 arası kısa kesinti olabilir.", data: null, ago: 6 * 24 * 60 * min, unread: false },
  ];
  const list = base.map((n, i) => ({
    id: 1000 + i,
    timestamp: new Date(now - n.ago).toISOString(),
    verb: n.verb,
    description: n.description,
    unread: n.unread,
    actor_str: n.data && n.data.sn ? n.data.sn : "Sistem",
    target_str: null,
    data: n.data,
  }));
  // Sayfalamayı denemek için ek eski kayıtlar
  for (let i = 0; i < 30; i++) {
    list.push({
      id: 2000 + i,
      timestamp: new Date(now - (8 + i) * 24 * 60 * min).toISOString(),
      verb: "Cihaz çevrimdışı",
      description: `Depo Otomat (MOCK0000005) çevrimdışı oldu. (#${i + 1})`,
      unread: false,
      actor_str: "MOCK0000005",
      target_str: null,
      data: { event: "device.offline", sn: "MOCK0000005" },
    });
  }
  return list;
}

function store(state, user) {
  state.db.notifications = state.db.notifications || {};
  if (!state.db.notifications[user.id]) state.db.notifications[user.id] = seed();
  return state.db.notifications[user.id];
}

module.exports = [
  {
    method: "GET",
    path: "/notifications/",
    handler: ({ query, state, user }) => {
      const all = store(state, user);
      const filtered = query.unread === "true" ? all.filter((n) => n.unread) : all;
      const numPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
      const page = Math.min(Math.max(1, Number(query.page) || 1), numPages);
      return [
        200,
        {
          count: filtered.length,
          page,
          num_pages: numPages,
          unread_count: all.filter((n) => n.unread).length,
          results: filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
        },
      ];
    },
  },
  {
    method: "GET",
    path: "/notifications/unread-count/",
    handler: ({ state, user }) => [200, { unread_count: store(state, user).filter((n) => n.unread).length }],
  },
  {
    method: "POST",
    path: "/notifications/:id/read/",
    handler: ({ params, state, user }) => {
      const n = store(state, user).find((x) => x.id === Number(params.id));
      if (!n) return [404, { detail: "Bulunamadı." }];
      n.unread = false;
      return [200, { detail: "Okundu işaretlendi." }];
    },
  },
  {
    method: "POST",
    path: "/notifications/read-all/",
    handler: ({ state, user }) => {
      let count = 0;
      for (const n of store(state, user)) {
        if (n.unread) {
          n.unread = false;
          count++;
        }
      }
      return [200, { detail: `${count} bildirim okundu işaretlendi.`, count }];
    },
  },
];
