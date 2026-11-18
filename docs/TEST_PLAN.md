# Test Planı — Vennex Mobile

## Araçlar

| Katman | Araç | Komut |
|---|---|---|
| Tip | TypeScript 6 strict | `npm run typecheck` |
| Lint | ESLint 9 (eslint-config-expo) + Prettier | `npm run lint` |
| Unit / component / ekran | Jest 29 + jest-expo 57.0.4 + @testing-library/react-native 14 | `npm test` |
| API sözleşme | axios-mock-adapter (istek URL/parametre/gövde + yanıt normalizasyonu) | `npm test` |
| E2E | Maestro (`e2e/maestro/*.yaml`) + yerel mock backend | `npm run mock` & `maestro test e2e/maestro` |
| Hepsi | | `npm run check` |

> **Canlı veri kuralı:** Hiçbir test canlı sunucuya bağlanmaz. Jest'te ağ `axios-mock-adapter` ile kesilir (`client.test.ts` test ortamının canlı adresi hedeflemediğini ayrıca doğrular); E2E yerel mock sunucuya (`mock-server/`) karşı çalışır. Finansal ve stok hareketleri yalnız mock/test ortamında denenir.

## Sürüm uyumluluğu (doğrulandı)

- `jest-expo@57.0.4` + `@react-native/jest-preset@0.86.2` (jest-expo ≥57.0.5 RN 0.86.3 ister → Expo 57'nin beklediği 0.86.2 ile çakışır).
- `@testing-library/react-native@14` → `test-renderer@~1.2` (React 19.2 ile uyumlu reconciler 0.33). v14'te `render` ve `fireEvent` **async**.
- Global mock'lar (`jest.setup.ts`): SecureStore (bellek içi), AsyncStorage, NetInfo, safe-area-context.

## Kapsam matrisi

Her ekran için uygulanan kontroller (✔ = otomatik test var):

| Kontrol | Açıklama |
|---|---|
| İlk açılış | Hatasız render, doğru ilk istek |
| Loading | İskelet/yükleniyor; yenilemede içerik korunur |
| API | Doğru uç, parametre, gövde (MockAdapter history) |
| Veri eşleme | Para/tarih/miktar formatları, eksik alanda "—" (uydurma değer yok) |
| Empty / Error / Retry | Boş durum, hata mesajı, tekrar dene |
| Input / Validation | Alan bazlı hata, Türkçe ondalık, tarih aralığı |
| Actions | Buton gerçekten istek atar; onay sayfası özeti |
| Çift gönderim | İşlem sürerken ikinci dokunuş istek atmaz |
| Permissions | Yetkisiz kullanıcıda aksiyon/rakam gizli (varsayılan RED) |
| Navigation | Doğru rota + parametre |
| Refresh / Pagination | Pull-to-refresh, sonraki sayfa, son sayfada durma |
| Theme | Token tabanlı; kontrast testi |

Ekran bazlı sonuçlar: [`TEST_RESULTS.md`](TEST_RESULTS.md).

## Negatif senaryolar

| Senaryo | Nerede test ediliyor |
|---|---|
| İnternet yok / ağ hatası | `client.test.ts` (isNetworkError, Türkçe mesaj), `authStore.test.ts` (çevrimdışı açılış oturumu silmez) |
| API 500 | `client.test.ts`, ekran hata durumları |
| API 401 + refresh başarılı / başarısız | `client.test.ts` |
| Eşzamanlı 401 | `client.test.ts` (tek refresh) |
| Zaman aşımı | `client.test.ts` |
| 429 hız sınırı | `ForgotPasswordScreen.test.tsx`, rapor oluşturma |
| Boş / null / beklenmeyen alanlar | `number.test.ts`, `pagination.test.ts`, `users.test.ts`, modül normalizasyon testleri |
| Yetkisiz işlem / bozuk yetki listesi | `permissions.test.ts`, modül ekran testleri |
| Çift tıklama | `LoginScreen.test.tsx`, `components.test.tsx` (AppButton loading), modül mutasyon testleri |
| Erişimi olmayan şirket | `authStore.test.ts`, mock sunucu 403 |
| Şirket değişimi | `authStore.test.ts` (header + önbellek sıfırlama) |

## E2E kullanıcı yolculukları

`e2e/maestro/` altında. Çalıştırma:

```bash
npm run mock
```

```bash
APP_ENV=development npx expo run:ios
```

```bash
maestro test e2e/maestro
```

| # | Yolculuk | Akış dosyası |
|---|---|---|
| 1, 19, 20 | Giriş, 2FA, yasal onay, oturum geri yükleme | `01_login_2fa.yaml`, `02_session_company_theme.yaml` |
| 2–4 | Panel → cihaz detayı → satış filtreleri → ayar kaydetme | `03_devices.yaml` |
| 5–7 | Şablon oluşturma, SKU ekleme, cihaza eşleme | `04_templates.yaml` |
| 8–10 | Personel kartı, grup, bakiye yükleme | `05_cards.yaml` |
| 11–14 | Lokasyon, stok girişi, transfer, düzeltme | `06_stock.yaml` |
| 15–16 | Rapor oluşturma/indirme, bildirim okundu | `07_reports_notifications.yaml` |
| 17–18 | Teknisyen oluşturma, yetki kontrolü | `08_users.yaml` |
