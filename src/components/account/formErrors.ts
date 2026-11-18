import type { ApiError } from "@/api/client";

/**
 * ApiError'dan form alanlarına düşen hataları ve geri kalan genel mesajı ayırır.
 * Alan hatası yoksa (ör. `{detail}`) mesaj genel hata olarak döner.
 */
export function splitApiError<F extends string>(
  error: unknown,
  fields: readonly F[]
): { fieldErrors: Partial<Record<F, string>>; general: string | null } {
  const apiError = error as ApiError | null | undefined;
  const fieldErrors: Partial<Record<F, string>> = {};
  const raw = apiError?.fieldErrors ?? {};
  let unmatched: string | null = null;
  for (const [key, message] of Object.entries(raw)) {
    if ((fields as readonly string[]).includes(key)) fieldErrors[key as F] = message;
    else unmatched ??= message;
  }
  const hasField = Object.keys(fieldErrors).length > 0;
  const general = hasField ? unmatched : (apiError?.message ?? (error instanceof Error ? error.message : null)) || null;
  return { fieldErrors, general };
}

/** Yalnız durum kodu (403/404 gibi) okumak için */
export function errorStatus(error: unknown): number | undefined {
  return (error as ApiError | null | undefined)?.status;
}
