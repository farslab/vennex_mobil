# Vennex Mobile App (React Native / Expo)

Bu proje, `vennex_mobile_api_references.md` dokümanındaki backend sözleşmesine göre kurulmuş bir
**Expo (TypeScript)** uygulamasıdır. Kapsam: **Auth (2FA dahil)**, **Dashboard/Overview**,
**POS Cihazları**, **Personel Kartları (Wallet)**, **Stok**, **Raporlar**, **Bildirimler**,
**Yasal Belgeler (onay kilidi dahil)**.

## Kurulum

Kod bu ortamda internet erişimi olmadığı için `npm install` çalıştırılamadı — bunu kendi
bilgisayarınızda yapmanız gerekiyor. **Sırayı değiştirmeyin**, iki adım da gerekli:

```bash
cd vennex-mobile-app
rm -rf node_modules package-lock.json   # varsa eski/bozuk kurulumu temizler
npm install
npx expo install --fix
```

**Bu iki adım neden ayrı ayrı gerekli?**

1. `package.json`'da `expo`, `react` ve `react-native` **kesin** sürümlerle sabitli; geri kalan
   tüm `expo-*` ve native modül paketleri (`expo-secure-store`, `expo-constants`,
   `expo-file-system`, `@expo/vector-icons`, `react-native-screens`,
   `react-native-safe-area-context`, `react-native-gesture-handler`) **kasıtlı olarak** `"*"`
   (en güncel sürüm) bırakıldı. Böylece `npm install` her koşulda başarıyla tamamlanır — Expo SDK
   sürüm numaraları sık değiştiği için burada elle tahmin edilen bir patch sürümü npm'de
   bulunmayabilir ve `npm install`'ı **tamamen** başarısız kılabilir (bu da editörde onlarca
   "Cannot find module" hatasına yol açar).
2. `npx expo install --fix` ise `npm install` başarıyla bittikten **sonra**, bu paketleri
   projenizin gerçek Expo SDK sürümüyle (şu an SDK 57) **birebir uyumlu** kesin sürümlere yeniden
   yazar ve `package.json`'ı günceller. Bu adım atlanırsa
   `_ExpoFontLoader.default.getLoadedFonts is not a function` gibi native/JS uyumsuzluk hataları
   alırsınız.

Kurulumdan sonra hâlâ tuhaf bir hata görürseniz cache'i temizleyerek başlatın:

```bash
npx expo start -c
```

> **Not:** Zaman içinde SDK sürümü değişeceği için, projeyi tekrar açtığınızda önce
> `npx expo install --fix` çalıştırıp güncel sürümlerle senkronize etmeniz iyi bir alışkanlıktır.

### API adresini ayarlama

`app.json` içindeki `expo.extra.apiBaseUrl` alanını kendi backend adresinize göre güncelleyin
(şu an dokümandaki default olan `https://tms.vennex.com.tr` yazılı):

```json
"extra": {
  "apiBaseUrl": "https://sizin-backend-adresiniz.com"
}
```

### Çalıştırma

```bash
npm start
```

Ardından Expo Go uygulamasıyla QR kodu okutun, ya da `npm run android` / `npm run ios` ile
emülatörde açın.

## Mimari

```
src/
  api/          → Axios istemcisi + backend'e birebir karşılık gelen fonksiyonlar
    client.ts   → Base URL, Bearer header, 401 → refresh → retry akışı (reentrancy guard'lı)
    auth.ts     → login, 2FA verify/setup, refresh, logout, /me, notification prefs, FCM
    overview.ts → dashboard bundle, summary, recent-transactions, locations
    devices.ts  → POS cihaz listesi/detay/ürünler/kasa işlemleri
    cards.ts    → personel kartları, kart grupları, bulk işlemler
    stock.ts    → SKU/lokasyon/hareket/transfer/mal kabul/düzeltme

  types/        → Dokümandaki her modelin TypeScript karşılığı (snake_case JSON alanlarıyla birebir)

  store/
    authStore.ts    → zustand: login/2FA/logout state makinesi + oturum geri yükleme (bootstrap)
    queryClient.ts  → react-query default ayarları

  navigation/   → AuthStack (Login/2FA) ↔ MainTabs (Panel/Cihazlar/Kartlar/Stok/Profil)

  screens/      → Her modül için ekranlar (dashboard, devices, cards, stock, profile, auth)

  components/   → Ortak UI: Button, ScreenCard, LoadingView, ErrorView, Badge, PeriodSelector

  theme/        → Renk paleti ve spacing sabitleri (koyu tema)
```

## Auth akışı nasıl çalışıyor?

1. `POST /auth/login/` → 2FA yoksa direkt `access`/`refresh`/`user` döner, `authStore` bunu
   SecureStore'a yazar ve `authenticated` durumuna geçer.
2. 2FA aktifse → `requires_2fa: true` + `session_token` döner, `authStore` `requires_2fa`
   durumuna geçer, `AuthStack` otomatik olarak `TwoFactorScreen`'i gösterir.
3. `POST /auth/2fa/verify/` → başarılıysa token'lar kaydedilir; 400 + `requires_2fa:true`
   dönerse kullanıcı OTP ekranında kalır ve `attempts_left` gösterilir (dokümandaki
   `validateStatus` davranışı `authApi.verify2FA` içinde birebir uygulandı).
