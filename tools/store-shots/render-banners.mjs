/**
 * App Store ürün sayfası "Header" (3840×1646) ve "Search Results" (3840×2560) görselleri.
 *   node tools/store-shots/render-banners.mjs <ham-klasör> <çıkış-klasör>
 * Google Play öne çıkan görseli (1024×500): render-banners.mjs <ham> <çıkış> feature
 * Ham klasörde iphone-1..7.png beklenir (render.mjs ile aynı kaynak). Önemli içerik ortadaki güvenli alanda.
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [rawDir, outDir] = process.argv.slice(2);
if (!rawDir || !outDir) throw new Error("kullanım: render-banners.mjs <ham> <çıkış>");
fs.mkdirSync(outDir, { recursive: true });
const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";
const img = (n) => `file://${path.resolve(rawDir, `iphone-${n}.png`)}`;

const BASE = `
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;overflow:hidden}
  body{font-family:'Plus Jakarta Sans',sans-serif;background:linear-gradient(135deg,#0B2E55 0%,#134a85 55%,#17589C 100%);position:relative;color:#fff}
  .glow{position:absolute;border-radius:50%}
  .phone{background:#0b0f17;box-shadow:0 60px 140px rgba(0,0,0,.5),0 0 0 4px rgba(255,255,255,.08) inset;position:absolute}
  .phone img{display:block;width:100%}
  h1{margin:0;font-weight:800;letter-spacing:-2px;line-height:1.08}
  p{margin:0;font-weight:500;color:rgba(255,255,255,.82);line-height:1.35}
  .brand{display:flex;align-items:center;gap:28px;font-weight:800;letter-spacing:10px;color:rgba(255,255,255,.9)}
</style>`;

const phone = (n, { w, left, top, rot = 0, z = 1 }) => {
  const pad = Math.round(w * 0.035);
  const r = Math.round(w * 0.13);
  return `<div class="phone" style="width:${w}px;left:${left}px;top:${top}px;padding:${pad}px;border-radius:${r + pad}px;transform:rotate(${rot}deg);z-index:${z}">
    <img src="${img(n)}" style="border-radius:${r}px"></div>`;
};

// Header 3840×1646: solda başlık, sağda üç telefon. Telefonlar alt kenardan taşar.
const header = `<!doctype html><html><head><meta charset="utf-8">${BASE}</head>
<body style="width:3840px;height:1646px">
  <div class="glow" style="width:2200px;height:2200px;right:-700px;top:-900px;background:radial-gradient(circle,rgba(237,108,70,.32),rgba(237,108,70,0) 62%)"></div>
  <div class="glow" style="width:1800px;height:1800px;left:-600px;bottom:-1100px;background:radial-gradient(circle,rgba(54,166,221,.30),rgba(54,166,221,0) 62%)"></div>
  <div style="position:absolute;left:520px;top:430px;width:1600px">
    <div class="brand" style="font-size:54px;margin-bottom:56px">VENNEX</div>
    <h1 style="font-size:150px">Otomatlarınız<br>tek uygulamada</h1>
    <p style="font-size:62px;margin-top:52px">Satış, stok ve cihaz durumu anlık. Her yerden, her an.</p>
  </div>
  ${phone(2, { w: 540, left: 2050, top: 400, rot: -6, z: 1 })}
  ${phone(1, { w: 600, left: 2520, top: 250, rot: 0, z: 3 })}
  ${phone(3, { w: 540, left: 3050, top: 400, rot: 6, z: 2 })}
</body></html>`;

// Search Results 3840×2560 (3:2): üst ortada başlık, altta yan yana dört ekran
const search = `<!doctype html><html><head><meta charset="utf-8">${BASE}</head>
<body style="width:3840px;height:2560px">
  <div class="glow" style="width:2600px;height:2600px;right:-900px;top:-1200px;background:radial-gradient(circle,rgba(237,108,70,.30),rgba(237,108,70,0) 62%)"></div>
  <div class="glow" style="width:2400px;height:2400px;left:-900px;bottom:-1400px;background:radial-gradient(circle,rgba(54,166,221,.30),rgba(54,166,221,0) 62%)"></div>
  <div style="position:absolute;left:0;right:0;top:210px;text-align:center">
    <h1 style="font-size:150px">Otomatlarınız tek uygulamada</h1>
    <p style="font-size:66px;margin-top:44px">Satış, stok ve cihaz durumu anlık takipte</p>
  </div>
  ${phone(1, { w: 720, left: 330, top: 760 })}
  ${phone(2, { w: 720, left: 1160, top: 760 })}
  ${phone(4, { w: 720, left: 1990, top: 760 })}
  ${phone(6, { w: 720, left: 2820, top: 760 })}
</body></html>`;

// Google Play "öne çıkan görsel" 1024×500: solda başlık, sağda iki telefon (üst/alt kenardan taşar)
const feature = `<!doctype html><html><head><meta charset="utf-8">${BASE}</head>
<body style="width:1024px;height:500px">
  <div class="glow" style="width:700px;height:700px;right:-220px;top:-300px;background:radial-gradient(circle,rgba(237,108,70,.32),rgba(237,108,70,0) 62%)"></div>
  <div class="glow" style="width:600px;height:600px;left:-220px;bottom:-380px;background:radial-gradient(circle,rgba(54,166,221,.30),rgba(54,166,221,0) 62%)"></div>
  <div style="position:absolute;left:64px;top:150px;width:520px">
    <div class="brand" style="font-size:18px;letter-spacing:6px;margin-bottom:20px">VENNEX</div>
    <h1 style="font-size:50px;letter-spacing:-1px">Otomatlarınız<br>tek uygulamada</h1>
    <p style="font-size:21px;margin-top:18px">Satış, stok ve cihaz durumu anlık.</p>
  </div>
  ${phone(2, { w: 190, left: 610, top: 120, rot: -6, z: 1 })}
  ${phone(1, { w: 210, left: 770, top: 60, rot: 0, z: 2 })}
</body></html>`;

const ONLY = process.argv[4] ? process.argv[4].split(",") : null;
for (const [name, html, w, h] of [
  ["feature-1024x500", feature, 1024, 500],
  ["header-3840x1646", header, 3840, 1646],
  ["search-3840x2560", search, 3840, 2560],
]) {
  if (ONLY && !ONLY.some((k) => name.startsWith(k))) continue;
  const page = path.resolve(outDir, `${name}.html`);
  fs.writeFileSync(page, html);
  const out = path.resolve(outDir, `${name}.png`);
  execFileSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--allow-file-access-from-files", "--virtual-time-budget=5000",
    `--window-size=${w},${h}`, `--screenshot=${out}`, `file://${page}`,
  ], { stdio: "ignore" });
  fs.unlinkSync(page);
  console.log("ok", out);
}
