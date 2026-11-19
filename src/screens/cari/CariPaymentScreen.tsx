/**
 * Uygulama içi cari ödeme — web cari ödeme sayfasıyla aynı çekirdek (`POST cari/pay/` → start_cari_payment).
 *
 * Akış: tutar + kart bilgisi → sunucu sağlayıcıyı (QNBpay / Paynkolay) çağırır ve bankanın 3D Secure formunu
 * döner → form uygulama içi web görünümünde açılır, müşteri bankanın SMS doğrulamasını yapar → banka
 * sunucunun dönüş sayfasına gelir (sonuç orada sağlayıcıdan doğrulanır, Paraşüt'e işlenir) → uygulama
 * sonucu `cari/payments/<ref>/` ile sorgular.
 *
 * Güvenlik: kart bilgisi yalnız bellekte; gönderimden sonra numara ve CVV silinir, hiçbir yere yazılmaz/loglanmaz.
 * İstek otomatik tekrarlanmaz (çift ödeme riski) ve tek uçuşla korunur.
 */
import React, { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { WebView, type WebViewNavigation } from "react-native-webview";
import { useNavigation } from "@react-navigation/native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AppButton,
  AppCard,
  AppIcon,
  AppInput,
  AppNotice,
  AppScreen,
  AppSkeleton,
  AppText,
  makeStyles,
  useTheme,
} from "@/design-system";
import { accountApi } from "@/api/account";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { API_BASE_URL } from "@/config/env";
import { useSingleFlight } from "@/hooks/useSingleFlight";
import { formatCurrency } from "@/utils/number";
import {
  amountInputTr,
  digitsOnly,
  formatCardNumber,
  formatExpiry,
  parseAmountTr,
  parseExpiry,
  validateCardForm,
  type CardForm,
} from "./card";

/** Bankanın dönüş sayfası (sunucuda sonuç işlenir): /cari-odeme/success/ | /cari-odeme/fail/ */
export const RETURN_URL_RE = /\/cari-odeme\/(success|fail)\/?/;
const STATUS_POLL_MS = 2000;
const STATUS_POLL_MAX_MS = 45_000;

type Phase = { kind: "form" } | { kind: "3d"; html: string; ref: string } | { kind: "result"; ref: string; cancelled?: boolean };

export default function CariPaymentScreen() {
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const summary = useQuery({
    queryKey: queryKeys.account.cariSummary(),
    queryFn: ({ signal }) => accountApi.cariSummary(signal),
  });
  const [phase, setPhase] = useState<Phase>({ kind: "form" });

  const finish = () => {
    // Borç ve kilit durumu yeniden alınır (Paraşüt işleyince güncellenir)
    queryClient.invalidateQueries({ queryKey: queryKeys.account.cariSummary() });
    queryClient.invalidateQueries({ queryKey: queryKeys.appConfig() });
    navigation.goBack();
  };

  if (phase.kind === "3d") {
    return (
      <BankVerification
        html={phase.html}
        onReturned={() => setPhase({ kind: "result", ref: phase.ref })}
        onCancel={() => setPhase({ kind: "result", ref: phase.ref, cancelled: true })}
      />
    );
  }
  if (phase.kind === "result") {
    return <PaymentResult refCode={phase.ref} cancelled={phase.cancelled} onDone={finish} onRetry={() => setPhase({ kind: "form" })} />;
  }
  const total = summary.data ? Number(summary.data.all_total) || 0 : null;
  return (
    <PaymentForm
      total={total}
      loading={summary.isLoading}
      loadError={summary.isError ? errorMessage(summary.error, "Cari bilgisi alınamadı.") : null}
      onRetryLoad={() => summary.refetch()}
      onStarted={(html, ref) => setPhase({ kind: "3d", html, ref })}
      onDirectResult={(ref) => setPhase({ kind: "result", ref })}
    />
  );
}

