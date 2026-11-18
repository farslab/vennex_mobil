import { useMemo } from "react";
import { useColorScheme } from "react-native";
import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { darkColors, lightColors, type ColorTokens } from "./tokens/colors";
import { typography } from "./tokens/typography";
import { elevation, layout, radius, spacing } from "./tokens/layout";

export type ThemePreference = "system" | "light" | "dark";
export type ColorScheme = "light" | "dark";

const STORAGE_KEY = "vennex.theme.preference";

interface ThemePreferenceState {
  preference: ThemePreference;
  hydrated: boolean;
  setPreference: (preference: ThemePreference) => void;
  hydrate: () => Promise<void>;
}

/** Kullanıcının tema tercihi (sistem/açık/koyu). Hassas veri değildir → AsyncStorage. */
export const useThemePreference = create<ThemePreferenceState>((set) => ({
  preference: "system",
  hydrated: false,
  setPreference: (preference) => {
    set({ preference });
    AsyncStorage.setItem(STORAGE_KEY, preference).catch(() => {});
  },
  hydrate: async () => {
    try {
      const saved = await AsyncStorage.getItem(STORAGE_KEY);
      if (saved === "light" || saved === "dark" || saved === "system") set({ preference: saved });
    } finally {
      set({ hydrated: true });
    }
  },
}));

export interface Theme {
  scheme: ColorScheme;
  isDark: boolean;
  colors: ColorTokens;
  typography: typeof typography;
  spacing: typeof spacing;
  radius: typeof radius;
  layout: typeof layout;
  elevation: (level: 0 | 1 | 2 | 3) => ReturnType<typeof elevation>;
}

const themes: Record<ColorScheme, Theme> = {
  light: buildTheme("light"),
  dark: buildTheme("dark"),
};

function buildTheme(scheme: ColorScheme): Theme {
  const isDark = scheme === "dark";
  return {
    scheme,
    isDark,
    colors: isDark ? darkColors : lightColors,
    typography,
    spacing,
    radius,
    layout,
    elevation: (level) => elevation(level, isDark),
  };
}

export function resolveScheme(preference: ThemePreference, system: string | null | undefined): ColorScheme {
  if (preference === "light" || preference === "dark") return preference;
  return system === "dark" ? "dark" : "light";
}

/** Aktif tema — tercih + sistem teması değişince tüm ekranlar yeniden çizilir */
export function useTheme(): Theme {
  const preference = useThemePreference((s) => s.preference);
  const system = useColorScheme();
  return themes[resolveScheme(preference, system)];
}

/** Test ve navigasyon teması için doğrudan erişim */
export function getTheme(scheme: ColorScheme): Theme {
  return themes[scheme];
}

/**
 * Temaya bağlı StyleSheet üretici. Bileşen dışında tanımlanır, bileşen içinde hook olarak çağrılır:
 *
 *   const useStyles = makeStyles((t) => ({ root: { backgroundColor: t.colors.surface } }));
 *   const styles = useStyles();
 */
export function makeStyles<T>(factory: (theme: Theme) => T): () => T {
  const cache = new WeakMap<Theme, T>();
  return function useStyles() {
    const theme = useTheme();
    return useMemo(() => {
      const hit = cache.get(theme);
      if (hit) return hit;
      const created = factory(theme);
      cache.set(theme, created);
      return created;
    }, [theme]);
  };
}
