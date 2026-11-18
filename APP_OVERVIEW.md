# Vennex Mobile — Uygulama Dokümanı

> Kapsam: `farslab/vennex_mobil` reposu, `main` @ `1028e10` (2026-08-27).
> Hazırlanma tarihi: 2026-11-18. Bu doküman kodun okunmasıyla çıkarılmıştır. Backend davranışına dair notlar, istemci kodundan çıkarılan varsayımlardır.

---

## 1. Uygulama nedir?

**Vennex Mobile**, Vennex TMS (Terminal Management System) backend'ine bağlanan bir **işletme sahibi / yönetici mobil uygulamasıdır**. Otomat (snack ve kahve) ile POS cihazı filosu işleten şirketlerin şunları yapmasını sağlar:

- **Panel:** ciro, işlem, çevrimiçi/çevrimdışı cihaz ve hata özetleri, grafikler
- **Cihazlar:** POS/otomat listesi, cihaz detayı, satışlar, slot/stok, nakit toplama, ciro sayımı, ayarlar
- **Ürün şablonları:** otomat ürün dizilimi (slot → SKU → fiyat) şablonlarını oluşturup cihazlara eşleme
- **Kartlar:** personel NFC kartları, kart grupları, bakiye yükleme kuralları, istihkak (kota) yönetimi
- **Stok:** depo/araç/otomat lokasyonları, SKU'lar, transfer, stok girişi, düzeltme
- **Profil:** hesap bilgisi, bildirim tercihleri, bildirimler, raporlar (asenkron rapor işleri), kullanıcı/teknisyen yönetimi, yasal metinler (KVKK, Gizlilik, Kullanım Koşulları)

Uygulamanın dili Türkçedir. Tüm metinler koda gömülüdür, i18n yoktur.

**Geçmiş:** Kod yorumlarında `lib/data/models/... .dart karşılığı` gibi ifadeler geçiyor. Buna göre uygulama, Flutter ile yazılmış `farslab/vennex-mobile` uygulamasının React Native'e taşınmış hâli. Repo, `senanurkarabulut21/vennex_mobil` reposunun fork'udur. Toplam 4 commit var ve hepsi 2026-08-27 tarihli.

---

## 2. Teknoloji yığını

| Katman | Kütüphane / sürüm |
|---|---|
| Çatı | **Expo SDK 57** (`expo@57.0.9`), **React Native 0.86**, React 19.2 |
| Dil | TypeScript 6 (`strict: true`) |
| Navigasyon | React Navigation 7 (native-stack + bottom-tabs) |
| Sunucu state | **TanStack React Query 5** |
| İstemci state | **Zustand 4** (`authStore`, `themeStore`) |
| HTTP | Axios 1.x: interceptor ile JWT ekleme ve refresh |
| Güvenli depolama | `expo-secure-store` (access/refresh token) |
| Yerel depolama | `@react-native-async-storage/async-storage` (tema, cihaz sıralaması vb.) |
| Grafik | `react-native-svg` (panelde elle çizilen alan grafiği), `react-native-gifted-charts` (yalnızca kullanılmayan `SalesChartCard`) |
| Markdown | `react-native-markdown-display` (yasal metinler) |
| Dosya | `expo-file-system` (rapor indirme) |
| Diğer | `date-fns`, `expo-linear-gradient`, `@expo/vector-icons` |

**Olmayanlar:** test altyapısı, ESLint/Prettier, `eas.json` (EAS Build ayarı), uygulama ikonu ve splash görseli (yalnızca `assets/images/vennex-logo.png` var), push bildirim kütüphanesi (`expo-notifications`), i18n, hata izleme (Sentry vb.), README.

---

## 3. Kurulum ve çalıştırma

```bash
npm ci
```

```bash
npx expo start
```

- `npm run ios` veya `npm run android`, ilgili simülatörde ya da emülatörde açar.
- Backend adresi `app.json` içinde `expo.extra.apiBaseUrl` alanında tanımlı. Varsayılanı `https://tms.vennex.com.tr`.
- Bütün istekler `https://tms.vennex.com.tr/api/v1/vennexmobile/...` altına gider (`API_PREFIX`).
- Bundle id / paket adı: `com.vennex.mobileapp`.
- Import alias'ı: `@/` → `src/` (`babel-plugin-module-resolver` ve `tsconfig.paths`).

**Tip kontrolü** (`npx tsc --noEmit`) şu an **1 hata** veriyor: `src/api/reports.ts` içinde `FileSystem.documentDirectory` yok. Ayrıntısı §9'da.

---

## 4. Klasör yapısı

