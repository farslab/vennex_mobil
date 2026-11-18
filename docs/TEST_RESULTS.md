# Test Sonuçları — 2026-11-18

Durumlar: **PASS** (çalıştırıldı, geçti) · **FAIL** · **BLOCKED** (çalıştırılamadı) · **NOT TESTED**.
Canlı sunucuya (`tms.vennex.com.tr`) hiçbir test isteği atılmadı.

## Özet

| Katman | Sonuç | Kanıt |
|---|---|---|
| TypeScript (`tsc --noEmit`, strict) | **PASS**: 0 hata | `npm run typecheck` |
| ESLint | **PASS**: 0 hata (başlangıç: 18 hata / 166 uyarı → az sayıda uyarı) | `npm run lint` |
| Mobil unit + bileşen + ekran (Jest) | **PASS**: **485/485**, 47 dosya | `npx jest --forceExit` |
| Backend (Django, yerel izole DB) | **PASS**: **107/107** (`vennex_mobile`, `dashboard_v2`, `nexus`, `api.test_ota_runtime`) | `../backend-local/run.sh test …` |
| E2E: gerçek backend kodu + iOS simülatör (Maestro) | **PASS**: 2 akış | aşağıda |
| E2E: yerel mock sunucu akışları (`01`, `02`) | **NOT TESTED** (son hâli): ilk sürüm mock'a göre yazıldı; asıl doğrulama gerçek backend akışlarıyla yapıldı | |
| Görsel tur (açık + koyu tema) | **PASS** (ana ekranlar), bkz. aşağıdaki not | `e2e/maestro/90_visual_tour.yaml` |
| Canlı sunucu (salt okuma) | **BLOCKED**: canlı hesaba ait şifreyi yazmak güvenlik kuralı gereği yapılmadı; giriş kullanıcı tarafından yapılırsa salt okuma turu yürütülebilir | |
| Android | **NOT TESTED**: yalnız iOS simülatörde çalıştırıldı | |
| Release build performans ölçümü | **NOT TESTED** | |

## Mobil test dağılımı (Jest)

| Alan | Dosya | Test |
|---|---|---|
| api (client, sayfalama, kartlar, stok, kullanıcılar, overview, appConfig/OTA) | 8 | 112 |
| auth (yetki modeli, varsayılan RED) | 1 | 7 |
| design-system (bileşenler, tema, WCAG kontrast) | 1 | 27 |
| store (auth akışı, şirket seçimi, yeni kurulum, retry) | 2 | 30 |
| utils (para, Türkçe ondalık, tarih, metin) | 2 | 57 |
| screens/auth | 3 | 15 |
| screens/dashboard | 2 | 17 |
| screens/devices (liste, detay, şablonlar) + components/devices | 6 | 67 |
| screens/cards (+ bileşen/hook) | 5 | 45 |
| screens/stock | 3 | 26 |
| screens/reports | 3 | 26 |
| screens/notifications | 2 | 12 |
| screens/account, profile, users, legal | 9 | 44 |

Kapsanan negatif senaryolar: ağ yok, zaman aşımı, 401 + refresh başarılı/başarısız, eşzamanlı 401 (tek refresh), 403, 404, 429, 500, boş/null/bozuk alanlar, yetkisiz kullanıcı, çift dokunma, erişimi olmayan şirket, şirket değişimi, çevrimdışı açılış, yeniden kurulumda eski oturum, OTA ağ hatası, sürüm politikası yokken engellememe.

## E2E — gerçek backend kodu (yerel izole veritabanı, kurgusal veri)

Ortam: `scc_lith` `feature/mobil-ortak-yetki-ota` dalı, Postgres 17 (`vennex_local`), seed: 2 şirket, 12 cihaz, 7.771 işlem, 40 kart, 3 kullanıcı. iOS 18.5 simülatör (iPhone 16 Pro), development derlemesi.

| Akış | Sonuç | Doğrulanan |
|---|---|---|
| `10_backend_company_modules.yaml` | **PASS** | Temiz kurulum → giriş → sunucunun `/app/config/` modülleri (Kartlar + Stok) → şirket değişimi → Kartlar sekmesi sunucu kararıyla gizlenir → uygulama yeniden başlatılınca oturum ve şirket seçimi korunur |
| `11_force_update.yaml` | **PASS** | Admin politikası `min_version=9.0.0` → uygulama "Güncelleme gerekli" ekranında kilitlenir; mağaza butonu ve yüklü sürüm görünür |
| Panel (gerçek hesaplama) | **PASS** (görsel) | KPI'lar (129 işlem, ₺3.715), saatlik ciro grafiği, başarısızlık nedenleri, ödeme tipi dağılımı, en çok satan cihazlar, son işlemler |
| Cihaz listesi → detay | **PASS** (görsel) | Sunucu tarafı sayaçlar, ciro, son iletişim; detay sekmeleri; dönem ciroları (bugün/dün/bu ay/geçen ay) |
| Kartlar, Stok, Profil, Raporlar, Bildirimler | **PASS** (görsel) | Boş/dolu durumlar, sekmeler |

### Görsel denetimde bulunup düzeltilenler

| Bulgu | Düzeltme |
|---|---|
| Grafik ekseni "₺1.00…" diye kesiliyordu | `formatCurrencyAxis` (₺500, ₺1,5 B) + test |
| Yeniden kurulumda Keychain'deki eski oturum açılıyordu | Yeni kurulum kontrolü + test (SECURITY S15) |

### Notlar

- Maestro, erişilebilirlik etiketi birleştirilmiş satırların (cihaz satırı, şirket seçici) içindeki metni ayrı göremiyor. Akışlarda `id` veya regex seçici kullanılmalı. Bu bir uygulama hatası değil.
- Görsel turun Kartlar adımı, seçili şirkette Kartlar modülü olmadığında beklendiği gibi durur.

## Backend testleri

| Paket | Test | Sonuç |
|---|---|---|
| `vennex_mobile.test_app_config` (yeni) | 16 | PASS: kayıt tutarlılığı, varsayılan RED, şirkete göre modül, enum'lar, `/app/config/` (401/403/şekil), sürüm politikası, OTA uygulama ayrımı ve mobil yayında POS bildirimi olmaması |
| `vennex_mobile.test_security_fixes` (yeni) | 9 | PASS: token iptali (çıkış yapılmış token'ın dirilmemesi dahil), 2FA kilidi, personel parola kuralları, stok 400 hataları, düzeltme nedeni |
| Mevcut `vennex_mobile`, `dashboard_v2`, `nexus`, `api.test_ota_runtime` | 82 | PASS (gerileme yok) |
