import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";

const ACCESS_KEY = "vennex_access_token";
const REFRESH_KEY = "vennex_refresh_token";
/** AsyncStorage uygulama silinince silinir; Keychain (SecureStore) iOS'ta silinmez */
const INSTALL_MARKER = "vennex.install.marker";

/**
 * Token'lar yalnız SecureStore'da (iOS Keychain / Android Keystore).
 * Erişilebilirlik: yalnız cihaz kilidi açıldıktan sonra, yalnız bu cihazda (yedeklere/taşımaya girmez).
 */
const SECURE_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export const tokenStorage = {
  async getAccess(): Promise<string | null> {
    return SecureStore.getItemAsync(ACCESS_KEY, SECURE_OPTIONS);
  },
  async getRefresh(): Promise<string | null> {
    return SecureStore.getItemAsync(REFRESH_KEY, SECURE_OPTIONS);
  },
  async setTokens(access: string, refresh: string): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_KEY, access, SECURE_OPTIONS);
    await SecureStore.setItemAsync(REFRESH_KEY, refresh, SECURE_OPTIONS);
  },
  async setAccess(access: string): Promise<void> {
    await SecureStore.setItemAsync(ACCESS_KEY, access, SECURE_OPTIONS);
  },
  async clear(): Promise<void> {
    await SecureStore.deleteItemAsync(ACCESS_KEY, SECURE_OPTIONS);
    await SecureStore.deleteItemAsync(REFRESH_KEY, SECURE_OPTIONS);
  },

  /**
   * Yeni kurulum kontrolü: iOS'ta Keychain uygulama silinse de kalır. Uygulama silinip
   * yeniden kurulduğunda (veya başka biri cihazı devraldığında) eski oturum otomatik
   * açılmasın diye ilk açılışta token'lar temizlenir.
   */
  async resetIfFreshInstall(): Promise<boolean> {
    let marker: string | null = null;
    try {
      marker = await AsyncStorage.getItem(INSTALL_MARKER);
    } catch {
      return false; // depolama okunamıyorsa oturumu silme
    }
    if (marker) return false;
    await this.clear();
    try {
      await AsyncStorage.setItem(INSTALL_MARKER, String(Date.now()));
    } catch {
      // bir sonraki açılışta tekrar denenir
    }
    return true;
  },
};
