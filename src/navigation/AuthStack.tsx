import React from "react";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import LoginScreen from "@/screens/auth/LoginScreen";
import TwoFactorScreen from "@/screens/auth/TwoFactorScreen";
import { useAuthStore } from "@/store/authStore";

export type AuthStackParamList = {
  Login: undefined;
  TwoFactor: undefined;
};

const Stack = createNativeStackNavigator<AuthStackParamList>();

export function AuthStack() {
  const status = useAuthStore((s) => s.status);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {status === "requires_2fa" ? (
        <Stack.Screen name="TwoFactor" component={TwoFactorScreen} />
      ) : (
        <Stack.Screen name="Login" component={LoginScreen} />
      )}
    </Stack.Navigator>
  );
}
