import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { AppBadge, AppIcon, AppText, makeStyles, useTheme, type StatusTone } from "@/design-system";
import { formatCurrency } from "@/utils/number";
import { formatDate } from "@/utils/date";
import type { CariInvoice } from "@/types/account";

const STATUS: Record<string, { label: string; tone: StatusTone }> = {
  overdue: { label: "Vadesi geçti", tone: "danger" },
  not_due: { label: "Vadesi gelmedi", tone: "info" },
  unscheduled: { label: "Vadesiz", tone: "neutral" },
};

export function invoiceStatus(status: string | null | undefined): { label: string; tone: StatusTone } {
  return STATUS[status ?? ""] ?? { label: status || "Durum yok", tone: "neutral" };
}

export function hasInvoicePdf(invoice: CariInvoice): boolean {
  return invoice.e_document_id != null && !!invoice.e_document_type;
}

/** Açık (ödenmemiş) fatura satırı; e-belgesi varsa PDF açılır */
export function InvoiceRow({
  invoice,
  loading,
  onOpenPdf,
}: {
  invoice: CariInvoice;
  loading?: boolean;
  onOpenPdf?: (invoice: CariInvoice) => void;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const status = invoiceStatus(invoice.payment_status);
  const pdf = hasInvoicePdf(invoice) && !!onOpenPdf;
  const remaining = formatCurrency(invoice.remaining_in_trl);

  const body = (
    <>
      <View style={styles.main}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          Fatura #{invoice.parasut_invoice_id}
        </AppText>
        <AppText variant="caption" color="textTertiary">
          Vade: {formatDate(invoice.due_date)}
        </AppText>
        <AppBadge label={status.label} tone={status.tone} size="sm" />
      </View>
      <View style={styles.side}>
        <AppText variant="numeric">{remaining}</AppText>
        <AppText variant="caption" color="textTertiary">
          kalan
        </AppText>
        {pdf ? (
          <View style={styles.pdf}>
            {loading ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <AppIcon name="file-text" size={14} color="primary" />
            )}
            <AppText variant="caption" color="primary">
              PDF
            </AppText>
          </View>
        ) : (
          <AppText variant="caption" color="textTertiary">
            e-belge yok
          </AppText>
        )}
      </View>
    </>
  );

  if (!pdf) {
    return (
      <View style={styles.row} testID={`invoice-${invoice.id}`}>
        {body}
      </View>
    );
  }
  return (
    <Pressable
      testID={`invoice-${invoice.id}`}
      onPress={() => onOpenPdf?.(invoice)}
      disabled={loading}
      accessibilityRole="button"
      accessibilityLabel={`Fatura ${invoice.parasut_invoice_id}, ${status.label}, kalan ${remaining}`}
      accessibilityHint="Fatura PDF'ini açar"
      accessibilityState={{ busy: !!loading }}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      {body}
    </Pressable>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: t.spacing.md,
      padding: t.layout.cardPadding,
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.md,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.colors.border,
      minHeight: t.layout.minTouchTarget,
    },
    pressed: { backgroundColor: t.colors.surfacePressed },
    main: { flex: 1, gap: t.spacing.xs },
    side: { alignItems: "flex-end", gap: 2 },
    pdf: { flexDirection: "row", alignItems: "center", gap: t.spacing.xs, marginTop: t.spacing.xs },
  })
);
