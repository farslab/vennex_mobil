import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppButton, AppCheckbox, AppNotice, AppSheet, AppText, makeStyles } from "@/design-system";
import { formatCurrency } from "@/utils/number";
import type { PersonnelCard } from "@/types/cards";
import { useOnValueChange } from "../hooks/useOnOpen";
import { canReverseUid, cardDisplayName, reversedUid } from "./format";

/**
 * Bekleyen kart onayı. Bazı okuyucular UID baytlarını ters sırada verir; backend `reverse_uid`
 * ile düzeltir (views/personnel_cards.py:240-247) — yalnız çok parçalı UID'de sunulur.
 */
export function ApproveCardSheet({
  card,
  loading,
  error,
  onCancel,
  onConfirm,
}: {
  card: PersonnelCard | null;
  loading: boolean;
  error: string | null;
  onCancel: () => void;
  onConfirm: (reverseUid: boolean) => void;
}) {
  const styles = useStyles();
  const [reverse, setReverse] = useState(false);
  useOnValueChange(card, () => setReverse(false));

  const uid = card ? (reverse ? reversedUid(card.uid) : card.uid) : "";
  const rows = card
    ? [
        { label: "Kart sahibi", value: cardDisplayName(card) },
        { label: "UID", value: uid },
        { label: "Bakiye", value: formatCurrency(card.balance) },
      ]
    : [];

  return (
    <AppSheet
      visible={card != null}
      onClose={onCancel}
      title="Kartı onayla"
      dismissible={!loading}
      footer={
        <>
          <AppButton title="Vazgeç" variant="outline" onPress={onCancel} disabled={loading} style={styles.flex} />
          <AppButton title="Onayla" onPress={() => onConfirm(reverse)} loading={loading} style={styles.flex} testID="approve-confirm" />
        </>
      }
    >
      <AppText variant="body" color="textSecondary">
        Onaylanan kart aktif kartlar listesine taşınır ve cihazlarda kullanılabilir.
      </AppText>
      <View style={styles.summary}>
        {rows.map((r, i) => (
          <View key={r.label} style={[styles.row, i < rows.length - 1 && styles.border]}>
            <AppText variant="callout" color="textSecondary">
              {r.label}
            </AppText>
            <AppText variant={r.label === "UID" ? "mono" : "calloutStrong"} style={styles.value}>
              {r.value}
            </AppText>
          </View>
        ))}
      </View>
      {card && canReverseUid(card.uid) ? (
        <AppCheckbox
          checked={reverse}
          onChange={setReverse}
          label="UID'yi ters çevirerek onayla"
          description="Okuyucu bayt sırasını ters verdiyse işaretleyin."
          testID="approve-reverse-uid"
        />
      ) : null}
      {error ? <AppNotice tone="danger" title="Onaylanamadı" message={error} /> : null}
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    summary: {
      borderRadius: t.radius.sm,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surfaceMuted,
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      gap: t.spacing.md,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm + 2,
    },
    border: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    value: { flexShrink: 1, textAlign: "right" },
  })
);
