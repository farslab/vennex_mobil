# Ekran Envanteri

| Rota | Dosya | Amaç | Ana uçlar | Yetki / görünürlük |
|---|---|---|---|---|
| Login | `screens/auth/LoginScreen.tsx` | Giriş | `POST auth/login/` | — |
| TwoFactor | `screens/auth/TwoFactorScreen.tsx` | TOTP doğrulama | `POST auth/2fa/verify/` | 2FA açık hesap |
| (kapı) | `screens/legal/LegalConsentGateScreen.tsx` | Bekleyen yasal onaylar | `GET legal/{slug}/`, `POST legal/accept/` | `pending_legal_docs` |
| (kapı) | `updates/VersionGate.tsx` | Zorunlu güncelleme, OTA bandı | `GET app/min-version/` | Sürüm politikası |
| Tabs › Dashboard | `screens/dashboard/DashboardScreen.tsx` | Özet, KPI, grafik | `GET overview/dashboard/`, `overview/locations/` | Ciro: `view_sales` |
| Tabs › Devices | `screens/devices/list/DevicesListScreen.tsx` | Cihaz listesi | `GET pos-devices/`, `POST pos-devices/sort/` | — |
| DeviceDetail | `screens/devices/detail/DeviceDetailScreen.tsx` | 6 sekmeli cihaz detayı | `pos-devices/{sn}/…` | Ayar: `manage_device_settings`; komut: `send_device_commands`; ciro: `view_sales`; stok: `manage_stock` |
| ProductTemplates | `screens/devices/templates/ProductTemplatesScreen.tsx` | Şablonlar | `product-templates/` | Yazma: `manage_device_settings` |
| TemplateProductsEdit | `screens/devices/templates/TemplateEditorScreen.tsx` | Şablon kalemleri | `product-templates/{id}/items/` | 〃 |
| Tabs › Cards | `screens/cards/CardsScreen.tsx` | 5 sekme | `cards/`, `card-groups/`, `recurring-balance/`, `card-quotas/`, `recurring-quota/` | Sunucu modülü `cards` |
| CardDetail | `screens/cards/CardDetailScreen.tsx` | Kart detay, düzenleme, işlemler | `cards/{id}/…` | Bakiye: `change_card_balance` |
| Tabs › Stock | `screens/stock/StockScreen.tsx` | Özet, lokasyon, SKU, hareket | `stock/…` | Sunucu modülü `stock` |
| StockLocationDetail | `screens/stock/StockLocationDetailScreen.tsx` | Envanter + hareketler | `stock/locations/{id}/…` | `manage_stock` |
| Tabs › Profile | `screens/profile/ProfileScreen.tsx` | Hesap merkezi | `auth/me/` | — |
| EditProfile | `screens/account/EditProfileScreen.tsx` | Profil düzenleme | `PATCH auth/me/` | — |
| Security | `screens/account/SecurityScreen.tsx` | Şifre, 2FA, hesap kapatma/silme | `auth/change-password/`, `auth/2fa/*`, `auth/deactivate/`, `auth/delete/` | — |
| NotificationSettings | `screens/account/NotificationSettingsScreen.tsx` | Bildirim tercihleri | `me/notification-preferences/` | — |
| CompanyAccount | `screens/account/CompanyAccountScreen.tsx` | Şirket ve cari | `companies/`, `cari/*` | owner |
| Regions | `screens/account/RegionsScreen.tsx` | Bölge ve konum yönetimi (oluştur/düzenle/sil) | `regions/…`, `locations/…` | sunucu modülü `regions` (owner) |
| Feedback | `screens/account/FeedbackScreen.tsx` | Geri bildirim ve destek (öneri/hata/soru) + önceki bildirimlerin durumu | `GET/POST feedback/` | oturum açık her kullanıcı |
| Users / UserForm | `screens/users/*` | Teknisyen yönetimi | `users/…` | owner |
| Reports / NewReport / ReportDetail | `screens/reports/*` | Asenkron raporlar | `reports/…` | `view_sales` |
| Notifications | `screens/notifications/NotificationsScreen.tsx` | Bildirim merkezi | `notifications/…` | — |
| LegalDocument | `screens/legal/LegalDocumentScreen.tsx` | KVKK, Gizlilik, Koşullar | `legal/{slug}/` | — |

Görünürlük kuralları için tek kaynak: backend `dashboard_v2/capabilities.py` (istemcide yerel yedek: `src/auth/permissions.ts`).
