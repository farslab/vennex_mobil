# Firebase (push) istemci dosyaları

Bu klasöre Firebase konsolunda **`tr.com.vennex`** kimliğiyle kaydedilmiş uygulamaların dosyaları konur:

- `google-services.json` — Android uygulaması (paket adı `tr.com.vennex`)
- `GoogleService-Info.plist` — iOS uygulaması (bundle id `tr.com.vennex`)

**İkisi de repoya konmaz** (`.gitignore`): içlerindeki Google API anahtarı GitHub gizli bilgi
taramasında uyarı üretir. Yerel derlemede bu klasöre konur; EAS (bulut) derlemesinde "file" türü
gizli ortam değişkeni olarak yüklenir:

```bash
eas env:create --name GOOGLE_SERVICES_JSON --type file --value ./firebase/google-services.json --environment production --visibility secret
eas env:create --name GOOGLE_SERVICE_INFO_PLIST --type file --value ./firebase/GoogleService-Info.plist --environment production --visibility secret
```

(`preview`/`development` ortamları için de aynı komut `--environment` değiştirilerek çalıştırılır.)
`app.config.ts` önce bu değişkenlere, yoksa `firebase/` klasörüne bakar.

**Anahtar kısıtlaması:** Google Cloud Console → APIs & Services → Credentials'ta bu anahtarları
uygulama kısıtlamasıyla (iOS bundle id / Android paket adı + SHA-1) ve API kısıtlamasıyla
(yalnız Firebase API'leri) sınırlayın.

Kurallar (`app.config.ts` → `FIREBASE_FILES`):

- Dosyanın içindeki kimlik `tr.com.vennex` değilse yapılandırma hata verir. Eski Flutter uygulamasının
  (`com.vennex.mobile`) dosyaları kullanılamaz.
- Dosyalar yokken geliştirme/staging derlemesi **push'suz** çalışır (bildirim izni de sorulmaz).
- **Production derlemesi dosyalar olmadan başlamaz.**

Backend push'u `firebase_mobile_serviceAccount.json` (proje `vennexmobile`) ile gönderir. Yeni
uygulamalar **aynı Firebase projesine** eklenirse backend değişikliği gerekmez; ayrı bir projeye
eklenirse backend'e o projenin servis hesabı tanımlanmalıdır.

APNs anahtarı (.p8) ve servis hesabı dosyaları **asla** bu repoya konmaz.
