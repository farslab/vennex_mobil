import { apiClient } from "./client";
import type { AuthUser } from "@/types/auth";
import type { LegalDocument, LegalDocumentSlug } from "@/types/legal";

export const legalApi = {
  /**
   * GET legal/{slug}/ — AllowAny (views/legal.py:13-33). Bilinmeyen slug 404.
   * `pending_legal_docs` backend'den geldiği için bilinen üç slug dışındakiler de istenebilir.
   */
  getDocument: (slug: LegalDocumentSlug | (string & {}), signal?: AbortSignal) =>
    apiClient.get<LegalDocument>(`/legal/${encodeURIComponent(slug)}/`, { skipAuth: true, signal }).then((r) => ({
      ...r.data,
      slug: r.data.slug || slug,
      content_md: typeof r.data.content_md === "string" ? r.data.content_md : "",
    })),

  /** POST legal/accept/ — version opsiyonel (yoksa güncel sürüm); yanıt güncel AuthUser */
  accept: (slug: LegalDocumentSlug | (string & {}), version?: number | null) =>
    apiClient
      .post<AuthUser>("/legal/accept/", version != null ? { slug, version } : { slug })
      .then((r) => r.data),
};
