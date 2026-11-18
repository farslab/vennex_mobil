# Vennex Design System

Kaynak: `src/design-system/`. Tüm ekranlar yalnız bu sistemle çizilir; ham hex renk, rastgele margin/padding ve `isDark ? :` ternary'leri kullanılmaz. Kullanım kuralları: [`ENGINEERING_GUIDE.md`](ENGINEERING_GUIDE.md) §5.

## İlkeler

1. **Veri önce.** Rakamlar en güçlü görsel öğedir (metric varyantları, tabular rakam). Dekor yok.
2. **Sakin yüzeyler.** Düz yüzey + ince kenarlık; gölge yalnız yüzen öğelerde (sheet, toast).
3. **Anlamlı renk.** Renk yalnız durum ve aksiyon taşır; durum her zaman metin/ikonla da ifade edilir.
4. **Kompakt ama dokunulabilir.** Yoğun bilgi, ≥44pt dokunma alanı, 375pt genişlikte eksiksiz kullanım.
5. **İki tema, tek kaynak.** Açık/koyu temada aynı semantik token kümesi; sistem teması varsayılan.

## Marka

Logo SVG'sinden birebir: turuncu `#ED6C46`, mavi `#1C77B7`, açık mavi `#36A6DD`, koyu `#333548`. Logo vektörel (`VennexLogo`); koyu temada lacivert yazı kısmı açık renge çevrilir. Turuncu yalnız marka vurgusudur, durum rengi olarak kullanılmaz.

## Renk token'ları (`tokens/colors.ts`)

| Token | Açık | Koyu | Kullanım |
|---|---|---|---|
| `background` | `#F5F7FA` | `#0A0F17` | Ekran zemini |
| `surface` | `#FFFFFF` | `#111925` | Kart, sheet, header, tab bar |
| `surfaceMuted` | `#F0F3F7` | `#182231` | Arama, segment, ikincil alan |
| `surfacePressed` | `#E8EDF3` | `#1E2A3C` | Basılı satır |
| `border` / `borderStrong` | `#E2E7EE` / `#C9D2DE` | `#223044` / `#2F3F57` | Ayraç / kontrol kenarı |
| `text` / `textSecondary` / `textTertiary` | `#0E1726` / `#4A5568` / `#627085` | `#EEF2F7` / `#A9B5C6` / `#7C8AA0` | Metin hiyerarşisi |
| `primary` | `#17589C` | `#4C9AE8` | Birincil aksiyon, seçili durum |
| `success` | `#12784A` | `#3DCB86` | Çevrimiçi, tamamlandı, aktif |
| `warning` | `#965A08` | `#F0B44F` | Beklemede, düşük stok |
| `danger` | `#C2352B` | `#FF6B5E` | Çevrimdışı, başarısız, silme |
| `neutral` | `#5A6678` | `#94A3B8` | İptal, pasif |

Her durum rengi için `*Subtle` zemin tonu vardır. **Kontrast:** tüm metin tonları `surface`/`background` üzerinde, tüm durum renkleri kendi `*Subtle` zemininde WCAG AA (≥4.5:1) — `src/design-system/__tests__/components.test.tsx` bunu otomatik doğrular.

### Durum eşlemesi

| Durum | Ton | Örnek |
|---|---|---|
| Çevrimiçi / Tamamlandı / Aktif / Başarılı | `success` | `<AppBadge tone="success" dot label="Çevrimiçi" />` |
| Beklemede / Hazırlanıyor / Düşük stok | `warning` | |
| Çevrimdışı / Başarısız / Reddedildi | `danger` | |
| İptal / Pasif / Bilinmiyor | `neutral` | |
| Bilgi / Seçili | `info` | |

## Tipografi (`tokens/typography.ts`)

Sistem fontu (SF Pro / Roboto) — yükleme gecikmesi yok, platformla uyumlu.

