import React, { useMemo } from "react";
import { Linking, ScrollView, StyleSheet, Text, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import type { RouteProp } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import Markdown from "react-native-markdown-display";
import { legalApi } from "@/api/legal";
import { useAppTheme } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { Button, ErrorView, LoadingView } from "@/components/Common";
import { LEGAL_DEFAULT_TITLES } from "@/types/legal";
import type { ProfileStackParamList } from "@/navigation/ProfileStack";

export default function LegalDocumentScreen() {
  const { colors, isDark } = useAppTheme();
  const route = useRoute<RouteProp<ProfileStackParamList, "LegalDocument">>();
  const { slug } = route.params;

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["legal", slug],
    queryFn: () => legalApi.getDocument(slug),
  });

  // Markdown metin renklerini ve başlıklarını temaya dinamik bağlama
  const dynamicMarkdownStyles = useMemo(() => {
    return {
      body: { color: colors.textPrimary, fontSize: 14, lineHeight: 22 },
      heading1: { color: colors.textPrimary, fontWeight: "700" as const, marginTop: 16, marginBottom: 8 },
      heading2: { color: colors.textPrimary, fontWeight: "700" as const, marginTop: 14, marginBottom: 6 },
      paragraph: { color: colors.textSecondary, marginTop: 6, marginBottom: 6 },
      bullet_list: { color: colors.textSecondary },
      code_inline: { backgroundColor: isDark ? colors.surfaceAlt : "#F1F5F9", color: colors.primary },
    };
  }, [colors, isDark]);

  if (isLoading) return <LoadingView label="Belge yükleniyor..." />;
  if (error) return <ErrorView message={(error as Error).message} onRetry={refetch} />;
  if (!data) return null;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={{ padding: spacing.lg }}
    >
      <Text style={[styles.title, { color: colors.textPrimary }]}>
        {data.title || LEGAL_DEFAULT_TITLES[slug]}
      </Text>
      {data.updated_at && (
        <Text style={[styles.mutedText, { color: colors.textMuted }]}>
          Güncelleme: {data.updated_at}
        </Text>
      )}

      <View style={{ marginTop: spacing.lg }}>
        <Markdown style={dynamicMarkdownStyles}>{data.content_md}</Markdown>
      </View>

      {data.web_url && (
        <View style={{ marginTop: spacing.xl }}>
          <Button
            title="Web'de Aç"
            variant="secondary"
            onPress={() => Linking.openURL(data.web_url!)}
          />
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  title: { fontSize: 20, fontWeight: "700" },
  mutedText: { fontSize: 12, marginTop: 4 },
});