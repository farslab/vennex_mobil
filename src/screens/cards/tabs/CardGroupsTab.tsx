import React, { useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import {
  AppButton,
  AppConfirmSheet,
  AppEmptyState,
  AppErrorState,
  AppInput,
  AppListSkeleton,
  AppNotice,
  AppSearchField,
  AppSelect,
  AppSheet,
  AppText,
  makeStyles,
  toast,
  useTheme,
  useFormDirty,
  useGuardedClose,
} from "@/design-system";
import { cardsApi } from "@/api/cards";
import { errorMessage } from "@/api/client";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { formatInteger } from "@/utils/number";
import type { CardGroup, CardGroupDetail, CardGroupPayload } from "@/types/cards";
import { cardKeys } from "../hooks/cardKeys";
import { useCardAccess } from "../hooks/useCardAccess";
import { fieldErrorsOf, generalErrorOf, useLockedMutation } from "../hooks/useLockedMutation";
import { ListFooter, RuleRow } from "../components/Common";
import { useOnOpen, useOnValueChange } from "../hooks/useOnOpen";

/** Kart grupları: sayfasız liste (cihaz sayısı listede), cihazlar yalnız detay açılınca çekilir */
export function CardGroupsTab() {
  const access = useCardAccess();
  const styles = useStyles();
  const { colors } = useTheme();
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 350).trim();
  const [detailId, setDetailId] = useState<number | null>(null);
  const [form, setForm] = useState<{ group: CardGroupDetail | null } | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const query = useQuery({
    queryKey: cardKeys.groupList(debounced),
    queryFn: ({ signal }) => cardsApi.groups.list({ q: debounced }, signal),
  });

  const refresh = async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <AppSearchField value={q} onChangeText={setQ} placeholder="Grup adı ara" testID="group-search" />
        <View style={styles.toolbar}>
          <AppText variant="caption" color="textTertiary" style={styles.flex}>
            {query.data ? `${formatInteger(query.data.length)} grup` : " "}
          </AppText>
          {access.canManageGroups ? (
            <AppButton size="sm" icon="plus" title="Yeni grup" onPress={() => setForm({ group: null })} testID="group-create" />
          ) : null}
        </View>
      </View>
      {query.isLoading ? (
        <AppListSkeleton rows={5} />
      ) : query.isError ? (
        <AppErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} />
      ) : (
        <FlatList
          data={query.data ?? []}
          keyExtractor={(g) => String(g.id)}
          keyboardShouldPersistTaps="handled"
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
          renderItem={({ item }) => <GroupRow group={item} onPress={() => setDetailId(item.id)} />}
          ListEmptyComponent={
            <AppEmptyState
              icon="layers"
              title={debounced ? "Eşleşen grup yok" : "Henüz kart grubu yok"}
              description={debounced ? undefined : "Kartları POS cihazlarına göre yetkilendirmek için grup oluşturun."}
            />
          }
          ListFooterComponent={<ListFooter loading={false} />}
        />
      )}

      <GroupDetailSheet groupId={detailId} onClose={() => setDetailId(null)} />
      <GroupFormSheet state={form} onClose={() => setForm(null)} />
    </View>
  );
}

function GroupRow({ group, onPress }: { group: CardGroup; onPress: () => void }) {
  return (
    <RuleRow
      testID={`group-row-${group.id}`}
      title={group.name}
      subtitle={`${formatInteger(group.active_cards_count)} aktif kart · ${formatInteger(group.pos_device_count)} POS cihazı`}
      onPress={onPress}
      accessibilityLabel={`${group.name}, ${group.active_cards_count} aktif kart, ${group.pos_device_count} POS cihazı`}
    />
  );
}

