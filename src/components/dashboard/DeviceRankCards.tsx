import React from "react";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { AppEmptyState, AppIcon, AppSheet, AppText, makeStyles } from "@/design-system";
import { DashSection } from "./DashSection";
import { formatCurrency, formatInteger, formatPercent } from "@/utils/number";
import type { ErrorBreakdownItem, TopDevice } from "@/types/overview";

type OpenDevice = (sn: string, name?: string) => void;

/** İlk üç sıra rozeti: altın / gümüş / bronz */
const MEDALS = [
  { bg: "#FDE68A", fg: "#92400E" },
  { bg: "#E2E8F0", fg: "#334155" },
  { bg: "#FED7AA", fg: "#9A3412" },
] as const;

function DeviceRow({
  rank,
  name,
  sn,
  value,
  caption,
  onPress,
  last,
  testID,
  flush,
}: {
  rank: number;
  name: string;
  sn: string;
  value: string;
  caption: string;
  onPress: () => void;
  last: boolean;
  testID?: string;
  /** Alttan açılan sayfa içinde: yatay iç boşluk sayfadan gelir */
  flush?: boolean;
}) {
  const styles = useStyles();
  const medal = rank <= 3 ? MEDALS[rank - 1] : null;
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${rank}. ${name}, ${value}, ${caption}`}
      accessibilityHint="Cihaz detayını açar"
      style={({ pressed }) => [styles.row, flush && styles.rowFlush, !last && styles.rowBorder, pressed && styles.pressed]}
    >
      <View style={[styles.rank, medal && { backgroundColor: medal.bg }]}>
        <AppText variant="numericSm" weight="700" style={medal ? { color: medal.fg } : undefined} color={medal ? undefined : "textSecondary"}>
          {rank}
        </AppText>
      </View>
      {/* Ad tam genişlikte (2 satıra kadar); altında seri no + işlem solda, tutar sağda */}
      <View style={styles.body}>
        <AppText variant="calloutStrong" numberOfLines={2}>
          {name}
        </AppText>
        <View style={styles.meta}>
          <AppText variant="caption" color="textTertiary" numberOfLines={1} style={styles.flex}>
            {sn !== name ? `${sn} · ${caption}` : caption}
          </AppText>
          <AppText variant="numeric" weight="700" numberOfLines={1}>
            {value}
          </AppText>
        </View>
      </View>
      <AppIcon name="chevron-right" size={16} color="textTertiary" />
    </Pressable>
  );
}

/** En çok ciro yapan cihazlar — dokununca cihaz detayı */
export function TopDevicesCard({ items, onOpenDevice }: { items: TopDevice[]; onOpenDevice: OpenDevice }) {
  const styles = useStyles();
  return (
    <DashSection title="En Çok Satan Cihazlar" padded={false} testID="top-devices">
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
    </DashSection>
  );
}

/**
 * Teknik iptal (iptalNo=3) veren POS cihazlarının tamamı — web Genel Bakış "Teknik İptal — POS Dağılımı"
 * gibi; "Başarısızlık nedenleri → Teknik iptal" satırına dokununca alttan açılır (adet + pay).
 * Cihaza dokununca sayfa kapanır, ardından cihaz detayı açılır.
 */
export function TechnicalErrorsSheet({
  visible,
  onClose,
  items,
  onOpenDevice,
}: {
  visible: boolean;
  onClose: () => void;
  items: ErrorBreakdownItem[];
  onOpenDevice: OpenDevice;
}) {
  const styles = useStyles();
  const total = items.reduce((acc, d) => acc + d.count, 0);
  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title="Teknik İptal — POS Dağılımı"
      subtitle={`${formatInteger(items.length)} POS cihazı · ${formatInteger(total)} teknik iptal`}
      scrollable={false}
      testID="technical-errors-sheet"
    >
      <FlatList
        data={items}
        keyExtractor={(d, i) => `${d.sn}-${i}`}
        style={styles.sheetList}
        initialNumToRender={20}
        ListEmptyComponent={<AppEmptyState compact icon="check-circle" title="Teknik iptal yok" />}
        renderItem={({ item: d, index: i }) => (
          <DeviceRow
            testID={`technical-error-${d.sn}`}
            rank={i + 1}
            name={d.pos_name || d.sn}
            sn={d.sn}
            value={formatInteger(d.count)}
            caption={total > 0 ? `teknik iptal · ${formatPercent((d.count / total) * 100)}` : "teknik iptal"}
            onPress={() => {
              onClose();
              // Alttan açılan sayfa kapanmadan yeni ekran itilirse iOS'ta görünmez kalabilir
              setTimeout(() => onOpenDevice(d.sn, d.pos_name ?? undefined), SHEET_HANDOFF_MS);
            }}
            last={i === items.length - 1}
            flush
          />
        )}
      />
    </AppSheet>
  );
}

const SHEET_HANDOFF_MS = 350;

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1, minWidth: 0 },
    list: { marginTop: -t.spacing.xs },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      minHeight: 56,
      paddingVertical: t.spacing.md,
      paddingHorizontal: t.layout.cardPadding,
    },
    rowFlush: { paddingHorizontal: 0 },
    sheetList: { maxHeight: 460 },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    pressed: { backgroundColor: t.colors.surfacePressed },
    rank: {
      width: 28,
      height: 28,
      borderRadius: 14,
      backgroundColor: t.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    body: { flex: 1, minWidth: 0, gap: 4 },
    meta: { flexDirection: "row", alignItems: "baseline", gap: t.spacing.sm },
  })
);
