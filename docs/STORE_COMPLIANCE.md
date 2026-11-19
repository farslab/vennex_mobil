# Mağaza Uygunluk Denetimi — App Store & Google Play

Tarih: 2026-11-19 · Uygulama kimliği: **`tr.com.vennex`** (iOS bundle id = Android paket adı)

Durumlar: **✔** uygulamada/kodda karşılandı · **⏳** (artık canlıda — ✔ say) · **👤** mağaza konsolunda sizin yapmanız gereken adım · **❓** karar gerekiyor.

## Ortak

| Gereksinim | Durum | Nerede / not |
|---|---|---|
| Uygulama içinden hesap silme | ✔ | Profil → Güvenlik → Hesabı sil (`POST /auth/delete/`, parola onaylı, geri alınamaz uyarısı) |
| Uygulama dışından hesap silme talebi (web) | ⏳ | `https://tms.vennex.com.tr/vennexmobile/hesap-silme/` — talep Nexus → **Mobil Geri Bildirim**'e "Hesap silme talebi" olarak düşer; 30 gün içinde sonuçlandırılmalı. Google Play için **zorunlu** |
| Herkese açık gizlilik politikası URL'si | ⏳ | `https://tms.vennex.com.tr/vennexmobile/yasal/privacy/` — uygulamadaki metinle **aynı kayıttan** üretilir (tek kaynak). Şu an `LegalDocument.web_url` değerleri `vennex.com.tr/privacy/` gibi kurumsal site sayfalarına ayarlı; iki ayrı metin oluşmaması için bu alanlar boşaltılmalı (admin) — boşken API otomatik olarak yeni sayfayı döndürür |
| Yasal metinlerin sistemden değiştirilebilmesi | ✔ | `LegalDocument` (Django admin → Legal Belgeler). İçerik değişince sürüm otomatik artar, kullanıcıdan **yeniden onay** istenir (`pending_legal_docs` → onay kapısı). Uygulamada sabit metin yok; yalnız yükleme hatasında yedek başlık |
| Kullanıcı geri bildirimi / destek kanalı | ⏳ | Profil → Geri bildirim ve destek (öneri/hata/soru + önceki bildirimlerin durumu). Ekip: Nexus → Mobil Geri Bildirim (okunmamış rozeti, durum, dahili not) |
| Yalnız gerekli izinler | ✔ | Bildirim izni (çalışma anında). Kamera/konum/fotoğraf/rehber **yok** → ek izin metni gerekmez |
| Şifreleme beyanı | ✔ | Yalnız HTTPS → `usesNonExemptEncryption: false` (ihracat belgesi gerekmez) |
| Geliştirme izleri production'da yok | ✔ | Ortam rozeti yalnız dev/staging; production API sabit `https://tms.vennex.com.tr`, http adresi derlemeyi durdurur; demo/sahte veri yok |
| OTA güncellemeleri | ✔ | Yalnız JS/varlık güncellemesi, imzalı (Apple 3.3.2 / Play politikasıyla uyumlu; uygulamanın amacı değiştirilmemeli) |
| Mağaza inceleme hesabı | 👤 | İnceleme ekibi için **2FA'sız, canlıda demo şirketli** bir kullanıcı açın ve bilgilerini App Store Connect "App Review Information" / Play "App access" alanına girin (canlı veritabanına bizim veri yazmamız kuralı gereği yapılmadı) |
| Push (FCM/APNs) | 👤 | Firebase'de `tr.com.vennex` için iOS + Android uygulaması ekleyin (önerilen: mevcut `vennexmobile` projesi → backend değişmez), dosyaları `firebase/` klasörüne koyun; APNs anahtarını (.p8) Firebase'e yükleyin. Dosyalar olmadan production derlemesi bilerek durur |

## Apple App Store

