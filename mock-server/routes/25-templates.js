/**
 * Ürün şablonları — backend views/product_templates.py + serializers/product_template.py sözleşmesine göre.
 * TÜM VERİLER KURGUSALDIR. Cihaz verisi 20-devices.js'in state.db.devices kaydından okunur.
 */
const state = require("../state");

const iso = (d) => new Date(d).toISOString();
const dec = (n) => (Math.round(Number(n) * 100) / 100).toFixed(2);
const has = (user, perm) => Array.isArray(user && user.permissions) && user.permissions.includes(perm);
const usesStock = (companyId) => !!(state.companies.find((c) => c.id === companyId) || {}).uses_stock_mode;
const skuById = (id) => (state.db.skus || []).find((s) => s.id === Number(id)) || null;
const devices = () => state.db.devices || [];
const forbidden = [403, { detail: "Yetkiniz yok." }];
const notFound = [404, { detail: "Bulunamadı." }];

if (!state.db.templates) {
  state.db.nextTemplateId = state.db.nextTemplateId || 100;
  state.db.nextItemId = state.db.nextItemId || 5_000_000;
  const mk = (name, description, machine_type, companyId, skuIdx) => ({
    id: ++state.db.nextTemplateId,
    company_id: companyId,
    name,
    description,
    machine_type,
    items: skuIdx.map((s, order) => {
      const sku = (state.db.skus || [])[s];
      const stock = usesStock(companyId);
      return {
        id: ++state.db.nextItemId,
        urun_no: order + 1,
        is_wildcard: false,
        stock_sku: stock && sku ? sku.id : null,
        name: sku ? sku.name : `Ürün ${order + 1}`,
        price: dec(sku ? sku.sale_price : 20),
        max_quantity: machine_type === 1 ? 0 : 10,
        quantity: 0,
        order,
      };
    }),
    created_at: iso(Date.now() - 40 * 86400000),
    updated_at: iso(Date.now() - 3 * 86400000),
  });
  state.db.templates = [
    mk("Ofis Snack Standart", "Ofis katları için temel atıştırmalık dizilimi", 0, 1, [0, 1, 2, 3, 5, 6, 7, 8, 9]),
    mk("Fabrika Yemekhane", null, 0, 1, [0, 2, 4, 6, 9, 10, 11]),
    mk("Kahve Menüsü", "Sıcak içecek otomatları", 1, 1, [12, 13, 14, 15]),
  ];
  // Kurgusal eşlemeler
  const snack = devices().filter((d) => d.company_id === 1 && d.pos_odemetip === 0).slice(0, 4);
  snack.forEach((d) => (d.template_id = state.db.templates[0].id));
}

const tplOf = (id, companyId) => state.db.templates.find((t) => t.id === Number(id) && t.company_id === companyId) || null;
const assigned = (tpl) => devices().filter((d) => d.template_id === tpl.id);

function itemOut(it) {
  const sku = it.stock_sku != null ? skuById(it.stock_sku) : null;
  return {
    id: it.id,
    urun_no: it.urun_no,
    is_wildcard: it.is_wildcard,
    stock_sku: it.stock_sku,
    stock_sku_name: sku ? sku.name : undefined,
    stock_sku_code: sku ? sku.sku_code : undefined,
    name: it.name,
    price: it.price,
    max_quantity: it.max_quantity,
    quantity: it.quantity,
    order: it.order,
  };
}

const sortedItems = (tpl) =>
  [...tpl.items].sort((a, b) => Number(a.is_wildcard) - Number(b.is_wildcard) || (a.urun_no || 0) - (b.urun_no || 0) || a.order - b.order);

function listOut(t) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    machine_type: t.machine_type,
    item_count: t.items.length,
    assigned_device_count: assigned(t).length,
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

function detailOut(t) {
  return {
    id: t.id,
    name: t.name,
    description: t.description,
    machine_type: t.machine_type,
    items: sortedItems(t).map(itemOut),
    assigned_devices: assigned(t).map((d) => ({ sn: d.sn, pos_name: d.pos_name })),
    created_at: t.created_at,
    updated_at: t.updated_at,
  };
}

/** Atanmış cihazlara senkron (sync_template_to_assigned_devices) */
function sync(tpl) {
  for (const d of assigned(tpl)) {
    state.db.deviceItems[d.sn] = tpl.items.map((it) => ({
      id: ++state.db.nextItemId,
      urun_no: it.urun_no,
      is_wildcard: it.is_wildcard,
      name: usesStock(d.company_id) ? null : it.name,
      price: it.price,
      quantity: 0,
      max_quantity: it.max_quantity,
      stock_sku: it.stock_sku,
    }));
  }
}

