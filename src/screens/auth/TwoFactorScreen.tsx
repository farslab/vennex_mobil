import React, { useState } from "react";
import { AppButton, AppNotice, AppText } from "@/design-system";
import { useAuthStore } from "@/store/authStore";
import { OtpInput } from "@/components/OtpInput";
import { AuthLayout } from "./AuthLayout";

export default function TwoFactorScreen() {
  const verify2FA = useAuthStore((s) => s.verify2FA);
  const cancel2FA = useAuthStore((s) => s.cancel2FA);
  const attemptsLeft = useAuthStore((s) => s.attemptsLeft);
  const errorMessage = useAuthStore((s) => s.errorMessage);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (code = otp) => {
    if (code.length !== 6 || loading) return;
    setLoading(true);
    try {
      await verify2FA(code);
    } finally {
      setLoading(false);
      setOtp("");
    }
  };

  return (
    <AuthLayout
      title="İki adımlı doğrulama"
      subtitle="Kimlik doğrulama uygulamanızdaki 6 haneli kodu girin."
      footer={<AppButton title="Farklı hesapla giriş yap" variant="ghost" onPress={cancel2FA} />}
    >
      {errorMessage ? <AppNotice tone="danger" message={errorMessage} /> : null}
      <OtpInput value={otp} onChange={setOtp} onComplete={submit} error={!!errorMessage} autoFocus testID="otp-input" />
      {attemptsLeft != null ? (
        <AppText variant="caption" color={attemptsLeft <= 2 ? "danger" : "textTertiary"} align="center">
          Kalan deneme hakkı: {attemptsLeft}
        </AppText>
      ) : null}
      <AppButton title="Doğrula" onPress={() => submit()} loading={loading} disabled={otp.length !== 6} fullWidth />
    </AuthLayout>
  );
}
