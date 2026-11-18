export type LegalDocumentSlug = "privacy" | "kvkk" | "terms";

export const LEGAL_SLUGS: readonly LegalDocumentSlug[] = ["kvkk", "privacy", "terms"];

export const LEGAL_DEFAULT_TITLES: Record<LegalDocumentSlug, string> = {
  privacy: "Gizlilik Politikası",
  kvkk: "KVKK Aydınlatma Metni",
  terms: "Kullanım Koşulları",
};

/** Bilinmeyen slug için de güvenli başlık */
export function legalTitle(slug: string, fromServer?: string | null): string {
  if (fromServer && fromServer.trim()) return fromServer;
  return LEGAL_DEFAULT_TITLES[slug as LegalDocumentSlug] ?? "Yasal belge";
}

/** GET legal/{slug}/ — backend `views/legal.py::LegalDocumentView` */
export interface LegalDocument {
  slug: string;
  title: string;
  content_md: string;
  web_url?: string | null;
  version?: number | null;
  updated_at?: string | null;
}
