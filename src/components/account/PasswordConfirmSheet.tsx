import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  AppButton,
  AppInput,
  AppNotice,
  AppSheet,
  AppText,
  makeStyles,
  type ConfirmSummaryItem,
} from "@/design-system";

export interface PasswordConfirmSheetProps {
  visible: boolean;
  title: string;
  message?: string;
  summary?: ConfirmSummaryItem[];
  confirmLabel: string;
  destructive?: boolean;
  irreversible?: boolean;
  loading?: boolean;
  /** Parola alanına ait hata (ör. "Parola hatalı.") */
  passwordError?: string | null;
  /** Genel hata */
  error?: string | null;
  onConfirm: (password: string) => void;
  onCancel: () => void;
  testID?: string;
}

/**
 * Parola ile onaylanan kritik işlem sayfası (hesap dondurma/silme, 2FA kapatma).
 * AppConfirmSheet ile aynı görsel dil: mesaj + işlem özeti + geri alınamaz uyarısı;
 * ek olarak parola alanı içerir. İşlem sürerken kapatılamaz.
 */
export function PasswordConfirmSheet({
  visible,
  title,
  message,
  summary,
  confirmLabel,
  destructive,
  irreversible,
  loading,
  passwordError,
  error,
  onConfirm,
  onCancel,
  testID,
}: PasswordConfirmSheetProps) {
  const styles = useStyles();
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  // Her açılışta temiz form (render sırasında durum ayarlama — effect gerektirmez)
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setPassword("");
      setLocalError(null);
    }
  }

  const submit = () => {
    if (!password) {
      setLocalError("Devam etmek için parolanızı girin.");
      return;
    }
    setLocalError(null);
    onConfirm(password);
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onCancel}
      title={title}
      dismissible={!loading}
      testID={testID}
      footer={
        <>
          <AppButton title="Vazgeç" variant="outline" onPress={onCancel} disabled={loading} style={styles.flex} />
          <AppButton
            testID="password-confirm-submit"
            title={confirmLabel}
            variant={destructive ? "danger" : "primary"}
            onPress={submit}
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
      <AppInput
        label="Parolanız"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          if (localError) setLocalError(null);
        }}
        secure
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="done"
        onSubmitEditing={submit}
        error={localError ?? passwordError}
        testID="password-confirm-input"
      />
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
