import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
import { ActivityIndicator, FlatList, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppEmptyState,
  AppErrorState,
  AppIconButton,
  AppListSkeleton,
  AppScreen,
  AppSearchField,
  AppText,
  makeStyles,
  useTheme,
} from "@/design-system";
import { usersApi } from "@/api/users";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { usePagedList } from "@/hooks/usePagedList";
import { useAuthStore } from "@/store/authStore";
import { canManageUsers } from "@/auth/permissions";
import { normalizeForSearch } from "@/utils/text";
import type { RootStackParamList } from "@/navigation/types";
import type { StaffUser } from "@/types/users";
import { UserRow } from "./components/UserRow";

/**
 * Teknisyen kullanıcıları (owner). GET users/ sayfalı (25), sunucuda arama parametresi YOK →
 * arama yalnız yüklenmiş sayfalarda istemci tarafında yapılır ve bu kullanıcıya belirtilir.
 */
export default function UsersScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const allowed = canManageUsers(useAuthStore((s) => s.user));
  const [search, setSearch] = useState("");

  const list = usePagedList<StaffUser>({
    queryKey: queryKeys.users.list(),
    fetchPage: (page, signal) => usersApi.list(page, signal),
    enabled: allowed,
  });

  const openCreate = useCallback(() => navigation.navigate("UserForm", {}), [navigation]);

  useLayoutEffect(() => {
    if (!allowed) return;
    navigation.setOptions({
      headerRight: () => <AppIconButton icon="user-plus" label="Yeni teknisyen" onPress={openCreate} tone="primary" />,
    });
  }, [navigation, allowed, openCreate]);

  const query = normalizeForSearch(search);
  const filtered = useMemo(() => {
    if (!query) return list.items;
    return list.items.filter((u) =>
      normalizeForSearch(`${u.first_name} ${u.last_name} ${u.username} ${u.email} ${u.group_names.join(" ")}`).includes(
        query
      )
    );
  }, [list.items, query]);

  if (!allowed) {
    return (
      <AppScreen>
        <AppEmptyState
          icon="lock"
          title="Erişiminiz yok"
          description="Kullanıcı yönetimi yalnızca hesap sahiplerine açıktır."
        />
      </AppScreen>
    );
  }

  const header = (
    <View style={styles.header}>
      <AppSearchField
        value={search}
        onChangeText={setSearch}
        placeholder="Ad, kullanıcı adı veya grup ara"
        testID="users-search"
      />
      <AppText variant="caption" color="textTertiary">
        {query
          ? `${filtered.length} sonuç · arama yüklenen ${list.items.length}/${list.total} kullanıcıda yapılır`
          : `${list.total} teknisyen`}
      </AppText>
    </View>
  );

  return (
    <AppScreen scroll={false} testID="users-screen">
      {list.isLoading ? (
        <>
          {header}
          <AppListSkeleton rows={6} />
        </>
      ) : list.isError ? (
        <AppErrorState
          message={errorMessage(list.error, "Kullanıcılar yüklenemedi.")}
          onRetry={() => list.refetch()}
          retrying={list.isRefreshing}
        />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <UserRow user={item} onPress={(u) => navigation.navigate("UserForm", { userId: u.id })} />
          )}
          ListHeaderComponent={header}
          ListEmptyComponent={
            query ? (
              <AppEmptyState
                compact
                icon="search"
                title="Sonuç bulunamadı"
                description={list.hasMore ? "Daha fazla kullanıcı yüklemek için listeyi kaydırın." : undefined}
              />
            ) : (
              <AppEmptyState
                compact
                icon="users"
                title="Henüz teknisyen yok"
                description="Cihazlarınızı yönetecek teknisyen hesapları oluşturun."
                actionLabel="Teknisyen ekle"
                onAction={openCreate}
              />
            )
          }
          ListFooterComponent={
            list.isFetchingMore ? (
              <ActivityIndicator style={styles.footer} color={colors.primary} accessibilityLabel="Daha fazla yükleniyor" />
            ) : null
          }
          onEndReached={list.loadMore}
          onEndReachedThreshold={0.4}
          refreshing={list.isRefreshing}
          onRefresh={list.refresh}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          testID="users-list"
        />
      )}
    </AppScreen>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    header: {
      paddingHorizontal: t.layout.screenPadding,
      paddingTop: t.spacing.md,
      paddingBottom: t.spacing.sm,
      gap: t.spacing.sm,
      backgroundColor: t.colors.background,
    },
    footer: { paddingVertical: t.spacing.lg },
  })
);
