import React, { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppBadge, AppButton, AppIcon, AppText, makeStyles } from "@/design-system";
import { formatCurrency } from "@/utils/number";
import { initials } from "@/utils/text";
import type { PersonnelCard } from "@/types/cards";
import { cardDisplayName, cardUid } from "./format";

export interface CardRowProps {
  card: PersonnelCard;
  selectionMode: boolean;
  selected: boolean;
  onPress: (card: PersonnelCard) => void;
  onLongPress: (card: PersonnelCard) => void;
  onApprove?: (card: PersonnelCard) => void;
  onReject?: (card: PersonnelCard) => void;
}

function groupsText(card: PersonnelCard): string {
  if (card.groups.length === 0) return "Grupsuz";
  const [first, ...rest] = card.groups;
  return rest.length ? `${first.name} +${rest.length}` : first.name;
}

/** Kompakt kart satırı: kişi, maskeli UID, grup, bakiye; bekleyen kartta onay/ret aksiyonları */
export const CardRow = memo(function CardRow({
  card,
  selectionMode,
  selected,
  onPress,
  onLongPress,
  onApprove,
  onReject,
}: CardRowProps) {
  const styles = useStyles();
  const name = cardDisplayName(card);
  const pending = !card.is_active;
  const balance = formatCurrency(card.balance);
  return (
    <View style={[styles.container, selected && styles.containerSelected]}>
      <Pressable
        testID={`card-row-${card.id}`}
        onPress={() => onPress(card)}
        onLongPress={() => onLongPress(card)}
        delayLongPress={350}
        accessibilityRole={selectionMode ? "checkbox" : "button"}
        accessibilityState={selectionMode ? { checked: selected } : undefined}
        accessibilityLabel={`${name}, UID ${cardUid(card.uid)}, ${groupsText(card)}, bakiye ${balance}${pending ? ", onay bekliyor" : ""}`}
        accessibilityHint={selectionMode ? "Seçimi değiştirir" : "Kart detayını açar. Seçim için basılı tutun."}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        {selectionMode ? (
          <View style={[styles.check, selected && styles.checkOn]}>
            {selected ? <AppIcon name="check" size={14} color="onPrimary" /> : null}
          </View>
        ) : (
          <View style={styles.avatar}>
            <AppText variant="caption" color="textSecondary">
              {card.full_name ? initials(card.full_name) : "—"}
            </AppText>
          </View>
        )}
        <View style={styles.main}>
          <View style={styles.titleLine}>
            <AppText variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
              {name}
            </AppText>
            {pending ? <AppBadge size="sm" tone="warning" dot label="Bekliyor" /> : null}
          </View>
          <View style={styles.metaLine}>
            <AppText variant="mono" color="textTertiary" numberOfLines={1}>
              {cardUid(card.uid)}
            </AppText>
            <AppText variant="caption" color="textTertiary">
              ·
            </AppText>
            <AppText variant="caption" color="textTertiary" numberOfLines={1} style={styles.shrink}>
              {groupsText(card)}
            </AppText>
          </View>
        </View>
        <AppText variant="numeric" accessibilityElementsHidden>
          {balance}
        </AppText>
      </Pressable>
      {pending && !selectionMode && (onApprove || onReject) ? (
        <View style={styles.actions}>
          {onReject ? (
            <AppButton
              title="Reddet"
              size="sm"
              variant="dangerOutline"
              icon="x"
              onPress={() => onReject(card)}
              testID={`reject-${card.id}`}
              style={styles.action}
            />
          ) : null}
          {onApprove ? (
            <AppButton
              title="Onayla"
              size="sm"
              icon="check"
              onPress={() => onApprove(card)}
              testID={`approve-${card.id}`}
              style={styles.action}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
});

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    container: {
      backgroundColor: t.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    containerSelected: { backgroundColor: t.colors.primarySubtle },
    row: {
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.sm + 2,
    },
    pressed: { backgroundColor: t.colors.surfacePressed },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: t.colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      alignItems: "center",
      justifyContent: "center",
    },
    check: {
      width: 22,
      height: 22,
      marginHorizontal: 7,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    checkOn: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
    main: { flex: 1, gap: t.spacing.xxs },
    titleLine: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    metaLine: { flexDirection: "row", alignItems: "center", gap: t.spacing.xs },
    shrink: { flexShrink: 1 },
    actions: {
      flexDirection: "row",
      gap: t.spacing.sm,
      paddingHorizontal: t.layout.screenPadding,
      paddingBottom: t.spacing.md,
      paddingLeft: t.layout.screenPadding + 36 + t.spacing.md,
    },
    action: { flex: 1 },
  })
);