function GroupDetailSheet({ groupId, onClose }: { groupId: number | null; onClose: () => void }) {
  const access = useCardAccess();
  const styles = useStyles();
  const [deleting, setDeleting] = useState(false);
  const [editing, setEditing] = useState(false);
  useOnValueChange(groupId, (id) => {
    if (id == null) setEditing(false);
  });
  const detail = useQuery({
    queryKey: cardKeys.group(groupId ?? 0),
    queryFn: ({ signal }) => cardsApi.groups.detail(groupId as number, signal),
    enabled: groupId != null,
  });
  const remove = useLockedMutation({
    mutationFn: (id: number) => cardsApi.groups.remove(id),
    successMessage: "Grup silindi.",
    onSuccess: () => {
      setDeleting(false);
      onClose();
    },
  });
  const g = detail.data;
  return (
    <AppSheet
      visible={groupId != null}
      onClose={onClose}
      title={g?.name ?? "Kart grubu"}
      subtitle={g ? `${formatInteger(g.active_cards_count)} aktif kart` : undefined}
      footer={
        g && access.canManageGroups ? (
          <>
            <AppButton
              title="Sil"
              variant="dangerOutline"
              icon="trash-2"
              onPress={() => {
                remove.reset();
                setDeleting(true);
              }}
              style={styles.flex}
              testID="group-delete"
            />
            <AppButton title="Düzenle" icon="edit-2" onPress={() => setEditing(true)} style={styles.flex} testID="group-edit" />
          </>
        ) : undefined
      }
    >
      {detail.isLoading ? (
        <AppListSkeleton rows={3} />
      ) : detail.isError ? (
        <AppErrorState compact message={errorMessage(detail.error)} onRetry={() => detail.refetch()} />
      ) : g ? (
        <View style={styles.deviceBox}>
          <AppText variant="overline" color="textTertiary">
            Yetkili POS cihazları ({g.pos_devices.length})
          </AppText>
          {g.pos_devices.length === 0 ? (
            <AppText variant="callout" color="textSecondary">
              Bu gruba henüz POS cihazı atanmadı.
            </AppText>
          ) : (
            g.pos_devices.map((d) => (
              <View key={d.id} style={styles.deviceRow}>
                <AppText variant="body" numberOfLines={1} style={styles.flex}>
                  {d.pos_name || d.sn}
                </AppText>
                <AppText variant="mono" color="textTertiary">
                  {d.sn}
                </AppText>
              </View>
            ))
          )}
        </View>
      ) : null}
      <AppConfirmSheet
        visible={deleting && g != null}
        title="Grubu sil"
        message="Grup silinir; kartlar silinmez ancak bu gruptan çıkarılır. Bu gruba bağlı istihkak tanımları, istihkak yenileme kuralları ve bakiye yükleme kuralları da kalıcı olarak silinir."
        summary={g ? [{ label: "Grup", value: g.name }, { label: "Aktif kart", value: formatInteger(g.active_cards_count) }] : []}
        confirmLabel="Grubu sil"
        destructive
        irreversible
        loading={remove.isPending}
        error={generalErrorOf(remove.error)}
        onCancel={() => setDeleting(false)}
        onConfirm={() => g && remove.run(g.id)}
      />
      {/* Düzenleme formu iç içe açılır (iOS'ta aynı anda iki kardeş Modal sunulamaz) */}
      <GroupFormSheet state={editing && g ? { group: g } : null} onClose={() => setEditing(false)} />
    </AppSheet>
  );
}

