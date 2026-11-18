import React from "react";
import { StyleSheet, View } from "react-native";
import { makeStyles } from "../theme";
import { AppSheet } from "./AppSheet";
import { AppText } from "./AppText";
import { AppButton } from "./AppButton";
import { AppNotice } from "./AppStates";

export interface ConfirmSummaryItem {
  label: string;
  value: string;
}

export interface AppConfirmSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  /** Kritik işlemlerde kullanıcıya gösterilen işlem özeti */
  summary?: ConfirmSummaryItem[];
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
  /** Geri alınamaz işlemler için ek uyarı */
  irreversible?: boolean;
  loading?: boolean;
  error?: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Finansal/stok/silme gibi kritik işlemler için onay sayfası.
 * İşlem sürerken kapatılamaz ve onay butonu kilitlenir.
 */
export function AppConfirmSheet({
  visible,
  title,
  message,
  summary,
  confirmLabel = "Onayla",
  cancelLabel = "Vazgeç",
  destructive,
  irreversible,
  loading,
  error,
  onConfirm,
  onCancel,
}: AppConfirmSheetProps) {
  const styles = useStyles();
  return (
    <AppSheet
      visible={visible}
      onClose={onCancel}
      title={title}
      dismissible={!loading}
      footer={
        <>
          <AppButton title={cancelLabel} variant="outline" onPress={onCancel} disabled={loading} style={styles.flex} />
          <AppButton
            testID="confirm-sheet-confirm"
            title={confirmLabel}
            variant={destructive ? "danger" : "primary"}
            onPress={onConfirm}
            loading={loading}
            style={styles.flex}
          />
        </>
      }
    >
      {message ? (
        <AppText variant="body" color="textSecondary">
          {message}
        </AppText>
      ) : null}
      {summary && summary.length > 0 ? (
        <View style={styles.summary}>
          {summary.map((item, i) => (
            <View key={item.label} style={[styles.summaryRow, i < summary.length - 1 && styles.summaryBorder]}>
              <AppText variant="callout" color="textSecondary">
                {item.label}
              </AppText>
              <AppText variant="calloutStrong" style={styles.summaryValue}>
                {item.value}
              </AppText>
            </View>
          ))}
        </View>
      ) : null}
      {irreversible ? <AppNotice tone="warning" message="Bu işlem geri alınamaz." /> : null}
      {error ? <AppNotice tone="danger" title="İşlem başarısız" message={error} /> : null}
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    summary: {
      borderRadius: t.radius.sm,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surfaceMuted,
    },
    summaryRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: t.spacing.md,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm + 2,
    },
    summaryBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    summaryValue: { flexShrink: 1, textAlign: "right" },
  })
);
