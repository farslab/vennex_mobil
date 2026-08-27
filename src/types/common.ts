// lib/data/models/common/period.dart karşılığı
export type ApiPeriod =
  | "today"
  | "yesterday"
  | "this_week"
  | "last_week"
  | "this_month"
  | "last_month"
  | "last_30"
  | "custom";

export const PERIOD_LABELS: Record<ApiPeriod, string> = {
  today: "Bugün",
  yesterday: "Dün",
  this_week: "Bu Hafta",
  last_week: "Geçen Hafta",
  this_month: "Bu Ay",
  last_month: "Geçen Ay",
  last_30: "Son 30 Gün",
  custom: "Özel",
};

// lib/data/models/common/paginated.dart karşılığı — count/next/previous stili
export interface Paginated<T> {
  count: number;
  page?: number;
  num_pages?: number;
  page_size?: number;
  next?: string | null;
  previous?: string | null;
  results: T[];
}

// {results: [...]} zarfı kullanan endpointler için (ör. stock/skus, card-groups)
export interface ResultsWrapper<T> {
  results: T[];
}
