# İlk Denetim (Phase 0) — Vennex Mobile

> Tarih: 2026-11-18 · Başlangıç noktası: `main` @ `1028e10` (4 commit, ~18.400 satır TS).
> Ayrıntılı uygulama anlatımı: [`../APP_OVERVIEW.md`](../APP_OVERVIEW.md) · Backend sözleşmesi: [`API_CONTRACTS.md`](API_CONTRACTS.md) · Güvenlik: [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md)

## 1. Kaynaklar ve yöntem

| Kaynak | Kullanım |
|---|---|
| RN kodu (bu repo) | Tüm dosyalar okundu; 8 büyük ekran iki bağımsız inceleme ile satır satır analiz edildi |
| Flutter referans uygulaması (`farslab/vennex-mobile`) | RN'in taşındığı orijinal uygulama; `api_references.md` (3.365 satır) dahil dokümanlar |
| Backend kodu (`vennex_mobile` Django app) | Sunucudan **salt-okunur** kopya (yalnız `.py` + dokümanlar; gizli dosyalar hariç). Sözleşmenin doğruluk kaynağı |
| Statik analiz | `tsc --noEmit`, ESLint (expo config), `npm audit` |

Canlı sunucuya (`tms.vennex.com.tr`) hiçbir API isteği atılmadı.

## 2. Mimari (başlangıç durumu)

- Expo SDK 57 / RN 0.86 / React 19.2 / TS strict; React Navigation 7 (iç içe 4 navigator), React Query 5, Zustand (auth, tema), Axios.
- API katmanı ince ve düzgün (token + refresh kuyruğu) ancak: `X-Company-Id` yok, `rootApiClient` kullanılmıyor, hatalar alan bazlı değil.
- Ekran katmanı **monolitik**: 8 dosya 1.000–3.244 satır, API çağrıları ve iş mantığı ekran içinde, `useMutation` neredeyse hiç yok, ~135 `any`.
- Tema: palet var ama `Common.tsx`, Markdown ve grafik sabit koyu renkte → açık temada okunamayan bileşenler.
- Test, lint, EAS, ikon/splash, ortam ayrımı yok.

## 3. Ekran envanteri (başlangıç)

| Ekran | Durum | Kritik sorunlar |
|---|---|---|
| Login / 2FA | Çalışıyor | Şifremi unuttum yok; 2FA 401 durumları ele alınmıyor |
| Legal gate / belge | Çalışıyor | Açık temada okunamaz |
| Panel | Çalışıyor | Uydurma "Grup Dağılımı"; çift fetch; `error_breakdown` kullanılmıyor |
| Cihaz listesi | Kısmen | Satır başına `/products/` (N+1); sahte "7 bileşen", `110`; sayfalama yok; sıralama sunucuya kaydedilmiyor |
| Cihaz detayı | Kısmen | ₺1147,12 / 1665,20 / "serpetco" gibi sabit değerler; uzaktan satış taslak; Snack/Kahve **ters** yazılıyor (0/1 yerine 1/2); bazı ayarlar kaydedilmiyor; filtrelerin yarısı gönderilmiyor |
| Ürün şablonları | Kısmen | Detay N+1; makine tipi eşleşmesi |
| Şablon düzenleme | **Bozuk** | DEMO SKU kataloğu; `stock_sku` kayboluyor; kalemler yanlış payload (`{items:[]}` → backend tek kalem bekliyor); bileşenler kaydedilmiyor |
| Kartlar (5 sekme) | Kısmen | `CardEdit`/`CardDetail` route'ları yok; toplu işlemler bağlı değil; seçiciler yalnız 1. sayfa; "sonraki çalışma" gönderilmiyor; grup kotası sıralı döngü |
| Stok (6 sekme) | Kısmen | `sku` alanı yanlış okunuyor → dağılım boş; eski lokasyon listesi; aynı lokasyona transfer; virgüllü ondalık bozuk |
| Profil | Çalışıyor | Profil düzenleme, şifre, 2FA, hesap silme yok |
| Bildirimler | Kısmen | Yalnız 1. sayfa; deep-link yok |
| Raporlar / Yeni rapor | **Bozuk** | İndirme derlenmiyor (expo-file-system API değişikliği); yeni rapor ekranı büyük ölçüde mock |
| Kullanıcılar | Kısmen | Düzenleme yok; şifre 6 karakter (backend 8) ve sessiz kırpma; sabit placeholder |

