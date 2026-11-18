import { useAuthStore } from "@/store/authStore";
import { makeUser } from "@/test/utils";
import type { Permission } from "@/auth/permissions";

export function cardJson(id: number, over: Record<string, unknown> = {}) {
  return {
    id,
    uid: `04 AA BB ${String(id).padStart(2, "0")}`,
    first_name: `Ad${id}`,
    last_name: "Soyad",
    full_name: `Ad${id} Soyad`,
    balance: "100.00",
    customer_no: 0,
    is_active: true,
    created_at: "2026-11-01T10:00:00+03:00",
    groups: [{ id: 1, name: "Ofis", pos_device_ids: [101] }],
    ...over,
  };
}

export function cardPage(ids: number[], over: Record<string, unknown> = {}) {
  return {
    count: ids.length,
    page: 1,
    num_pages: 1,
    page_size: 30,
    active_count: 12,
    pending_count: 2,
    results: ids.map((id) => cardJson(id)),
    ...over,
  };
}

export function loginAs(permissions: Permission[], role: "owner" | "tech" | "admin" = "owner") {
  useAuthStore.setState({
    status: "authenticated",
    user: makeUser({ role, permissions }),
    selectedCompanyId: 10,
  });
}

export const FULL: Permission[] = ["owner", "manage_personel_card", "change_card_balance", "view_sales"];
export const NO_BALANCE: Permission[] = ["tech", "manage_personel_card"];
