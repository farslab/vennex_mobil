import React, { useEffect, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type Theme as NavTheme,
} from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AppIcon, AppLoading, useTheme, useThemePreference, type IconName } from "@/design-system";
import { useAuthStore, useSelectedCompany } from "@/store/authStore";
import { moduleVisible, showCardsModule, showStockModule } from "@/auth/permissions";
import { useAppConfig } from "@/hooks/useAppConfig";
import { VennexLogo } from "@/components/brand/VennexLogo";
import type { AuthStackParamList, RootStackParamList, TabParamList } from "./types";
import { TabHeader } from "./TabHeader";
import { centeredScreenLayout } from "./CenteredScreen";
import { linking } from "./linking";
import { flushPendingNavigation, navigationRef } from "./navigationRef";
import { startPush, stopPushListeners } from "@/push/pushService";

import LoginScreen from "@/screens/auth/LoginScreen";
import TwoFactorScreen from "@/screens/auth/TwoFactorScreen";
import OfflineScreen from "@/screens/auth/OfflineScreen";
import LegalConsentGateScreen from "@/screens/legal/LegalConsentGateScreen";
import LegalDocumentScreen from "@/screens/legal/LegalDocumentScreen";

import { screenRegistry } from "./screenRegistry";

const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const RootStack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const TAB_META: Record<keyof TabParamList, { title: string; icon: IconName }> = {
  Dashboard: { title: "Panel", icon: "grid" },
  Devices: { title: "Cihazlar", icon: "cpu" },
  Cards: { title: "Kartlar", icon: "credit-card" },
  Stock: { title: "Stok", icon: "package" },
  Profile: { title: "Profil", icon: "user" },
};

function AppTabs() {
  const theme = useTheme();
  const user = useAuthStore((s) => s.user);
  const company = useSelectedCompany();
  // Modül görünürlüğü sunucudan (web ile aynı kural); yoksa yerel yedek
  const { data: config } = useAppConfig();
  const cardsVisible = moduleVisible(config?.modules, "cards", () => showCardsModule(user, company));
  const stockVisible = moduleVisible(config?.modules, "stock", () => showStockModule(user, company));

  return (
    <Tab.Navigator
      screenLayout={centeredScreenLayout}
      screenOptions={({ route }) => ({
        header: () => <TabHeader title={TAB_META[route.name].title} />,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
        tabBarStyle: {
          backgroundColor: theme.colors.surface,
          borderTopColor: theme.colors.border,
          borderTopWidth: StyleSheet.hairlineWidth,
        },
        tabBarIcon: ({ color, focused }) => (
          <AppIcon name={TAB_META[route.name].icon} size={focused ? 22 : 21} color={color} />
        ),
        tabBarAccessibilityLabel: TAB_META[route.name].title,
        title: TAB_META[route.name].title,
        sceneStyle: { backgroundColor: theme.colors.background },
      })}
    >
      <Tab.Screen name="Dashboard" component={screenRegistry.Dashboard} />
      <Tab.Screen name="Devices" component={screenRegistry.Devices} />
      {cardsVisible ? <Tab.Screen name="Cards" component={screenRegistry.Cards} /> : null}
      {stockVisible ? <Tab.Screen name="Stock" component={screenRegistry.Stock} /> : null}
      <Tab.Screen name="Profile" component={screenRegistry.Profile} />
    </Tab.Navigator>
  );
}

function BootScreen() {
  const theme = useTheme();
  return (
    <View style={[styles.boot, { backgroundColor: theme.colors.background }]}>
      <VennexLogo height={40} />
      <AppLoading label="" />
    </View>
  );
}

export function RootNavigator() {
  const theme = useTheme();
  const status = useAuthStore((s) => s.status);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const hydrateTheme = useThemePreference((s) => s.hydrate);
  const pendingLegal = useAuthStore((s) => s.user?.pending_legal_docs?.length ?? 0);

  useEffect(() => {
    hydrateTheme();
    bootstrap();
  }, [bootstrap, hydrateTheme]);

  // Push: oturum açık ve yasal onaylar tamamken başlar; kullanıcı değişince yeniden kaydolur
  const userId = useAuthStore((s) => s.user?.id ?? null);
  const pushReady = status === "authenticated" && pendingLegal === 0;
  useEffect(() => {
    if (!pushReady) return;
    startPush(() => useAuthStore.getState().user);
    return () => stopPushListeners();
  }, [pushReady, userId]);

  const navTheme: NavTheme = useMemo(() => {
    const base = theme.isDark ? DarkTheme : DefaultTheme;
    return {
      ...base,
      dark: theme.isDark,
      colors: {
        ...base.colors,
        primary: theme.colors.primary,
        background: theme.colors.background,
        card: theme.colors.surface,
        text: theme.colors.text,
        border: theme.colors.border,
        notification: theme.colors.danger,
      },
    };
  }, [theme]);

  const stackOptions = useMemo(
    () => ({
      headerStyle: { backgroundColor: theme.colors.surface },
      headerTintColor: theme.colors.primary,
      headerTitleStyle: { color: theme.colors.text, fontWeight: "600" as const, fontSize: 17 },
      headerShadowVisible: false,
      headerBackButtonDisplayMode: "minimal" as const,
      contentStyle: { backgroundColor: theme.colors.background },
    }),
    [theme]
  );

  if (status === "booting") return <BootScreen />;
  // Kayıtlı oturum var, sunucuya ulaşılamadı: giriş ekranına atmadan bağlantı ekranı
  if (status === "offline") return <OfflineScreen />;

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={flushPendingNavigation}
      theme={navTheme}
      linking={linking}
    >
      {status === "authenticated" ? (
        pendingLegal > 0 ? (
          <LegalConsentGateScreen />
        ) : (
          <RootStack.Navigator screenOptions={stackOptions}>
            <RootStack.Screen name="Tabs" component={AppTabs} options={{ headerShown: false }} />
            <RootStack.Group screenLayout={centeredScreenLayout}>
              {screenRegistry.stack.map(({ name, component, title, headerShown }) => (
                <RootStack.Screen
                  key={name}
                  name={name}
                  component={component}
                  options={{ title, headerShown: headerShown ?? true }}
                />
              ))}
              <RootStack.Screen
                name="LegalDocument"
                component={LegalDocumentScreen}
                options={({ route }) => ({
                  title:
                    route.params.slug === "kvkk"
                      ? "KVKK Aydınlatma Metni"
                      : route.params.slug === "privacy"
                        ? "Gizlilik Politikası"
                        : "Kullanım Koşulları",
                })}
              />
            </RootStack.Group>
          </RootStack.Navigator>
        )
      ) : (
        <AuthStack.Navigator
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background } }}
        >
          {status === "requires_2fa" ? (
            <AuthStack.Screen name="TwoFactor" component={TwoFactorScreen} />
          ) : (
            <>
              <AuthStack.Screen name="Login" component={LoginScreen} />
            </>
          )}
        </AuthStack.Navigator>
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: "center", justifyContent: "center", gap: 8 },
});
