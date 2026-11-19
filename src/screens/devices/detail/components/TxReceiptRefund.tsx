/**
 * Dijital fiş + uzaktan iade — web `dashboard_v2/receipt_refund.py` + `receipt_refund_modal.html` ile aynı:
 *  - GET  pos-devices/{sn}/transactions/{id}/receipt/  → fişler + son iade isteği
 *  - POST pos-devices/{sn}/transactions/{id}/refund/   → iade isteği (yöntemi cihaz seçer, komut websocket ile gider)
 *  - Sonuç: `refund.poll` true iken 3 sn'de bir (kart bekleniyorsa 2 sn) yeniden sorgulanır, en fazla 90 kez.
 * Yalnız vennexRN cihazlarda (`receipts_refund_enabled`) gösterilir. Fiş paylaşımı: işletim sisteminin paylaş menüsü.
 */
import React, { useEffect, useState } from "react";
import { Share, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AppBadge,
  AppButton,
  AppConfirmSheet,
  AppErrorState,
  AppNotice,
  AppSkeleton,
  AppText,
  makeStyles,
  toast,
  type StatusTone,
} from "@/design-system";
import { devicesApi } from "@/api/devices";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import type { PosTransaction, TxReceipt, TxRefundRequest } from "@/types/devices";

export const MAX_POLLS = 90;
const POLL_MS = 3000;
const CARD_POLL_MS = 2000;
/** Web: en fazla 90 sorgu (~3 sn) — sonra kullanıcı "Yenile" ile devam eder */
export const MAX_POLL_WINDOW_MS = MAX_POLLS * POLL_MS;

/** Web modalındaki açıklama (aynı metin) */
export const REFUND_HELP =
  "İade başlattığınızda iade edilecek işlem cihazın son işlemiyse ve üzerinden 4 dakikadan fazla süre geçmediyse kart okutulmadan iade edilir. Aksi durumda cihaz ekranında işlem tutarında kart okuyucu açılır ve müşteri kartını okutmalıdır.";
const CARD_WAIT_TEXT = "Müşteri kartını otomattaki cihaza okutmalı — operatör müşteriye 'kartınızı okutun' desin";

function refundTone(r: TxRefundRequest): StatusTone {
  if (r.status === "ok") return "success";
  if (r.status === "failed" || r.status === "rejected") return "danger";
  if (r.status === "timeout") return "warning";
  return "info";
}

