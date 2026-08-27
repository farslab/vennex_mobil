import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons, Feather } from "@expo/vector-icons";
import { notificationsApi } from "@/api/notifications";
import { useThemeStore } from "@/store/themeStore";
import { palette } from "@/theme/colors";

export function HeaderRightActions() {
  const navigation = useNavigation<any>();
  const mode = useThemeStore((s) => s.mode);
  const toggleTheme = useThemeStore((s) => s.toggleTheme);
  const themeColors = palette[mode];

  const { data: unreadCount } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: notificationsApi.unreadCount,
  });

  const count = typeof unreadCount === "number" ? unreadCount : 0;

  return (
    <View style={styles.container}>
      {/* 1. Güneş / Ay Tema Değiştirme Butonu */}
      <Pressable 
        style={styles.iconButton} 
        onPress={toggleTheme} 
        hitSlop={10}
      >
        {mode === "dark" ? (
          <Feather name="sun" size={20} color={themeColors.textPrimary} />
        ) : (
          <Ionicons name="moon-outline" size={20} color={themeColors.textPrimary} />
        )}
      </Pressable>

      {/* 2. Zil Bildirim Butonu */}
      <Pressable
        style={styles.iconButton}
        onPress={() => navigation.navigate("Notifications")}
        hitSlop={10}
      >
        <Ionicons name="notifications-outline" size={22} color={themeColors.textPrimary} />
        {count > 0 && (
          <View style={[styles.badge, { backgroundColor: themeColors.danger }]}>
            <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
          </View>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginRight: 8,
  },
  iconButton: {
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    top: -3,
    right: -4,
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "#FFFFFF",
    fontSize: 10,
    fontWeight: "700",
  },
});