function PaymentForm({
  total,
  loading,
  loadError,
  onRetryLoad,
  onStarted,
  onDirectResult,
}: {
  total: number | null;
  loading: boolean;
  loadError: string | null;
  onRetryLoad: () => void;
  onStarted: (html: string, ref: string) => void;
  onDirectResult: (ref: string) => void;
}) {
  const styles = useStyles();
  const [form, setForm] = useState<CardForm>({ amount: "", holder: "", number: "", expiry: "", cvv: "" });
  const [touchedAmount, setTouchedAmount] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof CardForm, string>>>({});
  const amountValue = touchedAmount ? form.amount : total != null ? amountInputTr(total) : "";
  const set = (k: keyof CardForm, v: string) => {
    setForm((f) => ({ ...f, [k]: v }));
    if (errors[k]) setErrors((e) => ({ ...e, [k]: undefined }));
  };

  const pay = useMutation({
    mutationFn: () => {
      const exp = parseExpiry(form.expiry)!;
      return accountApi.cariPay({
        amount: amountInputTr(parseAmountTr(amountValue)),
        card_number: digitsOnly(form.number),
        card_holder_name: form.holder.trim(),
        month: exp.month,
        year: exp.year,
        cvv: form.cvv,
      });
    },
    onSettled: () => {
      // Kart numarası ve CVV bellekte tutulmaz
      setForm((f) => ({ ...f, number: "", cvv: "" }));
    },
    onSuccess: (res) => {
      if (res.bank_html && res.client_ref_code) onStarted(res.bank_html, res.client_ref_code);
      else if (res.client_ref_code) onDirectResult(res.client_ref_code);
    },
  });
  const send = useSingleFlight(pay.mutateAsync);

  const submit = () => {
    const e = validateCardForm({ ...form, amount: amountValue }, total ?? 0);
    setErrors(e);
    if (Object.keys(e).length === 0) send();
  };

  if (loading) {
    return (
      <AppScreen scroll testID="cari-pay">
        <AppSkeleton height={120} radius={16} />
      </AppScreen>
    );
  }
  if (loadError || total == null) {
    return (
      <AppScreen scroll testID="cari-pay">
        <AppNotice tone="danger" title="Ödeme bilgisi alınamadı" message={loadError ?? "Tekrar deneyin."} />
        <AppButton title="Tekrar dene" variant="outline" onPress={onRetryLoad} />
      </AppScreen>
    );
  }
  if (total <= 0) {
    return (
      <AppScreen scroll testID="cari-pay">
        <AppNotice tone="success" title="Ödenecek borç yok" message="Cari hesabınızda açık borç bulunmuyor." />
      </AppScreen>
    );
  }

  return (
    <AppScreen
      scroll
      keyboardShouldPersistTaps="handled"
      testID="cari-pay"
    >
      <AppCard>
        <AppText variant="caption" color="textSecondary">
          Toplam borç
        </AppText>
        <AppText variant="metricLg" testID="cari-pay-total">
          {formatCurrency(total)}
        </AppText>
      </AppCard>

      <View style={styles.form}>
        <AppInput
          label="Ödenecek tutar (₺)"
          value={amountValue}
          onChangeText={(v) => {
            setTouchedAmount(true);
            set("amount", v);
          }}
          keyboardType="decimal-pad"
          error={errors.amount}
          helper="Kısmi ödeme yapabilirsiniz."
          testID="cari-pay-amount"
        />
        <AppInput
          label="Kart üzerindeki ad soyad"
          value={form.holder}
          onChangeText={(v) => set("holder", v)}
          autoCapitalize="characters"
          autoCorrect={false}
          autoComplete="cc-name"
          textContentType="name"
          error={errors.holder}
          testID="cari-pay-holder"
        />
        <AppInput
          label="Kart numarası"
          value={formatCardNumber(form.number)}
          onChangeText={(v) => set("number", digitsOnly(v))}
          keyboardType="number-pad"
          autoComplete="cc-number"
          textContentType="creditCardNumber"
          maxLength={19}
          icon="credit-card"
          error={errors.number}
          testID="cari-pay-number"
        />
        <View style={styles.row}>
          <View style={styles.flex}>
            <AppInput
              label="Son kullanma (AA/YY)"
              value={formatExpiry(form.expiry)}
              onChangeText={(v) => set("expiry", digitsOnly(v))}
              keyboardType="number-pad"
              autoComplete="cc-exp"
              maxLength={5}
              placeholder="AA/YY"
              error={errors.expiry}
              testID="cari-pay-expiry"
            />
          </View>
          <View style={styles.flex}>
            <AppInput
              label="CVV"
              value={form.cvv}
              onChangeText={(v) => set("cvv", digitsOnly(v).slice(0, 4))}
              keyboardType="number-pad"
              autoComplete="cc-csc"
              secure
              maxLength={4}
              error={errors.cvv}
              testID="cari-pay-cvv"
            />
          </View>
        </View>
        {pay.isError ? <AppNotice tone="danger" title="Ödeme başlatılamadı" message={errorMessage(pay.error)} /> : null}
        <View style={styles.payButton}>
          <AppButton
            title={pay.isPending ? "Bankaya bağlanılıyor…" : `${formatCurrency(parseAmountTr(amountValue) || 0)} öde`}
            icon="lock"
            onPress={submit}
            loading={pay.isPending}
            fullWidth
            testID="cari-pay-submit"
          />
        </View>
        <View style={styles.secure}>
          <AppIcon name="shield" size={14} color="textTertiary" />
          <AppText variant="caption" color="textTertiary" style={styles.flex}>
            Ödeme 3D Secure ile bankanızın doğrulamasıyla yapılır. Kart bilgileriniz cihazda ve sunucuda saklanmaz.
          </AppText>
        </View>
      </View>
    </AppScreen>
  );
}

