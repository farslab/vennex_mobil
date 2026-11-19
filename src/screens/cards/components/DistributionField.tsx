import React from "react";
import { StyleSheet, View } from "react-native";
import { AppSegmented, AppText, makeStyles } from "@/design-system";
import type { QuotaDistribution } from "@/types/cards";

/** Web istihkak formundaki "Dağıtım" seçimi (`personel_card_quotas.html:204-218`) */
export function DistributionField({ value, onChange }: { value: QuotaDistribution; onChange: (v: QuotaDistribution) => void }) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <AppText variant="label" color="textSecondary">
        Dağıtım
      </AppText>
      <AppSegmented<QuotaDistribution>
        items={[
          { key: "ayri", label: "Her ürüne ayrı" },
          { key: "havuz", label: "Havuz (tek hak)" },
        ]}
        value={value}
        onChange={onChange}
        testID="quota-distribution"
      />
      <AppText variant="caption" color="textTertiary">
        {value === "havuz"
          ? '"1,2,3" + miktar 1 → hangisi alınırsa toplam 1 hak'
          : '"1,2,3" + miktar 1 → her birine 1, toplam 3 hak'}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((t) => StyleSheet.create({ field: { gap: t.spacing.xs } }));
