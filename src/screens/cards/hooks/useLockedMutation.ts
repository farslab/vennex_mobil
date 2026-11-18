import { useCallback, useRef } from "react";
import { useMutation, useQueryClient, type UseMutationOptions } from "@tanstack/react-query";
import { queryKeys } from "@/api/queryKeys";
import { toast } from "@/design-system";
import type { ApiError } from "@/api/client";

interface Options<TData, TVars> extends Omit<UseMutationOptions<TData, ApiError, TVars>, "mutationFn" | "onSuccess"> {
  mutationFn: (vars: TVars) => Promise<TData>;
  /** Başarı bildirimi (veriye göre üretilebilir) */
  successMessage?: string | ((data: TData, vars: TVars) => string | null);
  onSuccess?: (data: TData, vars: TVars) => void;
}

/**
 * Kart modülü mutasyonu:
 * - eşzamanlı ikinci çağrıyı senkron ref kilidiyle engeller (`isPending` render'ı beklemeden)
 * - başarıda `queryKeys.cards.all` invalidate + toast
 * - hata nesnesi ApiError (fieldErrors) olarak döner; ekran alan hatalarına eşler
 */
export function useLockedMutation<TData, TVars = void>({ mutationFn, successMessage, onSuccess, ...rest }: Options<TData, TVars>) {
  const queryClient = useQueryClient();
  const lock = useRef(false);
  const mutation = useMutation<TData, ApiError, TVars>({
    ...rest,
    mutationFn,
    onSettled: (...args) => {
      lock.current = false;
      rest.onSettled?.(...args);
    },
    onSuccess: (data, vars) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
      const msg = typeof successMessage === "function" ? successMessage(data, vars) : successMessage;
      if (msg) toast.success(msg);
      onSuccess?.(data, vars);
    },
  });

  const { mutate } = mutation;
  const run = useCallback(
    (vars: TVars) => {
      if (lock.current) return;
      lock.current = true;
      mutate(vars);
    },
    [mutate]
  );

  return { ...mutation, run };
}

/** Hatanın alan haritası (yoksa boş) */
export function fieldErrorsOf(error: unknown): Record<string, string> {
  const fe = (error as ApiError | null | undefined)?.fieldErrors;
  return fe ?? {};
}

/** Alan hatası olarak gösterilmeyen genel mesaj (alan hatası varsa null) */
export function generalErrorOf(error: unknown, handledFields: string[] = []): string | null {
  if (!error) return null;
  const fe = fieldErrorsOf(error);
  const unhandled = Object.keys(fe).filter((k) => !handledFields.includes(k));
  if (Object.keys(fe).length > 0 && unhandled.length === 0) return null;
  if (unhandled.length > 0) return fe[unhandled[0]];
  return error instanceof Error ? error.message : "İşlem başarısız.";
}