```
App.tsx                      Kök: GestureHandler + SafeArea + QueryClientProvider + RootNavigator
app.json                     Expo ayarları (apiBaseUrl, bundle id)
src/
  api/                       Axios istemcisi + domain başına API modülleri
    client.ts                apiClient, rootApiClient, token & refresh interceptor, normalizeError
    auth.ts overview.ts devices.ts templates.ts cards.ts stock.ts
    reports.ts notifications.ts legal.ts users.ts index.ts
  store/
    authStore.ts             Zustand: oturum durum makinesi (booting/unauthenticated/requires_2fa/authenticated)
    themeStore.ts            Zustand: light/dark (AsyncStorage'a yazılır)
    queryClient.ts           React Query varsayılanları (retry 1, staleTime 30sn)
  navigation/                RootNavigator, AuthStack, MainTabs, DevicesStack, ProfileStack
  screens/                   auth, dashboard, devices, cards, stock, reports, notifications, profile, users, legal
  components/                Common (Button, ScreenCard, LoadingView, ErrorView, EmptyState, Badge),
                             HeaderRightActions, LogoHeader, PeriodSelector,
                             SalesChartCard (kullanılmıyor), HeaderNotificationButton (kullanılmıyor)
  theme/                     colors.ts (palette + useAppTheme), spacing.ts
  types/                     Domain tipleri (auth, devices, cards, stock, reports, ...)
  utils/tokenStorage.ts      SecureStore sarmalayıcı
```

**Boyut:** `src` altında yaklaşık 18.400 satır var. Bunun yaklaşık %80'i 8 büyük ekran dosyasında:

| Dosya | Satır |
|---|---|
| `screens/cards/CardsListScreen.tsx` | 3244 |
| `screens/devices/DeviceDetailScreen.tsx` | 2438 |
| `screens/devices/TemplateProductsEditScreen.tsx` | 1811 |
| `screens/stock/StockOverviewScreen.tsx` | 1688 |
| `screens/dashboard/DashboardScreen.tsx` | 1388 |
| `screens/devices/DevicesListScreen.tsx` | 1316 |
| `screens/devices/ProductTemplatesScreen.tsx` | 1279 |
| `screens/users/UsersListScreen.tsx` | 1009 |

---

## 5. Mimari

### 5.1 API katmanı (`src/api/client.ts`)

- **`apiClient`**: `baseURL = apiBaseUrl + /api/v1/vennexmobile`, timeout 20 sn.
- **`rootApiClient`**: prefix'siz istemci. Yorumdaki örnek `/api/wallet/complaint/`, ancak **şu an hiçbir yerde kullanılmıyor**.
- **İstek interceptor'ı**: SecureStore'daki access token'ı `Authorization: Bearer ...` başlığı olarak ekler. `skipAuth: true` verilen isteklerde eklemez (login, 2FA, refresh, yasal metin).
- **Yanıt interceptor'ı (401):**
  1. Refresh token yoksa `onUnauthorized()` çağrılır ve oturum düşer.
  2. Başka bir refresh sürüyorsa istek kuyruğa alınır. Yeni token gelince tekrar gönderilir.
  3. Yoksa `POST /auth/refresh/` çağrılır, yeni token'lar kaydedilir ve asıl istek tekrarlanır. Refresh başarısız olursa token'lar silinir ve oturum düşer.
- **`normalizeError`**: Backend hatasını `Error` nesnesine çevirir. Mesaj önceliği `detail → message → error → axios mesajı`. Ayrıca `status` ve `body` alanlarını ekler.
- Domain modülleri (`authApi`, `devicesApi`, `cardsApi`, `stockApi`, ...) ince sarmalayıcılardır ve `r.data` döndürür.
- **`usersApi`** backend'den gelen tutarsız alan adlarını normalize eder. Örneğin cihaz sayısı `pos_device_count`, `pos_devices_count` ya da `device_count` olarak gelebiliyor.

### 5.2 Kimlik doğrulama akışı (`src/store/authStore.ts`)

```
booting ──(token yok)──────────────────────────────► unauthenticated
   │
   └─(token var) GET /auth/me/ ─ok──────────────────► authenticated
                                └─hata→ token sil ──► unauthenticated

unauthenticated ── POST /auth/login/
   ├─ requires_2fa:true (session_token, attempts_left) ► requires_2fa
   └─ access+refresh+user ───────────────────────────► authenticated

requires_2fa ── POST /auth/2fa/verify/ {session_token, otp}
   ├─ 400 + requires_2fa:true → OTP ekranında kal (kalan deneme hakkı gösterilir)
   └─ access+refresh+user ───────────────────────────► authenticated

authenticated ── logout → POST /auth/logout/ (sonuç beklenmez) + token sil ─► unauthenticated
```

- Token'lar `expo-secure-store` içinde tutulur: `vennex_access_token`, `vennex_refresh_token`.
- **Yasal onay kapısı**: `user.pending_legal_docs` doluysa (`privacy`, `kvkk`, `terms`) ana uygulama yerine `LegalConsentGateScreen` açılır. Metinler sırayla gösterilir. `POST /legal/accept/` güncel kullanıcıyı döndürür ve liste boşalınca uygulama açılır.
- **Roller**: `UserRole = "owner" | "tech" | "admin"`. Ayrıca `permissions: string[]` ve `companies[]` var. Şirket kaydı `cari_state`, `uses_stock_mode` ve `has_personnel_card_device` alanlarını taşır. **UI'da yalnızca tek bir rol kontrolü var:** "Kullanıcı Yönetimi" menüsü sadece `owner` rolüne görünür.

### 5.3 State yönetimi

- **Sunucu verisi** React Query ile yönetilir. Varsayılanlar: `retry: 1`, `staleTime: 30sn`, `refetchOnWindowFocus: false`.
- **Polling yapan sorgular:**
  - Okunmamış bildirim sayısı: 60 sn'de bir.
  - Panel: ekran odaktayken 30 sn'de bir.
  - Raporlar: bekleyen veya çalışan iş varken 4 sn'de bir.