/** Bankanın 3D Secure sayfası; dönüş sayfasına gelince (sunucu sonucu işledi) sonuca geçilir */
function BankVerification({ html, onReturned, onCancel }: { html: string; onReturned: () => void; onCancel: () => void }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const [returned, setReturned] = useState(false);
  const onNav = (nav: WebViewNavigation) => {
    if (!returned && !nav.loading && RETURN_URL_RE.test(nav.url)) {
      setReturned(true);
      onReturned();
    }
  };
  return (
    <View style={[styles.flex, { backgroundColor: colors.background }]} testID="cari-pay-3d">
      <View style={styles.bankBar}>
        <AppIcon name="lock" size={14} color="success" />
        <AppText variant="caption" color="textSecondary" style={styles.flex}>
          Banka doğrulaması — SMS kodunu girin
        </AppText>
        <AppButton title="Vazgeç" variant="ghost" size="sm" onPress={onCancel} testID="cari-pay-3d-cancel" />
      </View>
      <WebView
        source={{ html, baseUrl: API_BASE_URL }}
        originWhitelist={["*"]}
        onNavigationStateChange={onNav}
        javaScriptEnabled
        // Ödeme sayfası çerez/oturum dışında bir şey saklamasın
        incognito
        startInLoadingState
        style={styles.flex}
        testID="cari-pay-webview"
      />
    </View>
  );
}

/** Sonuç: sunucudaki kayıt sorgulanır (bekliyorsa kısa süre yeniden denenir) */
function PaymentResult({
  refCode,
  cancelled,
  onDone,
  onRetry,
}: {
  refCode: string;
  cancelled?: boolean;
  onDone: () => void;
  onRetry: () => void;
}) {
  const styles = useStyles();
  // Bankadan sonuç bu süre içinde gelmezse beklemeyi bırak (sonuç "netleşmedi" olarak gösterilir)
  const [timedOut, setTimedOut] = useState(false);
  useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), STATUS_POLL_MAX_MS);
    return () => clearTimeout(id);
  }, []);
  const status = useQuery({
    queryKey: ["account", "cari-payment", refCode],
    queryFn: ({ signal }) => accountApi.cariPaymentStatus(refCode, signal),
    refetchInterval: (q) => (!cancelled && !timedOut && q.state.data?.status === "pending" ? STATUS_POLL_MS : false),
  });
  const s = status.data?.status;
  const waiting = !cancelled && (status.isLoading || (s === "pending" && !timedOut));

  let icon: "check-circle" | "x-circle" | "clock" = "clock";
  let tone: "success" | "danger" | "textSecondary" = "textSecondary";
  let title = "Ödeme doğrulanıyor…";
  let message = "Bankadan sonuç bekleniyor.";
  if (!waiting) {
    if (s === "success") {
      icon = "check-circle";
      tone = "success";
      title = "Ödemeniz alındı";
      message = `${formatCurrency(status.data?.amount)} tahsil edildi.${status.data?.reference_code ? ` Referans: ${status.data.reference_code}` : ""} Borç bilginiz kısa süre içinde güncellenir.`;
    } else if (s === "failed" || cancelled) {
      icon = "x-circle";
      tone = "danger";
      title = cancelled ? "Ödeme iptal edildi" : "Ödeme tamamlanamadı";
      message = cancelled ? "Banka doğrulaması tamamlanmadı; kartınızdan çekim yapılmadı." : "Banka işlemi onaylamadı. Kart bilgilerinizi kontrol edip tekrar deneyin.";
    } else {
      title = "Sonuç henüz netleşmedi";
      message = "Bankadan sonuç gelmedi. Kartınızdan çekim yapıldıysa birkaç dakika içinde borcunuza işlenir; yapılmadıysa tekrar deneyebilirsiniz.";
    }
  }

  return (
    <AppScreen scroll testID="cari-pay-result">
      <AppCard>
        <View style={styles.result}>
          <AppIcon name={icon} size={44} color={tone} />
          <AppText variant="title" style={styles.center} testID="cari-pay-result-title">
            {title}
          </AppText>
          <AppText variant="body" color="textSecondary" style={styles.center}>
            {message}
          </AppText>
        </View>
      </AppCard>
      {!waiting ? (
        <View style={styles.form}>
          {s === "success" ? null : <AppButton title="Tekrar dene" onPress={onRetry} fullWidth testID="cari-pay-retry" />}
          <AppButton title="Tamam" variant={s === "success" ? "primary" : "outline"} onPress={onDone} fullWidth testID="cari-pay-done" />
        </View>
      ) : null}
    </AppScreen>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    form: { gap: t.spacing.md, marginTop: t.spacing.md },
    row: { flexDirection: "row", gap: t.spacing.sm },
    secure: { flexDirection: "row", gap: 6, alignItems: "flex-start" },
    payButton: { alignSelf: "stretch", marginTop: t.spacing.xs },
    bankBar: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.sm,
      paddingHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.xs,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    result: { alignItems: "center", gap: t.spacing.sm, paddingVertical: t.spacing.lg },
    center: { textAlign: "center" },
  })
);
