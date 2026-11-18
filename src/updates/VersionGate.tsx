import React, { useEffect } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  appConfigApi,
  clientPlatform,
  evaluateVersionPolicy,
  nativeAppVersion,
} from "@/api/appConfig";
import { queryKeys } from "@/api/queryKeys";
import { AppButton, AppIcon, AppText, makeStyles, toast } from "@/design-system";
import { VennexLogo } from "@/components/brand/VennexLogo";
import { applyOtaUpdate, startOtaWatcher, useOtaStore } from "./otaUpdater";

/**
 * Sürüm kapısı:
 *  1) Mağaza sürümü sunucudaki minimumun altındaysa ve politika zorunluysa uygulama
 *     kullanılamaz; mağaza bağlantısı gösterilir (admin → Mobil Sürüm Politikaları).
 *  2) Daha yeni mağaza sürümü varsa bir kez bilgi verilir.
 *  3) OTA (JS) güncellemesi indirildiyse "Yeniden başlat" bandı gösterilir.
 * Politika sunucuya ulaşılamazsa uygulama ENGELLENMEZ (çevrimdışı kullanım).
 */
export function VersionGate({ children }: { children: React.ReactNode }) {
  const platform = clientPlatform();
  const version = nativeAppVersion();

  const policy = useQuery({
    queryKey: queryKeys.versionPolicy(),
    queryFn: ({ signal }) => appConfigApi.versionPolicy(signal),
    staleTime: 30 * 60_000,
    refetchInterval: 6 * 60 * 60_000,
    retry: 1,
  });

  const verdict = evaluateVersionPolicy(policy.data, platform, version);

  useEffect(() => startOtaWatcher(), []);

  useEffect(() => {
    if (verdict.available && !verdict.required) toast.info("Uygulamanın yeni bir sürümü mağazada.");
  }, [verdict.available, verdict.required]);

  if (verdict.required) {
    return <UpdateRequiredScreen storeUrl={verdict.storeUrl} message={verdict.message} version={version} />;
  }
  return (
    <>
      {children}
      <OtaReadyBanner />
    </>
  );
}

export function UpdateRequiredScreen({
  storeUrl,
  message,
  version,
}: {
  storeUrl: string;
  message: string;
  version: string;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.root, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]} testID="update-required">
      <VennexLogo height={36} />
      <View style={styles.body}>
        <View style={styles.iconWrap}>
          <AppIcon name="download-cloud" size={26} color="primary" />
        </View>
        <AppText variant="title" accessibilityRole="header">
          Güncelleme gerekli
        </AppText>
        <AppText variant="body" color="textSecondary">
          {message ||
            "Uygulamanın bu sürümü artık desteklenmiyor. Devam etmek için lütfen mağazadan en son sürüme güncelleyin."}
        </AppText>
        <AppText variant="caption" color="textTertiary">
          Yüklü sürüm: {version}
        </AppText>
      </View>
      <AppButton
        title="Mağazada güncelle"
        icon="external-link"
        fullWidth
        disabled={!storeUrl}
        onPress={() => Linking.openURL(storeUrl)}
      />
    </View>
  );
}

function OtaReadyBanner() {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const phase = useOtaStore((s) => s.phase);
  if (phase !== "ready") return null;
  return (
    <View style={[styles.banner, { bottom: insets.bottom + 72 }]} accessibilityRole="alert">
      <AppIcon name="refresh-cw" size={16} color="primary" />
      <AppText variant="calloutStrong" style={styles.flex}>
        Yeni sürüm hazır
      </AppText>
      <AppButton title="Yeniden başlat" size="sm" onPress={applyOtaUpdate} />
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: t.colors.background,
      paddingHorizontal: t.spacing.xxl,
      gap: t.spacing.xxl,
    },
    body: { flex: 1, justifyContent: "center", gap: t.spacing.md },
    iconWrap: {
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: t.colors.primarySubtle,
      alignItems: "center",
      justifyContent: "center",
    },
    banner: {
      position: "absolute",
      left: t.layout.screenPadding,
      right: t.layout.screenPadding,
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.sm,
      padding: t.spacing.md,
      borderRadius: t.radius.md,
      backgroundColor: t.colors.surface,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.colors.border,
      ...t.elevation(3),
    },
    flex: { flex: 1 },
  })
);
