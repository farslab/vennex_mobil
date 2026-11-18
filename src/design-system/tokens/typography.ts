import type { TextStyle } from "react-native";

/**
 * Tipografi ölçeği — sistem fontu (iOS: SF Pro, Android: Roboto).
 * Sayısal değerler `tabular-nums` ile hizalanır ki tablolar ve finansal
 * rakamlar kaymasın.
 */

const tabular: TextStyle["fontVariant"] = ["tabular-nums"];

export const typography = {
  /** Büyük ekran başlığı */
  display: { fontSize: 28, lineHeight: 34, fontWeight: "700", letterSpacing: -0.4 },
  /** Ekran başlığı */
  title: { fontSize: 22, lineHeight: 28, fontWeight: "700", letterSpacing: -0.2 },
  /** Bölüm başlığı */
  headline: { fontSize: 17, lineHeight: 22, fontWeight: "600" },
  /** Kart başlığı */
  cardTitle: { fontSize: 15, lineHeight: 20, fontWeight: "600" },
  body: { fontSize: 15, lineHeight: 21, fontWeight: "400" },
  bodyStrong: { fontSize: 15, lineHeight: 21, fontWeight: "600" },
  callout: { fontSize: 14, lineHeight: 19, fontWeight: "400" },
  calloutStrong: { fontSize: 14, lineHeight: 19, fontWeight: "600" },
  caption: { fontSize: 12, lineHeight: 16, fontWeight: "500" },
  /** Küçük büyük harf etiket (tablo başlığı, form grubu) */
  overline: { fontSize: 11, lineHeight: 14, fontWeight: "600", letterSpacing: 0.6, textTransform: "uppercase" },
  label: { fontSize: 13, lineHeight: 18, fontWeight: "600" },

  /** KPI ana değeri */
  metricLg: { fontSize: 26, lineHeight: 32, fontWeight: "700", letterSpacing: -0.3, fontVariant: tabular },
  /** Kart içi önemli değer */
  metricMd: { fontSize: 19, lineHeight: 24, fontWeight: "700", fontVariant: tabular },
  /** Liste/tablo sayısal değer */
  numeric: { fontSize: 15, lineHeight: 20, fontWeight: "600", fontVariant: tabular },
  numericSm: { fontSize: 13, lineHeight: 18, fontWeight: "500", fontVariant: tabular },
  /** Seri no, SKU kodu gibi teknik kimlikler */
  mono: { fontSize: 13, lineHeight: 18, fontWeight: "500", fontVariant: tabular, letterSpacing: 0.2 },
} satisfies Record<string, TextStyle>;

export type TypographyVariant = keyof typeof typography;
