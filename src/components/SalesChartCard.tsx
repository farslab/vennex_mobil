import React from "react";
import { Dimensions, StyleSheet, Text, View } from "react-native";
import { LineChart } from "react-native-gifted-charts";
import { ScreenCard } from "@/components/Common";
import { colors } from "@/theme/colors";
import { spacing } from "@/theme/spacing";

const screenWidth = Dimensions.get("window").width;

// TypeScript için Props Interface Tanımı
export interface SalesChartCardProps {
  labels?: string[];
  amounts?: number[];
  periodLabel?: string;
}

export function SalesChartCard({
  labels = [],
  amounts = [],
  periodLabel,
}: SalesChartCardProps) {
  if (!labels.length || !amounts.length) return null;

  // Gifted-charts verisinin hazırlanması
  const chartData = amounts.map((amount, index) => ({
    value: amount,
    label: labels[index] || "",
    dataPointText: amount > 0 ? `${amount}₺` : "",
  }));

  const maxAmount = Math.max(...amounts, 10);

  return (
    <ScreenCard>
      {/* Kart Başlığı */}
      <View style={styles.header}>
        <Text style={styles.cardLabel}>Satış Grafiği</Text>
        {periodLabel && <Text style={styles.periodText}>{periodLabel}</Text>}
      </View>

      {/* Çizgi Grafiği */}
      <View style={styles.chartWrapper}>
        <LineChart
          data={chartData}
          height={160}
          width={screenWidth - 80}
          areaChart
          curved
          color={colors.primary}
          startFillColor={colors.primary}
          endFillColor={colors.primary}
          startOpacity={0.25}
          endOpacity={0.01}
          spacing={42}
          initialSpacing={12}
          thickness={2.5}
          hideRules={false}
          rulesColor={colors.border}
          rulesType="solid"
          yAxisThickness={0}
          xAxisThickness={1}
          xAxisColor={colors.border}
          yAxisTextStyle={{ color: colors.textMuted, fontSize: 10 }}
          xAxisLabelTextStyle={{ color: colors.textMuted, fontSize: 10 }}
          dataPointsColor={colors.primary}
          dataPointsRadius={4}
          textColor1={colors.primary}
          textFontSize1={10}
          textShiftY={-10}
          textShiftX={-5}
          maxValue={maxAmount + maxAmount * 0.15}
          noOfSections={4}
        />
      </View>
    </ScreenCard>
  );
}

// Hem Named hem Default Export veriyoruz ki import çakışması yaşanmasın
export default SalesChartCard;

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.xs,
  },
  cardLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  periodText: {
    fontSize: 12,
    color: colors.textMuted,
  },
  chartWrapper: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.sm,
    marginLeft: -10,
  },
});