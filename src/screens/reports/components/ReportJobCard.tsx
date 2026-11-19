import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppBadge, AppButton, AppConfirmSheet, AppIconButton, AppText, makeStyles, type StatusTone } from "@/design-system";
import { formatDateTime, parseApiDate } from "@/utils/date";
import { formatInteger, formatPercent } from "@/utils/number";
import { normalizeReportStatus, type ReportJob } from "@/types/reports";
import { jobIsActive } from "../useReportsPolling";
import type { ReportActions } from "../useReportActions";

/* ------------------------------------------------------------- Helpers */

/** Saklama süresi (`expires_at`) geçti mi — sunucu temizliği saatliktir, arada dosya hâlâ görünebilir */
export function isExpired(job: Pick<ReportJob, "expires_at">, now: Date = new Date()): boolean {
  const d = parseApiDate(job.expires_at);
  return !!d && d.getTime() <= now.getTime();
}

/** Web ile aynı durum adları (`reporting/models.py` STATUS_CHOICES) */
export function reportStatusInfo(job: ReportJob): { label: string; tone: StatusTone } {
  const s = normalizeReportStatus(job.status);
  switch (s) {
    case "pending":
      return { label: "Sıraya alındı", tone: "neutral" };
    case "running":
      return { label: "Hazırlanıyor", tone: "info" };
    case "completed":
      if (!job.is_downloadable) return { label: "Dosya yok", tone: "neutral" };
      return isExpired(job) ? { label: "Süresi doldu", tone: "neutral" } : { label: "Hazır", tone: "success" };
    case "failed":
      return { label: "Başarısız", tone: "danger" };
    case "cancelled":
      return { label: "İptal edildi", tone: "neutral" };
  }
}

