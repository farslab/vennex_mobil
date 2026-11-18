/**
 * Stok uçları — backend views/stock.py + serializers/stock.py + services_stock.py sözleşmesine göre.
 * Tüm veriler KURGUSALDIR. Şirket bazlı tutulur (state.db.stock[companyId]).
 *
 * Şekiller:
 *  - SKU para alanları DecimalField → string ("25.00"); miktarlar QuantityField → number (tamsa int).
 *  - Envanter satırı FK `sku`; overview satırı `sku_id`.
 *  - Hareket listeleri {count, page, num_pages, results} (25'lik sabit sayfa).
 */

const PAGE_SIZE = 25;

const LOCATION_TYPE_DISPLAY = { warehouse: "Ana Depo", vehicle: "Araç", depot: "Ara Depo", vending_machine: "Otomat" };
const LOCATION_ORDER = { warehouse: 0, depot: 1, vehicle: 2, vending_machine: 3 };
const KIND_DISPLAY = { simple: "Ürün", composite: "Reçeteli Ürün", ingredient: "Bileşen" };
const UNIT_SHORT = { piece: "adet", gram: "g", ml: "ml" };
const MOVEMENT_DISPLAY = {
  receipt: "Stok Girişi",
  transfer: "Transfer",
  adjustment: "Düzeltme",
  refill: "Dolum",
  consumption: "Satış Tüketimi",
};

const qty = (n) => {
  return Math.round(Number(n) * 1000) / 1000;
};
const money = (n) => Number(n || 0).toFixed(2);
const nowIso = () => new Date().toISOString();

/* ------------------------------------------------------------------ seed */

