/**
 * Play, manifestteki izin ve ekran yönünden "zorunlu donanım" çıkarır ve bu özelliği olmayan cihazlara
 * uygulamayı göstermez:
 *  - android.hardware.screen.portrait ← orientation: "portrait" (tablet/masaüstü yatay ekranlar)
 *  - android.hardware.wifi            ← ACCESS_WIFI_STATE (@react-native-community/netinfo)
 * Uygulama ikisine de muhtaç değil; isteğe bağlı (required="false") olarak beyan edilir.
 */
const { withAndroidManifest } = require("expo/config-plugins");

const OPTIONAL_FEATURES = ["android.hardware.screen.portrait", "android.hardware.wifi"];

module.exports = (config) =>
  withAndroidManifest(config, (c) => {
    const manifest = c.modResults.manifest;
    const features = (manifest["uses-feature"] = manifest["uses-feature"] ?? []);
    for (const name of OPTIONAL_FEATURES) {
      const existing = features.find((f) => f.$["android:name"] === name);
      if (existing) existing.$["android:required"] = "false";
      else features.push({ $: { "android:name": name, "android:required": "false" } });
    }
    return c;
  });
