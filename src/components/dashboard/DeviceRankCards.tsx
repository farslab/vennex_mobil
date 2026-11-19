import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppCard, AppEmptyState, AppIcon, AppText, makeStyles } from "@/design-system";
import { formatCurrency, formatInteger } from "@/utils/number";
import type { ErrorBreakdownItem, TopDevice } from "@/types/overview";

type OpenDevice = (sn: string, name?: string) => void;

function DeviceRow({
  rank,
  name,
  sn,
  value,
  caption,
  onPress,
  last,
  testID,
}: {
  rank: number;
  name: string;
  sn: string;
  value: string;
  caption: string;
  onPress: () => void;
  last: boolean;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${rank}. ${name}, ${value}, ${caption}`}
      accessibilityHint="Cihaz detayını açar"
      style={({ pressed }) => [styles.row, !last && styles.rowBorder, pressed && styles.pressed]}
    >
      <View style={styles.rank}>
        <AppText variant="numericSm" color="textSecondary">
          {rank}
        </AppText>
      </View>
      <View style={styles.flex}>
        <AppText variant="callout" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="mono" color="textTertiary" numberOfLines={1}>
          {sn}
        </AppText>
      </View>
      <View style={styles.right}>
        <AppText variant="numeric">{value}</AppText>
        <AppText variant="caption" color="textTertiary">
          {caption}
        </AppText>
      </View>
      <AppIcon name="chevron-right" size={16} color="textTertiary" />
    </Pressable>
  );
}

/** En çok ciro yapan cihazlar — dokununca cihaz detayı */
export function TopDevicesCard({ items, onOpenDevice }: { items: TopDevice[]; onOpenDevice: OpenDevice }) {
  const styles = useStyles();
  return (
    <AppCard title="En çok satan POS cihazları" padded={false} testID="top-devices">
      {items.length === 0 ? (
        <AppEmptyState compact icon="pos" title="Bu dönemde satış yok" />
      ) : (
        <View style={styles.list}>
          {items.map((d, i) => (
            <DeviceRow
              key={`${d.sn}-${i}`}
              testID={`top-device-${d.sn}`}
              rank={i + 1}
              name={d.pos_name || d.sn}
              sn={d.sn}
              value={formatCurrency(d.revenue)}
              caption={`${formatInteger(d.tx_count)} işlem`}
              onPress={() => onOpenDevice(d.sn, d.pos_name ?? undefined)}
              last={i === items.length - 1}
            />
          ))}
        </View>
      )}
    </AppCard>
  );
}

/** Teknik hata (iptalNo=3) veren cihazlar — yalnız kayıt varsa gösterilir */
export function TechnicalErrorsCard({ items, onOpenDevice }: { items: ErrorBreakdownItem[]; onOpenDevice: OpenDevice }) {
  const styles = useStyles();
  if (items.length === 0) return null;
  const shown = items.slice(0, 5);
  return (
    <AppCard
      title="Teknik hata veren POS cihazları"
      subtitle={items.length > shown.length ? `İlk ${shown.length} / ${items.length} POS cihazı` : undefined}
      padded={false}
      testID="technical-errors"
    >
      <View style={styles.list}>
        {shown.map((d, i) => (
          <DeviceRow
            key={`${d.sn}-${i}`}
            rank={i + 1}
            name={d.pos_name || d.sn}
            sn={d.sn}
            value={formatInteger(d.count)}
            caption="teknik hata"
            onPress={() => onOpenDevice(d.sn, d.pos_name ?? undefined)}
            last={i === shown.length - 1}
          />
        ))}
      </View>
    </AppCard>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    list: { marginTop: -t.spacing.xs },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      minHeight: 56,
      paddingVertical: t.spacing.sm,
      paddingHorizontal: t.layout.cardPadding,
    },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    pressed: { backgroundColor: t.colors.surfacePressed },
    rank: {
      width: 24,
      height: 24,
      borderRadius: t.radius.xs,
      backgroundColor: t.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    right: { alignItems: "flex-end" },
  })
);