function seed() {
  const t0 = Date.parse("2026-11-01T08:00:00+03:00");
  const iso = (h) => new Date(t0 + h * 3600_000).toISOString();

  const locations = [
    { id: 1, name: "Merkez Depo", location_type: "warehouse", is_active: true, pos_device: null, pos_device_sn: null },
    { id: 2, name: "Anadolu Ara Depo", location_type: "depot", is_active: true, pos_device: null, pos_device_sn: null },
    { id: 3, name: "Servis Aracı 1", location_type: "vehicle", is_active: true, pos_device: null, pos_device_sn: null },
    { id: 4, name: "Otomat - Kampüs A Blok", location_type: "vending_machine", is_active: true, pos_device: 101, pos_device_sn: "VX-DEMO-1001" },
    { id: 5, name: "Otomat - Plaza Giriş", location_type: "vending_machine", is_active: true, pos_device: 102, pos_device_sn: "VX-DEMO-1002" },
    { id: 6, name: "Eski Sahil Deposu", location_type: "warehouse", is_active: false, pos_device: null, pos_device_sn: null },
  ].map((l) => ({ ...l, created_at: iso(-500), updated_at: iso(-100) }));

  // [ad, kod, tür, birim, alış, satış, kdv, paket boyutu, paket etiketi]
  const raw = [
    ["Su 500 ml", "SU-500", "simple", "piece", 4.5, 10, 20, 24, "24'lü koli"],
    ["Maden Suyu 200 ml", "MSU-200", "simple", "piece", 6, 15, 20, 24, "24'lü koli"],
    ["Kola 330 ml", "KOLA-330", "simple", "piece", 14, 30, 20, 24, "24'lü koli"],
    ["Gazoz 330 ml", "GAZ-330", "simple", "piece", 11, 25, 20, 24, "24'lü koli"],
    ["Soğuk Çay Şeftali", "SCAY-SFT", "simple", "piece", 12, 28, 20, 12, "12'li paket"],
    ["Meyve Suyu Vişne", "MSY-VIS", "simple", "piece", 10, 22, 20, 27, "27'li koli"],
    ["Ayran 250 ml", "AYR-250", "simple", "piece", 7.5, 17.5, 1, 20, "20'li kasa"],
    ["Çikolatalı Gofret", "GOF-CIK", "simple", "piece", 6.25, 15, 10, 36, "36'lı kutu"],
    ["Fındıklı Çikolata 40 g", "CIK-FND", "simple", "piece", 16, 35, 10, 24, "24'lü kutu"],
    ["Patates Cipsi Klasik", "CIPS-KLS", "simple", "piece", 13, 30, 10, 20, "20'li koli"],
    ["Mısır Cipsi Acılı", "CIPS-MSR", "simple", "piece", 13.5, 30, 10, 20, "20'li koli"],
    ["Kraker Susamlı", "KRK-SUS", "simple", "piece", 5, 12.5, 10, 30, "30'lu kutu"],
    ["Bisküvi Kakaolu", "BSK-KKO", "simple", "piece", 7, 17, 10, 24, "24'lü kutu"],
    ["Protein Bar", "BAR-PRT", "simple", "piece", 24, 55, 10, 12, "12'li kutu"],
    ["Sakız Nane", "SKZ-NAN", "simple", "piece", 3, 8, 10, 50, "50'li kutu"],
    ["Filtre Kahve", "SC-FLT", "composite", "piece", 0, 35, 10, 1, ""],
    ["Latte", "SC-LTE", "composite", "piece", 0, 45, 10, 1, ""],
    ["Sıcak Çikolata", "SC-CIK", "composite", "piece", 0, 40, 10, 1, ""],
    ["Çekirdek Kahve", "BIL-KHV", "ingredient", "gram", 0.62, 0, 10, 1000, "1 kg paket"],
    ["Süt Tozu", "BIL-STZ", "ingredient", "gram", 0.31, 0, 10, 1000, "1 kg paket"],
    ["Kakao Tozu", "BIL-KAK", "ingredient", "gram", 0.48, 0, 10, 1000, "1 kg paket"],
    ["Şeker", "BIL-SKR", "ingredient", "gram", 0.04, 0, 1, 5000, "5 kg çuval"],
    ["Karamel Şurubu", "BIL-KRM", "ingredient", "ml", 0.22, 0, 20, 750, "750 ml şişe"],
    ["Karton Bardak 8 oz", "BIL-BRD", "ingredient", "piece", 1.1, 0, 20, 100, "100'lü paket"],
    ["Karıştırıcı Çubuk", "BIL-KRS", "ingredient", "piece", 0.08, 0, 20, 500, "500'lü paket"],
  ];
  const skus = raw.map(([name, sku_code, kind, base_unit, cost, price, vat, pkg, label], i) => ({
    id: i + 1,
    name,
    sku_code,
    barcode: kind === "simple" ? `869000000${String(1000 + i)}` : null,
    unit_cost: kind === "composite" ? 0 : cost,
    sale_price: kind === "ingredient" ? 0 : price,
    vat_rate: vat,
    kind,
    base_unit,
    package_size: pkg,
    package_label: label,
    created_at: iso(-480 + i),
    updated_at: iso(-50 + i),
  }));

  const inventory = new Map();
  const key = (skuId, locId) => `${skuId}:${locId}`;
  for (const s of skus) {
    if (s.kind === "composite") continue;
    const base = s.base_unit === "piece" ? 24 + ((s.id * 37) % 180) : 2000 + ((s.id * 1371) % 15000) + 0.5;
    inventory.set(key(s.id, 1), { id: inventory.size + 1, quantity: qty(base), updated_at: iso(-10) });
    if (s.id % 2 === 0) inventory.set(key(s.id, 2), { id: inventory.size + 1, quantity: qty(base / 4), updated_at: iso(-8) });
    if (s.id % 3 === 0) inventory.set(key(s.id, 3), { id: inventory.size + 1, quantity: s.base_unit === "piece" ? 12 : 850.25, updated_at: iso(-6) });
    if (s.kind === "simple" && s.id % 2 === 1) inventory.set(key(s.id, 4), { id: inventory.size + 1, quantity: s.id % 5, updated_at: iso(-4) });
    if (s.kind === "simple" && s.id % 4 === 0) inventory.set(key(s.id, 5), { id: inventory.size + 1, quantity: 6, updated_at: iso(-4) });
  }
  // Gerçekçi uç durumlar: tükenen ve negatif bakiye (backend negatif stoğu engellemez)
  inventory.set(key(15, 1), { id: inventory.size + 1, quantity: 0, updated_at: iso(-2) });
  inventory.set(key(12, 4), { id: inventory.size + 1, quantity: -2, updated_at: iso(-1) });

  const movements = [];
  const types = ["receipt", "transfer", "refill", "adjustment", "consumption"];
  for (let i = 0; i < 64; i++) {
    const type = types[i % types.length];
    const s = skus.filter((x) => x.kind !== "composite")[(i * 7) % 22];
    const piece = s.base_unit === "piece";
    const q = piece ? 1 + ((i * 5) % 30) : qty(50 + ((i * 113) % 900) + 0.5);
    let from = null;
    let to = null;
    let reason = null;
    if (type === "receipt") to = 1;
    if (type === "transfer") [from, to] = i % 2 ? [1, 3] : [1, 2];
    if (type === "refill") [from, to] = [3, i % 2 ? 4 : 5];
    if (type === "adjustment") {
      if (i % 2) to = 2;
      else from = 1;
    }
    if (type === "consumption") from = i % 2 ? 4 : 5;
    movements.push({
      id: 1000 - i,
      movement_type: type,
      sku: s.id,
      from_location: from,
      to_location: to,
      quantity: q,
      reason,
      created_at: iso(300 - i * 4),
      created_by: type === "consumption" ? null : 1,
      created_by_username: type === "consumption" ? null : i % 3 ? "demo" : "teknisyen",
    });
  }

  return { locations, skus, inventory, movements, seq: { location: 100, sku: 100, movement: 1001, inventory: 500 } };
}

