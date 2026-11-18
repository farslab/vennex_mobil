# Vennex Mobile — Mühendislik Rehberi

Bu rehber yeni yazılan her ekran/modül için bağlayıcıdır. Kısa tutulmuştur; ayrıntı için kaynak dosyalara bakın.

## 1. Değişmez kurallar

1. **Canlı sunucuya asla istek atma.** `tms.vennex.com.tr` canlıdır. Testler `axios-mock-adapter`, önizleme `mock-server/` kullanır. curl/fetch ile canlı uca dokunmak yasaktır.
2. **Sözleşme önce gelir.** Her API çağrısı `docs/API_CONTRACTS.md` ve backend kodu (`backend-ref`, yalnız okunur kopya) ile doğrulanır. Backend'de olmayan alan/endpoint uydurulmaz. Belirsizse kodda `// SÖZLEŞME: doğrulanamadı — ...` notu düş ve raporla.
3. **Sahte veri yok.** Veri yoksa `—` / boş durum gösterilir; `?? 1147.12`, `?? 110`, `"serpetco"`, DEMO listeleri gibi yedek değerler YASAK. Tahmini/türetilmiş rakam gösterilecekse açıkça "tahmini" diye etiketlenir — finansal değerlerde hiç yapılmaz.
4. **Varsayılan RED.** Yetki kontrolleri `src/auth/permissions.ts` ile yapılır (`?? true` yasak). UI gizleme güvenlik değildir; backend 403'ü kullanıcıya anlaşılır gösterilir.
5. **`any` yok.** `unknown` + daraltma veya doğru tip. Backend tipleri `src/types/<domain>.ts` içinde tek kaynaktır.
6. **Çalışmayan buton bırakma.** Backend desteklemiyorsa özelliği gösterme ya da `AppNotice` ile "henüz desteklenmiyor" de; asla sahte başarı gösterme.

## 2. Katmanlar

```
src/api/<domain>.ts      → saf HTTP fonksiyonları (apiClient), yanıt normalizasyonu, AbortSignal desteği
src/types/<domain>.ts    → backend şemaları (para alanları string|number olabilir → toNumber ile oku)
src/api/queryKeys.ts     → TÜM query key'ler (yeni key gerekiyorsa buraya ekle)
src/screens/<domain>/... → ekranlar; büyük ekranlar tabs/, components/, hooks/ alt klasörlerine bölünür
src/hooks/               → paylaşılan hook'lar (usePagedList, useDebouncedValue, useUnreadNotificationCount)
src/utils/               → number.ts (formatCurrency, parseDecimal, toApiDecimal, toNumber), date.ts, text.ts, validation.ts
mock-server/routes/NN-<domain>.js → yerel mock uçları (kurgusal veri, sözleşmeye uygun şekil)
```

- `apiClient` (src/api/client.ts) token ekler, 401'de tek refresh yapar, `X-Company-Id` header'ını otomatik ekler, hataları `ApiError` (`message`, `status`, `fieldErrors`, `isNetworkError`) olarak fırlatır.
- Sayfalı uçlar `{count, page, num_pages, results}` döner, sayfa boyutu sabittir → `usePagedList` (src/hooks/usePagedList.ts). `page_size` göndermeyin.
- Sayfasız uçlar `{results: [...]}` → `unwrapResults` (src/api/pagination.ts).

## 3. Veri çekme kuralları (sunucu yükü)

