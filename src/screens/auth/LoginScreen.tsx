import React, { useRef, useState } from "react";
import type { TextInput } from "react-native";
import { AppButton, AppInput, AppNotice, AppText } from "@/design-system";
import { useAuthStore } from "@/store/authStore";
import { AuthLayout } from "./AuthLayout";

export default function LoginScreen() {
  const login = useAuthStore((s) => s.login);
  const sessionMessage = useAuthStore((s) => s.errorMessage);
  const clearError = useAuthStore((s) => s.clearError);
  const passwordRef = useRef<TextInput>(null);

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<{ username?: string; password?: string }>({});

  const handleLogin = async () => {
    if (loading) return;
    const next = {
      username: username.trim() ? undefined : "Kullanıcı adı veya e-posta gerekli.",
      password: password ? undefined : "Şifre gerekli.",
    };
    setFieldErrors(next);
    if (next.username || next.password) return;

    setError(null);
    clearError();
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  };

  const banner = error ?? sessionMessage;

  return (
    <AuthLayout
      title="Hesabınıza giriş yapın"
      subtitle="Cihaz filonuzu, kartlarınızı ve stoklarınızı tek yerden yönetin."
      footer={
        <AppText variant="caption" color="textTertiary" align="center">
          Vennex Payment Systems
        </AppText>
      }
    >
      {banner ? <AppNotice tone="danger" message={banner} /> : null}
      <AppInput
        label="Kullanıcı adı veya e-posta"
        placeholder="kullanici.adi"
        icon="user"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="username"
        textContentType="username"
        returnKeyType="next"
        value={username}
        onChangeText={(v) => {
          setUsername(v);
          if (fieldErrors.username) setFieldErrors((f) => ({ ...f, username: undefined }));
        }}
        onSubmitEditing={() => passwordRef.current?.focus()}
        error={fieldErrors.username}
        testID="login-username"
      />
      <AppInput
        ref={passwordRef}
        label="Şifre"
        placeholder="••••••••"
        icon="lock"
        secure
        autoComplete="password"
        textContentType="password"
        returnKeyType="go"
        value={password}
        onChangeText={(v) => {
          setPassword(v);
          if (fieldErrors.password) setFieldErrors((f) => ({ ...f, password: undefined }));
        }}
        onSubmitEditing={handleLogin}
        error={fieldErrors.password}
        testID="login-password"
      />
      <AppButton title="Giriş Yap" onPress={handleLogin} loading={loading} fullWidth testID="login-submit" />
      {/* Kendi kendine parola sıfırlama yok (web paneliyle aynı): parolayı şirket sahibi / Vennex desteği yeniler */}
      <AppText variant="caption" color="textTertiary" align="center" testID="login-forgot-hint">
        Şifrenizi unuttuysanız şirket yöneticinize veya Vennex desteğine başvurun.
      </AppText>
    </AuthLayout>
  );
}
