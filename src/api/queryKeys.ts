/**
 * Merkezi query key fabrikası. Şirket bazlı veriler şirket değişiminde
 * `queryClient.resetQueries()` ile toptan sıfırlandığından anahtarlara companyId eklenmez.
 *
 * Kural: her domain `all` kökü ile başlar → `invalidateQueries({ queryKey: queryKeys.devices.all })`
 * o domain'in tüm liste/detay sorgularını geçersiz kılar.
 */
type Filters = Record<string, unknown>;

export const queryKeys = {
  me: () => ["me"] as const,
  appConfig: () => ["app-config"] as const,
  versionPolicy: () => ["version-policy"] as const,

  overview: {
    all: ["overview"] as const,
    dashboard: (params: Filters) => ["overview", "dashboard", params] as const,
    locations: () => ["overview", "locations"] as const,
    personelGroups: (params: Filters) => ["overview", "personel-groups", params] as const,
  },

  devices: {
    all: ["devices"] as const,
    list: (filters: Filters) => ["devices", "list", filters] as const,
    detail: (sn: string) => ["devices", "detail", sn] as const,
    summary: (sn: string) => ["devices", "summary", sn] as const,
    products: (sn: string) => ["devices", "products", sn] as const,
    transactions: (sn: string, filters: Filters) => ["devices", "transactions", sn, filters] as const,
    txReceipt: (sn: string, txId: number) => ["devices", "tx-receipt", sn, txId] as const,
    cashHistory: (sn: string) => ["devices", "cash-history", sn] as const,
    revenueCounts: (sn: string) => ["devices", "revenue-counts", sn] as const,
    options: () => ["devices", "options"] as const,
  },

  templates: {
    all: ["templates"] as const,
    list: () => ["templates", "list"] as const,
    detail: (id: number) => ["templates", "detail", id] as const,
    items: (id: number) => ["templates", "items", id] as const,
  },

  cards: {
    all: ["cards"] as const,
    list: (filters: Filters) => ["cards", "list", filters] as const,
    detail: (id: number) => ["cards", "detail", id] as const,
    transactions: (id: number) => ["cards", "transactions", id] as const,
    groups: () => ["cards", "groups"] as const,
    group: (id: number) => ["cards", "groups", id] as const,
    recurringBalance: (filters: Filters) => ["cards", "recurring-balance", filters] as const,
    quotas: (filters: Filters) => ["cards", "quotas", filters] as const,
    recurringQuota: (filters: Filters) => ["cards", "recurring-quota", filters] as const,
  },

  stock: {
    all: ["stock"] as const,
    overview: () => ["stock", "overview"] as const,
    locations: () => ["stock", "locations"] as const,
    inventory: (locationId: number) => ["stock", "inventory", locationId] as const,
    locationMovements: (locationId: number) => ["stock", "location-movements", locationId] as const,
    skus: (filters: Filters) => ["stock", "skus", filters] as const,
    movements: (filters: Filters) => ["stock", "movements", filters] as const,
  },

  reports: {
    all: ["reports"] as const,
    list: () => ["reports", "list"] as const,
    detail: (id: number) => ["reports", "detail", id] as const,
    filterOptions: () => ["reports", "filter-options"] as const,
  },

  notifications: {
    all: ["notifications"] as const,
    list: (filters: Filters) => ["notifications", "list", filters] as const,
    unreadCount: () => ["notifications", "unread-count"] as const,
    preferences: () => ["notifications", "preferences"] as const,
  },

  users: {
    all: ["users"] as const,
    list: () => ["users", "list"] as const,
    detail: (id: number) => ["users", "detail", id] as const,
    assignableOptions: () => ["users", "assignable-options"] as const,
  },

  account: {
    twoFactorStatus: () => ["account", "2fa-status"] as const,
    companies: () => ["account", "companies"] as const,
    company: (id: number) => ["account", "companies", id] as const,
    cariSummary: () => ["account", "cari-summary"] as const,
    cariInvoices: () => ["account", "cari-invoices"] as const,
  },

  legal: {
    document: (slug: string) => ["legal", slug] as const,
  },

  regions: {
    all: ["regions"] as const,
    list: () => ["regions", "list"] as const,
  },
  feedback: {
    all: ["feedback"] as const,
    list: () => ["feedback", "list"] as const,
  },
} as const;
