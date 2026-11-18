import React, { useState } from "react";
import { StyleSheet } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { AppButton, AppInput, AppNotice, AppSheet, AppText, makeStyles, toast, useFormDirty, useGuardedClose } from "@/design-system";
import { usersApi } from "@/api/users";
import { PASSWORD_MIN_LENGTH, validatePassword } from "@/utils/validation";
import { splitApiError } from "@/components/account/formErrors";

/** POST users/{id}/reset-password/ {new_password} — owner teknisyenin şifresini belirler */
export function ResetPasswordSheet({
  visible,
  userId,
  username,
  onClose,
}: {
  visible: boolean;
  userId: number;
  username: string;
  onClose: () => void;
}) {
  const styles = useStyles();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<{ password?: string; confirm?: string }>({});
  const [general, setGeneral] = useState<string | null>(null);
  // Kaydedilmemiş değişiklik: kapatırken onay iste
  const dirty = useFormDirty(visible, { password, confirm });
  const guardedClose = useGuardedClose(dirty, onClose);

  // Her açılışta temiz form (render sırasında durum ayarlama — effect gerektirmez)
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setPassword("");
      setConfirm("");
      setErrors({});
      setGeneral(null);
    }
  }

  const mutation = useMutation({
    mutationFn: () => usersApi.resetPassword(userId, password),
    onSuccess: () => {
      toast.success("Şifre sıfırlandı. Yeni şifreyi kullanıcıyla güvenli bir şekilde paylaşın.");
      onClose();
    },
    onError: (error) => {
      const split = splitApiError(error, ["new_password"] as const);
      setErrors({ password: split.fieldErrors.new_password });
      setGeneral(split.general);
    },
  });

  const submit = () => {
    const next: { password?: string; confirm?: string } = {};
    const pwError = validatePassword(password);
    if (pwError) next.password = pwError;
    if (!confirm) next.confirm = "Şifreyi tekrar girin.";
    else if (confirm !== password) next.confirm = "Şifreler eşleşmiyor.";
    setErrors(next);
    setGeneral(null);
    if (Object.keys(next).length === 0) mutation.mutate();
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      dirty={dirty}
      title="Şifreyi sıfırla"
      subtitle={`@${username}`}
      dismissible={!mutation.isPending}
      footer={
        <>
          <AppButton title="Vazgeç" variant="outline" onPress={guardedClose} disabled={mutation.isPending} style={styles.flex} />
          <AppButton
            title="Şifreyi sıfırla"
            onPress={submit}
            loading={mutation.isPending}
            style={styles.flex}
            testID="reset-password-submit"
          />
        </>
      }
    >
      <AppText variant="callout" color="textSecondary">
        Kullanıcının mevcut şifresi geçersiz olur. Yeni şifreyi kullanıcıya siz iletmelisiniz.
      </AppText>
      <AppInput
        label="Yeni şifre"
        value={password}
        onChangeText={setPassword}
        secure
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="new-password"
        textContentType="newPassword"
        helper={`En az ${PASSWORD_MIN_LENGTH} karakter; yalnızca rakamlardan oluşamaz.`}
        error={errors.password}
        testID="reset-password-input"
      />
      <AppInput
        label="Yeni şifre (tekrar)"
        value={confirm}
        onChangeText={setConfirm}
        secure
        autoCapitalize="none"
        autoCorrect={false}
        error={errors.confirm}
        testID="reset-password-confirm"
      />
      {general ? <AppNotice tone="danger" title="Sıfırlanamadı" message={general} /> : null}
    </AppSheet>
  );
}

const useStyles = makeStyles(() =>
  StyleSheet.create({
    flex: { flex: 1 },
  })
);