export function formatBytes(bytes: number | null | undefined): string | null {
  if (bytes == null || !Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toLocaleString("tr-TR", { maximumFractionDigits: 0 })} KB`;
  return `${(kb / 1024).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} MB`;
}

/** "23 sa içinde silinecek" — saklama süresi (`expires_at`) */
export function formatExpiry(expiresAt: string | null, now: Date = new Date()): string | null {
  const d = parseApiDate(expiresAt);
  if (!d) return null;
  const min = Math.round((d.getTime() - now.getTime()) / 60_000);
  if (min <= 0) return "Saklama süresi doldu";
  if (min < 60) return `${min} dk içinde silinecek`;
  const h = Math.floor(min / 60);
  if (h < 48) return `${h} sa içinde silinecek`;
  return `${Math.floor(h / 24)} gün içinde silinecek`;
}

/** Web: tamamlanan ve başarısız raporlar yeniden üretilebilir; iptal edilen yalnız silinir */
export function canRetry(job: ReportJob): boolean {
  const s = normalizeReportStatus(job.status);
  return !jobIsActive(job) && (s === "failed" || s === "completed");
}

export function canDownload(job: ReportJob): boolean {
  return normalizeReportStatus(job.status) === "completed" && job.is_downloadable && !isExpired(job);
}

/* ---------------------------------------------------------------- Card */

export interface ReportJobCardProps {
  job: ReportJob;
  typeLabel: string;
  actions: ReportActions;
  /** Başka bir aktif iş varken yeni iş başlatılamaz (backend 429) */
  anotherActive: boolean;
  onPress?: () => void;
  /** Detay ekranında kart başlığı tıklanmaz ve daha fazla bilgi gösterilir */
  detailed?: boolean;
}

export function ReportJobCard({ job, typeLabel, actions, anotherActive, onPress, detailed }: ReportJobCardProps) {
  const styles = useStyles();
  const status = reportStatusInfo(job);
  const s = normalizeReportStatus(job.status);
  const active = jobIsActive(job);
  const title = job.custom_name || typeLabel;
  const pct = Math.max(0, Math.min(100, job.progress_pct ?? 0));
  const downloading = actions.progress?.jobId === job.id;
  const dlRatio = downloading ? actions.progress?.ratio ?? null : null;
  const dlError = actions.downloadError?.jobId === job.id ? actions.downloadError.message : null;

  const meta: string[] = [];
  if (job.custom_name) meta.push(typeLabel);
  meta.push(formatDateTime(job.created_at));

  // Web: satır/boyut yalnız tamamlanan raporda; tahmin yalnız hazırlanırken (eski/0 tahmin gösterilmez)
  const facts: string[] = [];
  if (s === "completed" && job.row_count != null) facts.push(`${formatInteger(job.row_count)} satır`);
  else if (s === "running" && job.estimated_rows) facts.push(`~${formatInteger(job.estimated_rows)} satır`);
  const size = s === "completed" ? formatBytes(job.file_size_bytes) : null;
  if (size) facts.push(size);
  if (canDownload(job)) {
    const exp = formatExpiry(job.expires_at);
    if (exp) facts.push(exp);
  }

  const header = (
    <View style={styles.header}>
      <View style={styles.flex}>
        <AppText variant="cardTitle" numberOfLines={2}>
          {title}
        </AppText>
        <AppText variant="caption" color="textTertiary" numberOfLines={1}>
          {meta.join(" · ")}
        </AppText>
      </View>
      <AppBadge label={status.label} tone={status.tone} dot />
    </View>
  );

  return (
    <View style={styles.card} testID={`report-job-${job.id}`}>
      {onPress && !detailed ? (
        <Pressable
          onPress={onPress}
          accessibilityRole="button"
          accessibilityLabel={`${title}, ${status.label}`}
          accessibilityHint="Rapor ayrıntılarını açar"
          style={({ pressed }) => [styles.pressArea, pressed && styles.pressed]}
        >
          {header}
        </Pressable>
      ) : (
        <View style={styles.pressArea}>{header}</View>
      )}

      <View style={styles.body}>
        {active ? (
          <View style={styles.progressBlock} accessible accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${s === "pending" ? 0 : pct}%` }]} />
            </View>
            <AppText variant="caption" color="textSecondary">
              {s === "pending" ? "Sırada bekliyor" : `${formatPercent(pct, 0)} tamamlandı`}
            </AppText>
          </View>
        ) : null}

        {facts.length ? (
          <AppText variant="caption" color="textSecondary">
            {facts.join(" · ")}
          </AppText>
        ) : null}

        {s === "failed" && job.error_message ? (
          <AppText variant="caption" color="danger" numberOfLines={detailed ? undefined : 3}>
            {job.error_message}
          </AppText>
        ) : null}

        {detailed && job.finished_at ? (
          <AppText variant="caption" color="textTertiary">
            Bitiş: {formatDateTime(job.finished_at)} · {formatInteger(job.download_count)} kez indirildi
          </AppText>
        ) : null}

        {downloading ? (
          <View style={styles.progressBlock} accessibilityLiveRegion="polite">
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${Math.round((dlRatio ?? 0) * 100)}%` }]} />
            </View>
            <AppText variant="caption" color="textSecondary">
              {dlRatio != null ? `İndiriliyor ${formatPercent(dlRatio * 100, 0)}` : "İndiriliyor…"}
            </AppText>
          </View>
        ) : null}

        {dlError && !downloading ? (
          <AppText variant="caption" color="danger" testID={`report-download-error-${job.id}`}>
            {dlError}
          </AppText>
        ) : null}

        <View style={styles.actions}>
          {canDownload(job) ? (
            <AppButton
              title="İndir ve paylaş"
              icon="download"
              size="sm"
              onPress={() => actions.download.mutate(job)}
              loading={downloading}
              disabled={actions.download.isPending && !downloading}
              testID={`report-download-${job.id}`}
            />
          ) : null}
          {active ? (
            <AppButton
              title="İptal et"
              icon="x-circle"
              size="sm"
              variant="outline"
              onPress={() => actions.askCancel(job)}
              testID={`report-cancel-${job.id}`}
            />
          ) : null}
          {canRetry(job) ? (
            <AppButton
              title={s === "completed" ? "Tekrar" : "Tekrar dene"}
              icon="refresh-cw"
              size="sm"
              variant="outline"
              onPress={() => actions.retry.mutate(job.id)}
              loading={actions.retry.isPending && actions.retry.variables === job.id}
              disabled={anotherActive}
              accessibilityHint={anotherActive ? "Önceki rapor bitince kullanılabilir" : undefined}
              testID={`report-retry-${job.id}`}
            />
          ) : null}
          <View style={styles.flex} />
          {!active ? (
            <AppIconButton icon="trash-2" label="Raporu sil" tone="danger" onPress={() => actions.askDelete(job)} testID={`report-delete-${job.id}`} />
          ) : null}
        </View>
      </View>
    </View>
  );
}

/** İptal / silme onay sayfaları — ekranda bir kez render edilir */
export function ReportConfirmSheets({ actions, typeLabel }: { actions: ReportActions; typeLabel: (type: string) => string }) {
  const c = actions.confirm;
  const job = c?.job;
  const summary = job
    ? [
        { label: "Rapor", value: job.custom_name || typeLabel(job.report_type) },
        { label: "Oluşturulma", value: formatDateTime(job.created_at) },
      ]
    : [];
  return (
    <>
      <AppConfirmSheet
        visible={c?.kind === "cancel"}
        title="Rapor iptal edilsin mi?"
        message="Hazırlanan rapor durdurulur. Aynı filtrelerle daha sonra tekrar deneyebilirsiniz."
        summary={summary}
        confirmLabel="İptal et"
        cancelLabel="Vazgeç"
        destructive
        loading={actions.cancel.isPending}
        onConfirm={() => job && actions.cancel.mutate(job.id)}
        onCancel={actions.closeConfirm}
      />
      <AppConfirmSheet
        visible={c?.kind === "delete"}
        title="Rapor silinsin mi?"
        message="Rapor kaydı ve dosyası sunucudan kalıcı olarak silinir."
        summary={summary}
        confirmLabel="Sil"
        destructive
        irreversible
        loading={actions.remove.isPending}
        onConfirm={() => job && actions.remove.mutate(job.id)}
        onCancel={actions.closeConfirm}
      />
    </>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    card: {
      backgroundColor: t.colors.surface,
      borderRadius: t.radius.md,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.colors.border,
      overflow: "hidden",
    },
    pressArea: { paddingHorizontal: t.layout.cardPadding, paddingTop: t.spacing.md, paddingBottom: t.spacing.sm },
    pressed: { backgroundColor: t.colors.surfacePressed },
    header: { flexDirection: "row", alignItems: "flex-start", gap: t.spacing.md },
    body: { paddingHorizontal: t.layout.cardPadding, paddingBottom: t.spacing.md, gap: t.spacing.sm },
    progressBlock: { gap: t.spacing.xs },
    track: { height: 6, borderRadius: t.radius.pill, backgroundColor: t.colors.surfaceMuted, overflow: "hidden" },
    fill: { height: "100%", borderRadius: t.radius.pill, backgroundColor: t.colors.primary },
    actions: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: t.spacing.sm, marginTop: t.spacing.xs },
  })
);
