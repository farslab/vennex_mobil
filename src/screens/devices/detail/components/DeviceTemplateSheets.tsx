/**
 * Cihaz tarafı şablon işlemleri:
 *  - Şablon ata: `POST pos-devices/{sn}/assign-template/ {template_id}` (ürünler şablondan yeniden yazılır)
 *  - Eşlemeyi kaldır: `DELETE …/assign-template/` (ürünler kalır)
 *  - Şablon olarak kaydet: `POST …/save-as-template/ {name, description?}`
 * Şablon listesi makine tipine (detaydaki pos_odemetip) göre süzülür — liste uçlarında N+1 yok.
 */
import React, { useMemo, useState } from "react";
import { useOnOpen } from "@/components/devices/useOnOpen";
import { FlatList, Pressable, StyleSheet, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AppBadge,
  AppButton,
  AppConfirmSheet,
  AppEmptyState,
  AppErrorState,
  AppIcon,
  AppInput,
  AppListSkeleton,
  AppNotice,
  AppSheet,
  AppText,
  makeStyles,
  toast,
} from "@/design-system";
import { devicesApi } from "@/api/devices";
import { templatesApi } from "@/api/templates";
import { errorMessage, type ApiError } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { useSingleFlight } from "@/hooks/useSingleFlight";
import { isKnownMachineType, machineTypeLabel } from "@/components/devices/deviceHelpers";
import { formatInteger } from "@/utils/number";
import type { ProductTemplateSummary } from "@/types/templates";

export function AssignTemplateSheet({
  visible,
  sn,
  machineType,
  onClose,
  onDone,
}: {
  visible: boolean;
  sn: string;
  machineType: number | null;
  onClose: () => void;
  onDone: () => void;
}) {
  const styles = useStyles();
  const [picked, setPicked] = useState<ProductTemplateSummary | null>(null);

  useOnOpen(visible, () => setPicked(null));

  const templates = useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: ({ signal }) => templatesApi.list(signal),
    enabled: visible,
  });

  const known = isKnownMachineType(machineType);
  const options = useMemo(
    () => (templates.data ?? []).filter((t) => !known || t.machine_type === machineType),
    [templates.data, known, machineType]
  );

  const assign = useMutation({
    mutationFn: (tpl: ProductTemplateSummary) => devicesApi.assignTemplate(sn, tpl.id),
    onSuccess: (res) => {
      const parts = [`${res.created} eklendi`, `${res.updated} güncellendi`, `${res.deleted} silindi`];
      toast.success(`Şablon atandı: ${parts.join(", ")}.`);
      if (res.skipped.length) toast.info(`Atlanan kalemler: ${res.skipped.join(", ")}`);
      setPicked(null);
      onDone();
      onClose();
    },
  });
  // Atama onayı tek uçuşlu: art arda dokunuş şablonu iki kez yazmaz
  const confirmAssign = useSingleFlight(() => (picked ? assign.mutateAsync(picked) : Promise.resolve()));

  return (
    <AppSheet visible={visible} onClose={onClose} title="Şablon ata" subtitle={known ? `${machineTypeLabel(machineType)} şablonları` : undefined} scrollable={false} testID="assign-template-sheet">
      {!known ? (
        <AppNotice tone="warning" message="Cihazın ödeme tipi (Snack/Kahve) bilinmiyor; tüm şablonlar listeleniyor. Uyuşmayan şablon sunucu tarafından reddedilir." />
      ) : null}
      {templates.isLoading ? (
        <AppListSkeleton rows={4} />
      ) : templates.isError ? (
        <AppErrorState compact message={errorMessage(templates.error)} onRetry={() => templates.refetch()} />
      ) : (
        <FlatList
          data={options}
          keyExtractor={(t) => String(t.id)}
          style={styles.list}
          ListEmptyComponent={<AppEmptyState compact icon="layers" title="Uygun şablon yok" description="Bu makine tipinde kayıtlı şablon bulunmuyor." />}
          renderItem={({ item }) => (
            <Pressable
              onPress={() => setPicked(item)}
              accessibilityRole="button"
              accessibilityLabel={`${item.name}, ${machineTypeLabel(item.machine_type)}`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              testID={`assign-template-${item.id}`}
            >
              <View style={styles.flex}>
                <AppText variant="bodyStrong" numberOfLines={1}>
                  {item.name}
                </AppText>
                <AppText variant="caption" color="textTertiary">
                  {item.item_count != null ? `${formatInteger(item.item_count)} kalem` : "—"}
                  {item.assigned_device_count != null ? ` · ${formatInteger(item.assigned_device_count)} POS cihazı` : ""}
                </AppText>
              </View>
              <AppBadge size="sm" tone="neutral" label={machineTypeLabel(item.machine_type)} />
              <AppIcon name="chevron-right" size={18} color="textTertiary" />
            </Pressable>
          )}
        />
      )}
      <AppConfirmSheet
        visible={picked != null}
        title="Şablonu ata"
        message="Cihazın ürün/slot listesi şablona göre yeniden yazılır; şablonda olmayan ürünler silinir ve miktarlar sıfırlanır."
        summary={picked ? [
          { label: "Şablon", value: picked.name },
          { label: "Kalem", value: picked.item_count != null ? formatInteger(picked.item_count) : "—" },
          { label: "Cihaz", value: sn },
        ] : undefined}
        confirmLabel="Ata"
        destructive
        irreversible
        loading={assign.isPending}
        error={assign.error ? errorMessage(assign.error) : null}
        onConfirm={confirmAssign}
        onCancel={() => {
          setPicked(null);
          assign.reset();
        }}
      />
    </AppSheet>
  );
}

export function SaveAsTemplateSheet({
  visible,
  sn,
  onClose,
  onDone,
}: {
  visible: boolean;
  sn: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const styles = useStyles();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);

  useOnOpen(visible, () => {
      setName("");
      setDescription("");
      setError(null);
  });

  const save = useMutation({
    mutationFn: () => devicesApi.saveAsTemplate(sn, { name: name.trim(), ...(description.trim() ? { description: description.trim() } : {}) }),
    onSuccess: (res) => {
      toast.success(`“${res.name || name.trim()}” şablonu oluşturuldu.`);
      onDone();
      onClose();
    },
    onError: (e) => setError((e as ApiError).fieldErrors?.name ?? errorMessage(e)),
  });

  const submit = () => {
    if (!name.trim()) return setError("Şablon adı zorunlu.");
    setError(null);
    save.mutate();
  };

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title="Şablon olarak kaydet"
      subtitle="Cihazdaki ürün/slot listesinden yeni şablon oluşturulur"
      dismissible={!save.isPending}
      footer={
        <>
          <AppButton title="Vazgeç" variant="outline" onPress={onClose} disabled={save.isPending} style={styles.flex} />
          <AppButton title="Kaydet" onPress={submit} loading={save.isPending} style={styles.flex} testID="save-as-template-submit" />
        </>
      }
    >
      <AppInput label="Şablon adı" required value={name} onChangeText={setName} maxLength={100} error={error} testID="save-as-template-name" />
      <AppInput label="Açıklama" value={description} onChangeText={setDescription} multiline />
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    list: { maxHeight: 420 },
    row: {
      minHeight: 56,
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      paddingVertical: t.spacing.sm,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    pressed: { backgroundColor: t.colors.surfacePressed },
  })
);
