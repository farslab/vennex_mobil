/**
 * Play yükleme anahtarıyla imzalama. Anahtar repoda değil: ~/.vennex-android/keystore.properties
 * (VENNEX_UPLOAD_STORE_FILE / _STORE_PASSWORD / _KEY_ALIAS / _KEY_PASSWORD). Dosya yoksa release
 * derlemesi debug anahtarıyla imzalanır (Play bunu kabul etmez; yanlışlıkla yükleme olmaz).
 * android/ klasörü prebuild ile yeniden üretildiğinde bu blok kaybolmasın diye eklenti olarak tutulur.
 */
const { withAppBuildGradle } = require("expo/config-plugins");

const KEY_BLOCK = `    // Play yükleme anahtarı: ~/.vennex-android/keystore.properties (repoda değil)
    def vennexKeyProps = new Properties()
    def vennexKeyFile = new File(System.getProperty("user.home"), ".vennex-android/keystore.properties")
    if (vennexKeyFile.exists()) { vennexKeyFile.withInputStream { vennexKeyProps.load(it) } }
    signingConfigs {
        if (vennexKeyFile.exists()) {
            release {
                storeFile file(vennexKeyProps['VENNEX_UPLOAD_STORE_FILE'])
                storePassword vennexKeyProps['VENNEX_UPLOAD_STORE_PASSWORD']
                keyAlias vennexKeyProps['VENNEX_UPLOAD_KEY_ALIAS']
                keyPassword vennexKeyProps['VENNEX_UPLOAD_KEY_PASSWORD']
            }
        }
`;

function apply(src) {
  if (src.includes("vennexKeyFile")) return src;
  const withKeys = src.replace(/^ {4}signingConfigs \{\n/m, KEY_BLOCK);
  // buildTypes › release içindeki ilk "signingConfig signingConfigs.debug" satırı
  const out = withKeys.replace(
    /(buildTypes \{[\s\S]*?\n {8}release \{[\s\S]*?)signingConfig signingConfigs\.debug/,
    "$1signingConfig vennexKeyFile.exists() ? signingConfigs.release : signingConfigs.debug",
  );
  if (out === src || !out.includes("signingConfigs.release : signingConfigs.debug")) {
    throw new Error("withVennexUploadSigning: build.gradle beklenen biçimde değil");
  }
  return out;
}

module.exports = (config) =>
  withAppBuildGradle(config, (c) => {
    c.modResults.contents = apply(c.modResults.contents);
    return c;
  });
module.exports.apply = apply;