function db(state, companyId) {
  state.db.stock ??= {};
  state.db.stock[companyId] ??= seed();
  return state.db.stock[companyId];
}

/* --------------------------------------------------------------- serializers */

const locById = (d, id) => d.locations.find((l) => l.id === Number(id));
const skuById = (d, id) => d.skus.find((s) => s.id === Number(id));

function serializeLocation(l) {
  return { ...l, location_type_display: LOCATION_TYPE_DISPLAY[l.location_type] };
}

function serializeSku(s) {
  const price = Number(s.sale_price || 0);
  const rate = Number(s.vat_rate || 0);
  const excl = Math.round((price / (1 + rate / 100)) * 100) / 100;
  return {
    id: s.id,
    name: s.name,
    sku_code: s.sku_code,
    barcode: s.barcode,
    unit_cost: money(s.unit_cost),
    kind: s.kind,
    kind_display: KIND_DISPLAY[s.kind],
    base_unit: s.base_unit,
    unit_short: UNIT_SHORT[s.base_unit],
    package_size: qty(s.package_size),
    package_label: s.package_label,
    sale_price: money(s.sale_price),
    vat_rate: money(s.vat_rate),
    sale_price_excl_vat: money(excl),
    vat_amount: money(price - excl),
    created_at: s.created_at,
    updated_at: s.updated_at,
  };
}

function serializeMovement(d, m) {
  const sku = skuById(d, m.sku);
  const from = m.from_location != null ? locById(d, m.from_location) : null;
  const to = m.to_location != null ? locById(d, m.to_location) : null;
  return {
    id: m.id,
    movement_type: m.movement_type,
    movement_type_display: MOVEMENT_DISPLAY[m.movement_type],
    type: m.movement_type,
    sku: m.sku,
    sku_name: sku ? sku.name : null,
    from_location: from ? from.id : null,
    from_location_name: from ? from.name : null,
    from_name: from ? from.name : null,
    to_location: to ? to.id : null,
    to_location_name: to ? to.name : null,
    to_name: to ? to.name : null,
    quantity: qty(m.quantity),
    reason: m.reason,
    created_at: m.created_at,
    datetime: m.created_at,
    created_by: m.created_by,
    created_by_username: m.created_by_username,
  };
}

function paginate(d, list, query) {
  const count = list.length;
  const num_pages = Math.max(1, Math.ceil(count / PAGE_SIZE));
  let page = parseInt(query.page || "1", 10);
  if (!Number.isFinite(page) || page < 1) page = 1;
  if (page > num_pages) page = num_pages; // Django Paginator.get_page davranışı
  const results = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map((m) => serializeMovement(d, m));
  return { count, page, num_pages, results };
}

const sortedMovements = (list) => [...list].sort((a, b) => (a.created_at < b.created_at ? 1 : -1));

/* ------------------------------------------------------------- validation */

