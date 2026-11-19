import React, { useCallback, useEffect, useRef, useState } from "react";
import { AppState, StyleSheet, View } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { AppButton, AppNotice, AppText } from "@/design-system";
import { useAuthStore } from "@/store/authStore";
import { AuthLayout } from "./AuthLayout";

/**
 * Kayıtlı oturum var ama açılışta sunucuya ulaşılamadı. Oturum silinmez:
 * kullanıcı tekrar dener (ya da bağlantı geri gelince / uygulama öne alınınca otomatik denenir).
 * Otomatik deneme yalnız olay tetiklidir — sunucu kapalıyken periyodik istek yağdırmaz.
 */
export default function OfflineScreen() {
  const message = useAuthStore((s) => s.errorMessage);
  const bootstrap = useAuthStore((s) => s.bootstrap);
  const logout = useAuthStore((s) => s.logout);
  const [retrying, setRetrying] = useState(false);
  const busy = useRef(false);

  const retry = useCallback(async () => {
    if (busy.current) return;
    busy.current = true;
    setRetrying(true);
    try {
      await bootstrap();
    } finally {
      busy.current = false;
      setRetrying(false);
    }
  }, [bootstrap]);

  useEffect(() => {
    let wasConnected: boolean | null = null;
    const unsubNet = NetInfo.addEventListener((state) => {
      const connected = !!state.isConnected && state.isInternetReachable !== false;
      if (wasConnected === false && connected) retry();
      wasConnected = connected;
    });
    const appSub = AppState.addEventListener("change", (s) => {
      if (s === "active") retry();
    });
    return () => {
      unsubNet();
      appSub.remove();
    };
  }, [retry]);

  return (
    <AuthLayout
      title="Bağlantı kurulamadı"
      subtitle="Oturumunuz açık; sunucuya ulaşıldığında kaldığınız yerden devam edebilirsiniz."
    >
      <View style={styles.body} testID="offline-screen">
        <AppNotice
          tone="warning"
          message={message ?? "Sunucuya ulaşılamadı. İnternet bağlantınızı kontrol edin."}
        />
        <AppButton
          title="Tekrar dene"
          icon="refresh-cw"
          onPress={retry}
          loading={retrying}
          fullWidth
          testID="offline-retry"
        />
        <AppButton
          title="Çıkış yap"
          variant="ghost"
          onPress={logout}
          disabled={retrying}
          fullWidth
          testID="offline-logout"
        />
        <AppText variant="caption" color="textTertiary" align="center">
          Bağlantı geri geldiğinde otomatik olarak yeniden denenir.
        </AppText>
      </View>
    </AuthLayout>
  );
}

const styles = StyleSheet.create({ body: { gap: 12 } });
