# Performans Denetimi

> Ölçülmeyen iyileştirme "tamamlandı" sayılmaz. Aşağıda **yapısal** iyileştirmeler (kodla doğrulanmış, çoğu testle kilitlenmiş) ve **ölçülmesi gerekenler** ayrı tutulmuştur.

## Sunucu yükünü azaltan değişiklikler (kodla doğrulandı)

| Önce | Sonra | Doğrulama |
|---|---|---|
| Cihaz listesi: her satır için ayrı `GET /pos-devices/{sn}/products/` (25 cihazda 26 istek) | Listedeki `fill_rate` kullanılıyor: **1 istek/sayfa** | Ekran testi: satır başına ürün isteği yok |
| Şablon listesi: şablon başına detay isteği | Liste yanıtındaki alanlar; detay yalnız düzenleyicide | Ekran testi |
| Kart grupları: grup başına detay | Detay yalnız grup açıldığında | Ekran testi |
| Stok dağılımı: tüm lokasyonların envanteri her açılışta | Yalnız satır açılınca, bir kez ve önbellekli | Ekran testi |
| Arama: her tuşta istek + yüklenirken input kayboluyordu | 350 ms debounce; input hiç unmount olmuyor | Ekran testleri (kartlar, stok, cihazlar) |
| İstemci filtreleri query key'de (her değişimde istek) | Sunucuyu ilgilendirmeyen filtreler `useMemo` ile | Ekran testi (stok tür filtresi: yeni istek yok) |
| Okunmamış sayı: 3 ayrı sorgu kopyası, 60 sn | Tek paylaşılan sorgu, 120 sn, arka planda durur | `useUnreadNotificationCount` |
| Panel: 30 sn polling, odak dışında da | Odakta ve uygulama ön plandayken; backend önbellek TTL'iyle uyumlu | `useDashboard` |
| Raporlar: sabit 4 sn polling | Yalnız bekleyen iş varken, artan aralık (3→5→10→15 sn) | `useReportsPolling` testi |
| 4xx dahil her hata 1 kez tekrar deneniyordu | 4xx tekrar yok; ağ/5xx en fazla 2 kez üstel beklemeyle | `queryClient.test.ts` |
| Ekrandan çıkınca istekler sürüyordu | React Query `signal` ile iptal | API fonksiyonları `AbortSignal` alıyor |
| Çok şirketli kullanıcı: yanlış şirket verisi | `X-Company-Id` ile doğru kapsam; değişimde yalnız sıfırlama | `authStore.test.ts` |
| OTA kontrolü | En sık 30 dk'da bir, eşzamanlı çağrılar birleşir | `appConfig.test.ts` |

## Mobil performans (yapısal)

- Tüm büyük listeler `FlatList` (sanallaştırılmış) ve sabit `keyExtractor` kullanıyor. Satır bileşenleri `memo`. Büyük veri `ScrollView` ile çizilmiyor.
- 1.000–3.244 satırlık monolitik ekranlar sekme, bileşen ve hook dosyalarına bölündü. Sekmeler ilk ziyarette mount ediliyor (görünmeyen sekme istek atmıyor).
- Stiller `makeStyles` ile tema başına bir kez üretilip önbellekleniyor; render içinde stil nesnesi oluşturulmuyor.
- Sistem fontu (font yükleme gecikmesi yok). İkonlar tek set (Feather).
- OTA kontrolü açılışı bekletmiyor (`fallbackToCacheTimeout: 0`).

## Release ölçümü — iOS simülatör (2026-11-18)

iOS 18.5 simülatör (iPhone 16 Pro), **Release** yapılandırması (Hermes, gömülü JS paketi, Metro yok), yerel backend. Ölçüm: Maestro günlüğündeki zaman damgaları — uygulama süreci başlatıldıktan sonra ilk ekranın erişilebilirlik ağacında görünmesine kadar (Maestro yoklama aralığı dahil, yani üst sınır).

| Metrik | Ölçüm | Hedef | Durum |
|---|---|---|---|
| Soğuk açılış → giriş ekranı | 1,85 / 1,72 / 1,73 sn (ort. ~1,77 sn) | ~2 sn | **PASS (simülatör)** |
| Production JS paketi (iOS, bytecode'suz) | 2,9 MB | — | ölçüldü |
| Giriş → panel (gerçek hesaplama, 7.771 işlem) | yükleme göstergesi kısa; panel tam veriyle açıldı | — | gözlem |

Simülatör, Mac CPU'sunda çalıştığı için **gerçek cihazdan hızlı** sonuç verir. Orta seviye Android ve eski iPhone'da ölçüm hâlâ gerekli (aşağıda).

## Ölçülmesi gerekenler (gerçek cihaz — NOT TESTED)

| Metrik | Hedef | Nasıl |
|---|---|---|
| Soğuk açılış | ~2 sn | Release build, orta seviye Android + iPhone; `adb shell am start -W` / Xcode Instruments |
| Sekme/ekran geçişi | < 300 ms | React DevTools Profiler / Perf Monitor (release) |
| Liste kaydırma | 60 FPS | Perf Monitor, 500+ cihazlı hesap |
| JS thread | uzun blok yok | Hermes profiler |

Debug build ölçümleri production performansı yerine kullanılmamalıdır.

## Backend için önerilen yük azaltmaları

- Cihaz listesine `id`, `pos_odemetip` eklenmeli: şablon eşlemedeki cihaz başına detay isteği kalkar.
- `stock/overview/` isteğe bağlı lokasyon dağılımı döndürmeli: lokasyon başına envanter isteği kalkar.
- `users/` için `?q=` araması.
