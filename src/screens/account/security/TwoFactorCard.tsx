import React, { useState } from "react";
import { Linking, Share, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppErrorState,
  AppNotice,
  AppSkeleton,
  AppText,
  makeStyles,
  toast,
} from "@/design-system";
import { authApi } from "@/api/auth";
import { errorMessage, type ApiError } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { OtpInput } from "@/components/OtpInput";
import { PasswordConfirmSheet } from "@/components/account/PasswordConfirmSheet";
import type { TwoFactorSetup, TwoFactorStatus } from "@/types/account";

const OTP_LENGTH = 6;

/** Base32 anahtarı okunabilir 4'lü gruplara böler */
export function formatSecret(secret: string): string {
  return secret.replace(/\s+/g, "").replace(/(.{4})/g, "$1 ").trim();
}

/**
 * İki adımlı doğrulama (TOTP): status → setup (secret + otpauth) → enable{otp} / disable{password}.
 * QR kütüphanesi bağımlılıklarda olmadığından anahtar metin olarak ve otpauth bağlantısıyla sunulur.
 */
export function TwoFactorCard() {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [otp, setOtp] = useState("");
  const [otpError, setOtpError] = useState<string | null>(null);
  const [disableOpen, setDisableOpen] = useState(false);
  const [disableError, setDisableError] = useState<{ password: string | null; general: string | null }>({
    password: null,
    general: null,
  });

  const statusQuery = useQuery({
    queryKey: queryKeys.account.twoFactorStatus(),
    queryFn: ({ signal }) => authApi.get2FAStatus(signal),
  });

  const setStatus = (is_enabled: boolean) =>
    queryClient.setQueryData<TwoFactorStatus>(queryKeys.account.twoFactorStatus(), { is_enabled });

  const setupMutation = useMutation({
    mutationFn: () => authApi.setup2FA(),
    onSuccess: (data) => {
      setSetup(data);
      setOtp("");
      setOtpError(null);
    },
    onError: (error) => {
      const body = (error as ApiError).body as { is_enabled?: boolean } | undefined;
      if (body?.is_enabled) {
        setStatus(true);
        toast.info("İki adımlı doğrulama zaten etkin.");
        return;
      }
      toast.error(errorMessage(error, "Kurulum başlatılamadı."));
    },
  });

  const enableMutation = useMutation({
    mutationFn: (code: string) => authApi.enable2FA(code),
    onSuccess: () => {
      setSetup(null);
      setOtp("");
      setStatus(true);
      toast.success("İki adımlı doğrulama etkinleştirildi.");
    },
    onError: (error) => setOtpError(errorMessage(error, "Kod doğrulanamadı.")),
  });

  const disableMutation = useMutation({
    mutationFn: (password: string) => authApi.disable2FA(password),
    onSuccess: () => {
      setDisableOpen(false);
      setStatus(false);
      toast.success("İki adımlı doğrulama kapatıldı.");
    },
    onError: (error) => {
      const status = (error as ApiError).status;
      const message = errorMessage(error, "İşlem tamamlanamadı.");
      // Backend parola hatasını {detail:"Parola hatalı."} ile 400 olarak döner
      setDisableError(status === 400 ? { password: message, general: null } : { password: null, general: message });
    },
  });

  const openInAuthenticator = async () => {
    if (!setup?.otpauth_url) return;
    try {
      await Linking.openURL(setup.otpauth_url);
    } catch {
      toast.error("Bu cihazda doğrulama uygulaması bulunamadı. Anahtarı elle girin.");
    }
  };

  const shareSecret = async () => {
    if (!setup?.secret) return;
    try {
      await Share.share({ message: setup.secret });
    } catch {
      // kullanıcı paylaşımı iptal etti
    }
  };

  const submitOtp = (code = otp) => {
    if (code.length < OTP_LENGTH) {
      setOtpError(`${OTP_LENGTH} haneli kodu girin.`);
      return;
    }
    setOtpError(null);
    enableMutation.mutate(code);
  };

  const enabled = statusQuery.data?.is_enabled === true;

  const header = (
    <View style={styles.header}>
      <View style={styles.flex}>
        <AppText variant="cardTitle">Doğrulama uygulaması</AppText>
        <AppText variant="caption" color="textTertiary">
          Girişte şifrenize ek olarak tek kullanımlık kod istenir.
        </AppText>
      </View>
      {statusQuery.data ? (
        <AppBadge label={enabled ? "Etkin" : "Kapalı"} tone={enabled ? "success" : "neutral"} dot />
      ) : null}
    </View>
  );

  if (statusQuery.isLoading) {
    return (
      <AppCard>
        {header}
        <AppSkeleton height={36} />
      </AppCard>
    );
  }

  if (statusQuery.isError) {
    return (
      <AppCard>
        {header}
        <AppErrorState
          compact
          message={errorMessage(statusQuery.error, "Durum alınamadı.")}
          onRetry={() => statusQuery.refetch()}
          retrying={statusQuery.isFetching}
        />
      </AppCard>
    );
  }

  return (
    <AppCard testID="two-factor-card">
      {header}
      {enabled ? (
        <View style={styles.body}>
          <AppText variant="callout" color="textSecondary">
            Hesabınız iki adımlı doğrulama ile korunuyor.
          </AppText>
          <AppButton
            title="Devre dışı bırak"
            variant="dangerOutline"
            onPress={() => {
              setDisableError({ password: null, general: null });
              setDisableOpen(true);
            }}
            testID="two-factor-disable"
          />
        </View>
      ) : setup ? (
        <View style={styles.body}>
          <View style={styles.step}>
            <AppText variant="overline" color="textTertiary">
              Adım 1 / 2
            </AppText>
            <AppText variant="bodyStrong">Doğrulama uygulamanıza ekleyin</AppText>
            <AppText variant="callout" color="textSecondary">
              Google Authenticator, Microsoft Authenticator veya benzeri bir uygulamada yeni hesap ekleyin. Bu cihazdaysa
              doğrudan açabilir, değilse anahtarı elle girebilirsiniz.
            </AppText>
            {setup.otpauth_url ? (
              <AppButton
                title="Doğrulama uygulamasında aç"
                icon="external-link"
                variant="secondary"
                onPress={openInAuthenticator}
                testID="two-factor-open-app"
              />
            ) : null}
            <View style={styles.secretBox} accessible accessibilityLabel={`Kurulum anahtarı: ${setup.secret}`}>
              <AppText variant="caption" color="textTertiary">
                Kurulum anahtarı
              </AppText>
              <AppText variant="mono" selectable testID="two-factor-secret">
                {formatSecret(setup.secret)}
              </AppText>
            </View>
            <AppButton title="Anahtarı paylaş / kopyala" icon="share" variant="outline" size="sm" onPress={shareSecret} />
          </View>

          <View style={styles.step}>
            <AppText variant="overline" color="textTertiary">
              Adım 2 / 2
            </AppText>
            <AppText variant="bodyStrong">Uygulamadaki kodu girin</AppText>
            <OtpInput
              value={otp}
              onChange={(v) => {
                setOtp(v);
                if (otpError) setOtpError(null);
              }}
              length={OTP_LENGTH}
              error={!!otpError}
              testID="two-factor-otp"
            />
            {otpError ? <AppNotice tone="danger" message={otpError} /> : null}
          </View>

          <View style={styles.actions}>
            <AppButton
              title="Vazgeç"
              variant="ghost"
              onPress={() => setSetup(null)}
              disabled={enableMutation.isPending}
              style={styles.flex}
            />
            <AppButton
              title="Etkinleştir"
              onPress={() => submitOtp()}
              loading={enableMutation.isPending}
              disabled={otp.length < OTP_LENGTH}
              style={styles.flex}
              testID="two-factor-enable"
            />
          </View>
        </View>
      ) : (
        <View style={styles.body}>
          <AppText variant="callout" color="textSecondary">
            Şifreniz ele geçirilse bile hesabınıza erişilmesini engellemek için iki adımlı doğrulamayı açın.
          </AppText>
          <AppButton
            title="Kurulumu başlat"
            icon="shield"
            onPress={() => setupMutation.mutate()}
            loading={setupMutation.isPending}
            testID="two-factor-setup"
          />
        </View>
      )}

      <PasswordConfirmSheet
        visible={disableOpen}
        title="İki adımlı doğrulamayı kapat"
        message="Kapatıldığında girişte yalnızca şifreniz istenir. Devam etmek için parolanızı doğrulayın."
        confirmLabel="Devre dışı bırak"
        destructive
        loading={disableMutation.isPending}
        passwordError={disableError.password}
        error={disableError.general}
        onConfirm={(password) => {
          setDisableError({ password: null, general: null });
          disableMutation.mutate(password);
        }}
        onCancel={() => setDisableOpen(false)}
      />
    </AppCard>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    header: { flexDirection: "row", alignItems: "flex-start", gap: t.spacing.md, marginBottom: t.spacing.md },
    flex: { flex: 1 },
    body: { gap: t.spacing.lg },
    step: { gap: t.spacing.sm },
    secretBox: {
      gap: t.spacing.xs,
      padding: t.spacing.md,
      borderRadius: t.radius.sm,
      backgroundColor: t.colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.colors.border,
    },
    actions: { flexDirection: "row", gap: t.spacing.md },
  })
);
