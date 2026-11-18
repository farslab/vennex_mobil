import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppButton, AppInput, AppNotice, AppSheet, AppText, makeStyles } from "@/design-system";
import {
  MAX_CUSTOM_RANGE_DAYS,
  apiDateToInput,
  validateCustomRange,
  type CustomRange,
} from "@/screens/dashboard/dashboardPeriod";

export interface CustomRangeSheetProps {
  visible: boolean;
  initial: CustomRange | null;
  onClose: () => void;
  onApply: (range: CustomRange) => void;
}

/** Özel tarih aralığı — GG.AA.YYYY girişleri, en fazla 92 gün, bitiş bugünü geçemez */
export function CustomRangeSheet({ visible, initial, onClose, onApply }: CustomRangeSheetProps) {
  const styles = useStyles();
  // Sayfa her açılışta yeniden mount edilir (çağıran `key` verir) → başlangıç değerleri props'tan
  const [start, setStart] = useState(() => apiDateToInput(initial?.start));
  const [end, setEnd] = useState(() => apiDateToInput(initial?.end));
  const [error, setError] = useState<{ field: "start" | "end" | "range"; message: string } | null>(null);

  const apply = () => {
    const result = validateCustomRange(start, end);
    if (!result.ok) {
      setError({ field: result.field, message: result.message });
      return;
    }
    onApply(result.range);
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title="Özel tarih aralığı"
      subtitle={`En fazla ${MAX_CUSTOM_RANGE_DAYS} gün · bitiş günü dahil`}
      testID="custom-range-sheet"
      footer={
        <>
          <AppButton title="Vazgeç" variant="outline" onPress={onClose} style={styles.flex} />
          <AppButton title="Uygula" onPress={apply} style={styles.flex} testID="custom-range-apply" />
        </>
      }
    >
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppInput
            label="Başlangıç"
            placeholder="GG.AA.YYYY"
            value={start}
            onChangeText={(v) => {
              setStart(v);
              setError(null);
            }}
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
            maxLength={10}
            error={error?.field === "start" ? error.message : null}
            testID="custom-range-start"
          />
        </View>
        <View style={styles.flex}>
          <AppInput
            label="Bitiş"
            placeholder="GG.AA.YYYY"
            value={end}
            onChangeText={(v) => {
              setEnd(v);
              setError(null);
            }}
            keyboardType="numbers-and-punctuation"
            autoCorrect={false}
            maxLength={10}
            error={error?.field === "end" ? error.message : null}
            testID="custom-range-end"
          />
        </View>
      </View>
      {error?.field === "range" ? <AppNotice tone="danger" message={error.message} /> : null}
      <AppText variant="caption" color="textTertiary">
        Karşılaştırma, seçilen aralıkla aynı uzunluktaki önceki dönemle yapılır.
      </AppText>
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    row: { flexDirection: "row", gap: t.spacing.md },
  })
);
