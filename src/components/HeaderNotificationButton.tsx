import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import { useQuery } from "@tanstack/react-query";
import { Ionicons } from "@expo/vector-icons";
import { notificationsApi } from "@/api/notifications";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

export function HeaderNotificationButton() {
  const navigation = useNavigation<any>();

  const { data: unreadCount } = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: notificationsApi.unreadCount,
  });

  const count = typeof unreadCount === "number" ? unreadCount : 0;

  return (
    <Pressable
      style={styles.container}
      onPress={() => navigation.navigate("Notifications")}
      hitSlop={10}
    >
      <Ionicons name="notifications-outline" size={24} color={colors.textPrimary} />
      {count > 0 && (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{count > 99 ? "99+" : count}</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: spacing.sm,
    justifyContent: "center",
    alignItems: "center",
  },
  badge: {
    position: "absolute",
    top: -2,
    right: 4,
    backgroundColor: colors.danger,
    borderRadius: 999,
    minWidth: 16,
    height: 16,
    paddingHorizontal: 4,
    justifyContent: "center",
    alignItems: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
});