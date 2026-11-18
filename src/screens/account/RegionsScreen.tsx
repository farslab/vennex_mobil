/**
 * Bölge ve konum yönetimi (owner). Cihazların "Konum" alanı ve panel lokasyon filtresi buradan beslenir.
 * Silme: bölge silinince konumları da silinir; konum silinince bağlı cihazların konumu boşalır (backend SET_NULL).
 */
import React, { useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppConfirmSheet,
  AppEmptyState,
  AppErrorState,
  AppIcon,
  AppIconButton,
  AppInput,
  AppListSkeleton,
  AppSelect,
  AppSheet,
  AppSwitchRow,
  AppText,
  makeStyles,
  toast,
  useTheme,
} from "@/design-system";
import { errorMessage, type ApiError } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { regionsApi, type Region, type RegionLocation } from "@/api/regions";
import { parseDecimal } from "@/utils/number";

type RegionForm = { mode: "create" } | { mode: "edit"; region: Region };
type LocationForm = { mode: "create"; regionId: number } | { mode: "edit"; regionId: number; location: RegionLocation };
type DeleteTarget = { kind: "region"; region: Region } | { kind: "location"; location: RegionLocation };

export default function RegionsScreen() {
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [regionForm, setRegionForm] = useState<RegionForm | null>(null);
  const [locationForm, setLocationForm] = useState<LocationForm | null>(null);
  const [toDelete, setToDelete] = useState<DeleteTarget | null>(null);

  const query = useQuery({
    queryKey: queryKeys.regions.list(),
    queryFn: ({ signal }) => regionsApi.list(signal),
  });

  const afterWrite = async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.regions.all });
    // Cihaz/panel ekranlarındaki konum adları da değişmiş olabilir
    queryClient.invalidateQueries({ queryKey: queryKeys.devices.all });
    queryClient.invalidateQueries({ queryKey: queryKeys.overview.all });
  };

  const remove = useMutation({
    mutationFn: async (t: DeleteTarget) =>
      t.kind === "region" ? regionsApi.deleteRegion(t.region.id) : regionsApi.deleteLocation(t.location.id),
    onSuccess: async (_, t) => {
      setToDelete(null);
      toast.success(t.kind === "region" ? "Bölge silindi" : "Konum silindi");
      await afterWrite();
    },
  });

  const toggle = (id: number) =>
    setExpanded((cur) => {
      const next = new Set(cur);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (query.isLoading) return <AppListSkeleton rows={4} />;
  if (query.isError) {
    return <AppErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} retrying={query.isFetching} />;
  }

  const regions = query.data ?? [];

  return (
    <View style={styles.root}>
      <FlatList
        data={regions}
        keyExtractor={(r) => String(r.id)}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching}
            onRefresh={() => query.refetch()}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={styles.header}>
            <AppText variant="callout" color="textSecondary" style={styles.flex}>
              Cihazların bağlı olduğu bölge ve konumlar. Panel konum filtresi bu listeden gelir.
            </AppText>
            <AppButton title="Bölge" icon="plus" size="sm" onPress={() => setRegionForm({ mode: "create" })} testID="add-region" />
          </View>
        }
        ListEmptyComponent={
          <AppEmptyState
            icon="map"
            title="Henüz bölge yok"
            description="Cihazlarınızı gruplamak için bir bölge ve altında konumlar oluşturun."
            actionLabel="Bölge oluştur"
            onAction={() => setRegionForm({ mode: "create" })}
          />
        }
        renderItem={({ item: region }) => {
          const open = expanded.has(region.id);
          return (
            <AppCard padded={false} testID={`region-${region.id}`}>
              <Pressable
                onPress={() => toggle(region.id)}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                accessibilityLabel={`${region.name}, ${region.locations.length} konum, ${region.total_pos_device_count} cihaz`}
                style={({ pressed }) => [styles.regionRow, pressed && styles.pressed]}
              >
                <AppIcon name={open ? "chevron-down" : "chevron-right"} size={18} color="textTertiary" />
                <View style={styles.flex}>
                  <AppText variant="cardTitle">{region.name}</AppText>
                  {region.description ? (
                    <AppText variant="caption" color="textTertiary" numberOfLines={2}>
                      {region.description}
                    </AppText>
                  ) : null}
                </View>
                <AppBadge label={`${region.locations.length} konum`} tone="neutral" size="sm" />
                <AppBadge label={`${region.total_pos_device_count} cihaz`} tone="info" size="sm" />
              </Pressable>
              {open ? (
                <View style={styles.locations}>
                  {region.locations.length === 0 ? (
                    <AppText variant="callout" color="textTertiary" style={styles.emptyLoc}>
                      Bu bölgede konum yok.
                    </AppText>
                  ) : (
                    region.locations.map((loc) => (
                      <Pressable
                        key={loc.id}
                        onPress={() => setLocationForm({ mode: "edit", regionId: region.id, location: loc })}
                        accessibilityRole="button"
                        accessibilityLabel={`${loc.name}, ${loc.pos_device_count} cihaz${loc.is_active ? "" : ", pasif"}`}
                        style={({ pressed }) => [styles.locRow, pressed && styles.pressed]}
                      >
                        <AppIcon name="map-pin" size={16} color="textSecondary" />
                        <View style={styles.flex}>
                          <AppText variant="body">{loc.name}</AppText>
                          {loc.address ? (
                            <AppText variant="caption" color="textTertiary" numberOfLines={1}>
                              {loc.address}
                            </AppText>
                          ) : null}
                        </View>
                        {!loc.is_active ? <AppBadge label="Pasif" tone="neutral" size="sm" /> : null}
                        <AppText variant="numericSm" color="textSecondary">
                          {loc.pos_device_count} cihaz
                        </AppText>
                      </Pressable>
                    ))
                  )}
                  <View style={styles.regionActions}>
                    <AppButton
                      title="Konum ekle"
                      icon="plus"
                      size="sm"
                      variant="outline"
                      onPress={() => setLocationForm({ mode: "create", regionId: region.id })}
                    />
                    <View style={styles.flex} />
                    <AppIconButton icon="edit-2" label={`${region.name} bölgesini düzenle`} onPress={() => setRegionForm({ mode: "edit", region })} />
                    <AppIconButton
                      icon="trash-2"
                      tone="danger"
                      label={`${region.name} bölgesini sil`}
                      onPress={() => setToDelete({ kind: "region", region })}
                    />
                  </View>
                </View>
              ) : null}
            </AppCard>
          );
        }}
      />

      <RegionFormSheet form={regionForm} onClose={() => setRegionForm(null)} onSaved={afterWrite} />
      <LocationFormSheet
        form={locationForm}
        regions={regions}
        onClose={() => setLocationForm(null)}
        onSaved={afterWrite}
        onDelete={(location) => {
          setLocationForm(null);
          setToDelete({ kind: "location", location });
        }}
      />
      <AppConfirmSheet
        visible={!!toDelete}
        title={toDelete?.kind === "region" ? "Bölgeyi sil" : "Konumu sil"}
        message={
          toDelete?.kind === "region"
            ? `"${toDelete.region.name}" ve altındaki ${toDelete.region.locations.length} konum silinecek. Bu konumlardaki cihazların konum bilgisi boşalır.`
            : toDelete
              ? `"${toDelete.location.name}" silinecek. Bu konumdaki ${toDelete.location.pos_device_count} cihazın konum bilgisi boşalır.`
              : undefined
        }
        destructive
        irreversible
        confirmLabel="Sil"
        loading={remove.isPending}
        error={remove.error ? errorMessage(remove.error) : null}
        onConfirm={() => toDelete && remove.mutate(toDelete)}
        onCancel={() => {
          setToDelete(null);
          remove.reset();
        }}
      />
    </View>
  );
}

