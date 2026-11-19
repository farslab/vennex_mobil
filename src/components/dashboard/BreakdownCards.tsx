import React from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  AppEmptyState,
  AppErrorState,
  AppListSkeleton,
  AppSheet,
  AppText,
  makeStyles,
  useTheme,
} from "@/design-system";
import { DashSection } from "./DashSection";
import { overviewApi, type DashboardParams } from "@/api/overview";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { formatCurrency, formatInteger, formatPercent } from "@/utils/number";
import { ptBadge } from "@/components/devices/deviceHelpers";
import { webBadgeColors, type WebBadgeColor } from "@/components/devices/webBadgeColors";
import type { DashboardSales, PaymentBreakdownItem } from "@/types/overview";

/** Personel Kart ödeme tipi (`pt_type`) */
export const PERSONEL_PT_TYPE = 5;

/* -------------------------------------------------------- Payment types */

/** Web `pct_of` gibi tam sayı yüzde (`round(100 * value / total)`) */
export function paymentShare(amount: number, total: number): number {
  return total > 0 ? Math.round((100 * amount) / total) : 0;
}

/**
 * Ödeme tipine göre ciro — yalnız başarılı işlemler (`overview.py:151-153`).
 * Web gibi: tutarı 0 olan tipler listelenmez, pay tam sayı yüzde; renk ödeme tipine sabittir
 * (işlem listelerindeki ödeme tipi rozetiyle aynı).
 */