function parseQuantity(value, { allowNegative = false } = {}) {
  if (value === undefined || value === null || value === "") return { error: ["Bu alan zorunludur."] };
  const n = Number(String(value).replace(",", "."));
  if (!Number.isFinite(n)) return { error: ["Geçerli bir sayı giriniz."] };
  if (Math.abs(n * 1000 - Math.round(n * 1000)) > 1e-6) return { error: ["Ondalık basamak sayısı 3 basamaktan fazla olmamalı."] };
  if (!allowNegative && n < 0.001) return { error: ["Değerin 0.001 değerinden büyük veya eşit olduğundan emin olun."] };
  return { value: qty(n) };
}

function requireInt(body, field, errors) {
  const v = body[field];
  if (v === undefined || v === null || v === "") errors[field] = ["Bu alan zorunludur."];
  else if (!Number.isInteger(Number(v))) errors[field] = ["Geçerli bir tam sayı girin."];
}

function assertStockable(sku) {
  if (sku.kind === "composite")
    return `"${sku.name}" reçeteli bir üründür; stoğu bileşenlerinden oluşur. Stok hareketini bileşenler üzerinden yapın.`;
  return null;
}

function assertWhole(sku, n) {
  if (sku.base_unit === "piece" && !Number.isInteger(n)) return `"${sku.name}" adet bazlı; kesirli miktar girilemez.`;
  return null;
}

function inv(d, skuId, locId) {
  const k = `${skuId}:${locId}`;
  if (!d.inventory.has(k)) d.inventory.set(k, { id: ++d.seq.inventory, quantity: 0, updated_at: nowIso() });
  return d.inventory.get(k);
}

function addMovement(d, user, m) {
  const mv = {
    id: ++d.seq.movement,
    created_at: nowIso(),
    created_by: user ? user.id : null,
    created_by_username: user ? user.username : null,
    reason: null, // backend view `reason`'ı servise iletmiyor (views/stock.py:436-442) → notes boş
    ...m,
  };
  d.movements.push(mv);
  return mv;
}

function transfer(d, user, body) {
  const errors = {};
  requireInt(body, "from_location_id", errors);
  requireInt(body, "to_location_id", errors);
  requireInt(body, "sku_id", errors);
  const q = parseQuantity(body.quantity);
  if (q.error) errors.quantity = q.error;
  if (Object.keys(errors).length) return [400, errors];
  const from = locById(d, body.from_location_id);
  const to = locById(d, body.to_location_id);
  const sku = skuById(d, body.sku_id);
  if (!(from && to && sku)) return [400, { detail: "Konum veya SKU bulunamadı." }];
  const e = assertStockable(sku) || assertWhole(sku, q.value);
  if (e) return [400, { detail: e }];
  if (to.location_type === "vending_machine")
    return [400, { detail: "Otomata doğrudan transfer yapılamaz. Dolum için POS cihazı sayfasını kullanın." }];
  const src = inv(d, sku.id, from.id);
  if (src.quantity < q.value) return [400, { detail: `Yetersiz stok. Mevcut: ${src.quantity}` }];
  const dst = inv(d, sku.id, to.id);
  src.quantity = qty(src.quantity - q.value);
  dst.quantity = qty(dst.quantity + q.value);
  src.updated_at = dst.updated_at = nowIso();
  const mv = addMovement(d, user, { movement_type: "transfer", sku: sku.id, from_location: from.id, to_location: to.id, quantity: q.value });
  return [201, serializeMovement(d, mv)];
}

function receipt(d, user, body) {
  const errors = {};
  requireInt(body, "to_location_id", errors);
  requireInt(body, "sku_id", errors);
  const q = parseQuantity(body.quantity);
  if (q.error) errors.quantity = q.error;
  if (Object.keys(errors).length) return [400, errors];
  const to = locById(d, body.to_location_id);
  const sku = skuById(d, body.sku_id);
  if (!(to && sku)) return [400, { detail: "Konum veya SKU bulunamadı." }];
  const e = assertStockable(sku) || assertWhole(sku, q.value);
  if (e) return [400, { detail: e }];
  const dst = inv(d, sku.id, to.id);
  dst.quantity = qty(dst.quantity + q.value);
  dst.updated_at = nowIso();
  const mv = addMovement(d, user, { movement_type: "receipt", sku: sku.id, from_location: null, to_location: to.id, quantity: q.value });
  return [201, serializeMovement(d, mv)];
}

