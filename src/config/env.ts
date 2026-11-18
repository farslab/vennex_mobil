import Constants from "expo-constants";
import { Platform } from "react-native";

export type AppEnv = "development" | "staging" | "production";

const extra = (Constants.expoConfig?.extra ?? {}) as { appEnv?: AppEnv; apiBaseUrl?: string; pushEnabled?: boolean };

export const APP_ENV: AppEnv = extra.appEnv ?? "development";
export const IS_PRODUCTION = APP_ENV === "production";
/** Derlemede bu uygulamaya ait Firebase dosyaları var mı (app.config.ts → FIREBASE_FILES) */
export const PUSH_ENABLED = extra.pushEnabled !== false;

/**
 * Geliştirmede "localhost" mock sunucusu:
 *  - Android emülatöründe host makine 10.0.2.2'dir
 *  - Fiziksel cihazda Metro'nun LAN IP'si kullanılır (hostUri)
 */
export function resolveDevHost(url: string): string {
  if (APP_ENV !== "development" || !/^http:\/\/(localhost|127\.0\.0\.1)/.test(url)) return url;
  const hostUri = Constants.expoConfig?.hostUri; // ör. "192.168.1.20:8081"
  const lanHost = hostUri?.split(":")[0];
  if (lanHost && lanHost !== "localhost" && lanHost !== "127.0.0.1") {
    return url.replace(/localhost|127\.0\.0\.1/, lanHost);
  }
  if (Platform.OS === "android") return url.replace(/localhost|127\.0\.0\.1/, "10.0.2.2");
  return url;
}

export const API_BASE_URL = resolveDevHost(extra.apiBaseUrl ?? "http://localhost:4010");

// Production build'de güvenli olmayan adres kesinlikle kabul edilmez
if (IS_PRODUCTION && !API_BASE_URL.startsWith("https://")) {
  throw new Error("Production API adresi https olmalıdır");
}
