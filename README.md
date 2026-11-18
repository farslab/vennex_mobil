# Vennex Mobile

Vennex TMS işletme yönetim uygulaması: POS/otomat filosu, personel kartları, stok, raporlar. iOS ve Android (App Store, Google Play).

Expo SDK 57 · React Native 0.86 · React 19.2 · TypeScript (strict) · React Query 5 · Zustand

## Hızlı başlangıç

```bash
npm ci
```

```bash
npm run mock
```

```bash
npx expo run:ios
```

Geliştirme derlemesi varsayılan olarak **yerel** sunucuya (`http://localhost:4010`) bağlanır; canlı sunucuya bağlanmaz. Seçenekler:

- `npm run mock`: kurgusal veriyle hafif mock sunucu (giriş `demo` / `demo1234`)
- `../backend-local/run.sh server`: **gerçek backend kodu**, izole yerel veritabanı (bkz. `docs/BACKEND_CHANGES.md`)

## Komutlar

| Komut | Ne yapar |
|---|---|
| `npm run check` | Tip kontrolü + lint + tüm testler |
| `npm test` / `npm run test:watch` | Jest |
| `npm run typecheck` / `npm run lint` | |
| `npm run mock` | Yerel mock backend |
| `npm run ota -- "açıklama"` | OTA (JS) yayını, bkz. `docs/OTA_AND_RELEASE.md` |
| `maestro test e2e/maestro/<akış>.yaml` | E2E |

## Dokümanlar

| Doküman | İçerik |
|---|---|
| [`docs/ENGINEERING_GUIDE.md`](docs/ENGINEERING_GUIDE.md) | Bağlayıcı kod kuralları |
| [`docs/DESIGN_SYSTEM.md`](docs/DESIGN_SYSTEM.md) | Tasarım sistemi |
| [`docs/API_CONTRACTS.md`](docs/API_CONTRACTS.md) | Backend sözleşmesi (kanıtlı) |
| [`docs/SCREEN_INVENTORY.md`](docs/SCREEN_INVENTORY.md) | Ekranlar, uçlar, yetkiler |
| [`docs/BACKEND_CHANGES.md`](docs/BACKEND_CHANGES.md) | Backend dalı, canlıya alma planı |
| [`docs/OTA_AND_RELEASE.md`](docs/OTA_AND_RELEASE.md) | Mağaza, OTA, zorunlu güncelleme |
| [`docs/SECURITY_AUDIT.md`](docs/SECURITY_AUDIT.md) | Güvenlik |
| [`docs/PERFORMANCE_AUDIT.md`](docs/PERFORMANCE_AUDIT.md) | Performans |
| [`docs/TEST_PLAN.md`](docs/TEST_PLAN.md) / [`docs/TEST_RESULTS.md`](docs/TEST_RESULTS.md) | Test |
| [`docs/PRODUCTION_READINESS.md`](docs/PRODUCTION_READINESS.md) | Yayın hazırlığı |
| [`docs/INITIAL_AUDIT.md`](docs/INITIAL_AUDIT.md) / [`docs/CHANGELOG.md`](docs/CHANGELOG.md) | Başlangıç denetimi, değişiklikler |

## Temel kural

Canlı sunucu (`tms.vennex.com.tr`) gerçek müşteri verisi taşır. Testler, betikler ve geliştirme derlemeleri ona istek atmaz.
