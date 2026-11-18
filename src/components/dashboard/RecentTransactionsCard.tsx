import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppBadge, AppCard, AppEmptyState, AppText, makeStyles } from "@/design-system";
import { formatCurrency } from "@/utils/number";
import { formatDateTime, formatTime } from "@/utils/date";
import type { RecentTransaction } from "@/types/overview";

/** Son işlemler — dokununca ilgili cihazın detayı açılır */
export function RecentTransactionsCard({
  items,
  hourly,
  onOpenDevice,
}: {
  items: RecentTransaction[];
  /** Tek günlük dönemlerde yalnız saat gösterilir */
  hourly: boolean;
  onOpenDevice: (sn: string, name?: string) => void;
}) {
  const styles = useStyles();
  return (
    <AppCard title="Son işlemler" padded={false} testID="recent-transactions">
      {items.length === 0 ? (
        <AppEmptyState compact icon="list" title="Bu dönemde işlem yok" />
      ) : (
        <View style={styles.list}>
          {items.map((tx, i) => {
            const title = tx.product_name || tx.pt_type_label || "İşlem";
            const when = hourly ? formatTime(tx.datetime) : formatDateTime(tx.datetime);
            const device = tx.pos_name || tx.sn || "—";
            const sn = tx.sn;
            const body = (
              <>
                <View style={styles.flex}>
                  <AppText variant="callout" numberOfLines={1}>
                    {title}
                  </AppText>
                  <AppText variant="caption" color="textTertiary" numberOfLines={1}>
                    {device} · {when}
                    {tx.card_pan ? ` · ${tx.card_pan}` : ""}
                  </AppText>
                </View>
                <View style={styles.right}>
                  <AppText variant="numeric" color={tx.status ? "text" : "textTertiary"}>
                    {formatCurrency(tx.amount)}
                  </AppText>
                  {tx.status ? (
                    <AppText variant="caption" color="textTertiary" numberOfLines={1}>
                      {tx.pt_type_label || "—"}
                    </AppText>
                  ) : (
                    <AppBadge label="Başarısız" tone="danger" size="sm" />
                  )}
                </View>
              </>
            );
            const rowStyle = [styles.row, i < items.length - 1 && styles.rowBorder];
            const label = `${title}, ${device}, ${when}, ${formatCurrency(tx.amount)}, ${tx.status ? "başarılı" : "başarısız"}`;
            return sn ? (
              <Pressable
                key={`${tx.id}-${i}`}
                onPress={() => onOpenDevice(sn, tx.pos_name ?? undefined)}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityHint="Cihaz detayını açar"
                style={({ pressed }) => [...rowStyle, pressed && styles.pressed]}
              >
                {body}
              </Pressable>
            ) : (
              <View key={`${tx.id}-${i}`} style={rowStyle} accessible accessibilityLabel={label}>
                {body}
              </View>
            );
          })}
        </View>
      )}
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
    right: { alignItems: "flex-end", gap: 2, maxWidth: "45%" },
  })
);
