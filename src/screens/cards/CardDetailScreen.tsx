import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppConfirmSheet,
  AppEmptyState,
  AppErrorState,
  AppLoading,
  AppNotice,
  AppScreen,
  AppSection,
  AppSkeleton,
  AppText,
  makeStyles,
} from "@/design-system";
import { CARD_TX_DEFAULT_LIMIT, CARD_TX_MAX_LIMIT, cardsApi } from "@/api/cards";
import { errorMessage } from "@/api/client";
import { formatCurrency, formatInteger } from "@/utils/number";
import { formatDate, formatDateTime } from "@/utils/date";
import type { RootScreenProps } from "@/navigation/types";
import type { CardTransaction } from "@/types/cards";
import { cardKeys } from "./hooks/cardKeys";
import { useCardAccess } from "./hooks/useCardAccess";
import { generalErrorOf, useLockedMutation } from "./hooks/useLockedMutation";
import { BalanceOperationSheet } from "./components/BalanceOperationSheet";
import { CardFormSheet } from "./components/CardFormSheet";
import { ApproveCardSheet } from "./components/ApproveCardSheet";
import { InfoLine } from "./components/Common";
import { cardDisplayName } from "./components/format";

const CANCEL_REASONS: Record<number, string> = { 1: "Zaman aşımı", 2: "Banka reddi", 3: "Teknik hata" };

type Props = Pick<RootScreenProps<"CardDetail">, "route" | "navigation">;

