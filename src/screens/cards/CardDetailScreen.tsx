import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { usePagedList } from "@/hooks/usePagedList";
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
import { cardsApi } from "@/api/cards";
import { errorMessage } from "@/api/client";
import { formatCurrency, formatInteger, toNumber } from "@/utils/number";
import { formatDate, formatDateTime } from "@/utils/date";
import type { RootScreenProps } from "@/navigation/types";
import type { CardBalanceLog } from "@/types/cards";
import { cardKeys } from "./hooks/cardKeys";
import { useCardAccess } from "./hooks/useCardAccess";
import { generalErrorOf, useLockedMutation } from "./hooks/useLockedMutation";
import { BalanceOperationSheet } from "./components/BalanceOperationSheet";
import { CardFormSheet } from "./components/CardFormSheet";
import { ApproveCardSheet } from "./components/ApproveCardSheet";
import { InfoLine } from "./components/Common";
import { cardDisplayName } from "./components/format";

type Props = Pick<RootScreenProps<"CardDetail">, "route" | "navigation">;

/** Kart detayı: GET cards/{id}/, düzenleme, bakiye işlemi, onay/ret, silme, bakiye hareketleri (web ile aynı) */
export default function CardDetailScreen({ route, navigation }: Props) {
  const id = route.params.id;
  const styles = useStyles();
  const access = useCardAccess();
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
  // Web kart geçmişi bakiye hareketleridir (yükleme/satış/iade/düzeltme/silme), sayfalı
  const logs = usePagedList<CardBalanceLog>({
    queryKey: cardKeys.balanceLogs(id),
    fetchPage: (page, signal) => cardsApi.balanceLogs(id, page, signal),
    enabled: detail.isSuccess,
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
      await Promise.all([detail.refetch(), logs.refresh()]);
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

      <AppSection title="Bakiye hareketleri">
        {logs.isLoading ? (
          <AppSkeleton height={140} />
        ) : logs.isError ? (
          <AppErrorState compact message={errorMessage(logs.error)} onRetry={() => logs.refetch()} />
        ) : logs.items.length > 0 ? (
          <AppCard padded={false}>
            <View style={styles.txSummary}>
              <AppText variant="caption" color="textSecondary" testID="card-logs-count">
                {formatInteger(logs.items.length)} / {formatInteger(logs.total)} hareket
              </AppText>
            </View>
            {logs.items.map((l, i) => (
              <BalanceLogRow key={l.id} log={l} last={i === logs.items.length - 1} />
            ))}
            {logs.hasMore ? (
              <View style={styles.more}>
                <AppButton
                  title="Daha fazla göster"
                  variant="ghost"
                  size="sm"
                  loading={logs.isFetchingMore}
                  onPress={logs.loadMore}
                  testID="logs-more"
                />
              </View>
            ) : null}
          </AppCard>
        ) : (
          <AppEmptyState compact icon="activity" title="Bu kartta bakiye hareketi yok" />
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

function BalanceLogRow({ log, last }: { log: CardBalanceLog; last: boolean }) {
  const styles = useStyles();
  const delta = toNumber(log.amount) ?? 0;
  const who = log.pos_device ? log.pos_device.pos_name || log.pos_device.sn : log.user?.name ?? null;
  const meta = [formatDateTime(log.created_at), log.source_label, who].filter(Boolean).join(" · ");
  const sign = delta > 0 ? "+" : "";
  return (
    <View
      style={[styles.txRow, !last && styles.txBorder]}
      accessible
      accessibilityLabel={`${log.operation_label}, ${sign}${formatCurrency(log.amount)}, yeni bakiye ${formatCurrency(log.balance_after)}, ${meta}`}
    >
      <View style={styles.flex}>
        <AppText variant="callout" numberOfLines={1}>
          {log.operation_label}
        </AppText>
        <AppText variant="caption" color="textTertiary" numberOfLines={2}>
          {meta}
          {log.description ? ` · ${log.description}` : ""}
        </AppText>
      </View>
      <View style={styles.txRight}>
        <AppText variant="numeric" color={delta < 0 ? "danger" : delta > 0 ? "success" : "text"}>
          {sign}
          {formatCurrency(log.amount)}
        </AppText>
        <AppText variant="caption" color="textTertiary">
          Bakiye {formatCurrency(log.balance_after)}
        </AppText>
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
