/**
 * GEÇİŞ KÖPRÜSÜ — eski `useThemeStore` API'sini yeni tema tercihine yönlendirir.
 * @deprecated `useThemePreference` (design-system/theme) kullanın.
 */
import { useThemePreference } from "@/design-system/theme";

type Legacy = { mode: "light" | "dark"; toggleTheme: () => void; loadTheme: () => Promise<void> };

export function useThemeStore<T>(selector: (s: Legacy) => T): T {
  const preference = useThemePreference((s) => s.preference);
  const setPreference = useThemePreference((s) => s.setPreference);
  const hydrate = useThemePreference((s) => s.hydrate);
  const mode = preference === "dark" ? "dark" : "light";
  return selector({
    mode,
    toggleTheme: () => setPreference(mode === "dark" ? "light" : "dark"),
    loadTheme: hydrate,
  });
}