/** Kart detayı: GET cards/{id}/, düzenleme, bakiye işlemi, onay/ret, silme, işlem geçmişi */
export default function CardDetailScreen({ route, navigation }: Props) {
  const id = route.params.id;
  const styles = useStyles();
  const access = useCardAccess();
  const [limit, setLimit] = useState(CARD_TX_DEFAULT_LIMIT);
  const [editOpen, setEditOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [approveOpen, setApproveOpen] = useState(false);
  const [rejectOpen, setRejectOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const detail = useQuery({
    queryKey: cardKeys.detail(id),
    queryFn: ({ signal }) => cardsApi.detail(id, signal),
  });
  const txs = useQuery({
    queryKey: cardKeys.transactions(id, limit),
    queryFn: ({ signal }) => cardsApi.transactions(id, limit, signal),
    enabled: detail.isSuccess,
    placeholderData: (prev) => prev,
  });

  const remove = useLockedMutation({
    mutationFn: () => cardsApi.remove(id),
    successMessage: "Kart silindi.",
    onSuccess: () => {
      setDeleteOpen(false);
      navigation.goBack();
    },
  });
  const approve = useLockedMutation({
    mutationFn: (reverse: boolean) => cardsApi.approve(id, reverse),
    successMessage: "Kart onaylandı.",
    onSuccess: () => setApproveOpen(false),
  });
  const reject = useLockedMutation({
    mutationFn: () => cardsApi.reject(id),
    successMessage: "Kart talebi reddedildi.",
    onSuccess: () => {
      setRejectOpen(false);
      navigation.goBack();
    },
  });

  const refresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([detail.refetch(), txs.refetch()]);
    } finally {
      setRefreshing(false);
    }
  };

  if (detail.isLoading) return <AppLoading label="Kart yükleniyor…" />;
  if (detail.isError || !detail.data) {
    return (
      <AppScreen>
        <AppErrorState message={errorMessage(detail.error)} onRetry={() => detail.refetch()} retrying={detail.isFetching} />
      </AppScreen>
    );
  }

  const card = detail.data;
  const pending = !card.is_active;
  const tx = txs.data;
  const canLoadMore = tx != null && tx.transactions.length >= limit && limit < CARD_TX_MAX_LIMIT;

  return (
    <AppScreen refreshing={refreshing} onRefresh={refresh} testID="card-detail">
      <AppCard>
        <View style={styles.heroTop}>
          <View style={styles.flex}>
            <AppText variant="headline" numberOfLines={2}>
              {cardDisplayName(card)}
            </AppText>
            <AppText variant="mono" color="textSecondary" selectable>
              {card.uid}
            </AppText>
          </View>
          <AppBadge dot tone={pending ? "warning" : "success"} label={pending ? "Onay bekliyor" : "Aktif"} />
        </View>
        <View style={styles.balanceBlock}>
          <AppText variant="overline" color="textTertiary">
            Bakiye
          </AppText>
          <AppText variant="metricLg" testID="card-balance" accessibilityLabel={`Bakiye ${formatCurrency(card.balance)}`}>
            {formatCurrency(card.balance)}
          </AppText>
        </View>
        <View style={styles.actions}>
          {pending ? (
            <>
              <AppButton
                title="Reddet"
                variant="dangerOutline"
                icon="x"
                onPress={() => {
                  reject.reset();
                  setRejectOpen(true);
                }}
                style={styles.flex}
                testID="detail-reject"
              />
              <AppButton
                title="Onayla"
                icon="check"
                onPress={() => {
                  approve.reset();
                  setApproveOpen(true);
                }}
                style={styles.flex}
                testID="detail-approve"
              />
            </>
          ) : access.canChangeBalance ? (
            <AppButton title="Bakiye işlemi" icon="dollar-sign" onPress={() => setBalanceOpen(true)} style={styles.flex} testID="detail-balance" />
          ) : null}
          <AppButton title="Düzenle" variant="outline" icon="edit-2" onPress={() => setEditOpen(true)} style={styles.flex} testID="detail-edit" />
        </View>
        {!access.canChangeBalance && !pending ? (
          <AppNotice tone="info" message="Bakiye değiştirme yetkiniz olmadığı için bakiye işlemleri kapalı." />
        ) : null}
      </AppCard>

      <AppSection title="Kart bilgileri">
        <AppCard>
          <InfoLine icon="hash" label="Kullanıcı no" value={card.customer_no ? String(card.customer_no) : "—"} />
          <InfoLine icon="calendar" label="Kayıt tarihi" value={formatDate(card.created_at)} />
          <InfoLine icon="layers" label="Gruplar" value={card.groups.length ? card.groups.map((g) => g.name).join(", ") : "Grupsuz"} />
        </AppCard>
      </AppSection>

      <AppSection title="İşlem geçmişi">
        {txs.isLoading ? (
          <AppSkeleton height={140} />
        ) : txs.isError ? (
          <AppErrorState compact message={errorMessage(txs.error)} onRetry={() => txs.refetch()} />
        ) : tx && tx.transactions.length > 0 ? (
          <AppCard padded={false}>
            <View style={styles.txSummary}>
              <AppText variant="caption" color="textSecondary">
                Son {formatInteger(tx.transactions.length)} işlem
              </AppText>
              <View style={styles.txCounts}>
                <AppBadge size="sm" tone="success" label={`${formatInteger(tx.success_count)} başarılı`} />
                <AppBadge size="sm" tone="danger" label={`${formatInteger(tx.fail_count)} başarısız`} />
              </View>
            </View>
            {tx.transactions.map((t, i) => (
              <TransactionRow key={t.id} tx={t} last={i === tx.transactions.length - 1} />
            ))}
            {canLoadMore ? (
              <View style={styles.more}>
                <AppButton
                  title="Daha fazla göster"
                  variant="ghost"
                  size="sm"
                  loading={txs.isFetching}
                  onPress={() => setLimit(CARD_TX_MAX_LIMIT)}
                  testID="tx-more"
                />
              </View>
            ) : null}
          </AppCard>
        ) : (
          <AppEmptyState compact icon="activity" title="Bu kartla işlem yapılmamış" />
        )}
      </AppSection>

      <AppButton
        title="Kartı sil"
        variant="dangerOutline"
        icon="trash-2"
        onPress={() => {
          remove.reset();
          setDeleteOpen(true);
        }}
        testID="detail-delete"
      />

      <CardFormSheet visible={editOpen} card={card} canChangeBalance={access.canChangeBalance} onClose={() => setEditOpen(false)} />
      {access.canChangeBalance ? (
        <BalanceOperationSheet visible={balanceOpen} cards={[card]} onClose={() => setBalanceOpen(false)} />
      ) : null}
      <ApproveCardSheet
        card={approveOpen ? card : null}
        loading={approve.isPending}
        error={generalErrorOf(approve.error)}
        onCancel={() => setApproveOpen(false)}
        onConfirm={(reverse) => approve.run(reverse)}
      />
      <AppConfirmSheet
        visible={rejectOpen}
        title="Kart talebini reddet"
        message="Bekleyen kart kaydı silinir. Kartta bakiye varsa sıfırlanır."
        summary={[
          { label: "Kart", value: cardDisplayName(card) },
          { label: "Bakiye", value: formatCurrency(card.balance) },
        ]}
        confirmLabel="Reddet"
        destructive
        irreversible
        loading={reject.isPending}
        error={generalErrorOf(reject.error)}
        onCancel={() => setRejectOpen(false)}
        onConfirm={() => reject.run()}
      />
      <AppConfirmSheet
        visible={deleteOpen}
        title="Kartı sil"
        message="Kart kalıcı olarak silinir. Karttaki bakiye sıfırlanır ve bakiye geçmişine silme kaydı düşülür."
        summary={[
          { label: "Kart", value: cardDisplayName(card) },
          { label: "UID", value: card.uid },
          { label: "Silinecek bakiye", value: formatCurrency(card.balance) },
        ]}
        confirmLabel="Kartı sil"
        destructive
        irreversible
        loading={remove.isPending}
        error={generalErrorOf(remove.error)}
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => remove.run()}
      />
    </AppScreen>
  );
}