## 4. API envanteri

Backend'de **~95 uç** var; başlangıçta RN bunların bir kısmını kullanıyor, birçoğunu yanlış payload ile. Tam tablo ve uç başına RN durumu: [`API_CONTRACTS.md`](API_CONTRACTS.md) §2 ve §4. Öne çıkan sözleşme uyumsuzlukları (§3):

1. `pos_odemetip`: backend 0=Snack, 1=Kahve; RN ayarlar ekranı 1/2 → yanlış tip yazıyor.
2. Şablon kalemi POST tek kalem + zorunlu `price`; RN dizi gönderiyor.
3. Stok envanter satırı `sku` (RN `sku_id` bekliyor).
4. "Bekleyen nakit" için backend alanı yok; RN tek sayfa işlemden tahmin + sabit değer.
5. `X-Company-Id` hiç gönderilmiyor.
6. Sayfalama `{count,page,num_pages,results}` sabit boyut; `page_size` etkisiz; `next/previous` yok.
7. Cihaz komutları PATCH ile, uzaktan satış yalnız WebSocket.

## 5. Güvenlik riskleri

Bkz. [`SECURITY_AUDIT.md`](SECURITY_AUDIT.md). Başlıcaları: varsayılan-izin veren yetki kontrolleri, kullanıcı değişiminde önbellek sızıntısı, geliştirmenin canlı API'ye bağlı olması, axios açıkları; backend'de yetkisiz cihaz komutları ve 7 günlük access token.

## 6. Performans riskleri

- N+1: cihaz listesi (satır başına products), şablon listesi (şablon başına detay), şablon eşleme (cihaz başına detay), kart grupları (grup başına detay), stok dağılımı (lokasyon başına envanter).
- Arama debounce yok + arama metni query key'de + yüklemede tüm sekme yeniden çiziliyor (odak kaybı).
- İstemci filtreleri query key'de → her filtre değişiminde gereksiz istek.
- Polling: panel 30 sn (odak dışında da), okunmamış sayı 60 sn (3 ayrı sorgu kopyası), raporlar 4 sn sabit.
- Uygulama arka plandayken React Query durdurulmuyor (focusManager bağlı değil).

## 7. Tasarım problemleri

- Tutarsız renk kullanımı (ham hex + `isDark ?` ternary'leri yüzlerce yerde), sabit koyu bileşenler.
- Tipografi ölçeği yok; finansal rakamlar hizasız (tabular değil).
- Kart içinde kart, aşırı büyük dekoratif alanlar, emoji ikonlar, tekrar eden SVG ikon kopyaları.
- Erişilebilirlik etiketleri eksik, dokunma alanları küçük, durum yalnız renkle ifade ediliyor.

## 8. Eksik özellikler (backend hazır, mobilde yok)

Şifre sıfırlama · şifre değişimi · 2FA kurulum/kapatma · hesap kapatma/silme · profil düzenleme · şirket seçimi · cari özeti/faturalar · bölge/konum yönetimi · kart detay/düzenleme/işlem geçmişi · toplu kart işlemleri · SKU oluşturma · lokasyon hareketleri · slot CRUD / toplu miktar / tümünü doldur · şablonu cihazlara gönder · cihaz sıralamasını sunucuya kaydet · bildirim sayfalama/deep-link · push bildirimleri · minimum sürüm kontrolü.

## 9. Önceliklendirilmiş plan (uygulanan)

| Faz | İçerik | Durum |
|---|---|---|
| 0 | Denetim, sözleşme çıkarımı, güvenlik/performans riskleri | Tamamlandı |
| 1 | Ortam ayrımı + mock backend, design system, tema, navigasyon kabuğu, API katmanı (şirket, hata, sayfalama), yetki modeli, test/lint altyapısı | Tamamlandı |
| 2–3 | Tüm modüllerin yeni tasarım sistemiyle yeniden yazımı + sahte verinin kaldırılması + sözleşme düzeltmeleri | Sürüyor (modül bazında) |
| 4 | N+1 ve polling optimizasyonu (modüllerle birlikte), ölçümler | Sürüyor |
| 5 | Güvenlik düzeltmeleri (istemci), backend önerileri | İstemci tamam; backend önerileri raporlandı |
| 6 | Unit/component/ekran testleri, E2E planı | Sürüyor |
| 7 | EAS, ikon/splash, ortam, sürüm doğrulama | Yapılandırma tamam; build doğrulaması bekliyor |
