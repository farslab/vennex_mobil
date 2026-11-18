# Firebase (push) istemci dosyaları

Bu klasöre Firebase konsolunda **`tr.com.vennex`** kimliğiyle kaydedilmiş uygulamaların dosyaları konur:

- `google-services.json` — Android uygulaması (paket adı `tr.com.vennex`) — `.gitignore`'da
- `GoogleService-Info.plist` — iOS uygulaması (bundle id `tr.com.vennex`)

Kurallar (`app.config.ts` → `FIREBASE_FILES`):

- Dosyanın içindeki kimlik `tr.com.vennex` değilse yapılandırma hata verir. Eski Flutter uygulamasının
  (`com.vennex.mobile`) dosyaları kullanılamaz.
- Dosyalar yokken geliştirme/staging derlemesi **push'suz** çalışır (bildirim izni de sorulmaz).
- **Production derlemesi dosyalar olmadan başlamaz.**

Backend push'u `firebase_mobile_serviceAccount.json` (proje `vennexmobile`) ile gönderir. Yeni
uygulamalar **aynı Firebase projesine** eklenirse backend değişikliği gerekmez; ayrı bir projeye
eklenirse backend'e o projenin servis hesabı tanımlanmalıdır.

APNs anahtarı (.p8) ve servis hesabı dosyaları **asla** bu repoya konmaz.
