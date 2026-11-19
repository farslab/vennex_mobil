import React, { useEffect } from "react";
import { useFonts } from "expo-font";
import { FONT_ASSETS, markFontsLoaded } from "@/design-system/tokens/fonts";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { bindQueryLifecycle, queryClient } from "@/store/queryClient";
import { RootNavigator } from "@/navigation/RootNavigator";
import { AppToastHost, useTheme } from "@/design-system";
import { VersionGate } from "@/updates/VersionGate";
import { Platform } from "react-native";
import { PUSH_ENABLED } from "@/config/env";
import { getMessaging, setBackgroundMessageHandler } from "@react-native-firebase/messaging";

// Arka planda gelen bildirimler: görünür bildirimi işletim sistemi gösterir; veri tazelemesi
// uygulama ön plana gelince React Query ile yapılır. İşleyici yine de kayıtlı olmalı (RNFB uyarısı).
if (PUSH_ENABLED && (Platform.OS === "ios" || Platform.OS === "android")) {
  try {
    setBackgroundMessageHandler(getMessaging(), async () => {});
  } catch {
    // Firebase yapılandırması olmayan ortamda (test/web) sessizce geç
  }
}

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

export default function App() {
  useEffect(() => bindQueryLifecycle(), []);
  // Yazı tipi (Plus Jakarta Sans): yüklenene kadar açılış ekranı; hata olursa sistem yazı tipiyle devam
  const [fontsLoaded, fontError] = useFonts(FONT_ASSETS);
  if (!fontsLoaded && !fontError) return null;
  markFontsLoaded(fontsLoaded);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <QueryClientProvider client={queryClient}>
          <ThemedStatusBar />
          <VersionGate>
            <RootNavigator />
          </VersionGate>
          <AppToastHost />
        </QueryClientProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
