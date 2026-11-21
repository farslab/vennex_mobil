// Global test kurulumu: native modülleri bellek içi sahtelerle değiştirir.

// expo-secure-store → bellek içi Map
jest.mock("expo-secure-store", () => {
  const store = new Map<string, string>();
  return {
    getItemAsync: jest.fn(async (key: string) => (store.has(key) ? store.get(key)! : null)),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value);
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key);
    }),
    __reset: () => store.clear(),
  };
});

// AsyncStorage → paketin resmi jest mock'u
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock")
);

// NetInfo → paketin resmi jest mock'u
jest.mock("@react-native-community/netinfo", () =>
  require("@react-native-community/netinfo/jest/netinfo-mock.js")
);

// Safe area → paketin resmi jest mock'u (sıfır inset'ler)
jest.mock("react-native-safe-area-context", () => require("react-native-safe-area-context/jest/mock").default);

// RN Firebase Messaging → native modül yok; testler kendi davranışını ayrıca tanımlar
jest.mock("@react-native-firebase/messaging", () => ({
  AuthorizationStatus: { NOT_DETERMINED: -1, DENIED: 0, AUTHORIZED: 1, PROVISIONAL: 2, EPHEMERAL: 3 },
  getMessaging: jest.fn(() => ({})),
  getToken: jest.fn(async () => "test-fcm-token"),
  deleteToken: jest.fn(async () => undefined),
  requestPermission: jest.fn(async () => 1),
  onMessage: jest.fn(() => () => {}),
  onNotificationOpenedApp: jest.fn(() => () => {}),
  onTokenRefresh: jest.fn(() => () => {}),
  getInitialNotification: jest.fn(async () => null),
  setBackgroundMessageHandler: jest.fn(),
  isDeviceRegisteredForRemoteMessages: jest.fn(() => false),
  registerDeviceForRemoteMessages: jest.fn(async () => undefined),
}));

// Testler canlı sunucuya asla gidemesin: uygulama yalnız canlı yapılandırmayla derlenir, testte API adresi
// erişilemeyen bir test alan adına çevrilir (istekler zaten axios-mock-adapter ile yakalanır).
jest.mock("expo-constants", () => {
  const actual = jest.requireActual("expo-constants");
  const C = actual.default ?? actual;
  const expoConfig = { ...(C.expoConfig ?? {}), extra: { ...(C.expoConfig?.extra ?? {}), apiBaseUrl: "https://api.test.invalid" } };
  const patched = { ...C, expoConfig };
  return { __esModule: true, ...actual, default: patched };
});