function adjustment(d, user, body) {
  const errors = {};
  requireInt(body, "location_id", errors);
  requireInt(body, "sku_id", errors);
  const q = parseQuantity(body.quantity, { allowNegative: true });
  if (q.error) errors.quantity = q.error;
  if (body.reason != null && String(body.reason).length > 200)
    errors.reason = ["Bu alanın 200 karakterden fazla karakter içermediğinden emin olun."];
  if (Object.keys(errors).length) return [400, errors];
  if (q.value === 0) return [400, { detail: "Miktar sıfırdan farklı olmalı." }];
  const loc = locById(d, body.location_id);
  const sku = skuById(d, body.sku_id);
  if (!(loc && sku)) return [400, { detail: "Konum veya SKU bulunamadı." }];
  const e = assertStockable(sku) || assertWhole(sku, q.value);
  if (e) return [400, { detail: e }];
  if (loc.location_type === "vending_machine")
    return [400, { detail: "Otomat lokasyonlarına düzeltme yapılamaz. Düzenlemek için POS cihazı sayfasını kullanın." }];
  const row = inv(d, sku.id, loc.id);
  if (q.value < 0 && row.quantity + q.value < 0) return [400, { detail: `Yetersiz stok. Mevcut: ${row.quantity}` }];
  row.quantity = qty(row.quantity + q.value);
  row.updated_at = nowIso();
  const mv = addMovement(d, user, {
    movement_type: "adjustment",
    sku: sku.id,
    from_location: q.value < 0 ? loc.id : null,
    to_location: q.value > 0 ? loc.id : null,
    quantity: Math.abs(q.value),
  });
  return [201, serializeMovement(d, mv)];
}

function movementsOfType(d, type) {
  return sortedMovements(type ? d.movements.filter((m) => m.movement_type === type) : d.movements);
}

/* ------------------------------------------------------------- SKU write */

function validateSku(body, { partial, instance }) {
  const errors = {};
  const out = {};
  const str = (field, max, required) => {
    if (!(field in body)) {
      if (required && !partial) errors[field] = ["Bu alan zorunludur."];
      return;
    }
    const v = body[field] == null ? "" : String(body[field]);
    if (required && !v.trim()) errors[field] = ["Bu alan boş bırakılamaz."];
    else if (v.length > max) errors[field] = [`Bu alanın ${max} karakterden fazla karakter içermediğinden emin olun.`];
    else out[field] = v.trim();
  };
  str("name", 100, true);
  str("sku_code", 50, true);
  if ("barcode" in body) out.barcode = body.barcode ? String(body.barcode).trim() || null : null;
  const dec = (field, { min, max } = {}) => {
    if (!(field in body)) return;
    const n = Number(body[field]);
    if (!Number.isFinite(n)) errors[field] = ["Geçerli bir sayı giriniz."];
    else if (min != null && n < min) errors[field] = [`Değerin ${min} değerinden büyük veya eşit olduğundan emin olun.`];
    else if (max != null && n > max) errors[field] = [`Değerin ${max} değerinden küçük veya eşit olduğundan emin olun.`];
    else out[field] = n;
  };
  dec("unit_cost");
  dec("sale_price", { min: 0 });
  dec("vat_rate", { min: 0, max: 100 });
  dec("package_size", { min: 0.001 });
  if ("package_label" in body) out.package_label = String(body.package_label || "").trim().slice(0, 40);
  if ("kind" in body) {
    if (!["simple", "composite", "ingredient"].includes(body.kind)) errors.kind = [`"${body.kind}" geçerli bir seçim değil.`];
    else out.kind = body.kind;
  }
  if ("base_unit" in body) {
    if (!["piece", "gram", "ml"].includes(body.base_unit)) errors.base_unit = [`"${body.base_unit}" geçerli bir seçim değil.`];
    else out.base_unit = body.base_unit;
  }
  const kind = out.kind || (instance ? instance.kind : "simple");
  const unit = out.base_unit || (instance ? instance.base_unit : "piece");
  if (!errors.base_unit && (kind === "simple" || kind === "composite") && unit !== "piece")
    errors.base_unit = ["Satılabilir ürünlerin birimi 'Adet' olmalıdır. Gram/mililitre yalnızca bileşenler için kullanılır."];
  return { errors, data: out };
}

