import { Platform, type ViewStyle } from "react-native";

/** 4px tabanlı boşluk ölçeği */
export const spacing = {
  none: 0,
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
} as const;

export const radius = {
  xs: 6,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

export const layout = {
  /** Ekran yatay iç boşluğu */
  screenPadding: spacing.lg,
  /** Bölümler arası dikey boşluk */
  sectionGap: spacing.xxl,
  /** Kart iç boşluğu */
  cardPadding: spacing.lg,
  /** Minimum dokunma alanı (WCAG / platform yönergeleri) */
  minTouchTarget: 44,
  /** Form kontrol yüksekliği */
  controlHeight: 48,
  controlHeightSm: 36,
  /** Tablet/geniş ekranda içerik genişliği sınırı */
  maxContentWidth: 720,
} as const;

/** Platforma uygun, abartısız gölgeler — yalnızca yüzen öğelerde kullanılır */
export function elevation(level: 0 | 1 | 2 | 3, isDark: boolean): ViewStyle {
  if (level === 0) return {};
  const opacity = isDark ? 0.5 : [0, 0.06, 0.1, 0.16][level];
  const radiusPx = [0, 4, 10, 18][level];
  return Platform.select<ViewStyle>({
    ios: {
      shadowColor: "#0B1220",
      shadowOpacity: opacity,
      shadowRadius: radiusPx,
      shadowOffset: { width: 0, height: level * 2 },
    },
    default: { elevation: level * 2 },
  });
}
