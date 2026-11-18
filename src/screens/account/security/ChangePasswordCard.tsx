import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation } from "@tanstack/react-query";
import { AppButton, AppCard, AppInput, AppNotice, makeStyles, toast } from "@/design-system";
import { authApi } from "@/api/auth";
import { PASSWORD_MIN_LENGTH, validatePassword } from "@/utils/validation";
import { splitApiError } from "@/components/account/formErrors";

type Field = "current_password" | "new_password" | "confirm";
const SERVER_FIELDS = ["current_password", "new_password"] as const;

export function validatePasswordChange(current: string, next: string, confirm: string): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  if (!current) errors.current_password = "Mevcut şifrenizi girin.";
  const nextError = validatePassword(next);
  if (nextError) errors.new_password = nextError;
  else if (current && next === current) errors.new_password = "Yeni şifre mevcut şifreden farklı olmalı.";
  if (!confirm) errors.confirm = "Yeni şifreyi tekrar girin.";
  else if (confirm !== next) errors.confirm = "Şifreler eşleşmiyor.";
  return errors;
}

/** POST auth/change-password/ — backend tüm diğer oturumları sonlandırır (views/auth.py:353-362) */
export function ChangePasswordCard() {
  const styles = useStyles();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const mutation = useMutation({
    mutationFn: () => authApi.changePassword(current, next),
    onSuccess: () => {
      setCurrent("");
      setNext("");
      setConfirm("");
      setErrors({});
      setDone(true);
      toast.success("Şifreniz güncellendi.");
    },
    onError: (error) => {
      const { fieldErrors, general } = splitApiError(error, SERVER_FIELDS);
      setErrors(fieldErrors);
      setGeneralError(general);
    },
  });

  const clear = (field: Field) => {
    if (errors[field]) setErrors((e) => ({ ...e, [field]: undefined }));
    if (done) setDone(false);
  };

  const submit = () => {
    const local = validatePasswordChange(current, next, confirm);
    setErrors(local);
    setGeneralError(null);
    if (Object.keys(local).length > 0) return;
    mutation.mutate();
  };

  return (
    <AppCard testID="change-password-card">
      <View style={styles.form}>
        <AppInput
          label="Mevcut şifre"
          value={current}
          onChangeText={(v) => {
            setCurrent(v);
            clear("current_password");
          }}
          secure
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="current-password"
          textContentType="password"
          error={errors.current_password}
          testID="input-current-password"
        />
        <AppInput
          label="Yeni şifre"
          value={next}
          onChangeText={(v) => {
            setNext(v);
            clear("new_password");
          }}
          secure
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          helper={`En az ${PASSWORD_MIN_LENGTH} karakter; yalnızca rakamlardan oluşamaz.`}
          error={errors.new_password}
          testID="input-new-password"
        />
        <AppInput
          label="Yeni şifre (tekrar)"
          value={confirm}
          onChangeText={(v) => {
            setConfirm(v);
            clear("confirm");
          }}
          secure
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="new-password"
          textContentType="newPassword"
          returnKeyType="done"
          onSubmitEditing={submit}
          error={errors.confirm}
          testID="input-confirm-password"
        />
        {done ? (
          <AppNotice tone="success" title="Şifre güncellendi" message="Diğer cihazlarda yeni şifrenizle tekrar giriş yapmanız gerekir." />
        ) : (
          <AppNotice
            tone="info"
            message="Şifreniz değiştiğinde diğer cihazlardaki tüm oturumlarınız kapatılır; bu cihazda oturumunuz açık kalır."
          />
        )}
        {generalError ? <AppNotice tone="danger" title="Şifre değiştirilemedi" message={generalError} /> : null}
        <AppButton title="Şifreyi güncelle" onPress={submit} loading={mutation.isPending} testID="change-password-submit" />
      </View>
    </AppCard>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    form: { gap: t.spacing.lg },
  })
);
