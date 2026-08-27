import { apiClient } from "./client";
import type { Paginated, ResultsWrapper } from "@/types/common";
import type { BulkBalanceOperation, CardGroup, NfcCard } from "@/types/cards";

export interface PosDeviceItem {
  id: number;
  sn: string;
  pos_name?: string;
  is_active?: boolean;
}

export interface CardListParams {
  status?: string; // default backend: 'active'
  page?: number;
  q?: string;
  group_id?: number;
}

export interface RecurringBalanceRule {
  id: number;
  name: string;
  amount: number | string;
  update_type: "add" | "set";
  period: "daily" | "weekly" | "monthly";
  target_type: "card" | "group";
  target_card?: number | null;
  target_card_uid?: string;
  target_group?: number | null;
  target_group_name?: string;
  is_active: boolean;
  start_date: string;
  last_run?: string | null;
  next_run?: string | null;
  run_count?: number;
  description?: string | null;
  created_at?: string;
}

export interface CardQuota {
  id: number;
  card: number;
  card_uid?: string;
  group?: number | null;
  group_name?: string;
  product_no: string;
  period: "daily" | "weekly" | "monthly";
  quantity: number;
  is_active: boolean;
  created_at?: string;
}

export interface RecurringQuotaRule {
  id: number;
  name: string;
  group: number;
  group_name?: string;
  product_no: string;
  period: "daily" | "weekly" | "monthly";
  quantity: number;
  target_type: "card" | "group";
  target_card?: number | null;
  target_card_uid?: string;
  is_active: boolean;
  start_date: string;
  last_run?: string | null;
  next_run?: string | null;
  run_count?: number;
  description?: string | null;
  created_at?: string;
}

function normalizeCard(raw: NfcCard): NfcCard {
  return {
    ...raw,
    balance: typeof raw.balance === "string" ? parseFloat(raw.balance) || 0 : raw.balance ?? 0,
  };
}

