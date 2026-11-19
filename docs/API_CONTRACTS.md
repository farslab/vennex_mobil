# Vennex Mobile — Backend API Sözleşmesi (RN denetimi için)

> **Hazırlanma:** 2026-11-18 · **Yöntem:** yalnızca yerel dosya okuma (hiçbir HTTP/WS çağrısı yapılmadı).
> **Doğruluk sırası:** backend kodu (urls/views/serializers/permissions) > backend dokümanları > Flutter dokümanları > Flutter kodu > RN kodu.
> Gizli değer (token, parola, anahtar, servis hesabı) bu dokümana kopyalanmamıştır; postman örnekleri maskelenmiştir.

## 0. Kaynak kısaltmaları

| Kısaltma | Konum |
|---|---|
| `BE:` | Backend kaynak kopyası `backend-ref/vennex_mobile/` (Django app; mount `core/urls.py:32` → `api/v1/vennexmobile/`) |
| `BE-api:` | `backend-ref/api/models.py` (POSDevice, POSTransaction, …) |
| `BE-doc:` | `backend-ref/docs/*.md` (VENNEX_MANAGEMENT_APP_API_REFERENCE.md = `BE-doc:APIREF`, …_BACKEND.md, …_SPEC.md, VENNEX_MOBILE_WS.md, RECETE_STOK_SISTEMI.md) |
| `FL-doc:` | Flutter repo dokümanları `vennexmobile/api_references.md` (= `FL-doc:API`), `vennex_mobile.md`, `vennex_mobile_ws.md`, `backend_changes.md`, `cache_strategy.md`, `postman_collection.json` |
| `FL:` | Flutter kodu `vennexmobile/lib/…` |
| `RN:` | Bu repo `vennex_mobil/src/…` |

**Kaynak etiketi (tablolarda):** `backend` (backend kodu doğruladı) · `doc` (yalnız doküman) · `flutter-code` · `both` (doc + flutter-code, backend kodu yok/okunmadı) · `RN-only (doğrulanamadı)`.
**RN etiketi:** `RN: kullanıyor` (api fonksiyonu var ve ekranda çağrılıyor) · `RN: kullanmıyor` (api fonksiyonu var, ekranda çağrı yok) · `RN'de yok`.

---

## 1. Temel sözleşme

### 1.1 Base URL / prefix
- REST: `https://tms.vennex.com.tr` + `/api/v1/vennexmobile/` (`BE:../core/urls.py:32`, `FL:core/config/api_config.dart:12`, `RN:api/client.ts:6-8`). Tüm path'ler trailing slash.
- İstisna: şikayet `POST /api/wallet/complaint/` (prefix dışı, wallet servisi; `FL:api_config.dart:203`). Bu backend kopyasında yok → `doc`.
- WS (uzaktan satış): `wss://<host>/ws/dashboard/pos/<sn>/?token=<access>`. Host: Flutter default `tms.vennex.com.tr` (`FL-doc:vennex_mobile_ws.md:9-14`); backend dokümanı farklı bir host yazıyor (`BE-doc:APIREF:1707`) → **prod host'u backend ekibiyle teyit edin**. WS routing dosyası kopyada yok; yalnız `BE:ws_auth.py` (JWT query middleware).

### 1.2 Kimlik doğrulama (JWT)
- `Authorization: Bearer <access>`; simplejwt. Login yanıtı `{access, refresh, user}` (`BE:views/auth.py:110-124`). Token claim'leri: `role`, `permissions`, `company_ids` (`BE:views/auth.py:113-119`, `BE:authentication.py:79-85`).
- Yalnız `role ∈ {owner, tech, admin}` girebilir; diğerleri 403 "Bu uygulamaya giriş yapamazsınız." (`BE:views/auth.py:~159-164`, `BE:permissions.py:59-65`).
- **Ömür:** access TTL **7 gün** (yalnız `BE-doc:APIREF:1747`); refresh ömrü ve rotation ayarı **dokümanda yok / settings kopyada yok**. `POST /auth/refresh/` = simplejwt `TokenRefreshView` (`BE:views/auth.py:231-234`) → yanıt `{access}` (rotation açıksa `refresh` de). RN `data.refresh ?? refreshToken` ile doğru tolere ediyor (`RN:api/client.ts:93`).
- Parola değişimi / reset / deactivate / delete → kullanıcının tüm `OutstandingToken`'ları silinir (diğer oturumlar düşer) (`BE:views/auth.py:360,428,441,452`).
- 2FA bekleme oturumu: `session_token` 5 dk (`PENDING_2FA_TTL=300`), en fazla 5 yanlış deneme (`BE:views/auth.py:47-50`).