function RegionFormSheet({ form, onClose, onSaved }: { form: RegionForm | null; onClose: () => void; onSaved: () => Promise<void> }) {
  const styles = useStyles();
  const editing = form?.mode === "edit" ? form.region : null;
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState<string | null>(null);
  const [lastForm, setLastForm] = useState<RegionForm | null>(null);

  const save = useMutation({
    mutationFn: () =>
      editing
        ? regionsApi.updateRegion(editing.id, { name: name.trim(), description: description.trim() || null })
        : regionsApi.createRegion(name.trim(), description.trim()),
    onSuccess: async () => {
      toast.success(editing ? "Bölge güncellendi" : "Bölge oluşturuldu");
      onClose();
      await onSaved();
    },
    onError: (e: ApiError) => setNameError(e.fieldErrors?.name ?? null),
  });
  if (form !== lastForm) {
    setLastForm(form);
    setName(editing?.name ?? "");
    setDescription(editing?.description ?? "");
    setNameError(null);
    save.reset();
  }

  const submit = () => {
    if (!name.trim()) return setNameError("Bölge adı gerekli.");
    if (name.trim().length > 70) return setNameError("En fazla 70 karakter.");
    setNameError(null);
    save.mutate();
  };

  return (
    <AppSheet
      visible={!!form}
      onClose={onClose}
      dismissible={!save.isPending}
      title={editing ? "Bölgeyi düzenle" : "Yeni bölge"}
      footer={
        <>
          <AppButton title="Vazgeç" variant="outline" onPress={onClose} disabled={save.isPending} style={styles.flex} />
          <AppButton title="Kaydet" onPress={submit} loading={save.isPending} style={styles.flex} testID="region-save" />
        </>
      }
    >
      <AppInput label="Bölge adı" required value={name} onChangeText={setName} error={nameError} maxLength={70} testID="region-name" />
      <AppInput label="Açıklama" value={description} onChangeText={setDescription} multiline />
      {save.error && !nameError ? (
        <AppText variant="callout" color="danger">
          {errorMessage(save.error)}
        </AppText>
      ) : null}
    </AppSheet>
  );
}