export function PaymentBreakdownCard({
  items,
  onPersonelPress,
}: {
  items: PaymentBreakdownItem[];
  /** Web gibi: Personel Kart satırı grup dağılımını açar (yalnız grup kırılımı boş değilse verin) */
  onPersonelPress?: () => void;
}) {
  const styles = useStyles();
  const { isDark } = useTheme();
  const rows = items.filter((p) => p.amount > 0);
  const total = rows.reduce((acc, p) => acc + p.amount, 0);
  const swatch = (ptType: number) => webBadgeColors(ptBadge(ptType).color, isDark).fg;

  return (
    <DashSection title="Ödeme Türüne Göre" subtitle="Başarılı işlemler" testID="payment-breakdown">
      {rows.length === 0 || total <= 0 ? (
        <AppEmptyState compact icon="credit-card" title="Bu dönemde ödeme yok" />
      ) : (
        <View style={styles.list}>
          {/* Yığılmış dağılım çubuğu */}
          <View style={styles.stack} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {rows.map((p) => (
              <View key={`seg-${p.pt_type}`} style={{ flex: p.amount, backgroundColor: swatch(p.pt_type) }} />
            ))}
          </View>
          {rows.map((p, i) => {
            const share = paymentShare(p.amount, total);
            const label = `${p.label}: ${formatCurrency(p.amount)}, ${formatInteger(p.count)} işlem, ${formatPercent(share, 0)}`;
            const personelLink = !!onPersonelPress && p.pt_type === PERSONEL_PT_TYPE;
            const content = (
              <>
                <View style={[styles.dot, { backgroundColor: swatch(p.pt_type) }]} testID={`payment-swatch-${p.pt_type}`} />
                <View style={styles.flex}>
                  <AppText variant="calloutStrong" numberOfLines={1}>
                    {p.label}
                  </AppText>
                  <AppText variant="caption" color="textTertiary" numberOfLines={1}>
                    {formatInteger(p.count)} işlem
                    {personelLink ? <AppText variant="caption" color="primary" weight="700">{"  ·  Grup dağılımı ›"}</AppText> : null}
                  </AppText>
                </View>
                <View style={styles.amountCol}>
                  <AppText variant="numeric" weight="700">
                    {formatCurrency(p.amount)}
                  </AppText>
                  <AppText variant="caption" color="textTertiary" weight="600">
                    {formatPercent(share, 0)}
                  </AppText>
                </View>
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
    </DashSection>
  );
}

/* ------------------------------------------------------ Failure reasons */

const REASONS: { key: keyof DashboardSales["failures"]; label: string; color: WebBadgeColor }[] = [
  { key: "timeout", label: "Zaman aşımı", color: "sky" },
  { key: "bank", label: "Banka reddi", color: "amber" },
  // Web: "Teknik İ." (Teknik İptal — POS Dağılımı)
  { key: "technical", label: "Teknik iptal", color: "red" },
  { key: "other", label: "Diğer", color: "gray" },
];

/** Başarısız işlemlerin nedenleri (`iptalNo` 1/2/3/diğer, `overview.py:81-84`) */
export function FailureReasonsCard({
  failures,
  failed,
  onTechnicalPress,
}: {
  failures: DashboardSales["failures"];
  failed: number;
  /** Web gibi: "Teknik iptal" satırı, teknik iptal POS dağılımını alttan açar */
  onTechnicalPress?: () => void;
}) {
  const styles = useStyles();
  const { isDark, colors } = useTheme();
  return (
    <DashSection title="Başarısızlık nedenleri" subtitle={`${formatInteger(failed)} başarısız işlem`} testID="failure-reasons">
      <View style={styles.list}>
        {/* Nedenlerin dağılımı */}
        <View style={styles.stack} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {REASONS.filter((r) => (failures[r.key] ?? 0) > 0).map((r) => (
            <View key={`seg-${r.key}`} style={{ flex: failures[r.key] ?? 0, backgroundColor: webBadgeColors(r.color, isDark).fg }} />
          ))}
        </View>
        {REASONS.map((r) => {
          const v = failures[r.key] ?? 0;
          const share = failed > 0 ? Math.round((100 * v) / failed) : 0;
          const isLink = r.key === "technical" && !!onTechnicalPress && v > 0;
          const content = (
            <>
              <View style={[styles.dot, { backgroundColor: v > 0 ? webBadgeColors(r.color, isDark).fg : colors.borderStrong }]} />
              <View style={styles.flex}>
                <AppText variant="calloutStrong" color={v > 0 ? undefined : "textTertiary"} numberOfLines={1}>
                  {r.label}
                </AppText>
                {isLink ? (
                  <AppText variant="caption" color="primary" weight="700">
                    POS dağılımı ›
                  </AppText>
                ) : null}
              </View>
              <View style={styles.amountCol}>
                <AppText variant="numeric" weight="700" color={v > 0 ? undefined : "textTertiary"}>
                  {formatInteger(v)}
                </AppText>
                <AppText variant="caption" color="textTertiary" weight="600">
                  %{share}
                </AppText>
              </View>
            </>
          );
          if (isLink) {
            return (
              <Pressable
                key={r.key}
                onPress={onTechnicalPress}
                accessibilityRole="button"
                accessibilityLabel={`${r.label}: ${formatInteger(v)}`}
                accessibilityHint="Teknik iptal POS dağılımını açar"
                style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                testID="failure-technical"
              >
                {content}
              </Pressable>
            );
          }
          return (
            <View key={r.key} style={styles.row} accessible accessibilityLabel={`${r.label}: ${formatInteger(v)}`}>
              {content}
            </View>
          );
        })}
      </View>
    </DashSection>
  );
}

/* ------------------------------------------------ Personel kart grupları */

/**
 * Personel Kart grup dağılımı sorgusu — kart (bağlantı görünürlüğü) ve alt sayfa aynı önbelleği paylaşır.
 * Web, Personel Kart satırını yalnız grup kırılımı boş değilse bağlantı yapar.
 */
export function usePersonelGroups(params: DashboardParams, enabled: boolean) {
  return useQuery({
    queryKey: queryKeys.overview.personelGroups({ ...params }),
    queryFn: ({ signal }) => overviewApi.personelGroups(params, signal),
    enabled,
    staleTime: 30_000,
  });
}

/** Personel Kart satırı tutarlı mı (web: yalnız tutarı olan satırlar listelenir) */
export function hasPersonelRevenue(items: PaymentBreakdownItem[] | null | undefined): boolean {
  return !!items?.some((p) => p.pt_type === PERSONEL_PT_TYPE && p.amount > 0);
}

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
  const query = usePersonelGroups(params, visible);
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
      height: 10,
      borderRadius: t.radius.pill,
      overflow: "hidden",
      gap: 2,
      backgroundColor: t.colors.surfaceMuted,
    },
    row: { flexDirection: "row", alignItems: "center", gap: t.spacing.md, minHeight: 40 },
    dot: { width: 10, height: 10, borderRadius: 5 },
    amountCol: { flexDirection: "row-reverse", alignItems: "baseline", gap: t.spacing.sm },
  })
);
