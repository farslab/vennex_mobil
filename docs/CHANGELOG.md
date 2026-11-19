# Değişiklik Günlüğü

## [1.0.0] — Kurumsal yeniden yapılandırma (2026-11-18)

### Mimari ve altyapı
- Yeni **design system** (`src/design-system`): renk/tipografi/boşluk token'ları, açık/koyu/sistem teması, 20+ bileşen, WCAG AA kontrast testi.
- Tek kök navigasyon: izinlere ve şirkete göre sekmeler, `TabHeader` (şirket seçici + bildirim), derin bağlantı (`vennex://`).
- API katmanı: `X-Company-Id` (çok şirket desteği), tek refresh kuyruğu, alan bazlı hatalar (`fieldErrors`), Türkçe ağ/durum mesajları, istek iptali, merkezi `queryKeys`, `usePagedList`.
- React Query mobil yaşam döngüsü: arka planda polling durur (AppState), ağ yokken bekler (NetInfo), 4xx tekrar denenmez, **mutasyonlar asla otomatik tekrar denenmez**.
- **Sunucu güdümlü yapılandırma** (`/app/config/`): modül görünürlüğü, yetkiler, enum etiketleri ve özellik bayrakları web ile aynı backend kaynağından okunur.
- Ortamlar: `app.config.ts` (development → yerel sunucu, staging → zorunlu https, production → sabit canlı adres), EAS profilleri, ikon/adaptive ikon/splash.
- **OTA güncellemeleri** (expo-updates + Xavia, POS ile ortak sunucu, `vm-` runtime), **zorunlu güncelleme** (admin politikası), yayın betiği `npm run ota`.
- Mağaza hazırlığı: iOS gizlilik manifesti, şifreleme beyanı, minimum Android izinleri, uygulama içi hesap silme.
- Yerel mock sunucu (`mock-server/`) ve gerçek backend kodunun izole yerel kurulumu (`../backend-local`).

### Beşinci tur (2026-11-19) — web paritesi, büyük veri, canlı doğrulama
- **Rapor formu web ile birebir** (kritik düzeltmeler):
  - "Başarılı/Başarısız" filtresi `success|fail` gidiyordu, backend yalnız `true|false` tanıdığı için **sessizce yok sayılıyordu**. Örneğin "Başarısız" seçilen rapor tüm işlemleri içeriyordu. Düzeltildi; varsayılan durum web gibi Başarılı.
  - Şirket/bölge/konum çoğul anahtarlarla gidiyordu ve backend hepsini **yok sayıyordu**, yani rapor tüm şirketleri kapsıyordu. Artık şirket tekil gönderiliyor ve oturumdaki şirket önseçili. Bölge/konum seçimi web gibi cihaz kapsamına çevriliyor; cihazı olmayan bölge seçilirse rapor oluşturulmaz, hata verilir.
  - Tip adları ve sırası webdeki gibi: Özet, Detay, PersonelKart Hareketleri. "Aylık Analiz" PersonelKart altında ay/yıl seçimli bir seçenek; şirkette PersonelKart POS'u yoksa PersonelKart gizli.
  - PersonelKart raporunda şirket, grup (gruptaki kartları işaretler) ve tek tek kart seçimi.
  - Ödeme tipleri ve adları web listesiyle aynı. İstemcide de 365 gün ve 1000 cihaz sınırı uyarısı.
  - Rapor kartı: durum adları web ile aynı ("Sıraya alındı"). Tahmini satır yalnız hazırlanırken gösteriliyor. Saklama süresi dolan raporda İndir butonu yok. Tamamlanan rapor web gibi "Tekrar" ile yeniden üretilebiliyor; iptal edilen yalnız silinebiliyor.
- **Excel butonları (webdeki gibi):** cihaz listesi, cihaz ürünleri, personel kartları, stok özeti.
- **Rol bazlı butonlar web ile aynı:**
  - Ürün şablonları yalnız cihaz ayarı yetkisiyle görünüyor (öncekinde 403 dönebiliyordu).
  - Ayarlar sekmesi ve cihaz komutları cihaz ayarı yetkisi istiyor.
  - Özel sıralama herkese açık.
  - Nakit toplama, satış yetkisi olan ya da teknisyen için açık.
  - Kart grubu kısıtlı teknisyende grup oluştur/düzenle/sil gizli; yeni kartta grup zorunlu.
