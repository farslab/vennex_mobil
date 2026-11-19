/**
 * Nakit toplama & ciro sayımı — cihaz detayında Genel sekmesinin en altında (ayrı sekme değil).
 * Backend'de "bekleyen nakit" alanı YOK (§3.4) → tutar burada hesaplanmaz/gösterilmez;
 * toplanan tutarı sunucu işlem anında hesaplar ve yanıtta döner.
 */
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { useSingleFlight } from "@/hooks/useSingleFlight";
import {
  AppButton,
  AppCard,
  AppConfirmSheet,
  AppDivider,
  AppInput,
  AppListSkeleton,
  AppNotice,
  AppText,
  makeStyles,
  toast,
} from "@/design-system";
import { devicesApi } from "@/api/devices";
import { errorMessage } from "@/api/client";
import { ptTypeLabel } from "@/components/devices/deviceHelpers";
import { formatCurrency } from "@/utils/number";
import { formatDateTime } from "@/utils/date";
import type { CountRevenueResult, PosDeviceDetail } from "@/types/devices";
import { useCashHistory, useInvalidateDevices, useRevenueCounts, type DeviceAccess } from "../useDeviceQueries";

type PendingAction = "collect" | "count" | null;

export function CashSection({ sn, detail, access }: { sn: string; detail: PosDeviceDetail; access: DeviceAccess }) {
  const styles = useStyles();
  const invalidate = useInvalidateDevices();
  const [notes, setNotes] = useState("");
  const [pending, setPending] = useState<PendingAction>(null);
  const [lastCount, setLastCount] = useState<CountRevenueResult | null>(null);

  const cash = useCashHistory(sn, access.sales);
  const counts = useRevenueCounts(sn, access.sales);

  const collect = useMutation({
    mutationFn: () => devicesApi.collectCash(sn, notes),
    onSuccess: (res) => {
      setPending(null);
      setNotes("");
      toast.success(
        access.sales && res.amount_collected != null
          ? `${formatCurrency(res.amount_collected)} nakit toplama kaydedildi.`
          : "Nakit toplama kaydedildi."
      );
      invalidate();
    },
  });

  const count = useMutation({
    mutationFn: () => devicesApi.countRevenue(sn, notes),
    onSuccess: (res) => {
      setPending(null);
      setNotes("");
      setLastCount(res);
      toast.success(res.detail || "Ciro sayımı kaydedildi.");
      invalidate();
    },
  });

  const active = pending === "collect" ? collect : count;
  // Çift dokunuşta ikinci POST gitmesin (nakit/ciro kaydı kalıcıdır)
  const confirmActive = useSingleFlight(active.mutateAsync);
  const deviceName = detail.pos_name || sn;
  const summary = [
    { label: "Cihaz", value: deviceName },
    { label: "Seri no", value: sn },
    { label: "Tutar", value: "Sunucu hesaplar" },
    ...(notes.trim() ? [{ label: "Not", value: notes.trim() }] : []),
  ];

  // Web (`pos_device_detail.html:2542`, `collect_cash`): satış yetkisi olan ya da teknisyen, cihaza erişimi varsa toplar
  const canCollect = access.sales || access.isTech;
  const canCount = access.sales;

  return (
    <View style={styles.section} testID="cash-section">
      {canCollect || canCount ? (
        <AppCard title="Nakit & ciro">
          <View style={styles.form}>
            <AppNotice
              tone="info"
              message="Toplanacak nakit ve sayılacak ciro, son kayıttan sonraki başarılı işlemlerden sunucuda hesaplanır. Bekleyen tutar uygulamada gösterilmez."
            />
            <AppInput
              label="Not (opsiyonel)"
              value={notes}
              onChangeText={setNotes}
              maxLength={500}
              placeholder="Ör. haftalık toplama"
              testID="cash-notes"
            />
            <View style={styles.actions}>
              {canCollect ? (
                <AppButton
                  testID="collect-cash-button"
                  title="Nakit topla"
                  icon="dollar-sign"
                  onPress={() => {
                    collect.reset();
                    setPending("collect");
                  }}
                  style={styles.flex}
                />
              ) : null}
              {canCount ? (
                <AppButton
                  testID="count-revenue-button"
                  title="Ciro say"
                  icon="hash"
                  variant="outline"
                  onPress={() => {
                    count.reset();
                    setPending("count");
                  }}
                  style={styles.flex}
                />
              ) : null}
            </View>
          </View>
        </AppCard>
      ) : (
        <AppNotice tone="info" message="Bu sekmedeki işlemler için yetkiniz yok." />
      )}

      {lastCount ? (
        <AppCard title="Son ciro sayımı" subtitle="Az önce kaydedildi">
          <View style={styles.totalRow}>
            <AppText variant="callout" color="textSecondary">
              Toplam
            </AppText>
            <AppText variant="metricMd">{formatCurrency(lastCount.total_revenue)}</AppText>
          </View>
          <PtBreakdown byPtType={lastCount.by_pt_type} />
        </AppCard>
      ) : null}

      {access.sales ? (
        <>
          {/* Geçmiş kartları yalnız kayıt varsa (yüklenirken / hatada kart kalır) */}
          {cash.isLoading || cash.isError || cash.data?.results.length ? (
            <AppCard title="Nakit toplama geçmişi" padded={false} subtitle="Son 25 kayıt" testID="cash-history">
              {cash.isLoading ? (
                <AppListSkeleton rows={3} />
              ) : cash.isError ? (
                <View style={styles.pad}>
                  <AppNotice tone="warning" message={errorMessage(cash.error)} />
                </View>
              ) : (
                (cash.data?.results ?? []).map((c, i, all) => (
                  <HistoryRow
                    key={c.id}
                    title={formatCurrency(c.amount)}
                    when={formatDateTime(c.datetime)}
                    by={c.collected_by}
                    notes={c.notes}
                    last={i === all.length - 1}
                  />
                ))
              )}
            </AppCard>
          ) : null}

          {counts.isLoading || counts.isError || counts.data?.results.length ? (
            <AppCard title="Ciro sayım geçmişi" padded={false} subtitle="Son 25 kayıt" testID="count-history">
              {counts.isLoading ? (
                <AppListSkeleton rows={3} />
              ) : counts.isError ? (
                <View style={styles.pad}>
                  <AppNotice tone="warning" message={errorMessage(counts.error)} />
                </View>
              ) : (
                (counts.data?.results ?? []).map((c, i, all) => (
                  <HistoryRow
                    key={c.id}
                    title={formatCurrency(c.total_revenue)}
                    when={formatDateTime(c.datetime)}
                    by={c.counted_by}
                    notes={c.notes}
                    last={i === all.length - 1}
                  >
                    <PtBreakdown byPtType={c.by_pt_type} compact />
                  </HistoryRow>
                ))
              )}
            </AppCard>
          ) : null}
        </>
      ) : null}

      <AppConfirmSheet
        visible={pending != null}
        title={pending === "collect" ? "Nakit toplama" : "Ciro sayımı"}
        message={
          pending === "collect"
            ? "Son toplamadan bu yana yapılan başarılı nakit satışlar toplandı olarak kaydedilecek."
            : "Son sayımdan bu yana yapılan tüm başarılı satışlar ödeme türüne göre sayılıp kaydedilecek."
        }
        summary={summary}
        confirmLabel={pending === "collect" ? "Toplamayı kaydet" : "Sayımı kaydet"}
        irreversible
        loading={active.isPending}
        error={active.error ? errorMessage(active.error) : null}
        onConfirm={confirmActive}
        onCancel={() => setPending(null)}
      />
    </View>
  );
}

