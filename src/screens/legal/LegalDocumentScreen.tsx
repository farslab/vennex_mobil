import React from "react";
import { Linking, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useRoute, type RouteProp } from "@react-navigation/native";
import Markdown from "react-native-markdown-display";
import {
  AppButton,
  AppDivider,
  AppErrorState,
  AppLoading,
  AppScreen,
  AppText,
  makeStyles,
  toast,
} from "@/design-system";
import { legalApi } from "@/api/legal";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { formatDate } from "@/utils/date";
import { legalTitle, type LegalDocument } from "@/types/legal";
import type { RootStackParamList } from "@/navigation/types";
import { useMarkdownStyles } from "./markdownStyles";

export function legalMeta(doc: Pick<LegalDocument, "version" | "updated_at">): string | null {
  const parts = [
    doc.version != null ? `Sürüm ${doc.version}` : null,
    doc.updated_at ? `Güncelleme ${formatDate(doc.updated_at)}` : null,
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** Yasal belge görüntüleme (rota "LegalDocument" { slug }) — başlık navigator'dan gelir */
export default function LegalDocumentScreen() {
  const styles = useStyles();
  const markdownStyles = useMarkdownStyles();
  const route = useRoute<RouteProp<RootStackParamList, "LegalDocument">>();
  const { slug } = route.params;

  const query = useQuery({
    queryKey: queryKeys.legal.document(slug),
    queryFn: ({ signal }) => legalApi.getDocument(slug, signal),
    staleTime: 10 * 60_000,
  });

  if (query.isLoading) return <AppLoading label="Belge yükleniyor…" />;
  if (query.isError || !query.data) {
    return (
      <AppErrorState
        message={errorMessage(query.error, "Belge yüklenemedi.")}
        onRetry={() => query.refetch()}
        retrying={query.isFetching}
      />
    );
  }
  const doc = query.data;
  const meta = legalMeta(doc);

  const openWeb = async () => {
    if (!doc.web_url) return;
    try {
      await Linking.openURL(doc.web_url);
    } catch {
      toast.error("Bağlantı açılamadı.");
    }
  };

  return (
    <AppScreen refreshing={query.isRefetching} onRefresh={() => query.refetch()} testID="legal-document">
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header">
          {legalTitle(slug, doc.title)}
        </AppText>
        {meta ? (
          <AppText variant="caption" color="textTertiary">
            {meta}
          </AppText>
        ) : null}
      </View>
      <AppDivider />
      <View>
        {doc.content_md.trim() ? (
          <Markdown style={markdownStyles}>{doc.content_md}</Markdown>
        ) : (
          <AppText variant="callout" color="textSecondary">
            Belge içeriği bulunmuyor.
          </AppText>
        )}
      </View>
      {doc.web_url ? (
        <AppButton title="Web'de aç" icon="external-link" variant="outline" onPress={openWeb} />
      ) : null}
    </AppScreen>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    head: { gap: t.spacing.xs },
  })
);