4. Her istekte `apiClient` interceptor'ı otomatik `Authorization: Bearer <access>` ekler.
5. Herhangi bir istek `401` dönerse: `apiClient` otomatik `POST /auth/refresh/` çağırır, yeni
   token'ı kaydeder ve orijinal isteği tekrar dener. Refresh de başarısız olursa kullanıcı
   otomatik olarak login ekranına düşer (`registerUnauthorizedHandler`).

## Kapsam dışı bırakılanlar (sıradaki adımlar)

Sağlam bir temel oturduğu için şu modülleri aynı `src/api/*.ts` + `src/screens/*` deseniyle
kolayca ekleyebilirsiniz — hepsi dokümanda tam olarak tanımlı:

- **Cari & Faturalama** (`/cari/*`) — Paraşüt entegrasyonu, fatura PDF. **Not:** `urls.py`
  teyidine göre bu modül **salt-okunur** — `payment-link` / ödeme başlatma endpoint'i backend'de
  kasıtlı olarak **yok** (yorum: "yalnızca görüntüleme, ÖDEME YOK"). Mobil tarafta ödeme akışı
  kurulmamalı; yalnızca `cari/summary/`, `cari/invoices/`, `cari/invoices/{id}/pdf/` kullanılabilir.
- **Ürün Şablonları** (`/product-templates/*`) — cihazlara toplu şablon atama
- **Kullanıcı/Bölge/Şirket yönetimi** (`/users/*`, `/regions/*`, `/companies/*`)
- **FCM push bildirimleri** — `expo-notifications` kurup `authApi.registerDevice` ile
  cihaz token'ını backend'e kaydetmeniz yeterli; `fcm_service.py`'nizle uyumlu.

## Yeni eklenen modüller (bu güncellemede)

- **Raporlar** (`src/screens/reports/`) — async job oluşturma, 4sn aralıklı polling
  (pending/running durumdayken), tamamlanınca `expo-file-system` ile cihaza indirme.
- **Bildirimler** (`src/screens/notifications/`) — okundu işaretleme, tümünü okundu yap,
  Profil sekmesinde ve tab bar'da rozet (badge) sayacı.
- **Yasal Belgeler** (`src/screens/legal/`) — markdown render (`react-native-markdown-display`),
  Profil'den tekil görüntüleme + **onay kilidi**: `AuthUser.pending_legal_docs` boş değilse
  `RootNavigator` kullanıcıyı `MainTabs` yerine `LegalConsentGateScreen`'e yönlendirir; her
  belge tek tek onaylanmadan uygulamaya geçilemez.

## Notlar

- Tüm para birimleri TRY olarak varsayıldı (`Intl.NumberFormat("tr-TR", ...)`).
- Dokümanda belirtilen "camelCase" istisnaları (`iptalNo`, `bankRefNo` — PosTransaction içinde)
  `src/types/devices.ts` içinde birebir korundu.
- `Paginated<T>` ve `{results: [...]}` zarfı farkı, dokümanın "Drift/Yenilik" notlarına göre
  endpoint bazında doğru şekilde kullanıldı.

## Sorun Giderme

**"Yetkiniz yok" mesajları (Panel/Cihazlar/Stok'ta veri görünmüyor):**
Bu, uygulamanın bir hatası değil — backend'in kendi yanıtını olduğu gibi gösteriyoruz
(`sales_visible: false` ya da 403 `detail` metni). `authentication.py`'daki yetki modeline göre
**yalnızca `role: "owner"` tüm izinleri otomatik alır**; `role: "admin"` veya `"tech"` olan
kullanıcılar backend'deki `permissions` listesinde (`view_sales`, `view_devices` vb.) **açıkça
tanımlı izinlere** ihtiyaç duyar — "admin" adı kullanıcının her şeye yetkili olduğu anlamına
gelmez. Profil ekranındaki **Rol / İzinler** kartından test hesabınızın gerçekte hangi izinlere
sahip olduğunu görebilirsiniz; izin listesi boşsa sorun backend'deki kullanıcı kaydındadır,
uygulama tarafında değil.

**Editörde/derleyicide onlarca "Cannot find module" hatası görüyorum:**
Neredeyse her zaman `node_modules` eksik ya da yarım kurulmuştur — genelde `npm install`'ın
kendisi bir paket sürümü bulunamadığı için sessizce veya gürültülü şekilde başarısız olmuştur.
Çözüm:
```bash
rm -rf node_modules package-lock.json
npm install
npx expo install --fix
```
`npm install` çıktısında kırmızı `ETARGET` / `No matching version found` gibi bir satır varsa,
bahsedilen paketin `package.json`'daki sürümünü `"*"` yapıp tekrar deneyin — sonra
`expo install --fix` doğrusunu yazacaktır.

**`_ExpoFontLoader.default.getLoadedFonts is not a function` gibi native/JS uyumsuzluk hatası:**
Telefonunuzdaki Expo Go uygulamasının sürümü ile projenin Expo SDK'sı uyuşmuyor demektir. Expo Go
her zaman yalnızca en güncel SDK'yı destekler. `npx expo install --fix` + `npx expo start -c`
genelde yeterlidir; hâlâ oluyorsa Expo Go uygulamasını mağazadan güncelleyin.

**TypeScript `@/...` alias import'ları çözümlenmiyor (ama `node_modules` dolu):**
`tsconfig.json`'daki `compilerOptions.paths` ile `babel.config.js`'deki `module-resolver`
alias'ının (`"@": "./src"`) eşleştiğinden emin olun — ikisi birbirinden bağımsız çalışır, biri
eksik kalırsa runtime çalışır ama editör kırmızı çizer (ya da tam tersi).
# vennex_mobil
