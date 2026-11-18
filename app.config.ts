import type { ExpoConfig } from "expo/config";

/**
 * Ortam yapılandırması.
 *
 *   APP_ENV=development  → yerel mock backend (varsayılan: http://localhost:4010).
 *                          Canlı sunucuya YANLIŞLIKLA istek atılmasını önler.
 *   APP_ENV=staging      → EXPO_PUBLIC_API_BASE_URL zorunlu (https)
 *   APP_ENV=production   → https://tms.vennex.com.tr
 *
 * Geliştirmede gerçek bir test sunucusu kullanmak için:
 *   EXPO_PUBLIC_API_BASE_URL=https://test-sunucu.example npm start
 */

type AppEnv = "development" | "staging" | "production";

const APP_ENV = (process.env.APP_ENV ?? "development") as AppEnv;
const PRODUCTION_API = "https://tms.vennex.com.tr";

function resolveApiBaseUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
  switch (APP_ENV) {
    case "production":
      return PRODUCTION_API;
    case "staging":
      if (!override) throw new Error("APP_ENV=staging için EXPO_PUBLIC_API_BASE_URL tanımlanmalı");
      if (!override.startsWith("https://")) throw new Error("Staging API adresi https olmalı");
      return override;
    default:
      return override || "http://localhost:4010";
  }
}

const apiBaseUrl = resolveApiBaseUrl();

/** Mağaza (native) sürümü — App Store / Google Play'e gönderilen sürüm. */
const APP_VERSION = "1.0.0";

/**
 * OTA runtime: yalnız aynı native sürüme sahip uygulamalar aynı JS paketini alır.
 * Ön ek "vm-" POS uygulamasının (versionCode "87" gibi) ad alanından ayırır;
 * staging ayrı runtime kullanır ki canlı paketi asla almasın.
 */
const RUNTIME_VERSION = `vm-${APP_VERSION}${APP_ENV === "staging" ? "-stg" : ""}`;
const OTA_URL = "https://ota.vennex.com.tr/api/manifest";

const config: ExpoConfig = {
  name: APP_ENV === "production" ? "Vennex" : `Vennex (${APP_ENV === "staging" ? "Test" : "Dev"})`,
  slug: "vennex-mobile-app",
  version: APP_VERSION,
  runtimeVersion: RUNTIME_VERSION,
  updates: {
    // Geliştirmede kapalı; mağaza (staging/production) derlemelerinde açık
    enabled: APP_ENV !== "development",
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
    bundleIdentifier: "com.vennex.mobileapp",
    config: { usesNonExemptEncryption: false },
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
      // Yalnızca https; geliştirmede localhost mock sunucusuna izin ver
      NSAppTransportSecurity:
        APP_ENV === "development"
          ? { NSAllowsArbitraryLoads: false, NSAllowsLocalNetworking: true }
          : { NSAllowsArbitraryLoads: false },
    },
  },
  android: {
    package: "com.vennex.mobileapp",
    adaptiveIcon: {
      foregroundImage: "./assets/images/adaptive-icon.png",
      backgroundColor: "#1C5A96",
    },
    // Yalnızca gerekli izinler
    permissions: ["INTERNET"],
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
    [
      "expo-splash-screen",
      {
        image: "./assets/images/splash-icon.png",
        imageWidth: 120,
        resizeMode: "contain",
        backgroundColor: "#FFFFFF",
        dark: { image: "./assets/images/splash-icon.png", backgroundColor: "#0A0F17" },
      },
    ],
  ],
  extra: {
    appEnv: APP_ENV,
    apiBaseUrl,
    runtimeVersion: RUNTIME_VERSION,
  },
};

export default config;
