import React, { useCallback, useMemo, useState } from "react";
import { EXPORTS } from "@/api/exports";
import { useHeaderExcel } from "@/navigation/useHeaderExcel";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  AppButton,
  AppConfirmSheet,
  AppEmptyState,
  AppErrorState,
  AppIconButton,
  AppListSkeleton,
  AppSearchField,
  AppSegmented,
  AppText,
  makeStyles,
  useTheme,
} from "@/design-system";
import { cardsApi } from "@/api/cards";
import { errorMessage } from "@/api/client";
import { usePagedList } from "@/hooks/usePagedList";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatCurrency, formatInteger } from "@/utils/number";
import type { CardListResponse, CardStatus, PersonnelCard } from "@/types/cards";
import { cardKeys } from "../hooks/cardKeys";
import { useCardAccess } from "../hooks/useCardAccess";
import { generalErrorOf, useLockedMutation } from "../hooks/useLockedMutation";
import { CardRow } from "../components/CardRow";
import { BalanceOperationSheet } from "../components/BalanceOperationSheet";
import { BulkGroupsSheet } from "../components/BulkGroupsSheet";
import { CardFormSheet } from "../components/CardFormSheet";
import { ApproveCardSheet } from "../components/ApproveCardSheet";
import { GroupFilterSheet, type GroupFilter } from "../components/GroupFilterSheet";
import { cardDisplayName, sumBalances } from "../components/format";
import { useOnValueChange } from "../hooks/useOnOpen";
import { ListLoadMoreFooter } from "@/components/ListLoadMoreFooter";

