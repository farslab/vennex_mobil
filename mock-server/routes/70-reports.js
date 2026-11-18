/**
 * Raporlar — backend views/reporting.py sözleşmesine göre (KURGUSAL veri).
 * İş durumu zamanla ilerler: pending (≈3 sn) → running (≈12 sn) → completed.
 * NOT: Mock sunucu yalnız JSON döndürebildiği için /download/ ucu 404 JSON döner
 * (uygulamadaki indirme hata yolu önizlenir). Gerçek backend XLSX döner.
 */

const RETENTION_HOURS = 24;
const USER_REPORT_LIMIT = 20;
const PENDING_MS = 3000;
const RUN_MS = 12000;

const REPORT_TYPES = [
  { value: "pos_summary", label: "Cihaz Bazlı Özet" },
  { value: "pos_detail", label: "Detaylı İşlem Listesi" },
  { value: "nfc_balance_logs", label: "PersonelKart Hareketleri" },
];

function jobs(state, user) {
  state.db.reports = state.db.reports || { seq: 500, byUser: {} };
  const db = state.db.reports;
  if (!db.byUser[user.id]) {
    const now = Date.now();
    db.byUser[user.id] = [
      makeJob(db, { report_type: "pos_summary", custom_name: "Ekim özeti", created: now - 3 * 3600e3, status: "completed", rows: 184 }),
      makeJob(db, { report_type: "pos_detail", custom_name: "", created: now - 26 * 3600e3, status: "completed", rows: 5210, expired: true }),
      makeJob(db, {
        report_type: "pos_detail",
        custom_name: "Hafta içi detay",
        created: now - 5 * 3600e3,
        status: "failed",
        rows: 0,
        error: "Rapor oluşturulurken zaman aşımı oluştu.",
      }),
    ];
  }
  return db.byUser[user.id];
}

function makeJob(db, { report_type, custom_name, created, status, rows, expired, error, filters }) {
  db.seq += 1;
  return {
    id: db.seq,
    report_type,
    custom_name: custom_name || "",
    _status: status || null, // sabit durum (seed); null → zamana göre
    _created: created,
    _rows: rows,
    _error: error || null,
    _expired: !!expired,
    _filters: filters || {},
    download_count: 0,
  };
}

function serialize(j) {
  const now = Date.now();
  let status = j._status;
  if (!status) {
    const age = now - j._created;
    status = age < PENDING_MS ? "pending" : age < PENDING_MS + RUN_MS ? "running" : "completed";
  }
  const progress =
    status === "running" ? Math.min(99, Math.round(((now - j._created - PENDING_MS) / RUN_MS) * 100)) : status === "completed" ? 100 : 0;
  const finished = status === "completed" || status === "failed" || status === "cancelled";
  const finishedAt = finished ? new Date(j._finished || j._created + PENDING_MS + RUN_MS) : null;
  const expiresAt = new Date(j._expired ? now - 3600e3 : j._created + RETENTION_HOURS * 3600e3);
  const active = status === "pending" || status === "running";
  return {
    id: j.id,
    report_type: j.report_type,
    custom_name: j.custom_name,
    status,
    progress_pct: progress,
    row_count: status === "completed" ? j._rows : null,
    estimated_rows: j._rows,
    file_size_bytes: status === "completed" ? 2048 + j._rows * 96 : null,
    error_message: status === "failed" ? j._error : null,
    created_at: new Date(j._created).toISOString(),
    finished_at: finishedAt ? finishedAt.toISOString() : null,
    expires_at: expiresAt.toISOString(),
    is_active: active,
    is_downloadable: status === "completed" && !j._expired,
    download_count: j.download_count,
  };
}

const hasSales = (user) => Array.isArray(user.permissions) && user.permissions.includes("view_sales");
const forbidden = [403, { detail: "Bu işlem için satış görüntüleme yetkiniz yok." }];
const anyActive = (list) => list.some((j) => serialize(j).is_active);