- **Kart geçmişi webdeki gibi bakiye hareketleri:** yükleme, satış, iade, düzeltme, silme; sayfalı. Önceden en fazla 500 POS işlemi sanallaştırılmadan çiziliyordu.
- **Grup istihkakı tek istekte:** önceden gruptaki her kart için ayrı istek atılıyordu (10 bin kartta yaklaşık 10 bin istek). "Dağıtım" seçeneği eklendi: her ürüne ayrı / havuz.
- **Sonsuz listeler:** 21. sayfadan sonra ilk sayfanın düşmesi ve yenilemede tüm sayfaların tekrar çekilmesi düzeltildi.
- **Saat dilimi:** sunucu zamanları ve "bugün" her zaman Türkiye saatiyle (web ile aynı); telefon başka saat dilimindeyse de doğru.
- **Stok SKU araması:** sunucu ilk 50 sonucu döndürdüğünde uyarı gösteriliyor ve yanıltıcı tür sayıları gizleniyor.

### Dördüncü tur (2026-11-19) — uçtan uca doğrulama
- 10 kullanıcı yolculuğu + 4 negatif senaryo Release derlemesinde, gerçek backend koduyla ve DB doğrulamasıyla (`e2e/maestro/20–29`).
- **Düzeltildi:** iOS'ta form + onay sayfası birlikte kapanınca kalan görünmez pencerenin tüm dokunuşları kilitlemesi (`AppSheet`).
- **Düzeltildi:** rapor indirmede 406 (`Accept` başlığı).
- **Düzeltildi (güvenlik):** çıkışta refresh token'ın kara listeye alınmaması (token'lar istekten önce siliniyordu).
- **Yeni:** sunucuya ulaşılamayan açılışta giriş ekranı yerine bağlantı ekranı; oturum korunur, bağlantı gelince otomatik devam.
- **iPad:** tüm ekranlar, sekme başlığı ve alt sayfalar okunabilir genişlikte ortalı (`CenteredScreen`).
- Alt sayfalarda klavye sürükleyerek kapanır (iOS etkileşimli).

### Üçüncü tur (2026-11-18) — eksik tamamlama, mağaza uygunluğu
- **Paket adı `tr.com.vennex`** (iOS + Android): Flutter uygulamasının `com.vennex.mobile` kimliğiyle çakışmaz. Flutter'a ait Firebase dosyaları kaldırıldı; `app.config.ts` kimliği eşleşmeyen Firebase dosyasını reddeder, production derlemesi Firebase'siz başlamaz, dosyalar yokken push kodu hiç çalışmaz.
- **Geri bildirim ve destek** (Profil): öneri/hata/soru gönderme, önceki bildirimlerin durumu. Ekip tarafı Nexus → Mobil Geri Bildirim (backend dalı).
- **Mağaza uygunluğu**: herkese açık gizlilik ve hesap silme talebi sayfaları (backend dalı), [`STORE_COMPLIANCE.md`](STORE_COMPLIANCE.md).
- **Kendi kendine parola sıfırlama kaldırıldı** (web paneliyle aynı karar): giriş ekranında yöneticiye yönlendirme metni.
- **Kaydedilmemiş değişiklik uyarısı**: 16 form sayfası (X/arka plan/geri/Vazgeç) ve 3 tam ekran (profil düzenleme, teknisyen formu, cihaz ayarları) çıkmadan önce onay ister.
- **Çift istek koruması**: nakit toplama/ciro sayımı ve özel sıralama kaydı/sıfırlaması (`useSingleFlight`).
- **Derin bağlantılar** her zaman etkin tek yapılandırma (önceden giriş/çıkıştan sonra devreye girmiyordu).
- KPI alt yazıları dar kartta kesilmez; iç içe sayfalarda arka plan iki kat kararmaz.
- Hata dönüştürücü: `message` adlı alanın doğrulama hatası artık alan hatası olarak gösterilir.
- Rapor silindikten sonra silinen rapor yeniden istenmez; SKU formunda tür değişince eski hatalar temizlenir; şablon formunda formda karşılığı olmayan hata artık görünür.
- Ölü kod: eski `src/theme` ve `src/components/Common.tsx` (any içeren geçiş köprüsü) silindi.
- Testler: 23 testsiz ekran/sayfaya 196 test (+ yeni özellik testleri); test zaman aşımı 20 sn.

