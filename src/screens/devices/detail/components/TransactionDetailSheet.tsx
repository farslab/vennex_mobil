import React from "react";
import { StyleSheet, View } from "react-native";
import { AppBadge, AppSheet, AppText, makeStyles } from "@/design-system";
import { KeyValueRow } from "@/components/devices/DeviceUi";
import { cancelReasonLabel, ptTypeLabel } from "@/components/devices/deviceHelpers";
import { formatCurrency } from "@/utils/number";
import { formatDateTime } from "@/utils/date";
import type { PosTransaction } from "@/types/devices";
import { TxReceiptRefund } from "./TxReceiptRefund";

export function TransactionDetailSheet({
  tx,
  onClose,
  sn,
  receiptsEnabled = false,
}: {
  tx: PosTransaction | null;
  onClose: () => void;
  /** Fiş + uzaktan iade için (yalnız vennexRN cihazlarda, web ile aynı) */
  sn?: string;
  receiptsEnabled?: boolean;
}) {
  const styles = useStyles();
  return (
    <AppSheet visible={tx != null} onClose={onClose} title="İşlem detayı" testID="tx-detail">
      {tx ? (
        <>
          <View style={styles.head}>
            <AppText variant="metricLg">{formatCurrency(tx.amount)}</AppText>
            <AppBadge dot tone={tx.status ? "success" : "danger"} label={tx.status ? "Başarılı" : "Başarısız"} />
          </View>
          <View>
            <KeyValueRow label="Tarih" value={formatDateTime(tx.pt_datetime)} />
            <KeyValueRow label="Ürün" value={tx.display_name ?? (tx.product_no != null ? `Ürün no ${tx.product_no}` : null)} />
            <KeyValueRow label="Ürün no" value={tx.product_no != null ? String(tx.product_no) : null} />
            <KeyValueRow label="Ödeme türü" value={ptTypeLabel(tx.pt_type)} />
            {!tx.status ? <KeyValueRow label="Hata nedeni" value={cancelReasonLabel(tx.iptalNo)} /> : null}
            <KeyValueRow label="Kart" value={tx.pt_pan} mono />
            <KeyValueRow label="Banka referansı" value={tx.bankRefNo} mono />
            <KeyValueRow label="İşlem no" value={tx.pt_id} mono last />
          </View>
          {receiptsEnabled && sn ? <TxReceiptRefund key={tx.id} sn={sn} tx={tx} /> : null}
        </>
      ) : null}
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: t.spacing.md },
  })
);
