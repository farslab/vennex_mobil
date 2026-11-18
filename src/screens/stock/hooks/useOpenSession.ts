import { useState } from "react";

/**
 * Sheet her açıldığında artan oturum numarası. İç form bileşenine `key` olarak verilir; böylece
 * form state'i effect içinde setState yapmadan (React "derived state" kalıbı) sıfırlanır,
 * kapanırken ise bileşen yerinde kalıp kapanış animasyonunu oynatır.
 */
export function useOpenSession(visible: boolean): number {
  const [session, setSession] = useState(0);
  const [prevVisible, setPrevVisible] = useState(visible);
  if (visible !== prevVisible) {
    setPrevVisible(visible);
    if (visible) setSession((s) => s + 1);
  }
  return session;
}
