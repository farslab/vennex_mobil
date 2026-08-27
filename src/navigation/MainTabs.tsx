import React from "react";
import { Image } from "react-native";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { Ionicons } from "@expo/vector-icons";
import { useQuery } from "@tanstack/react-query";
import { HeaderRightActions } from "@/components/HeaderRightActions";
import DashboardScreen from "@/screens/dashboard/DashboardScreen";
import { DevicesStack } from "./DevicesStack";
import CardsListScreen from "@/screens/cards/CardsListScreen";
import StockOverviewScreen from "@/screens/stock/StockOverviewScreen";
import { ProfileStack } from "./ProfileStack";
import { notificationsApi } from "@/api/notifications";
import { useAppTheme } from "@/theme/colors";

export type MainTabParamList = {
  Dashboard: undefined;
  Devices: undefined;
  Cards: undefined;
  Stock: undefined;
  Profile: undefined;
};

const LogoHeader = () => (
  <Image
    source={require("../../assets/images/vennex-logo.png")}
    style={{ width: 110, height: 32, resizeMode: "contain" }}
  />
);

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  Dashboard: "home",
  Devices: "hardware-chip",
  Cards: "card",
  Stock: "cube",
  Profile: "person",
};

const TITLES: Record<keyof MainTabParamList, string> = {
  Dashboard: "Panel",
  Devices: "Cihazlar",
  Cards: "Kartlar",
  Stock: "Stok",
  Profile: "Profil",
};

export function MainTabs() {
  const { colors } = useAppTheme();

  const unreadQuery = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: notificationsApi.unreadCount,
    refetchInterval: 60_000, // 1 dakikada bir badge'i tazele
  });

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerRight: () => <HeaderRightActions />,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        headerTitle: () => <LogoHeader />,
        headerTitleAlign: "center",
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.border,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={ICONS[route.name as keyof MainTabParamList]} size={size} color={color} />
        ),
        tabBarBadge:
          route.name === "Profile" && unreadQuery.data && unreadQuery.data > 0 ? unreadQuery.data : undefined,
        title: TITLES[route.name as keyof MainTabParamList],
      })}
    >
      <Tab.Screen name="Dashboard" component={DashboardScreen} />
      <Tab.Screen name="Devices" component={DevicesStack} options={{ headerShown: false }} />
      <Tab.Screen name="Cards" component={CardsListScreen} />
      <Tab.Screen name="Stock" component={StockOverviewScreen} />
      <Tab.Screen name="Profile" component={ProfileStack} options={{ headerShown: false }} />
    </Tab.Navigator>
  );
}