/**
 * İşletme günü (TR saati, YYYY-MM-DD). Her çizimde yeniden hesaplanır; uygulama ön plana dönünce
 * yeniden çizim tetiklenir → hızlı tarih seçimleri ("Bugün", "Bu Hafta"...) gece yarısından sonra
 * eski günde kalmaz. Değer sorgu anahtarına girdiği için gün değişince yeni aralık istenir.
 */
import { useEffect, useState } from "react";
import { AppState } from "react-native";
import { businessToday, toApiDate } from "@/utils/date";

export function useBusinessDay(): string {
  const [, setTick] = useState(0);
  useEffect(() => {
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") setTick((n) => n + 1);
    });
    return () => sub.remove();
  }, []);
  return toApiDate(businessToday());
}
