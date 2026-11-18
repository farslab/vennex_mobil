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