function HistoryRow({
  title,
  when,
  by,
  notes,
  last,
  children,
}: {
  title: string;
  when: string;
  by: string | null;
  notes: string;
  last?: boolean;
  children?: React.ReactNode;
}) {
  const styles = useStyles();
  return (
    <>
      <View style={styles.historyRow} accessible accessibilityLabel={`${title}, ${when}${by ? `, ${by}` : ""}`}>
        <View style={styles.historyHead}>
          <AppText variant="numeric">{title}</AppText>
          <AppText variant="caption" color="textTertiary">
            {when}
          </AppText>
        </View>
        <AppText variant="caption" color="textSecondary">
          {by ? `İşlemi yapan: ${by}` : "İşlemi yapan: —"}
          {notes ? ` · ${notes}` : ""}
        </AppText>
        {children}
      </View>
      {!last ? <AppDivider /> : null}
    </>
  );
}

function PtBreakdown({ byPtType, compact }: { byPtType: Record<string, number>; compact?: boolean }) {
  const styles = useStyles();
  const rows = Object.entries(byPtType)
    .filter(([, v]) => v !== 0)
    .sort((a, b) => b[1] - a[1]);
  if (!rows.length) return null;
  return (
    <View style={[styles.breakdown, compact && styles.breakdownCompact]}>
      {rows.map(([pt, amount]) => (
        <View key={pt} style={styles.breakdownRow}>
          <AppText variant="caption" color="textSecondary">
            {ptTypeLabel(pt)}
          </AppText>
          <AppText variant="numericSm">{formatCurrency(amount)}</AppText>
        </View>
      ))}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    section: { gap: t.spacing.md },
    flex: { flex: 1 },
    form: { gap: t.spacing.md },
    actions: { flexDirection: "row", gap: t.spacing.sm },
    pad: { padding: t.layout.cardPadding },
    totalRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginBottom: t.spacing.sm },
    historyRow: { paddingHorizontal: t.layout.cardPadding, paddingVertical: t.spacing.md, gap: 2 },
    historyHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", gap: t.spacing.sm },
    breakdown: { gap: 2, marginTop: t.spacing.xs },
    breakdownCompact: { marginTop: t.spacing.xs },
    breakdownRow: { flexDirection: "row", justifyContent: "space-between" },
  })
);
