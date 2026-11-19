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
  share,
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
  /** 0..1 — listedeki en yüksek değere göre pay çubuğu (verilirse) */
  share?: number;
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
      <View style={styles.flex}>
        <AppText variant="calloutStrong" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="mono" color="textTertiary" numberOfLines={1}>
          {sn}
        </AppText>
        {share != null ? (
          <View style={styles.shareTrack}>
            <View style={[styles.shareFill, { width: `${Math.max(4, Math.round(share * 100))}%` }]} />
          </View>
        ) : null}
      </View>
      <View style={styles.right}>
        <AppText variant="numeric" weight="700">
          {value}
        </AppText>
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
  const topRevenue = Math.max(0, ...items.map((d) => d.revenue));
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
              share={topRevenue > 0 ? d.revenue / topRevenue : undefined}
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
      paddingVertical: t.spacing.sm,
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
    right: { alignItems: "flex-end" },
    shareTrack: { height: 4, borderRadius: 2, backgroundColor: t.colors.surfaceMuted, marginTop: 6, overflow: "hidden" },
    shareFill: { height: 4, borderRadius: 2, backgroundColor: t.colors.chart[0] },
  })
);