/** _validate_template_item karşılığı */
function validateItem(tpl, body, instance) {
  const errs = {};
  if (!instance || "price" in body) {
    const p = Number(body.price);
    if (body.price == null || body.price === "" || !Number.isFinite(p)) errs.price = ["Geçerli bir sayı giriniz."];
    else if (!/^-?\d{1,6}(\.\d{1,2})?$/.test(String(body.price))) errs.price = ["En fazla 8 basamak ve 2 ondalık girin."];
  }
  if (body.name && String(body.name).length > 50) errs.name = ["En fazla 50 karakter."];
  if (Object.keys(errs).length) return { errors: errs };
  const stock = usesStock(tpl.company_id);
  let skuId = instance ? instance.stock_sku : null;
  let name = (body.name || "").trim();
  if (stock) {
    if (body.stock_sku != null) {
      if (!skuById(body.stock_sku)) return { detail: "Geçersiz SKU." };
      skuId = Number(body.stock_sku);
    }
    if (skuId == null) return { detail: "Stok modunda SKU zorunlu." };
    name = skuById(skuId).name;
  } else if (!name && !instance) return { detail: "Ürün adı zorunlu." };
  const wildcard = stock && (body.is_wildcard ?? (instance ? instance.is_wildcard : false));
  return {
    cleaned: {
      is_wildcard: !!wildcard,
      stock_sku: stock ? skuId : null,
      name: name || (instance ? instance.name : ""),
      urun_no: wildcard ? null : body.urun_no ?? (instance ? instance.urun_no : null),
      price: body.price != null ? dec(body.price) : instance.price,
      max_quantity: Math.max(0, Number(body.max_quantity ?? (instance ? instance.max_quantity : 0)) || 0),
      quantity: Math.max(0, Number(body.quantity ?? (instance ? instance.quantity : 0)) || 0),
      order: Number(body.order ?? (instance ? instance.order : 0)) || 0,
    },
  };
}

