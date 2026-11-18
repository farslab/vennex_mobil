import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { QueryClientProvider } from "@tanstack/react-query";
import { bindQueryLifecycle, queryClient } from "@/store/queryClient";
import { RootNavigator } from "@/navigation/RootNavigator";
import { AppToastHost, useTheme } from "@/design-system";
import { VersionGate } from "@/updates/VersionGate";

function ThemedStatusBar() {
  const { isDark } = useTheme();
  return <StatusBar style={isDark ? "light" : "dark"} />;
}

export default function App() {
  useEffect(() => bindQueryLifecycle(), []);

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
