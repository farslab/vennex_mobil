import { useCallback } from "react";
import { useMutation } from "@tanstack/react-query";
import * as Sharing from "expo-sharing";
import { toast } from "@/design-system";
import { errorMessage } from "@/api/client";
import { downloadExport, type ExportTarget } from "@/api/exports";
import { XLSX_MIME } from "@/types/reports";

/** Web'deki "Excel" butonlarının karşılığı: indir → paylaşım sayfası. Çift dokunuşta tek indirme. */
export function useExcelExport() {
  const mutation = useMutation({
    mutationFn: (target: ExportTarget) => downloadExport(target),
    onSuccess: async (res) => {
      try {
        if (!(await Sharing.isAvailableAsync())) {
          toast.info(`Dosya indirildi (${res.fileName}) ancak bu cihazda paylaşım desteklenmiyor.`);
          return;
        }
        await Sharing.shareAsync(res.uri, { mimeType: XLSX_MIME, UTI: "org.openxmlformats.spreadsheetml.sheet", dialogTitle: res.fileName });
      } catch (e) {
        toast.error(errorMessage(e, "Dosya paylaşılamadı."));
      }
    },
    onError: (e) => toast.error(errorMessage(e, "Excel indirilemedi.")),
  });
  const { mutate, isPending } = mutation;
  // Kararlı referans: başlık gibi effect bağımlılıklarında her çizimde yeniden kurulmasın
  const run = useCallback(
    (target: ExportTarget) => {
      if (!isPending) mutate(target);
    },
    [mutate, isPending]
  );
  return { exporting: isPending, run };
}
