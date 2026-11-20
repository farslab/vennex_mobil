/**
 * Degradeli öne çıkan kart yüzeyi (varsayılan lacivert; turuncu paleti de var) (Genel Bakış ciro kartı, cihaz detayı ciro özeti).
 * Sağ üstte çok soluk Vennex "V" filigranı; içerik beyaz yazıyla üstüne gelir.
 */
import React from "react";
import { StyleSheet, View, type StyleProp, type ViewStyle } from "react-native";
import Svg, { G, Path } from "react-native-svg";
import { LinearGradient } from "expo-linear-gradient";
import { makeStyles, useTheme } from "@/design-system";
import { VENNEX_MARK_PATHS, VENNEX_MARK_VIEWBOX } from "@/assets/vennexMarkSvg";

/** Renk paletleri: lacivert (Genel Bakış) · turuncu (Vennex marka turuncusu — cihaz detayı) */
const PALETTES = {
  navy: { light: ["#0B2E55", "#17589C"], dark: ["#0C1E36", "#173A63"], shadow: "#0B2E55" },
  orange: { light: ["#B8461F", "#ED6C46"], dark: ["#6B2A12", "#A8482A"], shadow: "#B8461F" },
} as const;

export type HeroPalette = keyof typeof PALETTES;

/** Renkli zeminde ikincil yazı rengi */
export const HERO_MUTED = "rgba(255,255,255,0.72)";
/** Renkli zeminde ince ayraç rengi */
export const HERO_DIVIDER = "rgba(255,255,255,0.18)";

export function HeroSurface({
  palette = "navy",
  style,
  testID,
  children,
}: {
  palette?: HeroPalette;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  const { isDark } = useTheme();
  return (
    <LinearGradient
      colors={isDark ? PALETTES[palette].dark : PALETTES[palette].light}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={[styles.hero, { shadowColor: PALETTES[palette].shadow }, style]}
      testID={testID}
    >
      <View pointerEvents="none" style={styles.watermark} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        <Svg width="100%" height="100%" viewBox={VENNEX_MARK_VIEWBOX}>
          {/* Grup saydamlığı: üst üste binen parçalar tek katman gibi görünür */}
          <G opacity={0.07}>
            {VENNEX_MARK_PATHS.map((d, i) => (
              <Path key={i} d={d} fill="#FFFFFF" fillRule="evenodd" />
            ))}
          </G>
        </Svg>
      </View>
      {children}
    </LinearGradient>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    hero: {
      borderRadius: 20,
      padding: t.spacing.lg,
      overflow: "hidden",
      gap: t.spacing.md,
      shadowOpacity: 0.25,
      shadowRadius: 14,
      shadowOffset: { width: 0, height: 6 },
      elevation: 4,
    },
    // V işareti sağ üstte, kartın kenarından taşarak (kart overflow ile kırpar)
    watermark: { position: "absolute", width: 210, height: 188, top: -28, right: -46 },
  })
);
