import React from "react";
import { Pressable, ScrollView, StyleSheet, Switch, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Ionicons } from "@expo/vector-icons";
import { authApi } from "@/api/auth";
import { notificationsApi } from "@/api/notifications";
import { useAuthStore } from "@/store/authStore";
import { useAppTheme } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { Button, ErrorView, LoadingView, ScreenCard } from "@/components/Common";
import type { NotificationPreferences } from "@/types/auth";
import { LEGAL_DEFAULT_TITLES } from "@/types/legal";
import type { ProfileStackParamList } from "@/navigation/ProfileStack";

const PREF_LABELS: Record<keyof Omit<NotificationPreferences, "updated_at">, string> = {
  device_offline: "Cihaz çevrimdışı olduğunda",
  transaction_alerts: "İşlem özetleri",
  stock_low: "Düşük stok uyarısı",
  card_pending: "Yeni kart onay bekliyor",
  report_ready: "Rapor hazır olduğunda",
  cari_overdue: "Vadesi geçen borç uyarısı",
};

/** Rol etiket metinleri ve renk tanımları */
function formatRole(role: string | undefined) {
  if (!role) return { label: "—", tone: "muted" as const };
  if (role.toLowerCase() === "owner" || role.toLowerCase() === "sahip") {
    return { label: "Sahip", tone: "primary" as const };
  }
  return { label: role, tone: "muted" as const };
}

