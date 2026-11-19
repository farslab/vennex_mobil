/**
 * Bildirim gelen kutusu — backend `views/notifications.py`, docs/API_CONTRACTS.md §2.11, §3.14.
 * Sayfalı (25), `unread=true` filtresi, tekil/toplu okundu işaretleme, event'e göre derin bağlantı.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useMutation, useQueryClient, type InfiniteData } from "@tanstack/react-query";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppButton,
  AppEmptyState,
  AppErrorState,
  AppIcon,
  AppListSkeleton,
  AppSegmented,
  AppText,
  makeStyles,
  toast,
  useTheme,
} from "@/design-system";
import { errorMessage } from "@/api/client";
import { notificationsApi } from "@/api/notifications";
import { queryKeys } from "@/api/queryKeys";
import { usePagedList } from "@/hooks/usePagedList";
import { useAuthStore } from "@/store/authStore";
import { formatRelative } from "@/utils/date";
import type { RootStackParamList } from "@/navigation/types";
import type { NotificationItem, NotificationsPage } from "@/types/notifications";
import type { AuthUser } from "@/types/auth";
import { notificationIcon, notificationSender, notificationWebLink, resolveNotificationTarget, type NotificationTarget } from "./notificationTarget";
import { API_BASE_URL } from "@/config/env";
import { NotificationSheet } from "./NotificationSheet";
import { ListLoadMoreFooter } from "@/components/ListLoadMoreFooter";

type Filter = "all" | "unread";

export default function NotificationsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const [filter, setFilter] = useState<Filter>("all");
  const unreadOnly = filter === "unread";

  const list = usePagedList<NotificationItem, NotificationsPage>({
    queryKey: queryKeys.notifications.list({ unread: unreadOnly }),
    fetchPage: (page, signal) => notificationsApi.list({ page, unreadOnly }, signal),
  });
  const unreadCount = list.firstPage?.unread_count ?? 0;

  const invalidate = useCallback(
    () => queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all }),
    [queryClient]
  );

  const markRead = useMutation({
    mutationFn: (id: number) => notificationsApi.markRead(id),
    onMutate: (id) => {
      // İyimser: satırı hemen okunmuş göster (hata olursa invalidate ile geri gelir)
      queryClient.setQueriesData<InfiniteData<NotificationsPage>>(
        { queryKey: [...queryKeys.notifications.all, "list"] },
        (old) =>
          old && {
            ...old,
            pages: old.pages.map((p) => ({
              ...p,
              results: p.results.map((n) => (n.id === id ? { ...n, unread: false } : n)),
            })),
          }
      );
    },
    onError: (e) => toast.error(errorMessage(e, "Bildirim okundu işaretlenemedi.")),
    onSettled: invalidate,
  });

  const markAll = useMutation({
    mutationFn: () => notificationsApi.markAllRead(),
    onSuccess: (res) => {
      toast.success(res.count > 0 ? `${res.count} bildirim okundu işaretlendi.` : "Tüm bildirimler okundu.");
    },
    onError: (e) => toast.error(errorMessage(e, "Bildirimler okundu işaretlenemedi.")),
    onSettled: invalidate,
  });

  const go = useCallback(
    (target: NotificationTarget) => {
      switch (target.name) {
        case "DeviceDetail":
          navigation.navigate("DeviceDetail", target.params);
          break;
        case "CardDetail":
          navigation.navigate("CardDetail", target.params);
          break;
        case "Reports":
          navigation.navigate("Reports");
          break;
        case "CompanyAccount":
          navigation.navigate("CompanyAccount");
          break;
      }
    },
    [navigation]
  );

  // Dokununca: okunmamışsa okundu işaretle, tam metni alttan açılan sayfada göster.
  // İlgili ekran (POS cihazı, kart, rapor, cari) sayfadaki düğmeyle açılır.
  const [opened, setOpened] = useState<NotificationItem | null>(null);
  // `useMutation` her render'da yeni nesne döner; yalnız kararlı `mutate`a bağlan ki satırlar memo'lu kalsın
  const { mutate: markReadMutate } = markRead;
  const onPressItem = useCallback(
    (item: NotificationItem) => {
      if (item.unread) markReadMutate(item.id);
      setOpened(item);
    },
    [markReadMutate]
  );
  // Push'a dokunularak gelindiyse (Nexus → Mobil Push) o bildirim açık gelir ve okundu işaretlenir
  const route = useRoute<RouteProp<RootStackParamList, "Notifications">>();
  const openParam = route.params?.open;
  const pushItem = useMemo<NotificationItem | null>(
    () =>
      openParam
        ? {
            id: openParam.id,
            timestamp: openParam.sentAt ? new Date(openParam.sentAt).toISOString() : null,
            verb: openParam.title,
            description: openParam.body,
            unread: false,
            actor_str: null,
            target_str: null,
            data: { sent_by_admin: true, ...(openParam.url ? { url: openParam.url } : {}) },
          }
        : null,
    [openParam]
  );
  const pushId = openParam?.id;
  useEffect(() => {
    if (pushId) markReadMutate(pushId);
  }, [pushId, markReadMutate]);
  const shown = opened ?? pushItem;
  const closeSheet = useCallback(() => {
    setOpened(null);
    if (openParam) navigation.setParams({ open: undefined });
  }, [navigation, openParam]);
  const openedTarget = useMemo(() => (shown ? resolveNotificationTarget(shown, user) : null), [shown, user]);
  const openedLink = useMemo(() => (shown ? notificationWebLink(shown, user, API_BASE_URL) : null), [shown, user]);
  const openTarget = useCallback(
    (target: NotificationTarget) => {
      closeSheet();
      go(target);
    },
    [go, closeSheet]
  );

  const pendingId = markRead.isPending ? markRead.variables : undefined;
  const renderItem = useCallback(
    ({ item }: { item: NotificationItem }) => (
      <NotificationRow item={item} user={user} pending={pendingId === item.id} onPress={onPressItem} />
    ),
    [user, pendingId, onPressItem]
  );

  const header = (
    <View style={styles.header}>
      <AppSegmented<Filter>
        items={[
          { key: "all", label: "Tümü" },
          { key: "unread", label: "Okunmamış", count: list.firstPage ? unreadCount : undefined },
        ]}
        value={filter}
        onChange={setFilter}
        testID="notification-filter"
      />
      {unreadCount > 0 ? (
        <View style={styles.headerRow}>
          <AppText variant="caption" color="textSecondary">
            {unreadCount} okunmamış bildirim
          </AppText>
          <AppButton
            title="Tümünü okundu işaretle"
            icon="check-circle"
            variant="ghost"
            size="sm"
            loading={markAll.isPending}
            onPress={() => markAll.mutate()}
            testID="mark-all-read"
          />
        </View>
      ) : null}
    </View>
  );

  const empty = list.isLoading ? (
    <AppListSkeleton rows={6} />
  ) : list.isError ? (
    <AppErrorState
      message={errorMessage(list.error, "Bildirimler yüklenemedi.")}
      onRetry={() => list.refetch()}
      compact
    />
  ) : (
    <AppEmptyState
      compact
      icon={unreadOnly ? "check-circle" : "bell"}
      title={unreadOnly ? "Okunmamış bildirim yok" : "Henüz bildirim yok"}
      description={
        unreadOnly
          ? "Tüm bildirimlerinizi okudunuz."
          : "POS cihazı, stok, kart ve rapor bildirimleri burada listelenir."
      }
    />
  );

  return (
    <View style={styles.root} testID="notifications-screen">
      <NotificationSheet item={shown} target={openedTarget} link={openedLink} onClose={closeSheet} onOpenTarget={openTarget} />
      <FlatList
        data={list.isError && list.items.length === 0 ? [] : list.items}
        keyExtractor={(item) => String(item.id)}
        renderItem={renderItem}
        extraData={pendingId}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ListFooterComponent={
          <ListLoadMoreFooter loading={list.isFetchingMore} error={list.loadMoreError} onRetry={list.retryLoadMore} />
        }
        onEndReached={list.loadMore}
        onEndReachedThreshold={0.4}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={list.isRefreshing}
            onRefresh={list.refresh}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
      />
    </View>
  );
}

const NotificationRow = React.memo(function NotificationRow({
  item,
  user,
  pending,
  onPress,
}: {
  item: NotificationItem;
  user: AuthUser | null | undefined;
  pending: boolean;
  onPress: (item: NotificationItem) => void;
}) {
  const styles = useStyles();
  // Hedef bir kez hesaplanır (önce uygulama içi ekran, yoksa web bağlantısı)
  const hasTarget = useMemo(
    () => !!resolveNotificationTarget(item, user) || !!notificationWebLink(item, user, API_BASE_URL),
    [item, user]
  );
  const title = item.description || item.verb || "Bildirim";
  const meta = [notificationSender(item), formatRelative(item.timestamp)].filter(Boolean).join(" · ");
  return (
    <Pressable
      onPress={() => onPress(item)}
      disabled={pending}
      accessibilityRole="button"
      accessibilityLabel={`${item.unread ? "Okunmamış. " : ""}${title}. ${meta}`}
      accessibilityHint="Bildirimin tamamını açar"
      style={({ pressed }) => [styles.row, item.unread && styles.rowUnread, pressed && styles.rowPressed]}
      testID={`notification-${item.id}`}
    >
      <View style={[styles.icon, item.unread && styles.iconUnread]}>
        <AppIcon name={notificationIcon(item)} size={16} color={item.unread ? "primary" : "textSecondary"} />
      </View>
      <View style={styles.body}>
        <AppText variant={item.unread ? "calloutStrong" : "callout"} numberOfLines={3}>
          {title}
        </AppText>
        {meta ? (
          <AppText variant="caption" color="textTertiary" numberOfLines={1}>
            {meta}
          </AppText>
        ) : null}
      </View>
      <View style={styles.trailing}>
        {item.unread ? <View style={styles.dot} accessibilityElementsHidden /> : null}
        {hasTarget ? <AppIcon name="chevron-right" size={16} color="textTertiary" /> : null}
      </View>
    </Pressable>
  );
});

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    content: { paddingBottom: t.spacing.huge, flexGrow: 1 },
    header: { padding: t.layout.screenPadding, paddingBottom: t.spacing.sm, gap: t.spacing.sm },
    headerRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: t.spacing.sm, minHeight: 36 },
    footer: { paddingVertical: t.spacing.lg },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.md,
      minHeight: 56,
      backgroundColor: t.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    rowUnread: { backgroundColor: t.colors.primarySubtle },
    rowPressed: { backgroundColor: t.colors.surfacePressed },
    icon: {
      width: 32,
      height: 32,
      borderRadius: t.radius.xs,
      backgroundColor: t.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    iconUnread: { backgroundColor: t.colors.surface },
    body: { flex: 1, gap: 2 },
    trailing: { flexDirection: "row", alignItems: "center", gap: t.spacing.xs, alignSelf: "center" },
    dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: t.colors.primary },
  })
);
