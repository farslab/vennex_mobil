/**
 * Panel (sekme kökü) — başlığı TabHeader verir, ekran kendi başlığını çizmez.
 * Veri: yalnız `GET /overview/dashboard/` bundle'ı (docs/API_CONTRACTS.md §2.4, §3.8).
 * Satış yetkisi yoksa (istemci `view_sales` veya backend `sales_visible=false`) hiçbir tutar gösterilmez.
 */
import React, { useCallback, useLayoutEffect, useMemo, useState } from "react";
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
import type { RootStackParamList } from "@/navigation/types";
import { DashboardFilters } from "@/components/dashboard/DashboardFilters";
import { DashboardSkeleton } from "@/components/dashboard/DashboardSkeleton";
import { KpiGrid } from "@/components/dashboard/KpiGrid";
import {
  FailureReasonsCard,
  hasPersonelRevenue,
  PaymentBreakdownCard,
  PersonelGroupsSheet,
  usePersonelGroups,
} from "@/components/dashboard/BreakdownCards";
import { TechnicalErrorsSheet, TopDevicesCard } from "@/components/dashboard/DeviceRankCards";
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
  const [sheet, setSheet] = useState<"technical" | "personel" | null>(null);
  const { data } = dash;

  // Excel: web Genel Bakış'taki gibi ekrandaki dönem + konumla (aynı dosya); başlıkta zilin yanında
  const excel = useExcelExport();
  const canExport = canViewSales(user);
  const { period, customRange, locationIds } = dash.filters;
  const { exporting, run: runExport } = excel;
  useLayoutEffect(() => {
    const p = buildDashboardParams({ period, customRange, locationIds });
    const query: Record<string, string | number> = { period: p.period };
    if (p.location_ids?.length) query.location_ids = [...p.location_ids].sort((a, b) => a - b).join(",");
    if (p.start_date) query.start_date = p.start_date;
    if (p.end_date) query.end_date = p.end_date;
    navigation.setOptions({
      header: () => (
        <TabHeader
          title="Genel Bakış"
          logo
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
  }, [navigation, canExport, period, customRange, locationIds, exporting, runExport]);

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

  // Web gibi: Personel Kart satırı yalnız grup kırılımı boş değilse bağlantıdır. Kırılım yalnız
  // Personel Kart cirosu varken istenir; alt sayfa aynı önbelleği kullanır (açılınca anında gelir).
  const panelParams = useMemo(() => buildDashboardParams(dash.filters), [dash.filters]);
  const personelGroups = usePersonelGroups(panelParams, hasPersonelRevenue(sales?.paymentBreakdown));
  const personelLinkable = (personelGroups.data?.groups.length ?? 0) > 0;

  return (
    <AppScreen refreshing={dash.refreshing} onRefresh={onRefresh} testID="dashboard-screen">
      <DashboardFilters
        period={dash.filters.period}
        customRange={dash.filters.customRange}
        onPeriodChange={dash.setPeriod}
        onCustomRange={dash.applyCustomRange}
        locations={locationsQuery.data ?? []}
        locationIds={dash.filters.locationIds}
        onLocationsChange={dash.setLocationIds}
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
          {dash.isFetching && !dash.refreshing ? (
            <View style={styles.fetching} accessibilityLiveRegion="polite" accessibilityLabel="Güncelleniyor">
              <ActivityIndicator size="small" color={colors.textTertiary} />
              <AppText variant="caption" color="textTertiary">
                Güncelleniyor
              </AppText>
            </View>
          ) : null}

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
              {failed > 0 ? (
                <FailureReasonsCard
                  failures={sales.failures}
                  failed={failed}
                  onTechnicalPress={sales.errorBreakdown.length ? () => setSheet("technical") : undefined}
                />
              ) : null}
              <PaymentBreakdownCard
                items={sales.paymentBreakdown}
                onPersonelPress={personelLinkable ? () => setSheet("personel") : undefined}
              />
              <TopDevicesCard items={sales.topDevices} onOpenDevice={openDevice} />
              <TechnicalErrorsSheet
                visible={sheet === "technical"}
                onClose={() => setSheet(null)}
                items={sales.errorBreakdown}
                onOpenDevice={openDevice}
              />
              <PersonelGroupsSheet
                visible={sheet === "personel"}
                onClose={() => setSheet(null)}
                params={panelParams}
              />
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
    fetching: { flexDirection: "row", alignItems: "center", gap: t.spacing.xs, alignSelf: "center", marginBottom: -t.spacing.sm },
  })
);