function GroupFormSheet({ state, onClose }: { state: { group: CardGroupDetail | null } | null; onClose: () => void }) {
  const styles = useStyles();
  const access = useCardAccess();
  const group = state?.group ?? null;
  const visible = state != null;
  const [name, setName] = useState("");
  const [deviceIds, setDeviceIds] = useState<number[]>([]);
  const [nameError, setNameError] = useState<string | null>(null);
  // Kaydedilmemiş değişiklik: kapatırken onay iste
  const dirty = useFormDirty(visible, { name, deviceIds });
  const guardedClose = useGuardedClose(dirty, onClose);

  useOnOpen(visible, () => {
    setName(group?.name ?? "");
    setDeviceIds(group?.pos_device_ids ?? []);
    setNameError(null);
  });

  const options = useQuery({
    queryKey: cardKeys.deviceOptions(access.deviceSource ?? "assignable-options", access.companyId),
    queryFn: ({ signal }) => cardsApi.deviceOptions(access.deviceSource ?? "assignable-options", access.companyId, signal),
    enabled: visible && access.deviceSource != null,
    staleTime: 5 * 60_000,
  });
  const deviceOptions = useMemo(() => {
    const list = (options.data ?? []).map((d) => ({
      value: d.id,
      label: d.pos_name || d.sn,
      description: [d.sn, d.description].filter(Boolean).join(" · "),
    }));
    // Mevcut atamalar kaynakta yoksa da görünsün (kaldırılabilsin)
    for (const d of group?.pos_devices ?? [])
      if (!list.some((o) => o.value === d.id)) list.push({ value: d.id, label: d.pos_name || d.sn, description: d.sn });
    return list;
  }, [options.data, group]);

  const canPickDevices = access.deviceSource != null && !options.isError;

  const save = useLockedMutation({
    mutationFn: (payload: CardGroupPayload) =>
      group ? cardsApi.groups.update(group.id, payload) : cardsApi.groups.create({ name: payload.name ?? "", pos_device_ids: payload.pos_device_ids }),
    successMessage: group ? "Grup güncellendi." : "Grup oluşturuldu.",
    onSuccess: onClose,
    onError: (err) => {
      const fe = fieldErrorsOf(err);
      if (fe.name) setNameError(fe.name);
    },
  });

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return setNameError("Grup adı zorunludur.");
    if (trimmed.length > 50) return setNameError("Grup adı en fazla 50 karakter olabilir.");
    const payload: CardGroupPayload = {};
    if (!group || trimmed !== group.name) payload.name = trimmed;
    if (canPickDevices) {
      const changed = !group || [...deviceIds].sort().join(",") !== [...group.pos_device_ids].sort().join(",");
      if (changed) payload.pos_device_ids = deviceIds;
    }
    if (group && Object.keys(payload).length === 0) {
      toast.info("Değişiklik yapılmadı.");
      onClose();
      return;
    }
    save.run(payload);
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      dirty={dirty}
      title={group ? "Grubu düzenle" : "Yeni kart grubu"}
      dismissible={!save.isPending}
      footer={
        <>
          <AppButton title="Vazgeç" variant="outline" onPress={guardedClose} disabled={save.isPending} style={styles.flex} />
          <AppButton title="Kaydet" onPress={submit} loading={save.isPending} style={styles.flex} testID="group-form-submit" />
        </>
      }
    >
      {generalErrorOf(save.error, ["name"]) ? (
        <AppNotice tone="danger" title="Kaydedilemedi" message={generalErrorOf(save.error, ["name"]) ?? ""} />
      ) : null}
      <AppInput
        label="Grup adı"
        required
        value={name}
        onChangeText={(t) => {
          setName(t);
          setNameError(null);
        }}
        maxLength={50}
        error={nameError}
        testID="group-form-name"
      />
      {canPickDevices ? (
        <AppSelect<number>
          multiple
          label="Yetkili POS cihazları"
          value={deviceIds}
          onChange={setDeviceIds}
          options={deviceOptions}
          loading={options.isLoading}
          placeholder="POS cihazı seçin"
          sheetTitle="Yetkili POS cihazları"
          searchable
          testID="group-form-devices"
        />
      ) : (
        <AppNotice
          tone="info"
          message={
            options.isError
              ? "POS cihazı listesi alınamadı; mevcut POS cihazı atamaları değiştirilmeden korunur."
              : "Hesabınız için POS cihazı kimliği veren bir liste yok; POS cihazı ataması web panelinden yapılabilir. Mevcut atamalar korunur."
          }
        />
      )}
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    header: { gap: t.spacing.sm, paddingHorizontal: t.layout.screenPadding, paddingTop: t.spacing.md, paddingBottom: t.spacing.sm },
    toolbar: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    deviceBox: { gap: t.spacing.sm },
    deviceRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      minHeight: 40,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
  })
);
