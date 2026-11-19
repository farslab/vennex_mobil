import React from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  AppCard,
  AppEmptyState,
  AppErrorState,
  AppListSkeleton,
  AppSheet,
  AppText,
  makeStyles,
  useTheme,
} from "@/design-system";
import { overviewApi, type DashboardParams } from "@/api/overview";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { formatCurrency, formatInteger, formatPercent } from "@/utils/number";
import type { DashboardSales, PaymentBreakdownItem } from "@/types/overview";

/** Personel Kart ödeme tipi (`pt_type`) */
export const PERSONEL_PT_TYPE = 5;

/* -------------------------------------------------------- Payment types */

/** Ödeme tipine göre ciro — yalnız başarılı işlemler (`overview.py:151-153`) */
export function PaymentBreakdownCard({
  items,
  onPersonelPress,
}: {
  items: PaymentBreakdownItem[];
  /** Web gibi: Personel Kart satırı grup dağılımını açar */
  onPersonelPress?: () => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const total = items.reduce((acc, p) => acc + p.amount, 0);

  return (
    <AppCard title="Ödeme tipleri" subtitle="Başarılı işlemler" testID="payment-breakdown">
      {items.length === 0 || total <= 0 ? (
        <AppEmptyState compact icon="credit-card" title="Bu dönemde ödeme yok" />
      ) : (
        <View style={styles.list}>
          {/* Yığılmış dağılım çubuğu */}
          <View style={styles.stack} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {items.map((p, i) =>
              p.amount > 0 ? (
                <View
                  key={`seg-${p.pt_type}`}
                  style={{ flex: p.amount, backgroundColor: colors.chart[i % colors.chart.length] }}
                />
              ) : null
            )}
          </View>
          {items.map((p, i) => {
            const share = (p.amount / total) * 100;
            const label = `${p.label}: ${formatCurrency(p.amount)}, ${formatInteger(p.count)} işlem, ${formatPercent(share)}`;
            const personelLink = !!onPersonelPress && p.pt_type === PERSONEL_PT_TYPE;
            const content = (
              <>
                <View style={[styles.swatch, { backgroundColor: colors.chart[i % colors.chart.length] }]} />
                <View style={styles.flex}>
                  <AppText
                    variant={personelLink ? "calloutStrong" : "callout"}
                    color={personelLink ? "primary" : undefined}
                    style={personelLink ? styles.link : undefined}
                    numberOfLines={1}
                  >
                    {p.label}
                  </AppText>
                  <AppText variant="caption" color="textTertiary">
                    {formatInteger(p.count)} işlem · {formatPercent(share)}
                  </AppText>
                </View>
                <AppText variant="numeric">{formatCurrency(p.amount)}</AppText>
              </>
            );
            if (personelLink) {
              return (
                <Pressable
                  key={`pt-${p.pt_type}-${i}`}
                  onPress={onPersonelPress}
                  accessibilityRole="button"
                  accessibilityLabel={label}
                  accessibilityHint="Grup dağılımını açar"
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  testID="payment-personel"
                >
                  {content}
                </Pressable>
              );
            }
            return (
              <View key={`pt-${p.pt_type}-${i}`} style={styles.row} accessible accessibilityLabel={label}>
                {content}
              </View>
            );
          })}
        </View>
      )}
    </AppCard>
  );
}

/* ------------------------------------------------------ Failure reasons */

const REASONS: { key: keyof DashboardSales["failures"]; label: string }[] = [
  { key: "timeout", label: "Zaman aşımı" },
  { key: "bank", label: "Banka reddi" },
  { key: "technical", label: "Teknik hata" },
  { key: "other", label: "Diğer" },
];

/** Başarısız işlemlerin nedenleri (`iptalNo` 1/2/3/diğer, `overview.py:81-84`) */
export function FailureReasonsCard({
  failures,
  failed,
  onTechnicalPress,
}: {
  failures: DashboardSales["failures"];
  failed: number;
  /** Web gibi: "Teknik hata" satırı, teknik hata veren cihazları alttan açar */
  onTechnicalPress?: () => void;
}) {
  const styles = useStyles();
  const max = Math.max(1, ...REASONS.map((r) => failures[r.key] ?? 0));
  return (
    <AppCard title="Başarısızlık nedenleri" subtitle={`${formatInteger(failed)} başarısız işlem`} testID="failure-reasons">
      <View style={styles.list}>
        {REASONS.map((r) => {
          const v = failures[r.key];
          const isLink = r.key === "technical" && !!onTechnicalPress && (v ?? 0) > 0;
          const content = (
            <>
              <AppText
                variant={isLink ? "calloutStrong" : "callout"}
                color={isLink ? "primary" : undefined}
                style={[styles.reasonLabel, isLink && styles.link]}
                numberOfLines={1}
              >
                {r.label}
              </AppText>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${((v ?? 0) / max) * 100}%` }]} />
              </View>
              <AppText variant="numeric" style={styles.reasonValue}>
                {formatInteger(v)}
              </AppText>
            </>
          );
          if (isLink) {
            return (
              <Pressable
                key={r.key}
                onPress={onTechnicalPress}
                accessibilityRole="button"
                accessibilityLabel={`${r.label}: ${formatInteger(v)}`}
                accessibilityHint="Teknik hata veren POS cihazlarını açar"
                style={({ pressed }) => [styles.reasonRow, pressed && styles.pressed]}
                testID="failure-technical"
              >
                {content}
              </Pressable>
            );
          }
          return (
            <View key={r.key} style={styles.reasonRow} accessible accessibilityLabel={`${r.label}: ${formatInteger(v)}`}>
              {content}
            </View>
          );
        })}
      </View>
    </AppCard>
  );
}

/* ------------------------------------------------ Personel kart grupları */

/**
 * Personel Kart — Grup Dağılımı (web Genel Bakış popup'ı ile aynı hesap).
 * Ekrandaki dönem/konum filtresiyle, yalnız açılınca istenir.
 */
export function PersonelGroupsSheet({
  visible,
  onClose,
  params,
}: {
  visible: boolean;
  onClose: () => void;
  params: DashboardParams;
}) {
  const styles = useStyles();
  const query = useQuery({
    queryKey: queryKeys.overview.personelGroups({ ...params }),
    queryFn: ({ signal }) => overviewApi.personelGroups(params, signal),
    enabled: visible,
    staleTime: 30_000,
  });
  const data = query.data;
  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title="Personel Kart — Grup Dağılımı"
      subtitle={data ? `Toplam ${formatCurrency(data.total)}` : undefined}
      scrollable={false}
      testID="personel-groups-sheet"
    >
      {query.isLoading ? (
        <AppListSkeleton rows={4} />
      ) : query.isError ? (
        <AppErrorState
          compact
          message={errorMessage(query.error, "Grup dağılımı alınamadı.")}
          onRetry={() => query.refetch()}
          retrying={query.isFetching}
        />
      ) : (
        <FlatList
          data={data?.groups ?? []}
          keyExtractor={(g, i) => `${g.name}-${i}`}
          style={styles.sheetList}
          ListEmptyComponent={<AppEmptyState compact icon="users" title="Bu dönemde personel kart işlemi yok" />}
          renderItem={({ item: g, index }) => (
            <View
              style={[styles.groupRow, index < (data?.groups.length ?? 0) - 1 && styles.groupBorder]}
              accessible
              accessibilityLabel={`${g.name}: ${formatCurrency(g.amount)}, ${formatInteger(g.count)} işlem, ${formatInteger(g.cards)} kart`}
              testID={`personel-group-${index}`}
            >
              <View style={styles.flex}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {g.name}
                </AppText>
                <AppText variant="caption" color="textTertiary">
                  {formatInteger(g.cards)} kart · {formatInteger(g.count)} işlem
                </AppText>
              </View>
              <AppText variant="numeric">{formatCurrency(g.amount)}</AppText>
            </View>
          )}
        />
      )}
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    pressed: { opacity: 0.6 },
    link: { textDecorationLine: "underline" },
    sheetList: { maxHeight: 460 },
    groupRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.md, paddingVertical: t.spacing.md },
    groupBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    list: { gap: t.spacing.md },
    stack: {
      flexDirection: "row",
      height: 8,
      borderRadius: t.radius.pill,
      overflow: "hidden",
      gap: 2,
      backgroundColor: t.colors.surfaceMuted,
    },
    row: { flexDirection: "row", alignItems: "center", gap: t.spacing.md },
    swatch: { width: 10, height: 10, borderRadius: 3 },
    reasonRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.md },
    reasonLabel: { width: 96 },
    reasonValue: { minWidth: 40, textAlign: "right" },
    track: { flex: 1, height: 6, borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceMuted, overflow: "hidden" },
    fill: { height: "100%", borderRadius: t.radius.pill, backgroundColor: t.colors.danger },
  })
);
