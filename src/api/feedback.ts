/**
 * Geri bildirim — backend vennex_mobile/views/feedback.py
 *   GET  /feedback/   → {results: Feedback[]} (yalnız kullanıcının kendi son 50 kaydı)
 *   POST /feedback/   {category, message(10–2000), platform?, app_version?} → 201 Feedback (saatte 10)
 * Ekip kayıtları Nexus → "Mobil Geri Bildirim" ekranında görür ve durumunu günceller.
 */
import { apiClient } from "./client";
import { unwrapResults } from "./pagination";
import { clientPlatform, nativeAppVersion } from "./appConfig";

export type FeedbackCategory = "suggestion" | "bug" | "question" | "other";
export type FeedbackStatus = "new" | "read" | "in_progress" | "resolved" | "spam";

export interface Feedback {
  id: number;
  category: string;
  category_display: string;
  message: string;
  status: FeedbackStatus | string;
  status_display: string;
  created_at: string;
}

export const FEEDBACK_CATEGORIES: { key: FeedbackCategory; label: string }[] = [
  { key: "suggestion", label: "Öneri" },
  { key: "bug", label: "Hata" },
  { key: "question", label: "Soru" },
  { key: "other", label: "Diğer" },
];

export const FEEDBACK_MIN = 10;
export const FEEDBACK_MAX = 2000;

function normalize(raw: Record<string, unknown>): Feedback {
  return {
    id: Number(raw.id),
    category: String(raw.category ?? ""),
    category_display: String(raw.category_display ?? raw.category ?? ""),
    message: String(raw.message ?? ""),
    status: String(raw.status ?? "new"),
    status_display: String(raw.status_display ?? ""),
    created_at: String(raw.created_at ?? ""),
  };
}

export const feedbackApi = {
  list: (signal?: AbortSignal) =>
    apiClient
      .get<{ results: Record<string, unknown>[] }>("/feedback/", { signal })
      .then((r) => unwrapResults(r.data).map(normalize)),

  send: (category: FeedbackCategory, message: string) =>
    apiClient
      .post("/feedback/", {
        category,
        message,
        platform: clientPlatform() ?? undefined,
        app_version: nativeAppVersion(),
      })
      .then((r) => normalize(r.data)),
};
