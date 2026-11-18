import React from "react";
import { StyleSheet, View } from "react-native";
import { AppIcon, AppText, makeStyles } from "@/design-system";
import { movementDirection } from "@/api/stock";
import { formatDateTime } from "@/utils/date";
import { EMPTY_VALUE } from "@/utils/number";
import { formatSignedQuantity, movementMeta } from "@/components/stock/stockFormat";
import type { StockBaseUnit, StockMovement } from "@/types/stock";

export interface MovementRowProps {
  movement: StockMovement;
  /** Lokasyon detayında: yön bu lokasyona göre (+ giriş / − çıkış) hesaplanır */
  locationId?: number;
  unit?: StockBaseUnit | null;
}

export function MovementRow({ movement: m, locationId, unit }: MovementRowProps) {
  const styles = useStyles();
  const meta = movementMeta(m.movement_type, m.movement_type_display);
  const dir = movementDirection(m, locationId);
  const qty = formatSignedQuantity(m.quantity, dir, unit);
  const route =
    m.from_location_name && m.to_location_name
      ? `${m.from_location_name} → ${m.to_location_name}`
      : (m.to_location_name ?? m.from_location_name ?? EMPTY_VALUE);
  const dirWord = dir > 0 ? "giriş" : dir < 0 ? "çıkış" : "";

  return (
    <View
      style={styles.row}
      accessible
      accessibilityLabel={`${meta.label}, ${m.sku_name}, ${qty}${dirWord ? ` ${dirWord}` : ""}, ${route}, ${formatDateTime(m.created_at)}`}
    >
      <View style={styles.icon}>
        <AppIcon name={meta.icon} size={16} color="textSecondary" />
      </View>
      <View style={styles.body}>
        <View style={styles.line}>
          <AppText variant="calloutStrong" numberOfLines={1} style={styles.flex}>
            {m.sku_name || EMPTY_VALUE}
          </AppText>
          <AppText variant="numeric" color={dir > 0 ? "success" : dir < 0 ? "danger" : "text"} testID={`movement-qty-${m.id}`}>
            {qty}
          </AppText>
        </View>
        <AppText variant="caption" color="textSecondary" numberOfLines={1}>
          {meta.label} · {route}
        </AppText>
        <AppText variant="caption" color="textTertiary" numberOfLines={1}>
          {formatDateTime(m.created_at)}
          {m.created_by_username ? ` · ${m.created_by_username}` : ""}
        </AppText>
        {m.reason ? (
          <AppText variant="caption" color="textSecondary" numberOfLines={2}>
            “{m.reason}”
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      gap: t.spacing.md,
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.layout.screenPadding,
      backgroundColor: t.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    icon: {
      width: 32,
      height: 32,
      borderRadius: t.radius.xs,
      backgroundColor: t.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    body: { flex: 1, gap: 2 },
    line: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    flex: { flex: 1 },
  })
);