### 1.3 Header'lar
| Header | Durum | Kanıt |
|---|---|---|
| `X-Company-Id: <int>` | **Şirket kapsamı.** `CompanyContextMixin` kullanan tüm view'larda okunur; geçersiz → 403 "X-Company-Id geçersiz.", erişilmeyen şirket → 403 "Bu şirkete erişiminiz yok.", yoksa kullanıcının **ilk** şirketi seçilir | `BE:mixins.py:19-51`; Flutter gönderir `FL:core/networking/dio_client.dart:78-85` |
| `X-Device-Id` | Opsiyonel; `device/register` body'de `device_id` yoksa buradan alınır | `BE:views/device.py:31`, `FL:dio_client.dart:63-76` |
| `X-App-Version` | Flutter gönderir; backend kodunda **okuyan yok** | `FL:dio_client.dart:59` |
| `X-Bypass-Cache: 1` | `?nocache=1` ile eşdeğer cache bypass | `BE:cache.py:129-132` |
| Idempotency-Key | **Yok** (backend'de hiç geçmiyor). `device/register` doğal olarak idempotent upsert | `BE:views/device.py:17-60` |

> **RN sapması:** `RN:api/client.ts` yalnız `Authorization` + `Content-Type` gönderiyor; `X-Company-Id`, `X-Device-Id`, `X-App-Version` **yok**. Çok şirketli kullanıcı her zaman ilk şirketi görür.

### 1.4 Hata zarfı
- Genel: `{"detail": "Türkçe mesaj"}`; DRF validation: `{"field": ["mesaj"]}` (`BE-doc:APIREF:66-75`).
- `PATCH /pos-devices/{sn}/` yetkisiz alanları **sessizce atlar** ve 200 yanıtına `_warnings: string[]` ekler (`BE:views/pos_devices.py:252-261, 308-318, 414-416`).
- Özel durumlar: 2FA verify 400 gövdesi `{requires_2fa, session_token, attempts_left, detail}`; 401 = oturum bitti/deneme aşıldı (`BE:views/auth.py:186-228`). Rapor 429 = eşzamanlı rapor (`BE:views/reporting.py:105-113`).
- RN `normalizeError` `detail|message|error` okuyor, field hatalarını `body`'de taşıyor (`RN:api/client.ts:114-123`) → uyumlu.

### 1.5 Sayfalama stilleri (backend gerçeği)
**Hiçbir endpoint `next/previous` dönmüyor.** DRF `StandardPagination` (`BE:pagination.py`, max 100) tanımlı ama `pos-devices` list'te **kullanılmıyor**; tüm sayfalı listeler Django `Paginator` ile sabit boyutlu ve `page` dışında boyut parametresi kabul etmez.

| Stil | Endpoint'ler (sabit sayfa boyutu) |
|---|---|
| `{count, page, num_pages, [page_size], results, …extra}` | `pos-devices/` (25; extra `online_count, offline_count, total_count`) `BE:views/pos_devices.py:204-237` · `pos-devices/{sn}/transactions/` (50; extra `summary`) `:519-531` · `cards/` (30; extra `page_size, active_count, pending_count`) `BE:views/personnel_cards.py:103-119` · `users/` (25) `BE:views/users.py:64-72` · `recurring-balance/`, `card-quotas/`, `recurring-quota/` (25) `BE:views/personnel_cards.py:610,724,822` · `notifications/` (25; extra `unread_count`) `BE:views/notifications.py:40-50` · `stock/movements/`, `stock/transfers|receipts|adjustments/`, `stock/locations/{id}/movements/` (25) `BE:views/stock.py:198,331-341` |
| `{results: [...]}` (sayfasız) | overview liste uçları, `card-groups/`, `product-templates/`, `…/items/`, `stock/overview|locations|skus/`, `stock/locations/{id}/inventory/` (+`location`), `regions/`, `companies/`, `cari/invoices/`, `reports/` (+`retention_hours, user_report_limit`), `cash-history/`, `revenue-counts/` |
| Düz obje | detay uçları, `overview/summary|dashboard|revenue-timeseries`, `pos-devices/{sn}/summary|products` |

> `page_size` gönderimi (RN `devices.ts:27` → 25, `DevicesListScreen.tsx:173` → 50; Flutter sayaç için `page_size=1`) **etkisizdir**; yanıt hep 25'lik sayfa ve `"page_size": 25` döner (`BE:views/pos_devices.py:204,210,231`).

### 1.6 Tarih & ondalık formatları
- Datetime: timezone'lu ISO-8601 (`.isoformat()`), sorgu tarihleri `YYYY-MM-DD` (`BE:services.py:144-147`, `BE:views/pos_devices.py:470-480`). İş günü Europe/Istanbul.
- **Para:** view'ların elle kurduğu dict'lerde `float(...)` → **number** (overview, liste ciroları, device summary, cash-history, count-revenue, cari summary). `ModelSerializer` `DecimalField`'ları → DRF varsayılanıyla **string** (`"25.00"`): `transactions[].amount` (`BE-api:2251`), ürün/slot `price` (`BE-api:2161,2925`), kart `balance` (`BE-api:1223`), şablon kalemi `price`, SKU `unit_cost/sale_price/vat_rate/…`, recurring `amount`. (`COERCE_DECIMAL_TO_STRING` ayarı kopyada yok → *doğrulanamadı*, ama varsayılan budur.) RN `PosTransaction.amount: number`, `PosProduct.price: number` tipleri **yanlış olabilir** → `Number()` ile parse edin.
- Stok miktarları `QuantityField` → **number** (tam sayıysa int, gramajlıysa float) (`BE:serializers/fields.py:6-29`).
- Yazarken para alanları string kabul edilir (`"15.00"`, slot `price` CharField `,` veya `.` kabul eder `BE:serializers/pos_device.py:384`).

### 1.7 Cache
- Redis response cache, anahtar `vmob:{endpoint}:{user_id}:{company_id}:v{ver}:{params}`; yazmalarda şirket versiyonu artar (`BE:cache.py:11-19, 39-60`). Bypass: `?nocache=1` / `X-Bypass-Cache: 1` (`BE:cache.py:129-132`).
- TTL'ler: overview 30 sn (locations 300) · pos-devices list/detail/summary/products 30 · stock overview 60, locations/skus 600 · product-templates list 600 · card-groups 300 · users list 300, assignable-options 600 · regions 600 · companies list 600, detail 3600 · notifications list 120, unread-count 60 (`grep @cached_response BE:views/*`).

### 1.8 Rate limit
- Login 10/dk (`BE:throttling.py:5-8`, `BE:views/auth.py:135`); password-reset 5/saat (`BE:throttling.py:11-13`, `BE:views/auth.py:369`). Global `user 1000/hour`, `anon 60/hour` yalnız `BE-doc:VENNEX_MANAGEMENT_APP_BACKEND.md:539-548` (settings kopyada yok).

---

## 2. Endpoint tabloları

Kolonlar: **M** metod · **Yetki** (hepsi aksi yazmadıkça `IsManagementUser` = owner/tech/admin + Bearer) · **Girdi** · **Yanıt** · **Yan etki** · **RN** · **Kaynak**.

### 2.1 Auth & hesap
| M | Path | Yetki | Girdi | Yanıt | Yan etki | RN | Kaynak |
|---|---|---|---|---|---|---|---|
| POST | `auth/login/` | AllowAny, 10/dk | `{username,password}` | `{access,refresh,user}` veya `{requires_2fa:true,session_token}`; 400/401/403 | 2FA oturumu (5 dk) | kullanıyor | backend `views/auth.py:131-176` |
| POST | `auth/2fa/verify/` | AllowAny | `{session_token, otp(6-8)}` | 200 token'lar; 400 `{requires_2fa,session_token,attempts_left,detail}`; 401 süre/deneme aşımı; 404 kullanıcı yok | deneme sayacı | kullanıyor (validateStatus 400) | backend `:179-228` |
| POST | `auth/refresh/` | AllowAny | `{refresh}` | `{access[,refresh]}` | — | interceptor içinde | backend `:231` |
| POST | `auth/logout/` | Bearer | `{refresh}` | 204; 400 eksik/geçersiz | blacklist | kullanıyor | backend `:237-252` |
| GET | `auth/me/` | Bearer | — | `AuthUser` (bkz. 2.1a) | — | kullanıyor | backend `:255-258`, `authentication.py:57-73` |
| PATCH | `auth/me/` | Bearer | `first_name,last_name(≤150),email,phone(≤20, null)` kısmi | `AuthUser` | — | kullanmıyor | backend `:260-275`, `serializers/auth.py:47-51` |
| POST | `auth/change-password/` | Bearer | `{current_password,new_password(min8, eskiden farklı)}` | **200** `{detail}` (Flutter doc 204 der) | diğer oturumlar düşer | kullanmıyor | backend `:353-362`, `serializers/auth.py:6-16` |
| POST | `auth/password-reset/` | AllowAny, 5/saat | `{email}` | 200 `{detail}` (e-posta var/yok aynı yanıt) | 24 saat geçerli link e-postası, link `?uid=&token=` | kullanmıyor | backend `:365-399` |
| POST | `auth/password-reset/confirm/` | AllowAny | `{uid,token,new_password(min8)}` | 200 `{detail}`; 400 geçersiz/süresi dolmuş | oturumlar düşer | kullanmıyor | backend `:402-429` |
| POST | `auth/deactivate/` | Bearer | `{password}` | 200 `{detail}` (Flutter doc 204 der) | `is_active=False`, oturumlar düşer | kullanmıyor | backend `:432-442` |
| POST | `auth/delete/` | Bearer | `{password}` | 204 | kullanıcı **kalıcı silinir** | kullanmıyor | backend `:445-454` |
| GET | `auth/2fa/status/` | Bearer | — | `{is_enabled}` | — | kullanmıyor | backend `:345-350` |
| POST | `auth/2fa/setup/` | Bearer | — | `{device_id,secret,otpauth_url,is_enabled:false}`; 400 zaten aktif | unconfirmed TOTP cihazı | kullanmıyor | backend `:281-311` |
| POST | `auth/2fa/enable/` | Bearer | `{otp}` | 200 `{detail,is_enabled:true}`; 400 setup yok/geçersiz kod | — | kullanmıyor | backend `:314-328` |
| POST | `auth/2fa/disable/` | Bearer | `{password}` | 200 `{detail,is_enabled:false}`; 400 parola hatalı | — | kullanmıyor | backend `:331-342` |

**2.1a `AuthUser`** (`BE:authentication.py:57-73`): `id, username, email, first_name, last_name, phone` (**yoksa `""`, null değil**), `role` (`owner|tech|admin`), `permissions[]` (bkz. §3.5), `pending_legal_docs[]` (slug), `companies[]` = `{id, name, cari_state, has_personnel_card_device, uses_stock_mode}` (`BE:authentication.py:47-54`). `logo_url`/`device_count` **dönmüyor** (Flutter modeli bekliyor; RN tipi doğru — `RN:types/auth.ts:3-11`).

### 2.2 Push cihaz kaydı & bildirim tercihleri
| M | Path | Yetki | Girdi | Yanıt | Yan etki | RN | Kaynak |
|---|---|---|---|---|---|---|---|
| POST | `device/register/` | Bearer | `{fcm_token(≤512), platform: ios|android, device_id?(≤128)}` | 200 `{id,platform,app,device_id,last_seen,is_active}` | `(user,device_id)` upsert; aynı token başka kullanıcıdaysa koparılır | kullanmıyor (ekranda çağrı yok) | backend `views/device.py:17-60`, `serializers/device.py` |
| POST | `device/unregister/` | Bearer | `{fcm_token}` | 204 | token silinir | kullanmıyor | backend `views/device.py:63-73` |
| GET | `me/notification-preferences/` | Bearer | — | `{device_offline,transaction_alerts,stock_low,card_pending,report_ready,cari_overdue,updated_at}` | yoksa oluşturur | kullanıyor | backend `views/device.py:76-90`, `serializers/auth.py:71-83` |
| PATCH | `me/notification-preferences/` | Bearer | kısmi bool'lar | tam obje | push filtrelemesi `tasks.py:_pref_allows` | kullanıyor | backend |

### 2.3 App meta & yardım
| M | Path | Yetki | Girdi | Yanıt | RN | Kaynak |
|---|---|---|---|---|---|---|
| GET | `app/min-version/` | AllowAny | — | `{ios_min,android_min,force_update,store_urls{ios,android}}` (boşsa `""`) | RN'de yok | backend `views/app.py:10-26` |
| GET | `app/ping/` | **Bearer gerekli** (Flutter doc skipAuth der) | — | `{ok:true,user_id}` | RN'de yok | backend `views/app.py:29-33` |
| POST | `app/test-push/` | Bearer (dev/QA) | `{title?,body?,data?}` | `{ok,detail,tokens,payload}`; 400 token yok, 503 FCM hatası | RN'de yok | backend `views/app.py:36-107` |
| POST | `/api/wallet/complaint/` | Bearer | `{type: cihaz_arizi|odeme_sorunu|urun_sorunu|diger, description(≤1000), device_id?}` | 201/204 | RN'de yok | both `FL-doc:API:373-390` (backend kopyada yok) |

### 2.4 Overview / Dashboard
Ortak: `period ∈ today|yesterday|this_week|last_week|this_month|last_month|last_30|custom`; `custom` → `start_date,end_date` `YYYY-MM-DD` (bitiş günü dahil; parse hatası → bugün) (`BE:services.py:43-160`). `location_id` int (`BE:views/overview.py:_resolve_devices`). Cache 30 sn, `nocache=1`.

| M | Path | Yetki | Query | Yanıt | RN | Kaynak |
|---|---|---|---|---|---|---|
| GET | `overview/dashboard/` | Mgmt; satış alanları `view_sales` | `period, top_limit(5), recent_limit(5), location_id, start_date, end_date, nocache` | `{summary, revenue_timeseries, payment_breakdown{results}, top_devices{results}, error_breakdown{results}, recent_transactions{results}}`; satış yetkisi yoksa 5 alan `null` | kullanıyor | backend `views/overview.py:362-402` |
| GET | `overview/summary/` | Mgmt | `period, location_id, start/end` | §3.8 | RN'de yok | backend `:290-296` |
| GET | `overview/revenue-timeseries/` | `view_sales` (403) | aynı | `{mode: hourly|daily, labels[], amounts[]}` | RN'de yok | backend `:299-305`, `:137-143` |
| GET | `overview/payment-breakdown/` | `view_sales` | aynı | `{results:[{pt_type,label,color(#hex),amount,count}]}` | RN'de yok | backend `:146-168, 308-314` |
| GET | `overview/top-devices/` | `view_sales` | aynı + **`limit`** (bundle'da `top_limit`) | `{results:[{sn,pos_name,revenue,tx_count}]}` | RN'de yok | backend `:171-193, 317-326` |
| GET | `overview/error-breakdown/` | `view_sales` | aynı | `{results:[{sn,pos_name,count}]}` (iptalNo=3) | RN'de yok | backend `:196-216, 329-336` |
| GET | `overview/recent-transactions/` | `view_sales` | aynı + `limit` | `{results:[{id,pt_id,datetime,sn,pos_name,product_name,amount,status,pt_type,pt_type_label,card_pan}]}` | kullanmıyor | backend `:219-247, 339-347` |
| GET | `overview/locations/` | Mgmt, cache 300 | `location_id` dışında yok | `{results:[{id,name,region_id,region_name}]}` | kullanmıyor | backend `:250-266, 350-356` |

### 2.5 POS cihazları (REST)
Tümü `CompanyContextMixin` (X-Company-Id), cihaz `get_user_devices(user, company)` ile kapsamlanır (`BE:views/pos_devices.py:61-66`).

| M | Path | Yetki | Girdi | Yanıt (anahtar) | Sayfa | Yan etki | RN | Kaynak |
|---|---|---|---|---|---|---|---|---|
| GET | `pos-devices/` | Mgmt | `q, location_id, stat(0|1), online(true|false), sort_by, page` | `PosDeviceListItem[]` (§3.9) + `online_count, offline_count, total_count` | 25 sabit | — | kullanıyor | backend `:143-237`, `serializers/pos_device.py:11-83` |
| POST | `pos-devices/sort/` | Mgmt | `{device_orders:[{sn,sort_order}]}` | `{detail}`; 403 erişilemeyen sn | — | sort_order güncellenir | kullanmıyor | backend `:591-611` |
| POST | `pos-devices/sort/reset/` | Mgmt | — | `{detail}` | — | tüm sort_order=0 | RN'de yok | backend `:614-623` |
| GET | `pos-devices/export/` | Mgmt | — | **Erişilemez** — bkz. not ⚠ | — | — | RN'de yok | backend `urls.py:63,73` |
| GET | `pos-devices/{sn}/` | Mgmt | — | §3.11 detay + `sales_visible` + `permissions{manage_device_settings,manage_stock}` | — | — | kullanıyor | backend `:240-249`, `serializers/pos_device.py:86-186` |
| PATCH | `pos-devices/{sn}/` | alan bazlı (§3.11) | §3.11 | detay + `_warnings?` | — | komut bayrakları, ayarlar, çalışma saati replace | kullanıyor (hatalı değerlerle) | backend `:251-416` |
| GET | `pos-devices/{sn}/summary/` | `view_sales` (403) | — | `{today,yesterday,this_month,last_month:{revenue,count}}` | — | — | kullanıyor | backend `:421-458` |
| GET | `pos-devices/{sn}/transactions/` | `view_sales` | §3.6 | `{count,page,num_pages,page_size:50,summary{total,success,failed,revenue},results}` | 50 | — | kullanıyor | backend `:461-531` |
| GET | `pos-devices/{sn}/products/` | Mgmt | — | `{mode: stock|normal, items[], fill{qty,max,pct(null olabilir)}}` | — | — | kullanıyor | backend `:543-588` |
| POST | `pos-devices/{sn}/products/create/` | stok modu: `manage_stock`; normal: `manage_device_settings` | stok: `{urun_no?,is_wildcard,stock_sku_id*,price*,max_quantity}`; normal: `{urun_no*,name*(≤50),price*,quantity,max_quantity}` | 201 slot/ürün (`stock_sku` alanı ile) | — | — | kullanıyor (yalnız stok şekli) | backend `:789-830`, `serializers/pos_device.py:380-393` |
| PATCH/DELETE | `pos-devices/{sn}/products/{id}/` | aynı mod kuralları | kısmi | slot/ürün; 204 | — | — | RN'de yok | backend `:835-890` |
| POST | `pos-devices/{sn}/products/bulk-quantities/` | `manage_stock` | `{source_location_id?, updates:[{slot_id,quantity}]}` | `{detail,updated_count}` | — | kaynak lokasyondan stok düşer | kullanmıyor | backend `:893-914` |
| POST | `pos-devices/{sn}/fill-all-stock/` | `manage_stock` | `{source_location_id?}` (opsiyonel; Flutter doc "zorunlu" der) | `{detail,filled_count}` | — | stok transferi | kullanmıyor | backend `:917-938`, `serializers/pos_device.py:404-405` |
| POST | `pos-devices/{sn}/assign-template/` | Mgmt + cihaz erişimi | `{template_id}` | `{detail,created,updated,deleted,skipped[]}` | — | ürünler şablondan yeniden yazılır | kullanıyor | backend `:941-966` |
| DELETE | `pos-devices/{sn}/assign-template/` | Mgmt | — | `{detail}` | — | eşleme kalkar, ürünler kalır | kullanıyor | backend `:967-976` |
| POST | `pos-devices/{sn}/save-as-template/` | Mgmt | `{name(≤100), description?}` | 201 `{detail,id,name}` | — | yeni şablon | RN'de yok | backend `:979-1005` |
| GET | `pos-devices/{sn}/export-products/` | Mgmt | — | XLSX, `Content-Disposition: attachment; filename="urunler_<sn>_<ts>.xlsx"` | — | — | RN'de yok | backend `:1029-1046` |
| POST | `pos-devices/{sn}/collect-cash/` | **`manage_device_settings`** + cihaz erişimi | `{notes?(≤500)}` | `{detail, amount_collected}`; 400 "Toplanacak nakit bulunmamaktadır." | — | `CashCollection` kaydı | kullanıyor | backend `:626-664` |
| POST | `pos-devices/{sn}/count-revenue/` | `view_sales` + erişim | `{notes?}` | `{detail,total_revenue,by_pt_type{pt:amount}}`; 400 sayılacak ciro yok | — | `RevenueCount` kaydı | kullanıyor | backend `:667-717` |
| GET | `pos-devices/{sn}/cash-history/` | `view_sales` | `limit` (25, max 100) | `{results:[{id,datetime,amount,notes,collected_by}]}` | limit | — | kullanıyor (limit=1) | backend `:720-742` |
| GET | `pos-devices/{sn}/revenue-counts/` | `view_sales` | `limit` (25, max 100) | `{results:[{id,datetime,total_revenue,notes,counted_by,by_pt_type{"0".."10"}}]}` | limit | — | kullanıyor | backend `:745-786` |

⚠ **URL gölgeleme:** `pos-devices/<str:sn>/` (`BE:urls.py:63`) `pos-devices/export/`'tan (`:73`) **önce** tanımlı; Django ilk eşleşmeyi aldığı için `GET pos-devices/export/` → detay view'ına `sn="export"` ile düşer → 404. Backend'de sıralama düzeltilmeden RN'de export eklenmemeli.

### 2.6 Uzaktan satış & cihaz komutları
| Kanal | Detay | Yetki | RN | Kaynak |
|---|---|---|---|---|
| Komutlar (REST) | **Ayrı endpoint yok.** `PATCH pos-devices/{sn}/` body `{"commands": {"and_reset": true}}` / `eod_trig` / `mdb_reset`. `apk_reset` yalnız okunur. | **Yetki gerekmez** (tüm mgmt kullanıcıları) | RN'de yok (`RN:screens/devices/DeviceDetailScreen.tsx:2065` "henüz tanımlı değil") | backend `urls.py:72`, `views/pos_devices.py:282-287`, `serializers/pos_device.py:218-223` |
| Uzaktan satış (WS) | `wss://<host>/ws/dashboard/pos/<sn>/?token=<access>`; S→C `vend_pending{tx_id,item,amount(kuruş)}`, `remote_decision_ack{tx_id,ok}`, `vend_ended{tx_id,result: success|failure|cancelled}`, `error{error,tx_id?}`; C→S `{"type":"remote_decision","tx_id","decision":"approve"}`; reddetme mesajı yok | "Remote Vend" grubu (`remote_vend`) + cihaz erişimi; yetkisiz → handshake 403/close 4003 | RN'de yok (modal yalnız UI, WS kodu yok) | doc `BE-doc:APIREF:1700-1750`, `FL-doc:vennex_mobile_ws.md`; middleware backend `ws_auth.py:25-46` |

### 2.7 Ürün şablonları
| M | Path | Yetki | Girdi | Yanıt | Yan etki | RN | Kaynak |
|---|---|---|---|---|---|---|---|
| GET | `product-templates/` | Mgmt, cache 600 | — | `{results:[{id,name,description,machine_type(0|1),item_count,assigned_device_count,created_at,updated_at}]}` — **items yok** | — | kullanıyor | backend `views/product_templates.py:39-52`, `serializers/product_template.py:39-55` |
| POST | `product-templates/` | Mgmt (yazma kontrolü yok!) | `{name(≤100), description?, machine_type?(0|1, default 0)}` | 201 detay | — | kullanıyor | backend `:54-66`, `serializers:74-78` |
| GET | `product-templates/{id}/` | Mgmt | — | `{id,name,description,machine_type,items[],assigned_devices[{sn,pos_name}],created_at,updated_at}` | — | kullanıyor | backend `:75-77`, `serializers:58-71` |
| PATCH | `product-templates/{id}/` | `manage_device_settings` | kısmi; `machine_type` cihaza eşliyken değişemez (400) | detay | — | kullanıyor | backend `:79-99` |
| DELETE | `product-templates/{id}/` | `manage_device_settings` | — | 204 | — | kullanıyor | backend `:101-106` |
| GET | `product-templates/{id}/items/` | Mgmt | — | `{results:[TemplateItem]}` | — | RN'de yok | backend `:158-165` |
| POST | `product-templates/{id}/items/` | `manage_device_settings` | **tek kalem objesi** (§3.2) | 201 kalem | atanmış cihazlara senkron | kullanıyor ama **yanlış gövde** (`{items:[…]}`) | backend `:167-184` |
| PATCH/DELETE | `product-templates/{id}/items/{item_id}/` | `manage_device_settings` | kısmi | kalem / 204 | senkron | RN'de yok | backend `:187-225` |
| POST | `product-templates/{id}/assign/` | `manage_device_settings` | `{device_sns[]}` (boş olamaz); şablonda kalem yoksa 400 | `{detail,assigned_count,type_mismatch[]}` | eşleme + ürün yazımı | kullanıyor | backend `:231-274` |
| POST | `product-templates/{id}/send/` | `manage_device_settings` | `{sn}` | `{detail,created}`; tip uyuşmazlığı 400 | cihaz ürünleri silinip yeniden yaratılır | RN'de yok | backend `:277-318` |

### 2.8 Personel kartları, gruplar, kotalar
Tümü `CanManagePersonelCard` (owner için şirkette `personelKart=True` cihaz şart — `BE:permissions.py:30-42`). Bakiye değişimi ayrıca `change_card_balance`.

| M | Path | Ek yetki | Girdi | Yanıt | Sayfa | RN | Kaynak |
|---|---|---|---|---|---|---|---|
| GET | `cards/` | — | `status(active|pending), q, group_id, page` | `{count,page,num_pages,page_size:30,active_count,pending_count,results:[{id,uid,first_name,last_name,full_name,balance(string),customer_no,is_active,created_at,groups[{id,name,pos_device_ids}]}]}` | 30 | kullanıyor | backend `views/personnel_cards.py:89-119`, `serializers/personnel_card.py:15-50` |
| POST | `cards/` | bakiye ≠0 için `change_card_balance` | `{uid,first_name?,last_name?,balance?,customer_no?,group_ids[]}`; tech yetkili gruplardan en az biri | kart | — | kullanıyor | backend `:122-161` |
| GET/PATCH/DELETE | `cards/{id}/` | PATCH `balance` → `change_card_balance` | kısmi | kart / 204 | — | GET yok; PATCH kullanmıyor; DELETE kullanıyor | backend `:164-230` |
| POST | `cards/{id}/approve/` | — | `{reverse_uid}` | kart; ters UID çakışması 400 | — | kullanıyor | backend `:233-250` |
| POST | `cards/{id}/reject/`, `cards/reject-all-pending/` | — | — | `{detail}` | — | reject kullanıyor; reject-all kullanmıyor | backend `:253-286` |
| GET | `cards/{id}/transactions/` | — | `limit` (100, max 500) | `{card, transactions:[PosTransaction], success_count, fail_count}` | — | kullanmıyor | backend `:289-311` |
| POST | `cards/bulk/` | — | `{action: balance|delete|groups, …}` (birleşik) | — | — | RN'de yok | backend `:384-412` |
| POST | `cards/bulk/balance/` | `change_card_balance` | `{card_ids[],operation: add|subtract|set, amount}` | — | — | kullanmıyor | backend `:314-341` |
| POST | `cards/bulk/delete/`, `cards/bulk/groups/` | — | `{card_ids[]}` / `{card_ids[],group_ids[],operation: add_groups|remove_groups}` | — | — | kullanmıyor | backend `:344-381` |
| POST | `cards/import/` | ek grup kontrolü (403) | multipart Excel | sonuç sayıları | — | RN'de yok | backend `:415-447` |
| GET | `cards/export/`, `cards/template/` | — | — | XLSX | — | RN'de yok | backend `:450-479` |
| GET | `card-groups/` | cache 300 | `q` | `{results:[{id,name,active_cards_count,pos_device_count,created_at}]}` — **cihaz listesi yok** | — | kullanıyor | backend `:482-496`, `serializers/personnel_card.py:93-104` |
| POST | `card-groups/` | — | `{name, pos_device_ids[]}` | grup; isim çakışması 400 | — | kullanıyor | backend `:499-516` |
| GET/PATCH/DELETE | `card-groups/{id}/` | — | PATCH `{name?, pos_device_ids?}` | `{id,name,active_cards_count,pos_devices:[{id,sn,pos_name}],created_at}` — **`pos_device_ids` yok** | — | kullanıyor | backend `:519-560`, `serializers:106-122` |
| GET/POST | `recurring-balance/` | — | `q,page` / `{name,amount,update_type: add|set,period,target_type: card|group,target_card?,target_group?,is_active,start_date,description?}` | sayfalı / kayıt (+`last_run,next_run,run_count`) | 25 | kullanıyor | backend `:593-652`, `serializers:126-153` |
| GET/PATCH/DELETE | `recurring-balance/{id}/` | — | kısmi | kayıt | — | kullanıyor | backend `:655-698` |
| GET/POST | `card-quotas/` | — | `q,group_id,card_id,page` / `{group*,card?,product_no,period,quantity,is_active}` (grup zorunlu) | sayfalı | 25 | kullanıyor | backend `:701-773` |
| GET/PATCH/DELETE | `card-quotas/{id}/` | — | kısmi | kayıt | — | kullanıyor | backend `:776-802` |
| GET/POST | `recurring-quota/` (+`/{id}/`) | — | benzer (`name,group,product_no,period,quantity,target_type,start_date,…`) | sayfalı | 25 | kullanıyor | backend `:805-920` |

### 2.9 Stok
Tümü `CanManageStock` (`BE:views/stock.py:54…461`).

| M | Path | Girdi | Yanıt | RN | Kaynak |
|---|---|---|---|---|---|
| GET | `stock/overview/` | — | `{results:[{sku_id,sku_name,sku_code,total}]}` (reçeteli hariç) | kullanıyor | backend `views/stock.py:53-73` |
| GET | `stock/export/overview/` | — | XLSX | RN'de yok | backend `:76-92` |
| GET/POST | `stock/locations/` | `active_only` (default **true**; yalnız `false` kapatır), `location_type` / `{name,location_type: warehouse|vehicle|depot|vending_machine,is_active}` | `{results:[{id,name,location_type,location_type_display,is_active,pos_device,pos_device_sn,created_at,updated_at}]}` | kullanıyor | backend `:95-127`, `serializers/stock.py:77-105` |
| POST | `stock/locations/sync-vending/` | — | `{detail,created,updated}` | kullanıyor | backend `:210-218` |
| GET/PATCH/DELETE | `stock/locations/{id}/` | kısmi | lokasyon | GET yok; PATCH kullanmıyor; DELETE kullanıyor | backend `:130-164` |
| GET | `stock/locations/{id}/inventory/` | — | `{location, results:[{id, **sku**, sku_name, sku_code, location, location_name, location_type, quantity, updated_at}]}` | kullanıyor | backend `:167-183`, `serializers/stock.py:111-131` |
| GET | `stock/locations/{id}/movements/` | `page` | sayfalı `MovementList` | kullanmıyor | backend `:186-207` |
| GET/POST | `stock/skus/` | `active_only` (default **false**; yalnız `true` filtreler), `stockable=true` (reçeteli hariç), `q` (ad/kod/barkod) / `{name,sku_code,barcode?,unit_cost,sale_price,vat_rate(20),kind: simple|composite|ingredient,base_unit,package_size,package_label}` | `{results:[{id,name,sku_code,barcode,unit_cost,kind,kind_display,base_unit,unit_short,package_size,package_label,sale_price,vat_rate,sale_price_excl_vat,vat_amount,created_at,updated_at}]}` | kullanıyor | backend `:224-266`, `serializers/stock.py:21-71` |
| GET/PATCH/DELETE | `stock/skus/{id}/` | kısmi | SKU | PATCH/DELETE kullanıyor | backend `:269-328` |
| GET/POST | `stock/movements/` | `type`, `page` / `{type: transfer|receipt|adjustment, …}` | sayfalı `{count,page,num_pages,results:[{id,movement_type,type,sku,sku_name,from_*,to_*,quantity,reason,datetime,created_by_username,…}]}` | RN'de yok | backend `:449-493`, `serializers/stock.py:134-173` |
| GET/POST | `stock/transfers/` | `page` / `{from_location_id,to_location_id,sku_id,quantity>0}` | sayfalı / 400 hata mesajı | kullanıyor | backend `:344-376`, `serializers:179-183` |
| GET/POST | `stock/receipts/` | `{to_location_id,sku_id,quantity>0}` | aynı | kullanıyor | backend `:379-410` |
| GET/POST | `stock/adjustments/` | `{location_id,sku_id,quantity(±),reason?(≤200)}` | aynı | kullanıyor | backend `:413-446` |

### 2.10 Raporlar
Tümü `CanViewSales` (`BE:views/reporting.py:53,144,159,185,203,236`).

| M | Path | Girdi | Yanıt | Yan etki | RN | Kaynak |
|---|---|---|---|---|---|---|
| GET | `reports/` | — | `{retention_hours,user_report_limit,results:[Job]}`; Job = `{id,report_type,custom_name,status,progress_pct,row_count,estimated_rows,file_size_bytes,error_message,created_at,finished_at,expires_at,is_active,is_downloadable,download_count}` | — | kullanıyor | backend `:30-62` |
| POST | `reports/` | §3.7 | 202 `{detail,job_id,status,estimated_rows}`; 403 NFC; 400; 429; 404 | Celery job | kullanıyor | backend `:64-140` |
| GET | `reports/filter-options/` | — | `{report_types[{value,label}],companies[{id,name}],regions[{id,name,company_id}],locations[{id,name,region_id,region_name}],devices[{id,sn,pos_name,company_id,location_id}],has_personel_kart_pos,nfc_sources[],nfc_operations[]}` | — | kullanıyor | backend `:227-283` |
| GET/DELETE | `reports/{id}/` | — | Job / 204; aktif job silinemez (400) | dosya silinir | GET kullanmıyor (polling hook dışında), DELETE kullanmıyor | backend `:143-155` |
| GET | `reports/{id}/download/` | — | XLSX (`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`), `Content-Disposition: attachment; filename="<display_filename>"`; indirilemezse 404 | `download_count++` | kullanıyor | backend `:158-180` |
| POST | `reports/{id}/cancel/` | — | güncel Job; aktif değilse 400 | Celery revoke | kullanıyor | backend `:183-199` |
| POST | `reports/{id}/retry/` | — | **202 YENİ Job** (yeni `id`) | yeni job | kullanıyor | backend `:202-224` |

### 2.11 Bildirim inbox'ı
| M | Path | Girdi | Yanıt | RN | Kaynak |
|---|---|---|---|---|---|
| GET | `notifications/` | `page`, `unread=true` | `{count,page,num_pages,unread_count,results:[{id,timestamp,verb,description,unread,actor_str,target_str,data(obj **veya null**)}]}` (25, cache 120 sn) | kullanıyor | backend `views/notifications.py:19-53` |
| GET | `notifications/unread-count/` | — | `{unread_count}` (cache 60 sn) | kullanıyor | backend `:56-62` |
| POST | `notifications/{id}/read/` | — | `{detail}` | kullanıyor | backend `:65-72` |
| POST | `notifications/read-all/` | — | `{detail,count}` | kullanıyor | backend `:75-79` |

### 2.12 Yasal belgeler
| M | Path | Yetki | Girdi | Yanıt | RN | Kaynak |
|---|---|---|---|---|---|---|
| GET | `legal/{slug}/` | AllowAny | slug `privacy|kvkk|terms` | `{slug,title,content_md,web_url|null,version,updated_at}` | kullanıyor | backend `views/legal.py:13-33` |
| POST | `legal/accept/` | Bearer | `{slug, version?}` | güncel `AuthUser`; bilinmeyen 404 | kullanıyor | backend `:36-63` |

### 2.13 Kullanıcılar (owner)
Tümü `IsOwner` (`BE:views/users.py:55,…`). Yalnız `master_user=request.user` ve `role=tech` kullanıcılar.

| M | Path | Girdi | Yanıt | RN | Kaynak |
|---|---|---|---|---|---|
| GET | `users/` | `page` | `{count,page,num_pages,results:[Staff]}` (25, cache 300); Staff = `{id,username,first_name,last_name,email,phone("" olabilir),is_active,group_names[],pos_devices[{id,sn,pos_name}],default_stock_locations[{id,name,location_type}]}` | kullanıyor | backend `views/users.py:12-38, 54-72` |
| POST | `users/` | `{username,password*,first_name?,last_name?,email?,phone?,pos_device_ids[],group_names[],default_stock_location_ids[]}`; gruplar owner'ın kendi grupları ∪ ALWAYS_AVAILABLE ile kesişir | 201 Staff; kullanıcı adı çakışması 400 | kullanıyor | backend `:74-122` |
| GET/PATCH/DELETE | `users/{id}/` | PATCH kısmi (username/parola değişmez) | Staff / 204 | GET/PATCH kullanmıyor; DELETE kullanıyor | backend `:125-178` |
| POST | `users/{id}/reset-password/` | `{new_password}` | `{detail}` | kullanıyor | backend `:181-191` |
| GET | `users/assignable-options/` | — | `{available_groups[],always_available_groups[],pos_devices[{id,sn,pos_name,company_name,location_name}],stock_locations[{id,name,location_type}],regions[{id,name}]}` | kullanıyor | backend `:194-244` |

### 2.14 Şirketler, bölgeler, cari
| M | Path | Yetki | Yanıt / Girdi | RN | Kaynak |
|---|---|---|---|---|---|
| GET | `companies/` | Mgmt (X-Company-Id okunmaz) | `{results:[{id,name,address,phone,email,tax_number,uye_isyeri,uye_isyeri_kisa_ad,cari_state,has_personnel_card_device,uses_stock_mode}]}` | RN'de yok | backend `views/companies.py:14-40` |
| GET | `companies/{id}/` | Mgmt; erişim yoksa 403 | aynı obje | RN'de yok | backend `:43-66` |
| GET/POST | `regions/` | **IsOwner** | `{results:[{id,name,description,total_pos_device_count,locations[{id,name,address,latitude,longitude,is_active,pos_device_count}],created_at}]}` / `{name,description?}` | RN'de yok | backend `views/regions.py:19-51`, `serializers/misc.py:9-25` |
| PATCH/DELETE | `regions/{id}/` | IsOwner | kısmi / 204 | RN'de yok | backend `:54-83` |
| POST | `locations/` | IsOwner | `{region,name,address?,latitude?,longitude?,is_active}` → 201 lokasyon | RN'de yok | backend `:86-105` |
| PATCH/DELETE | `locations/{id}/` | IsOwner | kısmi / 204 | RN'de yok | backend `:108-142` |
| GET | `cari/summary/` | **IsOwner** | `{enabled,company_name,cari_state,is_locked,overdue_total,all_total,invoice_count,balance_only,contact_id}` | RN'de yok | backend `views/payments.py:28-61` |
| GET | `cari/invoices/` | IsOwner | `{results:[CariInvoice]}` | RN'de yok | backend `:65-72`, `serializers/misc.py:93-114` |
| GET | `cari/invoices/{id}/pdf/` | IsOwner | `{pdf_url}`; 404 e-belge yok, 502/503 | RN'de yok | backend `:74-109` |
| POST | `cari/payment-link/` | — | **Backend'de YOK** (`urls.py:156` "yalnızca görüntüleme, ÖDEME YOK"); Flutter doc'ta var | RN'de yok | backend (yokluk) vs doc `FL-doc:API:2728-2741` |

---

## 3. Doğrulanması gereken uyumsuzluklar (kanıtlı cevaplar)

### 3.1 Snack/Kahve kodlaması (`pos_odemetip`, `machine_type`)
- **Backend:** `POS_ODEMETIP_CHOICES = [(0,'Snack'),(1,'Kahve')]`, help_text "0: Snack, 1: Kahve(Süreye Bakmaz)" (`BE-api:703-711`). `ProductTemplate.machine_type` **aynı choices** (`BE-api:2634-2638`); yazma serializer'ı `min 0, max 1`, yorum "0 = Snack, 1 = Kahve" (`BE:serializers/product_template.py:77-78`). Şablon gönderiminde `tpl.machine_type != device.pos_odemetip` → 400 (`BE:views/product_templates.py:291-296`); toplu atamada uyuşmayan cihazlar `type_mismatch[]` ile atlanır (`:256-273`).
- Flutter de 0=Snack, 1=Kahve (`FL:features/devices/tabs/settings_tab.dart:217, 614-616`; `info_tab.dart:221-229`).
- **RN `DeviceDetailScreen` yanlış:** `PAYMENT_MODE_OPTIONS = [{id:1,"Snack"},{id:2,"Kahve"}]` (`RN:screens/devices/DeviceDetailScreen.tsx:218-221`) ve PATCH'te `pos_odemetip: selectedPaymentMode.id` (`:1739`). Backend PATCH `pos_odemetip`'i 0–10 arası kabul eder (`BE:serializers/pos_device.py:243`) → RN "Snack" seçince cihaz **Kahve (1)** olur, "Kahve" seçince geçersiz **2** yazılır (model choices dışı, hata vermez). Okumada `0` (Snack) eşleşmediği için varsayılan `PAYMENT_MODE_OPTIONS[1]` = "Kahve" gösterilir (`:1689`).
- **RN `ProductTemplatesScreen.normalizeMachineType` doğru** (1=Kahve, 0=Snack; `RN:screens/devices/ProductTemplatesScreen.tsx:30-39`); `RN:api/templates.ts:22` yorumu da doğru.
- Ayrı kavram: `machine_type` (detayda `{id,name}` | null) = `MachineType` FK (`pos_mType`) (`BE:serializers/pos_device.py:139-142`); yazmak için `machine_type_id` + `select_machine_type` izni (`BE:views/pos_devices.py:290-306`). Snack/Kahve ile karıştırılmamalı.
- Aynı ekranda **`price_management`**: backend 0=Otomattan Al, 1=Otomat Öncelikli (Server Yedek), 2=Sadece Server (`BE-api:620-630`), serializer `max_value=2` (`BE:serializers/pos_device.py:244`). RN 1/2/3 kullanıyor (`DeviceDetailScreen.tsx:223-227`) → "Sadece Server" (3) seçilirse **tüm PATCH 400 ile reddedilir**.
- `GET pos-devices/` list serializer'ında `pos_odemetip` **yok** (`BE:serializers/pos_device.py:29-49`) → RN şablon atama ekranı her cihaz için detay çağrısı yapıyor (N+1; `ProductTemplatesScreen.tsx:682-700`). Kalıcı çözüm backend'e list alanı/filtresi eklemek; geçici çözüm `assign` yanıtındaki `type_mismatch[]`'e güvenmek.

### 3.2 Stok satırı `sku` vs `sku_id`; şablon kalemi `stock_sku`; kalem payload'ı
- `GET stock/locations/{id}/inventory/` satırı **`sku`** (FK id) döner, `sku_id` yok (`BE:serializers/stock.py:111-131`). `GET stock/overview/` ise **`sku_id`** döner (`BE:views/stock.py:63-69`). Hareket satırları `sku` (`serializers/stock.py:155`). POST gövdeleri `sku_id` (`:179-196`).
  - RN tipi `StockInventoryRow.sku_id` **yanlış** (`RN:types/stock.ts:70-74`); `StockOverviewScreen` `(row as any).sku` okuyarak doğru çalışıyor (`RN:screens/stock/StockOverviewScreen.tsx:161`). Flutter `r['sku_id']` fallback'i de yanlış (`FL:features/stock/screens/location_detail_screen.dart:89`).
- Şablon kalemi `stock_sku` = `StockSKU` FK id (int|null); okumada `stock_sku_name`, `stock_sku_code` eşlik eder (`BE:serializers/product_template.py:6-25`).
- **`POST product-templates/{id}/items/` — tek kalem objesi** (`BE:serializers/product_template.py:28-36`, `BE:views/product_templates.py:112-184`):
  | Alan | Kural |
  |---|---|
  | `price` | **zorunlu**, Decimal(8,2) (`"15.00"`) |
  | `stock_sku` | şirket **stok modundaysa zorunlu** (yoksa 400 "Stok modunda SKU zorunlu."), başka şirketin SKU'su 400; `name` SKU adından üretilir |
  | `name` | stok modu değilse zorunlu (≤50) |
  | `is_wildcard` | yalnız stok modunda etkili; `true` ise `urun_no` null'a zorlanır |
  | `urun_no`, `max_quantity(≥0)`, `quantity(≥0)`, `order` | opsiyonel |
  - RN `templatesApi.saveItems` `{items:[…]}` toplu gövde gönderiyor (`RN:api/templates.ts:51-61`) → `price` eksik sayılır, **400**. Her kalem için ayrı POST (yeni) / PATCH `items/{item_id}/` (mevcut) / DELETE yapılmalı.
- Cihaz slotu yaratma farklı anahtar kullanır: **`stock_sku_id`** (zorunlu, stok modu) (`BE:serializers/pos_device.py:380-385`); yanıtta yine `stock_sku`. Normal modda `{urun_no*, name*, price*, quantity, max_quantity}` (`:388-393`). RN `CreateProductPayload` yalnız stok şeklini destekliyor (`RN:api/devices.ts:15-21`).
- **Bileşen/reçete endpoint'i yok:** mobil `urls.py`'de components/recipes yolu bulunmuyor; reçeteler (`SKURecipeItem`/`TemplateRecipeItem`/`SlotRecipeItem`) dashboard tarafında (`BE-doc:RECETE_STOK_SISTEMI.md:147-151`; `BE-api:3069-3206`). RN `TemplateProductsEditScreen` reçete/bileşen verilerini sabit demo listelerden üretiyor (`RN:screens/devices/TemplateProductsEditScreen.tsx:170-195, 230, 247`) → **backend karşılığı yok**.
- SKU'da `kind/kind_display/base_unit/sale_price/vat_*` backend'de gerçekten var (`BE:serializers/stock.py:21-37`); `recipe_summary` **yok** (RN tipi `RN:types/stock.ts:39` opsiyonel bırakmış, doğru).

### 3.3 Kullanıcı cihaz sayısı alanı
- Backend Staff objesi **hiçbir sayaç alanı dönmez** ve `pos_device_ids` de dönmez: `pos_devices:[{id,sn,pos_name}]`, `default_stock_locations:[{id,name,location_type}]`, `group_names[]`, `is_active` (`BE:views/users.py:12-38`). Liste ve detay aynı serializer.
- RN `normalizeStaffUser` `pos_devices` dizisinden id ve sayıyı türetiyor (`RN:api/users.ts:9-46`) → **çalışır**; `pos_device_count`/`pos_devices_count`/`device_count` aday anahtarları gereksiz. Yazmada anahtarlar `pos_device_ids`, `default_stock_location_ids` (`BE:views/users.py:96-117, 147-171`).

### 3.4 Bekleyen (toplanmamış) nakit; cash-history & collect-cash
- **Backend'de bekleyen nakit alanı/endpoint'i YOK.** Detay alanları (`BE:serializers/pos_device.py:101-127`) ve summary (`BE:views/pos_devices.py:449-457`) `uncollected_cash/pending_cash/uncounted_revenue` içermez.
- Değer yalnız `POST collect-cash` içinde hesaplanır: son `CashCollection.collection_datetime`'dan sonraki `pt_type=0, status=True` işlemlerin toplamı; 0 ise 400 (`BE:views/pos_devices.py:636-647`). Benzer şekilde count-revenue son sayımdan sonraki tüm başarılı işlemler (`:676-686`).
- `cash-history`: `view_sales`; `limit` (default 25, max 100); `{results:[{id,datetime,amount,notes,collected_by(username)}]}` (`:720-742`). `collect-cash` **`manage_device_settings`** ister (`:627`); yanıt `{detail, amount_collected}` (`:654-664`).
- RN `pendingCash` önce var olmayan alanlara bakıyor, sonra `transactions` **yalnız 1. sayfasını (50 kayıt)** ve **gün çözünürlüklü** tarih filtresiyle toplayıp hesaplıyor (`RN:screens/devices/DeviceDetailScreen.tsx:625-660`) → >50 işlemde eksik, aynı gün toplama öncesi işlemlerde fazla sayar. Ayrıca 0 iken **sabit `1147.12`** gösteriliyor (`:711`) — sahte veri. Transactions `summary` filtrelerden **önce** hesaplandığı için (`BE:views/pos_devices.py:490-496` vs `498-516`) `pt_type=0` ile bile nakit toplamı vermez.
- **Öneri:** backend'e `GET pos-devices/{sn}/summary/` veya detaya `pending_cash` / `pending_revenue` eklensin; o zamana kadar RN "bilinmiyor" göstermeli.

### 3.5 `sales_visible`, `manage_device_settings`, izin sözlüğü, roller
- `permissions[]` değerleri (sıralı) `compute_permissions` (`BE:permissions.py:96-117`): `owner`, `tech`, `view_sales`, `manage_device_settings`, `select_machine_type`, `remote_vend`, `manage_personel_card`, **`change_card_balance`** (Flutter/RN listelerinde yok), `manage_stock`. `admin` rolü için dizide `admin` anahtarı **üretilmez**.
- Roller: `IsManagementUser` = owner/tech/admin (`BE:permissions.py:59-65`); `IsOwner` users/regions/cari'yi kapsar. Yardımcıların (`can_view_sales` vb.) gövdesi `dashboard_v2.utils`'te (kopyada yok); doküman: owner her zaman `view_sales`, tech "Satış Görüntüleme" grubu; `manage_stock` owner dahil "Stok Yönetimi" grubu (`BE-doc:VENNEX_MANAGEMENT_APP_SPEC.md:128, 338`); `remote_vend` = "Remote Vend" grubu (`BE-doc:APIREF:1717-1720`).
- **Dikkat:** Flutter `hasPermission` owner'a her şeyi `true` verir (`FL:data/models/auth/auth_user.dart:79-82`) ama backend owner için `manage_personel_card`'ı şirkette `personelKart=True` cihaza bağlar (`BE:permissions.py:30-42`) ve `manage_stock` grup ister → istemci izinleri **yalnız `permissions[]` dizisinden** okumalı.
- `sales_visible`: (a) `overview/summary` ve dashboard `summary.sales_visible` (`BE:views/overview.py:61-72, 107-110`); false iken summary yalnız `{period,period_label,devices,sales_visible}` döner ve dashboard'daki 5 alan `null` (`:380-401`). (b) Cihaz detayı kökünde `sales_visible` + `permissions:{manage_device_settings, manage_stock}` (`BE:views/pos_devices.py:245-249`).
- `manage_device_settings` neyi açar: PATCH ayar alanları (komutlar hariç), normal mod ürün CRUD, şablon yazma (PATCH/DELETE/items/assign/send), **nakit toplama** (`BE:views/pos_devices.py:308-318, 627, 818-820`; `BE:views/product_templates.py:80,102,168,196,216,235,281`). RN `canCollectCash = detail?.permissions?.manage_device_settings ?? true` (`RN:screens/devices/DeviceDetailScreen.tsx:487`) varsayılanı `false` olmalı.

### 3.6 İşlem durumu, `pt_type`, liste filtreleri
- `status`: bool (true=başarılı). Başarısızlık nedeni `iptalNo`: 1=Zaman aşımı, 2=Banka reddi, 3=Teknik; diğerleri "other" (`BE:views/overview.py:81-84`, `BE:views/pos_devices.py:509-513`). Anahtarlar camelCase `iptalNo`, `bankRefNo` (`BE:serializers/pos_device.py:274-302`).
- `pt_type` (`BE-api:2222-2234`): 0 Nakit · 1 Kredi Kartı · 2 İstanbulKart · 3 Multinet · 4 Metropol · 5 Personel Kart(NFC) · 6 Setcard · 7 Ticket · **8 Pluxee · 9 VennexSelf (PIN/Kart) · 10 TokenFlex**. Etiket/renk sözlüğü 9'u içermez (`BE:services.py:22-47`). RN/Flutter 0–7 ile sınırlı.
- `GET pos-devices/{sn}/transactions/` filtreleri (`BE:views/pos_devices.py:466-516`): `start_date`, `end_date` (`YYYY-MM-DD`; yok/hatalı → **bugün**; saat filtresi yok), `tx_status=success|fail`, `pt_type=<int>`, `cancel_reason=1|2|3|other` (otomatik `status=false`), `card_last4` (`pt_pan` endswith), `page`. Sıra `-pt_datetime`, 50/sayfa. `pt_pan` Personel Kart dışında `XXXX********XXXX` maskeli (`BE:services.py:266-274`). Tarih verilmezse RN "tüm zamanlar" sanmamalı.

### 3.7 Rapor tipleri, payload, filter-options, indirme
- Tipler: `ReportJob.REPORT_TYPE_CHOICES` (reporting app, kopyada yok); view `nfc_balance_logs`'u açıkça tanır (`BE:views/reporting.py:61-74`), `pos_detail` geçersiz tip fallback'i (`:62-63`). Doc: `pos_detail | pos_summary | nfc_balance_logs` (`FL-doc:API:2964`). Etiketleri `filter-options.report_types`'tan alın.
- Payload `reporting.validators.parse_filters` ile parse edilir (kopyada yok → **anahtarlar doğrulanamadı**). JSON listeleri QueryDict listesine çevrilir (`BE:views/reporting.py:79-87`). Backend dokümanı çoğul diziler: `companies[], regions[], locations[], devices[]`, `transaction_status: all|success|fail`, `payment_type: ""|0-7`, `min_amount`, `failure_reason: 1|2|3|other` (`BE-doc:APIREF:1450-1464`); Flutter dokümanı tekil `company/region/location` diyor (`FL-doc:API:2992-2998`) — **çelişki**. Flutter kodu bu filtreleri hiç göndermiyor (`FL:features/reports/reports_screen.dart:441-455`). RN tekil `company` gönderiyor (`RN:screens/reports/NewReportScreen.tsx:138-143`) → büyük olasılıkla yok sayılıyor; çoğul anahtar backend ekibiyle teyit edilmeli.
- Tarih: `start_date`, `end_date` `YYYY-MM-DD` (zorunlu; aralık sınırı validator'da). NFC ekleri: `nfc_source`, `nfc_operation`, `nfc_card_uids[]`.
- Yanıtlar: 202 `{detail,job_id,status:"pending",estimated_rows}`; 403 NFC yetkisi; 400 validation; **429** başka aktif job; 404 sıfır satır (`BE:views/reporting.py:64-140`). `retry` **yeni job id** döner (`:215-224`) — RN eski id'yi poll etmemeli.
- İndirme: XLSX content-type, `Content-Disposition: attachment; filename="<display_filename()>"` (`:168-175`). RN dosyayı uzantısız `custom_name` ile kaydediyor (`RN:api/reports.ts:25-29`) → `.xlsx` eklenmeli (Flutter: `POS_ozet_/POS_islem_detayi_/PersonelKart_Hareketleri_YYYYMMDD_HHMM.xlsx`, `FL:reports_screen.dart:123-137`).

### 3.8 Dashboard yanıt şekli, `location_id`
- `summary` (`BE:views/overview.py:107-130`): `period, period_label, start, end (ISO), sales_visible, devices{total,online,offline}, revenue, previous_revenue (number), change_pct (number|null), change_positive, comparison_label, transactions{total,success,failed}, failures{timeout,bank,technical,other}`.
- `revenue_timeseries{mode,labels[],amounts[]}`, `payment_breakdown{results[{pt_type,label,color,amount,count}]}`, `top_devices{results[{sn,pos_name,revenue,tx_count}]}`, `error_breakdown{results[{sn,pos_name,count}]}`, `recent_transactions{results[…]}`. **Grup/bölge kırılımı yok.** Her zaman `{results}` zarfı (`:146-247`); RN `extractResultsList` iki şekli de tolere ediyor.
- `location_id`: tek int, cihazları `location_id` ile filtreler (`BE:views/overview.py:_resolve_devices`); bölge filtresi yok. Konum listesi `overview/locations/` (RN kullanmıyor; `DeviceDetailScreen.tsx:210-216` sabit/sahte konum listesi kullanıyor).

### 3.9 Cihaz listesi parametreleri ve içerik (N+1)
- Parametreler (`BE:views/pos_devices.py:150-183`): `q` (sn/pos_name/act_vmc içerir), `location_id`, `stat=0|1`, `online=true|false`, `sort_by` ∈ `default, today_revenue_desc|asc, yesterday_revenue_desc|asc, this_month_revenue_desc|asc, last_month_revenue_desc|asc, fill_rate_desc|asc, last_transaction_desc|asc` (`:125-139`), `page`. **Makine tipi filtresi yok, `ordering` yok, `page_size` yok sayılır (25 sabit).**
- Satır alanları: `sn,pos_name,stat,company_id,company_name,location_id,location_name,act_vmc,act_macstat,last_seen,sort_order,online,today_revenue,today_tx_count,yesterday_revenue,this_month_revenue,last_month_revenue,last_transaction,fill_rate` (`BE:serializers/pos_device.py:29-49`). `fill_rate` = `{pct(null olabilir),qty,max}` veya ürün yoksa `null` (`BE:services.py:253-262`). **`id` ve `pos_odemetip` yok.**
- RN sonuçları: `DevicesListScreen` her satır için `products/` çağırıyor (enabled koşulu yok; `RN:screens/devices/DevicesListScreen.tsx:845-849`) → gereksiz N+1, liste zaten `fill_rate` veriyor. Makine tipi filtresi var olmayan `machine_type` metnine bakıyor (`:215-226`) → boş sonuç. `cardsApi.posDevices.list` bu listeden `id` bekliyor (`RN:api/cards.ts:126-131`) → `undefined`; kart grubuna cihaz atamak için id veren kaynak: `card-groups/{id}` `pos_devices[].id`, `users/assignable-options` (owner) veya `reports/filter-options.devices` (`view_sales`). Tech + `manage_personel_card` için id veren genel bir cihaz listesi **yok** → backend'e list'e `id` eklenmesi önerilir.

### 3.10 Kart grubu listesi cihaz içeriyor mu? Şablon listesi kalem/cihaz sayısı içeriyor mu?
- `GET card-groups/`: yalnız `pos_device_count`, `active_cards_count` (`BE:serializers/personnel_card.py:93-104`); cihaz kimlikleri yok. Detay `pos_devices[{id,sn,pos_name}]` döner, **`pos_device_ids` dönmez** (`:106-117`) → RN `CardGroup.pos_device_ids` (zorunlu tip, `RN:types/cards.ts:1-8`) detayda boş kalır; `pos_devices`'tan türetilmeli. RN her grup için detay çağırıyor (`RN:screens/cards/CardsListScreen.tsx:843-862`) — liste ekranında sayı yeterliyse kaldırın. Kart satırındaki `groups[]` ise `pos_device_ids` içerir (`:40-50`).
- `GET product-templates/`: `item_count`, `assigned_device_count`, `machine_type` var; `items`/`assigned_devices` **yok** (`BE:views/product_templates.py:44-52`). Sayılar için detay çağrısı gerekmez.

### 3.11 Cihaz ayarları PATCH — yazılabilir alanlar
`POSDeviceSettingsSerializer` (`BE:serializers/pos_device.py:226-268`), işleme `BE:views/pos_devices.py:251-416`:

| Alan | Kural | Yetki |
|---|---|---|
| `commands{and_reset,eod_trig,mdb_reset}` | bool bayrak | **yetkisiz** herkes |
| `machine_type_id` | int|null, geçersiz → 400 | `select_machine_type` (yoksa `_warnings`) |
| `pos_name` | ≤30, boş olamaz | `manage_device_settings` |
| `location_id` | int|null; şirketin bölgesine ait değilse 400 | 〃 |
| `pos_odemetip` | int 0–10 (anlamlı: 0 Snack, 1 Kahve) | 〃 |
| `price_management` | int 0–2 | 〃 |
| `sales_notification_enabled` | bool | 〃 |
| `sales_notification_interval` | int **≥1** (0 → 400) | 〃 |
| `payment_methods{magnetic,chip,contactless,qrcode,personel_card,vennex_wallet,istanbul_kart,metropol,multinet,setcard,ticket,pluxee,tokenflex,refund}` | kısmi bool | 〃 |
| `device_toggles{audio,auto_select,login_button,cancel_button}` | kısmi bool | 〃 |
| `operating_hours{mode:0|1|2, schedule:{"0".."6":[{start:"HH:MM",end:"HH:MM"}]}}` | **replace**; 0=Pzt..6=Paz | 〃 |

- **Yazılamaz** (serializer'da yok, sessizce yok sayılır): `pos_updprd`, `timeouts{vend_timeout,pos_timeout,pos_eod}`, `apk_reset`, `stat`, `act_*`. RN bunları gönderiyor (`RN:screens/devices/DeviceDetailScreen.tsx:1742, 1752-1756`) → kullanıcı "kaydedildi" görür ama değişmez. Flutter bu alanları salt-okunur gösterir (`FL:settings_tab.dart:784-818`).
- Yetkisiz alanlar 403 değil 200 + `_warnings` → UI `_warnings` göstermeli.

### 3.12 Uzaktan satış ve cihaz komutları var mı?
- Komutlar: **evet, REST PATCH içinde** (`commands`), ayrı endpoint yok (`BE:urls.py:71-72`). Çağrı yalnız bayrağı kaydeder; ack/sonuç REST'te dönmez.
- Uzaktan satış: **yalnız WebSocket** (§2.6). RN'de ikisi de yok (UI modal + uyarı metni).

### 3.13 Parola sıfırlama, 2FA, parola değişimi, deactivate/delete
- Reset: `POST auth/password-reset/ {email}` her zaman 200; link `VENNEX_MOBILE_RESET_URL?uid=<b64>&token=<t>` (24 saat) (`BE:views/auth.py:370-399`). Mobil deeplink tanımı yok; confirm `{uid,token,new_password(min 8)}` (`:402-429`).
- 2FA: status → setup (`otpauth_url` QR, `secret` Base32) → enable `{otp}` → disable `{password}`; login'de `requires_2fa` → verify (§2.1). Yanıt kodları 200 + `{detail,is_enabled}` (Flutter doc 204 der).
- Change-password: 200 `{detail}`; `new_password` min 8 ve eskisinden farklı; field hatası `{current_password:[…]}` (`BE:serializers/auth.py:6-16`).
- Deactivate 200, delete 204; ikisi de `{password}` ister, hatalıysa `{password:["Parola hatalı."]}` (`BE:serializers/auth.py:28-37`). Tüm refresh token'lar iptal.
- RN'de api fonksiyonları var ama **hiçbir ekranda kullanılmıyor** (2FA kurulum, profil güncelleme, şifre değişimi/sıfırlama, hesap silme) — mağaza şartı olan hesap silme akışı eksik.

### 3.14 Bildirim `data.event` değerleri; push kayıt payload'ı
- Backend'in gönderdiği event'ler (`BE:tasks.py`): `device.offline {sn}` (pref `device_offline`) · `transaction.new {pt_id, sn}` (`transaction_alerts`) · `stock.low {sn, slot, sku_name, qty}` (`stock_low`) · `card.pending {card_id, uid}` (`card_pending`) · `report.ready {url}` (`report_ready`) · `cari.overdue {company_id}` (`cari_overdue`) · test: `test` (`BE:views/app.py:50`). FCM data değerleri **string**'e çevrilir (`BE:fcm_service.py:54`) → `card_id`, `qty` sayı değil.
- Doc'taki `device.online`, `device.error`, `transaction.success/failed` **backend'de üretilmiyor**.
- Inbox `data` alanı `null` olabilir (`BE:views/notifications.py:28` `n.data or None`) — RN tipi `Record<string,unknown>` zorunlu (`RN:types/notifications.ts:9`); null-safe olun. Flutter sadece `actor_str` PAV/PAX ile başlıyorsa cihaza gider (`FL:features/notifications/notifications_screen.dart:62-76`).
- Push kayıt: `POST device/register/ {fcm_token, platform:"ios"|"android", device_id}` (§2.2). RN `registerDevice` tanımlı ama **çağrılmıyor**; RN'de FCM/expo-notifications entegrasyonu yok.

### 3.15 Şirket seçimi / çoklu şirket
- Kapsam `X-Company-Id` header'ı ile (`BE:mixins.py:19-51`); JWT'de `company_ids` claim'i var ama view'lar header'ı kullanır. Header yoksa **ilk** şirket (queryset sırası). Cache anahtarı şirkete göre ayrılır (`BE:cache.py:11-12`).
- Kapsam dışı view'lar: auth, device, app, legal, `companies/` (`CompanyContextMixin` yok — `BE:views/companies.py:32,43`).
- Şirket listesi: `AuthUser.companies[]` veya `GET companies/`. Flutter tek şirkette otomatik seçer, çoklu şirkette seçim ekranı + header + cache temizliği yapar (`FL:shared/providers/active_company_provider.dart:9-63`). **RN'de seçim de header de yok.**

---

## 4. Backend'de olup RN'in kullanmadığı endpoint'ler
(`BE:urls.py`'den; "kullanmıyor" = RN api fonksiyonu var ama ekran çağırmıyor)

| Grup | Endpoint |
|---|---|
| Auth | `PATCH auth/me/`, `change-password/`, `password-reset/`, `password-reset/confirm/`, `deactivate/`, `delete/`, `2fa/status|setup|enable|disable/` (hepsi kullanmıyor) |
| Push | `device/register/`, `device/unregister/` (2026-11-18 itibarıyla kullanılıyor, bkz. §8) |
| Overview | `summary/`, `revenue-timeseries/`, `payment-breakdown/`, `top-devices/`, `error-breakdown/` (RN'de yok); `recent-transactions/`, `locations/` (kullanmıyor) |
| POS | `sort/` (kullanmıyor), `sort/reset/`, `export/` (⚠ gölgeli), `products/{id}/` PATCH/DELETE, `save-as-template/`, `export-products/` (RN'de yok); `bulk-quantities/`, `fill-all-stock/` (kullanmıyor) |
| Kartlar | `cards/bulk/`, `cards/import/`, `cards/export/`, `cards/template/`, `GET cards/{id}/` (RN'de yok); `PATCH cards/{id}/`, `reject-all-pending/`, `cards/{id}/transactions/`, `bulk/balance|delete|groups/` (kullanmıyor) |
| Stok | `stock/export/overview/`, `stock/movements/`, `GET stock/locations/{id}/` (RN'de yok); `PATCH stock/locations/{id}/`, `locations/{id}/movements/`, `POST stock/skus/` (kullanmıyor) |
| Şablon | `GET items/`, `PATCH|DELETE items/{item_id}/`, `send/` (RN'de yok) |
| Diğer | `companies/`, `companies/{id}/`, `regions/*`, `locations/*`, `cari/*`, `app/min-version/`, `app/ping/`, `app/test-push/` (RN'de yok); `reports/{id}/` DELETE, `users/{id}/` GET/PATCH (kullanmıyor) |

**RN'in çağırıp backend'de karşılığı yanlış/eksik olanlar:** `POST product-templates/{id}/items/` toplu gövde (§3.2); `cardsApi.posDevices.list` `id` beklentisi (§3.9); `devicesApi.templates()` (`/product-templates/` tekrar — zararsız); bekleyen nakit alanları (§3.4).

---

## 5. Flutter'da olup RN'de olmayan özellikler

| Özellik | Açıklama | Kaynak |
|---|---|---|
| Şirket seçimi | Çoklu şirkette seçim ekranı, `X-Company-Id` header'ı, şirket değişiminde cache temizliği | `FL:features/company_select/`, `FL:shared/providers/active_company_provider.dart` |
| Cari / faturalama | Cari özet, fatura listesi, PDF URL açma, kilitli hesap yönlendirmesi (ödeme linki backend'de yok) | `FL:features/billing/`, `FL:data/repositories/billing_repository.dart` |
| Bölge & konum | Owner için bölge/lokasyon CRUD | `FL:features/regions/regions_screen.dart` |
| Yardım / şikayet | Şikayet formu (`/api/wallet/complaint/`) + yasal belgeler | `FL:features/help/help_screen.dart`, `FL:data/repositories/complaint_repository.dart` |
| Uzaktan satış (WS) | `RemoteVendSheet` + `PosVendChannel` state machine, 4003 yetki hatası | `FL:core/realtime/pos_vend_channel.dart`, `FL:features/devices/widgets/remote_vend_sheet.dart` |
| Cihaz komutları | Cihaz Reset / MDB Reset / Günsonu (`commands` PATCH) | `FL:features/devices/tabs/settings_tab.dart:68-190` |
| Çalışma saatleri editörü | mode 0/1/2 + gün bazlı aralıklar (replace) | `FL:settings_tab.dart:240-330, 465-472` |
| Push (FCM) | Token alma, backend kayıt/silme, ön plan bildirimi | `FL:core/push/push_service.dart:183-240` |
| Bildirim tercihleri | Diff ile kısmi PATCH | `FL:features/settings/screens/notification_prefs_screen.dart` (RN'de api var, ekran kullanıyor) |
| 2FA kurulumu | QR + enable/disable | `FL:features/settings/screens/two_fa_screen.dart` |
| Profil & şifre | Profil düzenleme, zorunlu profil tamamlama gate'i, şifre değişimi | `FL:features/settings/screens/profile_edit_screen.dart`, `change_password_screen.dart` |
| Min-version / force update | 1 saat SWR cache'li sürüm kontrolü | `FL:features/app_meta/`, `FL-doc:API:336-363` |
| SWR + Hive cache | `{user}:{company}:{endpoint}` anahtarlı kalıcı cache, `nocache=1` pull-to-refresh | `FL-doc:cache_strategy.md`, `FL:core/cache/` |
| Cihaz ürün CRUD (normal mod) | `name/quantity` ile normal mod ürün ekleme/düzenleme/silme | `FL:features/devices/tabs/products_tab.dart:360-395` |
| Toplu dolum / Tümünü doldur | `bulk-quantities`, `fill-all-stock` UI | `FL:products_tab.dart` |
| Şablon kalem CRUD | Kalem başına POST/PATCH/DELETE (doğru kontrat) | `FL:features/templates/template_detail_screen.dart:425-470` |
| Kart toplu işlemleri, kart işlem geçmişi, reject-all | Bulk balance/delete/groups, `cards/{id}/transactions/` | `FL:data/repositories/card_repository.dart` |
| Kullanıcı düzenleme | `GET/PATCH users/{id}/` ile pre-fill + güncelleme | `FL:features/users/` |
| İzin tabanlı UI | `PermissionGate` / `hasPermissionProvider` ile buton gizleme | `FL:core/widgets/permission_gate.dart`, `FL:shared/providers/permissions_provider.dart` |

> Not: Flutter da `cash-history`, `revenue-counts`, export uçları, `sort/reset`, `cards/import|export` ve `overview/summary` dışındaki standalone overview uçlarını çağırmıyor (yalnız `ApiConfig` sabiti) (`FL:core/config/api_config.dart`; grep). Flutter push tıklamasında deep link henüz yapılmamış (`FL:core/push/push_service.dart:171` TODO).

---

## 6. RN için öncelikli düzeltme listesi (özet)
1. `DeviceDetailScreen`: `pos_odemetip` 0=Snack/1=Kahve; `price_management` 0/1/2; `pos_updprd`/`timeouts` göndermeyi bırak; `_warnings` göster; sahte konum listesi yerine `overview/locations/`; `1147.12` sabitini kaldır.
2. `templatesApi.saveItems` → kalem başına `POST items/`, `PATCH|DELETE items/{id}/`; reçete/bileşen UI'si backend gelene kadar gizlenmeli.
3. `client.ts`: `X-Company-Id` (+ isteğe bağlı `X-Device-Id`, `X-App-Version`) ekle; şirket seçimi akışı.
4. `DevicesListScreen`: satır başına `products/` çağrısını kaldır (`fill_rate` kullan), `page_size` beklentisini 25'e çek, olmayan `machine_type` filtresini kaldır.
5. Tipler: `StockInventoryRow.sku`; para alanlarını `number | string` kabul et; `NotificationItem.data` nullable; `CardGroup.pos_device_ids` opsiyonel + `pos_devices`; `permissions` listesine `change_card_balance`.
6. Rapor: indirilen dosyaya `.xlsx`; `retry` sonrası yeni `id`; filtre anahtarlarını (çoğul diziler) backend ile teyit.
7. Kart grubu cihaz seçimi için `id` kaynağı (backend'e list `id` alanı talebi).

---

## 7. Eklenen uçlar (backend dalı `feature/mobil-ortak-yetki-ota`, 2026-11-18)

| Uç | Auth | Yanıt | Not |
|---|---|---|---|
| `GET /app/config/?platform=&version=` | Oturum + `X-Company-Id` | `{schema_version, permissions[], modules[{key,label,icon}], company_id, enums{machine_type, payment_type, card_type, stock_location_type, stock_movement_type, report_type, transaction_status, cari_state}, features[], version_policy}` | Web ile aynı kaynak: `dashboard_v2/capabilities.py`. Mobil sekme görünürlüğü buradan |
| `GET /app/min-version/?platform=&version=` | Yok | Eski alanlar + `platforms{ios,android}{min_version, latest_version, force_update, store_url, message}` + `status{update_required, update_available}` | Admin → Mobil Sürüm Politikaları |

Yetki listesine `send_device_commands` eklendi (mevcut kural: cihaza erişimi olan her yönetim kullanıcısı; web ile aynı).

## 8. Mobilin yeni kullandığı mevcut uçlar (2026-11-18)

| Uç | Auth | İstek → Yanıt | Not |
|---|---|---|---|
| `GET /regions/` | `IsOwner` | → `{results: [{id, name, description\|null, total_pos_device_count, locations: [{id, name, address, latitude\|null, longitude\|null, is_active, pos_device_count}], created_at}]}` | 600 sn önbellek; her yazmada şirket önbellek sürümü artar (liste hemen taze) |
| `POST /regions/` · `PATCH/DELETE /regions/{id}/` | `IsOwner` | `{name (≤70), description}` → 201/200 bölge (oluşturmada `total_pos_device_count` yok → istemci 0 sayar) · 204 | Aynı ad → 400 `{detail}`. Silme konumları da siler (CASCADE), cihazların konumu boşalır (SET_NULL) |
| `POST /locations/` · `PATCH/DELETE /locations/{id}/` | `IsOwner` | `{region, name (≤100), address, latitude, longitude (decimal 9,6 string\|null), is_active}` → 201/200 konum (`pos_device_count` yok) · 204 | Alan hataları DRF biçiminde (`{name: [...], latitude: [...]}`) |
| `POST /device/register/` · `POST /device/unregister/` | Oturum | `{fcm_token, platform, device_id}` · `{fcm_token}` | FCM kaydı; çıkışta silinir |
| `WS /ws/dashboard/pos/{SN}/?token=` | JWT + `remote_vend` + cihaza erişim | ← `vend_pending {tx_id, amount (kuruş), item}` · → `remote_decision {tx_id, decision: "approve"}` · ← `remote_decision_ack`, `vend_ended {result}`, `error` | Yetkisiz bağlantı el sıkışmada reddedilir (istemci 1006 görür) |

## 9. Geri bildirim ve herkese açık sayfalar (canlıda, 2026-11-18)

| Uç | Auth | İstek → Yanıt | Not |
|---|---|---|---|
| `GET /feedback/` | Oturum | → `{results: [{id, category, category_display, message, status, status_display, created_at}]}` | Yalnız kullanıcının kendi son 50 kaydı |
| `POST /feedback/` | Oturum, saatte 10 | `{category: suggestion\|bug\|question\|other, message (10–2000), platform?, app_version?}` → 201 | Kullanıcı + seçili şirket otomatik eklenir; 400 `{message: [...]}` alan hatası |
| `GET /vennexmobile/yasal/<slug>/` | Yok (web sayfası) | HTML | `LegalDocument`'tan (tek kaynak). `GET legal/<slug>/` `web_url` boşsa bu adresi döndürür |
| `GET/POST /vennexmobile/hesap-silme/` | Yok (web formu, CSRF) | 302 → `/hesap-silme/alindi/` | Google Play web silme talebi; IP başına saatte 5; hesap varlığı açığa çıkmaz |

Kullanılmayan: `auth/password-reset/`, `auth/password-reset/confirm/` (karar: kendi kendine parola sıfırlama yok; e-posta altyapısı da `console` — bkz. SECURITY S22).

## 10. Parite dalı (`feature/mobil-parite-performans`, 2026-11-19)

| Uç | Değişiklik |
|---|---|
| `POST /reports/` | Mobil artık web formuyla aynı anahtarları gönderir: `company` (tekil), `devices[]` (bölge/konum seçimi istemcide cihaza çevrilir), `transaction_status: "true"\|"false"`, `report_type: nfc_monthly_analysis` (ayın 1'i – son günü), `nfc_card_uids[]` |
| `GET /reports/filter-options/` | `X-Company-Id` ile seçili şirkete daralır |
| `GET /cards/<id>/balance-logs/?page=` | Yeni. `{count, page, num_pages, page_size:25, results:[{id, created_at, amount, balance_before, balance_after, source, source_label, operation, operation_label, description, user:{id,name}\|null, pos_device:{id,sn,pos_name}\|null}]}` |
| `POST /card-quotas/` (kartsız) | Yeni mod: `{group, product_no, period, quantity, is_active, dagitim}` → 201 `{detail, created, skipped, cards}`; çakışmada 400 ve hiçbiri yazılmaz |
| `GET /app/config/` | `card_scope_restricted: boolean` |
| `GET /stock/skus/?q=` | En fazla 50 sonuç + `truncated` |
| `GET /pos-devices/` | Satış yetkisi yoksa ciro alanları `null`, `sales_visible` |
| Excel | `GET /pos-devices/export/` (yol düzeltildi), `/pos-devices/<sn>/export-products/`, `/cards/export/`, `/stock/export/overview/` — mobilde webdeki Excel butonlarının karşılığı |
