/**
 * App Store mağaza görselleri: ham simülatör ekranını başlıklı, çerçeveli görsele çevirir (headless Chrome).
 *   node tools/store-shots/render.mjs <ham-klasör> <çıkış-klasör>
 * Ham klasörde iphone-1.png … iphone-7.png ve ipad-1.png … ipad-7.png beklenir.
 * Çıkış boyutları App Store'un istediği tam piksel: iPhone 6,9" 1320×2868, iPad 13" 2064×2752.
 * Google Play için:  node tools/store-shots/render.mjs <ham> <çıkış> play-phone,play-tablet
 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const [rawDir, outDir] = process.argv.slice(2);
if (!rawDir || !outDir) throw new Error("kullanım: render.mjs <ham> <çıkış>");
fs.mkdirSync(outDir, { recursive: true });

const CHROME = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome";

export const CAPTIONS = [
  ["Tüm satışlarınız tek bakışta", "Ciro, işlem ve cihaz durumu; döneme ve konuma göre anlık"],
  ["Bütün POS cihazlarınız cebinizde", "Çevrimiçi durum, son satış ve günlük ciro bir arada"],
  ["Her cihazın performansı net", "Bugün, dün, bu ay ve geçen ay karşılaştırmalı ciro"],
  ["Her satış kayıt altında", "Kart, ödeme tipi, ürün ve dijital fiş tek dokunuşla"],
  ["Ödeme ve ürün istatistikleri", "Hangi ürün, hangi ödeme tipiyle ne kadar satıyor"],
  ["Stok ve dolum kontrolünüzde", "Slot doluluğu, depo ve araçtan hızlı dolum"],
  ["Cihaz ayarları uzaktan", "Ödeme yöntemleri, çalışma saatleri ve cihaz komutları"],
];

const SIZES = {
  iphone: { w: 1320, h: 2868, shotW: 1010, radius: 120, bezel: 34, title: 92, sub: 46, top: 190, gap: 110 },
  ipad: { w: 2064, h: 2752, shotW: 1560, radius: 70, bezel: 40, title: 104, sub: 52, top: 170, gap: 100 },
  // Google Play: telefon 9:16 (öne çıkarma için önerilen 1080×1920), tablet 3:4 (7" ve 10" için aynı görsel)
  "play-phone": { raw: "iphone", w: 1080, h: 1920, shotW: 700, radius: 66, bezel: 22, title: 64, sub: 34, top: 110, gap: 60 },
  "play-tablet": { raw: "ipad", w: 1800, h: 2400, shotW: 1300, radius: 60, bezel: 34, title: 84, sub: 42, top: 140, gap: 80 },
};

function html(kind, i, img) {
  const s = SIZES[kind];
  const [title, sub] = CAPTIONS[i];
  return `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@500;700;800&display=swap" rel="stylesheet">
<style>
  html,body{margin:0;width:${s.w}px;height:${s.h}px;overflow:hidden}
  body{font-family:'Plus Jakarta Sans',sans-serif;background:linear-gradient(160deg,#0B2E55 0%,#134a85 55%,#17589C 100%);position:relative}
  .glow{position:absolute;width:${s.w * 0.9}px;height:${s.w * 0.9}px;border-radius:50%;background:radial-gradient(circle,rgba(237,108,70,.35),rgba(237,108,70,0) 65%);right:-${s.w * 0.35}px;top:${s.h * 0.08}px}
  .glow2{position:absolute;width:${s.w * 0.8}px;height:${s.w * 0.8}px;border-radius:50%;background:radial-gradient(circle,rgba(54,166,221,.35),rgba(54,166,221,0) 65%);left:-${s.w * 0.35}px;bottom:-${s.w * 0.2}px}
  .head{position:relative;text-align:center;padding:${s.top}px ${s.w * 0.08}px 0;color:#fff}
  h1{margin:0;font-size:${s.title}px;line-height:1.12;font-weight:800;letter-spacing:-1.5px}
  p{margin:${s.title * 0.35}px 0 0;font-size:${s.sub}px;line-height:1.35;font-weight:500;color:rgba(255,255,255,.82)}
  .device{position:absolute;left:50%;transform:translateX(-50%);top:${s.top + s.title * 2.3 + s.sub * 2.6 + s.gap}px;width:${s.shotW}px;
    padding:${s.bezel}px;border-radius:${s.radius + s.bezel}px;background:#0b0f17;
    box-shadow:0 60px 120px rgba(0,0,0,.45),0 0 0 4px rgba(255,255,255,.08) inset}
  .device img{display:block;width:100%;border-radius:${s.radius}px}
</style></head><body><div class="glow"></div><div class="glow2"></div>
<div class="head"><h1>${title}</h1><p>${sub}</p></div>
<div class="device"><img src="file://${img}"></div></body></html>`;
}

const KINDS = process.argv[4] ? process.argv[4].split(",") : ["iphone", "ipad"];
for (const kind of KINDS) {
  const s = SIZES[kind];
  for (let i = 0; i < 7; i++) {
    const img = path.resolve(rawDir, `${s.raw ?? kind}-${i + 1}.png`);
    if (!fs.existsSync(img)) {
      console.log("eksik", img);
      continue;
    }
    const page = path.resolve(outDir, `${kind}-${i + 1}.html`);
    fs.writeFileSync(page, html(kind, i, img));
    const out = path.resolve(outDir, `${kind}-${i + 1}.png`);
    execFileSync(CHROME, [
      "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
      "--allow-file-access-from-files", "--virtual-time-budget=4000",
      `--window-size=${s.w},${s.h}`, `--screenshot=${out}`, `file://${page}`,
    ], { stdio: "ignore" });
    fs.unlinkSync(page);
    console.log("ok", out);
  }
}
