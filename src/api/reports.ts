import * as FileSystem from "expo-file-system";
import { apiClient } from "./client";
import { tokenStorage } from "@/utils/tokenStorage";
import type { CreateReportPayload, ReportFilterOptions, ReportJob, ReportListResponse } from "@/types/reports";

export const reportsApi = {
  list: () => apiClient.get<ReportListResponse>("/reports/").then((r) => r.data),

  filterOptions: () => apiClient.get<ReportFilterOptions>("/reports/filter-options/").then((r) => r.data),

  create: (payload: CreateReportPayload) =>
    apiClient
      .post<{ job_id: number; status: string; estimated_rows: number; detail: string }>("/reports/", payload)
      .then((r) => r.data),

  detail: (id: number) => apiClient.get<ReportJob>(`/reports/${id}/`).then((r) => r.data),

  cancel: (id: number) => apiClient.post(`/reports/${id}/cancel/`),

  retry: (id: number) => apiClient.post(`/reports/${id}/retry/`),

  remove: (id: number) => apiClient.delete(`/reports/${id}/`),

  // Binary stream indirme — expo-file-system ile cihaza indirir (Dio.download karşılığı)
  download: async (id: number, suggestedFileName = `rapor-${id}`) => {
    const access = await tokenStorage.getAccess();
    const baseUrl = apiClient.defaults.baseURL ?? "";
    const url = `${baseUrl}/reports/${id}/download/`;
    const dest = `${FileSystem.documentDirectory}${suggestedFileName}`;

    const result = await FileSystem.downloadAsync(url, dest, {
      headers: access ? { Authorization: `Bearer ${access}` } : undefined,
    });
    return result.uri;
  },
};
