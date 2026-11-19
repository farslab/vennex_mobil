import React, { useLayoutEffect } from "react";
import { useNavigation } from "@react-navigation/native";
import { AppIconButton } from "@/design-system";
import { useExcelExport } from "@/hooks/useExcelExport";
import { TabHeader } from "./TabHeader";

type ExportRequest = { path: string; name: string };

/**
 * Sekme başlığında, bildirim zilinin yanında Excel düğmesi (Genel Bakış ile aynı görünüm).
 * `request` null ise düğme gösterilmez; ekran/alt sekme ayrılınca başlık sade haline döner.
 */
export function useHeaderExcel(title: string, request: ExportRequest | null, testID = "header-excel") {
  const navigation = useNavigation();
  const { exporting, run } = useExcelExport();
  const path = request?.path ?? null;
  const name = request?.name ?? null;

  useLayoutEffect(() => {
    navigation.setOptions({
      header: () => (
        <TabHeader
          title={title}
          right={
            path && name ? (
              <AppIconButton
                icon="excel"
                label="Excel'e aktar"
                tone="success"
                loading={exporting}
                onPress={() => run({ path, name })}
                testID={testID}
              />
            ) : null
          }
        />
      ),
    });
    return () => navigation.setOptions({ header: () => <TabHeader title={title} /> });
  }, [navigation, title, path, name, exporting, run, testID]);
}
