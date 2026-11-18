import { useCallback, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import * as Sharing from "expo-sharing";
import { toast } from "@/design-system";
import { errorMessage } from "@/api/client";
import { reportsApi } from "@/api/reports";
import { queryKeys } from "@/api/queryKeys";
import { XLSX_MIME, type ReportJob } from "@/types/reports";

export type ReportConfirm = { kind: "cancel" | "delete"; job: ReportJob } | null;

/**
 * Rapor işlemleri: indir + paylaş, iptal, tekrar dene (YENİ job), sil.
 * Hepsi useMutation; başarıda `queryKeys.reports.all` invalidate edilir.
 */
export function useReportActions(opts: { onRetried?: (job: ReportJob) => void; onDeleted?: (id: number) => void } = {}) {
  const queryClient = useQueryClient();
  const { onRetried, onDeleted } = opts;
  const [progress, setProgress] = useState<{ jobId: number; ratio: number | null } | null>(null);
  const [downloadError, setDownloadError] = useState<{ jobId: number; message: string } | null>(null);
  const [confirm, setConfirm] = useState<ReportConfirm>(null);

  const invalidate = useCallback(() => queryClient.invalidateQueries({ queryKey: queryKeys.reports.all }), [queryClient]);

  const download = useMutation({
    mutationFn: async (job: ReportJob) => {
      setDownloadError(null);
      setProgress({ jobId: job.id, ratio: null });
      return reportsApi.download(job, { onProgress: (p) => setProgress({ jobId: job.id, ratio: p.ratio }) });
    },
    onSuccess: async (res) => {
      invalidate(); // download_count arttı
      try {
        if (!(await Sharing.isAvailableAsync())) {
          toast.info(`Dosya indirildi (${res.fileName}) ancak bu cihazda paylaşım desteklenmiyor.`);
          return;
        }
        await Sharing.shareAsync(res.uri, {
          mimeType: XLSX_MIME,
          UTI: "org.openxmlformats.spreadsheetml.sheet",
          dialogTitle: res.fileName,
        });
      } catch (e) {
        toast.error(errorMessage(e, "Dosya paylaşılamadı."));
      }
    },
    onError: (e, job) => {
      const message = errorMessage(e, "Rapor indirilemedi.");
      setDownloadError({ jobId: job.id, message });
      toast.error(message);
    },
    onSettled: () => setProgress(null),
  });

  const cancel = useMutation({
    mutationFn: (id: number) => reportsApi.cancel(id),
    onSuccess: () => {
      toast.success("Rapor iptal edildi.");
      setConfirm(null);
    },
    onError: (e) => toast.error(errorMessage(e, "Rapor iptal edilemedi.")),
    onSettled: invalidate,
  });

  const retry = useMutation({
    mutationFn: (id: number) => reportsApi.retry(id),
    onSuccess: (job) => {
      toast.success("Rapor yeniden kuyruğa alındı.");
      onRetried?.(job);
    },
    // 429: başka aktif iş var — backend mesajı gösterilir
    onError: (e) => toast.error(errorMessage(e, "Rapor yeniden başlatılamadı.")),
    onSettled: invalidate,
  });

  const remove = useMutation({
    mutationFn: (id: number) => reportsApi.remove(id),
    onSuccess: (_, id) => {
      toast.success("Rapor silindi.");
      setConfirm(null);
      queryClient.removeQueries({ queryKey: queryKeys.reports.detail(id) });
      onDeleted?.(id);
    },
    onError: (e) => toast.error(errorMessage(e, "Rapor silinemedi.")),
    onSettled: invalidate,
  });

  return {
    download,
    cancel,
    retry,
    remove,
    progress,
    downloadError,
    confirm,
    askCancel: (job: ReportJob) => setConfirm({ kind: "cancel", job }),
    askDelete: (job: ReportJob) => setConfirm({ kind: "delete", job }),
    closeConfirm: () => setConfirm(null),
  };
}

export type ReportActions = ReturnType<typeof useReportActions>;
