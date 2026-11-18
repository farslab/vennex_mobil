import { apiClient } from "./client";
import { unwrapResults } from "./pagination";
import type { CariInvoice, CariInvoicePdf, CariSummary, CompanyDetail } from "@/types/account";

/**
 * Şirket ve cari (Paraşüt) uçları — yalnız görüntüleme, ÖDEME YOK (backend urls.py:156).
 * - companies/: IsManagementUser, X-Company-Id okunmaz (views/companies.py)
 * - cari/*: IsOwner + X-Company-Id ile seçili şirket (views/payments.py)
 */
export const accountApi = {
  companies: (signal?: AbortSignal) =>
    apiClient
      .get<{ results?: CompanyDetail[] }>("/companies/", { signal })
      .then((r) => unwrapResults<CompanyDetail>(r.data)),

  /** Erişim yoksa 403 "Bu şirkete erişiminiz yok." */
  company: (id: number, signal?: AbortSignal) =>
    apiClient.get<CompanyDetail>(`/companies/${id}/`, { signal }).then((r) => r.data),

  cariSummary: (signal?: AbortSignal) => apiClient.get<CariSummary>("/cari/summary/", { signal }).then((r) => r.data),

  /** Sayfasız `{results}` — vade tarihine göre yeniden eskiye */
  cariInvoices: (signal?: AbortSignal) =>
    apiClient
      .get<{ results?: CariInvoice[] }>("/cari/invoices/", { signal })
      .then((r) => unwrapResults<CariInvoice>(r.data)),

  /** {pdf_url}; 404 e-belge yok, 502 Paraşüt hatası, 503 PDF hazır değil */
  cariInvoicePdf: (id: number) =>
    apiClient.get<CariInvoicePdf>(`/cari/invoices/${id}/pdf/`).then((r) => r.data),
};
