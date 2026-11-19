# Final Rapor — Vennex Mobile (2026-11-19, 5. tur)

Büyük kurumsal görev tanımının (§15 "Final raporu") maddelerine göre. Ayrıntılar ilgili dokümanlarda; burada yalnız özet ve dürüst durum var. Durum etiketleri: **PASS / FAIL / BLOCKED / NOT TESTED**.

## 1. Yeniden tasarlanan ekranlar

Tamamı yeni design system ile baştan yazıldı (eski arayüzden kalan bileşen yok; eski `src/theme` ve `components/Common.tsx` silindi):

- **Kimlik:** Giriş, 2FA (6 haneli OTP), Yasal onay kapısı. Kendi kendine parola sıfırlama **bilinçli olarak yok** (web paneliyle aynı karar; parolayı şirket sahibi / Vennex desteği yeniler).
- **Panel:** tek istekli dashboard, dönem + özel aralık, lokasyon filtresi, KPI'lar, ciro grafiği, ödeme ve başarısızlık dağılımı, en iyi cihazlar, son işlemler.
- **Cihazlar:** liste (sunucu tarafı arama/filtre/sıralama, sayfalama, özel sıralama), detay 6 sekme (Genel + uzaktan satış, Nakit & Ciro, Satışlar, Stok/slotlar, İstatistikler, Ayarlar + komutlar), ürün şablonları ve şablon editörü.
- **Kartlar:** 5 sekme (personel kartları, gruplar, periyodik bakiye, istihkak, periyodik istihkak), kart detayı ve işlem geçmişi, toplu bakiye/silme/grup, bekleyenleri toplu red.
- **Stok:** özet, lokasyonlar (+detay), SKU'lar, hareketler (transfer/giriş/düzeltme).
- **Profil:** profil düzenleme, güvenlik (parola, 2FA, hesap dondurma/silme), bildirim tercihleri, şirket ve cari, **bölge ve konumlar**, kullanıcılar (teknisyen), raporlar (+yeni, detay), bildirimler, **geri bildirim ve destek**, yasal metinler, tema.

Envanter: [`SCREEN_INVENTORY.md`](SCREEN_INVENTORY.md).

## 2. Component mimarisi

