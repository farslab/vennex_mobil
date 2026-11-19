/**
 * Web `v2/partials/cari_popup.html` karşılığı: durum 3 (kritik gecikme) iken genel bakışta "Ödeme Uyarısı".
 * Uygulama oturumu boyunca şirket başına bir kez gösterilir ("Daha Sonra" ile kapanır).
 */
import React, { useState } from "react";
import { AppConfirmSheet } from "@/design-system";
import { useAuthStore } from "@/store/authStore";
import { formatCurrency } from "@/utils/number";
import { openCariPayment, useCari } from "./useCari";

const shownFor = new Set<number>();

/** Testler için */
export function resetCariPopupSession() {
  shownFor.clear();
}

export function CariOverduePopup() {
  const cari = useCari();
  const companyId = useAuthStore((s) => s.selectedCompanyId);
  const [dismissed, setDismissed] = useState(false);
  const eligible = cari.showPopup && companyId != null && !shownFor.has(companyId);
  const visible = eligible && !dismissed;

  const close = () => {
    if (companyId != null) shownFor.add(companyId);
    setDismissed(true);
  };

  return (
    <AppConfirmSheet
      visible={visible}
      title="Ödeme Uyarısı"
      message={`${formatCurrency(cari.balance)} tutarında gecikmiş faturanız bulunmaktadır. Hesabınızın bazı özelliklerinin kısıtlanmaması için lütfen ödeme yapınız.`}
      confirmLabel="Hemen Öde"
      cancelLabel="Daha Sonra"
      destructive
      onConfirm={() => {
        close();
        openCariPayment(cari.paymentPath);
      }}
      onCancel={close}
    />
  );
}
