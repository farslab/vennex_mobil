import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HeaderRightActions } from "@/components/HeaderRightActions";
import { LogoHeader } from "@/components/LogoHeader";
import ProfileScreen from "@/screens/profile/ProfileScreen";
import ReportsListScreen from "@/screens/reports/ReportsListScreen";
import NewReportScreen from "@/screens/reports/NewReportScreen";
import NotificationsScreen from "@/screens/notifications/NotificationsScreen";
import LegalDocumentScreen from "@/screens/legal/LegalDocumentScreen";
import UsersListScreen from "@/screens/users/UsersListScreen";
import { useAppTheme } from "@/theme/colors";
import type { LegalDocumentSlug } from "@/types/legal";

export type ProfileStackParamList = {
  ProfileHome: undefined;
  Reports: undefined;
  NewReport: undefined;
  Notifications: undefined;
  LegalDocument: { slug: LegalDocumentSlug };
  Users: undefined;
};

const Stack = createNativeStackNavigator<ProfileStackParamList>();

export function ProfileStack() {
  const { colors } = useAppTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerRight: () => <HeaderRightActions />,
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
        headerTitleAlign: "center",
      }}
    >
      {/* 1. Sadece Ana Profil Sayfasında LOGO */}
      <Stack.Screen
        name="ProfileHome"
        component={ProfileScreen}
        options={{
          headerTitle: () => <LogoHeader />,
        }}
      />

      {/* 2. Alt Sayfalar */}
      <Stack.Screen 
        name="Reports" 
        component={ReportsListScreen} 
        options={{ title: "Raporlar" }} 
      />
      
      <Stack.Screen 
        name="NewReport" 
        component={NewReportScreen} 
        options={{ title: "Yeni Rapor" }} 
      />

      {/* Bildirimler sayfasının kendi içinde sağ üstteki zili gizliyoruz */}
      <Stack.Screen 
        name="Notifications" 
        component={NotificationsScreen} 
        options={{ 
          title: "Bildirimler",
          headerRight: () => null,
        }} 
      />

      <Stack.Screen 
        name="Users" 
        component={UsersListScreen} 
        options={{ title: "Kullanıcı Yönetimi" }} 
      />

      <Stack.Screen
        name="LegalDocument"
        component={LegalDocumentScreen}
        options={({ route }) => ({
          title:
            route.params.slug === "kvkk"
              ? "KVKK Aydınlatma Metni"
              : route.params.slug === "privacy"
              ? "Gizlilik Sözleşmesi"
              : "Kullanım Koşulları",
        })}
      />
    </Stack.Navigator>
  );
}