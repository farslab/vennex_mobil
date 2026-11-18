/**
 * Aynı anda yalnız bir istek: ekran yeniden çizilip buton `loading`/`disabled` olmadan önce gelen
 * ikinci dokunuşu senkron bir ref kilidiyle yutar. Finansal/kalıcı işlemlerde (nakit toplama, ciro
 * sayımı, sıralama kaydı) çift isteği önler. Hata durumu mutasyonun kendi `error` alanında kalır.
 *
 *   const confirm = useSingleFlight(() => collect.mutateAsync());
 */
import { useCallback, useRef } from "react";

export function useSingleFlight(run: () => Promise<unknown>): () => void {
  const busy = useRef(false);
  return useCallback(() => {
    if (busy.current) return;
    busy.current = true;
    run()
      .catch(() => {
        // hata react-query mutasyon durumunda gösterilir
      })
      .finally(() => {
        busy.current = false;
      });
  }, [run]);
}
