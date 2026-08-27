export interface NotificationItem {
  id: number;
  timestamp: string;
  verb: string;
  description: string;
  unread: boolean;
  actor_str?: string | null;
  target_str?: string | null;
  data: Record<string, unknown>; // data.event ile deep-link routing yapılır
}
