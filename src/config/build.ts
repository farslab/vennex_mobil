/**
 * OTA numarası. tools/ota-publish.sh `expo export` sırasında EXPO_PUBLIC_OTA_LABEL verir; Babel derleme
 * anında pakete gömer. Mağazadaki (gömülü) pakette yoktur → null.
 */
export const OTA_LABEL: string | null = process.env.EXPO_PUBLIC_OTA_LABEL?.trim() || null;

/** Ekranda gösterilen sürüm: mağaza sürümü "1.0.0", 5. OTA'sı "1.0.0-5" (vennexRN ile aynı biçim). */
export function displayVersion(appVersion: string | null | undefined, otaLabel: string | null = OTA_LABEL): string | null {
  const v = appVersion?.trim() || null;
  if (!v) return otaLabel ? `OTA ${otaLabel}` : null;
  return otaLabel ? `${v}-${otaLabel}` : v;
}
