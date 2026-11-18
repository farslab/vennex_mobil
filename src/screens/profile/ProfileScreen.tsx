import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import Constants from "expo-constants";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppCard,
  AppConfirmSheet,
  AppDivider,
  AppListRow,
  AppScreen,
  AppSection,
  AppText,
  makeStyles,
} from "@/design-system";
import { useAuthStore, useSelectedCompany } from "@/store/authStore";
import { canManageUsers, isOwner } from "@/auth/permissions";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";
import { APP_ENV } from "@/config/env";
import { LEGAL_DEFAULT_TITLES, LEGAL_SLUGS } from "@/types/legal";
import type { RootStackParamList } from "@/navigation/types";
import { IdentityCard } from "./components/IdentityCard";
import { ThemePreferenceControl } from "./components/ThemePreferenceControl";

const ENV_LABELS: Record<string, string> = {
  development: "Geliştirme ortamı",
  staging: "Test ortamı",
  production: "Canlı",
};

const LEGAL_ICONS = { kvkk: "shield", privacy: "lock", terms: "file-text" } as const;

/** Profil sekmesi — başlık TabHeader'dan gelir (şirket seçici dahil) */
export default function ProfileScreen() {
  const styles = useStyles();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const company = useSelectedCompany();
  const unread = useUnreadNotificationCount();
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const owner = isOwner(user);
  const version = Constants.expoConfig?.version;

  const doLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
      setConfirmLogout(false);
    }
  };

  return (
    <AppScreen testID="profile-screen">
      {user ? <IdentityCard user={user} company={company} /> : null}

      <AppSection title="Hesap">
        <AppCard padded={false}>
          <AppListRow
            icon="user"
            title="Profili düzenle"
            subtitle="Ad, e-posta ve telefon"
            onPress={() => navigation.navigate("EditProfile")}
            testID="row-edit-profile"
          />
          <AppListRow
            icon="lock"
            title="Güvenlik"
            subtitle="Şifre, iki adımlı doğrulama, hesap"
            onPress={() => navigation.navigate("Security")}
            testID="row-security"
          />
          <AppListRow
            icon="sliders"
            title="Bildirim tercihleri"
            onPress={() => navigation.navigate("NotificationSettings")}
            last
            testID="row-notification-settings"
          />
        </AppCard>
      </AppSection>

      {owner ? (
        <AppSection title="Şirket">
          <AppCard padded={false}>
            <AppListRow
              icon="briefcase"
              title="Şirket bilgileri ve cari"
              subtitle={company?.name ?? "Seçili şirket yok"}
              onPress={() => navigation.navigate("CompanyAccount")}
              last
              testID="row-company-account"
            />
          </AppCard>
        </AppSection>
      ) : null}

      <AppSection title="Yönetim">
        <AppCard padded={false}>
          {canManageUsers(user) ? (
            <AppListRow
              icon="users"
              title="Kullanıcılar"
              subtitle="Teknisyen hesapları ve yetkileri"
              onPress={() => navigation.navigate("Users")}
              testID="row-users"
            />
          ) : null}
          <AppListRow icon="bar-chart-2" title="Raporlar" onPress={() => navigation.navigate("Reports")} testID="row-reports" />
          <AppListRow
            icon="bell"
            title="Bildirimler"
            value={unread > 0 ? `${unread > 99 ? "99+" : unread} okunmamış` : undefined}
            onPress={() => navigation.navigate("Notifications")}
            last
            testID="row-notifications"
          />
        </AppCard>
      </AppSection>

      <AppSection title="Görünüm">
        <AppCard>
          <ThemePreferenceControl />
        </AppCard>
      </AppSection>

      <AppSection title="Yasal">
        <AppCard padded={false}>
          {LEGAL_SLUGS.map((slug, i) => (
            <AppListRow
              key={slug}
              icon={LEGAL_ICONS[slug]}
              title={LEGAL_DEFAULT_TITLES[slug]}
              onPress={() => navigation.navigate("LegalDocument", { slug })}
              last={i === LEGAL_SLUGS.length - 1}
              testID={`row-legal-${slug}`}
            />
          ))}
        </AppCard>
      </AppSection>

      <View style={styles.footer}>
        <AppCard padded={false}>
          <AppListRow
            icon="log-out"
            title="Çıkış yap"
            destructive
            chevron={false}
            onPress={() => setConfirmLogout(true)}
            last
            testID="row-logout"
          />
        </AppCard>
        <AppDivider />
        <AppText variant="caption" color="textTertiary" align="center" testID="app-version">
          Vennex Mobile {version ? `· Sürüm ${version}` : ""}
          {APP_ENV !== "production" ? ` · ${ENV_LABELS[APP_ENV] ?? APP_ENV}` : ""}
        </AppText>
      </View>

      <AppConfirmSheet
        visible={confirmLogout}
        title="Oturumu kapat"
        message="Bu cihazdaki oturumunuz kapatılacak ve önbellekteki veriler temizlenecek."
        summary={user ? [{ label: "Kullanıcı", value: user.username }] : undefined}
        confirmLabel="Çıkış yap"
        destructive
        loading={loggingOut}
        onConfirm={doLogout}
        onCancel={() => setConfirmLogout(false)}
      />
    </AppScreen>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    footer: { gap: t.spacing.lg },
  })
);
