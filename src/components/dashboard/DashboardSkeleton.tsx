import React from "react";
import { StyleSheet, View } from "react-native";
import { AppSkeleton, makeStyles } from "@/design-system";

/** İlk yükleme iskeleti — KPI ızgarası + grafik + liste düzenini taklit eder */
export function DashboardSkeleton() {
  const styles = useStyles();
  return (
    <View style={styles.root} accessibilityRole="progressbar" accessibilityLabel="Panel yükleniyor" testID="dashboard-skeleton">
      <View style={styles.grid}>
        {[0, 1, 2, 3].map((i) => (
          <View key={i} style={styles.kpi}>
            <AppSkeleton width="55%" height={11} />
            <AppSkeleton width="70%" height={20} />
            <AppSkeleton width="45%" height={10} />
          </View>
        ))}
      </View>
      <View style={styles.card}>
        <AppSkeleton width="35%" height={14} />
        <AppSkeleton height={140} radius={8} />
      </View>
      <View style={styles.card}>
        {[0, 1, 2].map((i) => (
          <View key={i} style={styles.line}>
            <AppSkeleton width="50%" />
            <AppSkeleton width={64} />
          </View>
        ))}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { gap: t.layout.sectionGap },
    grid: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm },
    kpi: {
      flex: 1,
      minWidth: 140,
      gap: t.spacing.sm,
      padding: t.spacing.md,
      borderRadius: t.radius.md,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    card: {
      gap: t.spacing.md,
      padding: t.layout.cardPadding,
      borderRadius: t.radius.md,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    line: { flexDirection: "row", justifyContent: "space-between", gap: t.spacing.md },
  })
);
