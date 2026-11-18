# Backend Değişiklikleri — `farslab/scc_lith`

> Dal: **`feature/mobil-ortak-yetki-ota`** (yerel klon: `../backend-scc_lith`, `main` @ `1a91735` tabanlı).
> Durum: **CANLIDA** — 2026-11-18 19:48 (sunucu `main`: `90057ad` sunucudaki commit edilmemiş performans düzeltmeleri + `9e2fd69` bu dal).
> Migration'lar `api.0262`, `vennex_mobile.0009` uygulandı; önceki OTA tablosu yedeği: `db_backups/api_otarelease_pre_mobil_20261118_194814.sql`.
> Yalnız web konteyneri yeniden başlatıldı (celery değişmedi). Sonraki 1,5 saatte 5xx/traceback: 0. Sürüm politikası kayıtları (iOS/Android 1.0.0) oluşturuldu.
> **GitHub'a push edilmedi**: sunucu `main`'i `origin/main`'in 2 commit önünde.

## Amaç

1. **Web ve mobil tek kaynaktan beslensin.** Yetki kuralları, modül (menü) görünürlüğü, enum etiketleri ve özellik bayrakları tek dosyada tanımlanır. Web şablonları ve mobil uygulama aynı sonucu alır. Web'de bir kural değişince mobil uygulamanın yeniden yayınlanması gerekmez.
2. **Mobil uygulama için OTA ve zorunlu güncelleme.** POS uygulamasının (vennexRN) kullandığı Xavia OTA altyapısı mobil uygulamaya da açılır; minimum sürüm admin panelinden yönetilir.
3. **Mobil API güvenlik düzeltmeleri.**

## Değişiklikler

### 1. Ortak yetenek kaydı — `dashboard_v2/capabilities.py` (yeni)

| Kayıt | İçerik |
|---|---|
| `CAPABILITIES` | `owner, tech, view_sales, manage_device_settings, send_device_commands, select_machine_type, remote_vend, manage_personel_card, change_card_balance, manage_stock`. Her biri `dashboard_v2.utils` fonksiyonuna ve ilgili Django grubuna bağlı. |
| `MODULES` | `dashboard, devices, cards (manage_personel_card + has_personnel_card_device), stock (manage_stock + uses_stock_mode), reports (view_sales), users/cari/regions (owner), profile` |
| `enum_catalog()` | Model `choices` alanlarından üretilir: makine tipi, ödeme tipi, kart tipi, stok lokasyon/hareket tipi, rapor tipi, işlem durumu, cari durumu |
| `features()` | Uzaktan satış (WS), push, OTA bayrakları |

- `vennex_mobile/permissions.py` → `compute_permissions` artık doğrudan `user_capabilities()`. Personel kart kuralları bu kayıttan import edilir; davranış değişmedi.
- **Yeni yetenek `send_device_commands`.** Mevcut iş kuralını aynen korur: komutlar, cihaza erişimi olan her yönetim kullanıcısına açık (`dashboard_v2` ile aynı). Bu kural daraltılmak istenirse yalnız `can_send_device_commands` değiştirilir; web ve mobil birlikte etkilenir. Bkz. SECURITY_AUDIT S7.
- **Web:** `dashboard_v2.context_processors.capabilities` eklendi (`core/settings.py` TEMPLATES). Şablonlar `{% if 'manage_stock' in caps %}` ve `nav_modules` kullanabilir. Değerler tembel hesaplanır; kullanılmazsa sorgu atılmaz. Mevcut `can_view_sales` bağlamı korunur.

### 2. Uygulama yapılandırma ucu — `GET /api/v1/vennexmobile/app/config/` (yeni)

Oturum açmış kullanıcı + `X-Company-Id` için şunları döndürür: `permissions`, şirkete göre `modules`, `enums`, `features`, `version_policy`. Mobil uygulama sekme görünürlüğünü buradan alır. Uç yoksa (eski backend) yerel kurallarla çalışmaya devam eder.

### 3. Mağaza sürüm politikası

- Model `vennex_mobile.MobileAppVersionPolicy` (platform başına tek kayıt): `min_version`, `latest_version`, `force_update`, `store_url`, `message`. Admin: **Mobil Sürüm Politikaları**.
- `GET /app/min-version/?platform=ios&version=1.0.0` → eski alanlar korunur (`ios_min`, `android_min`, `force_update`, `store_urls`). Yeni alanlar: `platforms`, `status.update_required` ve `status.update_available`. DB kaydı yoksa `settings.VENNEX_MOBILE_*` değerlerine düşer.

### 4. OTA: iki uygulama, tek Xavia sunucusu

