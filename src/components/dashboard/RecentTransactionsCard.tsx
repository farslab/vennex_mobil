import React from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { AppEmptyState, AppText, makeStyles, useTheme } from "@/design-system";
import { DashSection } from "./DashSection";
import { ptBadge } from "@/components/devices/deviceHelpers";
import { webBadgeColors } from "@/components/devices/webBadgeColors";
import { formatCurrency } from "@/utils/number";
import { formatDate, formatDateTime, formatTime } from "@/utils/date";
import type { RecentTransaction } from "@/types/overview";

/** Web Genel Bakış ile aynı: son 30 işlem; kartta ~5 satır görünür, fazlası kart içinde kaydırılır */
export const RECENT_TX_LIMIT = 30;
const VISIBLE_ROWS_HEIGHT = 5 * 62;

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
            const when = hourly ? formatTime(tx.datetime) : formatDateTime(tx.datetime);
            const pt = ptBadge(tx.pt_type);
            const ptColor = webBadgeColors(pt.color, isDark).fg;
            const sn = tx.sn;
            // Ürün varsa başlık ürün, altında cihaz; yoksa başlık cihaz
            const primary = tx.product_name || device;
            const secondary = [tx.product_name ? device : null, tx.card_pan].filter(Boolean).join(" · ");
            const body = (
              <>
                {/* Saat sütunu (çok günlük dönemde altında gün.ay) — durum rengiyle sol şerit */}
                <View style={[styles.timeCol, { borderLeftColor: tx.status ? colors.success : colors.danger }]}>
                  <AppText variant="numericSm" weight="700" numberOfLines={1}>
                    {formatTime(tx.datetime)}
                  </AppText>
                  {!hourly ? (
                    <AppText variant="caption" color="textTertiary" numberOfLines={1}>
                      {formatDate(tx.datetime).slice(0, 5)}
                    </AppText>
                  ) : null}
                </View>
                <View style={styles.flex}>
                  <AppText variant="calloutStrong" numberOfLines={1}>
                    {primary}
                  </AppText>
                  {secondary ? (
                    <AppText variant="caption" color="textTertiary" numberOfLines={1}>
                      {secondary}
                    </AppText>
                  ) : null}
                </View>
                <View style={styles.right}>
                  <AppText
                    variant="numeric"
                    weight="700"
                    color={tx.status ? "text" : "textTertiary"}
                    style={!tx.status && styles.failedAmount}
                    numberOfLines={1}
                  >
                    {formatCurrency(tx.amount)}
                  </AppText>
                  {tx.status ? (
                    <View style={styles.pt}>
                      <View style={[styles.ptDot, { backgroundColor: ptColor }]} />
                      <AppText variant="caption" weight="600" style={{ color: ptColor }} numberOfLines={1}>
                        {pt.label}
                      </AppText>
                    </View>
                  ) : (
                    <AppText variant="caption" weight="700" color="danger" numberOfLines={1}>
                      Başarısız · {pt.label}
                    </AppText>
                  )}
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
    flex: { flex: 1, minWidth: 0, gap: 2 },
    // Kart köşeleri yuvarlak; kaydırılan satırlar köşeden taşmasın
    list: { maxHeight: VISIBLE_ROWS_HEIGHT, borderRadius: 16, overflow: "hidden" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      minHeight: 62,
      paddingVertical: t.spacing.sm,
      paddingHorizontal: t.layout.cardPadding,
    },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    pressed: { backgroundColor: t.colors.surfacePressed },
    timeCol: { width: 52, borderLeftWidth: 3, borderRadius: 2, paddingLeft: t.spacing.sm, justifyContent: "center", minHeight: 34 },
    right: { alignItems: "flex-end", gap: 2, maxWidth: "42%" },
    failedAmount: { textDecorationLine: "line-through" },
    pt: { flexDirection: "row", alignItems: "center", gap: 5 },
    ptDot: { width: 7, height: 7, borderRadius: 4 },
  })
);
