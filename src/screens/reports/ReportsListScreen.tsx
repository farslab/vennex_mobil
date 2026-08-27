import React from "react";
import { Alert, FlatList, Share, StyleSheet, Text, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { reportsApi } from "@/api/reports";
import { useAppTheme } from "@/theme/colors";
import { spacing } from "@/theme/spacing";
import { Badge, Button, EmptyState, ErrorView, LoadingView, ScreenCard } from "@/components/Common";
import { REPORT_TYPE_LABELS, normalizeReportStatus, type ReportJob } from "@/types/reports";
import { jobIsActive, useReportsPolling } from "./useReportsPolling";
import type { ProfileStackParamList } from "@/navigation/ProfileStack";

const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "muted"> = {
  completed: "success",
  failed: "danger",
  running: "warning",
  pending: "muted",
  cancelled: "muted",
};

const STATUS_LABEL: Record<string, string> = {
  completed: "Tamamlandı",
  failed: "Başarısız",
  running: "Çalışıyor",
  pending: "Beklemede",
  cancelled: "İptal Edildi",
};

export default function ReportsListScreen() {
  const { colors } = useAppTheme();
  const navigation = useNavigation<NativeStackNavigationProp<ProfileStackParamList>>();
  const queryClient = useQueryClient();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["reports"],
    queryFn: reportsApi.list,
  });

  const hasActiveJobs = (data?.results ?? []).some((j) => jobIsActive(j.status));
  useReportsPolling(hasActiveJobs);

  const downloadMutation = useMutation({
    mutationFn: (job: ReportJob) => reportsApi.download(job.id, job.custom_name || `rapor-${job.id}`),
    onSuccess: (uri) => {
      Share.share({ url: uri, message: "Rapor dosyası indirildi" }).catch(() => {});
    },
    onError: (e) => Alert.alert("Hata", (e as Error).message),
  });

  const cancelMutation = useMutation({
    mutationFn: (id: number) => reportsApi.cancel(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reports"] }),
  });

  const retryMutation = useMutation({
    mutationFn: (id: number) => reportsApi.retry(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["reports"] }),
  });

  if (isLoading) return <LoadingView label="Raporlar yükleniyor..." />;
  if (error) return <ErrorView message={(error as Error).message} onRetry={refetch} />;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={{ padding: spacing.lg, paddingBottom: 0 }}>
        <Button title="+ Yeni Rapor" onPress={() => navigation.navigate("NewReport")} />
        {data && (
          <Text style={[styles.limitText, { color: colors.textMuted }]}>
            {data.results.length}/{data.user_report_limit} rapor · {data.retention_hours} saat saklanır
          </Text>
        )}
      </View>

      <FlatList
        data={data?.results ?? []}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ padding: spacing.lg, gap: spacing.sm }}
        ListEmptyComponent={<EmptyState label="Henüz rapor oluşturulmadı" />}
        renderItem={({ item }) => {
          const status = normalizeReportStatus(item.status);
          return (
            <ScreenCard>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: colors.textPrimary }]}>
                    {item.custom_name || REPORT_TYPE_LABELS[item.report_type]}
                  </Text>
                  <Text style={[styles.mutedText, { color: colors.textMuted }]}>
                    {new Date(item.created_at).toLocaleString("tr-TR")}
                  </Text>
                </View>
                <Badge label={STATUS_LABEL[status]} tone={STATUS_TONE[status]} />
              </View>

              {status === "running" && (
                <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                  <View style={[styles.progressFill, { width: `${item.progress_pct}%`, backgroundColor: colors.primary }]} />
                </View>
              )}

              {status === "failed" && item.error_message && (
                <Text style={[styles.errorText, { color: colors.danger }]}>{item.error_message}</Text>
              )}

              <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
                {status === "completed" && item.is_downloadable && (
                  <View style={{ flex: 1 }}>
                    <Button
                      title="İndir"
                      onPress={() => downloadMutation.mutate(item)}
                      loading={downloadMutation.isPending && downloadMutation.variables?.id === item.id}
                    />
                  </View>
                )}
                {jobIsActive(item.status) && (
                  <View style={{ flex: 1 }}>
                    <Button title="İptal Et" variant="secondary" onPress={() => cancelMutation.mutate(item.id)} />
                  </View>
                )}
                {status === "failed" && (
                  <View style={{ flex: 1 }}>
                    <Button title="Tekrar Dene" variant="secondary" onPress={() => retryMutation.mutate(item.id)} />
                  </View>
                )}
              </View>
            </ScreenCard>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  limitText: { fontSize: 12, marginTop: spacing.sm },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  title: { fontWeight: "600", fontSize: 15 },
  mutedText: { fontSize: 12, marginTop: 2 },
  errorText: { fontSize: 12, marginTop: spacing.sm },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: spacing.md,
    overflow: "hidden",
  },
  progressFill: { height: "100%" },
});