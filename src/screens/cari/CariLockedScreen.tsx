/**
 * Cari hesabı kilitli şirket (durum 4) — web `dashboard/middleware.py` ile aynı: şirkete bağlı tüm ekranlar kapalı.
 *  - Sahip: web'de ödeme sayfasına yönlendirilir → burada borç tutarı, faturalar ve web ödeme sayfası.
 *  - Teknisyen: web `cari_account_locked.html` ("Hesap Kısıtlanmıştır", yöneticinizle iletişime geçin).
 * Kilit kalkınca (ödeme sonrası) ekran kendiliğinden kapanır: yapılandırma dakikada bir yenilenir.
 */
import React, { useEffect } from "react";
import { StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppButton, AppCard, AppIcon, AppScreen, AppText, makeStyles } from "@/design-system";
import { useAuthStore } from "@/store/authStore";
import { formatCurrency } from "@/utils/number";
import type { RootStackParamList } from "@/navigation/types";
import { CARI_LOCKED_MESSAGE, openCariPayment, useCari } from "./useCari";

const RECHECK_MS = 60_000;

export function CariLockedScreen() {
  const styles = useStyles();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const logout = useAuthStore((s) => s.logout);
  const cari = useCari();
  const { refetch } = cari;

  useEffect(() => {
    const id = setInterval(refetch, RECHECK_MS);
    return () => clearInterval(id);
  }, [refetch]);

  return (
    <AppScreen scroll refreshing={cari.refreshing} onRefresh={refetch} testID="cari-locked">
      <AppCard>
        <View style={styles.center}>
          <View style={styles.icon}>
            <AppIcon name="lock" size={28} color="danger" />
          </View>
          <AppText variant="title" style={styles.centerText} accessibilityRole="header">
            {cari.nonTech ? "Hesabınız Kilitlendi" : "Hesap Kısıtlanmıştır"}
          </AppText>
          <AppText variant="body" color="textSecondary" style={styles.centerText}>
            {cari.nonTech
              ? `${CARI_LOCKED_MESSAGE} Ödeme yapıldığında erişim kendiliğinden açılır.`
              : "Bu konuda yardım almak için lütfen yöneticinizle iletişime geçin."}
          </AppText>
          {cari.nonTech && cari.balance != null && cari.balance > 0 ? (
            <AppText variant="title" color="danger" testID="cari-locked-balance">
              {formatCurrency(cari.balance)}
            </AppText>
          ) : null}
        </View>
      </AppCard>

      <View style={styles.actions}>
        <AppButton
          title={cari.nonTech ? "Ödeme Yap (web)" : "Cari Ödeme Yap"}
          icon="external-link"
          onPress={() => openCariPayment(cari.paymentPath)}
          fullWidth
          testID="cari-locked-pay"
        />
        {cari.owner ? (
          <AppButton
            title="Faturaları gör"
            icon="file-text"
            variant="outline"
            onPress={() => navigation.navigate("CompanyAccount")}
            fullWidth
            testID="cari-locked-invoices"
          />
        ) : null}
        <AppButton title="Durumu yenile" icon="refresh-cw" variant="ghost" onPress={refetch} fullWidth testID="cari-locked-refresh" />
        <AppButton title="Çıkış yap" icon="log-out" variant="dangerOutline" onPress={() => logout().catch(() => {})} fullWidth testID="cari-locked-logout" />
      </View>
      <AppText variant="caption" color="textTertiary" style={styles.centerText}>
        Ödeme web panelinde yapılır; ödeme sayfası tarayıcıda açılır ve web hesabınızla giriş ister.
      </AppText>
    </AppScreen>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    center: { alignItems: "center", gap: t.spacing.sm, paddingVertical: t.spacing.md },
    centerText: { textAlign: "center" },
    icon: {
      width: 56,
      height: 56,
      borderRadius: 28,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.dangerSubtle,
    },
    actions: { gap: t.spacing.sm, marginTop: t.spacing.md },
  })
);
