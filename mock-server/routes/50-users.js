/**
 * Personel (tech) kullanıcı yönetimi — backend views/users.py sözleşmesine göre (tümü IsOwner).
 * Veriler KURGUSALDIR.
 */
const PAGE_SIZE = 25;
const AVAILABLE_GROUPS = ["Cihaz Ayarları", "Personel Kart", "Satış Görüntüleme", "Stok Yönetimi"];
const ALWAYS_AVAILABLE = ["Satış Görüntüleme", "Personel Kart"];

const POS_DEVICES = Array.from({ length: 14 }, (_, i) => ({
  id: 100 + i,
  sn: `PAV${String(240100 + i)}`,
  pos_name: `Otomat ${i + 1}`,
  company_name: i % 3 === 0 ? "Örnek Kafe Ltd." : "Demo Otomat A.Ş.",
  location_name: ["Merkez Ofis", "Fabrika", "Kampüs", null][i % 4],
}));

const STOCK_LOCATIONS = [
  { id: 1, name: "Merkez Depo", location_type: "warehouse" },
  { id: 2, name: "Servis Aracı 34 ABC 12", location_type: "vehicle" },
  { id: 3, name: "Kampüs Ara Depo", location_type: "depot" },
];

const FIRST = ["Ahmet", "Ayşe", "Mehmet", "Zeynep", "Can", "Elif", "Burak", "Selin", "Emre", "Derya", "Kerem", "Gizem"];
const LAST = ["Yılmaz", "Kaya", "Demir", "Şahin", "Çelik", "Aydın", "Öztürk", "Arslan", "Doğan", "Koç"];

function seed(state) {
  if (state.db.staff) return state.db.staff;
  state.db.staffSeq = 500;
  state.db.staff = Array.from({ length: 31 }, (_, i) => {
    const first = FIRST[i % FIRST.length];
    const last = LAST[(i * 3) % LAST.length];
    return {
      id: 400 + i,
      username: `${first}.${last}`.toLocaleLowerCase("tr-TR").replace(/ı/g, "i").replace(/[şŞ]/g, "s").replace(/[çÇ]/g, "c").replace(/[öÖ]/g, "o").replace(/[üÜ]/g, "u").replace(/[ğĞ]/g, "g") + (i >= FIRST.length ? i : ""),
      first_name: first,
      last_name: last,
      email: i % 4 === 0 ? "" : `teknisyen${i}@example.com`,
      phone: i % 3 === 0 ? "" : `0532${String(1000000 + i * 7919).slice(0, 7)}`,
      is_active: i % 9 !== 4,
      group_names: AVAILABLE_GROUPS.filter((_, g) => (i + g) % 3 === 0),
      pos_device_ids: POS_DEVICES.filter((_, d) => (i + d) % 5 === 0).map((d) => d.id),
      default_stock_location_ids: i % 2 === 0 ? [STOCK_LOCATIONS[i % 3].id] : [],
      password: "teknisyen123",
    };
  });
  return state.db.staff;
}

function serialize(u) {
  return {
    id: u.id,
    username: u.username,
    first_name: u.first_name,
    last_name: u.last_name,
    email: u.email || "",
    phone: u.phone || "",
    is_active: u.is_active,
    group_names: u.group_names,
    pos_devices: POS_DEVICES.filter((d) => u.pos_device_ids.includes(d.id)).map(({ id, sn, pos_name }) => ({ id, sn, pos_name })),
    default_stock_locations: STOCK_LOCATIONS.filter((l) => u.default_stock_location_ids.includes(l.id)),
  };
}

const forbidden = [403, { detail: "Bu işlemi yapmak için izniniz bulunmuyor." }];
const isOwner = (user) => user && user.role === "owner";
const validGroups = (names) => (Array.isArray(names) ? names.filter((n) => AVAILABLE_GROUPS.includes(n)) : []);
const validDevices = (ids) => (Array.isArray(ids) ? ids.filter((id) => POS_DEVICES.some((d) => d.id === id)) : []);
const validLocations = (ids) => (Array.isArray(ids) ? ids.filter((id) => STOCK_LOCATIONS.some((l) => l.id === id)) : []);

function validateFields(body) {
  const errors = {};
  if (body.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)) errors.email = ["Geçerli bir e-posta adresi girin."];
  if (body.phone && String(body.phone).length > 20) errors.phone = ["Bu alanın 20 karakterden fazla karakter içermediğinden emin olun."];
  return errors;
}

