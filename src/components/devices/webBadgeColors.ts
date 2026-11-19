/**
 * Web işlem listesindeki rozet renkleri (theme/templates/partials/pt_badge.html — Tailwind 100/700,
 * koyu temada 900/30 + 400). Her ödeme tipi ve okuma şekli ayrı renktir.
 */
export type WebBadgeColor =
  | "gray"
  | "blue"
  | "purple"
  | "green"
  | "sky"
  | "orange"
  | "pink"
  | "emerald"
  | "teal"
  | "rose"
  | "indigo"
  | "cyan"
  | "amber";

const LIGHT: Record<WebBadgeColor, { bg: string; fg: string }> = {
  gray: { bg: "#F3F4F6", fg: "#374151" },
  blue: { bg: "#DBEAFE", fg: "#1D4ED8" },
  purple: { bg: "#F3E8FF", fg: "#7E22CE" },
  green: { bg: "#DCFCE7", fg: "#15803D" },
  sky: { bg: "#E0F2FE", fg: "#0369A1" },
  orange: { bg: "#FFEDD5", fg: "#C2410C" },
  pink: { bg: "#FCE7F3", fg: "#BE185D" },
  emerald: { bg: "#D1FAE5", fg: "#047857" },
  teal: { bg: "#CCFBF1", fg: "#0F766E" },
  rose: { bg: "#FFE4E6", fg: "#BE123C" },
  indigo: { bg: "#E0E7FF", fg: "#4338CA" },
  cyan: { bg: "#CFFAFE", fg: "#0E7490" },
  amber: { bg: "#FEF3C7", fg: "#B45309" },
};

const DARK: Record<WebBadgeColor, { bg: string; fg: string }> = {
  gray: { bg: "#374151", fg: "#D1D5DB" },
  blue: { bg: "rgba(30,58,138,0.35)", fg: "#60A5FA" },
  purple: { bg: "rgba(88,28,135,0.35)", fg: "#C084FC" },
  green: { bg: "rgba(20,83,45,0.35)", fg: "#4ADE80" },
  sky: { bg: "rgba(12,74,110,0.35)", fg: "#38BDF8" },
  orange: { bg: "rgba(124,45,18,0.35)", fg: "#FB923C" },
  pink: { bg: "rgba(131,24,67,0.35)", fg: "#F472B6" },
  emerald: { bg: "rgba(6,78,59,0.35)", fg: "#34D399" },
  teal: { bg: "rgba(19,78,74,0.35)", fg: "#2DD4BF" },
  rose: { bg: "rgba(136,19,55,0.35)", fg: "#FB7185" },
  indigo: { bg: "rgba(49,46,129,0.35)", fg: "#818CF8" },
  cyan: { bg: "rgba(22,78,99,0.35)", fg: "#22D3EE" },
  amber: { bg: "rgba(120,53,15,0.35)", fg: "#FBBF24" },
};

export function webBadgeColors(color: WebBadgeColor, isDark: boolean): { bg: string; fg: string } {
  return (isDark ? DARK : LIGHT)[color];
}