| Gereksinim | Durum | Not |
|---|---|---|
| 5.1.1(v) Hesap silme | ✔ | Yukarıda |
| 5.1.1 Gizlilik politikası (uygulama içi + App Store Connect) | ✔ / 👤 | Uygulama içi: Profil → Yasal. App Store Connect'e URL girin |
| App Privacy ("besin etiketi") | 👤 | Toplanan: **Kişi bilgisi** (ad, e-posta, telefon — uygulama işlevi), **Tanımlayıcılar** (kullanıcı kimliği; push için cihaz/FCM token). Takip (tracking): **Hayır**. Reklam/analitik SDK'sı yok |
| Gizlilik manifesti (Required Reason API) | ✔ | `PrivacyInfo.xcprivacy`: UserDefaults (CA92.1), dosya zaman damgası (C617.1); Firebase/RN kendi manifestlerini getirir |
| App Tracking Transparency | ✔ | Gerekmez (takip yok) |
| Sign in with Apple | ✔ | Gerekmez (üçüncü taraf/sosyal giriş yok) |
| 2.1 Uygulama eksiksizliği, demo hesap | 👤 | Yukarıdaki inceleme hesabı |
| 3.1 Ödeme | ✔ | Uygulama içi satın alma yok; cari/fatura yalnız görüntüleme (B2B hizmet) |
| Push yeteneği | ✔ / 👤 | `aps-environment` entitlement hazır; Apple Developer'da `tr.com.vennex` App ID + Push Notifications |
| iPad desteği | ✔ karar: **desteklenecek** / 👤 | `supportsTablet: true`. App Store Connect'e **iPad ekran görüntüleri** (13" iPad) yüklenmeli; inceleme iPad'de de yapılır. Tüm ekranlar, sekme başlığı ve alt sayfalar 720 pt okunabilir genişlikte ortalı; iPad Pro 13" simülatöründe görsel tur **PASS** (2026-11-19) |
| Destek URL'si | 👤 | App Store Connect zorunlu alan (ör. vennex.com.tr iletişim sayfası) |
| Yaş derecelendirmesi | 👤 | Anket: kullanıcı içeriği/şiddet vb. yok → 4+ |

## Google Play

| Gereksinim | Durum | Not |
|---|---|---|
| Hedef API düzeyi | ✔ | targetSdk **36** (RN 0.86) — Play'in güncel şartını karşılar |
| 16 KB sayfa boyutu (Android 15+) | ✔ / 👤 | RN 0.86 ve Expo 57 yerel kütüphaneleri uyumlu; ilk AAB'de Play Console "App bundle explorer" uyarısını kontrol edin |
| Hesap silme (uygulama içi **ve** web URL) | ✔ / ⏳ | Data safety formunda "Hesap silme URL'si" olarak web sayfasını girin |
| Data safety formu | 👤 | Toplanan: ad, e-posta, telefon, kullanıcı kimlikleri, cihaz/diğer kimlikler (push). Aktarımda şifreli: **Evet**. Silme talebi: **Evet**. Paylaşım: **Hayır** |
| İzinler | ✔ | `INTERNET`, `POST_NOTIFICATIONS`; depolama/overlay izinleri engelli |
| App access (inceleme girişi) | 👤 | İnceleme hesabı bilgileri |
| İçerik derecelendirmesi, hedef kitle | 👤 | IARC anketi; hedef kitle 18+ (çocuklara yönelik değil) |
| Finansal özellikler beyanı | 👤 | Play tüm uygulamalardan ister. Uygulama finansal hizmet sunmaz (personel kartı bakiyesi işletme içi kapalı devre) — beyanı buna göre doldurun |
| Geliştirici hesabı türü | ✔ karar: **kurumsal** / 👤 | 12 test kullanıcısı / 14 gün kapalı test şartı **yok**. Kurumsal hesap için **D-U-N-S numarası** ve kuruluş doğrulaması gerekir; geliştirici adı ve iletişim e-postası mağazada görünür |
| Uygulama imzalama | ✔ | AAB, Play App Signing (EAS production profili) |
| Paket adı | ✔ | `tr.com.vennex` (Flutter uygulaması `com.vennex.mobile` ile çakışmaz) |

## Sonraki adımlar (sırayla)

1. ✔ Backend canlıda (2026-11-18): gizlilik URL'si `https://tms.vennex.com.tr/vennexmobile/yasal/privacy/`, hesap silme URL'si `https://tms.vennex.com.tr/vennexmobile/hesap-silme/`.
2. Admin → Legal Belgeler: `web_url` alanlarını boşaltın (tek kaynak) — ya da kurumsal sitedeki metinlerin bu kayıtlarla aynı tutulacağını garanti edin.
3. Firebase'e `tr.com.vennex` uygulamalarını ekleyip dosyaları verin; APNs anahtarını yükleyin.
4. İnceleme hesabını canlıda açın.
5. ✔ Kararlar: iPad desteklenecek (iPad ekran görüntüleri + iPad düzen kontrolü), Play hesabı kurumsal (D-U-N-S).
6. Mağaza listeleme içerikleri (ekran görüntüleri, açıklama, destek URL'si, gizlilik URL'si).
