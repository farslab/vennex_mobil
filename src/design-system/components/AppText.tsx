import React from "react";
import { StyleSheet, Text, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "../theme";
import type { TypographyVariant } from "../tokens/typography";
import type { ColorTokens } from "../tokens/colors";
import { fontStyle } from "../tokens/fonts";

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

/** Türkçe büyük harf: i→İ, ı→I (motorun yerel ayar desteğine bağlı kalmadan) */
export function toUpperTr(text: string): string {
  return text.replace(/i/g, "İ").replace(/ı/g, "I").toUpperCase();
}

/** Büyük harfli varyantlar (eskiden `textTransform: "uppercase"`) */
const UPPERCASE_VARIANTS: ReadonlySet<TypographyVariant> = new Set<TypographyVariant>(["overline"]);

function upperChildren(children: React.ReactNode): React.ReactNode {
  return React.Children.map(children, (c) =>
    typeof c === "string" ? toUpperTr(c) : typeof c === "number" ? toUpperTr(String(c)) : c
  );
}

/** Yalnız düz metin çocuklardan (iç içe öğe yoksa) okunabilir etiket */
function plainText(children: React.ReactNode): string | null {
  const parts = React.Children.toArray(children);
  if (!parts.every((c) => typeof c === "string" || typeof c === "number")) return null;
  return parts.join("");
}

/** Tüm metinler bu bileşenden geçer — tipografi ve renk tema token'larından gelir */
export function AppText({
  variant = "body",
  color = "text",
  align,
  weight,
  style,
  maxFontSizeMultiplier,
  children,
  accessibilityLabel,
  ...rest
}: AppTextProps) {
  const theme = useTheme();
  const isNumeric = variant.startsWith("metric") || variant.startsWith("numeric");
  const upper = UPPERCASE_VARIANTS.has(variant);
  // Son kalınlık (varyant → weight → style) yazı tipi dosyasını seçer
  const effectiveWeight =
    (StyleSheet.flatten(style) as TextStyle | undefined)?.fontWeight ?? weight ?? theme.typography[variant].fontWeight;
  return (
    <Text
      {...rest}
      // Ekran okuyucu büyük harfli kısa kelimeyi harf harf okumasın: özgün metin etiket olur
      accessibilityLabel={accessibilityLabel ?? (upper ? (plainText(children) ?? undefined) : undefined)}
      // Yoğun sayısal alanlarda büyük yazı tipi ayarı düzeni bozmasın
      maxFontSizeMultiplier={maxFontSizeMultiplier ?? (isNumeric ? 1.3 : 1.6)}
      style={[
        theme.typography[variant],
        { color: theme.colors[color] },
        align ? { textAlign: align } : null,
        weight ? { fontWeight: weight } : null,
        style,
        fontStyle(effectiveWeight),
      ]}
    >
      {upper ? upperChildren(children) : children}
    </Text>
  );
}
