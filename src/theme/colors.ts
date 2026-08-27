import { useThemeStore } from "@/store/themeStore";

export const palette = {
  light: {
    bg: "#F4F6F9",
    surface: "#FFFFFF",
    surfaceAlt: "#F1F5F9",
    card: "#FFFFFF",
    border: "#E2E8F0",
    textPrimary: "#0F172A",
    textSecondary: "#475569",
    textMuted: "#94A3B8",
    primary: "#2563EB",
    primaryMuted: "#EAF1FF",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
  },
  dark: {
    bg: "#060B14",          // Web arka planı (koyu derin navy)
    surface: "#0B1322",     // Kart arka planı
    surfaceAlt: "#0E182A",  // Input / Form elemanları arka planı
    card: "#0B1322",
    border: "#18263E",     // İnce kart ve input sınır çizgileri
    textPrimary: "#FFFFFF",
    textSecondary: "#8498B5",// SERİ NO, CİHAZ ADI vb. başlıklar
    textMuted: "#4B5E7A",
    primary: "#3B82F6",
    primaryMuted: "#13233F",
    success: "#10B981",
    warning: "#F59E0B",
    danger: "#EF4444",
  },
};

/** Aktif temayı anlık dinleyen dinamik hook */
export function useAppTheme() {
  const mode = useThemeStore((s) => s.mode);
  return {
    mode,
    colors: palette[mode],
    isDark: mode === "dark",
  };
}

// Geriye dönük uyumluluk (Common.tsx ve diğer dosyalar için)
export const colors = palette.dark;