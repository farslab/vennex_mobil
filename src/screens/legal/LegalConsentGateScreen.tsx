import React, { useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useMutation, useQuery } from "@tanstack/react-query";
import Markdown from "react-native-markdown-display";
import {
  AppButton,
  AppErrorState,
  AppLoading,
  AppNotice,
  AppText,
  makeStyles,
} from "@/design-system";
import { legalApi } from "@/api/legal";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { useAuthStore } from "@/store/authStore";
import { legalTitle } from "@/types/legal";
import { legalMeta } from "./LegalDocumentScreen";
import { useMarkdownStyles } from "./markdownStyles";

/**
 * Zorunlu yasal onay kapısı — navigator, `pending_legal_docs` boş olmadıkça yalnız bu ekranı gösterir
 * (stack dışında, kendi safe area'sını uygular). Her onay sonrası backend güncel AuthUser döner;
 * `setUser` ile bekleyen liste kısalır ve son belge onaylanınca uygulama açılır.
 */
export default function LegalConsentGateScreen() {
  const styles = useStyles();
  const markdownStyles = useMarkdownStyles();
  const insets = useSafeAreaInsets();
  const pending = useAuthStore((s) => s.user?.pending_legal_docs ?? []);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const [loggingOut, setLoggingOut] = useState(false);

  // Adım sayacı: oturumdaki ilk bekleyen belge sayısı sabit tutulur (liste onaylandıkça kısalır)
  const [initialTotal] = useState(pending.length);
  const total = Math.max(initialTotal, pending.length);
  const step = Math.min(total, total - pending.length + 1);
  const slug = pending[0];

  const docQuery = useQuery({
    queryKey: queryKeys.legal.document(slug ?? ""),
    queryFn: ({ signal }) => legalApi.getDocument(slug as string, signal),
    enabled: !!slug,
  });

  const accept = useMutation({
    mutationFn: () => legalApi.accept(slug as string, docQuery.data?.version ?? null),
    onSuccess: (updated) => setUser(updated),
  });

  const doLogout = async () => {
    setLoggingOut(true);
    try {
      await logout();
    } finally {
      setLoggingOut(false);
    }
  };

  const logoutButton = (
    <AppButton
      title="Çıkış yap"
      variant="ghost"
      onPress={doLogout}
      loading={loggingOut}
      disabled={accept.isPending}
      testID="legal-gate-logout"
    />
  );

  if (!slug) return <AppLoading label="Yönlendiriliyor…" />;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]} testID="legal-gate">
      <View style={styles.header}>
        <View style={styles.progress} accessibilityRole="progressbar" accessibilityLabel={`Onay adımı ${step} / ${total}`}>
          {Array.from({ length: total }).map((_, i) => (
            <View key={i} style={[styles.segment, i < step && styles.segmentDone]} />
          ))}
        </View>
        <AppText variant="overline" color="textTertiary">
          Yasal onay · Adım {step}/{total}
        </AppText>
        <AppText variant="title" accessibilityRole="header">
          {legalTitle(slug, docQuery.data?.title)}
        </AppText>
        <AppText variant="callout" color="textSecondary">
          Uygulamayı kullanmaya devam etmek için aşağıdaki metni okuyup onaylamanız gerekiyor.
        </AppText>
      </View>

      <View style={styles.body}>
        {docQuery.isLoading ? (
          <AppLoading label="Belge yükleniyor…" />
        ) : docQuery.isError || !docQuery.data ? (
          <AppErrorState
            message={errorMessage(docQuery.error, "Belge yüklenemedi.")}
            onRetry={() => docQuery.refetch()}
            retrying={docQuery.isFetching}
          />
        ) : (
          <ScrollView contentContainerStyle={styles.scroll} testID="legal-gate-content">
            {legalMeta(docQuery.data) ? (
              <AppText variant="caption" color="textTertiary" style={styles.meta}>
                {legalMeta(docQuery.data)}
              </AppText>
            ) : null}
            <Markdown style={markdownStyles}>{docQuery.data.content_md}</Markdown>
          </ScrollView>
        )}
      </View>

      <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        {accept.isError ? (
          <AppNotice tone="danger" title="Onay kaydedilemedi" message={errorMessage(accept.error)} />
        ) : null}
        <AppButton
          title={step < total ? "Kabul ediyorum, devam et" : "Kabul ediyorum"}
          onPress={() => accept.mutate()}
          loading={accept.isPending}
          disabled={!docQuery.data || loggingOut}
          fullWidth
          testID="legal-gate-accept"
        />
        {logoutButton}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    header: {
      paddingHorizontal: t.layout.screenPadding,
      paddingTop: t.spacing.lg,
      paddingBottom: t.spacing.md,
      gap: t.spacing.xs,
    },
    progress: { flexDirection: "row", gap: t.spacing.xs, marginBottom: t.spacing.sm },
    segment: { flex: 1, height: 4, borderRadius: 2, backgroundColor: t.colors.border },
    segmentDone: { backgroundColor: t.colors.primary },
    body: {
      flex: 1,
      marginHorizontal: t.layout.screenPadding,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.md,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.colors.border,
      overflow: "hidden",
    },
    scroll: { padding: t.layout.cardPadding },
    meta: { marginBottom: t.spacing.sm },
    footer: {
      paddingHorizontal: t.layout.screenPadding,
      paddingTop: t.spacing.md,
      gap: t.spacing.sm,
    },
  })
);
