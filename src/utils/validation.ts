/** Form doğrulama yardımcıları — backend serializer kurallarıyla uyumlu */

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

/** Backend PasswordChange/Reset serializer: min_length=8 */
export const PASSWORD_MIN_LENGTH = 8;

export function validatePassword(value: string): string | null {
  if (!value) return "Şifre gerekli.";
  if (value !== value.trim()) return "Şifre başında veya sonunda boşluk olamaz.";
  if (value.length < PASSWORD_MIN_LENGTH) return `Şifre en az ${PASSWORD_MIN_LENGTH} karakter olmalı.`;
  if (/^\d+$/.test(value)) return "Şifre yalnızca rakamlardan oluşamaz.";
  return null;
}

/** Türkiye telefon numarası: 05XX XXX XX XX, +90 5XX..., 5XX... */
export function normalizePhone(value: string): string | null {
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  let local = digits;
  if (local.startsWith("90") && local.length === 12) local = local.slice(2);
  if (local.startsWith("0") && local.length === 11) local = local.slice(1);
  if (local.length !== 10 || !local.startsWith("5")) return null;
  return `0${local}`;
}

export function isValidPhone(value: string): boolean {
  return value.trim() === "" || normalizePhone(value) != null;
}
