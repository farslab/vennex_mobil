import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AppCard, AppListRow, toast } from "@/design-system";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { PasswordConfirmSheet } from "@/components/account/PasswordConfirmSheet";
import { splitApiError } from "@/components/account/formErrors";

/**
 * Hesap silme TALEBİ (POST auth/delete/ → 201 yeni · 200 zaten açık talep var).
 * Hesap uygulamadan silinmez: talep Nexus'a düşer, silme işlemini Vennex ekibi yapar.
 * Oturum açık kalır. Hesap dondurma seçeneği kaldırıldı.
 */
export function AccountDangerZone() {
  const username = useAuthStore((s) => s.user?.username ?? "");
  const [open, setOpen] = useState(false);
  const [errors, setErrors] = useState<{ password: string | null; general: string | null }>({
    password: null,
    general: null,
  });

  const mutation = useMutation({
    mutationFn: (password: string) => authApi.requestAccountDeletion(password),
    onSuccess: (res) => {
      setOpen(false);
      if (res.already) toast.info("Hesap silme talebiniz zaten alındı; ekibimiz inceliyor.");
      else toast.success("Hesap silme talebiniz alındı. Ekibimiz inceleyip sizinle iletişime geçecek.");
    },
    onError: (error) => {
      const { fieldErrors, general } = splitApiError(error, ["password"] as const);
      setErrors({ password: fieldErrors.password ?? null, general });
    },
  });

  return (
    <>
      <AppCard padded={false} testID="danger-zone">
        <AppListRow
          icon="trash-2"
          destructive
          title="Hesap silme talebi"
          subtitle="Talebiniz Vennex ekibine iletilir."
          onPress={() => {
            setErrors({ password: null, general: null });
            setOpen(true);
          }}
          last
          testID="row-delete-account"
        />
      </AppCard>

      <PasswordConfirmSheet
        visible={open}
        title="Hesap silme talebi"
        message="Hesabınızın ve hesabınıza bağlı kişisel verilerinizin silinmesi için Vennex ekibine talep gönderilir. Ekibimiz talebi inceleyip sizinle iletişime geçer; işlem tamamlanana kadar hesabınızı kullanmaya devam edebilirsiniz."
        summary={[
          { label: "Hesap", value: username },
          { label: "İşlem", value: "Hesap silme talebi" },
        ]}
        confirmLabel="Talebi gönder"
        destructive
        loading={mutation.isPending}
        passwordError={errors.password}
        error={errors.general}
        onConfirm={(password) => {
          setErrors({ password: null, general: null });
          mutation.mutate(password);
        }}
        onCancel={() => setOpen(false)}
        testID="account-action-sheet"
      />
    </>
  );
}
