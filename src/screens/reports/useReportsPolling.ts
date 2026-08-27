import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { reportsApi } from "@/api/reports";
import { normalizeReportStatus } from "@/types/reports";

const POLL_INTERVAL_MS = 4000;

/**
 * Rapor listesinde "pending" veya "running" durumundaki job'lar varsa
 * belirli aralıklarla listeyi yeniden çeker (dokümandaki polling akışı).
 */
export function useReportsPolling(hasActiveJobs: boolean) {
  const queryClient = useQueryClient();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (hasActiveJobs && !intervalRef.current) {
      intervalRef.current = setInterval(() => {
        queryClient.invalidateQueries({ queryKey: ["reports"] });
      }, POLL_INTERVAL_MS);
    }
    if (!hasActiveJobs && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [hasActiveJobs, queryClient]);
}

export function jobIsActive(status: string): boolean {
  const s = normalizeReportStatus(status);
  return s === "pending" || s === "running";
}
