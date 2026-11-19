import React from "react";
import { Feather } from "@expo/vector-icons";
import Svg, { Path, Rect } from "react-native-svg";
import { useTheme } from "../theme";
import type { ColorTokens } from "../tokens/colors";

type FeatherName = React.ComponentProps<typeof Feather>["name"];
/** Feather'da olmayan, aynı çizgi stilinde çizilmiş özel ikonlar */
type CustomIconName = "pos" | "excel";
export type IconName = FeatherName | CustomIconName;

export interface AppIconProps {
  name: IconName;
  size?: number;
  color?: keyof ColorTokens | (string & {});
  accessibilityLabel?: string;
}

/** Uygulama genelinde tek ikon seti (Feather — ince, kurumsal çizgi ikonlar) */
export function AppIcon({ name, size = 20, color = "textSecondary", accessibilityLabel }: AppIconProps) {
  const { colors } = useTheme();
  const resolved = color in colors ? (colors[color as keyof ColorTokens] as string) : color;
  if (name === "pos") return <PosIcon size={size} color={resolved} accessibilityLabel={accessibilityLabel} />;
  if (name === "excel") return <ExcelIcon size={size} color={resolved} accessibilityLabel={accessibilityLabel} />;
  return (
    <Feather
      name={name}
      size={size}
      color={resolved}
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? "yes" : "no-hide-descendants"}
      accessibilityLabel={accessibilityLabel}
    />
  );
}

/**
 * POS terminali (el tipi): ekran + tuş takımı. Feather ölçüleriyle (24 ızgara,
 * 2 çizgi, yuvarlak uç) çizildi ki diğer ikonlarla aynı ağırlıkta dursun.
 */
function PosIcon({ size, color, accessibilityLabel }: { size: number; color: string; accessibilityLabel?: string }) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? "yes" : "no-hide-descendants"}
      accessibilityLabel={accessibilityLabel}
    >
      <Rect x={5} y={2} width={14} height={20} rx={2} />
      <Rect x={8} y={5} width={8} height={5} rx={1} />
      <Path d="M9 14h.01M12 14h.01M15 14h.01M9 18h.01M12 18h.01M15 18h.01" />
    </Svg>
  );
}

/** Excel dosyası (web dashboard v2 "Excel'e aktar" ikonuyla aynı çizim) */
function ExcelIcon({ size, color, accessibilityLabel }: { size: number; color: string; accessibilityLabel?: string }) {
  return (
    <Svg
      width={size}
      height={size}
      // Dosya çizimi 24 ızgarada dar kalıyordu (zil simgesine göre küçük görünüyordu):
      // görünüm kutusu kırpılarak ~%20 büyütüldü; kutu boyutu aynı → hizalama değişmez.
      viewBox="2 1.5 20 20"
      fill="none"
      stroke={color}
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      accessibilityElementsHidden={!accessibilityLabel}
      importantForAccessibility={accessibilityLabel ? "yes" : "no-hide-descendants"}
      accessibilityLabel={accessibilityLabel}
    >
      <Path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <Path d="M14 3v5h5" />
      <Path d="M9 12l4 5M13 12l-4 5" />
    </Svg>
  );
}
