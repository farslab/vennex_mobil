import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useFocusEffect, useIsFocused } from "@react-navigation/native";
import { overviewApi } from "@/api/overview";
import type { ApiPeriod } from "@/types/common";

// Pull-to-refresh (nocache) çağrıları arasında zorunlu minimum bekleme.
const REFRESH_COOLDOWN_MS = 8000;

// Period hızlı hızlı değiştirilirse her tıklamada ayrı sorgu atılmasın diye debounce.
const PERIOD_CHANGE_DEBOUNCE_MS = 350;

// "custom" period için izin verilen maksimum aralık (gün). Bunun üzerindeki
// aralıklar backend'e hiç gönderilmez — geniş tarama sorgusu DB'yi yormasın.
const MAX_CUSTOM_RANGE_DAYS = 92;

// YYYY-MM-DD formatını doğrular (basit ama yeterli).
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// Backend cache TTL ile uyumlu otomatik yenileme süresi (ms).
const AUTO_REFETCH_INTERVAL_MS = 30_000;

export interface CustomRangeValidation {
  valid: boolean;
  error: string | null;
}

function validateCustomRange(startDate: string | null, endDate: string | null): CustomRangeValidation {
  if (!startDate || !endDate) {
    return { valid: false, error: "Başlangıç ve bitiş tarihi seçilmeli." };
  }
  if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
    return { valid: false, error: "Tarih formatı geçersiz." };
  }
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return { valid: false, error: "Tarih formatı geçersiz." };
  }
  if (start > end) {
    return { valid: false, error: "Başlangıç tarihi bitişten sonra olamaz." };
  }
  const diffDays = Math.floor((end.getTime() - start.getTime()) / 86_400_000) + 1;
  if (diffDays > MAX_CUSTOM_RANGE_DAYS) {
    return { valid: false, error: `Aralık en fazla ${MAX_CUSTOM_RANGE_DAYS} gün olabilir.` };
  }
  return { valid: true, error: null };
}

export function useDashboard() {
  const isFocused = useIsFocused();

  const [period, setPeriodState] = useState<ApiPeriod>("today");
  const [customStartDate, setCustomStartDate] = useState<string | null>(null);
  const [customEndDate, setCustomEndDate] = useState<string | null>(null);

  const nocacheRef = useRef(false);
  const lastRefreshAtRef = useRef(0);
  const periodDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const customRangeValidation = useMemo(
    () => (period === "custom" ? validateCustomRange(customStartDate, customEndDate) : { valid: true, error: null }),
    [period, customStartDate, customEndDate]
  );

  // custom değilse tarih aralığı sorguya hiç girmez; custom ise aralık
  // geçerli olmadan sorgu ATILMAZ (enabled: false).
  const isQueryEnabled = period !== "custom" || customRangeValidation.valid;

  const query = useQuery({
    queryKey: ["dashboard", period, period === "custom" ? customStartDate : null, period === "custom" ? customEndDate : null],
    queryFn: () => {
      const nocache = nocacheRef.current;
      nocacheRef.current = false;
      return overviewApi.dashboard({
        period,
        nocache,
        ...(period === "custom" && customStartDate && customEndDate
          ? { start_date: customStartDate, end_date: customEndDate }
          : {}),
      });
    },
    enabled: isQueryEnabled,
    staleTime: 15_000,
    refetchInterval: isFocused ? AUTO_REFETCH_INTERVAL_MS : false,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });

  // Ekran odağı her geri kazanıldığında veriyi tazele (tab geçişleri için)
  useFocusEffect(
    useCallback(() => {
      if (isQueryEnabled) {
        query.refetch();
      }
    }, [isQueryEnabled, query.refetch])
  );

  const setPeriod = useCallback((next: ApiPeriod) => {
    if (periodDebounceRef.current) {
      clearTimeout(periodDebounceRef.current);
    }
    periodDebounceRef.current = setTimeout(() => {
      setPeriodState(next);
      if (next !== "custom") {
        setCustomStartDate(null);
        setCustomEndDate(null);
      }
    }, PERIOD_CHANGE_DEBOUNCE_MS);
  }, []);

  // Özel tarih aralığını ayarlar. Kendi içinde de debounce'lu — kullanıcı
  // iki tarihi art arda hızlıca değiştirirse her adımda sorgu atılmaz.
  const setCustomRange = useCallback((start: string | null, end: string | null) => {
    setCustomStartDate(start);
    setCustomEndDate(end);
  }, []);

  useEffect(() => {
    return () => {
      if (periodDebounceRef.current) {
        clearTimeout(periodDebounceRef.current);
      }
    };
  }, []);

  const refresh = useCallback(() => {
    if (!isQueryEnabled) {
      // Geçersiz/eksik custom aralıkla pull-to-refresh de sorgu atmasın.
      return Promise.resolve(query);
    }

    const now = Date.now();
    const elapsed = now - lastRefreshAtRef.current;
    if (elapsed < REFRESH_COOLDOWN_MS) {
      return Promise.resolve(query);
    }

    lastRefreshAtRef.current = now;
    nocacheRef.current = true;
    return query.refetch();
  }, [query, isQueryEnabled]);

  return {
    period,
    setPeriod,
    customStartDate,
    customEndDate,
    setCustomRange,
    customRangeValidation,
    ...query,
    refresh,
  };
}