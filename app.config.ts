import fs from "fs";
import path from "path";
import type { ExpoConfig } from "expo/config";

/**
 * Uygulama tek ortamda çalışır: canlı (https://tms.vennex.com.tr). Geliştirme/mock sürümü yoktur;
 * simülatör, cihaz ve mağaza derlemelerinin hepsi aynı canlı yapılandırmayla test edilir.
 */
const API_BASE_URL = "https://tms.vennex.com.tr";

/** Mağaza (native) sürümü — App Store / Google Play'e gönderilen sürüm. */
const APP_VERSION = "1.0.0";

/**
 * OTA runtime: yalnız aynı native sürüme sahip uygulamalar aynı JS paketini alır.
 * Ön ek "vm-" POS uygulamasının (versionCode "87" gibi) ad alanından ayırır.
 */
const RUNTIME_VERSION = `vm-${APP_VERSION}`;
const OTA_URL = "https://ota.vennex.com.tr/api/manifest";

/**
 * Mağaza kimliği (Android paket adı = iOS bundle id). Yayından sonra DEĞİŞTİRİLEMEZ.
 * Eski Flutter uygulaması `com.vennex.mobile` kullanır; çakışmaması için bu uygulama farklıdır.
 */
const APP_ID = "tr.com.vennex";

/**
 * Firebase (push) istemci dosyaları yalnız bu uygulamanın kimliğine aitse kullanılır.
 * Başka uygulamanın dosyası (ör. Flutter'ınki) sessizce kullanılmasın diye eşleşme zorunludur.
 * Dosyalar yoksa derleme durur (push zorunlu).
 */
/*
 * Dosyalar REPOYA KONMAZ (.gitignore; içlerindeki Google API anahtarı GitHub gizli bilgi taramasına
 * takılır). Yerelde firebase/ klasörüne konur; EAS derlemesinde "file" türü gizli ortam
 * değişkenleri (GOOGLE_SERVICES_JSON, GOOGLE_SERVICE_INFO_PLIST) dosyanın yolunu verir.
 */
const FIREBASE_FILES = {
  android: {
    file: process.env.GOOGLE_SERVICES_JSON || "./firebase/google-services.json",
    marker: `"package_name": "${APP_ID}"`,
  },
  ios: {
    file: process.env.GOOGLE_SERVICE_INFO_PLIST || "./firebase/GoogleService-Info.plist",
    marker: `<string>${APP_ID}</string>`,
  },
} as const;

function firebaseFile(platform: keyof typeof FIREBASE_FILES): string | undefined {
  const { file, marker } = FIREBASE_FILES[platform];
  const abs = path.resolve(__dirname, file); // EAS mutlak yol verir
  if (!fs.existsSync(abs)) return undefined;
  if (!fs.readFileSync(abs, "utf8").includes(marker)) {
    throw new Error(`${file} başka bir uygulamaya ait: Firebase'de ${APP_ID} için kayıtlı uygulamanın dosyasını kullanın`);
  }
  return file;
}

const googleServicesAndroid = firebaseFile("android");
const googleServicesIos = firebaseFile("ios");
const PUSH_ENABLED = Boolean(googleServicesAndroid && googleServicesIos);
if (!PUSH_ENABLED) {
  throw new Error(`Production derlemesi için firebase/ altında ${APP_ID} kimliğine ait Firebase dosyaları gerekli`);
}