- **Mutasyonlar:** Çoğu ekranda `useMutation` yerine elle `try/await/Alert` yazılmış ve ardından `invalidateQueries` çağrılıyor. Çift gönderim koruması çoğunlukla yok.
- **Zustand:** `authStore` (oturum) ve `themeStore` (tema).

### 5.4 Tema

- `palette.light` ve `palette.dark` tanımlı. `useAppTheme()` aktif renkleri döndürür. Tema header'daki güneş/ay butonuyla değişir ve AsyncStorage'a kaydedilir.
- Varsayılan tema **dark**. `app.json` içinde `userInterfaceStyle: automatic` olsa da sistem teması dinlenmiyor.
- **Sorun:** `Common.tsx` (Button, LoadingView, ErrorView, Badge), `markdownStyles.ts` ve `SalesChartCard` sabit `colors = palette.dark` kullanıyor. Açık temada bu bileşenler koyu tema renkleriyle çiziliyor. Yasal metinler beyaz yazıyla açık zemine düştüğü için okunamıyor.

### 5.5 Navigasyon haritası

```
RootNavigator (NavigationContainer, tema köprüsü)
├─ status=booting        → LoadingView
├─ status≠authenticated  → AuthStack
│    ├─ Login
│    └─ TwoFactor        (status=requires_2fa iken)
├─ authenticated + pending_legal_docs → LegalConsentGateScreen
└─ authenticated → Stack
     ├─ MainApp → MainTabs (bottom tabs)
     │    ├─ Dashboard  "Panel"     → DashboardScreen
     │    ├─ Devices    "Cihazlar"  → DevicesStack
     │    │    ├─ DevicesList           (iki sekme: POS Cihazları | Ürün Şablonları)
     │    │    ├─ DeviceDetail {sn,name}
     │    │    ├─ ProductTemplates      (kayıtlı ama hiç açılmıyor; liste içinde gömülü)
     │    │    └─ TemplateProductsEdit {templateId,title}
     │    ├─ Cards      "Kartlar"   → CardsListScreen (5 üst sekme)
     │    ├─ Stock      "Stok"      → StockOverviewScreen (6 üst sekme)
     │    └─ Profile    "Profil"    → ProfileStack
     │         ├─ ProfileHome
     │         ├─ Reports → NewReport
     │         ├─ Notifications
     │         ├─ Users            (yalnızca owner)
     │         └─ LegalDocument {slug}
     └─ Notifications (global; header'daki zil)
```

- Her header'da `HeaderRightActions` bulunur: tema değiştirme ve okunmamış rozetli zil.
- `Notifications` route'u hem kök stack'te hem `ProfileStack`'te tanımlı. Zile basıldığında hangisinin açılacağı, o an hangi navigator içinde olunduğuna bağlı.

---

## 6. Ekranlar ve özellikler

> Notlar: "⚠️" işareti mock/sahte veri ya da eksik bağlantı, "🐞" işareti muhtemel hata anlamına gelir. Satır numaraları ilgili dosyaya aittir.

### 6.1 Giriş ve 2FA (`screens/auth`)
- **Login:** kullanıcı adı veya e-posta ile şifre girilir. Hata mesajları backend'in `detail` alanından gelir.
- **TwoFactor:** 6 haneli TOTP kodu girilir ve kalan deneme hakkı gösterilir.
- **Eksik:** şifremi unuttum ekranı yok, oysa `passwordReset` API'si hazır.

### 6.2 Panel (`DashboardScreen` + `useDashboard`)
- `GET /overview/dashboard/?period&top_limit=5&recent_limit=5[&start_date&end_date][&nocache=1]`
- **Dönem seçimi:** Bugün, Dün, Bu Hafta, Geçen Hafta, Bu Ay, Geçen Ay, Son 30 Gün ve Özel. Özel aralık `YYYY-MM-DD` formatında ve en fazla 92 gün olabilir. Dönem değişimi 350 ms debounce edilir.
- **Yenileme:** Aşağı çekince yenilenir. Bu yenileme `nocache=1` gönderir ve arada 8 sn bekleme süresi uygular. Ekran odaktayken 30 sn'de bir kendiliğinden yenilenir.
- **İçerik:**
  - KPI kartları: çevrimiçi/çevrimdışı cihaz, değişim yüzdesiyle ciro, işlem sayısı, türe göre başarısız işlemler.
  - SVG alan grafiği (dokununca tooltip açılır).
  - Ödeme tipi dağılımı.
  - En iyi cihazlar ve son işlemler tabloları. Cihaz adına basınca cihaz detayı açılır.
- `summary.sales_visible` false ise satış rakamları gizlenir.
- ⚠️ "Grup Dağılımı" modalı, grup başına tutarları `active_cards_count` oranıyla **tahmin ediyor**. Gerçek veri değil ve son satırdaki "kalan" hesabı hatalı (276-295).
- Kullanılmayan alanlar: `error_breakdown` ve `location_id`. Lokasyon filtresi yok.