| Varyant | Boyut/satır | Ağırlık | Kullanım |
|---|---|---|---|
| `display` | 28/34 | 700 | Nadiren; boş ekran başlığı |
| `title` | 22/28 | 700 | Sekme başlığı |
| `headline` | 17/22 | 600 | Sheet / bölüm başlığı |
| `cardTitle` | 15/20 | 600 | Kart başlığı |
| `body` / `bodyStrong` | 15/21 | 400/600 | Gövde |
| `callout` / `calloutStrong` | 14/19 | 400/600 | Yoğun liste metni |
| `caption` | 12/16 | 500 | Yardımcı bilgi |
| `overline` | 11/14 | 600, büyük harf | Bölüm etiketleri |
| `label` | 13/18 | 600 | Form etiketi |
| `metricLg` / `metricMd` | 26/32 · 19/24 | 700 | KPI değerleri (tabular) |
| `numeric` / `numericSm` | 15/20 · 13/18 | 600/500 | Tablo rakamları (tabular) |
| `mono` | 13/18 | 500 | Seri no, SKU kodu |

Dinamik yazı boyutu desteklenir; yoğun sayısal alanlarda büyütme 1.3×, metinde 1.6× ile sınırlıdır.

## Boşluk, köşe, düzen (`tokens/layout.ts`)

- Boşluk ölçeği (4px tabanı): `xxs 2 · xs 4 · sm 8 · md 12 · lg 16 · xl 20 · xxl 24 · xxxl 32 · huge 48`.
- Köşe: `xs 6 · sm 8 (kontroller) · md 12 (kartlar) · lg 16 · xl 20 (sheet) · pill`.
- Düzen: ekran yatay boşluğu 16, kart iç boşluğu 16, bölüm arası 24, kontrol yüksekliği 48 (küçük 36), minimum dokunma 44, tablet içerik genişliği 720.
- Gölge (`elevation(0–3)`) yalnız sheet, toast ve seçili segment için.

## Bileşenler

| Grup | Bileşenler |
|---|---|
| Metin & ikon | `AppText`, `AppIcon` (Feather) |
| Aksiyon | `AppButton` (primary, secondary, outline, ghost, danger, dangerOutline; md/sm; loading kilidi), `AppIconButton` (rozetli, 44pt) |
| Form | `AppInput` (etiket, hata, yardım, şifre göster/gizle, sonek), `AppSearchField`, `AppSelect` (tekli/çoklu, aranabilir, Türkçe duyarsız), `AppCheckbox`, `AppSwitchRow`, `OtpInput` |
| Navigasyon | `AppSegmented` (pill / kaydırılabilir sekme), `AppChip`, `TabHeader` (başlık + şirket seçici + bildirim) |
| Yüzey | `AppScreen` (zemin, padding, pull-to-refresh, sabit alt çubuk), `AppSection`, `AppCard`, `AppListRow`, `AppDivider`, `AppKpi` |
| Katman | `AppSheet` (bottom sheet, klavye uyumlu), `AppConfirmSheet` (kritik işlem özeti + geri alınamaz uyarısı), `AppToastHost` + `toast` |
| Durum | `AppLoading`, `AppSkeleton`, `AppListSkeleton`, `AppEmptyState`, `AppErrorState`, `AppNotice`, `AppBadge` |

### Ekran kalıpları

- **Sekme kökü:** `TabHeader` (şirket adı + büyük başlık + zil) → içerik. Ekran kendi başlığını çizmez.
- **Liste ekranı:** arama + filtre çipleri üstte sabit, `FlatList` + skeleton (ilk yük) + boş/hata durumu + sayfa sonu göstergesi.
- **Detay ekranı:** native başlık; özet kartı → `AppSegmented variant="tabs"` → sekme içeriği.
- **Form:** `AppSheet` (kısa) veya tam ekran (uzun); alt sabit aksiyon çubuğu; alan bazlı hata; kaydedilmemiş değişiklik uyarısı.
- **Kritik işlem:** her zaman `AppConfirmSheet` + işlem özeti; işlem sürerken kilit; sonuç `toast`.

## Erişilebilirlik

- Tüm etkileşimli öğeler `accessibilityRole` + anlamlı `accessibilityLabel` taşır; ikon butonlarında etiket zorunlu.
- Seçim durumları (`checked`, `selected`, `disabled`, `busy`) ekran okuyucuya bildirilir.
- Hata mesajları `accessibilityLiveRegion` ile duyurulur.
- Renk tek başına bilgi taşımaz (rozetler metinli, delta ok işaretli).
