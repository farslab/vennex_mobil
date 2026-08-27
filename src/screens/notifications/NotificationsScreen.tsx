import React from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { notificationsApi } from "@/api/notifications";
import { useAppTheme } from "@/theme/colors";
import { radius, spacing } from "@/theme/spacing";
import { EmptyState, ErrorView, LoadingView } from "@/components/Common";
import type { NotificationItem } from "@/types/notifications";

export default function NotificationsScreen() {
  const { colors, isDark } = useAppTheme();
  const queryClient = useQueryClient();

  const { data, isLoading, isRefetching, error, refetch } = useQuery({
    queryKey: ["notifications"],
    queryFn: () => notificationsApi.list({ page: 1 }),
  });

  const markReadMutation = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: notificationsApi.markAllRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
      queryClient.invalidateQueries({ queryKey: ["notifications-unread-count"] });
    },
  });

  if (isLoading) return <LoadingView label="Bildirimler yükleniyor..." />;
  if (error) return <ErrorView message={(error as Error).message} onRetry={refetch} />;

  const items = data?.results ?? [];
  const hasUnread = items.some((n) => n.unread);

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      {hasUnread && (
        <View style={styles.headerActionContainer}>
          <TouchableOpacity
            activeOpacity={0.7}
            style={[styles.markAllBtn, { backgroundColor: isDark ? colors.surfaceAlt : "#EBF2FF" }]}
            onPress={() => markAllReadMutation.mutate()}
            disabled={markAllReadMutation.isPending}
          >
            <Text style={[styles.markAllText, { color: colors.primary }]}>
              {markAllReadMutation.isPending ? "İşleniyor..." : "Tümünü okundu işaretle"}
            </Text>
          </TouchableOpacity>
        </View>
      )}

      <FlatList
        data={items}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={[styles.listContent, !hasUnread && { paddingTop: spacing.lg }]}
        ListEmptyComponent={<EmptyState label="Bildirim bulunamadı" />}
        refreshControl={
          <RefreshControl
            refreshing={isRefetching}
            onRefresh={refetch}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        renderItem={({ item }) => (
          <NotificationRow
            item={item}
            colors={colors}
            isDark={isDark}
            onPress={() => item.unread && markReadMutation.mutate(item.id)}
          />
        )}
      />
    </View>
  );
}

function NotificationRow({
  item,
  colors,
  isDark,
  onPress,
}: {
  item: NotificationItem;
  colors: any;
  isDark: boolean;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      activeOpacity={item.unread ? 0.7 : 1}
      style={[
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: item.unread ? colors.primary : colors.border,
        },
        item.unread && {
          backgroundColor: isDark ? colors.surfaceAlt : "#F0F6FF",
        },
      ]}
      onPress={onPress}
    >
      {item.unread && <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} />}

      <View style={styles.body}>
        <Text
          style={[
            styles.description,
            { color: colors.textPrimary, fontWeight: item.unread ? "600" : "400" },
          ]}
        >
          {item.description}
        </Text>
        <View style={styles.metaRow}>
          {item.actor_str ? (
            <Text style={[styles.meta, { color: colors.textMuted }]}>{item.actor_str}</Text>
          ) : null}
          <Text style={[styles.meta, { color: colors.textMuted }]}>
            {new Date(item.timestamp).toLocaleString("tr-TR", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  headerActionContainer: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    alignItems: "flex-end",
  },
  markAllBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: 999,
  },
  markAllText: {
    fontSize: 12,
    fontWeight: "600",
  },
  listContent: {
    padding: spacing.lg,
    gap: spacing.sm,
  },
  row: {
    flexDirection: "row",
    gap: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    alignItems: "flex-start",
  },
  body: {
    flex: 1,
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 6,
  },
  description: {
    fontSize: 14,
    lineHeight: 20,
  },
  metaRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  meta: {
    fontSize: 11,
  },
});