/**
 * Rapor ayrıntısı — `GET /reports/{id}/` (backend `reporting.py:143-148`).
 * Aktif iş için artan aralıkla polling; "Tekrar dene" YENİ job döndürür → ekran yeni id'ye geçer.
 */
import React, { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useIsFocused, useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppEmptyState, AppErrorState, AppListSkeleton, AppScreen, makeStyles } from "@/design-system";
import { errorMessage } from "@/api/client";
import { reportsApi } from "@/api/reports";
import { queryKeys } from "@/api/queryKeys";
import { canViewSales } from "@/auth/permissions";
import { useAuthStore } from "@/store/authStore";
import { reportTypeLabel } from "@/types/reports";
import type { RootStackParamList } from "@/navigation/types";
import { jobIsActive, useReportsPolling } from "./useReportsPolling";
import { useReportActions } from "./useReportActions";
import { ReportConfirmSheets, ReportJobCard } from "./components/ReportJobCard";

export default function ReportDetailScreen() {
  const styles = useStyles();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList, "ReportDetail">>();
  const route = useRoute<RouteProp<RootStackParamList, "ReportDetail">>();
  const id = Number(route.params?.id);
  const isFocused = useIsFocused();
  const allowed = canViewSales(useAuthStore((s) => s.user));
  const valid = Number.isInteger(id) && id > 0;

  const query = useQuery({
    queryKey: queryKeys.reports.detail(id),
    queryFn: ({ signal }) => reportsApi.detail(id, signal),
    enabled: allowed && valid,
  });
  const optionsQuery = useQuery({
    queryKey: queryKeys.reports.filterOptions(),
    queryFn: ({ signal }) => reportsApi.filterOptions(signal),
    staleTime: 10 * 60_000,
    enabled: allowed && !!query.data,
  });

  const job = query.data;
  useReportsPolling({
    hasActive: !!job && jobIsActive(job),
    isFocused,
    enabled: allowed && valid,
    updatedAt: query.dataUpdatedAt + query.errorUpdatedAt,
    refetch: query.refetch,
  });

  const actions = useReportActions({
    onRetried: (newJob) => navigation.setParams({ id: newJob.id }),
    onDeleted: () => navigation.goBack(),
  });
  const typeLabel = useCallback((t: string) => reportTypeLabel(t, optionsQuery.data?.report_types), [optionsQuery.data]);

  if (!allowed) {
    return <AppEmptyState icon="lock" title="Rapor yetkiniz yok" description="Raporlar satış görüntüleme yetkisi gerektirir." />;
  }
  if (!valid) return <AppEmptyState icon="file" title="Rapor bulunamadı" />;

  return (
    <AppScreen onRefresh={() => query.refetch()} refreshing={query.isRefetching && !jobIsActive(job ?? { status: "", is_active: false })}>
      {query.isLoading ? (
        <AppListSkeleton rows={2} />
      ) : !job ? (
        <AppErrorState message={errorMessage(query.error, "Rapor yüklenemedi.")} onRetry={() => query.refetch()} compact />
      ) : (
        <View style={styles.stack}>
          <ReportJobCard job={job} typeLabel={typeLabel(job.report_type)} actions={actions} anotherActive={false} detailed />
        </View>
      )}
      <ReportConfirmSheets actions={actions} typeLabel={typeLabel} />
    </AppScreen>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    stack: { gap: t.spacing.md },
  })
);
