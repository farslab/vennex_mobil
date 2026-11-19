/**
 * Panel (sekme kökü) — başlığı TabHeader verir, ekran kendi başlığını çizmez.
 * Veri: yalnız `GET /overview/dashboard/` bundle'ı (docs/API_CONTRACTS.md §2.4, §3.8).
 * Satış yetkisi yoksa (istemci `view_sales` veya backend `sales_visible=false`) hiçbir tutar gösterilmez.
 */
import React, { useCallback, useLayoutEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppErrorState,
  AppIconButton,
  AppNotice,
  AppScreen,
  AppText,
  makeStyles,
  toast,
  useTheme,
} from "@/design-system";
import { errorMessage } from "@/api/client";
import { overviewApi } from "@/api/overview";
import { queryKeys } from "@/api/queryKeys";
import { canViewSales } from "@/auth/permissions";
import { useAuthStore } from "@/store/authStore";
import { formatTime } from "@/utils/date";
import type { RootStackParamList } from "@/navigation/types";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { FailureReasonsCard, PaymentBreakdownCard } from "@/components/dashboard/BreakdownCards";
import { TechnicalErrorsCard, TopDevicesCard } from "@/components/dashboard/DeviceRankCards";
import { RecentTransactionsCard } from "@/components/dashboard/RecentTransactionsCard";
import { TabHeader } from "@/navigation/TabHeader";
import { EXPORTS } from "@/api/exports";
import { useExcelExport } from "@/hooks/useExcelExport";
import { buildDashboardParams, useDashboard } from "./useDashboard";

/** Konumlar nadir değişir (backend cache 300 sn) */
const LOCATIONS_STALE_MS = 5 * 60_000;

export default function DashboardScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const user = useAuthStore((s) => s.user);
  const dash = useDashboard();
  const { data } = dash;

  // Excel: web Genel Bakış'taki gibi ekrandaki dönem + konumla (aynı dosya); başlıkta zilin yanında
  const excel = useExcelExport();
  const canExport = canViewSales(user);
  const { period, customRange, locationId } = dash.filters;
  const { exporting, run: runExport } = excel;
  useLayoutEffect(() => {
    const p = buildDashboardParams({ period, customRange, locationId });
    const query: Record<string, string | number> = { period: p.period };
    if (p.location_id != null) query.location_id = p.location_id;
    if (p.start_date) query.start_date = p.start_date;
    if (p.end_date) query.end_date = p.end_date;
    navigation.setOptions({
      header: () => (
        <TabHeader
          title="Genel Bakış"
          right={
            canExport ? (
              <AppIconButton
                icon="excel"
                label="Excel'e aktar"
                tone="success"
                loading={exporting}
                onPress={() => runExport(EXPORTS.overview(query))}
                testID="header-excel"
              />
            ) : null
          }
        />
      ),
    });
  }, [navigation, canExport, period, customRange, locationId, exporting, runExport]);

  // Konum filtresi: bundle ile paralel değil, ilk panel verisi geldikten sonra bir kez çekilir
  const locationsQuery = useQuery({
    queryKey: queryKeys.overview.locations(),
    queryFn: ({ signal }) => overviewApi.locations(signal),
    staleTime: LOCATIONS_STALE_MS,
    enabled: !!data,
  });

  const onRefresh = useCallback(async () => {
    try {
      await dash.refresh();
    } catch (e) {
      toast.error(errorMessage(e, "Genel bakış yenilenemedi."));
    }
  }, [dash]);

  const openDevice = useCallback(
    (sn: string, name?: string) => navigation.navigate("DeviceDetail", { sn, name }),
    [navigation]
  );
  const openDevices = useCallback(() => navigation.navigate("Tabs", { screen: "Devices" }), [navigation]);

  const salesAllowed = canViewSales(user) && !!data?.sales;
  const sales = salesAllowed ? data?.sales ?? null : null;
  const failed = sales?.transactions.failed ?? 0;

  return (
    <AppScreen refreshing={dash.refreshing} onRefresh={onRefresh} testID="dashboard-screen">
      <DashboardFilters
        period={dash.filters.period}
        customRange={dash.filters.customRange}
        onPeriodChange={dash.setPeriod}
        onCustomRange={dash.applyCustomRange}
        locations={locationsQuery.data ?? []}
        locationId={dash.filters.locationId}
        onLocationChange={dash.setLocationId}
      />

      {dash.isLoading ? (
        <DashboardSkeleton />
      ) : !data ? (
        <AppErrorState
          title="Genel bakış yüklenemedi"
          message={errorMessage(dash.error, "Genel bakış verileri alınamadı.")}
          onRetry={() => dash.retry()}
          retrying={dash.isFetching}
          compact
        />
      ) : (
        <>
          <View style={styles.statusLine}>
            <AppText variant="caption" color="textSecondary" numberOfLines={1} style={styles.flex}>
              {data.periodLabel || "Genel Bakış"}
              {dash.dataUpdatedAt ? ` · Güncellendi ${formatTime(new Date(dash.dataUpdatedAt))}` : ""}
            </AppText>
            {dash.isFetching && !dash.refreshing ? (
              <View style={styles.fetching} accessibilityLiveRegion="polite" accessibilityLabel="Güncelleniyor">
                <ActivityIndicator size="small" color={colors.textTertiary} />
                <AppText variant="caption" color="textTertiary">
                  Güncelleniyor
                </AppText>
              </View>
            ) : null}
          </View>

          {dash.isError ? (
            <AppNotice
              tone="warning"
              title="Veriler güncellenemedi"
              message={`${errorMessage(dash.error)} Son başarılı veriler gösteriliyor.`}
            />
          ) : null}

          <KpiGrid data={data} salesAllowed={salesAllowed} onDevicesPress={openDevices} />

          {!sales ? (
            <AppNotice
              tone="info"
              title="Satış verileri gizli"
              message="Ciro ve işlem bilgilerini görüntüleme yetkiniz yok. Yetki için şirket yöneticinizle görüşün."
            />
          ) : (
            <>
              <RevenueChart mode={sales.timeseries.mode} points={sales.timeseries.points} periodLabel={data.periodLabel} />
              {failed > 0 ? <FailureReasonsCard failures={sales.failures} failed={failed} /> : null}
              <PaymentBreakdownCard items={sales.paymentBreakdown} />
              <TopDevicesCard items={sales.topDevices} onOpenDevice={openDevice} />
              <TechnicalErrorsCard items={sales.errorBreakdown} onOpenDevice={openDevice} />
              <RecentTransactionsCard
                items={sales.recentTransactions}
                hourly={sales.timeseries.mode === "hourly"}
                onOpenDevice={openDevice}
              />
            </>
          )}
        </>
      )}
    </AppScreen>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    statusLine: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, marginBottom: -t.spacing.md },
    fetching: { flexDirection: "row", alignItems: "center", gap: t.spacing.xs },
  })
);
