/**
 * Cari (Paraşüt) durumu — web ile aynı kurallar:
 *  - `dashboard/middleware.py` State 4: kilitli şirkette tüm ekranlar kapalı (sunucu da 403 `cari_locked`).
 *  - `api/notifications/notification_processor.py`: durum 1–3'te sahip için üst şerit (1 sarı, 2–3 kırmızı),
 *    tutar = faturaların kalan TL toplamı, yoksa cari bakiye; tutar yoksa şerit yok.
 *  - `v2/partials/cari_popup.html`: durum 3'te genel bakışta "Ödeme Uyarısı" penceresi.
 * "Hemen Öde": uygulama içi ödeme (CariPaymentScreen, web ile aynı ödeme çekirdeği).
 */
import { useQuery } from "@tanstack/react-query";
import { accountApi } from "@/api/account";
import { queryKeys } from "@/api/queryKeys";
import { isOwner } from "@/auth/permissions";
import { useAppConfig } from "@/hooks/useAppConfig";
import { useAuthStore } from "@/store/authStore";

export const CARI_LOCKED_MESSAGE = "Şirketinizin cari hesabı ödenmemiş borç nedeniyle kilitlendi.";

export function cariBannerText(state: number): string {
  return state === 1 ? "Ödenmemiş cari borcunuz bulunmaktadır." : "Vadesi geçmiş faturanız bulunmaktadır.";
}



export function useCari() {
  const user = useAuthStore((s) => s.user);
  const owner = isOwner(user);
  // Web: şerit, tutar ve ödeme uyarısı teknisyen dışındaki herkese (sahip, admin) — `role != 'tech'`
  const nonTech = !!user && user.role !== "tech";
  const config = useAppConfig();
  const cari = config.data?.cari;
  const enabled = cari?.enabled === true;
  const state = enabled ? (cari?.state ?? 0) : 0;
  const locked = cari?.locked === true;

  // Tutar teknisyene gösterilmez (web ile aynı); sunucu ucu IsNotTech
  const summary = useQuery({
    queryKey: queryKeys.account.cariSummary(),
    queryFn: ({ signal }) => accountApi.cariSummary(signal),
    enabled: nonTech && enabled && state >= 1,
    staleTime: 5 * 60_000,
  });
  const balance = summary.data ? Number(summary.data.all_total) || 0 : null;

  return {
    owner,
    nonTech,
    enabled,
    state,
    locked,
    balance,
    paymentPath: cari?.payment_path,
    /** Web: teknisyen dışı + durum 1–3 + tutar > 0 */
    showBanner: nonTech && enabled && state >= 1 && state <= 3 && (balance ?? 0) > 0,
    /** Web: teknisyen dışı + durum 3 + tutar > 0, yalnız genel bakışta */
    showPopup: nonTech && enabled && state === 3 && (balance ?? 0) > 0,
    refetch: () => {
      config.refetch();
      if (nonTech && enabled) summary.refetch();
    },
    refreshing: config.isRefetching,
  };
}
