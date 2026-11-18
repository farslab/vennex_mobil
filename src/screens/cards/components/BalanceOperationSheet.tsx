import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  AppButton,
  AppConfirmSheet,
  AppInput,
  AppNotice,
  AppSegmented,
  AppSheet,
  AppText,
  makeStyles,
  type ConfirmSummaryItem,
  useFormDirty,
  useGuardedClose,
} from "@/design-system";
import { cardsApi } from "@/api/cards";
import { formatCurrency } from "@/utils/number";
import type { BulkBalanceOperation, PersonnelCard } from "@/types/cards";
import { fieldErrorsOf, generalErrorOf, useLockedMutation } from "../hooks/useLockedMutation";
import {
  BALANCE_OPERATION_LABELS,
  balanceEffectText,
  cardDisplayName,
  projectBalances,
  validateAmount,
} from "./format";
import { useOnOpen } from "../hooks/useOnOpen";

const OPERATIONS: { key: BulkBalanceOperation; label: string }[] = [
  { key: "add", label: "Ekle" },
  { key: "subtract", label: "Düş" },
  { key: "set", label: "Ayarla" },
];

export interface BalanceOperationSheetProps {
  visible: boolean;
  /** İşlem yapılacak kartlar (bakiye projeksiyonu için tam kayıtlar) */
  cards: PersonnelCard[];
  onClose: () => void;
  onDone?: () => void;
}

/**
 * Bakiye işlemi: tek kart veya çoklu seçim. `POST cards/bulk/balance/` tek istekle gider
 * (tek kart = tek id). Önce form, sonra özetli onay; onay sırasında kilitli.
 */
export function BalanceOperationSheet({ visible, cards, onClose, onDone }: BalanceOperationSheetProps) {
  const styles = useStyles();
  const [operation, setOperation] = useState<BulkBalanceOperation>("add");
  const [amountText, setAmountText] = useState("");
  const [amountError, setAmountError] = useState<string | null>(null);
  const [confirmAmount, setConfirmAmount] = useState<number | null>(null);
  // Kaydedilmemiş değişiklik: kapatırken onay iste
  const dirty = useFormDirty(visible, { operation, amountText });
  const guardedClose = useGuardedClose(dirty, onClose);

  useOnOpen(visible, () => {
    setOperation("add");
    setAmountText("");
    setAmountError(null);
    setConfirmAmount(null);
  });

  const mutation = useLockedMutation({
    mutationFn: (vars: { ids: number[]; operation: BulkBalanceOperation; amount: number }) =>
      cardsApi.bulkBalance(vars.ids, vars.operation, vars.amount),
    successMessage: (res, vars) => {
      const skipped = vars.ids.length - res.count;
      return skipped > 0
        ? `${res.count} kart güncellendi; ${skipped} kart yetki kapsamınız dışında olduğu için atlandı.`
        : `${res.count} kartın bakiyesi güncellendi.`;
    },
    onSuccess: () => {
      setConfirmAmount(null);
      onClose();
      onDone?.();
    },
    onError: (err) => {
      const fe = fieldErrorsOf(err);
      if (fe.amount) {
        setAmountError(fe.amount);
        setConfirmAmount(null);
      }
    },
  });

  const count = cards.length;
  const single = count === 1 ? cards[0] : null;

  const submit = () => {
    const res = validateAmount(amountText, { allowZero: operation === "set" });
    if ("error" in res) {
      setAmountError(res.error);
      return;
    }
    setAmountError(null);
    mutation.reset();
    setConfirmAmount(res.value);
  };

  const summary = useMemo<ConfirmSummaryItem[]>(() => {
    if (confirmAmount == null) return [];
    const { before, after } = projectBalances(cards, operation, confirmAmount);
    return [
      { label: single ? "Kart" : "Kart sayısı", value: single ? cardDisplayName(single) : `${count} kart` },
      { label: "İşlem", value: BALANCE_OPERATION_LABELS[operation] },
      { label: "Tutar", value: formatCurrency(confirmAmount) },
      { label: single ? "Mevcut bakiye" : "Mevcut toplam", value: formatCurrency(before) },
      { label: single ? "Yeni bakiye" : "Yeni toplam", value: formatCurrency(after) },
    ];
  }, [cards, confirmAmount, count, operation, single]);

  const preview = (() => {
    const res = validateAmount(amountText, { allowZero: operation === "set" });
    return "value" in res ? res.value : null;
  })();

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      dirty={dirty}
      title={single ? "Bakiye işlemi" : "Toplu bakiye işlemi"}
      subtitle={single ? cardDisplayName(single) : `${count} kart seçili`}
      dismissible={!mutation.isPending}
      footer={
        <>
          <AppButton title="Vazgeç" variant="outline" onPress={guardedClose} style={styles.flex} />
          <AppButton title="Devam" onPress={submit} style={styles.flex} testID="balance-continue" disabled={count === 0} />
        </>
      }
    >
      <AppSegmented
        items={OPERATIONS}
        value={operation}
        onChange={(k) => {
          setOperation(k);
          setAmountError(null);
        }}
        testID="balance-operation"
      />
      <AppInput
        label="Tutar"
        required
        value={amountText}
        onChangeText={(t) => {
          setAmountText(t);
          if (amountError) setAmountError(null);
        }}
        keyboardType="decimal-pad"
        placeholder="0,00"
        suffix="₺"
        error={amountError}
        testID="balance-amount"
      />
      {preview != null ? (
        <View style={styles.preview}>
          <AppText variant="callout" color="textSecondary">
            {balanceEffectText(operation, preview, count)}
          </AppText>
        </View>
      ) : null}
      {operation === "subtract" ? (
        <AppNotice tone="info" message="Bakiyesi tutardan düşük kartlar 0 ₺'ye çekilir; eksi bakiye oluşmaz." />
      ) : null}
      {operation === "set" ? (
        <AppNotice tone="warning" message="Ayarla işlemi mevcut bakiyenin üzerine yazar." />
      ) : null}

      <AppConfirmSheet
        visible={confirmAmount != null}
        title="Bakiye işlemini onayla"
        message={confirmAmount != null ? balanceEffectText(operation, confirmAmount, count) : undefined}
        summary={summary}
        confirmLabel="Onayla ve uygula"
        destructive={operation === "set"}
        loading={mutation.isPending}
        error={generalErrorOf(mutation.error, ["amount"])}
        onCancel={() => setConfirmAmount(null)}
        onConfirm={() => {
          if (confirmAmount == null) return;
          mutation.run({ ids: cards.map((c) => c.id), operation, amount: confirmAmount });
        }}
      />
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    preview: {
      padding: t.spacing.md,
      borderRadius: t.radius.sm,
      backgroundColor: t.colors.surfaceMuted,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
    },
  })
);
