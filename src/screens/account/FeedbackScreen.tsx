/**
 * Geri bildirim ve destek: kullanıcı öneri/hata/soru gönderir ve önceki bildirimlerinin durumunu görür.
 * Kayıtlar Vennex ekibine Nexus → "Mobil Geri Bildirim" ekranında düşer.
 */
import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppInput,
  AppNotice,
  AppScreen,
  AppSection,
  AppSegmented,
  AppSkeleton,
  AppText,
  makeStyles,
  toast,
  type StatusTone,
} from "@/design-system";
import { errorMessage, type ApiError } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { FEEDBACK_CATEGORIES, FEEDBACK_MAX, FEEDBACK_MIN, feedbackApi, type FeedbackCategory } from "@/api/feedback";
import { formatDateTime } from "@/utils/date";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";

const STATUS_TONES: Record<string, StatusTone> = {
  new: "info",
  read: "neutral",
  in_progress: "warning",
  resolved: "success",
  spam: "neutral",
};

export default function FeedbackScreen() {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<FeedbackCategory>("suggestion");
  const [message, setMessage] = useState("");
  const [error, setError] = useState<string | null>(null);

  const history = useQuery({ queryKey: queryKeys.feedback.list(), queryFn: ({ signal }) => feedbackApi.list(signal) });

  const send = useMutation({
    mutationFn: () => feedbackApi.send(category, message.trim()),
    onSuccess: () => {
      toast.success("Geri bildiriminiz iletildi. Teşekkürler!");
      setMessage("");
      setCategory("suggestion");
      queryClient.invalidateQueries({ queryKey: queryKeys.feedback.all });
    },
    onError: (e: ApiError) => setError(e.fieldErrors?.message ?? null),
  });

  // Yazılmış ama gönderilmemiş mesaj varken çıkış onay ister
  useUnsavedChangesGuard(message.trim().length > 0 && !send.isPending);

  const submit = () => {
    if (send.isPending) return;
    const text = message.trim();
    if (text.length < FEEDBACK_MIN) return setError(`En az ${FEEDBACK_MIN} karakter yazın.`);
    setError(null);
    send.mutate();
  };

  const items = history.data ?? [];

  return (
    <AppScreen refreshing={history.isRefetching} onRefresh={() => history.refetch()} testID="feedback-screen">
      <AppText variant="callout" color="textSecondary">
        Öneri, hata veya sorularınızı Vennex ekibine iletin. Hesabınız ve seçili şirketiniz bildirime otomatik eklenir.
      </AppText>

      <AppCard>
        <View style={styles.form}>
          <AppSegmented<FeedbackCategory>
            items={FEEDBACK_CATEGORIES}
            value={category}
            onChange={setCategory}
            testID="feedback-category"
          />
          <AppInput
            label="Mesajınız"
            required
            multiline
            value={message}
            onChangeText={(v) => {
              setMessage(v);
              if (error) setError(null);
            }}
            maxLength={FEEDBACK_MAX}
            helper={`${message.trim().length}/${FEEDBACK_MAX}`}
            error={error}
            placeholder={category === "bug" ? "Ne yaptığınızda, hangi ekranda oldu?" : "Mesajınızı yazın"}
            testID="feedback-message"
          />
          {send.error && !error ? <AppNotice tone="danger" message={errorMessage(send.error)} /> : null}
          <AppButton title="Gönder" icon="send" onPress={submit} loading={send.isPending} fullWidth testID="feedback-submit" />
        </View>
      </AppCard>

      <AppSection title="Önceki bildirimleriniz">
        {history.isLoading ? (
          <AppSkeleton height={72} radius={12} />
        ) : history.isError ? (
          <AppNotice tone="warning" message={`Geçmiş yüklenemedi: ${errorMessage(history.error)}`} />
        ) : items.length === 0 ? (
          <AppText variant="callout" color="textTertiary" testID="feedback-empty">
            Henüz bir bildirim göndermediniz.
          </AppText>
        ) : (
          <AppCard padded={false}>
            {items.map((f, i) => (
              <View key={f.id} style={[styles.row, i < items.length - 1 && styles.rowBorder]} testID={`feedback-item-${f.id}`}>
                <View style={styles.rowHead}>
                  <AppText variant="calloutStrong">{f.category_display}</AppText>
                  <AppBadge size="sm" tone={STATUS_TONES[f.status] ?? "neutral"} label={f.status_display || "—"} />
                </View>
                <AppText variant="body" numberOfLines={3}>
                  {f.message}
                </AppText>
                <AppText variant="caption" color="textTertiary">
                  {formatDateTime(f.created_at)}
                </AppText>
              </View>
            ))}
          </AppCard>
        )}
      </AppSection>
    </AppScreen>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    form: { gap: t.spacing.lg },
    row: { padding: t.layout.cardPadding, gap: t.spacing.xs },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    rowHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: t.spacing.sm },
  })
);