export default function ProfileScreen() {
  const { colors, isDark } = useAppTheme();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const queryClient = useQueryClient();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();

  const unreadQuery = useQuery({
    queryKey: ["notifications-unread-count"],
    queryFn: notificationsApi.unreadCount,
  });

  const prefsQuery = useQuery({
    queryKey: ["notification-preferences"],
    queryFn: authApi.getNotificationPreferences,
  });

  const updatePrefs = useMutation({
    mutationFn: (patch: Partial<NotificationPreferences>) => authApi.updateNotificationPreferences(patch),
    onSuccess: (data) => {
      queryClient.setQueryData(["notification-preferences"], data);
    },
  });

  const roleInfo = formatRole(user?.role);

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
    >
      {/* Hesap Bilgileri Kartı */}
      <ScreenCard style={{ padding: 0, overflow: "hidden" }}>
        <Text
          style={[
            styles.accountCardTitle,
            { color: colors.textPrimary, borderBottomColor: colors.border },
          ]}
        >
          Hesap Bilgileri
        </Text>

        <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Ad Soyad</Text>
          <Text style={[styles.infoValue, { color: colors.textPrimary }]}>
            {user?.first_name || user?.last_name ? `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim() : "—"}
          </Text>
        </View>

        <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Kullanıcı Adı</Text>
          <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{user?.username ?? "—"}</Text>
        </View>

        <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.textMuted }]}>E-posta</Text>
          <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{user?.email ?? "—"}</Text>
        </View>

        <View style={[styles.infoRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Telefon</Text>
          <Text style={[styles.infoValue, { color: colors.textPrimary }]}>{(user as any)?.phone || "—"}</Text>
        </View>

        <View style={[styles.infoRow, { borderBottomWidth: 0 }]}>
          <Text style={[styles.infoLabel, { color: colors.textMuted }]}>Rol</Text>
          <View
            style={[
              styles.rolePill,
              { backgroundColor: isDark ? "#1E3A8A" : "#EAF1FF" },
            ]}
          >
            <Text
              style={[
                styles.rolePillText,
                { color: isDark ? "#93C5FD" : "#2757C6" },
              ]}
            >
              {roleInfo.label}
            </Text>
          </View>
        </View>
      </ScreenCard>

      {/* Bildirim Tercihleri */}
      <ScreenCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Bildirim Tercihleri</Text>
        {prefsQuery.isLoading ? (
          <LoadingView label="Yükleniyor..." />
        ) : prefsQuery.error ? (
          <ErrorView message={(prefsQuery.error as Error).message} onRetry={prefsQuery.refetch} />
        ) : (
          <View style={{ gap: spacing.md, marginTop: spacing.md }}>
            {(Object.keys(PREF_LABELS) as Array<keyof typeof PREF_LABELS>).map((key) => (
              <View key={key} style={styles.rowBetween}>
                <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{PREF_LABELS[key]}</Text>
                <Switch
                  value={Boolean(prefsQuery.data?.[key])}
                  onValueChange={(val) => updatePrefs.mutate({ [key]: val })}
                  trackColor={{ true: colors.primary, false: colors.border }}
                  thumbColor={isDark ? "#FFFFFF" : "#F4F6F9"}
                />
              </View>
            ))}
          </View>
        )}
      </ScreenCard>

      {/* Menü Seçenekleri */}
      <ScreenCard style={{ padding: 0, overflow: "hidden" }}>
        <MenuRow
          icon="notifications-outline"
          label="Bildirimler"
          badge={unreadQuery.data && unreadQuery.data > 0 ? unreadQuery.data : undefined}
          colors={colors}
          onPress={() => navigation.navigate("Notifications")}
        />
        <MenuRow
          icon="document-text-outline"
          label="Raporlar"
          colors={colors}
          onPress={() => navigation.navigate("Reports")}
        />
        {user?.role === "owner" && (
          <MenuRow
            icon="people-outline"
            label="Kullanıcı Yönetimi"
            colors={colors}
            onPress={() => navigation.navigate("Users")}
          />
        )}
        <MenuRow
          icon="shield-checkmark-outline"
          label={LEGAL_DEFAULT_TITLES.kvkk}
          colors={colors}
          onPress={() => navigation.navigate("LegalDocument", { slug: "kvkk" })}
        />
        <MenuRow
          icon="lock-closed-outline"
          label={LEGAL_DEFAULT_TITLES.privacy}
          colors={colors}
          onPress={() => navigation.navigate("LegalDocument", { slug: "privacy" })}
        />
        <MenuRow
          icon="reader-outline"
          label={LEGAL_DEFAULT_TITLES.terms}
          colors={colors}
          last
          onPress={() => navigation.navigate("LegalDocument", { slug: "terms" })}
        />
      </ScreenCard>

      <Button title="Çıkış Yap" variant="danger" onPress={logout} />
    </ScrollView>
  );
}

function MenuRow({
  icon,
  label,
  badge,
  last,
  colors,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  badge?: number;
  last?: boolean;
  colors: any;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.menuRow,
        !last && [styles.menuRowBorder, { borderBottomColor: colors.border }],
      ]}
      onPress={onPress}
    >
      <Ionicons name={icon} size={20} color={colors.textSecondary} />
      <Text style={[styles.menuLabel, { color: colors.textPrimary }]}>{label}</Text>
      {badge ? (
        <View style={[styles.badgePill, { backgroundColor: colors.danger }]}>
          <Text style={styles.badgePillText}>{badge}</Text>
        </View>
      ) : null}
      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* Hesap Bilgileri Tablo Kartı Stilleri */
  accountCardTitle: {
    fontWeight: "700",
    fontSize: 16,
    padding: spacing.md,
    borderBottomWidth: 1,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  infoLabel: { fontSize: 13, flex: 1 },
  infoValue: { fontSize: 13, fontWeight: "600", textAlign: "right" },

  rolePill: {
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: "600",
  },

  /* Bildirim Tercihleri ve Diğer Bileşen Stilleri */
  cardTitle: { fontWeight: "700", fontSize: 15 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { fontSize: 14, flex: 1, marginRight: spacing.md },
  menuRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  menuRowBorder: { borderBottomWidth: 1 },
  menuLabel: { flex: 1, fontSize: 14 },
  badgePill: {
    borderRadius: 999,
    minWidth: 20,
    height: 20,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  badgePillText: { color: "#fff", fontSize: 11, fontWeight: "700" },
});