`src/design-system` (token'lar, `makeStyles`, açık/koyu/sistem tema, 25+ bileşen, WCAG AA kontrast testi; yeni: iç içe sayfa derinliği, kaydedilmemiş değişiklik kancaları) · `src/api` (tek istemci, `X-Company-Id`, tek refresh kuyruğu, `ApiError` + alan hataları, merkezi `queryKeys`) · `src/screens/<alan>/{tabs,components,hooks}` · `src/hooks` (`useUnsavedChangesGuard`, `useSingleFlight`) · `src/realtime` (uzaktan satış WS) · `src/push` · `src/updates` (OTA + zorunlu güncelleme). En büyük ekran dosyası ~500 satır (başlangıçta 1000–3000). `any`: tek, gerekçeli satır (`screenRegistry.ts`, farklı parametreli ekran listesi). Ayrıntı: [`ENGINEERING_GUIDE.md`](ENGINEERING_GUIDE.md), [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md).

## 3. Düzeltilen fonksiyonel hatalar (seçme)

Sabit/sahte veriler (₺1147,12, DEMO SKU, "grup dağılımı") kaldırıldı · Snack/Kahve kodlaması · şablon kalem sözleşmesi · rapor indirme · N+1 istekler · Keychain'de kalan eski oturum · çift dokunuşta çift POST (kartlar, stok, **nakit toplama/ciro sayımı, özel sıralama**) · derin bağlantıların giriş/çıkıştan sonra devreye girmemesi · `message` alanının hata dönüşümü · silinen raporun yeniden istenmesi · KPI alt yazı kesilmesi · iç içe sayfada çift kararma · form kapatılınca veri kaybı (kaydedilmemiş değişiklik uyarısı) · **iOS'ta form + onay birlikte kapanınca tüm dokunuşların kilitlenmesi** · **rapor indirmede 406** · **çıkışta refresh token'ın kara listeye alınmaması** · **sunucuya ulaşılamayan açılışta oturumun düşmesi** · iPad'de liste ve alt sayfaların tam genişliğe yayılması · **rapor filtrelerinin sessizce yok sayılması** (durum, şirket/bölge/konum: yanlış içerikli Excel) · **yetkisiz kullanıcıya ciro gönderilmesi** (backend) · 403 dönen butonlar · kart geçmişinin webden farklı kaynaktan gelmesi · grup istihkakının binlerce istekle yapılması · sonsuz listede sayfa düşmesi · saat dilimi kayması · cihaz listesi Excel ucunun 404 vermesi. Tam liste: [`CHANGELOG.md`](CHANGELOG.md).

## 4. Backend uyumluluk

Her uç backend koduyla (serializer/view/permission) doğrulandı: [`API_CONTRACTS.md`](API_CONTRACTS.md). Web ve mobil **tek kaynaktan** beslenir: yetki/modül/enum kaydı `dashboard_v2/capabilities.py` → `GET /app/config/` (canlıda). Uçtan uca doğrulama **gerçek backend koduyla, yerel izole veritabanında** (kurgusal veri) yapıldı; canlıya test isteği atılmadı.

- Canlıda: ortak yetenek kaydı, OTA (POS ile ortak Xavia, `vm-` runtime), zorunlu güncelleme politikası, mobil API güvenlik düzeltmeleri.
- Canlıda (2026-11-18 23:53): geri bildirim API'si + Nexus ekranları, herkese açık gizlilik ve hesap silme sayfaları ([`BACKEND_CHANGES.md`](BACKEND_CHANGES.md)).

## 5. Performans

Sunucu yükü: N+1 kaldırıldı, polling ekran odaklı ve arka planda durur, rapor polling yalnız aktif işte, arama debounce + sunucu tarafı filtre, mutasyonlar tekrar denenmez. Ölçümler: [`PERFORMANCE_AUDIT.md`](PERFORMANCE_AUDIT.md) ve aşağıdaki "Release ölçümü".

## 6. Güvenlik

S1–S35: [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md). Öne çıkanlar: varsayılan RED yetki modeli, şirket izolasyonu, oturum değişiminde önbellek temizliği, token kara listesi (çıkışta doğru sırayla, S27), 2FA kilidi, yeniden kurulumda Keychain temizliği, çift istek kilitleri, Flutter'a ait Firebase dosyalarının ayıklanması. Açık öneriler (backend): parola sıfırlama uçlarının kapatılması ve `console` e-posta ayarı (S22), WS token'ının query string'den çıkarılması (S10).

## 7. Test sonuçları

| Katman | Sonuç |
|---|---|
| TypeScript strict | **PASS** (0 hata) |
| ESLint | **PASS** (0 hata) |
| Jest (unit + bileşen + ekran) | **PASS — 746/746**, 66 dosya; ayrıca İstanbul, New York ve Tokyo saat dilimlerinde |
| Backend (yerel izole DB) | **PASS — 168/168** (`vennex_mobile` + 45 web parite testi, `nexus`, `dashboard_v2`, OTA) |
| E2E (Maestro + simülatör, gerçek backend kodu) | **PASS**: şirket/modül, zorunlu güncelleme, uzaktan satış (WS), bölge/konum + **10 kullanıcı yolculuğu** (cihaz, şablon, kart, stok, rapor oluştur/indir, bildirim, teknisyen ve yetkileri) ve **4 negatif senaryo** (sunucu kapalı, işlem sırasında kapanma) — Release derleme, DB doğrulamalı |
| iPad (13") ve büyük yazı boyutu | **PASS** (düzeltme sonrası) |
| Android | **NOT TESTED** (kullanıcı kararıyla kapsam dışı) |
| Canlı sunucu (serpetco, salt okuma, sunucu tarafı) | **PASS**: 40 uç 200; Panel/cihaz/kart rakamları bağımsız toplamlarla aynı; yavaş uçlar backend dalında düzeltildi |
| Canlı arayüz turu | **BLOCKED**: canlı hesabın şifresini asistan yazmaz; kullanıcı girişi bekleniyor |
| Büyük veri (400 cihaz, ~600 bin işlem, 20 bin kart) | **PASS**: sayfalı uçlar sabit boyut, en yavaş Panel ~0,6 sn |
| Gerçek cihazda push teslimi | **NOT TESTED** (Firebase dosyaları `tr.com.vennex` için henüz yok) |

Ayrıntı: [`TEST_RESULTS.md`](TEST_RESULTS.md).

## 8. Build durumu

iOS simülatör derlemesi (Debug ve Release) PASS. Production yapılandırması `https://tms.vennex.com.tr` + OTA + kod imzası; **Firebase dosyaları olmadan bilerek başlamaz**. EAS profilleri hazır; mağaza derlemesi (`eas build --profile production`) Apple/Google hesapları ve Firebase dosyaları geldikten sonra.

## 9. Çözülemeyen / bekleyenler

- Android çalıştırma ve gerçek cihaz performans ölçümü.
- Push teslimi: Firebase'e `tr.com.vennex` uygulamaları + APNs anahtarı.
- Mağaza konsolu adımları (inceleme hesabı, iPad ekran görüntüleri, D-U-N-S): [`STORE_COMPLIANCE.md`](STORE_COMPLIANCE.md).
- Kahve reçetesi/bileşen düzenleme: mobil API'de uç yok (sahte arayüz gösterilmiyor).
- `npm audit`: 12 bulgu, çalışma zamanına giren kritik yok (gerekçeler SECURITY'de).

## 10. Backend'de ayrıca yapılması gerekenler

0. ✅ **`feature/mobil-parite-performans` dalı (6 commit, 168/168 test) 2026-11-19'da canlıya alındı.** Canlı kontrolde 41/41 uç 200 döndü ve rakamlar ORM ile aynı çıktı. Kayıt: [`BACKEND_CHANGES.md`](BACKEND_CHANGES.md) "Üçüncü dal". Mobil sürüm artık yayınlanabilir. Commit'ler GitHub `main`'e de push edildi (`4db6d4c`).
1. ✔ Geri bildirim dalı canlıda ve GitHub'da (`main`).
1b. Ürün kararı: admin rolünün mobilde kart yönetimi (S35).
2. `LegalDocument.web_url` alanlarının boşaltılması (gizlilik URL'si uygulamayla aynı kayıttan üretilsin).
3. `auth/password-reset/` uçlarının kapatılması; `EMAIL_BACKEND` sabit `console` (S22).
4. Öneriler S10–S12, S18–S21 (SECURITY_AUDIT).
