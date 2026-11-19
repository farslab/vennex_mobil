import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppBadge, AppEmptyState, AppIcon, AppText, makeStyles, useTheme } from "@/design-system";
import { DashSection } from "./DashSection";
import { ptBadge } from "@/components/devices/deviceHelpers";
import { webBadgeColors } from "@/components/devices/webBadgeColors";
import { formatCurrency } from "@/utils/number";
import { formatDateTime, formatTime } from "@/utils/date";
import type { RecentTransaction } from "@/types/overview";

/** Web Genel Bakış ile aynı: son 30 işlem; kartta ~5 satır görünür, fazlası kart içinde kaydırılır */
export const RECENT_TX_LIMIT = 30;
const VISIBLE_ROWS_HEIGHT = 5 * 60;

/** Son işlemler — web satırı: cihaz + tarih · ödeme tipi rozeti · tutar · durum. Dokununca cihaz detayı. */
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
  const { isDark, colors } = useTheme();
  return (
    <DashSection title="Son işlemler" padded={false} testID="recent-transactions">
      {items.length === 0 ? (
        <AppEmptyState compact icon="list" title="Bu dönemde işlem yok" />
      ) : (
        <ScrollView style={styles.list} nestedScrollEnabled showsVerticalScrollIndicator testID="recent-transactions-scroll">
          {items.map((tx, i) => {
            const device = tx.pos_name || tx.sn || "—";
            const title = device;
            const when = hourly ? formatTime(tx.datetime) : formatDateTime(tx.datetime);
            const pt = ptBadge(tx.pt_type);
            const sn = tx.sn;
            const body = (
              <>
                <View style={[styles.statusTile, { backgroundColor: tx.status ? colors.successSubtle : colors.dangerSubtle }]}>
                  <AppIcon name={tx.status ? "check" : "x"} size={15} color={tx.status ? "success" : "danger"} />
                </View>
                <View style={styles.flex}>
                  <AppText variant="calloutStrong" numberOfLines={1}>
                    {title}
                  </AppText>
                  <AppText variant="caption" color="textTertiary" numberOfLines={1}>
                    {when}
                    {tx.product_name ? ` · ${tx.product_name}` : ""}
                    {tx.card_pan ? ` · ${tx.card_pan}` : ""}
                  </AppText>
                </View>
                <View style={styles.right}>
                  <AppText variant="numeric" weight="700" color={tx.status ? "text" : "textTertiary"}>
                    {formatCurrency(tx.amount)}
                  </AppText>
                  <View style={styles.badges}>
                    <AppBadge size="sm" label={pt.label} colors={webBadgeColors(pt.color, isDark)} />
                    {!tx.status ? <AppBadge label="Başarısız" tone="danger" size="sm" /> : null}
                  </View>
                </View>
              </>
            );
            const rowStyle = [styles.row, i < items.length - 1 && styles.rowBorder];
            const label = `${device}, ${when}, ${pt.label}, ${formatCurrency(tx.amount)}, ${tx.status ? "başarılı" : "başarısız"}`;
            return sn ? (
              <Pressable
                key={`${tx.id}-${i}`}
                onPress={() => onOpenDevice(sn, tx.pos_name ?? undefined)}
                accessibilityRole="button"
                accessibilityLabel={label}
                accessibilityHint="POS cihazı detayını açar"
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
        </ScrollView>
      )}
    </DashSection>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    // Kart köşeleri yuvarlak; kaydırılan satırlar köşeden taşmasın
    list: { maxHeight: VISIBLE_ROWS_HEIGHT, borderRadius: 16, overflow: "hidden" },
    badges: { flexDirection: "row", gap: 4 },
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
    statusTile: { width: 30, height: 30, borderRadius: 15, alignItems: "center", justifyContent: "center" },
  })
);
