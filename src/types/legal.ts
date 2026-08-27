export type LegalDocumentSlug = "privacy" | "kvkk" | "terms";

export const LEGAL_DEFAULT_TITLES: Record<LegalDocumentSlug, string> = {
  privacy: "Gizlilik Sözleşmesi",
  kvkk: "KVKK Aydınlatma Metni",
  terms: "Kullanım Koşulları",
};

export interface LegalDocument {
  slug: string;
  title: string;
  content_md: string;
  web_url?: string | null;
  version?: number | null;
  updated_at?: string | null;
}
