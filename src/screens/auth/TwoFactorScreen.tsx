import React, { useState } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/Common";
import { useAppTheme } from "@/theme/colors";
import { spacing, radius } from "@/theme/spacing";

export default function TwoFactorScreen() {
  const { colors, isDark } = useAppTheme();
  const verify2FA = useAuthStore((s) => s.verify2FA);
  const attemptsLeft = useAuthStore((s) => s.attemptsLeft);
  const errorMessage = useAuthStore((s) => s.errorMessage);
  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (otp.length !== 6) return;
    setLoading(true);
    try {
      await verify2FA(otp);
    } finally {
      setLoading(false);
      setOtp("");
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <Text style={[styles.title, { color: colors.textPrimary }]}>Doğrulama Kodu</Text>
      <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
        Kimlik doğrulama uygulamanızdaki 6 haneli kodu girin.
      </Text>

      <TextInput
        style={[
          styles.otpInput,
          {
            backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
            borderColor: colors.border,
            color: colors.textPrimary,
          },
        ]}
        placeholder="000000"
        placeholderTextColor={colors.textMuted}
        keyboardType="number-pad"
        maxLength={6}
        value={otp}
        onChangeText={setOtp}
        autoFocus
      />

      {errorMessage && <Text style={[styles.error, { color: colors.danger }]}>{errorMessage}</Text>}
      {attemptsLeft != null && (
        <Text style={[styles.hint, { color: colors.textMuted }]}>
          Kalan deneme hakkı: {attemptsLeft}
        </Text>
      )}

      <View style={{ marginTop: spacing.lg }}>
        <Button title="Doğrula" onPress={handleVerify} loading={loading} disabled={otp.length !== 6} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: spacing.xl,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14,
    textAlign: "center",
    marginTop: spacing.sm,
    marginBottom: spacing.xl,
  },
  otpInput: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingVertical: spacing.md,
    fontSize: 28,
    textAlign: "center",
    letterSpacing: 12,
  },
  error: {
    fontSize: 13,
    textAlign: "center",
    marginTop: spacing.md,
  },
  hint: {
    fontSize: 12,
    textAlign: "center",
    marginTop: spacing.xs,
  },
});