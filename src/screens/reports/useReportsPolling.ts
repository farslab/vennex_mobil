import { useEffect, useRef } from "react";
import { normalizeReportStatus, type ReportJob } from "@/types/reports";

/** Artan aralık: 3 sn → 5 sn → 10 sn → 15 sn (üst sınır) */
export const REPORT_POLL_DELAYS_MS = [3_000, 5_000, 10_000, 15_000] as const;

export function jobIsActive(job: Pick<ReportJob, "status" | "is_active">): boolean {
  if (job.is_active) return true;
  const s = normalizeReportStatus(job.status);
  return s === "pending" || s === "running";
}

export function nextPollDelay(attempt: number): number {
  return REPORT_POLL_DELAYS_MS[Math.min(Math.max(attempt, 0), REPORT_POLL_DELAYS_MS.length - 1)];
}

/**
 * Bekleyen/çalışan iş varken ve ekran odaktayken artan aralıkla yeniden çeker.
 * - Her başarılı/başarısız yanıttan sonra bir sonraki zamanlayıcı kurulur (üst üste istek yok).
 * - Aktif iş kalmayınca, ekran odaktan çıkınca veya `enabled=false` iken durur ve aralık sıfırlanır.
 */
export function useReportsPolling({
  hasActive,
  isFocused,
  enabled = true,
  updatedAt,
  refetch,
}: {
  hasActive: boolean;
  isFocused: boolean;
  enabled?: boolean;
  /** dataUpdatedAt + errorUpdatedAt — her yanıtta değişir */
  updatedAt: number;
  refetch: () => unknown;
}) {
  const attempt = useRef(0);
  const refetchRef = useRef(refetch);
  useEffect(() => {
    refetchRef.current = refetch;
  }, [refetch]);

  const active = enabled && isFocused && hasActive;

  useEffect(() => {
    if (!active) {
      attempt.current = 0;
      return;
    }
    const delay = nextPollDelay(attempt.current);
    const timer = setTimeout(() => {
      attempt.current += 1;
      refetchRef.current();
    }, delay);
    return () => clearTimeout(timer);
  }, [active, updatedAt]);
}
