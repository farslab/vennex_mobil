/**
 * Bölge & konum (owner) — backend vennex_mobile/views/regions.py
 *   GET/POST   /regions/                 {results: Region[]}  (konumlar + cihaz sayıları gömülü; 600 sn önbellek,
 *                                         her yazmada şirket önbellek sürümü artırılır → liste hep taze)
 *   PATCH/DELETE /regions/{id}/
 *   POST       /locations/               {region, name, address?, latitude?, longitude?, is_active}
 *   PATCH/DELETE /locations/{id}/
 */
import { apiClient } from "./client";
import { unwrapResults } from "./pagination";
import { toNumber } from "@/utils/number";

export interface RegionLocation {
  id: number;
  name: string;
  address: string;
  latitude: number | null;
  longitude: number | null;
  is_active: boolean;
  pos_device_count: number;
}

export interface Region {
  id: number;
  name: string;
  description: string | null;
  total_pos_device_count: number;
  locations: RegionLocation[];
  created_at: string | null;
}

export interface LocationPayload {
  region: number;
  name: string;
  address?: string;
  latitude?: string | null;
  longitude?: string | null;
  is_active?: boolean;
}

function normalizeLocation(raw: Record<string, unknown>): RegionLocation {
  return {
    id: Number(raw.id),
    name: String(raw.name ?? ""),
    address: String(raw.address ?? ""),
    latitude: toNumber(raw.latitude),
    longitude: toNumber(raw.longitude),
    is_active: raw.is_active !== false,
    pos_device_count: toNumber(raw.pos_device_count) ?? 0,
  };
}

export function normalizeRegion(raw: Record<string, unknown>): Region {
  const locations = Array.isArray(raw.locations) ? (raw.locations as Record<string, unknown>[]).map(normalizeLocation) : [];
  return {
    id: Number(raw.id),
    name: String(raw.name ?? ""),
    description: typeof raw.description === "string" && raw.description.trim() ? raw.description : null,
    total_pos_device_count:
      toNumber(raw.total_pos_device_count) ?? locations.reduce((sum, l) => sum + l.pos_device_count, 0),
    locations,
    created_at: typeof raw.created_at === "string" ? raw.created_at : null,
  };
}

export const regionsApi = {
  list: (signal?: AbortSignal) =>
    apiClient
      .get<{ results: Record<string, unknown>[] }>("/regions/", { signal })
      .then((r) => unwrapResults(r.data).map(normalizeRegion)),

  createRegion: (name: string, description?: string) =>
    apiClient.post("/regions/", { name, description: description || null }).then((r) => normalizeRegion(r.data)),

  updateRegion: (id: number, patch: { name?: string; description?: string | null }) =>
    apiClient.patch(`/regions/${id}/`, patch).then((r) => normalizeRegion(r.data)),

  deleteRegion: (id: number) => apiClient.delete(`/regions/${id}/`),

  createLocation: (payload: LocationPayload) =>
    apiClient.post("/locations/", payload).then((r) => normalizeLocation(r.data)),

  updateLocation: (id: number, patch: Partial<LocationPayload>) =>
    apiClient.patch(`/locations/${id}/`, patch).then((r) => normalizeLocation(r.data)),

  deleteLocation: (id: number) => apiClient.delete(`/locations/${id}/`),
};