const config: ExpoConfig = {
  name: "Vennex",
  slug: "vennex-mobile-app",
  // EAS (bulut derleme + gizli dosya değişkenleri) projesi: @arslanhan/vennex-mobile-app
  owner: "arslanhan",
  version: APP_VERSION,
  runtimeVersion: RUNTIME_VERSION,
  updates: {
    enabled: true,
    url: OTA_URL,
    // Kontrol uygulama kodunda yapılır (src/updates/otaUpdater.ts): açılışı geciktirmez
    checkAutomatically: "NEVER",
    fallbackToCacheTimeout: 0,
    // Xavia sunucusu manifestleri tek anahtarla imzalar (POS uygulamasıyla aynı genel sertifika)
    codeSigningCertificate: "./ota/certificate.pem",
    codeSigningMetadata: { keyid: "main", alg: "rsa-v1_5-sha256" },
  },
  orientation: "portrait",
  userInterfaceStyle: "automatic",
  icon: "./assets/images/icon.png",
  scheme: "vennex",
  assetBundlePatterns: ["**/*"],
  ios: {
    supportsTablet: true,
    bundleIdentifier: APP_ID,
    // Firebase (FCM) istemci yapılandırması — yalnız APP_ID'ye aitse (bkz. FIREBASE_FILES)
    ...(googleServicesIos ? { googleServicesFile: googleServicesIos } : {}),
    config: { usesNonExemptEncryption: false },
    // Push: APNs yeteneği (EAS imzalarken etkinleştirir)
    entitlements: { "aps-environment": "production" },
    // App Store gizlilik manifesti: izleme yok, veri toplama yalnız uygulama işlevi için
    privacyManifests: {
      NSPrivacyTracking: false,
      NSPrivacyTrackingDomains: [],
      NSPrivacyCollectedDataTypes: [],
      NSPrivacyAccessedAPITypes: [
        // AsyncStorage / tema tercihi → UserDefaults (yalnız uygulamanın kendi verisi)
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryUserDefaults", NSPrivacyAccessedAPITypeReasons: ["CA92.1"] },
        // Rapor dosyası indirme/paylaşma → dosya zaman damgası
        { NSPrivacyAccessedAPIType: "NSPrivacyAccessedAPICategoryFileTimestamp", NSPrivacyAccessedAPITypeReasons: ["C617.1"] },
      ],
    },
    infoPlist: {
      // Yalnızca https
      NSAppTransportSecurity: { NSAllowsArbitraryLoads: false },
      // Bildirim geldiğinde uygulama arka plandayken veri işleyebilsin
      UIBackgroundModes: ["remote-notification"],
    },
  },
  android: {
    package: APP_ID,
    ...(googleServicesAndroid ? { googleServicesFile: googleServicesAndroid } : {}),
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#1C5A96",
    },
    // Yalnızca gerekli izinler
    // Android 13+ bildirim izni çalışma anında ayrıca istenir
    permissions: ["INTERNET", "android.permission.POST_NOTIFICATIONS"],
    blockedPermissions: [
      "android.permission.READ_EXTERNAL_STORAGE",
      "android.permission.WRITE_EXTERNAL_STORAGE",
      "android.permission.SYSTEM_ALERT_WINDOW",
    ],
  },
  plugins: [
    "expo-secure-store",
    "expo-sharing",
    "expo-updates",
    "@react-native-firebase/app",
    "@react-native-firebase/messaging",
    // RN Firebase 27: Firebase iOS SDK yalnız SPM ile gelir ve dinamik framework bağlaması ister
    ["expo-build-properties", { ios: { useFrameworks: "dynamic" } }],
    [
      "expo-splash-screen",
      {
        // Tam Vennex logosu (simge + VENNEX + PAYMENT SYSTEMS); koyu temada lacivert yazı açık renk
        image: "./assets/images/splash-logo.png",
        imageWidth: 240,
        resizeMode: "contain",
        backgroundColor: "#FFFFFF",
        dark: { image: "./assets/images/splash-logo-dark.png", backgroundColor: "#0A0F17" },
      },
    ],
  ],
  extra: {
    apiBaseUrl: API_BASE_URL,
    runtimeVersion: RUNTIME_VERSION,
    // Firebase dosyaları bu kimliğe ait değilse push kodu hiç çalışmaz (izin de sorulmaz)
    pushEnabled: PUSH_ENABLED,
    // EAS projesi @arslanhan/vennex-mobile-app (bulut derleme ve gizli dosya değişkenleri)
    eas: { projectId: "a9dc80c8-db2b-4845-b1c7-145b24c18a1e" },
  },
};

export default config;
