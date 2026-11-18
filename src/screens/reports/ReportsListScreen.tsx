/**
 * Raporlar — kullanıcının son işleri (backend `reporting.py:50-62`, docs/API_CONTRACTS.md §2.10).
 * Polling yalnız bekleyen/çalışan iş varken ve ekran odaktayken, artan aralıkla (3→5→10→15 sn).
 */
import React, { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useIsFocused, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppButton,
  AppEmptyState,
  AppErrorState,
  AppListSkeleton,
  AppNotice,
  AppText,
  makeStyles,
  useTheme,
} from "@/design-system";
import { errorMessage } from "@/api/client";
import { reportsApi } from "@/api/reports";
import { queryKeys } from "@/api/queryKeys";
import { canViewSales } from "@/auth/permissions";
import { useAuthStore } from "@/store/authStore";
import { reportTypeLabel, type ReportJob } from "@/types/reports";
import type { RootStackParamList } from "@/navigation/types";
import { jobIsActive, useReportsPolling } from "./useReportsPolling";
import { useReportActions } from "./useReportActions";
import { ReportConfirmSheets, ReportJobCard } from "./components/ReportJobCard";

const FOCUS_REFRESH_AFTER_MS = 10_000;

export default function ReportsListScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const isFocused = useIsFocused();
  const user = useAuthStore((s) => s.user);
  const allowed = canViewSales(user);
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery({
    queryKey: queryKeys.reports.list(),
    queryFn: ({ signal }) => reportsApi.list(signal),
    enabled: allowed,
  });
  // Etiketler için (NewReport ile ortak cache); liste geldikten sonra
  const optionsQuery = useQuery({
    queryKey: queryKeys.reports.filterOptions(),
    queryFn: ({ signal }) => reportsApi.filterOptions(signal),
    staleTime: 10 * 60_000,
    enabled: allowed && !!query.data,
  });

  const jobs = query.data?.results ?? [];
  const hasActive = jobs.some(jobIsActive);
  const { refetch } = query;

  useReportsPolling({
    hasActive,
    isFocused,
    enabled: allowed,
    updatedAt: query.dataUpdatedAt + query.errorUpdatedAt,
    refetch,
  });

  useFocusEffect(
    useCallback(() => {
      if (query.dataUpdatedAt && Date.now() - query.dataUpdatedAt > FOCUS_REFRESH_AFTER_MS) refetch();
    }, [query.dataUpdatedAt, refetch])
  );

  const actions = useReportActions();
  const typeLabel = useCallback((t: string) => reportTypeLabel(t, optionsQuery.data?.report_types), [optionsQuery.data]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  }, [refetch]);

  if (!allowed) {
    return (
      <View style={styles.root}>
        <AppEmptyState
          icon="lock"
          title="Rapor yetkiniz yok"
          description="Raporlar satış görüntüleme yetkisi gerektirir. Yetki için şirket yöneticinizle görüşün."
        />
      </View>
    );
  }

  const header = (
    <View style={styles.header}>
      <AppButton
        title="Yeni rapor"
        icon="plus"
        onPress={() => navigation.navigate("NewReport")}
        fullWidth
        testID="new-report"
      />
      {query.data ? (
        <AppText variant="caption" color="textTertiary">
          {[
            query.data.user_report_limit != null ? `Son ${query.data.user_report_limit} rapor listelenir` : null,
            query.data.retention_hours != null ? `dosyalar ${query.data.retention_hours} saat saklanır` : null,
          ]
            .filter(Boolean)
            .join(" · ")}
        </AppText>
      ) : null}
      {hasActive ? (
        <AppNotice tone="info" message="Bir rapor hazırlanıyor. Aynı anda yalnızca bir rapor hazırlanabilir; durum otomatik güncellenir." />
      ) : null}
      {query.isError && query.data ? (
        <AppNotice tone="warning" message={`Liste güncellenemedi: ${errorMessage(query.error)}`} />
      ) : null}
    </View>
  );

  const empty = query.isLoading ? (
    <AppListSkeleton rows={4} />
  ) : query.isError ? (
    <AppErrorState message={errorMessage(query.error, "Raporlar yüklenemedi.")} onRetry={() => refetch()} compact />
  ) : (
    <AppEmptyState
      compact
      icon="file-text"
      title="Henüz rapor yok"
      description="Satış ve işlem verilerinizi Excel dosyası olarak dışa aktarın."
      actionLabel="Rapor oluştur"
      onAction={() => navigation.navigate("NewReport")}
    />
  );

  return (
    <View style={styles.root} testID="reports-screen">
      <FlatList<ReportJob>
        data={jobs}
        keyExtractor={(j) => String(j.id)}
        renderItem={({ item }) => (
          <ReportJobCard
            job={item}
            typeLabel={typeLabel(item.report_type)}
            actions={actions}
            anotherActive={hasActive}
            onPress={() => navigation.navigate("ReportDetail", { id: item.id })}
          />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        contentContainerStyle={styles.content}
        ItemSeparatorComponent={() => <View style={styles.sep} />}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} colors={[colors.primary]} />
        }
      />
      <ReportConfirmSheets actions={actions} typeLabel={typeLabel} />
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    content: { padding: t.layout.screenPadding, paddingBottom: t.spacing.huge, flexGrow: 1 },
    header: { gap: t.spacing.sm, marginBottom: t.spacing.lg },
    sep: { height: t.spacing.sm },
  })
);