- Arama: input anında güncellenir, sorgu `useDebouncedValue(q, 350)` ile tetiklenir. Arama yüklenirken input asla unmount edilmez (liste alanında skeleton/footer göster, tüm ekranı `AppLoading` ile değiştirme).
- Filtreler backend destekliyorsa sunucu tarafında uygulanır; desteklemiyorsa istemcide `useMemo` ile (query key'e koymadan).
- N+1 yasak: satır başına detay isteği atma. Gerekli alan listede yoksa göstermeyin veya detay ekranına bırakın; backend değişikliği gerekiyorsa raporlayın.
- Polling yalnızca gerektiğinde, ekran odaktayken (`refetchInterval` + React Query focusManager uygulama arka plandayken zaten durdurur). Rapor işi gibi durum takibinde yalnız bekleyen kayıt varken ve artan aralıkla.
- `queryFn: ({ signal }) => api.x(params, signal)` — iptal desteği.

## 4. Mutasyonlar

- Her yazma `useMutation` ile; `isPending` iken buton `loading` (çift gönderim engeli). Mutasyonlar asla otomatik retry edilmez (queryClient varsayılanı).
- Başarıda ilgili domain kökünü invalidate et: `queryClient.invalidateQueries({ queryKey: queryKeys.devices.all })`; başarı bildirimi `toast.success("…")`.
- Hata: alan hataları `error.fieldErrors` ile ilgili inputa, genel hata `AppNotice`/`toast.error`. Form verisi hata sonrası korunur.
- Finansal / stok / silme / toplu işlemler `AppConfirmSheet` ile **işlem özeti** gösterilerek onaylatılır (`summary`, `destructive`, `irreversible`).
- Ondalık girişler `parseDecimal` ile okunur ("12,5" desteklenir), backend'e `toApiDecimal(n)` (string "12.50") gönderilir.
- Tarih filtreleri `toApiDate(date)` (YYYY-MM-DD, yerel gün).

## 5. Design system (src/design-system)

`import { AppText, AppButton, AppCard, ... , useTheme, makeStyles, toast } from "@/design-system";`

| Bileşen | Kullanım |
|---|---|
| `AppScreen` | Ekran zemini + padding + pull-to-refresh (`scroll={false}` → FlatList ekranları) |
| `AppSection` | Başlıklı bölüm (overline başlık + opsiyonel aksiyon) |
| `AppCard` | Kart yüzeyi (`title`, `headerRight`, `onPress`, `padded`) |
| `AppListRow` | Ayar/menü/özellik satırı (ikon, başlık, alt başlık, değer, chevron) |
| `AppKpi` | KPI kutusu (label, value, caption, delta) |
| `AppText` | Tüm metin — `variant`: display/title/headline/cardTitle/body/bodyStrong/callout/calloutStrong/caption/overline/label/metricLg/metricMd/numeric/numericSm/mono |
| `AppButton` | primary/secondary/outline/ghost/danger/dangerOutline, `loading`, `icon` |
| `AppIconButton` | 44pt ikon butonu, `label` zorunlu (erişilebilirlik) |
| `AppInput` | label, error, helper, `secure`, `suffix`, `icon` |
| `AppSearchField` | arama kutusu (debounce dışarıda) |
| `AppSelect` | tekli/çoklu seçim (sheet + arama) |
| `AppSegmented` | `variant="pill"` (2–4 seçenek) veya `"tabs"` (kaydırılabilir sekme) |
| `AppChip` | filtre çipi |
| `AppCheckbox`, `AppSwitchRow` | form kontrolleri |
| `AppBadge` | durum rozeti (`tone`: success/warning/danger/info/neutral, `dot`) — renk + metin |
| `AppSheet` | alttan açılan sayfa (form, detay) — `footer` ile sabit aksiyonlar |
| `AppConfirmSheet` | kritik işlem onayı + özet |
| `AppLoading`, `AppListSkeleton`, `AppSkeleton`, `AppEmptyState`, `AppErrorState`, `AppNotice` | durumlar |
| `toast.success/error/info` | geçici bildirim |
| `AppIcon` | Feather ikon seti |

- Stil: `const useStyles = makeStyles((t) => StyleSheet.create({...}))` — yalnız `t.colors.*`, `t.spacing.*`, `t.radius.*`, `t.layout.*`, `t.typography.*`. **Ham hex renk yasak.** `isDark ? a : b` ternary'leri yerine token kullanın.
- Tasarım dili: düz yüzeyler, ince kenarlıklar, kompakt yoğun bilgi, büyük sayısal değerler `metric*` varyantlarında, durumlar rozetle. Gradient / dekoratif gölge / emoji yok. Ekran yatay boşluğu `t.layout.screenPadding`.
- Listeler `FlatList` (büyük veri için `ScrollView` yasak), `keyExtractor` sabit id, `onEndReached` ile `loadMore`, `ListFooterComponent` ile sayfa yükleniyor göstergesi.
- Erişilebilirlik: dokunma alanı ≥44pt, `accessibilityRole/Label`, renk tek başına bilgi taşımaz.

## 6. Navigasyon

- Rotalar `src/navigation/types.ts` (`RootStackParamList`). Detay ekranları kök stack'e açılır: `navigation.navigate("DeviceDetail", { sn })`.
- Navigator dosyalarını (`RootNavigator.tsx`, `screenRegistry.ts`, `types.ts`) modül çalışanları düzenlemez; yeni rota ihtiyacı rapora yazılır.
- Sekme kök ekranlarının başlığını `TabHeader` verir; ekran kendi başlığını çizmez.

## 7. Test

- `npm test` (jest-expo + @testing-library/react-native v14 — `render`, `fireEvent` **async**: `await render(...)`, `await fireEvent.press(...)`).
- API: `new MockAdapter(apiClient)` ile istek URL/parametre/gövde doğrulaması + normalizasyon testleri.
- Ekran: `renderWithProviders` (src/test/utils.tsx) + MockAdapter; loading/empty/error/retry/aksiyon/çift gönderim/yetki senaryoları.
- Navigasyon gerektiren ekranlarda `@react-navigation/native`'in `useNavigation`'ını `jest.mock` ile sahteleyin veya ekranı `NavigationContainer` içine koyun.
- `npm run typecheck`, `npm run lint` temiz olmalı (başkasının yarım dosyasındaki hata hariç).
