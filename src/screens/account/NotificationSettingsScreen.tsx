import React from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AppCard,
  AppDivider,
  AppErrorState,
  AppListSkeleton,
  AppNotice,
  AppScreen,
  AppSection,
  AppSwitchRow,
  AppText,
  makeStyles,
  toast,
} from "@/design-system";
import { authApi } from "@/api/auth";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { useAuthStore } from "@/store/authStore";
import { isOwner } from "@/auth/permissions";
import { formatDateTime } from "@/utils/date";
import type { NotificationPreferences } from "@/types/auth";

export type PreferenceKey = Exclude<keyof NotificationPreferences, "updated_at">;

interface PrefMeta {
  key: PreferenceKey;
  label: string;
  description: string;
  /** Backend push'u yalnız şirket sahibine gönderiyorsa (tasks.py) */
  ownerOnly?: boolean;
}

/** Push olayları ve alıcıları: backend `vennex_mobile/tasks.py` */
const GROUPS: { title: string; items: PrefMeta[] }[] = [
  {
    title: "POS Cihazları",
    items: [
      { key: "device_offline", label: "POS cihazı çevrimdışı", description: "Bir POS cihazı bağlantıyı kaybettiğinde" },
      { key: "stock_low", label: "Düşük stok", description: "Bir slotta ürün azaldığında" },
      {
        key: "transaction_alerts",
        label: "Yeni işlemler",
        description: "POS cihazlarınızda yeni satış gerçekleştiğinde",
        ownerOnly: true,
      },
    ],
  },
  {
    title: "Kartlar ve raporlar",
    items: [
      { key: "card_pending", label: "Onay bekleyen kart", description: "Yeni personel kartı onay beklediğinde" },
      { key: "report_ready", label: "Rapor hazır", description: "Talep ettiğiniz rapor oluşturulduğunda" },
    ],
  },
  {
    title: "Finans",
    items: [
      {
        key: "cari_overdue",
        label: "Vadesi geçen fatura",
        description: "Cari hesabınızda gecikmiş fatura oluştuğunda",
        ownerOnly: true,
      },
    ],
  },
];

/**
 * GET/PATCH me/notification-preferences/ — her anahtar anında kaydedilir (iyimser güncelleme).
 * Hata durumunda yalnız değiştirilen anahtar eski değerine döner; diğer bekleyen değişiklikler korunur.
 */
export default function NotificationSettingsScreen() {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const owner = isOwner(useAuthStore((s) => s.user));
  const key = queryKeys.notifications.preferences();

  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => authApi.getNotificationPreferences(signal),
  });

  const mutation = useMutation({
    mutationFn: ({ field, value }: { field: PreferenceKey; value: boolean }) =>
      authApi.updateNotificationPreferences({ [field]: value }),
    onMutate: async ({ field, value }) => {
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NotificationPreferences>(key)?.[field];
      queryClient.setQueryData<NotificationPreferences>(key, (old) => (old ? { ...old, [field]: value } : old));
      return { field, previous };
    },
    onError: (error, _vars, context) => {
      if (context && typeof context.previous === "boolean") {
        const { field, previous } = context;
        queryClient.setQueryData<NotificationPreferences>(key, (old) => (old ? { ...old, [field]: previous } : old));
      }
      toast.error(errorMessage(error, "Tercih kaydedilemedi."));
    },
    onSuccess: (server, { field }) => {
      // Yalnız bu anahtarı ve updated_at'i sunucudan al — eşzamanlı diğer iyimser değişiklikleri ezme
      queryClient.setQueryData<NotificationPreferences>(key, (old) =>
        old ? { ...old, [field]: server[field], updated_at: server.updated_at } : server
      );
    },
  });

  if (query.isLoading) return <AppListSkeleton rows={6} />;
  if (query.isError || !query.data) {
    return (
      <AppErrorState
        message={errorMessage(query.error, "Tercihler yüklenemedi.")}
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  const prefs = query.data;

  return (
    <AppScreen refreshing={query.isRefetching} onRefresh={() => query.refetch()} testID="notification-settings">
      <AppNotice
        tone="info"
        message="Tercihler hesabınıza kaydedilir ve oturum açtığınız tüm cihazlardaki anlık bildirimlere uygulanır."
      />
      {GROUPS.map((group) => {
        const items = group.items.filter((i) => owner || !i.ownerOnly);
        if (items.length === 0) return null;
        return (
          <AppSection key={group.title} title={group.title}>
            <AppCard padded={false}>
              {items.map((item, i) => (
                <View key={item.key}>
                  <View style={styles.row}>
                    <AppSwitchRow
                      label={item.label}
                      description={item.description}
                      value={!!prefs[item.key]}
                      onChange={(value) => mutation.mutate({ field: item.key, value })}
                      testID={`pref-${item.key}`}
                    />
                  </View>
                  {i < items.length - 1 ? <AppDivider /> : null}
                </View>
              ))}
            </AppCard>
          </AppSection>
        );
      })}
      {prefs.updated_at ? (
        <AppText variant="caption" color="textTertiary" align="center">
          Son güncelleme: {formatDateTime(prefs.updated_at)}
        </AppText>
      ) : null}
    </AppScreen>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    row: { paddingHorizontal: t.layout.cardPadding, paddingVertical: t.spacing.xs },
  })
);
