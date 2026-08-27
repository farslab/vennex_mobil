import { apiClient } from "./client";
import type { AuthUser } from "@/types/auth";
import type { LegalDocument, LegalDocumentSlug } from "@/types/legal";

export const legalApi = {
  // skipAuth: login öncesi de erişilebilir olmalı (dokümana göre)
  getDocument: (slug: LegalDocumentSlug) =>
    apiClient.get<LegalDocument>(`/legal/${slug}/`, { skipAuth: true }).then((r) => ({
      ...r.data,
      slug: r.data.slug || slug, // yanıtta yoksa request slug'ından tamamla
    })),

  // authed — kabul edilen sürümü kaydeder, güncel AuthUser döner
  accept: (slug: LegalDocumentSlug, version?: number | null) =>
    apiClient
      .post<AuthUser>("/legal/accept/", version != null ? { slug, version } : { slug })
      .then((r) => r.data),
};
