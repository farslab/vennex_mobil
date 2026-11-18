/**
 * GEÇİŞ KÖPRÜSÜ — eski ekranlar yeni design system'e taşınana kadar eski renk adlarını
 * yeni token'lara eşler. Yeni kod `@/design-system` içindeki `useTheme()` kullanmalıdır.
 * Tüm ekranlar taşındığında bu dosya silinecek.
 */
import { useTheme, getTheme } from "@/design-system/theme";
import type { ColorTokens } from "@/design-system/tokens/colors";

function legacy(c: ColorTokens) {
  return {
    bg: c.background,
    surface: c.surface,
    surfaceAlt: c.surfaceMuted,
    card: c.surface,
    border: c.border,
    textPrimary: c.text,
    textSecondary: c.textSecondary,
    textMuted: c.textTertiary,
    primary: c.primary,
    primaryMuted: c.primarySubtle,
    success: c.success,
    warning: c.warning,
    danger: c.danger,
  };
}

export const palette = {
  light: legacy(getTheme("light").colors),
  dark: legacy(getTheme("dark").colors),
};

/** @deprecated `useTheme()` kullanın */
export function useAppTheme() {
  const theme = useTheme();
  return { mode: theme.scheme, colors: palette[theme.scheme], isDark: theme.isDark };
}

/** @deprecated statik renk — tema değişimine tepki vermez */
export const colors = palette.light;