/* ------------------------------------------------------------------ routes */

module.exports = [
  {
    method: "GET",
    path: "/stock/overview/",
    handler: ({ state, companyId }) => {
      const d = db(state, companyId);
      const totals = new Map();
      for (const [k, row] of d.inventory) {
        const skuId = Number(k.split(":")[0]);
        const sku = skuById(d, skuId);
        if (!sku || sku.kind === "composite") continue;
        totals.set(skuId, qty((totals.get(skuId) || 0) + row.quantity));
      }
      const results = [...totals.entries()]
        .map(([id, total]) => {
          const s = skuById(d, id);
          return { sku_id: id, sku_name: s.name, sku_code: s.sku_code, total };
        })
        .sort((a, b) => a.sku_name.localeCompare(b.sku_name, "tr"));
      return [200, { results }];
    },
  },

  // sync-vending, :id kalıbından ÖNCE olmalı
  {
    method: "POST",
    path: "/stock/locations/sync-vending/",
    handler: ({ state, companyId }) => {
      const d = db(state, companyId);
      // Kurgusal: şirkette henüz lokasyonu olmayan bir cihaz varmış gibi bir kez oluşturur
      let created = 0;
      if (!d.locations.some((l) => l.pos_device === 103)) {
        d.locations.push({
          id: ++d.seq.location,
          name: "Otomat - Spor Salonu",
          location_type: "vending_machine",
          is_active: true,
          pos_device: 103,
          pos_device_sn: "VX-DEMO-1003",
          created_at: nowIso(),
          updated_at: nowIso(),
        });
        created = 1;
      }
      return [200, { detail: "Senkronizasyon tamamlandı.", created, updated: 0 }];
    },
  },
  {
    method: "GET",
    path: "/stock/locations/",
    handler: ({ state, companyId, query }) => {
      const d = db(state, companyId);
      const activeOnly = query.active_only !== "false";
      const results = d.locations
        .filter((l) => (!activeOnly || l.is_active) && (!query.location_type || l.location_type === query.location_type))
        .sort((a, b) => LOCATION_ORDER[a.location_type] - LOCATION_ORDER[b.location_type] || a.name.localeCompare(b.name, "tr"))
        .map(serializeLocation);
      return [200, { results }];
    },
  },
  {
    method: "POST",
    path: "/stock/locations/",
    handler: ({ state, companyId, body }) => {
      const d = db(state, companyId);
      const errors = {};
      if (!body.name || !String(body.name).trim()) errors.name = ["Bu alan zorunludur."];
      else if (String(body.name).length > 100) errors.name = ["Bu alanın 100 karakterden fazla karakter içermediğinden emin olun."];
      if (!["warehouse", "vehicle", "depot", "vending_machine"].includes(body.location_type))
        errors.location_type = [`"${body.location_type ?? ""}" geçerli bir seçim değil.`];
      if (Object.keys(errors).length) return [400, errors];
      if (body.location_type === "vending_machine")
        return [400, { detail: "Otomat lokasyonları manuel oluşturulamaz, 'sync-vending' kullanın." }];
      const name = String(body.name).trim();
      if (d.locations.some((l) => l.location_type === body.location_type && l.name === name))
        return [500, { detail: "Mock: benzersizlik kısıtı ihlali (backend IntegrityError → 500)." }];
      const loc = {
        id: ++d.seq.location,
        name,
        location_type: body.location_type,
        is_active: body.is_active !== false,
        pos_device: null,
        pos_device_sn: null,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      d.locations.push(loc);
      return [201, serializeLocation(loc)];
    },
  },
  {
    method: "GET",
    path: "/stock/locations/:id/",
    handler: ({ state, companyId, params }) => {
      const loc = locById(db(state, companyId), params.id);
      return loc ? [200, serializeLocation(loc)] : [404, { detail: "Bulunamadı." }];
    },
  },
  {
    method: "PATCH",
    path: "/stock/locations/:id/",
    handler: ({ state, companyId, params, body }) => {
      const loc = locById(db(state, companyId), params.id);
      if (!loc) return [404, { detail: "Bulunamadı." }];
      if (loc.pos_device) return [400, { detail: "Otomat lokasyonları düzenlenemez." }];
      if ("name" in body) {
        if (!String(body.name || "").trim()) return [400, { name: ["Bu alan boş bırakılamaz."] }];
        loc.name = String(body.name).trim();
      }
      if ("location_type" in body) {
        if (!["warehouse", "vehicle", "depot", "vending_machine"].includes(body.location_type))
          return [400, { location_type: [`"${body.location_type}" geçerli bir seçim değil.`] }];
        loc.location_type = body.location_type;
      }
      if ("is_active" in body) loc.is_active = !!body.is_active;
      loc.updated_at = nowIso();
      return [200, serializeLocation(loc)];
    },
  },
  {
    method: "DELETE",
    path: "/stock/locations/:id/",
    handler: ({ state, companyId, params }) => {
      const d = db(state, companyId);
      const loc = locById(d, params.id);
      if (!loc) return [404, { detail: "Bulunamadı." }];
      d.locations = d.locations.filter((l) => l !== loc);
      for (const k of [...d.inventory.keys()]) if (k.endsWith(`:${loc.id}`)) d.inventory.delete(k);
      // StockMovement from/to_location SET_NULL
      for (const m of d.movements) {
        if (m.from_location === loc.id) m.from_location = null;
        if (m.to_location === loc.id) m.to_location = null;
      }
      return [204, undefined];
    },
  },
  {
    method: "GET",
    path: "/stock/locations/:id/inventory/",
    handler: ({ state, companyId, params }) => {
      const d = db(state, companyId);
      const loc = locById(d, params.id);
      if (!loc) return [404, { detail: "Bulunamadı." }];
      const results = [];
      for (const [k, row] of d.inventory) {
        const [skuId, locId] = k.split(":").map(Number);
        if (locId !== loc.id) continue;
        const sku = skuById(d, skuId);
        if (!sku || sku.kind === "composite") continue;
        results.push({
          id: row.id,
          sku: sku.id,
          sku_name: sku.name,
          sku_code: sku.sku_code,
          location: loc.id,
          location_name: loc.name,
          location_type: loc.location_type,
          quantity: qty(row.quantity),
          updated_at: row.updated_at,
        });
      }
      results.sort((a, b) => a.sku_name.localeCompare(b.sku_name, "tr"));
      return [200, { location: serializeLocation(loc), results }];
    },
  },
  {
    method: "GET",
    path: "/stock/locations/:id/movements/",
    handler: ({ state, companyId, params, query }) => {
      const d = db(state, companyId);
      const loc = locById(d, params.id);
      if (!loc) return [404, { detail: "Bulunamadı." }];
      const list = sortedMovements(d.movements.filter((m) => m.from_location === loc.id || m.to_location === loc.id));
      return [200, paginate(d, list, query)];
    },
  },

  {
    method: "GET",
    path: "/stock/skus/",
    handler: ({ state, companyId, query }) => {
      const d = db(state, companyId);
      const q = (query.q || "").trim().toLocaleLowerCase("tr");
      const results = d.skus
        .filter((s) => query.stockable !== "true" || s.kind !== "composite")
        .filter(
          (s) =>
            !q ||
            s.name.toLocaleLowerCase("tr").includes(q) ||
            s.sku_code.toLocaleLowerCase("tr").includes(q) ||
            (s.barcode || "").includes(q)
        )
        .sort((a, b) => a.name.localeCompare(b.name, "tr"))
        .map(serializeSku);
      return [200, { results }];
    },
  },
  {
    method: "POST",
    path: "/stock/skus/",
    handler: ({ state, companyId, body }) => {
      const d = db(state, companyId);
      const { errors, data } = validateSku(body, { partial: false });
      if (Object.keys(errors).length) return [400, errors];
      if (d.skus.some((s) => s.sku_code === data.sku_code)) return [400, { detail: `"${data.sku_code}" SKU kodu zaten kayıtlı.` }];
      const sku = {
        id: ++d.seq.sku,
        name: data.name,
        sku_code: data.sku_code,
        barcode: data.barcode || null,
        kind: data.kind || "simple",
        base_unit: data.base_unit || "piece",
        package_size: data.package_size || 1,
        package_label: data.package_label || "",
        unit_cost: data.unit_cost || 0,
        sale_price: data.sale_price || 0,
        vat_rate: data.vat_rate != null ? data.vat_rate : 20,
        created_at: nowIso(),
        updated_at: nowIso(),
      };
      d.skus.push(sku);
      return [201, serializeSku(sku)];
    },
  },
  {
    method: "GET",
    path: "/stock/skus/:id/",
    handler: ({ state, companyId, params }) => {
      const sku = skuById(db(state, companyId), params.id);
      return sku ? [200, serializeSku(sku)] : [404, { detail: "Bulunamadı." }];
    },
  },
  {
    method: "PATCH",
    path: "/stock/skus/:id/",
    handler: ({ state, companyId, params, body }) => {
      const d = db(state, companyId);
      const sku = skuById(d, params.id);
      if (!sku) return [404, { detail: "Bulunamadı." }];
      const { errors, data } = validateSku(body, { partial: true, instance: sku });
      if (Object.keys(errors).length) return [400, errors];
      if (data.base_unit && data.base_unit !== sku.base_unit) {
        const inUse =
          [...d.inventory.entries()].some(([k, r]) => k.startsWith(`${sku.id}:`) && r.quantity !== 0) ||
          d.movements.some((m) => m.sku === sku.id);
        if (inUse)
          return [
            400,
            { detail: `"${sku.name}" için stok bakiyesi/hareketi var; birim değiştirilemez. Farklı birimde takip için yeni bir SKU açın.` },
          ];
      }
      if (data.sku_code && d.skus.some((s) => s.sku_code === data.sku_code && s.id !== sku.id))
        return [400, { detail: `"${data.sku_code}" SKU kodu başka bir ürüne ait.` }];
      Object.assign(sku, data, { updated_at: nowIso() });
      return [200, serializeSku(sku)];
    },
  },
  {
    method: "DELETE",
    path: "/stock/skus/:id/",
    handler: ({ state, companyId, params }) => {
      const d = db(state, companyId);
      const sku = skuById(d, params.id);
      if (!sku) return [404, { detail: "Bulunamadı." }];
      d.skus = d.skus.filter((s) => s !== sku);
      for (const k of [...d.inventory.keys()]) if (k.startsWith(`${sku.id}:`)) d.inventory.delete(k);
      d.movements = d.movements.filter((m) => m.sku !== sku.id); // CASCADE
      return [204, undefined];
    },
  },

  {
    method: "GET",
    path: "/stock/movements/",
    handler: ({ state, companyId, query }) => {
      const d = db(state, companyId);
      return [200, paginate(d, movementsOfType(d, query.type), query)];
    },
  },
  {
    method: "POST",
    path: "/stock/movements/",
    handler: ({ state, companyId, user, body }) => {
      const d = db(state, companyId);
      if (body.type === "transfer") return transfer(d, user, body);
      if (body.type === "receipt") return receipt(d, user, body);
      if (body.type === "adjustment") return adjustment(d, user, body);
      return [400, { detail: "Geçersiz veya eksik 'type' (transfer|receipt|adjustment)." }];
    },
  },
  { method: "GET", path: "/stock/transfers/", handler: ({ state, companyId, query }) => { const d = db(state, companyId); return [200, paginate(d, movementsOfType(d, "transfer"), query)]; } },
  { method: "POST", path: "/stock/transfers/", handler: ({ state, companyId, user, body }) => transfer(db(state, companyId), user, body) },
  { method: "GET", path: "/stock/receipts/", handler: ({ state, companyId, query }) => { const d = db(state, companyId); return [200, paginate(d, movementsOfType(d, "receipt"), query)]; } },
  { method: "POST", path: "/stock/receipts/", handler: ({ state, companyId, user, body }) => receipt(db(state, companyId), user, body) },
  { method: "GET", path: "/stock/adjustments/", handler: ({ state, companyId, query }) => { const d = db(state, companyId); return [200, paginate(d, movementsOfType(d, "adjustment"), query)]; } },
  { method: "POST", path: "/stock/adjustments/", handler: ({ state, companyId, user, body }) => adjustment(db(state, companyId), user, body) },
];
