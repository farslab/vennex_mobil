import React from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import Markdown from "react-native-markdown-display";
import { legalApi } from "@/api/legal";
import { useAuthStore } from "@/store/authStore";
import { useAppTheme } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { Button, ErrorView, LoadingView } from "@/components/Common";
import { LEGAL_DEFAULT_TITLES, type LegalDocumentSlug } from "@/types/legal";
import { markdownStyles } from "./markdownStyles";

const KNOWN_SLUGS: LegalDocumentSlug[] = ["privacy", "kvkk", "terms"];

export default function LegalConsentGateScreen() {
  const { colors } = useAppTheme();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);

  const pending = (user?.pending_legal_docs ?? []).filter((s): s is LegalDocumentSlug =>
    KNOWN_SLUGS.includes(s as LegalDocumentSlug)
  );
  const currentSlug = pending[0];

  const docQuery = useQuery({
    queryKey: ["legal", currentSlug],
    queryFn: () => legalApi.getDocument(currentSlug!),
    enabled: !!currentSlug,
  });

  const acceptMutation = useMutation({
    mutationFn: () => legalApi.accept(currentSlug!, docQuery.data?.version ?? null),
    onSuccess: (updatedUser) => setUser(updatedUser),
  });

  if (!currentSlug) return <LoadingView label="Yönlendiriliyor..." />;
  if (docQuery.isLoading) return <LoadingView label="Belge yükleniyor..." />;
  if (docQuery.error) return <ErrorView message={(docQuery.error as Error).message} onRetry={docQuery.refetch} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <Text style={[styles.stepText, { color: colors.textMuted }]}>
          Onay {KNOWN_SLUGS.length - pending.length + 1}/{KNOWN_SLUGS.length}
        </Text>
        <Text style={[styles.title, { color: colors.textPrimary }]}>
          {docQuery.data?.title || LEGAL_DEFAULT_TITLES[currentSlug]}
        </Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Devam etmek için aşağıdaki metni onaylamanız gerekiyor.
        </Text>
      </View>

      <ScrollView
        style={[styles.body, { borderTopColor: colors.border }]}
        contentContainerStyle={{ padding: spacing.lg }}
      >
        <Markdown style={markdownStyles}>
          {docQuery.data?.content_md ?? ""}
        </Markdown>
      </ScrollView>

      <View style={[styles.footer, { borderTopColor: colors.border, backgroundColor: colors.surface }]}>
        <Button
          title="Kabul Ediyorum"
          onPress={() => acceptMutation.mutate()}
          loading={acceptMutation.isPending}
        />
        <View style={{ marginTop: spacing.sm }}>
          <Button title="Çıkış Yap" variant="secondary" onPress={logout} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: spacing.lg, paddingBottom: 0 },
  stepText: { fontSize: 12, fontWeight: "600" },
  title: { fontSize: 20, fontWeight: "700", marginTop: 4 },
  subtitle: { fontSize: 13, marginTop: 4 },
  body: { flex: 1, marginTop: spacing.md, borderTopWidth: 1 },
  footer: { padding: spacing.lg, borderTopWidth: 1 },
});