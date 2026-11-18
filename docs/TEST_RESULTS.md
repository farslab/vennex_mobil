# Test Sonuçları — 2026-11-18

Durumlar: **PASS** (çalıştırıldı, geçti) · **FAIL** · **BLOCKED** (çalıştırılamadı) · **NOT TESTED**.
Canlı sunucuya (`tms.vennex.com.tr`) hiçbir test isteği atılmadı.

## Özet

| Katman | Sonuç | Kanıt |
|---|---|---|
| TypeScript (`tsc --noEmit`, strict) | **PASS**: 0 hata | `npm run typecheck` |
| ESLint | **PASS**: 0 hata (başlangıç: 18 hata / 166 uyarı → 11 uyarı, tamamı eski/miras dosyalarda) | `npm run lint` |
| Mobil unit + bileşen + ekran (Jest) | **PASS**: **722/722**, 61 dosya | `npx jest --forceExit` |
| Backend (Django, yerel izole DB) | **PASS**: **123/123** (`vennex_mobile` + geri bildirim/herkese açık sayfalar, `dashboard_v2`, `nexus`, `api.test_ota_runtime`) | `../backend-local/run.sh test …` |
| E2E: gerçek backend kodu + iOS simülatör (Maestro + simülatör) | **PASS**: 4 akış (uzaktan satış WebSocket dahil) | aşağıda |
| E2E: yerel mock sunucu akışları (`01`, `02`) | **NOT TESTED** (son hâli): ilk sürüm mock'a göre yazıldı; asıl doğrulama gerçek backend akışlarıyla yapıldı | |
| Görsel tur (açık + koyu tema) | **PASS** (ana ekranlar), bkz. aşağıdaki not | `e2e/maestro/90_visual_tour.yaml` |
| Canlı sunucu (salt okuma) | **BLOCKED**: canlı hesaba ait şifreyi yazmak güvenlik kuralı gereği yapılmadı; giriş kullanıcı tarafından yapılırsa salt okuma turu yürütülebilir | |
| Android | **NOT TESTED**: yalnız iOS simülatörde çalıştırıldı | |
| Release build (iOS simülatör) | **PASS**: `tr.com.vennex` Release derlemesi; soğuk açılış ~1,77 sn; giriş, panel ve geri bildirim gönderimi (`15_release_check.yaml`) | PERFORMANCE_AUDIT |
| Release build (gerçek cihaz) | **NOT TESTED** | |

## Üçüncü tur ek testleri (2026-11-18)

- Testsiz 23 ekran/sayfaya **196 test** (stok 58, cihaz 52, kart/kullanıcı/rapor 86) + kaydedilmemiş değişiklik (4), iç içe sayfa (1), KPI (1), geri bildirim (5), istemci hata dönüşümü (1).
- Bu testlerin bulduğu ve düzeltilen gerçek hatalar: nakit toplama/ciro sayımı çift POST, özel sıralama çift POST, şablon formunda görünmeyen hata, SKU türü değişince kalan eski hatalar, silinen raporun yeniden istenmesi, istihkak toplu sayfasının açık bağlanınca boş başlaması, `message` alanı hata dönüşümü.
- Kararsızlık: makine yükündeyken ilk testlerde 5 sn zaman aşımı → `testTimeout: 20000`.

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
| `12_remote_vend.yaml` + `backend-local/sim_vend.py` | **PASS** (Maestro + simülatörde elle tamamlandı) | Uvicorn/ASGI üzerinde gerçek `DashboardPosConsumer`: sayfa açılır → "Bağlı" → otomat simülatörü `vend_pending` (₺12,50, ürün 7) → onay → simülatör `remote_decision (approve)` alır → `vend_ended: success` → "Satış başarılı — ürün verildi." Teknisyen (yetkisiz) ve geçersiz token bağlantıları reddedilir |
| `15_release_check.yaml` (Release) | **PASS** | 3 soğuk açılış, "Şifremi unuttum" yok + yönetici yönlendirmesi, giriş → panel (gerçek veri), Profil → Geri bildirim → gönder → geçmişte "Yeni"; kayıt DB'de doğru kullanıcı/şirket/platform/sürümle |
| `13_regions.yaml` | **PASS** (Maestro + simülatörde elle tamamlandı) | Profil → Bölge ve konumlar → bölge oluştur → konum ekle (liste anında güncellenir) → silme onayı etkisini açıklar → sil; kayıt kalmaz. API: aynı ad 400, teknisyen 403, `regions` modülü `/app/config/`'ten |
| Firebase'li iOS derlemesi | **PASS** | RN Firebase 27 + `useFrameworks: "dynamic"`, `com.vennex.mobile`, simülatörde açılır |

### Görsel denetimde bulunup düzeltilenler

| Bulgu | Düzeltme |
|---|---|
| Grafik ekseni "₺1.00…" diye kesiliyordu | `formatCurrencyAxis` (₺500, ₺1,5 B) + test |
| Yeniden kurulumda Keychain'deki eski oturum açılıyordu | Yeni kurulum kontrolü + test (SECURITY S15) |

### Notlar

- Maestro, erişilebilirlik etiketi birleştirilmiş satırların (cihaz satırı, şirket seçici) içindeki metni ayrı göremiyor. Akışlarda `id` veya regex seçici kullanılmalı. Bu bir uygulama hatası değil.
- Görsel turun Kartlar adımı, seçili şirkette Kartlar modülü olmadığında beklendiği gibi durur.
- Xcode 26.3 / iOS 18.5'te Maestro'nun XCUITest sürücüsü uzun akışlarda zaman zaman kopuyor (`Connection refused`). Akışların kalan adımları simülatörde aynı sırayla elle tamamlandı; uygulama tarafında hata yok. CI'da akış başına yeniden deneme önerilir.
- Push bildirimi teslimi simülatörde doğrulanamaz (gerçek FCM/APNs gerekir). Kayıt/izin/yönlendirme mantığı birim testlerle (7) doğrulandı; gerçek cihazda kontrol edilmeli.

## Backend testleri

| Paket | Test | Sonuç |
|---|---|---|
| `vennex_mobile.test_app_config` (yeni) | 16 | PASS: kayıt tutarlılığı, varsayılan RED, şirkete göre modül, enum'lar, `/app/config/` (401/403/şekil), sürüm politikası, OTA uygulama ayrımı ve mobil yayında POS bildirimi olmaması |
| `vennex_mobile.test_security_fixes` (yeni) | 9 | PASS: token iptali (çıkış yapılmış token'ın dirilmemesi dahil), 2FA kilidi, personel parola kuralları, stok 400 hataları, düzeltme nedeni |
| Mevcut `vennex_mobile`, `dashboard_v2`, `nexus`, `api.test_ota_runtime` | 82 | PASS (gerileme yok) |
