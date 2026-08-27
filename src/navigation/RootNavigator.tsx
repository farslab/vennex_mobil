import React, { useEffect } from "react";
import { NavigationContainer, DarkTheme, DefaultTheme } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { useAuthStore } from "@/store/authStore";
import { useThemeStore } from "@/store/themeStore";
import { palette } from "@/theme/colors";
import { AuthStack } from "./AuthStack";
import { MainTabs } from "./MainTabs";
import NotificationsScreen from "@/screens/notifications/NotificationsScreen";
import LegalConsentGateScreen from "@/screens/legal/LegalConsentGateScreen";
import { LoadingView } from "@/components/Common";

const Stack = createNativeStackNavigator();

export function RootNavigator() {
  const status = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const pendingLegalDocs = useAuthStore((s) => s.user?.pending_legal_docs ?? []);

  const mode = useThemeStore((s) => s.mode);
  const loadTheme = useThemeStore((s) => s.loadTheme);

  useEffect(() => {
    bootstrap();
    loadTheme();
  }, [bootstrap, loadTheme]);

  if (status === "booting") {
    return <LoadingView label="Vennex Mobile başlatılıyor..." />;
  }

  const showLegalGate = status === "authenticated" && pendingLegalDocs.length > 0;
  const themeColors = palette[mode];
  const baseTheme = mode === "dark" ? DarkTheme : DefaultTheme;

  const navTheme = {
    ...baseTheme,
    dark: mode === "dark",
    colors: {
      ...baseTheme.colors,
      background: themeColors.bg,
      card: themeColors.surface,
      border: themeColors.border,
      primary: themeColors.primary,
      text: themeColors.textPrimary,
      notification: themeColors.danger,
    },
  };

  return (
    <NavigationContainer theme={navTheme}>
      {status === "authenticated" ? (
        showLegalGate ? (
          <LegalConsentGateScreen />
        ) : (
          <Stack.Navigator>
            {/* Ana Sekmeler (Panel, Cihazlar, Profil vs.) */}
            <Stack.Screen
              name="MainApp"
              component={MainTabs}
              options={{ headerShown: false }}
            />
            {/* Global Bildirimler Ekranı */}
            <Stack.Screen
              name="Notifications"
              component={NotificationsScreen}
              options={{
                title: "Bildirimler",
                headerBackTitle: "Geri",
                headerStyle: { backgroundColor: themeColors.surface },
                headerTintColor: themeColors.textPrimary,
                headerShadowVisible: false,
              }}
            />
          </Stack.Navigator>
        )
      ) : (
        <AuthStack />
      )}
    </NavigationContainer>
  );
}