export const cardsApi = {
  list: (params: CardListParams = {}): Promise<Paginated<NfcCard>> =>
    apiClient.get<Paginated<NfcCard>>("/cards/", { params }).then((r) => ({
      ...r.data,
      results: r.data.results.map(normalizeCard),
    })),

  create: (payload: {
    uid: string;
    first_name?: string;
    last_name?: string;
    balance?: number;
    customer_no?: number;
    group_ids?: number[];
  }): Promise<NfcCard> =>
    apiClient
      .post<NfcCard>("/cards/", {
        ...payload,
        balance: payload.balance != null ? payload.balance.toFixed(2) : "0.00",
      })
      .then((r) => normalizeCard(r.data)),

  update: (id: number, patch: Record<string, unknown>): Promise<NfcCard> =>
    apiClient.patch<NfcCard>(`/cards/${id}/`, patch).then((r) => normalizeCard(r.data)),

  remove: (id: number) => apiClient.delete(`/cards/${id}/`),

  approve: (id: number, reverseUid = false): Promise<NfcCard> =>
    apiClient.post<NfcCard>(`/cards/${id}/approve/`, { reverse_uid: reverseUid }).then((r) => normalizeCard(r.data)),

  reject: (id: number) => apiClient.post(`/cards/${id}/reject/`),

  rejectAllPending: () => apiClient.post("/cards/reject-all-pending/"),

  transactions: (id: number, limit = 100) =>
    apiClient
      .get<Record<string, unknown>>(`/cards/${id}/transactions/`, { params: { limit } })
      .then((r) => r.data),

  bulkBalance: (card_ids: number[], operation: BulkBalanceOperation, amount: number) =>
    apiClient.post("/cards/bulk/balance/", { card_ids, operation, amount: amount.toFixed(2) }),

  bulkDelete: (card_ids: number[]) => apiClient.post("/cards/bulk/delete/", { card_ids }),

  bulkGroups: (card_ids: number[], group_ids: number[], operation: "add_groups" | "remove_groups") =>
    apiClient.post("/cards/bulk/groups/", { card_ids, group_ids, operation }),

  posDevices: {
    list: (): Promise<PosDeviceItem[]> =>
      apiClient
        .get<ResultsWrapper<PosDeviceItem> | PosDeviceItem[]>("/pos-devices/")
        .then((r) => ("results" in r.data ? r.data.results : r.data)),
  },

  groups: {
    list: (params?: { q?: string }): Promise<CardGroup[]> =>
      apiClient
        .get<ResultsWrapper<CardGroup> | CardGroup[]>("/card-groups/", { params })
        .then((r) => ("results" in r.data ? r.data.results : r.data)),
    detail: (id: number): Promise<CardGroup> =>
      apiClient.get<CardGroup>(`/card-groups/${id}/`).then((r) => r.data),
    create: (name: string, pos_device_ids: number[] = []): Promise<CardGroup> =>
      apiClient.post<CardGroup>("/card-groups/", { name, pos_device_ids }).then((r) => r.data),
    update: (id: number, patch: Record<string, unknown>): Promise<CardGroup> =>
      apiClient.patch<CardGroup>(`/card-groups/${id}/`, patch).then((r) => r.data),
    remove: (id: number) => apiClient.delete(`/card-groups/${id}/`),
  },

  recurringBalance: {
    list: (params?: { page?: number; q?: string }): Promise<RecurringBalanceRule[]> =>
      apiClient
        .get<Paginated<RecurringBalanceRule> | ResultsWrapper<RecurringBalanceRule> | RecurringBalanceRule[]>(
          "/recurring-balance/",
          { params }
        )
        .then((r) => ("results" in r.data ? (r.data as any).results : (r.data as any))),
    detail: (id: number): Promise<RecurringBalanceRule> =>
      apiClient.get<RecurringBalanceRule>(`/recurring-balance/${id}/`).then((r) => r.data),
    create: (payload: {
      name: string;
      amount: number;
      update_type?: "add" | "set";
      period: "daily" | "weekly" | "monthly";
      target_type: "card" | "group";
      target_card?: number | null;
      target_group?: number | null;
      start_date: string;
      is_active?: boolean;
      description?: string;
    }): Promise<RecurringBalanceRule> =>
      apiClient
        .post<RecurringBalanceRule>("/recurring-balance/", {
          ...payload,
          amount: payload.amount.toFixed(2),
        })
        .then((r) => r.data),
    update: (id: number, patch: Record<string, unknown>): Promise<RecurringBalanceRule> =>
      apiClient.patch<RecurringBalanceRule>(`/recurring-balance/${id}/`, patch).then((r) => r.data),
    remove: (id: number) => apiClient.delete(`/recurring-balance/${id}/`),
  },

  quotas: {
    list: (params?: { page?: number; q?: string; card_id?: number; group_id?: number }): Promise<CardQuota[]> =>
      apiClient
        .get<Paginated<CardQuota> | ResultsWrapper<CardQuota> | CardQuota[]>("/card-quotas/", { params })
        .then((r) => ("results" in r.data ? (r.data as any).results : (r.data as any))),
    detail: (id: number): Promise<CardQuota> =>
      apiClient.get<CardQuota>(`/card-quotas/${id}/`).then((r) => r.data),
    create: (payload: {
      card: number;
      group: number;
      period: "daily" | "weekly" | "monthly";
      quantity?: number;
      product_no?: string;
      is_active?: boolean;
    }): Promise<CardQuota> => apiClient.post<CardQuota>("/card-quotas/", payload).then((r) => r.data),
    update: (id: number, patch: Record<string, unknown>): Promise<CardQuota> =>
      apiClient.patch<CardQuota>(`/card-quotas/${id}/`, patch).then((r) => r.data),
    remove: (id: number) => apiClient.delete(`/card-quotas/${id}/`),
  },

  recurringQuota: {
    list: (params?: { page?: number; q?: string }): Promise<RecurringQuotaRule[]> =>
      apiClient
        .get<Paginated<RecurringQuotaRule> | ResultsWrapper<RecurringQuotaRule> | RecurringQuotaRule[]>(
          "/recurring-quota/",
          { params }
        )
        .then((r) => ("results" in r.data ? (r.data as any).results : (r.data as any))),
    detail: (id: number): Promise<RecurringQuotaRule> =>
      apiClient.get<RecurringQuotaRule>(`/recurring-quota/${id}/`).then((r) => r.data),
    create: (payload: {
      name: string;
      group: number;
      period: "daily" | "weekly" | "monthly";
      quantity?: number;
      product_no?: string;
      target_type?: "card" | "group";
      target_card?: number | null;
      start_date: string;
      is_active?: boolean;
      description?: string;
    }): Promise<RecurringQuotaRule> => apiClient.post<RecurringQuotaRule>("/recurring-quota/", payload).then((r) => r.data),
    update: (id: number, patch: Record<string, unknown>): Promise<RecurringQuotaRule> =>
      apiClient.patch<RecurringQuotaRule>(`/recurring-quota/${id}/`, patch).then((r) => r.data),
    remove: (id: number) => apiClient.delete(`/recurring-quota/${id}/`),
  },
};