/**
 * Uygulama yazı tipi: Plus Jakarta Sans (Google Fonts, OFL). Her kalınlık ayrı bir dosya/aile adıdır;
 * özel yazı tiplerinde `fontWeight` güvenilir değildir (Android aileyi düşürür, iOS sahte kalınlık
 * uygulayabilir), bu yüzden kalınlık → aile adı eşlemesiyle seçilir.
 * Yazı tipi yüklenemezse (ör. testler) sistem yazı tipine düşülür.
 */
import type { TextStyle } from "react-native";
import {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
} from "@expo-google-fonts/plus-jakarta-sans";

export const FONT_ASSETS = {
  PlusJakartaSans_400Regular,
  PlusJakartaSans_500Medium,
  PlusJakartaSans_600SemiBold,
  PlusJakartaSans_700Bold,
  PlusJakartaSans_800ExtraBold,
};

const BY_WEIGHT: Record<string, keyof typeof FONT_ASSETS> = {
  "100": "PlusJakartaSans_400Regular",
  "200": "PlusJakartaSans_400Regular",
  "300": "PlusJakartaSans_400Regular",
  "400": "PlusJakartaSans_400Regular",
  normal: "PlusJakartaSans_400Regular",
  "500": "PlusJakartaSans_500Medium",
  "600": "PlusJakartaSans_600SemiBold",
  "700": "PlusJakartaSans_700Bold",
  bold: "PlusJakartaSans_700Bold",
  "800": "PlusJakartaSans_800ExtraBold",
  "900": "PlusJakartaSans_800ExtraBold",
};

let loaded = false;
/** Yazı tipleri yüklendikten sonra çağrılır (App) — önce çağrılmazsa sistem yazı tipi kullanılır */
export function markFontsLoaded(value = true) {
  loaded = value;
}

/** Kalınlığa göre yazı tipi stili: `fontFamily` ayarlanır, `fontWeight` kaldırılır */
export function fontStyle(weight: TextStyle["fontWeight"] | undefined): Pick<TextStyle, "fontFamily" | "fontWeight"> {
  if (!loaded) return {};
  const family = BY_WEIGHT[String(weight ?? "400")] ?? "PlusJakartaSans_400Regular";
  return { fontFamily: family, fontWeight: undefined };
}

/** TextInput gibi doğrudan RN bileşenleri için normal kalınlık */
export function regularFont(): Pick<TextStyle, "fontFamily"> {
  return loaded ? { fontFamily: "PlusJakartaSans_400Regular" } : {};
}
