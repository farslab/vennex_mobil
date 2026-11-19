# Test Sonuçları — 2026-11-19 (5. tur)

Durumlar: **PASS** (çalıştırıldı, geçti) · **FAIL** · **BLOCKED** (çalıştırılamadı) · **NOT TESTED**.
Canlı sunucuya (`tms.vennex.com.tr`) hiçbir test isteği atılmadı.

## Özet

| Katman | Sonuç | Kanıt |
|---|---|---|
| TypeScript (`tsc --noEmit`, strict) | **PASS**: 0 hata | `npm run typecheck` |
| ESLint | **PASS**: 0 hata (başlangıç: 18 hata / 166 uyarı → 11 uyarı, tamamı eski/miras dosyalarda) | `npm run lint` |
| Mobil unit + bileşen + ekran (Jest) | **PASS**: **746/746**, 66 dosya (İstanbul, New York, Tokyo saat dilimlerinde) | `npx jest --forceExit` |
| Backend (Django, yerel izole DB) | **PASS**: **168/168** (`vennex_mobile` + geri bildirim/herkese açık sayfalar, `dashboard_v2`, `nexus`, `api.test_ota_runtime`) | `../backend-local/run.sh test …` |
| E2E: gerçek backend kodu + iOS simülatör (Maestro + simülatör) | **PASS**: 4 akış (uzaktan satış WebSocket dahil) + **dördüncü turda 10 kullanıcı yolculuğu ve 4 negatif senaryo** (Release derleme, DB doğrulamalı) | aşağıda |
| iPad (iPad Pro 13" M4) ve büyük yazı (iPhone 16e, erişilebilirlik boyutu) | **PASS** (düzeltme sonrası), bkz. dördüncü tur | ekran görüntüleri |
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

## Beşinci tur — canlı salt-okuma doğrulaması ve web paritesi (2026-11-19)

### Canlı (tms.vennex.com.tr) — yalnız serpetco, yalnız GET
Yöntem:
- Sunucu konteynerinde süreç içi istemciyle mobil API'nin 40 GET ucu çağrıldı. Kimlik kısa ömürlü access token'dı; şifre kullanılmadı, oturum açılmadı, refresh token kaydı oluşturulmadı.
- Sonuçlar webin tanımıyla aynı bağımsız ORM toplamlarıyla karşılaştırıldı: yalnız başarılı işlem, Türkiye gün sınırları.
- Betik: `backend-local/live_readonly_check.py`.
- Kayıt oluşturan tek GET (bildirim tercihleri, kayıt yoksa oluşturur) listeden çıkarıldı.

| Kontrol | Sonuç |
|---|---|
| 40 GET ucu (sahip rolü) | **PASS**: hiçbiri 403/500 dönmedi |
| Panel KPI (bugün, dün, bu ay, son 30 gün) | **PASS**: mobil ciro = ORM ciro (ör. bu ay ₺923,60; son 30 gün ₺4.939,60) |
| 13 cihazın bugün/dün/bu ay cirosu | **PASS**: 0 uyuşmazlık |
| Cihaz sayısı, çevrimiçi/çevrimdışı | **PASS**: 13; 0/13 (son 10 dakikada görülen cihaz yok) |
| Kart sayıları | **PASS**: aktif 41 / bekleyen 0 = ORM |
| Rapor seçenekleri | **PASS**: 13 cihaz, yalnız serpetco, PersonelKart açık |
| Yavaş uçlar (canlı, tek istek) | **FAIL → backend dalında düzeltildi** (canlıya alınınca yeniden ölçülecek): stok hareketleri 5,3 sn; cihaz listesi 1,5 sn; kart işlemleri 0,86 sn; cari özet 237 SQL |

Uygulama arayüzüyle canlı tur **BLOCKED**: canlı hesaba ait şifreyi asistan yazmaz (güvenlik kuralı). Giriş kullanıcı tarafından yapılınca salt okuma turu yürütülecek.

### Büyük veri (yerel, kurgusal)
Veri: 400 cihaz, yaklaşık 598 bin işlem, 20 bin kart, 60 bin bakiye kaydı, 300 SKU, 60 stok lokasyonu, 20 bin hareket, 3 bin bildirim (`backend-local/seed_large.py`). Ölçüm: önbellek boşken (`backend-local/bench_mobile_api.py`).
- Sayfalı uçlar sabit 25–30 kayıt döndürüyor.
- En yavaş uç Panel "bu ay": 554 ms.
- Sayfasız büyük yanıtlar: SKU listesi 118 KB (artık aramada en fazla 50 sonuç), atanabilir seçenekler 50 KB, rapor filtre seçenekleri 40 KB. Bunlar mobilde sanallaştırılmış seçicide gösteriliyor.

### E2E (Release derleme + parite dalındaki backend kodu, yerel DB)

| Akış | Sonuç | Doğrulanan |
|---|---|---|
| `30_report_filters_parity` | **PASS** | Detay + Son 7 gün + Anadolu bölgesi + Başarısız → oluşan iş: `company_id=3`, `transaction_status=false`, bölgedeki 9 cihaz. Üretilen rapor **48 satır = ORM başarısız işlem sayısı** (düzeltmeden önce aynı seçim 812 satırlık tüm işlemleri verirdi) |
| `31_excel_exports` | **PASS** | Cihaz listesi ve stok özeti Excel: sunucu 200, paylaşım sayfası açılır (cihaz listesi ucu yol düzeltmesinden önce 404 dönüyordu) |
| `32_card_balance_logs` | **PASS** | Kart detayında bakiye hareketleri: "+₺12,50" yükleme kaydı, toplam sayaç |
| Regresyon `20`–`28` | **PASS** (10/10) | Önceki tüm yolculuklar yeni backend ve uygulamayla yeniden. `26` ilk koşuda tohumlamada silinen test bildirimi yüzünden kaldı; bildirim yeniden oluşturulunca geçti (uygulama hatası değil) |

### Web paritesi denetimi (kod düzeyinde, 3 bağımsız denetim)
Bulunan ve düzeltilen başlıca hatalar:
- Rapor filtrelerinin sessizce yok sayılması (durum ve şirket/bölge/konum).
- Yetkisiz kullanıcıya ciro verisi gönderilmesi (backend).
- Yetkisiz kullanıcıya şablon ve periyodik bakiye yazma imkânı (backend).
- 403 dönen butonlar (şablonlar, grup işlemleri).
- Webde izin verilip mobilde kapalı işlemler: nakit toplama, özel sıralama.
- Kart geçmişinin webden farklı kaynaktan gelmesi.
- Grup istihkakının binlerce istekle yapılması.
- Sonsuz listede sayfa düşmesi.
- Saat dilimi kayması.
- Ayrıntı: CHANGELOG "Beşinci tur", BACKEND_CHANGES "Üçüncü dal".

### Canlıya alma sonrası doğrulama (2026-11-19)
- Backend dalı canlıda; yalnız web konteyneri yeniden başlatıldı.
- `live_readonly_check.py` (serpetco, yalnız GET): 41/41 uç 200, 200 dışı yanıt 0. Panel 4 dönem ORM ile aynı, cihaz özetlerinde 0 uyuşmazlık, kartlar 41/41.
- Stok hareketleri 5,3 sn → 71 ms, cihaz listesi 1,5 sn → 190 ms, cari özeti 237 SQL → 2 SQL.
- Panel (önbellek ısındıktan sonra): 0,2–0,5 sn.

### Canlı arayüz turu (2026-11-19, serpetco sahibi, yalnız okuma)
Release derleme canlı API'ye (`tms.vennex.com.tr`) bağlandı, giriş kullanıcı tarafından yapıldı. Hiçbir kayıt değiştirilmedi; bildirim açılmadı, cihaza komut gönderilmedi.

| Ekran | Ekranda | Veritabanı | Sonuç |
|---|---|---|---|
| Panel · Geçen Ay | ₺4.018,71 · 114 işlem / 73 başarılı / 41 başarısız · önceki ay ₺4.373,42 | aynı | AYNI |
| Panel · Son 30 Gün | ₺4.939,60 · 191 / 167 / 24 · önceki 30 gün ₺6,93 | aynı (başlangıç 20.10, web ile aynı tanım) | AYNI |
| Panel · Bu Ay ödeme tipleri | Nakit ₺780,00 (47) · Personel Kart ₺114,66 (15) · Kredi/Banka ₺28,94 (60) | aynı | AYNI |
| Panel · başarısızlık nedenleri | Banka reddi 11 · Teknik hata 7 | iptalNo 2 → 11, 3 → 7 | AYNI |
| Panel · en çok satan | ₺785,60 / 103 · ₺138,00 / 19 | toplam ₺923,60 / 122 | AYNI |
| Cihaz listesi | 13 cihaz · son iletişim · doluluk | aynı | AYNI |
| Cihaz detayı · Satışlar (Bu ay) | 36 / 19 / 17 · ₺138,00 · saatler TR | aynı | AYNI |
| Cihaz detayı · İstatistikler | Bu ay ₺138,00 · geçen ay ₺5,40 · %2.455,6 | aynı | AYNI |
| Kartlar | Aktif 41 / bekleyen 0 · ilk 7 satırın bakiye, son 4 hane ve grupları | aynı | AYNI |
| Kart detayı · bakiye hareketleri | 30 kayıt · ilk 4 satış · "Yeni Değer" (−₺97,80) | aynı | AYNI |
| Stok özeti | 24 ürün · 0 tükenen · 0 negatif · 6 ürünün toplamı | aynı | AYNI |
| Stok hareketleri | 215 (tüketim hariç) · en yeni 27.07 14:19 | aynı | AYNI |
| Bildirimler | 31 okunmamış · en yeni "Ödeme hatası", 18 gün önce | 83 toplam / 31 okunmamış | AYNI |

Turda bulunan ve düzeltilen iki sorun:
1. **Kahve otomatında doluluk "—" görünüyordu.** Cihaz listesi %96 gösterirken detayın Genel ve Stok sekmelerinde doluluk "—" çıkıyordu. Sebep: sunucunun gönderdiği bileşen (hazne) doluluğunu (`containers_pct`) mobil yanıtı okurken atıyordu. Düzeltme: slot kapasitesi yoksa doluluk, webdeki "Bileşenler" göstergesinde olduğu gibi haznelerden gösteriliyor; altında "Bileşen hazneleri" yazıyor. Testler: `deviceFillInfo` birim testleri ve GeneralTab testi.
2. **Stok sekmesinde teknik not ve web kuralına uymayan şablon düğmeleri.** Ekranda "Cihazın hangi şablona eşli olduğu bilgisi API'de bulunmuyor" yazıyordu ve üç düğmenin hepsi birden görünüyordu. Düzeltme: `/products/` yanıtına `template` alanı (`{id, name}` veya `null`) eklendi. Mobil artık web kuralını uyguluyor: eşli cihazda şablonun adı ve yalnız "Eşlemeyi kaldır"; eşli değilken "Şablon ata" ve, cihazın listesi varsa, "Şablon olarak kaydet". Sunucu bu alanı göndermiyorsa (eski sürüm) düğmelerin hepsi görünür, teknik not görünmez. Backend eki canlıya alındıktan sonra ekranda doğrulandı: eşli cihazda şablon adı ve yalnız "Eşlemeyi kaldır" görünüyor. Testler: backend `ProductsTemplateFieldTests`, mobil `DeviceDetailScreen` için iki test.

Jest 752/752 · backend `vennex_mobile` 99/99.

## Dördüncü tur — uçtan uca kullanıcı yolculukları (2026-11-19)

Ortam: Release derlemesi (`tr.com.vennex`, Metro yok), iOS 18.5 simülatör, yerel backend (gerçek `scc_lith` kodu, izole DB, kurgusal veri). Her yolculuk ekrandan yapıldı, sonuç **veritabanından** ve sunucu istek günlüğünden doğrulandı.

| Akış | Sonuç | Doğrulanan |
|---|---|---|
| `20_device_journeys` | **PASS** | Satış filtreleri (Son 7 gün, Başarısız, kart son 4 hane → "İşlem yok"); cihaz ayarı kaydı (ad "E2E Otomat") DB'de |
| `21_template_journeys` | **PASS** | Şablon oluşturma, SKU'ya bağlı kalem, DEMO0002'ye atama (DB) |
| `22_card_journeys` | **PASS** | Kart E2E00001 oluşturma, ₺12,50 bakiye yükleme + işlem kaydı, "E2E Grup" (DEMO0003 bağlı) |
| `23_stock_journeys` | **PASS** | Lokasyon "E2E Depo" → giriş 24 → 10 transfer (Merkez Depo 10) → −2 düzeltme notu "Sayim farki" → kalan 12 (DB) |
| `24_report_create` | **PASS** | Rapor isteği → iş üretildi (`SUCCESS`) → listede "Hazır" |
| `25_report_download` | **PASS** | `GET …/reports/1/download/` **200**, paylaşım sayfası açılır, `download_count` arttı |
| `26_notifications` | **PASS** | Bildirim okundu, okunmamış sayısı 0 |
| `27_technician_create` | **PASS** | Teknisyen `e2etek`, "Stok Yönetimi" yetki grubu (DB) |
| `28_technician_permissions` | **PASS** | Teknisyende Kartlar sekmesi, ciro, kullanıcılar ve şirket cari satırları gizli; çıkış **204** (refresh token kara listede); yeniden açılışta giriş ekranı |
| `29a/b/c` — sunucu kapalı | **PASS** | Gönderimde "Sunucuya ulaşılamadı…", yazılan metin korunur; yeniden açılışta **oturum düşmez** (bağlantı ekranı); sunucu açılınca "Tekrar dene" ile girişsiz devam; gönderim tek kayıt (DB: 1) |
| `29d` — gönderimden hemen sonra uygulama kapatılır | **PASS** | Yeniden açılışta oturum korunur; DB'de tam 1 kayıt (çift kayıt yok) |
| iPad Pro 13" (M4) görsel tur | **PASS** (düzeltme sonrası) | Tüm ekranlar, başlık ve alt sayfalar 720 pt okunabilir genişlikte ortalı; cihaz detayı/ayarlar, kart formu |
| iPhone 16e + erişilebilirlik yazı boyutu | **PASS** | Giriş (klavye "next/go" ile), Panel, Cihazlar, detay, Kartlar, yeni kart formu, Stok, Profil: taşma yok, uzun etiketler "…" ile kısalır |

### Bu turda bulunup düzeltilen hatalar

| Bulgu | Etki | Düzeltme |
|---|---|---|
| iOS'ta form sayfası ve onay sayfası aynı anda kapanınca görünmez bir pencere kalıyor, **tüm dokunuşlar kilitleniyordu** (stok hareketi sonrası) | Kritik | `AppSheet`: üst sayfa, alt sayfa tamamen kapanana kadar (`onDismiss`/450 ms yedek) açık kalır + 2 test |
| Rapor indirme **406** veriyordu (`Accept: …spreadsheetml…` başlığı DRF içerik pazarlığına takılıyor) | Yüksek | `Accept: */*` + 406 mesajı + 3 test |
| Çıkışta token'lar **önce** siliniyordu → `/auth/logout/` 401, refresh token kara listeye girmiyor, kullanıcı "Oturumunuz sona erdi" görüyordu | Yüksek (güvenlik, S27) | Çıkış isteği açık access token'la ve token'lar silinmeden gönderilir + 2 test; sunucuda 204 doğrulandı |
| Sunucuya ulaşılamayan açılışta kullanıcı **giriş ekranına** düşüyordu (token'lar dursa da yeniden giriş gerekiyordu) | Orta | Yeni `offline` durumu ve bağlantı ekranı (Tekrar dene, bağlantı gelince / uygulama öne alınınca otomatik deneme, Çıkış yap) + 5 test |
| iPad'de liste ekranları ve alt sayfalar ekranın tamamına yayılıyor, kaydırmalı ekranlarla hizasızdı | Düşük | `CenteredScreen` (navigator `screenLayout`), başlık ve `AppSheet` aynı genişlikte |

### Notlar (dördüncü tur)

- Web, şablon kalemine serbest metin `sku_code` girmeye izin verir; mobil yalnız stok SKU'su seçtirir (veri tutarlılığı için bilinçli fark).
- Atanmış cihazı olmayan teknisyende Stok sekmesi görünmez: sunucunun modül kuralı (şirket bağlamı yok), web ile aynı.
- Maestro: büyük yazıda klavye şifre alanını örttüğünde koordinatlı dokunuş klavyeye düşer; akışlar klavyedeki "next" tuşunu kullanır. iPad'de `back` komutu çalışmadığı için görsel turun bildirim adımı iPad'de atlanır (uygulama hatası değil).
- Yerel DB'de E2E kayıtları kaldı (E2E Otomat, E2E Sablon, E2E00001, E2E Grup, E2E Depo, rapor 1, e2etek, geri bildirimler); `backend-local/run.sh seed` temizler.

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

Kapsanan negatif senaryolar: ağ yok, zaman aşımı, 401 + refresh başarılı/başarısız, eşzamanlı 401 (tek refresh), 403, 404, 429, 500, boş/null/bozuk alanlar, yetkisiz kullanıcı, çift dokunma, erişimi olmayan şirket, şirket değişimi, çevrimdışı açılış (bağlantı ekranı, oturum korunur), yeniden kurulumda eski oturum, OTA ağ hatası, sürüm politikası yokken engellememe.

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
