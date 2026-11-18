# Yayın Süreci: App Store, Google Play ve OTA

## Sürüm türleri

| Tür | Ne değişir | Nasıl | Kim alır |
|---|---|---|---|
| **Mağaza sürümü** | Native kod, paketler, izinler, ikon/splash, `app.config.ts` native alanları | `APP_VERSION` artır → `eas build --profile production` → `eas submit` | Mağaza onayından sonra güncelleyenler |
| **OTA (JS) güncellemesi** | Yalnız JS/TS ve asset (ekranlar, metinler, iş mantığı) | `npm run ota -- "açıklama"` | Aynı mağaza sürümündeki tüm kullanıcılar, dakikalar içinde |
| **Sunucu kuralı** | Yetki, modül görünürlüğü, etiketler | Backend `dashboard_v2/capabilities.py` | Web ve mobil anında (uygulama güncellemesi gerekmez) |

App Store ve Google Play kuralları, uygulamanın amacını değiştirmeyen JS güncellemelerine izin verir. Native davranış değişiklikleri mağaza sürümü ister. `tools/ota-publish.sh` native etkileyen bir dosya değiştiyse yayını durdurur.

## Runtime ve sürümleme

- `app.config.ts`: `APP_VERSION = "1.0.0"` (mağaza sürümü, tek kaynak).
- `runtimeVersion = "vm-<APP_VERSION>"`; staging için `-stg` eki. Aynı runtime'daki derlemeler aynı OTA paketlerini alır. Staging canlı paketini asla almaz.
- Build numarası / versionCode: EAS uzak sayaç (`appVersionSource: remote`, production `autoIncrement`).
- Mağazaya gönderilen commit `store-<sürüm>` etiketiyle işaretlenir. OTA betiği bu etiketten beri native dosya değişmediğini doğrular.

```bash
git tag store-1.0.0 && git push origin store-1.0.0
```

## OTA altyapısı

- Sunucu: POS uygulamasıyla **aynı** Xavia OTA (`https://ota.vennex.com.tr`, `/opt/vennex-ota`, 127.0.0.1:8098). Ayrı runtime ad alanı (`vm-…`) sayesinde çakışma olmaz.
- İmza: Xavia tüm manifestleri tek anahtarla imzalar. Uygulama `ota/certificate.pem` genel sertifikasıyla doğrular (POS uygulamasıyla aynı sertifika, `CN=Vennex OTA`, 2036'ya kadar geçerli). Özel anahtar yalnız sunucuda durur.
- Kayıt: Django `OtaRelease` (`app=vennex-mobile`). Mobil yayınlar POS cihazlarına bildirim göndermez.
- İstemci (`src/updates/otaUpdater.ts`):
  - Kontrol açılışta ve uygulama ön plana geldiğinde yapılır, en sık 30 dakikada bir. Açılışı bekletmez.
  - İndirilen paket bir sonraki açılışta devreye girer; ekranda "Yeni sürüm hazır → Yeniden başlat" bandı çıkar.
  - Geliştirme derlemelerinde kapalıdır; bozuk pakette expo-updates gömülü pakete geri döner.

### Yayınlamak

1. Backend dalı (`feature/mobil-ortak-yetki-ota`) canlıda olmalı (`ota_release --app` desteği).
2. `ota-secrets/publish.env` dosyası (git dışı) oluşturulmalı:

   ```
   OTA_UPLOAD_KEY=<sunucudaki /opt/vennex-ota/.env UPLOAD_KEY>
   ```

3. Değişiklikleri commit edin, ardından:

   ```bash
   npm run ota -- "panel grafiği düzeltildi"
   ```

Betik sırasıyla şunları yapar: git temiz mi → native değişiklik yok mu → tip, lint, test → OTA numarası ayır → iOS+Android production paketi → sunucu içinden Xavia'ya yükle → yayın kaydı.

## Zorunlu güncelleme (mağaza sürümü)

Admin → **Mobil Sürüm Politikaları** (platform başına bir kayıt):

| Alan | Etki |
|---|---|
| `min_version` | Bu sürümün altı + `force_update` açıksa uygulama **kilitlenir**, "Güncelleme gerekli" ekranı ve mağaza bağlantısı gösterilir |
| `latest_version` | Bu sürümün altındakilere bir kez "yeni sürüm mağazada" bilgisi |
| `force_update` | Kapalıysa minimumun altı bile engellenmez (yalnız bilgi) |
| `store_url` | App Store / Google Play bağlantısı |
| `message` | Kullanıcıya özel metin (boşsa varsayılan) |

Sunucuya ulaşılamazsa uygulama **engellenmez** (çevrimdışı kullanım). Uçtan uca test: `e2e/maestro/11_force_update.yaml`.

## Mağaza gönderimi kontrol listesi

| Madde | Durum |
|---|---|
| Bundle id / paket: `tr.com.vennex` (Flutter `com.vennex.mobile` ile çakışmaz) | ✔ |
| Uygulama adı: production `Vennex` | ✔ |
| İkon (1024², alfa yok), Android adaptive ikon, açık/koyu splash | ✔ |
| iOS gizlilik manifesti (izleme yok; UserDefaults CA92.1, FileTimestamp C617.1) | ✔ `app.config.ts` |
| `ITSAppUsesNonExemptEncryption = false` (yalnız standart HTTPS) | ✔ |
| Uygulama içi hesap silme (App Store 5.1.1(v)) | ✔ Profil → Güvenlik → Hesabı sil |
| Android izinleri yalnız `INTERNET` | ✔ |
| Play Data safety beyanı | Toplanan: e-posta, ad, telefon (hesap yönetimi); işlem verisi (uygulama işlevi). Paylaşım yok, iletimde şifreli, silme talebi uygulama içinde |
| App Store gizlilik etiketleri | Kişiyle ilişkili: iletişim bilgisi, kullanıcı kimliği; izleme yok |
| Test hesabı (App Review) | Mağaza incelemesi için canlıda ayrı bir demo şirketi ve hesabı oluşturulmalı (gerçek müşteri verisi olmadan) |
| `eas.json` submit: `ascAppId`, `appleTeamId`, Play servis hesabı | **Doldurulacak** (hesap bilgileri) |
| Staging API adresi | **Doldurulacak** (ayrı test sunucusu varsa) |
| Push bildirimleri (FCM/APNs) | İstemci hazır (RN Firebase 27). Firebase'de `tr.com.vennex` uygulamaları eklenip dosyalar `firebase/` altına konmalı (bkz. `firebase/README.md`); production derlemesi dosyasız başlamaz |
