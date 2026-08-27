import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { HeaderRightActions } from "@/components/HeaderRightActions";
import { LogoHeader } from "@/components/LogoHeader";
import { useAppTheme } from "@/theme/colors";
import DevicesListScreen from "@/screens/devices/DevicesListScreen";
import DeviceDetailScreen from "@/screens/devices/DeviceDetailScreen";
import ProductTemplatesScreen from "@/screens/devices/ProductTemplatesScreen";
import TemplateProductsEditScreen from "@/screens/devices/TemplateProductsEditScreen";

export type DevicesStackParamList = {
  DevicesList: undefined;
  DeviceDetail: { sn: string; name: string };
  ProductTemplates: undefined;
  TemplateProductsEdit: { templateId: number; title?: string };
};

const Stack = createNativeStackNavigator<DevicesStackParamList>();

export function DevicesStack() {
  const { colors } = useAppTheme();

  return (
    <Stack.Navigator
      initialRouteName="DevicesList"
      screenOptions={{
        headerRight: () => <HeaderRightActions />,
        headerTitle: () => <LogoHeader />,
        headerTitleAlign: "center",
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.textPrimary,
        headerShadowVisible: false,
      }}
    >
      <Stack.Screen
        name="DevicesList"
        component={DevicesListScreen}
        options={{
          headerTitle: () => <LogoHeader />,
        }}
      />
      <Stack.Screen
        name="DeviceDetail"
        component={DeviceDetailScreen}
        options={({ route }) => ({
          title: route.params.name,
          headerTitle: undefined,
        })}
      />
      <Stack.Screen
        name="ProductTemplates"
        component={ProductTemplatesScreen}
        options={{
          headerTitle: () => <LogoHeader />,
        }}
      />
      <Stack.Screen
        name="TemplateProductsEdit"
        component={TemplateProductsEditScreen}
        options={{
          headerShown: false,
        }}
      />
    </Stack.Navigator>
  );
}