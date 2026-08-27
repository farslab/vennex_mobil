export interface CardGroup {
  id: number;
  name: string;
  pos_device_ids: number[];
  pos_devices?: PosDeviceSummary[];
  pos_device_count?: number;
  active_cards_count?: number;
}

export interface PosDeviceSummary {
  id: number;
  sn?: string;
  pos_name?: string;
}

export interface NfcCard {
  id: number;
  uid: string;
  first_name: string;
  last_name: string;
  balance: number;
  customer_no?: number | null;
  is_active: boolean;
  created_at: string;
  groups: CardGroup[];
  // Bekleyen (pending) kartlar için — approve/reject akışında kullanılır
  status?: "active" | "pending" | string;
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

export type BulkBalanceOperation = "add" | "subtract" | "set";
