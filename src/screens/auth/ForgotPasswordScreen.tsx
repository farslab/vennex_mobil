import React, { useState } from "react";
import { useNavigation } from "@react-navigation/native";
import { AppButton, AppInput, AppNotice } from "@/design-system";
import { authApi } from "@/api/auth";
import { isValidEmail } from "@/utils/validation";
import { AuthLayout } from "./AuthLayout";

/**
 * Şifre sıfırlama talebi. Backend (PasswordResetRequestView) kayıtlı e-postaya
 * web sıfırlama bağlantısı gönderir; e-posta kayıtlı olmasa da aynı yanıtı döner
 * (hesap varlığı sızdırılmaz). Saatte 5 istek sınırı vardır.
 */
export default function ForgotPasswordScreen() {
  const navigation = useNavigation();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (loading) return;
    const value = email.trim();
    if (!isValidEmail(value)) {
      setFieldError("Geçerli bir e-posta adresi girin.");
      return;
    }
    setFieldError(null);
    setError(null);
    setLoading(true);
    try {
      const res = await authApi.passwordReset(value);
      setSent(
        (res.data as { detail?: string })?.detail ??
          "Eğer e-posta sistemde kayıtlıysa, sıfırlama bağlantısı gönderildi."
      );
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout
      title="Şifrenizi sıfırlayın"
      subtitle="Hesabınıza kayıtlı e-posta adresini girin; şifre sıfırlama bağlantısı gönderelim."
      footer={<AppButton title="Girişe dön" variant="ghost" icon="arrow-left" onPress={() => navigation.goBack()} />}
    >
      {sent ? <AppNotice tone="success" title="Talebiniz alındı" message={sent} /> : null}
      {error ? <AppNotice tone="danger" message={error} /> : null}
      <AppInput
        label="E-posta"
        placeholder="ornek@sirket.com"
        icon="mail"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        value={email}
        onChangeText={setEmail}
        onSubmitEditing={submit}
        error={fieldError}
      />
      <AppButton title="Sıfırlama bağlantısı gönder" onPress={submit} loading={loading} disabled={!!sent} fullWidth />
    </AuthLayout>
  );
}