- `api.OtaRelease.app` alanı (`pos-device` varsayılan | `vennex-mobile`). `unique_together` → `(app, runtime_version, number)`.
- `manage.py ota_release ... --app vennex-mobile`: numaralar uygulama + runtime başına ayrı artar. **Mobil yayınlar POS cihazlarına `ota_available` göndermez.**
- `nexus/views/ota.py`: POS filo takibi yalnız `pos-device` yayınlarını dikkate alır. Aksi halde bir mobil yayın, POS'un "güncel hedefi" sanılabilirdi.
- Runtime ad alanları çakışmaz: POS `"87"`, mobil `"vm-1.0.0"`, mobil staging `"vm-1.0.0-stg"`.

### 5. Güvenlik düzeltmeleri (yalnız mobil API)

| # | Sorun | Düzeltme |
|---|---|---|
| B1 | Parola değişimi/sıfırlama/hesap kapatma `OutstandingToken` kayıtlarını **siliyordu**. Bu hiçbir oturumu kapatmıyordu; üstelik `BlacklistedToken` CASCADE ile silindiği için çıkış yapılmış refresh token'lar **yeniden geçerli** oluyordu. | `revoke_all_refresh_tokens()`: tüm token'lar kara listeye alınır (`views/auth.py`) |
| B2 | 2FA'da her yeni giriş yeni 5 deneme hakkı veriyordu | Kullanıcı başına saatte 10 hatalı deneme → 429 |
| B3 | Personel parolası 6 karakter ve sessizce kırpılıyordu | min 8 karakter, kırpma yok (baştaki/sondaki boşluk reddedilir), alan hatası |
| B4 | Kullanıcı adı çakışması büyük/küçük harfe duyarlıydı ve `{detail}` olarak dönüyordu | `iexact` kontrolü + `{username: [...]}` |
| B5 | Hareket geçmişi olan lokasyon/SKU silinince 500 dönüyor (ProtectedError) veya denetim izi kayboluyordu | 400 + açıklama; hareketi olan SKU silinemez |
| B6 | Aynı adlı lokasyon 500 (IntegrityError) | 400 alan hatası |
| B7 | Stok düzeltme `reason` alanı kaydedilmiyordu | `StockMovement.notes`'a yazılır |

### Migration'lar

- `api/migrations/0262_mobile_app_ota_ve_surum.py`: `OtaRelease.app` + `unique_together`. Mevcut kayıtlar `pos-device` olur.
- `vennex_mobile/migrations/0009_mobile_app_ota_ve_surum.py`: `MobileAppVersionPolicy`.

### Testler

- Yeni: `vennex_mobile/test_app_config.py` (16), `vennex_mobile/test_security_fixes.py` (9).
- Mevcut `vennex_mobile`, `dashboard_v2`, `nexus`, `api.test_ota_runtime` paketleri ile birlikte: **107/107 geçti** (`backend-local/run.sh test vennex_mobile dashboard_v2 nexus api.test_ota_runtime`).

## Canlıya alma planı (önerilen sıra)

> ⚠️ **Sunucudaki çalışma dizininde commit edilmemiş değişiklikler var** (`api/models.py`, `dashboard/views.py`, `dashboard_v2/views/pos_devices.py` ve şablonlar). Birisi doğrudan canlıda çalışıyor. Bu dal birleştirilmeden önce o değişiklikler commit edilmeli. Ayrıca `api/models.py`'ye başka bir migration eklenmişse **0262 numarası çakışabilir**; gerekirse `makemigrations --merge` yapılmalı.

1. Sunucudaki commit edilmemiş değişiklikleri sahibi commit edip push etsin.
2. Bu dalı `main` üzerine rebase et; migration numarasını kontrol et; testleri çalıştır.
3. Canlıda: `git pull` → `docker exec spserpetpaycom-web-1 python manage.py migrate` (yalnız eklemeli değişiklikler; mevcut OTA kayıtları `pos-device` olur) → web/celery yeniden başlat.
4. Admin → **Mobil Sürüm Politikaları**: iOS ve Android için `1.0.0`, mağaza bağlantıları.
5. Kontrol: `GET /app/min-version/`, oturumlu `GET /app/config/`, Nexus → OTA sayfası (POS görünümü değişmemeli), vennexRN `tools/ota-publish.sh` (değişiklik gerekmez; `--app` varsayılanı `pos-device`).
6. Mobil uygulamanın mağaza sürümü bundan **sonra** yayınlanmalı. Uygulama eski backend'de de çalışır (yerel yedek kurallar), ama sunucu tarafı modül kararı ve zorunlu güncelleme bu dal canlıda olunca etkinleşir.

**Geri alma:** migration'lar eklemelidir. Geri dönmek için `migrate api 0261` ve `migrate vennex_mobile 0008` + kod geri alma yeterli; veri kaybı olmaz (yalnız yeni tablo ve sütun silinir).

## Yerel geliştirme ortamı (canlıya dokunmaz)