### 6.3 Cihazlar listesi (`DevicesListScreen`)
- **Sekmeler:** "POS Cihazları" ve "Ürün Şablonları". İkinci sekme `ProductTemplatesScreen` ekranını gömülü gösterir.
- **Üst alan:** Toplam, Çevrimiçi ve Çevrimdışı sayaçları, "Ciro Gizle/Göster" ve "Sırala" butonları.
- **Filtreler:** arama, durum, makine tipi ve 13 sıralama seçeneği.
- **Satırlar:** çevrimiçi göstergesi, son işlemden beri geçen süre, doluluk çubuğu, Bugün/Dün/Bu Ay/Geçen Ay cirosu.
- **API:**
  - Liste `GET /pos-devices/?q&page=1&page_size=50` ile gelir.
  - Doluluk için her satır ayrıca `GET /pos-devices/{sn}/products/` çağırır (**N+1 istek**).
- **Sıralama:** "Cihaz Sıralama" modalı sürükle-bırak ve ▲/▼ ile çalışır. Sonuç yalnızca AsyncStorage'a yazılır. `POST /pos-devices/sort/` hiç çağrılmıyor.
- ⚠️ Sahte değerler: "7 bileşen" (869, 874), varsayılan %100 doluluk (878), işlem sayısı yedeği `110` (885).
- 🐞 Durum, tip ve sıralama filtreleri istemcide uygulanıyor ama query key içinde olduğu için her değişiklikte yeniden istek atılıyor. Aramada debounce yok. Sayfalama yok, ilk 50 cihazdan sonrası görünmüyor.

### 6.4 Cihaz detayı (`DeviceDetailScreen`, en büyük ekran)
Header'da ad, seri numarası, "⚡ Uzaktan Satış" butonu ve çevrimiçi rozeti var. Ekran 5 sekmeden oluşuyor:

| Sekme | İçerik | API |
|---|---|---|
| **Genel Bilgiler** | Dönem cirosu kartları, doluluk, cihaz ve yapılandırma bilgileri, ödeme yöntemleri, **Nakit Toplama** kartı, **Ciro Sayımı** kartı | `GET /pos-devices/{sn}/`, `/summary/`, `/products/`, `/cash-history/`, `/revenue-counts/`, `/transactions/`; `POST /collect-cash/`, `POST /count-revenue/` |
| **Satışlar** | Dönem, tarih, durum, tip ve kart son 4 hane filtreleri; istatistik kartları; işlem listesi | `GET /pos-devices/{sn}/transactions/` (yalnızca 1. sayfa) |
| **Stok** | Slot tablosu, "+ Slot Ekle", "Şablon Eşlemesi" | `stock/skus`, `POST /products/create/`, `POST` ve `DELETE /assign-template/` |
| **İstatistikler** | İstatistik kartları | `transactions` |
| **Ayarlar** | Cihaz ayar formu | `PATCH /pos-devices/{sn}/` |

**Bilinen sorunlar:**
- ⚠️ **Gerçek veri gibi görünen sabit değerler:**
  - Geçen Ay cirosu `1665.20` / `110` (510).
  - Şirket adı `"serpetco"` (532).
  - Sahte tarihler, SIM değeri `"80"`, `XRM1`, `509`, `23:30` gibi varsayılanlar (540-583).
  - **`formatCurrency(pendingCash || 1147.12)`** (711): bekleyen nakit yokken ₺1147.12 gösteriyor.
- ⚠️ **Uzaktan Satış modalı tamamen boş bir taslak** (373-457). API çağrısı yok, buton yalnızca Alert gösteriyor.
- ⚠️ Cihaz komutları eklenmemiş. Ekranda "API yok" mesajı görünüyor (2065).
- 🐞 **Satış filtrelerinin bir kısmı isteğe gitmiyor:** saatler, `typeFilter`/`pt_type` ve `tx_status` gönderilmiyor. "Toplam İşlem" yalnızca 1. sayfayı sayıyor.
- 🐞 Bekleyen nakit ve ciro, işlemlerin yalnızca 1. sayfasından toplanıyor, bu yüzden yanlış çıkabilir.
- 🐞 **Ayarlar formunda kaydedilmeyen alanlar:** Seri No, Marka Yazısı, Konum (sahte liste) ve Ücretsiz Vend.
- 🐞 Yetki kontrolleri varsayılan olarak izin veriyor: `sales_visible ?? true` ve `manage_device_settings ?? true` (486-487). Ayarlar sekmesinde ise hiç yetki kontrolü yok.
- 🐞 **Ödeme modu kodlaması tutarsız:** bu ekranda `pos_odemetip` 1=Snack, 2=Kahve. Şablon ekranındaki `normalizeMachineType` ise 1'i Kahve sayıyor. Backend ile netleştirilmeli.
- Ad değişikliği sonrası `["devices"]` listesi yenilenmiyor.
- `src/types/devices.ts` dosyasındaki tipler tekrar tanımlanmış. Yaklaşık 10 yerde `as any` kullanılmış.

### 6.5 Ürün şablonları (`ProductTemplatesScreen`)
- Şablon kartlarında ad, Snack/Kahve etiketi, açıklama, ürün sayısı, eşli cihaz sayısı ve ürün satırları görünür. ⋮ menüsünde Ürünleri Düzenle, Adı Düzenle ve Sil seçenekleri var.
- **API:**
  - Liste: `GET /product-templates/`.
  - Detay: her kart için ayrıca `GET /product-templates/{id}/` (N+1).
  - Oluştur: `POST`, düzenle: `PATCH`, sil: `DELETE`.
  - Cihazlara eşle: `POST /product-templates/{id}/assign/ {device_sns}`.