### Yeni özellikler (2026-11-18, ikinci tur)
- **Push bildirimleri** (RN Firebase 27, `com.vennex.mobile`): izin (Android 13+ dahil), FCM token kaydı ve yenilenmesi, çıkışta kaydın silinmesi, ön planda bildirim, bildirime dokununca ilgili ekran.
- **Uzaktan satış**: cihaz detayında canlı WebSocket kanalı (web ile aynı protokol), müşteri seçimi → onay → sonuç; yetkisiz/ağ hatası ayrımı, otomatik yeniden bağlanma.
- **Bölge ve konum yönetimi** (Profil → Şirket): bölge/konum oluşturma, düzenleme, silme; koordinat girişi (Türkçe ondalık); silmenin etkisi onayda açıklanır.
- Cihaz komutları sunucudaki `send_device_commands` yetkisine bağlandı (web ile aynı kural).

### Ekranlar (tamamı yeniden yazıldı)
- **Giriş:** yeni tasarım, alan doğrulaması, şifre göster/gizle, şifremi unuttum, 6 haneli OTP (otomatik doldurma), ortam rozeti.
- **Panel:** tek istekli dashboard, dönem ve özel aralık, lokasyon filtresi, KPI'lar, SVG ciro grafiği, ödeme ve başarısızlık dağılımı, en iyi cihazlar, son işlemler. Uydurma "grup dağılımı" kaldırıldı.
- **Cihazlar:** sunucu taraflı arama, filtre ve sıralama, sonsuz sayfalama; N+1 kaldırıldı; özel sıralama sunucuya kaydediliyor.
- **Cihaz detayı:** 6 sekme (Genel, Nakit & Ciro, Satışlar, Stok, İstatistikler, Ayarlar). Sabit değerler (₺1147,12, ₺1665,20, "serpetco" vb.) kaldırıldı. Snack/Kahve kodlaması düzeltildi (0/1). Yalnız yazılabilir alanlar PATCH ediliyor, `_warnings` gösteriliyor. Komutlar onay arkasında.
- **Ürün şablonları:** DEMO verisi kaldırıldı. Gerçek SKU kataloğu; kalem sözleşmesi düzeltildi (tek kalem, zorunlu fiyat); cihazlara eşleme ve gönderme.
- **Kartlar:** 5 sekme + kart detayı. Toplu bakiye/silme/grup, onay/red, periyodik bakiye ve istihkak, sunucu taraflı seçiciler. Her finansal işlemde özetli onay.
- **Stok:** özet, lokasyonlar (+detay ve hareketler), SKU (oluşturma dahil), hareketler (transfer/giriş/düzeltme). Türkçe ondalık girişi; kaynak ve hedef aynı olamaz.
- **Profil ve hesap:** profil düzenleme, güvenlik (şifre, 2FA kurulum/kapatma, hesap dondurma/silme), bildirim tercihleri, şirket ve cari, tema seçimi.
- **Kullanıcılar:** liste, oluşturma ve düzenleme, şifre sıfırlama (min 8), silme.
- **Raporlar:** sözleşmeye uygun oluşturma (gerçek filtre seçenekleri, ISO tarih), akıllı polling, indirme düzeltildi (expo-file-system 57 + paylaşım), iptal, yeniden deneme, rapor detayı.
- **Bildirimler:** sayfalama, okunmamış filtresi, ilgili ekrana yönlendirme.
- **Yasal:** temaya uyumlu metinler, onay kapısı.

### Güvenlik
- Yetkiler varsayılan RED. Kullanıcı ve şirket değişiminde önbellek temizleniyor. Geliştirme canlı API'ye bağlanmıyor. axios 1.21.1.
- Yeni kurulumda Keychain'de kalan eski oturum temizleniyor; Keychain erişimi `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`.
- Backend (ayrı dal): token iptali (kara liste), 2FA kullanıcı kilidi, personel parola kuralları, stok hata yönetimi. Bkz. [`BACKEND_CHANGES.md`](BACKEND_CHANGES.md).

### Bağımlılıklar
- Expo 57.0.33, React Native 0.86.3; Xcode 26.3 için gerekli Swift düzeltmesi bu yamalarla geldi.
- Eklenen: netinfo, expo-sharing, expo-splash-screen, expo-updates, expo-application, expo-asset, expo-font.
- Geliştirme: jest-expo 57.0.6, Testing Library 14, axios-mock-adapter, ESLint 9, Prettier.