export function TxReceiptRefund({ sn, tx }: { sn: string; tx: PosTransaction }) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const key = queryKeys.devices.txReceipt(sn, tx.id);
  const [pollStart, setPollStart] = useState(() => Date.now());
  const [confirmOpen, setConfirmOpen] = useState(false);

  const query = useQuery({
    queryKey: key,
    queryFn: ({ signal }) => devicesApi.txReceipt(sn, tx.id, signal),
    refetchInterval: (q) => {
      const r = q.state.data?.refund;
      if (!r?.poll || Date.now() - pollStart > MAX_POLL_WINDOW_MS) return false;
      return r.waiting_card ? CARD_POLL_MS : POLL_MS;
    },
  });

  // İade bitince listedeki satır (durum / iptal nedeni) tazelensin
  const finalStatus = query.data?.refund && !query.data.refund.poll ? query.data.refund.status : null;
  useEffect(() => {
    if (finalStatus === "ok") queryClient.invalidateQueries({ queryKey: ["devices", "transactions", sn] });
  }, [finalStatus, queryClient, sn]);

  const refund = useMutation({
    mutationFn: () => devicesApi.txRefund(sn, tx.id),
    onSuccess: (state) => {
      setPollStart(Date.now());
      queryClient.setQueryData(key, state);
      setConfirmOpen(false);
      toast.success(state.message || "İade isteği cihaza gönderildi.");
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: key });
    },
  });

  if (query.isLoading) {
    return (
      <View style={styles.section}>
        <AppSkeleton height={120} radius={8} />
      </View>
    );
  }
  if (query.isError || !query.data) {
    return (
      <View style={styles.section}>
        <AppErrorState compact message={errorMessage(query.error, "Fiş bilgisi alınamadı.")} onRetry={() => query.refetch()} retrying={query.isFetching} />
      </View>
    );
  }

  const state = query.data;
  const r = state.refund;
  return (
    <View style={styles.section} testID="tx-receipt-refund">
      <AppText variant="cardTitle">Fişler</AppText>
      {state.receipts.length === 0 ? (
        <AppText variant="callout" color="textTertiary">
          Bu işlem için dijital fiş yok.
        </AppText>
      ) : (
        state.receipts.map((rc, i) => <ReceiptBlock key={`${rc.kind}-${i}`} receipt={rc} />)
      )}

      <View style={styles.refundHead}>
        <AppText variant="cardTitle">Uzaktan iade</AppText>
        {r ? <AppBadge tone={refundTone(r)} label={r.label} dot /> : null}
      </View>

      {r?.waiting_card ? (
        <AppNotice
          tone="warning"
          title="Kart bekleniyor"
          message={`${CARD_WAIT_TEXT}${(r.card_seconds_left ?? 0) > 0 ? ` · ${r.card_seconds_left} sn` : ""}`}
        />
      ) : null}
      {r && !r.poll && r.status !== "ok" && (r.message || r.reject_reason) ? (
        <AppText variant="caption" color="textSecondary">
          {[r.reject_reason, r.message].filter(Boolean).join(" · ")}
        </AppText>
      ) : null}
      {r?.poll && query.dataUpdatedAt - pollStart > MAX_POLL_WINDOW_MS ? (
        <AppText variant="caption" color="textSecondary">
          Cihazdan yanıt bekleniyor. Durumu görmek için yenileyin.
        </AppText>
      ) : null}

      {state.can_refund ? (
        <>
          <AppText variant="caption" color="textSecondary">
            {REFUND_HELP}
          </AppText>
          <AppButton
            title="İade et"
            icon="rotate-ccw"
            variant="dangerOutline"
            onPress={() => {
              refund.reset();
              setConfirmOpen(true);
            }}
            testID="tx-refund"
          />
        </>
      ) : state.refund_block ? (
        <AppText variant="caption" color="textTertiary" testID="tx-refund-block">
          {state.refund_block}
        </AppText>
      ) : null}

      {r?.poll ? (
        <AppButton
          title="Yenile"
          icon="refresh-cw"
          variant="outline"
          size="sm"
          loading={query.isFetching}
          onPress={() => {
            setPollStart(Date.now());
            query.refetch();
          }}
        />
      ) : null}

      <AppConfirmSheet
        visible={confirmOpen}
        title="İade et"
        message={REFUND_HELP}
        summary={[
          { label: "İade tutarı (tam tutar)", value: `₺${state.tx.amount}` },
          { label: "İşlem", value: state.tx.datetime },
        ]}
        confirmLabel="İade et"
        destructive
        irreversible
        loading={refund.isPending}
        error={refund.isError ? errorMessage(refund.error, "İade başlatılamadı.") : null}
        onConfirm={() => refund.mutate()}
        onCancel={() => setConfirmOpen(false)}
      />
    </View>
  );
}

function ReceiptBlock({ receipt }: { receipt: TxReceipt }) {
  const styles = useStyles();
  const share = async () => {
    try {
      await Share.share({ title: `Fiş · ${receipt.label}`, message: receipt.text });
    } catch {
      // kullanıcı paylaşımı iptal etti
    }
  };
  return (
    <View style={styles.receipt}>
      <View style={styles.receiptHead}>
        <AppText variant="bodyStrong" style={styles.flex}>
          {receipt.label}
        </AppText>
        <AppButton title="Paylaş" icon="share" variant="outline" size="sm" onPress={share} testID={`receipt-share-${receipt.kind}`} />
      </View>
      <View style={styles.paper}>
        <AppText variant="mono" selectable style={styles.paperText}>
          {receipt.text}
        </AppText>
      </View>
      {receipt.created_at ? (
        <AppText variant="caption" color="textTertiary">
          {receipt.created_at}
        </AppText>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    section: { gap: t.spacing.md, marginTop: t.spacing.lg },
    refundHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: t.spacing.sm },
    receipt: { gap: t.spacing.sm },
    receiptHead: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    paper: {
      backgroundColor: "#FFFFFF",
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      borderRadius: t.radius.sm,
      padding: t.spacing.md,
    },
    // Fiş kağıdı her temada beyaz/siyah (web: beyaz zemin, monospace)
    paperText: { color: "#111111", fontFamily: "Menlo", fontSize: 11, lineHeight: 15 },
  })
);
