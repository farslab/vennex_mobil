import React, { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { AppCard, AppListRow, toast } from "@/design-system";
import { authApi } from "@/api/auth";
import { useAuthStore } from "@/store/authStore";
import { PasswordConfirmSheet } from "@/components/account/PasswordConfirmSheet";
import { splitApiError } from "@/components/account/formErrors";

type Action = "deactivate" | "delete";

const COPY: Record<
  Action,
  { title: string; message: string; confirmLabel: string; operation: string; success: string; irreversible: boolean }
> = {
  deactivate: {
    title: "Hesabı dondur",
    message:
      "Hesabınız pasifleştirilir ve tüm oturumlarınız kapatılır. Verileriniz silinmez; hesabı yeniden açmak için Vennex destek ekibiyle iletişime geçmeniz gerekir.",
    confirmLabel: "Hesabı dondur",
    operation: "Hesabı pasifleştir",
    success: "Hesabınız donduruldu.",
    irreversible: false,
  },
  delete: {
    title: "Hesabı kalıcı olarak sil",
    message:
      "Hesabınız ve hesabınıza bağlı kişisel verileriniz kalıcı olarak silinir, tüm oturumlarınız kapatılır. Bu işlemden sonra aynı hesapla giriş yapamazsınız.",
    confirmLabel: "Kalıcı olarak sil",
    operation: "Hesabı kalıcı sil",
    success: "Hesabınız silindi.",
    irreversible: true,
  },
};

/**
 * Hesap dondurma (POST auth/deactivate/ → 200) ve silme (POST auth/delete/ → 204).
 * İkisi de `{password}` ister; hatalıysa `{password:["Parola hatalı."]}`. Başarıda oturum kapatılır.
 */
export function AccountDangerZone() {
  const username = useAuthStore((s) => s.user?.username ?? "");
  const logout = useAuthStore((s) => s.logout);
  const [action, setAction] = useState<Action | null>(null);
  const [errors, setErrors] = useState<{ password: string | null; general: string | null }>({
    password: null,
    general: null,
  });

  const mutation = useMutation({
    mutationFn: ({ kind, password }: { kind: Action; password: string }) =>
      kind === "delete" ? authApi.deleteAccount(password) : authApi.deactivate(password),
    onSuccess: async (_data, { kind }) => {
      setAction(null);
      toast.success(COPY[kind].success);
      await logout();
    },
    onError: (error) => {
      const { fieldErrors, general } = splitApiError(error, ["password"] as const);
      setErrors({ password: fieldErrors.password ?? null, general });
    },
  });

  const open = (kind: Action) => {
    setErrors({ password: null, general: null });
    setAction(kind);
  };

  const copy = action ? COPY[action] : null;

  return (
    <>
      <AppCard padded={false} testID="danger-zone">
        <AppListRow
          icon="pause-circle"
          iconTone="danger"
          title="Hesabı dondur"
          subtitle="Hesap pasifleşir, verileriniz saklanır."
          onPress={() => open("deactivate")}
          testID="row-deactivate"
        />
        <AppListRow
          icon="trash-2"
          destructive
          title="Hesabı kalıcı olarak sil"
          subtitle="Geri alınamaz; tüm oturumlar kapatılır."
          onPress={() => open("delete")}
          last
          testID="row-delete-account"
        />
      </AppCard>

      <PasswordConfirmSheet
        visible={!!copy}
        title={copy?.title ?? ""}
        message={copy?.message}
        summary={copy ? [
          { label: "Hesap", value: username },
          { label: "İşlem", value: copy.operation },
        ] : undefined}
        confirmLabel={copy?.confirmLabel ?? "Onayla"}
        destructive
        irreversible={copy?.irreversible}
        loading={mutation.isPending}
        passwordError={errors.password}
        error={errors.general}
        onConfirm={(password) => {
          if (!action) return;
          setErrors({ password: null, general: null });
          mutation.mutate({ kind: action, password });
        }}
        onCancel={() => setAction(null)}
        testID="account-action-sheet"
      />
    </>
  );
}
