/**
 * Web'deki Excel butonlarının mobil karşılıkları (aynı backend içeriği):
 * - Cihaz listesi      GET /pos-devices/export/              (web `export_pos_devices`, herkes)
 * - Cihaz ürünleri     GET /pos-devices/<sn>/export-products/ (web `export_pos_products`)
 * - Personel kartları  GET /cards/export/                     (web `export_nfc_cards`, kart yetkisi)
 * - Stok özeti         GET /stock/export/overview/            (web `stock_overview_excel`, stok yetkisi)
 * Şirket kapsamı `X-Company-Id` ile (web: oturumdaki şirket).
 */
import { Directory, File, Paths } from "expo-file-system";
import { apiClient, type ApiError } from "./client";
import { authApi } from "./auth";
import { ensureXlsxExtension, sanitizeFileName } from "./reports";
import { tokenStorage } from "@/utils/tokenStorage";
import { useAuthStore } from "@/store/authStore";

export const EXPORTS = {
  devices: { path: "/pos-devices/export/", name: "pos_cihazlari" },
  deviceProducts: (sn: string) => ({ path: `/pos-devices/${encodeURIComponent(sn)}/export-products/`, name: `urunler_${sn}` }),
  cards: { path: "/cards/export/", name: "nfc_kartlar" },
  stockOverview: { path: "/stock/export/overview/", name: "stok_ozeti" },
} as const;

export interface ExportTarget {
  path: string;
  /** Content-Disposition yoksa kullanılacak ad (uzantısız) */
  name: string;
}

function exportError(message: string, status?: number): ApiError {
  const err = new Error(message) as ApiError;
  err.status = status;
  return err;
}

function mapError(e: unknown): ApiError {
  const msg = e instanceof Error ? e.message : String(e ?? "");
  const status = Number(/\b(4\d\d|5\d\d)\b/.exec(msg)?.[1]) || undefined;
  if (status === 401) return exportError("Oturumunuzun süresi doldu. Tekrar giriş yapıp deneyin.", 401);
  if (status === 403) return exportError("Bu dosyayı indirme yetkiniz yok.", 403);
  if (status === 400) return exportError("Önce bir şirket seçin.", 400);
  if (status && status >= 500) return exportError("Sunucu dosyayı şu anda hazırlayamıyor. Biraz sonra tekrar deneyin.", status);
  return exportError("Excel indirilemedi. Bağlantınızı kontrol edip tekrar deneyin.", status);
}

const stamp = (d = new Date()) =>
  `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}_${String(d.getHours()).padStart(2, "0")}${String(d.getMinutes()).padStart(2, "0")}`;

/** Dosyayı önbelleğe indirir; paylaşım çağıranın işidir */
export async function downloadExport(target: ExportTarget, signal?: AbortSignal): Promise<{ uri: string; fileName: string }> {
  // Token tazeliği: 401'de istemci tek refresh yapar (indirme isteği interceptor'dan geçmez)
  await authApi.me(signal);
  const access = await tokenStorage.getAccess();
  const companyId = useAuthStore.getState().selectedCompanyId;
  // Accept */*: yalnız JSON renderer'lı DRF görünümü XLSX Accept'ini 406 ile reddeder
  const headers: Record<string, string> = { Accept: "*/*" };
  if (access) headers.Authorization = `Bearer ${access}`;
  if (companyId != null) headers["X-Company-Id"] = String(companyId);

  let file: File;
  try {
    const dir = new Directory(Paths.cache, "exports", `${Date.now()}`);
    dir.create({ intermediates: true, idempotent: true });
    file = await File.downloadFileAsync(`${apiClient.defaults.baseURL ?? ""}${target.path}`, dir, { headers, idempotent: true, signal });
  } catch (e) {
    throw mapError(e);
  }
  const nativeName = file.name || "";
  const generic = !nativeName || /^(download|export(-products)?|overview)(\.\w+)?$/i.test(nativeName);
  const fileName = generic ? ensureXlsxExtension(`${sanitizeFileName(target.name)}_${stamp()}`) : ensureXlsxExtension(nativeName);
  if (fileName !== nativeName) {
    try {
      file.rename(fileName);
    } catch {
      return { uri: file.uri, fileName: nativeName };
    }
  }
  return { uri: file.uri, fileName };
}
