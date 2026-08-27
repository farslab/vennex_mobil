import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";

type ThemeMode = "light" | "dark";

interface ThemeState {
  mode: ThemeMode;
  toggleTheme: () => void;
  setTheme: (mode: ThemeMode) => void;
  loadTheme: () => Promise<void>;
}

export const useThemeStore = create<ThemeState>((set, get) => ({
  mode: "dark", // varsayılan tema
  toggleTheme: async () => {
    const nextMode = get().mode === "light" ? "dark" : "light";
    set({ mode: nextMode });
    await AsyncStorage.setItem("app_theme", nextMode);
  },
  setTheme: async (mode) => {
    set({ mode });
    await AsyncStorage.setItem("app_theme", mode);
  },
  loadTheme: async () => {
    const saved = await AsyncStorage.getItem("app_theme");
    if (saved === "light" || saved === "dark") {
      set({ mode: saved });
    }
  },
}));