- **"Cihazlara Eşle" modalı:** 100 cihaz çeker, sonra makine tipini öğrenmek için her cihazın detayını ayrı ayrı ister (N+1).
- 🐞 Makine tipi eşleşmesi ters olabilir (§6.4'teki tutarsızlık). Ön seçim, liste endpoint'inin döndürmediği alanlara dayanıyor. Kaydet butonu kayıt sırasında kilitlenmiyor.

### 6.6 Şablon ürünlerini düzenleme (`TemplateProductsEditScreen`)
- Satır tablosu: slot no, SKU seçimi, fiyat, wildcard ve sil. Kahve şablonlarında reçete kutusu ve "Bileşen Düzeni" tablosu da var.
- **Kaydet:** `POST /product-templates/{id}/items/ {items}`.
- ⚠️ **Bu ekranın büyük kısmı demo:**
  - SKU kataloğu sabit DEMO verisi (162-186). Ham bileşen listesi de sabit.
  - Reçete maliyet ve marj değerleri şablon adına bakılarak uyduruluyor ("kahve şablonu").
- 🐞 **Ürün seçildiğinde `stock_sku` alanı değişmiyor**, yani SKU bağlantısı kayboluyor. Bileşen değişiklikleri hiç kaydedilmiyor.
- "Reçeteyi Düzenle" butonu yalnızca Alert gösteriyor.

### 6.7 Kartlar (`CardsListScreen`, 5 sekme tek dosyada)

| Sekme | Ne yapar | API |
|---|---|---|
| **Personel Kartları** | Aktif ve bekleyen kartlar, grup filtresi, sonsuz kaydırma, kart oluşturma, onay/red, silme | `GET/POST /cards/`, `/cards/{id}/approve/`, `/reject/`, `DELETE` |
| **Kart Grupları** | Grup oluşturma, ad ve cihaz düzenleme, silme | `/card-groups/`, `/pos-devices/` |
| **Bakiye Yükleme** | Periyodik bakiye kuralları | `/recurring-balance/` |
| **İstihkak Yönetimi** | Kart veya grup kotası tanımlama | `/card-quotas/` |
| **İstihkak Yenileme** | Periyodik kota kuralları | `/recurring-quota/` |

**Bilinen sorunlar:**
- 🐞 `CardEdit` ve `CardDetail` route'ları **hiçbir navigator'da tanımlı değil**, bu yüzden düzenle ve detay butonları çalışmıyor (570, 574).
- ⚠️ Çoklu seçim arayüzü var ama bağlı değil. `bulkBalance`, `bulkDelete`, `bulkGroups` ve `rejectAllPending` API'leri hiç çağrılmıyor.
- 🐞 Arama yalnızca yüklenmiş sayfaları süzüyor (API `q` destekliyor). Kart seçicileri yalnızca 1. sayfayı gösteriyor.
- 🐞 "Sonraki Çalışma" tarihi formda toplanıyor ama isteğe eklenmiyor (Bakiye ve Kota yenileme).
- 🐞 "Gruptaki tüm kartlar" seçeneği, kartlar için sırayla tek tek `POST` atıyor. Arada hata olursa kayıtlar yarım kalıyor, ilerleme göstergesi de yok.
- 🐞 Grup cihaz listesi `useEffect` içinde N+1 istekle çekiliyor ve düzenlemeden sonra yenilenmiyor. "Ara" butonunun `onPress` işleyicisi yok.
- 🐞 Arama metni query key'e konmuş ve yüklenirken bütün sekme yeniden çiziliyor. Bu yüzden her tuşta input odağı kayboluyor. Aynı sorun Stok ekranındaki SKU aramasında da var.

### 6.8 Stok (`StockOverviewScreen`, 6 sekme)

| Sekme | Ne yapar | API |
|---|---|---|
| **Özet** | SKU bazında toplam stok, satır açılınca lokasyon dağılımı | `GET /stock/overview/`, `/stock/skus/`, lokasyon başına `/stock/locations/{id}/inventory/` |
| **Lokasyonlar** | Depo, araç ve otomat lokasyonları; ekleme, silme, "Otomatları Senkronize Et" | `/stock/locations/`, `POST /stock/locations/sync-vending/` |
| **SKU/Ürünler** | Basit, bileşik ve hammadde SKU'ları; düzenleme, silme | `/stock/skus/` (oluşturma ekranı yok) |
| **Transfer** | Lokasyonlar arası transfer ve geçmişi | `/stock/transfers/` |
| **Stok Girişi** | Mal kabul | `/stock/receipts/` |
| **Düzeltme** | Sayım farkı (+/-) | `/stock/adjustments/` |

**Bilinen sorunlar:**
- 🐞 Lokasyon dağılımı satır içindeki `.sku` alanını okuyor, oysa tipte bu alan `sku_id` (161). Backend `sku_id` döndürüyorsa dağılım her zaman boş çıkar.
- 🐞 Form seçicileri `["stock-locations-all"]` anahtarını kullanıyor ve bu anahtar hiç invalidate edilmiyor. Lokasyon ekleyip sildikten sonra seçiciler eski listeyi gösteriyor.
- 🐞 Transferde kaynak ve hedef aynı seçilebiliyor. Geçmiş listeleri yalnızca 1. sayfayı gösteriyor.
- 🐞 Sayılar `Number`/`parseFloat` ile çevriliyor, bu yüzden "12,5" gibi virgüllü girişler bozuluyor (tüm formlarda geçerli).

### 6.9 Profil (`ProfileScreen`)
- Hesap bilgileri: ad, kullanıcı adı, e-posta, telefon ve rol rozeti.
- **Bildirim tercihleri:** 6 anahtar (cihaz çevrimdışı, işlem özetleri, düşük stok, kart onayı, rapor hazır, vadesi geçen borç). Okuma `GET /me/notification-preferences/`, değiştirme `PATCH` ile yapılır.
- Menü: Bildirimler, Raporlar, Kullanıcı Yönetimi (owner), KVKK, Gizlilik, Kullanım Koşulları ve Çıkış.
- **Eksik:** profil düzenleme, şifre değiştirme, 2FA kurma/kapatma, hesabı dondurma veya silme. Bunların hepsinin API fonksiyonu `authApi` içinde hazır.

### 6.10 Bildirimler (`NotificationsScreen`)
- `GET /notifications/?page=1`. Tekini okundu yapmak için `POST /notifications/{id}/read/`, hepsini okundu yapmak için `POST /notifications/read-all/` kullanılır.
- **Eksik:**
  - Yalnızca 1. sayfa görünüyor.
  - `data.event` alanı derin bağlantı (deep-link) için tasarlanmış ama yönlendirme yazılmamış.
  - Push bildirim desteği yok (`registerDevice` API'si hazır, istemci tarafı eklenmemiş).

### 6.11 Raporlar (`ReportsListScreen`, `NewReportScreen`)
- **Liste:** `GET /reports/` ile gelir. Kota/limit, saklama süresi, durum rozeti ve ilerleme çubuğu gösterilir. Bekleyen iş varken 4 sn'de bir yenilenir.
- **Aksiyonlar:** İndir (`/reports/{id}/download/` ve ardından paylaşma menüsü), İptal ve Tekrar Dene.
- 🐞 **İndirme bozuk:** Expo 57 ile birlikte `expo-file-system` yeni API'ye geçti. `FileSystem.documentDirectory` ve `downloadAsync` artık yalnızca `expo-file-system/legacy` altında. tsc de bunu hata olarak veriyor.
- ⚠️ **Yeni Rapor ekranı büyük ölçüde mock:**
  - Sabit örnek cihazlar, "İstanbul Anadolu Yakası", şirket `"serpetco"` ve tarih `25.08.2026` gömülü.
  - `filter-options` çekiliyor ama kullanılmıyor.
  - Rapor tipi `"personel_kart"` tipteki `"nfc_balance_logs"` ile uyuşmuyor.
  - Cihaz, durum, ödeme ve tutar filtreleri isteğe eklenmiyor.
  - Tarihler `GG.AA.YYYY` formatında gönderiliyor. Backend büyük ihtimalle ISO bekliyor.

### 6.12 Kullanıcı yönetimi (`UsersListScreen`, yalnızca owner)
- Teknisyen listesi `GET /users/?page=1` ile gelir. Kartlarda cihaz sayısı, stok lokasyonları ve grup rozetleri görünür.
- **Teknisyen Ekle:** `POST /users/`. Cihazlar, gruplar ve varsayılan stok lokasyonları seçilebilir. Seçenekler `GET /users/assignable-options/` ile gelir.
- **Şifre sıfırlama:** `POST /users/{id}/reset-password/`. **Silme:** `DELETE /users/{id}/`.
- **Eksik:** kullanıcı düzenleme (`update` API'si hazır), sayfalama ve arama.
- 🐞 Şifre uzunluğu kırpılmamış değerle kontrol ediliyor ama kırpılmış değer gönderiliyor (148-155). Müşteriye özel placeholder `"serpetotadmin"` gömülü (444).

### 6.13 Yasal metinler (`legal/`)
- `GET /legal/{slug}/` (oturum açmadan da erişilebilir), içerik Markdown olarak gösterilir. `POST /legal/accept/` ile onaylanır.
- 🐞 Markdown stilleri sabit koyu tema renklerinde, açık temada metin okunamıyor.

---

## 7. Backend endpoint envanteri

Tüm yollar `/api/v1/vennexmobile` altındadır.

| Alan | Endpoint'ler | UI'da kullanılıyor mu? |
|---|---|---|
| **Auth** | `POST /auth/login/`, `/auth/2fa/verify/`, `/auth/refresh/`, `/auth/logout/`, `GET /auth/me/` | ✅ |
| | `PATCH /auth/me/`, `POST /auth/change-password/`, `/auth/password-reset/`, `/auth/password-reset/confirm/`, `/auth/deactivate/`, `/auth/delete/` | ❌ |
| | `GET /auth/2fa/status/`, `POST /auth/2fa/setup/`, `/enable/`, `/disable/` | ❌ |
| **Push** | `POST /device/register/`, `/device/unregister/` | ❌ |
| **Tercihler** | `GET`/`PATCH /me/notification-preferences/` | ✅ |
| **Panel** | `GET /overview/dashboard/` | ✅ |
| | `GET /overview/recent-transactions/`, `/overview/locations/` | ❌ |
| **POS cihazları** | `GET /pos-devices/`, `/{sn}/`, `/{sn}/summary/`, `/{sn}/products/`, `/{sn}/transactions/`, `/{sn}/cash-history/`, `/{sn}/revenue-counts/` | ✅ |
| | `PATCH /pos-devices/{sn}/`, `POST /{sn}/collect-cash/`, `/{sn}/count-revenue/`, `/{sn}/products/create/`, `POST`/`DELETE /{sn}/assign-template/` | ✅ |
| | `POST /pos-devices/sort/`, `/{sn}/fill-all-stock/` | ❌ |
| **Şablonlar** | `GET`/`POST /product-templates/`, `GET`/`PATCH`/`DELETE /{id}/`, `POST /{id}/assign/`, `POST /{id}/items/` | ✅ |
| **Kartlar** | `GET`/`POST /cards/`, `PATCH`/`DELETE /cards/{id}/`, `POST /{id}/approve/`, `/{id}/reject/` | ✅ (PATCH ❌) |
| | `GET /cards/{id}/transactions/`, `POST /cards/reject-all-pending/`, `/cards/bulk/balance/`, `/bulk/delete/`, `/bulk/groups/` | ❌ |
| | `/card-groups/` (CRUD), `/recurring-balance/` (CRUD), `/card-quotas/` (CRUD), `/recurring-quota/` (CRUD) | ✅ |
| **Stok** | `GET /stock/overview/`, `/stock/locations/` (CRUD), `/{id}/inventory/`, `POST /stock/locations/sync-vending/` | ✅ |
| | `GET /stock/locations/{id}/movements/` | ❌ |
| | `/stock/skus/` (GET, PATCH, DELETE ✅; POST ❌), `/stock/transfers/`, `/stock/receipts/`, `/stock/adjustments/` | ✅ |
| **Raporlar** | `GET`/`POST /reports/`, `GET /reports/filter-options/`, `/{id}/`, `/{id}/download/`, `POST /{id}/cancel/`, `/{id}/retry/` | ✅ |
| | `DELETE /reports/{id}/` | ❌ |
| **Bildirimler** | `GET /notifications/`, `/notifications/unread-count/`, `POST /{id}/read/`, `/read-all/` | ✅ |
| **Yasal** | `GET /legal/{slug}/`, `POST /legal/accept/` | ✅ |
| **Kullanıcılar** | `GET`/`POST /users/`, `DELETE /users/{id}/`, `POST /{id}/reset-password/`, `GET /users/assignable-options/` | ✅ |
| | `GET`/`PATCH /users/{id}/` | ❌ |

---

## 8. Temel veri modelleri (`src/types`)

- **AuthUser:** `id`, `username`, `first_name`, `last_name`, `email`, `phone`, `role` (`owner`/`tech`/`admin`), `permissions[]`, `companies[]`, `pending_legal_docs[]`.
- **Company:** `id`, `name`, `cari_state` (0 Temiz, 1 Sarı, 2 Kırmızı, 3 Uyarı, 4 Kilitli), `has_personnel_card_device`, `uses_stock_mode`.
- **ApiPeriod:** `today`, `yesterday`, `this_week`, `last_week`, `this_month`, `last_month`, `last_30`, `custom`.
- **Paginated\<T\>:** `count`, `page`, `num_pages`, `page_size`, `next`, `previous`, `results`.
- **Overview:** `OverviewSummary`, `RevenueTimeseries`, `PaymentBreakdownItem`, `TopDevice`, `ErrorBreakdownItem`, `RecentTransaction`, `OverviewLocation`.
- **Devices:** `PosDeviceListItem`, `PosProduct`, `PosTransaction`, `CashHistoryItem`, `RevenueCountItem`, `FillRate`.
- **Cards:** `NfcCard`, `CardGroup`, `RecurringBalanceRule`, `BulkBalanceOperation` (`add`/`subtract`/`set`).
- **Stock:**
  - `StockLocationType`: `warehouse`, `vehicle`, `depot`, `vending_machine`.
  - `StockSku`, `RecipeSummary`, `StockOverviewRow`, `StockInventoryRow`.
  - `StockMovementType`: `transfer`, `receipt`, `adjustment`, `refill`.
- **Reports:**
  - `ReportType`: `pos_detail`, `pos_summary`, `nfc_balance_logs`.
  - `ReportStatus`: `pending`, `running`, `completed`, `failed`, `cancelled`.
- **Users:** `StaffUser`, `AssignableOptions`, `CreateStaffUserPayload`.

---

## 9. Bilinen sorunlar: öncelik listesi

### 🔴 Kritik: kullanıcıya yanlış bilgi gösteriyor ya da veri kaybettiriyor
1. **Gerçek veri gibi görünen sabit değerler.** Cihaz detayında ₺1147.12 bekleyen nakit, `1665.20` ciro, `"serpetco"` şirket adı, sahte tarihler; cihaz listesinde "7 bileşen" ve `110` işlem; panelde tahmini grup dağılımı. *Hepsi temizlenmeli ve veri yoksa "—" gösterilmeli.*
2. **Şablon düzenlemede SKU bağlantısı kayboluyor** (`stock_sku` alanı güncellenmiyor). SKU kataloğu da DEMO verisi.
3. **Rapor indirme bozuk** (`expo-file-system` API değişikliği). Yeni Rapor ekranı filtreleri göndermiyor ve yanlış tarih formatı ile yanlış rapor tipi kullanıyor.
4. **Cihaz ayarlarında bazı alanlar kaydedilmiyor.** Kullanıcı kaydettiğini sanıyor.
5. **Ödeme modu (Snack/Kahve) kodlaması ekranlar arasında tutarsız.** Şablon eşlemede yanlış cihazlar listelenebilir.

### 🟠 Yüksek: özellik çalışmıyor
6. Kart düzenle ve detay butonları ölü (route'lar tanımlı değil).
7. Uzaktan Satış ve cihaz komutları yalnızca taslak.
8. Satış filtrelerinin bir kısmı isteğe gitmiyor. Toplamlar yalnızca 1. sayfadan hesaplanıyor.
9. Kart, cihaz, kullanıcı, bildirim ve stok geçmişi listelerinde sayfalama eksik (çoğu ilk 50 kayıtta ya da ilk sayfada kalıyor).
10. Aramada odak kaybı ve debounce eksikliği (Kartlar ve Stok SKU).
11. Stok dağılımındaki `sku`/`sku_id` uyuşmazlığı. Lokasyon seçicileri eski veriyi gösteriyor.
12. Açık temada okunamayan bileşenler (`Common.tsx`, Markdown).

### 🟡 Orta: kalite ve performans
13. N+1 istekler: cihaz listesi doluluğu, şablon detayları, eşleme modalı, kart grupları.
14. Yetki ve rol kontrolleri neredeyse yok. Varsayılanlar "izin ver" yönünde.
15. Virgüllü ondalık girişler (`"12,5"`) bozuluyor.
16. Çift gönderim koruması yok. `useMutation` ve sunucunun `detail` hata mesajı tutarlı kullanılmıyor.
17. Dev dosyalar (3000+ satır) ve tekrar eden kod: `formatCurrency`, SVG ikonlar, picker modalları, checkbox'lar.
18. Ölü kod: `SalesChartCard`, `HeaderNotificationButton`, `rootApiClient`, kullanılmayan `ProductTemplates` route'u, tekrar tanımlanmış tipler.

---

## 10. Eksik özellikler (API hazır, UI yok)

- Şifremi unuttum, şifre değiştirme ve profil düzenleme
- 2FA kurma ve kapatma (QR / `otpauth_url`)
- Hesabı dondurma ve silme (App Store için hesap silme zorunlu)
- Push bildirimleri: FCM/APNs kaydı ve bildirimden ilgili ekrana yönlendirme (`data.event`)
- Toplu kart işlemleri (bakiye, silme, grup) ve bekleyenlerin hepsini reddetme
- Kart işlem geçmişi ve kart detay/düzenleme ekranları
- SKU oluşturma, lokasyon hareket geçmişi
- "Tüm slotları doldur" (`fill-all-stock`) ve cihaz sıralamasını sunucuya kaydetme
- Rapor silme
- Panelde lokasyon filtresi ve hata dağılımı
- Kullanıcı düzenleme

---

## 11. Geliştirme için önerilen yol haritası

**Faz 0: Temel**
- README ve `.env`/`app.config.ts` ile ortam ayarı (staging/prod).
- ESLint ve Prettier.
- `tsc` hatasını gidermek (`expo-file-system/legacy` ya da yeni `File`/`Paths` API'si).
- `eas.json`, uygulama ikonu ve splash görseli.

**Faz 1: Doğruluk**
- Tüm sahte, sabit ve demo verilerin temizlenmesi (§9 kritik maddeler).
- Ödeme modu kodlamasının backend ile netleştirilip tek bir yardımcı fonksiyonda toplanması.
- Şablon SKU ve bileşen kaydının düzeltilmesi.
- Rapor oluşturma ve indirmenin düzeltilmesi.

**Faz 2: Yapı**
- Dev ekranları sekme ve modal başına dosyalara bölmek: `screens/devices/detail/{GeneralTab,SalesTab,...}.tsx`.
- Ortak `utils/format.ts` (para, tarih, sayı parse), `components/` (Picker, Checkbox, Stepper, Icon) ve `hooks/` (debounce, sayfalı liste).
- Mutasyonları `useMutation` ile standartlaştırmak ve query key'leri merkezi bir `queryKeys.ts` dosyasında toplamak.
- Tema: `Common.tsx` ve Markdown'ı `useAppTheme()` ile çalıştırmak, sistem temasını desteklemek.

**Faz 3: Eksik özellikler**
- Push bildirim ve deep-link desteği.
- 2FA ve hesap yönetimi.
- Kart detay/düzenleme ve toplu işlemler.
- Rol ve yetki tabanlı görünürlük.
- Sayfalama ve sunucu tarafı arama.

**Faz 4: Kalite**
- Birim testleri (format ve normalize fonksiyonları) ve kritik akışlar için E2E testleri (Maestro/Detox).
- Hata izleme (Sentry).
- Gerekirse i18n.