module.exports = [
  {
    method: "GET",
    path: "/reports/",
    handler: ({ state, user }) => {
      if (!hasSales(user)) return forbidden;
      const list = jobs(state, user)
        .slice()
        .sort((a, b) => b._created - a._created)
        .slice(0, USER_REPORT_LIMIT);
      return [200, { retention_hours: RETENTION_HOURS, user_report_limit: USER_REPORT_LIMIT, results: list.map(serialize) }];
    },
  },
  {
    method: "POST",
    path: "/reports/",
    handler: ({ body, state, user }) => {
      if (!hasSales(user)) return forbidden;
      const list = jobs(state, user);
      let type = body.report_type || "pos_detail";
      if (!REPORT_TYPES.some((t) => t.value === type)) type = "pos_detail";
      const re = /^\d{4}-\d{2}-\d{2}$/;
      if (!re.test(body.start_date || "") || !re.test(body.end_date || "")) {
        return [400, { detail: "Başlangıç ve bitiş tarihi YYYY-MM-DD olmalı." }];
      }
      if (body.start_date > body.end_date) return [400, { detail: "Başlangıç tarihi bitişten sonra olamaz." }];
      if (anyActive(list)) return [429, { detail: "Önceki raporunuz hazırlanıyor, lütfen bitmesini bekleyin." }];
      const days = (new Date(body.end_date) - new Date(body.start_date)) / 86400e3 + 1;
      const estimated = type === "pos_summary" ? 6 * Math.ceil(days / 30) * 4 : Math.round(days * 140);
      if (Number(body.min_amount) > 100000) return [404, { detail: "Bu filtrelerle hiç kayıt bulunamadı." }];
      const job = makeJob(state.db.reports, {
        report_type: type,
        custom_name: String(body.custom_name || "").trim().slice(0, 200),
        created: Date.now(),
        rows: estimated,
        filters: body,
      });
      list.push(job);
      return [202, { detail: "Rapor oluşturuldu, durumunu sorgulayabilirsiniz.", job_id: job.id, status: "pending", estimated_rows: estimated }];
    },
  },
  {
    method: "GET",
    path: "/reports/filter-options/",
    handler: ({ state, user }) => {
      if (!hasSales(user)) return forbidden;
      const companies = user.companies.map((c) => ({ id: c.id, name: c.name }));
      return [
        200,
        {
          report_types: REPORT_TYPES,
          companies,
          regions: [
            { id: 1, name: "Kurgusal Bölge A", company_id: companies[0] ? companies[0].id : 1 },
            { id: 2, name: "Kurgusal Bölge B", company_id: companies[0] ? companies[0].id : 1 },
          ],
          locations: [
            { id: 11, name: "Merkez Ofis Lobi", region_id: 1, region_name: "Kurgusal Bölge A" },
            { id: 12, name: "Fabrika Yemekhane", region_id: 1, region_name: "Kurgusal Bölge A" },
            { id: 21, name: "Depo Dinlenme Alanı", region_id: 2, region_name: "Kurgusal Bölge B" },
          ],
          devices: [
            { id: 1, sn: "MOCK0000001", pos_name: "Lobi Otomat 1", company_id: 1, location_id: 11 },
            { id: 2, sn: "MOCK0000002", pos_name: "Lobi Kahve 2", company_id: 1, location_id: 11 },
            { id: 3, sn: "MOCK0000003", pos_name: "Yemekhane Snack", company_id: 1, location_id: 12 },
            { id: 4, sn: "MOCK0000004", pos_name: "Yemekhane Kahve", company_id: 1, location_id: 12 },
            { id: 5, sn: "MOCK0000005", pos_name: "Depo Otomat", company_id: 1, location_id: 21 },
            { id: 6, sn: "MOCK0000006", pos_name: "Depo Soğuk İçecek", company_id: 1, location_id: 21 },
          ],
          has_personel_kart_pos: user.companies.some((c) => c.has_personnel_card_device),
          nfc_sources: [
            { value: "pos", label: "POS" },
            { value: "panel", label: "Yönetim paneli" },
            { value: "mobile", label: "Mobil uygulama" },
          ],
          nfc_operations: [
            { value: "load", label: "Yükleme" },
            { value: "sale", label: "Satış" },
            { value: "refund", label: "İade" },
            { value: "adjust", label: "Düzeltme" },
          ],
        },
      ];
    },
  },
  {
    method: "GET",
    path: "/reports/:id/",
    handler: ({ params, state, user }) => {
      if (!hasSales(user)) return forbidden;
      const j = jobs(state, user).find((x) => x.id === Number(params.id));
      return j ? [200, serialize(j)] : [404, { detail: "Bulunamadı." }];
    },
  },
  {
    method: "DELETE",
    path: "/reports/:id/",
    handler: ({ params, state, user }) => {
      if (!hasSales(user)) return forbidden;
      const list = jobs(state, user);
      const idx = list.findIndex((x) => x.id === Number(params.id));
      if (idx < 0) return [404, { detail: "Bulunamadı." }];
      if (serialize(list[idx]).is_active) return [400, { detail: "Aktif rapor silinemez, önce iptal edin." }];
      list.splice(idx, 1);
      return [204, undefined];
    },
  },
  {
    method: "GET",
    path: "/reports/:id/download/",
    handler: ({ params, state, user }) => {
      if (!hasSales(user)) return forbidden;
      const j = jobs(state, user).find((x) => x.id === Number(params.id));
      if (!j || !serialize(j).is_downloadable) {
        return [404, { detail: "Rapor indirilemez (henüz tamamlanmamış veya süresi dolmuş)." }];
      }
      // Mock sunucu ikili dosya gönderemez → indirme hata yolunu önizlemek için 404
      return [404, { detail: "Mock sunucu XLSX dosyası üretmez (yalnızca önizleme)." }];
    },
  },
  {
    method: "POST",
    path: "/reports/:id/cancel/",
    handler: ({ params, state, user }) => {
      if (!hasSales(user)) return forbidden;
      const j = jobs(state, user).find((x) => x.id === Number(params.id));
      if (!j) return [404, { detail: "Bulunamadı." }];
      if (!serialize(j).is_active) return [400, { detail: "Bu rapor iptal edilemez." }];
      j._status = "cancelled";
      j._finished = Date.now();
      return [200, serialize(j)];
    },
  },
  {
    method: "POST",
    path: "/reports/:id/retry/",
    handler: ({ params, state, user }) => {
      if (!hasSales(user)) return forbidden;
      const list = jobs(state, user);
      const src = list.find((x) => x.id === Number(params.id));
      if (!src) return [404, { detail: "Bulunamadı." }];
      if (anyActive(list)) return [429, { detail: "Önceki raporunuz hazırlanıyor, lütfen bitmesini bekleyin." }];
      const job = makeJob(state.db.reports, {
        report_type: src.report_type,
        custom_name: src.custom_name,
        created: Date.now(),
        rows: src._rows || 120,
        filters: src._filters,
      });
      list.push(job);
      return [202, serialize(job)];
    },
  },
];
