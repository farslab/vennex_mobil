import React, { useState } from "react";
import {
  Image,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuthStore } from "@/store/authStore";
import { Button } from "@/components/Common";
import { useAppTheme } from "@/theme/colors";
import { spacing, radius } from "@/theme/spacing";

export default function LoginScreen() {
  const { colors, isDark } = useAppTheme();
  const login = useAuthStore((s) => s.login);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    if (!username || !password) {
      setError("Kullanıcı adı ve şifre gerekli.");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(username, password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: colors.bg }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <Image
          source={require("../../../assets/images/vennex-logo.png")}
          style={styles.logo}
          resizeMode="contain"
        />
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Hesabınıza giriş yapın
        </Text>
      </View>

      <View style={styles.form}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
          placeholder="Kullanıcı adı veya e-posta"
          placeholderTextColor={colors.textMuted}
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
        />
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
          placeholder="Şifre"
          placeholderTextColor={colors.textMuted}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        {error && <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>}

        <Button title="Giriş Yap" onPress={handleLogin} loading={loading} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl * 7,
  },
  header: {
    marginBottom: spacing.lg,
    alignItems: "center",
  },
  logo: {
    width: 250,
    height: 150,
    resizeMode: "contain",
    marginBottom: spacing.xxl,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
  },
  subtitle: {
    fontSize: 14,
    marginTop: 0,
  },
  form: {
    gap: spacing.md,
  },
  input: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.md,
    fontSize: 15,
  },
  error: {
    fontSize: 13,
  },
});
