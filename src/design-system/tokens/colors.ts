/**
 * Vennex renk sistemi.
 *
 * Marka: logo turuncusu (#F26B3A) ve logo mavisi (#1B75BC / #2EA3DB).
 * Kurumsal arayüzde ana aksiyon rengi koyu/kurumsal mavidir; turuncu yalnızca
 * marka vurgusu için (logo, onboarding) kullanılır — durum rengi olarak KULLANILMAZ.
 *
 * Bileşenler ham hex yerine her zaman semantik token kullanmalıdır.
 */

/** Logo SVG'sinden alınan birebir marka renkleri */
export const brand = {
  orange: "#ED6C46",
  blue: "#1C77B7",
  sky: "#36A6DD",
  ink: "#333548",
} as const;

export interface ColorTokens {
  /** Uygulama zemini */
  background: string;
  /** Kart, sheet, header yüzeyi */
  surface: string;
  /** Input, segment, ikincil yüzey */
  surfaceMuted: string;
  /** Basılı / seçili satır yüzeyi */
  surfacePressed: string;
  /** Modal arkası karartma */
  overlay: string;

  border: string;
  borderStrong: string;

  text: string;
  textSecondary: string;
  textTertiary: string;
  textInverse: string;
  textDisabled: string;

  primary: string;
  primaryPressed: string;
  primarySubtle: string;
  onPrimary: string;

  success: string;
  successSubtle: string;
  warning: string;
  warningSubtle: string;
  danger: string;
  dangerPressed: string;
  dangerSubtle: string;
  info: string;
  infoSubtle: string;
  neutral: string;
  neutralSubtle: string;

  focus: string;
  /** Grafik serileri — renk körlüğüne dayanıklı sıra */
  chart: readonly string[];
  brandAccent: string;
}

export const lightColors: ColorTokens = {
  background: "#F5F7FA",
  surface: "#FFFFFF",
  surfaceMuted: "#F0F3F7",
  surfacePressed: "#E8EDF3",
  overlay: "rgba(9, 16, 28, 0.45)",

  border: "#E2E7EE",
  borderStrong: "#C9D2DE",

  text: "#0E1726",
  textSecondary: "#4A5568",
  textTertiary: "#627085",
  textInverse: "#FFFFFF",
  textDisabled: "#A0AEC0",

  primary: "#17589C",
  primaryPressed: "#134A85",
  primarySubtle: "#E8F0FA",
  onPrimary: "#FFFFFF",

  success: "#12784A",
  successSubtle: "#E5F5EC",
  warning: "#965A08",
  warningSubtle: "#FDF3E1",
  danger: "#C2352B",
  dangerPressed: "#A52A21",
  dangerSubtle: "#FCEBEA",
  info: "#17589C",
  infoSubtle: "#E8F0FA",
  neutral: "#5A6678",
  neutralSubtle: "#EDF0F4",

  focus: "#2EA3DB",
  chart: ["#17589C", "#2EA3DB", "#12784A", "#D08A1C", "#8B5CF6", "#C2352B"],
  brandAccent: brand.orange,
};

export const darkColors: ColorTokens = {
  background: "#0A0F17",
  surface: "#111925",
  surfaceMuted: "#182231",
  surfacePressed: "#1E2A3C",
  overlay: "rgba(0, 0, 0, 0.6)",

  border: "#223044",
  borderStrong: "#2F3F57",

  text: "#EEF2F7",
  textSecondary: "#A9B5C6",
  textTertiary: "#7C8AA0",
  textInverse: "#0E1726",
  textDisabled: "#4F5D72",

  primary: "#4C9AE8",
  primaryPressed: "#3B86D2",
  primarySubtle: "#16263C",
  onPrimary: "#06111F",

  success: "#3DCB86",
  successSubtle: "#0F2A1E",
  warning: "#F0B44F",
  warningSubtle: "#2E2210",
  danger: "#FF6B5E",
  dangerPressed: "#E85A4E",
  dangerSubtle: "#341614",
  info: "#4C9AE8",
  infoSubtle: "#16263C",
  neutral: "#94A3B8",
  neutralSubtle: "#1C2635",

  focus: "#2EA3DB",
  chart: ["#4C9AE8", "#5CC8F0", "#3DCB86", "#F0B44F", "#A78BFA", "#FF6B5E"],
  brandAccent: brand.orange,
};

/** Semantik durum tonları — durumlar her zaman metin/ikonla birlikte gösterilir */
export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

export function toneColors(colors: ColorTokens, tone: StatusTone) {
  switch (tone) {
    case "success":
      return { fg: colors.success, bg: colors.successSubtle };
    case "warning":
      return { fg: colors.warning, bg: colors.warningSubtle };
    case "danger":
      return { fg: colors.danger, bg: colors.dangerSubtle };
    case "info":
      return { fg: colors.info, bg: colors.infoSubtle };
    default:
      return { fg: colors.neutral, bg: colors.neutralSubtle };
  }
}
