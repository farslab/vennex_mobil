#!/usr/bin/env node
/**
 * Vennex TMS — YEREL MOCK BACKEND (yalnızca geliştirme/önizleme/E2E için).
 *
 * Canlı sunucuya (tms.vennex.com.tr) hiçbir koşulda istek atmaz. Yanıt şekilleri
 * docs/API_CONTRACTS.md'deki backend sözleşmesine göre hazırlanmıştır; veriler
 * tamamen KURGUSALDIR ve uygulamada gerçek veri olarak gösterilmez (development
 * ortamında giriş ekranında "GELİŞTİRME ORTAMI" rozeti görünür).
 *
 * Çalıştırma:  npm run mock     (port 4010, MOCK_PORT ile değiştirilebilir)
 * Giriş:       kullanıcı "demo" / şifre "demo1234"   (2FA denemek için: "demo2fa" / "demo1234", kod 123456)
 */
const http = require("http");
const { URL } = require("url");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.MOCK_PORT || 4010);
const PREFIX = "/api/v1/vennexmobile";
const LATENCY_MS = Number(process.env.MOCK_LATENCY || 250);

const state = require("./state");

/** routes/*.js → [{ method, path: "/pos-devices/:sn/", handler(ctx) }] */
const routes = [];
for (const file of fs.readdirSync(path.join(__dirname, "routes")).sort()) {
  if (!file.endsWith(".js")) continue;
  for (const r of require(path.join(__dirname, "routes", file))) {
    const keys = [];
    const pattern = r.path.replace(/:([a-zA-Z_]+)/g, (_, k) => {
      keys.push(k);
      return "([^/]+)";
    });
    routes.push({ ...r, keys, regex: new RegExp(`^${pattern}$`) });
  }
}

function send(res, status, body) {
  const payload = body === undefined ? "" : JSON.stringify(body);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "*",
    "Access-Control-Allow-Methods": "GET,POST,PATCH,PUT,DELETE,OPTIONS",
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try {
        resolve(raw ? JSON.parse(raw) : {});
      } catch {
        resolve({});
      }
    });
  });
}

const PUBLIC = new Set(["/auth/login/", "/auth/2fa/verify/", "/auth/refresh/", "/auth/password-reset/", "/auth/password-reset/confirm/", "/app/min-version/", "/app/ping/"]);

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") return send(res, 204);
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (!url.pathname.startsWith(PREFIX)) return send(res, 404, { detail: "Bulunamadı." });
  const p = url.pathname.slice(PREFIX.length);
  const body = await readBody(req);
  await new Promise((r) => setTimeout(r, LATENCY_MS));

  const isPublic = PUBLIC.has(p) || p.startsWith("/legal/") && req.method === "GET";
  const auth = req.headers.authorization || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  const session = token ? state.sessions.get(token) : null;
  if (!isPublic && !session) return send(res, 401, { detail: "Kimlik bilgileri verilmedi.", code: "token_not_valid" });

  const companyHeader = req.headers["x-company-id"];
  const user = session ? state.users[session.username] : null;
  let companyId = user ? user.companies[0]?.id : null;
  if (companyHeader && user) {
    const cid = Number(companyHeader);
    if (!user.companies.some((c) => c.id === cid)) return send(res, 403, { detail: "Bu şirkete erişiminiz yok." });
    companyId = cid;
  }

  for (const route of routes) {
    if (route.method !== req.method) continue;
    const m = route.regex.exec(p);
    if (!m) continue;
    const params = Object.fromEntries(route.keys.map((k, i) => [k, decodeURIComponent(m[i + 1])]));
    const query = Object.fromEntries(url.searchParams.entries());
    try {
      const [status, json] = await route.handler({ params, query, body, user, companyId, token, state });
      console.log(`${req.method} ${p} → ${status}`);
      return send(res, status, json);
    } catch (e) {
      console.error(e);
      return send(res, 500, { detail: "Mock sunucu hatası." });
    }
  }
  console.log(`${req.method} ${p} → 404 (tanımsız)`);
  send(res, 404, { detail: "Mock sunucuda bu uç tanımlı değil." });
});

server.listen(PORT, () => {
  console.log(`Vennex mock backend: http://localhost:${PORT}${PREFIX}/  (${routes.length} uç)`);
});