function TransactionRow({ tx, last }: { tx: CardTransaction; last: boolean }) {
  const styles = useStyles();
  const reason = !tx.status ? (tx.iptalNo != null ? CANCEL_REASONS[tx.iptalNo] ?? "Diğer" : "Başarısız") : null;
  return (
    <View
      style={[styles.txRow, !last && styles.txBorder]}
      accessible
      accessibilityLabel={`${tx.display_name ?? "İşlem"}, ${formatCurrency(tx.amount)}, ${tx.status ? "başarılı" : `başarısız: ${reason}`}, ${formatDateTime(tx.pt_datetime)}`}
    >
      <View style={styles.flex}>
        <AppText variant="callout" numberOfLines={1}>
          {tx.display_name || (tx.product_no != null ? `Ürün ${tx.product_no}` : "İşlem")}
        </AppText>
        <AppText variant="caption" color="textTertiary">
          {formatDateTime(tx.pt_datetime)}
          {reason ? ` · ${reason}` : ""}
        </AppText>
      </View>
      <View style={styles.txRight}>
        <AppText variant="numeric" color={tx.status ? "text" : "textTertiary"}>
          {formatCurrency(tx.amount)}
        </AppText>
        {!tx.status ? <AppBadge size="sm" tone="danger" label="Başarısız" /> : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    heroTop: { flexDirection: "row", alignItems: "flex-start", gap: t.spacing.md },
    balanceBlock: { marginTop: t.spacing.lg, gap: t.spacing.xxs },
    actions: { flexDirection: "row", gap: t.spacing.sm, marginTop: t.spacing.lg, flexWrap: "wrap" },
    txSummary: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      gap: t.spacing.sm,
      paddingHorizontal: t.layout.cardPadding,
      paddingVertical: t.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    txCounts: { flexDirection: "row", gap: t.spacing.xs },
    txRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      minHeight: 56,
      paddingHorizontal: t.layout.cardPadding,
      paddingVertical: t.spacing.sm,
    },
    txBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    txRight: { alignItems: "flex-end", gap: t.spacing.xxs },
    more: { padding: t.spacing.sm, alignItems: "center" },
  })
);
