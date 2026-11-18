/**
 * Sunucu yapılandırması — web ile AYNI kaynak (backend dashboard_v2/capabilities.py).
 *
 *  GET /app/min-version/  (oturumsuz) → mağaza sürüm politikası, zorunlu güncelleme
 *  GET /app/config/       (oturumlu)  → yetkiler, görünür modüller, enum etiketleri, özellik bayrakları
 *
 * Mobil uygulama modül görünürlüğünü ve etiketleri sabit kodlamaz; sunucudan okur.
 * Sunucu eski sürümse (uç yoksa) istemcideki yerel kurallar yedek olarak kullanılır.
 */
import { Platform } from "react-native";
import * as Application from "expo-application";
import Constants from "expo-constants";
import { apiClient } from "./client";

export interface EnumOption {
  value: string | number | boolean;
  label: string;
  tone?: "success" | "warning" | "danger" | "info" | "neutral";
}

export interface PlatformVersionPolicy {
  min_version: string;
  latest_version: string;
  force_update: boolean;
  store_url: string;
  message: string;
}

export interface VersionPolicyResponse {
  ios_min?: string;
  android_min?: string;
  force_update?: boolean;
  store_urls?: { ios?: string; android?: string };
  platforms?: { ios?: PlatformVersionPolicy; android?: PlatformVersionPolicy };
  status?: { platform: string; app_version: string; update_required: boolean; update_available: boolean };
}

export interface AppConfig {
  schema_version: number;
  permissions: string[];
  modules: { key: string; label: string; icon: string }[];
  company_id: number | null;
  enums: Record<string, EnumOption[]>;
  features: { key: string; label: string; enabled: boolean; note?: string }[];
  version_policy: VersionPolicyResponse;
}

/** Mağaza (native) sürümü; native modül yoksa (test/web) uygulama yapılandırmasındaki sürüm */
export function nativeAppVersion(): string {
  return Application.nativeApplicationVersion ?? Constants.expoConfig?.version ?? "0.0.0";
}

export function clientPlatform(): "ios" | "android" | null {
  return Platform.OS === "ios" || Platform.OS === "android" ? Platform.OS : null;
}

export const appConfigApi = {
  versionPolicy: (signal?: AbortSignal) =>
    apiClient
      .get<VersionPolicyResponse>("/app/min-version/", {
        params: { platform: clientPlatform() ?? undefined, version: nativeAppVersion() },
        skipAuth: true,
        signal,
      })
      .then((r) => r.data),

  config: (signal?: AbortSignal) =>
    apiClient
      .get<AppConfig>("/app/config/", {
        params: { platform: clientPlatform() ?? undefined, version: nativeAppVersion() },
        signal,
      })
      .then((r) => normalizeConfig(r.data)),
};

export function normalizeConfig(raw: Partial<AppConfig> | null | undefined): AppConfig {
  return {
    schema_version: Number(raw?.schema_version) || 1,
    permissions: Array.isArray(raw?.permissions) ? raw!.permissions.filter((p) => typeof p === "string") : [],
    modules: Array.isArray(raw?.modules) ? raw!.modules.filter((m) => m && typeof m.key === "string") : [],
    company_id: raw?.company_id ?? null,
    enums: raw?.enums && typeof raw.enums === "object" ? raw.enums : {},
    features: Array.isArray(raw?.features) ? raw!.features : [],
    version_policy: raw?.version_policy ?? {},
  };
}

/** Sürüm karşılaştırma: "1.10.0" > "1.9.9" */
export function compareVersions(a: string, b: string): number {
  const pa = String(a).split(".").map((x) => parseInt(x.replace(/\D/g, ""), 10) || 0);
  const pb = String(b).split(".").map((x) => parseInt(x.replace(/\D/g, ""), 10) || 0);
  for (let i = 0; i < Math.max(pa.length, pb.length, 3); i++) {
    const d = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (d !== 0) return d > 0 ? 1 : -1;
  }
  return 0;
}

/**
 * Sunucu `status` döndürmezse (eski backend) yerelde hesaplar.
 * Yalnız politika `force_update` açıksa engeller.
 */
export function evaluateVersionPolicy(
  policy: VersionPolicyResponse | undefined,
  platform: "ios" | "android" | null,
  version: string
): { required: boolean; available: boolean; storeUrl: string; message: string } {
  const empty = { required: false, available: false, storeUrl: "", message: "" };
  if (!policy || !platform) return empty;
  const p = policy.platforms?.[platform];
  const storeUrl = p?.store_url || policy.store_urls?.[platform] || "";
  const message = p?.message || "";
  if (policy.status) {
    return { required: !!policy.status.update_required, available: !!policy.status.update_available, storeUrl, message };
  }
  const min = p?.min_version ?? (platform === "ios" ? policy.ios_min : policy.android_min);
  const latest = p?.latest_version ?? min;
  const force = p?.force_update ?? !!policy.force_update;
  return {
    required: !!min && force && compareVersions(version, min) < 0,
    available: !!latest && compareVersions(version, latest) < 0,
    storeUrl,
    message,
  };
}