function LocationFormSheet({
  form,
  regions,
  onClose,
  onSaved,
  onDelete,
}: {
  form: LocationForm | null;
  regions: Region[];
  onClose: () => void;
  onSaved: () => Promise<void>;
  onDelete: (location: RegionLocation) => void;
}) {
  const styles = useStyles();
  const editing = form?.mode === "edit" ? form.location : null;
  const [regionId, setRegionId] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [lat, setLat] = useState("");
  const [lng, setLng] = useState("");
  const [active, setActive] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [lastForm, setLastForm] = useState<LocationForm | null>(null);

  const coord = (v: string, min: number, max: number): { value: string | null; error?: string } => {
    if (!v.trim()) return { value: null };
    const n = parseDecimal(v);
    if (n == null || n < min || n > max) return { value: null, error: `${min} ile ${max} arasında olmalı.` };
    return { value: n.toFixed(6) };
  };

  const save = useMutation({
    mutationFn: (payload: { region: number; name: string; address: string; latitude: string | null; longitude: string | null; is_active: boolean }) =>
      editing ? regionsApi.updateLocation(editing.id, payload) : regionsApi.createLocation(payload),
    onSuccess: async () => {
      toast.success(editing ? "Konum güncellendi" : "Konum eklendi");
      onClose();
      await onSaved();
    },
    onError: (e: ApiError) => setErrors(e.fieldErrors ?? {}),
  });
  if (form !== lastForm) {
    setLastForm(form);
    setRegionId(form?.regionId ?? null);
    setName(editing?.name ?? "");
    setAddress(editing?.address ?? "");
    setLat(editing?.latitude != null ? String(editing.latitude).replace(".", ",") : "");
    setLng(editing?.longitude != null ? String(editing.longitude).replace(".", ",") : "");
    setActive(editing?.is_active ?? true);
    setErrors({});
    save.reset();
  }

  const submit = () => {
    const la = coord(lat, -90, 90);
    const lo = coord(lng, -180, 180);
    const next: Record<string, string> = {};
    if (!regionId) next.region = "Bölge seçin.";
    if (!name.trim()) next.name = "Konum adı gerekli.";
    if (la.error) next.latitude = la.error;
    if (lo.error) next.longitude = lo.error;
    if ((la.value == null) !== (lo.value == null) && !la.error && !lo.error) next.longitude = "Enlem ve boylam birlikte girilmeli.";
    setErrors(next);
    if (Object.keys(next).length) return;
    save.mutate({ region: regionId!, name: name.trim(), address: address.trim(), latitude: la.value, longitude: lo.value, is_active: active });
  };

  return (
    <AppSheet
      visible={!!form}
      onClose={onClose}
      dismissible={!save.isPending}
      title={editing ? "Konumu düzenle" : "Yeni konum"}
      footer={
        <>
          {editing ? (
            <AppIconButton icon="trash-2" tone="danger" label="Konumu sil" onPress={() => onDelete(editing)} />
          ) : null}
          <AppButton title="Vazgeç" variant="outline" onPress={onClose} disabled={save.isPending} style={styles.flex} />
          <AppButton title="Kaydet" onPress={submit} loading={save.isPending} style={styles.flex} testID="location-save" />
        </>
      }
    >
      <AppSelect
        label="Bölge"
        required
        options={regions.map((r) => ({ value: r.id, label: r.name }))}
        value={regionId}
        onChange={setRegionId}
        error={errors.region}
      />
      <AppInput label="Konum adı" required value={name} onChangeText={setName} error={errors.name} maxLength={100} testID="location-name" />
      <AppInput label="Adres" value={address} onChangeText={setAddress} multiline error={errors.address} />
      <View style={styles.coords}>
        <View style={styles.flex}>
          <AppInput label="Enlem" placeholder="41,0082" keyboardType="numbers-and-punctuation" value={lat} onChangeText={setLat} error={errors.latitude} />
        </View>
        <View style={styles.flex}>
          <AppInput label="Boylam" placeholder="28,9784" keyboardType="numbers-and-punctuation" value={lng} onChangeText={setLng} error={errors.longitude} />
        </View>
      </View>
      <AppSwitchRow label="Aktif" description="Pasif konumlar seçim listelerinde gösterilmez" value={active} onChange={setActive} />
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    content: { padding: t.layout.screenPadding, gap: t.spacing.md, paddingBottom: t.spacing.huge },
    header: { flexDirection: "row", alignItems: "center", gap: t.spacing.md, marginBottom: t.spacing.xs },
    flex: { flex: 1 },
    pressed: { backgroundColor: t.colors.surfacePressed },
    regionRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, padding: t.layout.cardPadding, minHeight: 56 },
    locations: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: t.colors.border },
    locRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      paddingHorizontal: t.layout.cardPadding,
      paddingVertical: t.spacing.md,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      minHeight: t.layout.minTouchTarget,
    },
    emptyLoc: { padding: t.layout.cardPadding },
    regionActions: { flexDirection: "row", alignItems: "center", gap: t.spacing.xs, padding: t.spacing.sm, paddingLeft: t.layout.cardPadding },
    coords: { flexDirection: "row", gap: t.spacing.md },
  })
);
