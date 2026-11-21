import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as { apiBaseUrl?: string; pushEnabled?: boolean };

/** Uygulama yalnız canlı sunucuyla çalışır (geliştirme/mock ortamı yok). */
export const API_BASE_URL = extra.apiBaseUrl ?? "https://tms.vennex.com.tr";
/** Derlemede bu uygulamaya ait Firebase dosyaları var mı (app.config.ts → FIREBASE_FILES) */
export const PUSH_ENABLED = extra.pushEnabled !== false;

if (!API_BASE_URL.startsWith("https://")) {
  throw new Error("API adresi https olmalıdır");
}
