# Production Hazırlığı — Vennex Mobile

## Ortamlar

| Ortam | `APP_ENV` | API | Nasıl |
|---|---|---|---|
| Geliştirme | `development` (varsayılan) | `http://localhost:4010` (yerel mock) veya `EXPO_PUBLIC_API_BASE_URL` | `npm run mock` + `npx expo run:ios` |
| Test/Staging | `staging` | `EXPO_PUBLIC_API_BASE_URL` (zorunlu, https) | `eas build --profile staging` |
| Production | `production` | `https://tms.vennex.com.tr` (sabit) | `eas build --profile production` |

- Yapılandırma `app.config.ts` içinde; `app.json` kaldırıldı. Staging adresi verilmezse veya https değilse build durur; production'da https dışı adres uygulamayı açtırmaz (`src/config/env.ts`).
- Uygulama adı ortama göre: `Vennex`, `Vennex (Test)`, `Vennex (Dev)`. Giriş ekranında production dışı ortam rozeti görünür.
- `eas.json`: `development` (simulator), `staging` (internal, kanal `staging`), `production` (kanal `production`, `autoIncrement`). **Yapılacak:** staging sunucu adresi (`REPLACE-WITH-STAGING-HOST`) backend ekibinden alınmalı; Vennex'in ayrı bir test sunucusu yoksa staging profili kullanılmamalı.

## Kimlikler ve izinler

| Alan | Değer |
|---|---|
| iOS bundle id | `com.vennex.mobileapp` |
| Android paket | `com.vennex.mobileapp` |
| URL şeması | `vennex://` (yalnız oturum açıkken) |
| iOS | ATS açık (`NSAllowsArbitraryLoads=false`), `usesNonExemptEncryption=false` |
| Android izinleri | yalnız `INTERNET`; depolama/overlay izinleri engelli |

## Görseller

- İkon: `assets/images/icon.png` (1024², marka gradyanlı, Flutter uygulamasıyla aynı)
- Android adaptive ikon: `assets/images/adaptive-icon.png` (şeffaf, güvenli alan içinde) + arka plan `#1C5A96`
- Splash: `expo-splash-screen` eklentisi, açık `#FFFFFF` / koyu `#0A0F17` zemin, ortada logo işareti

## Production build kontrol listesi

| Kontrol | Durum |
|---|---|
| Debug log yok (`console.log` kaynakta yok, ESLint `no-console`) | ✔ |
| Test/mock API adresi production'a giremez | ✔ (env kontrolü + production sabit adres) |
| Sahte/demo veri yok | Modül modül doğrulanıyor — bkz. `CHANGELOG.md` |
| Hassas bilgi pakette yok (anahtar, servis hesabı) | ✔ repo taraması |
| Token'lar SecureStore'da | ✔ |
| `npm run check` (tip + lint + test) temiz | Son durum `TEST_RESULTS.md` |
| iOS simülatör debug build | ✔ iPhone 16 Pro / iOS 18.5; gerçek backend koduna karşı E2E |
| Release build ölçümleri (açılış, geçiş) | **Yapılmadı** — gerçek cihazda `eas build --profile production` sonrası ölçülmeli |
| App Store / Play gereksinimi: uygulama içi hesap silme | Profil → Güvenlik (backend `POST /auth/delete/`) |
| Push bildirimleri (FCM/APNs) | **Yapılmadı**: Firebase yapılandırması (`google-services.json`, APNs anahtarı) ve `expo-notifications` gerekir; backend uçları hazır |
| Zorunlu güncelleme (admin politikası) | ✔ İstemci + backend dalı; E2E `11_force_update.yaml` PASS |
| OTA güncellemeleri (Xavia, POS ile ortak sunucu) | ✔ İstemci + yayın betiği; ilk yayın backend dalı canlıya alındıktan sonra. Bkz. [`OTA_AND_RELEASE.md`](OTA_AND_RELEASE.md) |
| iOS gizlilik manifesti / şifreleme beyanı | ✔ |
| Sunucu güdümlü modüller ve etiketler (`/app/config/`) | ✔ İstemci; backend dalı canlıya alınınca etkin (öncesinde yerel kurallar) |

## Bilinen sınırlamalar

- Uzaktan satış yalnız WebSocket ile destekleniyor; bu sürümde yok (kullanıcıya açıkça belirtilir).
- Push bildirimleri ve bildirimden ekrana derin bağlantı, push altyapısı kurulunca etkinleşir; uygulama içi bildirim merkezi çalışır.
- Uçtan uca doğrulama **gerçek backend koduyla** (aynı commit + bu dal) yerelde, kurgusal verili izole veritabanında yapıldı. Canlı veritabanına karşı yapılmadı (canlı sunucu kuralı). Mağaza incelemesi öncesi canlıda ayrı bir demo şirketiyle salt okuma turu önerilir.
- Android cihaz/emülatörde çalıştırılmadı.
