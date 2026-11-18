/**
 * Kart modülüne özel query key'ler. Hepsi `queryKeys.cards.all` kökünden türetilir; böylece
 * mutasyonlardan sonra tek `invalidateQueries({ queryKey: queryKeys.cards.all })` hepsini yeniler.
 */
import { queryKeys } from "@/api/queryKeys";
import type { DeviceOptionSource } from "@/types/cards";

const root = queryKeys.cards.all;

export const cardKeys = {
  all: root,
  list: queryKeys.cards.list,
  detail: queryKeys.cards.detail,
  transactions: (id: number, limit: number) => [...queryKeys.cards.transactions(id), { limit }] as const,
  groupList: (q: string) => [...root, "group-list", { q }] as const,
  group: queryKeys.cards.group,
  deviceOptions: (source: DeviceOptionSource, companyId: number | null) =>
    [...root, "device-options", source, companyId] as const,
  recurringBalance: queryKeys.cards.recurringBalance,
  quotas: queryKeys.cards.quotas,
  recurringQuota: queryKeys.cards.recurringQuota,
  picker: (kind: string, filters: Record<string, unknown>) => [...root, "picker", kind, filters] as const,
};
