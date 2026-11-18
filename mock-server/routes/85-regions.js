/**
 * Bölge & konum (owner) — backend views/regions.py + serializers/misc.py sözleşmesine göre.
 *   GET/POST /regions/ · PATCH/DELETE /regions/:id/ · POST /locations/ · PATCH/DELETE /locations/:id/
 * Konum id'leri 20-devices.js'teki cihaz konumlarıyla aynıdır (cihaz sayıları oradan hesaplanır).
 * Veriler KURGUSALDIR.
 */
const state = require("../state");

const forbidden = [403, { detail: "Bu işlemi yapmak için izniniz bulunmuyor." }];
const isOwner = (user) => user && user.role === "owner";

function seed() {
  return {
    seq: { region: 100, location: 100 },
    regions: [
      { id: 1, company_id: 1, name: "İstanbul Avrupa", description: "Plaza ve ofis lokasyonları", created_at: "2026-01-10T09:00:00+03:00" },
      { id: 2, company_id: 1, name: "İstanbul Anadolu", description: "", created_at: "2026-02-03T09:00:00+03:00" },
      { id: 3, company_id: 2, name: "Kafeler", description: "", created_at: "2026-03-01T09:00:00+03:00" },
    ],
    locations: [
      { id: 11, region_id: 1, name: "Merkez Plaza Kat 2", address: "Örnek Mah. Deneme Cad. No: 1", latitude: "41.008200", longitude: "28.978400", is_active: true },
      { id: 12, region_id: 1, name: "Teknopark B Blok", address: "", latitude: null, longitude: null, is_active: true },
      { id: 13, region_id: 2, name: "Organize Sanayi Yemekhane", address: "", latitude: null, longitude: null, is_active: true },
      { id: 14, region_id: 2, name: "Hastane Bekleme Salonu", address: "", latitude: null, longitude: null, is_active: false },
      { id: 21, region_id: 3, name: "Kafe Şube 1", address: "", latitude: null, longitude: null, is_active: true },
      { id: 22, region_id: 3, name: "Kafe Şube 2", address: "", latitude: null, longitude: null, is_active: true },
    ],
  };
}

function db() {
  state.db.regions ??= seed();
  return state.db.regions;
}

const deviceCount = (locId) => (state.db.devices || []).filter((d) => d.location_id === locId).length;

function serializeLocation(l) {
  return {
    id: l.id,
    name: l.name,
    address: l.address,
    latitude: l.latitude,
    longitude: l.longitude,
    is_active: l.is_active,
    pos_device_count: deviceCount(l.id),
  };
}

function serializeRegion(d, r) {
  const locations = d.locations.filter((l) => l.region_id === r.id).map(serializeLocation);
  return {
    id: r.id,
    name: r.name,
    description: r.description,
    total_pos_device_count: locations.reduce((s, l) => s + l.pos_device_count, 0),
    locations,
    created_at: r.created_at,
  };
}

const regionOf = (d, companyId, id) => d.regions.find((r) => r.id === Number(id) && r.company_id === companyId);
const locationOf = (d, companyId, id) => {
  const loc = d.locations.find((l) => l.id === Number(id));
  return loc && regionOf(d, companyId, loc.region_id) ? loc : null;
};

/** DecimalField(9,6) → string ya da null; geçersizse hata */
function coord(v, min, max) {
  if (v == null || v === "") return { value: null };
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) return { error: "Geçerli bir sayı girin." };
  return { value: n.toFixed(6) };
}

function validateLocation(body, partial) {
  const errors = {};
  const out = {};
  if (!partial || "name" in body) {
    const name = String(body.name ?? "").trim();
    if (!name) errors.name = ["Bu alan boş bırakılamaz."];
    else if (name.length > 100) errors.name = ["Bu alanın 100 karakterden fazla karakter içermediğinden emin olun."];
    else out.name = name;
  }
  if ("address" in body) out.address = String(body.address ?? "");
  for (const [k, min, max] of [["latitude", -90, 90], ["longitude", -180, 180]]) {
    if (k in body) {
      const c = coord(body[k], min, max);
      if (c.error) errors[k] = [c.error];
      else out[k] = c.value;
    }
  }
  if ("is_active" in body) out.is_active = body.is_active !== false;
  return { errors, out };
}