/** Personel kartları: sunucu tarafı arama/filtre, 30'luk sayfalar, onay akışı, çoklu seçim + toplu işlemler */
export function PersonnelCardsTab() {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const access = useCardAccess();

  const [status, setStatus] = useState<CardStatus>("active");
  const [q, setQ] = useState("");
  const debouncedQ = useDebouncedValue(q, 350).trim();
  const [group, setGroup] = useState<GroupFilter | null>(null);
  const [groupSheet, setGroupSheet] = useState(false);

  const [selectionMode, setSelectionMode] = useState(false);
  // Excel: Genel Bakış gibi başlıkta, bildirim zilinin yanında (seçim modunda gizli)
  useHeaderExcel("Kartlar", selectionMode ? null : EXPORTS.cards);
  const [selected, setSelected] = useState<Map<number, PersonnelCard>>(new Map());

  const [createOpen, setCreateOpen] = useState(false);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);
  const [approveTarget, setApproveTarget] = useState<PersonnelCard | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PersonnelCard | null>(null);
  const [rejectAllOpen, setRejectAllOpen] = useState(false);

  const filters = useMemo(() => ({ status, q: debouncedQ, group_id: group?.id ?? null }), [status, debouncedQ, group]);

  const list = usePagedList<PersonnelCard, CardListResponse>({
    queryKey: cardKeys.list(filters),
    fetchPage: (page, signal) => cardsApi.list({ ...filters, page }, signal),
  });

  // Filtre değişince seçim sıfırlanır (görünmeyen kartlara toplu işlem yapılmasın)
  useOnValueChange(filters, () => setSelected(new Map()));

  const exitSelection = useCallback(() => {
    setSelectionMode(false);
    setSelected(new Map());
  }, []);

  const toggle = useCallback((card: PersonnelCard) => {
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(card.id)) next.delete(card.id);
      else next.set(card.id, card);
      return next;
    });
  }, []);

  const onPress = useCallback(
    (card: PersonnelCard) => {
      if (selectionMode) toggle(card);
      else navigation.navigate("CardDetail", { id: card.id });
    },
    [navigation, selectionMode, toggle]
  );

  const onLongPress = useCallback(
    (card: PersonnelCard) => {
      setSelectionMode(true);
      toggle(card);
    },
    [toggle]
  );

  const selectedCards = useMemo(() => [...selected.values()], [selected]);
  const allLoadedSelected = list.items.length > 0 && list.items.every((c) => selected.has(c.id));

  const approve = useLockedMutation({
    mutationFn: (vars: { id: number; reverse: boolean }) => cardsApi.approve(vars.id, vars.reverse),
    successMessage: (card) => `${cardDisplayName(card)} onaylandı.`,
    onSuccess: () => setApproveTarget(null),
  });
  const reject = useLockedMutation({
    mutationFn: (id: number) => cardsApi.reject(id),
    successMessage: "Kart talebi reddedildi.",
    onSuccess: () => setRejectTarget(null),
  });
  const rejectAll = useLockedMutation({
    mutationFn: () => cardsApi.rejectAllPending(),
    successMessage: (res) => `${res.count} bekleyen kart reddedildi.`,
    onSuccess: () => setRejectAllOpen(false),
  });
  const bulkDelete = useLockedMutation({
    mutationFn: (ids: number[]) => cardsApi.bulkDelete(ids),
    successMessage: (res, ids) => {
      const skipped = ids.length - res.count;
      return skipped > 0 ? `${res.count} kart silindi; ${skipped} kart yetki kapsamı dışında kaldı.` : `${res.count} kart silindi.`;
    },
    onSuccess: () => {
      setBulkDeleteOpen(false);
      exitSelection();
    },
  });

  const activeCount = list.firstPage?.active_count;
  const pendingCount = list.firstPage?.pending_count;

  const header = (
    <View style={styles.header}>
      <AppSegmented<CardStatus>
        items={[
          { key: "active", label: "Aktif", count: activeCount },
          { key: "pending", label: "Onay bekleyen", count: pendingCount },
        ]}
        value={status}
        onChange={(k) => {
          setStatus(k);
          exitSelection();
        }}
        testID="card-status"
      />
      <AppSearchField value={q} onChangeText={setQ} placeholder="Ad, soyad veya UID ara" testID="card-search" returnKeyType="search" />
      <View style={styles.toolbar}>
        <AppButton
          size="sm"
          variant={group ? "secondary" : "outline"}
          icon="filter"
          title={group ? group.name : "Tüm gruplar"}
          onPress={() => setGroupSheet(true)}
          accessibilityHint="Kart grubuna göre filtreler"
          testID="card-group-filter"
          style={styles.toolbarGrow}
        />
        {group ? <AppIconButton icon="x" label="Grup filtresini kaldır" onPress={() => setGroup(null)} /> : null}
        {selectionMode ? null : (
          <AppButton size="sm" variant="outline" icon="check-square" title="Seç" onPress={() => setSelectionMode(true)} testID="card-select-mode" />
        )}
        {status === "active" ? (
          <AppButton size="sm" icon="plus" title="Yeni kart" onPress={() => setCreateOpen(true)} testID="card-create" />
        ) : (pendingCount ?? 0) > 0 ? (
          <AppButton
            size="sm"
            variant="dangerOutline"
            icon="x-circle"
            title="Tümünü reddet"
            onPress={() => {
              rejectAll.reset();
              setRejectAllOpen(true);
            }}
            testID="card-reject-all"
          />
        ) : null}
      </View>
      {list.firstPage ? (
        <AppText variant="caption" color="textTertiary" accessibilityLiveRegion="polite">
          {formatInteger(list.total)} kart{debouncedQ || group ? " (filtreli)" : ""}
        </AppText>
      ) : null}
    </View>
  );

  const body = list.isLoading ? (
    <AppListSkeleton rows={6} />
  ) : list.isError ? (
    <AppErrorState message={errorMessage(list.error)} onRetry={() => list.refetch()} />
  ) : (
    <FlatList
      data={list.items}
      keyExtractor={(c) => String(c.id)}
      renderItem={({ item }) => (
        <CardRow
          card={item}
          selectionMode={selectionMode}
          selected={selected.has(item.id)}
          onPress={onPress}
          onLongPress={onLongPress}
          onApprove={(c) => {
            approve.reset();
            setApproveTarget(c);
          }}
          onReject={(c) => {
            reject.reset();
            setRejectTarget(c);
          }}
        />
      )}
      onEndReached={list.loadMore}
      onEndReachedThreshold={0.5}
      keyboardShouldPersistTaps="handled"
      keyboardDismissMode="on-drag"
      refreshControl={<RefreshControl refreshing={list.isRefreshing} onRefresh={list.refresh} tintColor={colors.primary} colors={[colors.primary]} />}
      ListEmptyComponent={
        <AppEmptyState
          icon={status === "pending" ? "check-circle" : "credit-card"}
          title={debouncedQ || group ? "Eşleşen kart yok" : status === "pending" ? "Onay bekleyen kart yok" : "Henüz kart yok"}
          description={debouncedQ || group ? "Aramayı veya grup filtresini değiştirin." : undefined}
        />
      }
      ListFooterComponent={<ListLoadMoreFooter loading={list.isFetchingMore} error={list.loadMoreError} onRetry={list.retryLoadMore} />}
      testID="card-list"
    />
  );

  return (
    <View style={styles.root}>
      {header}
      <View style={styles.flex}>{body}</View>

      {selectionMode ? (
        <View style={styles.selectionBar} accessibilityLabel="Toplu işlem çubuğu">
          <View style={styles.selectionTop}>
            <AppIconButton icon="x" label="Seçim modundan çık" onPress={exitSelection} />
            <View style={styles.flex}>
              <AppText variant="calloutStrong">{selected.size} kart seçili</AppText>
              {selected.size > 0 ? (
                <AppText variant="caption" color="textTertiary">
                  Toplam bakiye {formatCurrency(sumBalances(selectedCards))}
                </AppText>
              ) : null}
            </View>
            <Pressable
              onPress={() =>
                setSelected(allLoadedSelected ? new Map() : new Map(list.items.map((c) => [c.id, c])))
              }
              accessibilityRole="button"
              style={styles.selectAll}
              hitSlop={8}
            >
              <AppText variant="calloutStrong" color="primary">
                {allLoadedSelected ? "Seçimi temizle" : `Yüklenenleri seç (${list.items.length})`}
              </AppText>
            </Pressable>
          </View>
          <View style={styles.selectionActions}>
            {access.canChangeBalance ? (
              <AppButton
                size="sm"
                icon="dollar-sign"
                title="Bakiye"
                disabled={selected.size === 0}
                onPress={() => setBalanceOpen(true)}
                style={styles.flex}
                testID="bulk-balance"
              />
            ) : null}
            <AppButton
              size="sm"
              variant="outline"
              icon="layers"
              title="Grup"
              disabled={selected.size === 0}
              onPress={() => setGroupsOpen(true)}
              style={styles.flex}
              testID="bulk-groups"
            />
            <AppButton
              size="sm"
              variant="dangerOutline"
              icon="trash-2"
              title="Sil"
              disabled={selected.size === 0}
              onPress={() => {
                bulkDelete.reset();
                setBulkDeleteOpen(true);
              }}
              style={styles.flex}
              testID="bulk-delete"
            />
          </View>
        </View>
      ) : null}

      <GroupFilterSheet
        visible={groupSheet}
        selectedId={group?.id ?? null}
        onClose={() => setGroupSheet(false)}
        onSelect={(g) => {
          setGroup(g);
          setGroupSheet(false);
        }}
      />

      <CardFormSheet visible={createOpen} card={null} canChangeBalance={access.canChangeBalance} onClose={() => setCreateOpen(false)} />

      {access.canChangeBalance ? (
        <BalanceOperationSheet visible={balanceOpen} cards={selectedCards} onClose={() => setBalanceOpen(false)} onDone={exitSelection} />
      ) : null}

      <BulkGroupsSheet
        visible={groupsOpen}
        cardIds={selectedCards.map((c) => c.id)}
        onClose={() => setGroupsOpen(false)}
        onDone={exitSelection}
      />

      <AppConfirmSheet
        visible={bulkDeleteOpen}
        title="Kartları sil"
        message="Seçili kartlar kalıcı olarak silinecek. Kartlardaki bakiye sıfırlanır ve bakiye geçmişine silme kaydı düşülür."
        summary={[
          { label: "Kart sayısı", value: `${selected.size} kart` },
          { label: "Silinecek toplam bakiye", value: formatCurrency(sumBalances(selectedCards)) },
        ]}
        confirmLabel={`${selected.size} kartı sil`}
        destructive
        irreversible
        loading={bulkDelete.isPending}
        error={generalErrorOf(bulkDelete.error)}
        onCancel={() => setBulkDeleteOpen(false)}
        onConfirm={() => bulkDelete.run(selectedCards.map((c) => c.id))}
      />

      <ApproveCardSheet
        card={approveTarget}
        loading={approve.isPending}
        error={generalErrorOf(approve.error)}
        onCancel={() => setApproveTarget(null)}
        onConfirm={(reverse) => approveTarget && approve.run({ id: approveTarget.id, reverse })}
      />

      <AppConfirmSheet
        visible={rejectTarget != null}
        title="Kart talebini reddet"
        message="Bekleyen kart kaydı silinir. Kartta bakiye varsa sıfırlanır."
        summary={
          rejectTarget
            ? [
                { label: "Kart sahibi", value: cardDisplayName(rejectTarget) },
                { label: "UID", value: rejectTarget.uid },
                { label: "Bakiye", value: formatCurrency(rejectTarget.balance) },
              ]
            : []
        }
        confirmLabel="Reddet"
        destructive
        irreversible
        loading={reject.isPending}
        error={generalErrorOf(reject.error)}
        onCancel={() => setRejectTarget(null)}
        onConfirm={() => rejectTarget && reject.run(rejectTarget.id)}
      />

      <AppConfirmSheet
        visible={rejectAllOpen}
        title="Tüm bekleyen kartları reddet"
        message="Onay bekleyen tüm kart kayıtları silinir (yetki kapsamınızdaki kartlar)."
        summary={[{ label: "Bekleyen kart", value: `${formatInteger(pendingCount ?? 0)} kart` }]}
        confirmLabel="Tümünü reddet"
        destructive
        irreversible
        loading={rejectAll.isPending}
        error={generalErrorOf(rejectAll.error)}
        onCancel={() => setRejectAllOpen(false)}
        onConfirm={() => rejectAll.run()}
      />
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    header: {
      gap: t.spacing.sm,
      paddingHorizontal: t.layout.screenPadding,
      paddingTop: t.spacing.md,
      paddingBottom: t.spacing.sm,
    },
    toolbar: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, flexWrap: "wrap" },
    toolbarGrow: { flexGrow: 1, flexShrink: 1 },
    selectionBar: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      backgroundColor: t.colors.surface,
      paddingHorizontal: t.spacing.sm,
      paddingBottom: t.spacing.md,
      gap: t.spacing.xs,
    },
    selectionTop: { flexDirection: "row", alignItems: "center", gap: t.spacing.xs },
    selectAll: { minHeight: t.layout.minTouchTarget, justifyContent: "center", paddingHorizontal: t.spacing.sm },
    selectionActions: { flexDirection: "row", gap: t.spacing.sm, paddingHorizontal: t.spacing.sm },
  })
);