module.exports = [
  {
    method: "GET",
    path: "/product-templates/",
    handler: ({ companyId }) => [
      200,
      { results: state.db.templates.filter((t) => t.company_id === companyId).sort((a, b) => a.name.localeCompare(b.name, "tr")).map(listOut) },
    ],
  },
  {
    method: "POST",
    path: "/product-templates/",
    handler: ({ companyId, body }) => {
      if (!body.name || !String(body.name).trim()) return [400, { name: ["Bu alan zorunludur."] }];
      if (String(body.name).length > 100) return [400, { name: ["En fazla 100 karakter."] }];
      if (body.machine_type != null && ![0, 1].includes(body.machine_type)) return [400, { machine_type: ["0 veya 1 olmalı."] }];
      const t = {
        id: ++state.db.nextTemplateId,
        company_id: companyId,
        name: String(body.name).trim(),
        description: (body.description || "").trim() || null,
        machine_type: body.machine_type ?? 0,
        items: [],
        created_at: iso(Date.now()),
        updated_at: iso(Date.now()),
      };
      state.db.templates.push(t);
      return [201, detailOut(t)];
    },
  },
  {
    method: "GET",
    path: "/product-templates/:id/",
    handler: ({ params, companyId }) => {
      const t = tplOf(params.id, companyId);
      return t ? [200, detailOut(t)] : notFound;
    },
  },
  {
    method: "PATCH",
    path: "/product-templates/:id/",
    handler: ({ params, companyId, user, body }) => {
      if (!has(user, "manage_device_settings")) return forbidden;
      const t = tplOf(params.id, companyId);
      if (!t) return notFound;
      if ("name" in body) {
        if (!String(body.name || "").trim()) return [400, { name: ["Bu alan boş bırakılamaz."] }];
        t.name = String(body.name).trim();
      }
      if ("description" in body) t.description = (body.description || "").trim() || null;
      if ("machine_type" in body) {
        if (![0, 1].includes(body.machine_type)) return [400, { machine_type: ["0 veya 1 olmalı."] }];
        if (body.machine_type !== t.machine_type && assigned(t).length)
          return [400, { detail: "Şablon cihazlara eşli; makine tipi değiştirilemez." }];
        t.machine_type = body.machine_type;
      }
      t.updated_at = iso(Date.now());
      return [200, detailOut(t)];
    },
  },
  {
    method: "DELETE",
    path: "/product-templates/:id/",
    handler: ({ params, companyId, user }) => {
      if (!has(user, "manage_device_settings")) return forbidden;
      const t = tplOf(params.id, companyId);
      if (!t) return notFound;
      assigned(t).forEach((d) => (d.template_id = null));
      state.db.templates = state.db.templates.filter((x) => x !== t);
      return [204, undefined];
    },
  },
  {
    method: "GET",
    path: "/product-templates/:id/items/",
    handler: ({ params, companyId }) => {
      const t = tplOf(params.id, companyId);
      return t ? [200, { results: sortedItems(t).map(itemOut) }] : notFound;
    },
  },
  {
    method: "POST",
    path: "/product-templates/:id/items/",
    handler: ({ params, companyId, user, body }) => {
      if (!has(user, "manage_device_settings")) return forbidden;
      const t = tplOf(params.id, companyId);
      if (!t) return notFound;
      if (Array.isArray(body.items)) return [400, { price: ["Bu alan zorunludur."] }]; // toplu gövde desteklenmez
      const r = validateItem(t, body, null);
      if (r.errors) return [400, r.errors];
      if (r.detail) return [400, { detail: r.detail }];
      const item = { id: ++state.db.nextItemId, ...r.cleaned };
      t.items.push(item);
      t.updated_at = iso(Date.now());
      sync(t);
      return [201, itemOut(item)];
    },
  },
  {
    method: "PATCH",
    path: "/product-templates/:id/items/:itemId/",
    handler: ({ params, companyId, user, body }) => {
      if (!has(user, "manage_device_settings")) return forbidden;
      const t = tplOf(params.id, companyId);
      const item = t && t.items.find((i) => i.id === Number(params.itemId));
      if (!item) return notFound;
      const r = validateItem(t, body, item);
      if (r.errors) return [400, r.errors];
      if (r.detail) return [400, { detail: r.detail }];
      Object.assign(item, r.cleaned);
      t.updated_at = iso(Date.now());
      sync(t);
      return [200, itemOut(item)];
    },
  },
  {
    method: "DELETE",
    path: "/product-templates/:id/items/:itemId/",
    handler: ({ params, companyId, user }) => {
      if (!has(user, "manage_device_settings")) return forbidden;
      const t = tplOf(params.id, companyId);
      if (!t || !t.items.some((i) => i.id === Number(params.itemId))) return notFound;
      t.items = t.items.filter((i) => i.id !== Number(params.itemId));
      sync(t);
      return [204, undefined];
    },
  },
  {
    method: "POST",
    path: "/product-templates/:id/assign/",
    handler: ({ params, companyId, user, body }) => {
      if (!has(user, "manage_device_settings")) return forbidden;
      const t = tplOf(params.id, companyId);
      if (!t) return notFound;
      if (!Array.isArray(body.device_sns) || !body.device_sns.length) return [400, { device_sns: ["Bu liste boş olamaz."] }];
      if (!t.items.length) return [400, { detail: "Şablonda ürün bulunmamaktadır." }];
      let success = 0;
      const skipped = [];
      for (const d of devices().filter((x) => x.company_id === companyId && body.device_sns.includes(x.sn))) {
        if (d.pos_odemetip !== t.machine_type) {
          skipped.push(d.pos_name || d.sn);
          continue;
        }
        d.template_id = t.id;
        success++;
      }
      sync(t);
      let detail = `${success} cihaza eşlendi.`;
      if (skipped.length) detail += ` ${skipped.length} cihaz makine tipi uyuşmadığı için atlandı: ${skipped.join(", ")}`;
      return [200, { detail, assigned_count: success, type_mismatch: skipped }];
    },
  },
  {
    method: "POST",
    path: "/product-templates/:id/send/",
    handler: ({ params, companyId, user, body }) => {
      if (!has(user, "manage_device_settings")) return forbidden;
      const t = tplOf(params.id, companyId);
      if (!t) return notFound;
      const d = devices().find((x) => x.sn === body.sn && x.company_id === companyId);
      if (!d) return [404, { detail: "POS cihazı bulunamadı." }];
      if (t.machine_type !== d.pos_odemetip)
        return [400, { detail: `"${t.name}" bir ${t.machine_type === 1 ? "Kahve" : "Snack"} şablonu; bu cihaz ${d.pos_odemetip === 1 ? "Kahve" : "Snack"} tipinde.` }];
      if (!t.items.length) return [400, { detail: "Şablonda ürün yok." }];
      state.db.deviceItems[d.sn] = t.items.map((it) => ({ id: ++state.db.nextItemId, urun_no: it.urun_no, is_wildcard: false, name: it.name, price: it.price, quantity: it.quantity, max_quantity: it.max_quantity, stock_sku: null }));
      return [200, { detail: `${t.items.length} ürün cihaza gönderildi.`, created: t.items.length }];
    },
  },
];
