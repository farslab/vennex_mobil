# Güvenlik Denetimi — Vennex Mobile

> Tarih: 2026-11-18 · Kapsam: React Native istemcisi (bu repo) + mobil API backend'i (`vennex_mobile` Django app, salt-okunur kod incelemesi).
> Yöntem: kod incelemesi, bağımlılık taraması (`npm audit`), otomatik testler. **Canlı sunucuya hiçbir istek atılmadı**; backend kodu sunucudan salt-okunur kopyalanıp yerelde incelendi.

## Özet

| # | Bulgu | Taraf | Önem | Durum |
|---|---|---|---|---|
| S1 | İzin kontrolleri istemcide "varsayılan izin ver" idi (`sales_visible ?? true`, `manage_device_settings ?? true`) | Mobil | Yüksek | **Düzeltildi** |
| S2 | Çok şirketli kullanıcıda `X-Company-Id` gönderilmiyordu → her zaman ilk şirket; şirket bağlamı kontrolsüz | Mobil | Orta | **Düzeltildi** |
| S3 | Çıkış / oturum düşmesinde React Query önbelleği temizlenmiyordu → önceki kullanıcının verisi yeni oturumda görünebilirdi | Mobil | Yüksek | **Düzeltildi** |
| S4 | Geliştirme ortamı canlı API'ye bağlıydı (varsayılan `https://tms.vennex.com.tr`) → test işlemlerinin canlı veriye yazılma riski | Mobil | Yüksek | **Düzeltildi** |
| S5 | Production build'de http adresine izin veren yapılandırma kontrolü yoktu | Mobil | Orta | **Düzeltildi** |
| S6 | `axios` 1.x güvenlik açıkları (prototype pollution, header injection, SSRF) | Mobil | Yüksek | **Düzeltildi** (1.21.1) |
| S7 | Cihaz komutları (`and_reset`, `eod_trig`, `mdb_reset`) **hiçbir yetki kontrolü olmadan** uygulanıyor | Backend | **Yüksek** | Backend'e öneri |
| S8 | JWT access token ömrü **7 gün**; çıkışta yalnız refresh token kara listeye alınıyor → çalınan access token 7 gün geçerli | Backend | Yüksek | Backend'e öneri |
| S9 | 2FA doğrulama ucunda (`/auth/2fa/verify/`) hız sınırı yok; yalnız oturum başına 5 deneme | Backend | Orta | Backend'e öneri |
| S10 | WebSocket kimlik doğrulaması token'ı query string'de taşıyor (proxy/erişim loglarına düşer) | Backend | Orta | Backend'e öneri |
| S11 | `PATCH /pos-devices/{sn}/` yetkisiz alanları sessizce atlıyor (200 + `_warnings`) | Backend | Düşük | İstemci `_warnings`'i gösterir; backend'e öneri |
| S12 | `POST /app/test-push/` production'da tüm yönetim kullanıcılarına açık | Backend | Düşük | Backend'e öneri |
| S13 | Derleme araçlarında (metro, jest, shell-quote, glob) bilinen açıklar | Mobil (dev) | Düşük* | İzleniyor |
| S14 | Parola değişimi/sıfırlama/hesap kapatma `OutstandingToken` **siliyordu**: diğer oturumlar kapanmıyor, çıkış yapılmış refresh token'lar **yeniden geçerli** oluyordu (BlacklistedToken CASCADE) | Backend | **Yüksek** | **Düzeltildi** (dal) — kara liste |
| S15 | iOS Keychain'deki token'lar uygulama silinip yeniden kurulunca kalıyor → yeni kurulumda eski oturum otomatik açılıyordu | Mobil | Orta | **Düzeltildi** — ilk açılışta temizlenir; Keychain erişimi `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY` |
| S16 | 2FA'da kullanıcı bazlı hata sınırı yok (her giriş yeni 5 deneme) | Backend | Orta | **Düzeltildi** (dal) — saatte 10 |
| S17 | Personel parolası 6 karakter + sessiz kırpma | Backend | Orta | **Düzeltildi** (dal) — min 8, kırpma yok |
| S18 | Cihaz listesi ciro alanlarını `view_sales` kontrolü olmadan döndürüyor (`serializers/pos_device.py:42-47`); `collect-cash` yanıtı tutarı döndürüyor (`views/pos_devices.py:664`) | Backend | Orta | Backend'e öneri (istemci yetkisiz kullanıcıya göstermiyor) |
| S19 | Periyodik bakiye kuralı oluşturmada `change_card_balance` kontrolü yok (`views/personnel_cards.py:593-695`); toplu bakiyede satır kilidi yok (`:325`) | Backend | Orta | Backend'e öneri (istemci gizliyor) |
| S20 | Şablon gönderimi şirket kapsamında değil (`views/product_templates.py:288`); şablon oluşturmada yazma yetkisi yok (`:54`) | Backend | Orta | Backend'e öneri |
| S21 | Rapor `filter-options` `X-Company-Id`'yi yok sayıyor, admin tüm şirketleri görüyor (`views/reporting.py:239-245`); bazı uçlarda ham istisna metni dönüyor (`views/payments.py:~101`) | Backend | Düşük | Backend'e öneri |
| S22 | E-posta gönderimi `core/settings.py:641`'de sabit `console.EmailBackend`: `auth/password-reset/` geçerli sıfırlama linklerini **sunucu loguna** yazıyor (e-posta hiç gitmiyor); link adresi de backend'de tanımlı değildi | Backend | Orta | Mobil sıfırlama akışı **kaldırıldı** (karar: web gibi kendi kendine sıfırlama yok). Öneri: `auth/password-reset/` ve `/confirm/` uçları kapatılmalı |
| S23 | Nakit toplama / ciro sayımı onayına hızlı ikinci dokunuş **ikinci POST** atıyordu (`CashTab`); özel sıralama kaydı/sıfırlamada da aynısı | Mobil | Orta | **Düzeltildi** — `useSingleFlight` (senkron ref kilidi) + test |
| S24 | Hata dönüştürücü `message` adlı ALANIN DRF hatasını (dizi) genel mesaj sayıp atıyordu → kullanıcı "Request failed with status code 400" görüyordu | Mobil | Düşük | **Düzeltildi** + test |
| S25 | Projede Flutter uygulamasına (`com.vennex.mobile`) ait Firebase istemci dosyaları vardı; yeni kimlikle (`tr.com.vennex`) eşleşmiyordu | Mobil | Orta | **Düzeltildi** — dosyalar kaldırıldı; `app.config.ts` kimlik eşleşmesi olmayan dosyayı reddeder, production Firebase'siz derlenmez |
| S26 | Herkese açık yeni sayfalar (gizlilik, hesap silme talebi) | Backend | — | Tasarım: hesap varlığı açığa çıkmaz, CSRF zorunlu, IP başına saatte 5 talep, markdown ham HTML kapalı + `javascript:` linkleri reddedilir, `X-Frame-Options: DENY`; talepler kimlik doğrulanmadan hesaba bağlanmaz (Nexus'ta doğrulama notu) |

\* Bu paketler yalnız geliştirme/derleme zamanında çalışır; uygulama paketine girmez.

---

## Mobil istemci — uygulanan kontroller

### Kimlik doğrulama ve oturum
- Access/refresh token yalnızca **`expo-secure-store`** (iOS Keychain / Android Keystore) içinde. AsyncStorage'da yalnız hassas olmayan tercihler (tema, seçili şirket id) tutulur.
- Eşzamanlı 401'lerde **tek** refresh isteği (paylaşılan promise); refresh başarısızsa token'lar silinir, önbellek temizlenir, kullanıcı girişe yönlenir. Test: `src/api/__tests__/client.test.ts`.
- Oturum açılışında, çıkışta ve 401 kaynaklı düşüşte `queryClient.clear()` (S3).
- Açılışta `/auth/me/` ağ hatası verirse oturum silinmez (çevrimdışı açılış); yalnız 401/403'te silinir.
- 2FA: 401 (süre doldu / deneme aşıldı) → giriş ekranına dönüş; kalan deneme hakkı gösterilir.
- Parolalar, OTP ve token'lar hiçbir yerde loglanmaz (kaynakta `console.log` yok; ESLint `no-console` kuralı).

### Yetkilendirme
- `src/auth/permissions.ts` backend `compute_permissions` sözlüğüyle birebir; **varsayılan RED** (S1). Liste bozuk/eksikse hiçbir yetki verilmez — test edildi.
- Modül görünürlüğü: Kartlar = `manage_personel_card` + şirkette personel kart cihazı; Stok = `manage_stock` + stok modu; Kullanıcılar/Cari = owner.
- UI gizleme güvenlik sınırı değildir; tüm yetkiler backend `permission_classes` ile ayrıca uygulanıyor (aşağıya bakın).

### Ağ
- Ortam ayrımı (`app.config.ts`): development → yerel mock sunucu (`http://localhost:4010`), staging → zorunlu `https` + açık adres, production → `https://tms.vennex.com.tr`. Production'da `https` dışı adres uygulamayı başlatmaz (`src/config/env.ts`) (S4, S5).
- iOS ATS: `NSAllowsArbitraryLoads=false`; yalnız development'ta yerel ağ izni.
- Android izinleri: yalnız `INTERNET`; depolama/overlay izinleri engellendi.
- Zaman aşımı 20 sn; 4xx hatalar otomatik yeniden denenmez, mutasyonlar **asla** otomatik yeniden denenmez (çift finansal işlem riski).
- Certificate pinning **uygulanmadı**: sertifika yenileme ve yedek pin operasyonu planlanmadan eklenirse uygulamayı kilitleyebilir. Öneri: backend ekibiyle yedek SPKI pin + yenileme takvimi belirlendikten sonra değerlendirilmeli.

### Veri
- Kullanıcı değişiminde önbellek temizliği (S3); şirket değişiminde tüm sorgular sıfırlanır.
- Derin bağlantılar (`vennex://`) yalnız oturum açıkken etkin; parametreler kırpılır, yetki backend'de yeniden doğrulanır.
- Hata mesajları backend `detail` alanından gelir; ağ/5xx için genel Türkçe mesaj — sunucu iç ayrıntısı gösterilmez.

---

## Backend — doğrulanan güvenli davranışlar

- Tüm şirket verisi uçları `CompanyContextMixin` kullanıyor; `X-Company-Id` kullanıcının erişebildiği şirketlerle sınırlı, aksi 403 (`vennex_mobile/mixins.py:19-51`).
- Cihaz uçları `_get_device_or_404(user, sn, company)` ile kullanıcı + şirket kapsamında (`views/pos_devices.py:100-111`); teknisyen yalnız atandığı cihazlara erişir.
- Rapor indirme/iptal/yeniden deneme iş kaydını `user=request.user` ile filtreliyor (`views/reporting.py:162,188`).
- Cari/fatura uçları `IsOwner` + seçili şirket filtresi (`views/payments.py:28-80`).
- Giriş 10/dk, parola sıfırlama 5/saat hız sınırlı (`throttling.py`); parola sıfırlama hesap varlığını sızdırmıyor.
- Parola değişimi/sıfırlama/hesap kapatma tüm diğer oturumları düşürüyor (`views/auth.py:360,428,441,452`).
- Refresh token rotation + blacklist açık (`core/settings.py:307-309`).

## Backend — öneriler (ayrıntı)

**S7 — Cihaz komutları yetkisiz.** *Güncelleme:* Kural artık tek yerde (`dashboard_v2/capabilities.py::can_send_device_commands`, yetenek `send_device_commands`) ve web ile mobil aynı kaynaktan okur. Mevcut iş kuralı (web'de "Cihaz kontrolleri herkese açık") korunmuştur; daraltma kararı bu tek fonksiyonla iki platforma birden uygulanır. Eski not: `serializers/pos_device.py:218-223` ve `views/pos_devices.py` PATCH: `commands` (Android reset, gün sonu tetikleme, MDB reset) yalnız "yönetim kullanıcısı + cihaza erişim" ile uygulanıyor. `eod_trig` finansal gün sonu sürecini tetiklediğinden yetkisiz çağrı operasyonel/finansal etki doğurabilir. **Öneri:** `manage_device_settings` (veya yeni `send_device_commands`) izni şartı + denetim kaydı (kim, ne zaman, hangi komut). Mobil uygulama komut butonlarını sunucunun `send_device_commands` kararına göre gösterir (web ile birebir).

**S8 — 7 günlük access token.** `ACCESS_TOKEN_LIFETIME = 7 gün` (`core/settings.py:306`). Mobil istemci refresh akışını tam desteklediği için access ömrü 15–60 dk'ya düşürülebilir; böylece çıkış/şifre değişikliği sonrası çalınan token'ın penceresi daralır. Alternatif: access token'lar için de jti kara listesi.

**S9 — 2FA hız sınırı.** `TwoFactorVerifyView` için kullanıcı başına (session_token'dan bağımsız) sayaç / `ScopedRateThrottle` önerilir; şu an yeni giriş = yeni 5 deneme.

**S10 — WS token query string'de.** `ws_auth.py`: `?token=<access>`. Öneri: kısa ömürlü (60 sn) tek kullanımlık WS bileti üreten bir REST ucu, veya `Sec-WebSocket-Protocol` başlığı. Nginx erişim loglarında query string maskelenmeli.

**S11 — Sessiz kısmi başarı.** Yetkisiz alanlar 200 ile atlanıyor. İstemci `_warnings` dizisini kullanıcıya gösteriyor; backend tarafında 207/403 alan bazlı hata dönmesi daha açık olur.

**S12 — Test push ucu.** `views/app.py:36` production'da `DEBUG` veya admin ile sınırlanmalı.

## Bağımlılıklar (`npm audit --omit=dev`, 2026-11-18 güncel)

- **12** bulgu (4 orta, 8 yüksek, **0 kritik**); önceki tarama 49'du. Güvenli yamalar uygulandı (`shell-quote`, `@xmldom/xmldom`).
- **Firebase zinciri** (`@grpc/grpc-js`, `@firebase/firestore`, `firebase`): RN Firebase'in web uyumluluk paketi üzerinden geliyor. Üretilmiş iOS production paketinde (`expo export`) `grpc-js` / Firestore **0 kez** geçiyor → çalışma zamanına girmiyor. Önerilen düzeltme RNFB'yi 20'ye düşürmek olduğundan uygulanmadı.
- **`markdown-it` / `linkify-it`** (yasal metin gösterimi, `react-native-markdown-display`): yalnız admin'in yazdığı güvenilir içerik işleniyor; kullanıcı girdisi yok → düşük risk. Paket güncellenince yükseltilmeli.
- **`expo` / `@expo/fingerprint` / `minimatch`**: yalnız derleme aracı; `npm audit fix --force` Expo'yu 52'ye düşürmeyi önerdiği için uygulanmadı.
- Production paketinde canlı dışı adres yok: `tms.vennex.com.tr` gömülü yapılandırmadan gelir; `localhost` yalnız geliştirme yedeği ve production'da `http` adresi uygulamayı durdurur.
