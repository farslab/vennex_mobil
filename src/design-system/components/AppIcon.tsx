import React from "react";
import { Feather } from "@expo/vector-icons";
import { useTheme } from "../theme";
import type { ColorTokens } from "../tokens/colors";

export type IconName = React.ComponentProps<typeof Feather>["name"];

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
