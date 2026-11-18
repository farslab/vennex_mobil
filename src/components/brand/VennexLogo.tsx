import React, { useMemo } from "react";
import { SvgXml } from "react-native-svg";
import { useTheme } from "@/design-system";
import { VENNEX_LOGO_SVG } from "@/assets/vennexLogoSvg";

const ASPECT = 249 / 66;

/**
 * Vektörel Vennex logosu. Koyu temada lacivert yazı kısmı açık renge çevrilir,
 * böylece logo her iki temada da okunur.
 */
export function VennexLogo({ height = 28 }: { height?: number }) {
  const { isDark, colors } = useTheme();
  const xml = useMemo(
    () => (isDark ? VENNEX_LOGO_SVG.replace(/#1c77b7/gi, colors.text) : VENNEX_LOGO_SVG),
    [isDark, colors.text]
  );
  return (
    <SvgXml
      xml={xml}
      width={height * ASPECT}
      height={height}
      accessibilityRole="image"
      accessibilityLabel="Vennex"
    />
  );
}
