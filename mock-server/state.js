/**
 * Mock sunucunun bellek içi durumu. Tüm veriler KURGUSALDIR.
 * Domain dosyaları (routes/*.js) kendi koleksiyonlarını burada `state.db` altında tutar.
 */
const crypto = require("crypto");

const companies = [
  { id: 1, name: "Demo Otomat A.Ş.", cari_state: 0, has_personnel_card_device: true, uses_stock_mode: true },
  { id: 2, name: "Örnek Kafe Ltd.", cari_state: 1, has_personnel_card_device: false, uses_stock_mode: false },
];

const ALL_PERMS = [
  "owner",
  "view_sales",
  "manage_device_settings",
  "select_machine_type",
  "remote_vend",
  "manage_personel_card",
  "change_card_balance",
  "manage_stock",
];

const users = {
  demo: {
    id: 1,
    username: "demo",
    email: "demo@example.com",
    first_name: "Demo",
    last_name: "Kullanıcı",
    phone: "",
    role: "owner",
    permissions: ALL_PERMS,
    pending_legal_docs: [],
    companies,
    password: "demo1234",
    twoFactor: false,
  },
  demo2fa: {
    id: 2,
    username: "demo2fa",
    email: "demo2fa@example.com",
    first_name: "İki",
    last_name: "Adımlı",
    phone: "",
    role: "owner",
    permissions: ALL_PERMS,
    pending_legal_docs: ["kvkk"],
    companies: [companies[0]],
    password: "demo1234",
    twoFactor: true,
  },
  teknisyen: {
    id: 3,
    username: "teknisyen",
    email: "tech@example.com",
    first_name: "Saha",
    last_name: "Teknisyeni",
    phone: "",
    role: "tech",
    permissions: ["tech", "manage_stock"],
    pending_legal_docs: [],
    companies: [companies[0]],
    password: "demo1234",
    twoFactor: false,
  },
};

const sessions = new Map(); // access token → { username }
const refreshTokens = new Map(); // refresh → username
const pending2fa = new Map(); // session_token → { username, attempts }

function token() {
  return crypto.randomBytes(16).toString("hex");
}

function publicUser(u) {
  // eslint-disable-next-line no-unused-vars
  const { password, twoFactor, ...rest } = u;
  return rest;
}

function issueTokens(username) {
  const access = token();
  const refresh = token();
  sessions.set(access, { username });
  refreshTokens.set(refresh, username);
  return { access, refresh, user: publicUser(users[username]) };
}

module.exports = { companies, users, sessions, refreshTokens, pending2fa, token, publicUser, issueTokens, db: {} };
