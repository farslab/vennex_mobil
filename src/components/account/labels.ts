import type { UserRole } from "@/types/auth";
import type { StatusTone } from "@/design-system";

export const ROLE_LABELS: Record<UserRole, string> = {
  owner: "Sahip",
  tech: "Teknisyen",
  admin: "Yönetici",
};

export function roleLabel(role: string | null | undefined): string {
  if (!role) return "—";
  return ROLE_LABELS[role as UserRole] ?? role;
}

export function roleTone(role: string | null | undefined): StatusTone {
  return role === "owner" ? "info" : "neutral";
}