`../backend-local/`: izole Postgres (`vennex_local`) + Redis. Celery worker yok; push, Telegram, Paraşüt ve ödeme sağlayıcıları kapalı.

```bash
../backend-local/run.sh server
```

```bash
../backend-local/run.sh seed
```

```bash
../backend-local/run.sh test vennex_mobile dashboard_v2 nexus
```

Not: Tarihsel migration zinciri sıfırdan çalışmıyor (`api.0104` silinmiş bir `terminal` alanına referans veriyor). Yerel ve CI veritabanı `SYNCDB=1` ile doğrudan modellerden kurulur. Bir test/staging sunucusu kurulacaksa bu migration'ın düzeltilmesi önerilir.

## Backend için diğer öneriler (bu dalda yapılmadı)

Modül çalışanlarının kod incelemesinde bulundu; ayrıntı ve satır numaraları `SECURITY_AUDIT.md` ve `API_CONTRACTS.md` içinde.

- Cihaz listesine `id`, `pos_odemetip` ve makine tipi filtresi eklenmeli (şablon eşlemedeki N+1'i kaldırır). Detaya `pending_cash` ve `assigned_template`, işlemlere saat filtresi eklenmeli.
- Birleşik `cards/bulk/` ve `stock/movements/` POST uçları `request._request` iletimi nedeniyle büyük olasılıkla bozuk (mobil, alias uçları kullanıyor).
- Periyodik bakiye kuralında `change_card_balance` kontrolü yok; bakiye güncellemesinde satır kilidi yok (yarış durumu).
- Rapor uçları: `str(None)` → "None", geçersiz `report_type` sessizce `pos_detail` oluyor, eşzamanlı iş kontrolü kilitsiz, eksik dosyada 500 dönüyor.
- `overview.py`: sayısal olmayan `top_limit` 500 veriyor; özel aralık sınırsız.
- Kullanıcı listesine `?q=` araması; e-posta benzersizlik kontrolü.


---

# İkinci dal — `feature/mobil-geri-bildirim` (2026-11-18) · **CANLIDA** (23:53)

| Parça | Dosya | Açıklama |
|---|---|---|
| Model | `vennex_mobile/models.py` → `MobileFeedback` + `migrations/0010_mobil_geri_bildirim.py` | Kaynak (app/web), tür (öneri/hata/soru/diğer/hesap silme), mesaj, kullanıcı/şirket (SET_NULL), iletişim, platform/sürüm, IP (yalnız web), durum, dahili not, okuyan |
| Mobil API | `vennex_mobile/views/feedback.py`, `urls.py` | `GET/POST /feedback/` (saatte 10 gönderim) |
| Herkese açık sayfalar | `vennex_mobile/views/public_pages.py`, `public_urls.py`, `templates/vennex_mobile/public/*` | `/vennexmobile/yasal/<slug>/`, `/vennexmobile/hesap-silme/` |
| Kök URL | `core/urls.py` | `path("vennexmobile/", include("vennex_mobile.public_urls"))` |
| Panel kapısı | `dashboard/middleware.py` | `/vennexmobile/` oturumsuz muafiyet (yalnız bu önek) |
| Yasal API | `vennex_mobile/views/legal.py` | `web_url` boşsa herkese açık sayfanın mutlak adresi |
| Nexus | `nexus/views/mobile_feedback.py`, `urls.py`, `templatetags/nexus_extras.py`, `theme/templates/nexus/pages/mobile_feedback_*.html`, `components/sidebar.html` | Liste (arama/durum/tür), detay (okundu işareti), durum + dahili not, okunmamış rozeti; yalnız superuser; LogEntry kaydı |
| Admin | `vennex_mobile/admin.py` | Salt okunur kayıt + durum/not |
| Testler | `vennex_mobile/test_feedback.py` | 16 test |

Doğrulama (yerel izole DB): `vennex_mobile`, `nexus`, `dashboard_v2`, `api.test_ota_runtime` → **123/123 OK**.
Canlıya alma (2026-11-18 23:52–23:53): sunucu temizdi (HEAD `9e2fd69`, commit edilmemiş değişiklik yok), yama `git am` ile uygulandı → sunucu `main` = `d0196d9`; yalnız `vennex_mobile.0010` uygulandı (yeni tablo); `manage.py check` temiz; yalnız web konteyneri yeniden başlatıldı (36 sn). Kontrol: yasal sayfalar ve hesap silme formu 200 (tms.vennex.com.tr ve sp.serpetpay.com, HTTPS), `feedback/` oturumsuz 401, Nexus sayfası girişe 302, mevcut uçlar normal, 5xx/traceback 0. Canlıda form gönderimi yapılmadı.
Geri dönüş: `migrate vennex_mobile 0009` + `git revert d0196d9` + web yeniden başlatma. **GitHub'a push edilmedi** (sunucu `main`, `origin/main`'in 1 commit önünde).