module.exports = [
  {
    method: "GET",
    path: "/regions/",
    handler: ({ user, companyId }) => {
      if (!isOwner(user)) return forbidden;
      const d = db();
      const rows = d.regions.filter((r) => r.company_id === companyId).map((r) => serializeRegion(d, r));
      return [200, { results: rows }];
    },
  },
  {
    method: "POST",
    path: "/regions/",
    handler: ({ user, companyId, body }) => {
      if (!isOwner(user)) return forbidden;
      const d = db();
      const name = String(body.name ?? "").trim();
      if (!name) return [400, { name: ["Bu alan boş bırakılamaz."] }];
      if (name.length > 70) return [400, { name: ["Bu alanın 70 karakterden fazla karakter içermediğinden emin olun."] }];
      if (d.regions.some((r) => r.company_id === companyId && r.name === name))
        return [400, { detail: `"${name}" bölgesi zaten mevcut.` }];
      const region = { id: ++d.seq.region, company_id: companyId, name, description: body.description ?? "", created_at: new Date().toISOString() };
      d.regions.push(region);
      return [201, serializeRegion(d, region)];
    },
  },
  {
    method: "PATCH",
    path: "/regions/:id/",
    handler: ({ user, companyId, params, body }) => {
      if (!isOwner(user)) return forbidden;
      const d = db();
      const region = regionOf(d, companyId, params.id);
      if (!region) return [404, { detail: "Bulunamadı." }];
      if ("name" in body) {
        const name = String(body.name ?? "").trim();
        if (!name) return [400, { name: ["Bu alan boş bırakılamaz."] }];
        if (d.regions.some((r) => r !== region && r.company_id === companyId && r.name === name))
          return [400, { detail: `"${name}" bölgesi zaten mevcut.` }];
        region.name = name;
      }
      if ("description" in body) region.description = body.description ?? "";
      return [200, serializeRegion(d, region)];
    },
  },
  {
    method: "DELETE",
    path: "/regions/:id/",
    handler: ({ user, companyId, params }) => {
      if (!isOwner(user)) return forbidden;
      const d = db();
      const region = regionOf(d, companyId, params.id);
      if (!region) return [404, { detail: "Bulunamadı." }];
      const gone = new Set(d.locations.filter((l) => l.region_id === region.id).map((l) => l.id));
      d.locations = d.locations.filter((l) => !gone.has(l.id)); // CASCADE
      for (const dev of state.db.devices || []) if (gone.has(dev.location_id)) dev.location_id = null; // SET_NULL
      d.regions = d.regions.filter((r) => r !== region);
      return [204, undefined];
    },
  },
  {
    method: "POST",
    path: "/locations/",
    handler: ({ user, companyId, body }) => {
      if (!isOwner(user)) return forbidden;
      const d = db();
      const region = regionOf(d, companyId, body.region);
      if (!region) return [400, { region: ["Geçersiz bölge."] }];
      const { errors, out } = validateLocation(body, false);
      if (Object.keys(errors).length) return [400, errors];
      const loc = { id: ++d.seq.location, region_id: region.id, address: "", latitude: null, longitude: null, is_active: true, ...out };
      d.locations.push(loc);
      return [201, serializeLocation(loc)];
    },
  },
  {
    method: "PATCH",
    path: "/locations/:id/",
    handler: ({ user, companyId, params, body }) => {
      if (!isOwner(user)) return forbidden;
      const d = db();
      const loc = locationOf(d, companyId, params.id);
      if (!loc) return [404, { detail: "Bulunamadı." }];
      if ("region" in body) {
        const region = regionOf(d, companyId, body.region);
        if (!region) return [400, { region: ["Geçersiz bölge."] }];
        loc.region_id = region.id;
      }
      const { errors, out } = validateLocation(body, true);
      if (Object.keys(errors).length) return [400, errors];
      Object.assign(loc, out);
      return [200, serializeLocation(loc)];
    },
  },
  {
    method: "DELETE",
    path: "/locations/:id/",
    handler: ({ user, companyId, params }) => {
      if (!isOwner(user)) return forbidden;
      const d = db();
      const loc = locationOf(d, companyId, params.id);
      if (!loc) return [404, { detail: "Bulunamadı." }];
      d.locations = d.locations.filter((l) => l !== loc);
      for (const dev of state.db.devices || []) if (dev.location_id === loc.id) dev.location_id = null;
      return [204, undefined];
    },
  },
];