module.exports = [
  // Not: assignable-options, :id rotasından ÖNCE tanımlanmalı (ilk eşleşen kazanır)
  {
    method: "GET",
    path: "/users/assignable-options/",
    handler: ({ user }) => {
      if (!isOwner(user)) return forbidden;
      return [
        200,
        {
          available_groups: AVAILABLE_GROUPS,
          always_available_groups: ALWAYS_AVAILABLE,
          pos_devices: POS_DEVICES,
          stock_locations: STOCK_LOCATIONS,
          regions: [
            { id: 1, name: "İstanbul Avrupa" },
            { id: 2, name: "İstanbul Anadolu" },
          ],
        },
      ];
    },
  },
  {
    method: "GET",
    path: "/users/",
    handler: ({ user, state, query }) => {
      if (!isOwner(user)) return forbidden;
      const all = seed(state)
        .slice()
        .sort((a, b) => a.username.localeCompare(b.username));
      const num_pages = Math.max(1, Math.ceil(all.length / PAGE_SIZE));
      const page = Math.min(Math.max(1, Number(query.page) || 1), num_pages);
      const results = all.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE).map(serialize);
      return [200, { count: all.length, page, num_pages, results }];
    },
  },
  {
    method: "POST",
    path: "/users/",
    handler: ({ user, state, body }) => {
      if (!isOwner(user)) return forbidden;
      const staff = seed(state);
      if (!body.username) return [400, { username: ["Bu alan zorunlu."] }];
      const username = String(body.username).trim();
      const password = body.password || "";
      if (!password) return [400, { detail: "password zorunlu." }];
      if (password.length < 6) return [400, { password: ["Bu alanın en az 6 karakter içerdiğinden emin olun."] }];
      const errors = validateFields(body);
      if (Object.keys(errors).length) return [400, errors];
      if (staff.some((u) => u.username === username) || state.users[username])
        return [400, { detail: `"${username}" kullanıcı adı zaten kullanılıyor.` }];
      const created = {
        id: ++state.db.staffSeq,
        username,
        first_name: (body.first_name || "").trim(),
        last_name: (body.last_name || "").trim(),
        email: (body.email || "").trim(),
        phone: (body.phone || "").trim(),
        is_active: true,
        group_names: validGroups(body.group_names),
        pos_device_ids: validDevices(body.pos_device_ids),
        default_stock_location_ids: validLocations(body.default_stock_location_ids),
        password,
      };
      staff.push(created);
      return [201, serialize(created)];
    },
  },
  {
    method: "GET",
    path: "/users/:id/",
    handler: ({ user, state, params }) => {
      if (!isOwner(user)) return forbidden;
      const found = seed(state).find((u) => u.id === Number(params.id));
      return found ? [200, serialize(found)] : [404, { detail: "Bulunamadı." }];
    },
  },
  {
    method: "PATCH",
    path: "/users/:id/",
    handler: ({ user, state, params, body }) => {
      if (!isOwner(user)) return forbidden;
      const found = seed(state).find((u) => u.id === Number(params.id));
      if (!found) return [404, { detail: "Bulunamadı." }];
      const errors = validateFields(body);
      if (Object.keys(errors).length) return [400, errors];
      for (const k of ["first_name", "last_name", "email"]) if (k in body) found[k] = (body[k] || "").trim();
      if ("phone" in body) found.phone = (body.phone || "").trim();
      if ("pos_device_ids" in body) found.pos_device_ids = validDevices(body.pos_device_ids);
      if ("group_names" in body) {
        // Owner'ın yönetemediği gruplar korunur (views/users.py:147-151)
        const kept = found.group_names.filter((g) => !AVAILABLE_GROUPS.includes(g));
        found.group_names = [...kept, ...validGroups(body.group_names)];
      }
      if ("default_stock_location_ids" in body) found.default_stock_location_ids = validLocations(body.default_stock_location_ids);
      return [200, serialize(found)];
    },
  },
  {
    method: "DELETE",
    path: "/users/:id/",
    handler: ({ user, state, params }) => {
      if (!isOwner(user)) return forbidden;
      const staff = seed(state);
      const idx = staff.findIndex((u) => u.id === Number(params.id));
      if (idx < 0) return [404, { detail: "Bulunamadı." }];
      staff.splice(idx, 1);
      return [204, undefined];
    },
  },
  {
    method: "POST",
    path: "/users/:id/reset-password/",
    handler: ({ user, state, params, body }) => {
      if (!isOwner(user)) return forbidden;
      const found = seed(state).find((u) => u.id === Number(params.id));
      if (!found) return [404, { detail: "Bulunamadı." }];
      if (!body.new_password || body.new_password.length < 6)
        return [400, { new_password: ["Bu alanın en az 6 karakter içerdiğinden emin olun."] }];
      found.password = body.new_password;
      return [200, { detail: "Şifre güncellendi." }];
    },
  },
];
