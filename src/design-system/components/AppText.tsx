import React from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "../theme";
import type { TypographyVariant } from "../tokens/typography";
import type { ColorTokens } from "../tokens/colors";

type TextColor = Extract<
  keyof ColorTokens,
  | "text"
  | "textSecondary"
  | "textTertiary"
  | "textInverse"
  | "textDisabled"
  | "primary"
  | "success"
  | "warning"
  | "danger"
  | "onPrimary"
>;

export interface AppTextProps extends TextProps {
  variant?: TypographyVariant;
  color?: TextColor;
  align?: TextStyle["textAlign"];
  weight?: TextStyle["fontWeight"];
}

/** Tüm metinler bu bileşenden geçer — tipografi ve renk tema token'larından gelir */
export function AppText({
  variant = "body",
  color = "text",
  align,
  weight,
  style,
  maxFontSizeMultiplier,
  ...rest
}: AppTextProps) {
  const theme = useTheme();
  const isNumeric = variant.startsWith("metric") || variant.startsWith("numeric");
  return (
    <Text
      {...rest}
      // Yoğun sayısal alanlarda büyük yazı tipi ayarı düzeni bozmasın
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? (isNumeric ? 1.3 : 1.6)}
      style={[
        theme.typography[variant],
        { color: theme.colors[color] },
        align ? { textAlign: align } : null,
        weight ? { fontWeight: weight } : null,
        style,
      ]}
    />
  );
}
