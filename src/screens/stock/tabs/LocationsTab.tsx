import React, { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import {
  AppBadge,
  AppButton,
  AppChip,
  AppConfirmSheet,
  AppEmptyState,
  AppErrorState,
  AppIcon,
  AppIconButton,
  AppListSkeleton,
  AppText,
  makeStyles,
  toast,
  useTheme,
} from "@/design-system";
import { stockApi } from "@/api/stock";
import { errorMessage } from "@/api/client";
import { LocationTypeIcon } from "@/components/stock/LocationTypeIcon";
import { LOCATION_TYPE_META } from "@/components/stock/stockFormat";
import { STOCK_LOCATION_TYPES, type StockLocation, type StockLocationType } from "@/types/stock";
import { useStockLocations, useStockMutation } from "../hooks/useStockData";
import { LocationFormSheet } from "../components/LocationFormSheet";

export function LocationsTab({ canManage }: { canManage: boolean }) {
  const styles = useStyles();
  const { colors } = useTheme();
  const navigation = useNavigation();
  const [type, setType] = useState<StockLocationType | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StockLocation | null>(null);
  const [syncOpen, setSyncOpen] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const query = useStockLocations({ location_type: type ?? undefined, active_only: !showInactive });
  const sync = useStockMutation(() => stockApi.locations.syncVending());

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await query.refetch();
    } finally {
      setRefreshing(false);
    }
  }, [query]);

  const runSync = () => {
    setSyncError(null);
    sync.run(undefined, {
      onSuccess: (r) => {
        setSyncOpen(false);
        toast.success(`Senkronizasyon tamamlandı: ${r.created} yeni, ${r.updated} güncellendi.`);
      },
      onError: (e) => setSyncError(errorMessage(e, "Senkronizasyon başarısız.")),
    });
  };

  const items = query.data ?? [];

  const header = (
    <View style={styles.header}>
      {canManage ? (
        <View style={styles.actions}>
          <AppButton
            title="Yeni"
            icon="plus"
            accessibilityHint="Yeni lokasyon oluşturur"
            onPress={() => {
              setEditing(null);
              setFormOpen(true);
            }}
            testID="location-new"
          />
          <AppButton
            title="Otomatları senkronize et"
            icon="refresh-cw"
            variant="outline"
            onPress={() => {
              setSyncError(null);
              setSyncOpen(true);
            }}
            style={styles.flex}
            testID="location-sync"
          />
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        <AppChip label="Tümü" selected={type == null} onPress={() => setType(null)} />
        {STOCK_LOCATION_TYPES.map((t) => (
          <AppChip key={t} label={LOCATION_TYPE_META[t].label} icon={LOCATION_TYPE_META[t].icon} selected={type === t} onPress={() => setType(t)} />
        ))}
        <AppChip label="Pasifleri göster" icon={showInactive ? "check-square" : "square"} selected={showInactive} onPress={() => setShowInactive((v) => !v)} />
      </ScrollView>
    </View>
  );

  return (
    <>
      <FlatList
        data={query.isSuccess ? items : []}
        keyExtractor={(l) => String(l.id)}
        ListHeaderComponent={header}
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={
          query.isLoading ? (
            <AppListSkeleton rows={5} />
          ) : query.isError ? (
            <AppErrorState message={errorMessage(query.error)} onRetry={() => query.refetch()} retrying={query.isFetching} />
          ) : (
            <AppEmptyState
              icon="map-pin"
              title="Lokasyon bulunamadı"
              description={type || showInactive ? "Filtreyle eşleşen lokasyon yok." : "Depo, ara depo veya araç ekleyin; otomatlar senkronizasyonla gelir."}
            />
          )
        }
        renderItem={({ item }) => (
          <LocationRow
            location={item}
            canEdit={canManage && item.pos_device == null && item.location_type !== "vending_machine"}
            onPress={() => navigation.navigate("StockLocationDetail", { locationId: item.id, name: item.name })}
            onEdit={() => {
              setEditing(item);
              setFormOpen(true);
            }}
          />
        )}
      />
      {canManage ? (
        <>
          <LocationFormSheet visible={formOpen} location={editing} onClose={() => setFormOpen(false)} />
          <AppConfirmSheet
            visible={syncOpen}
            title="Otomatları senkronize et"
            message="Şirketteki her POS cihazı için otomat lokasyonu oluşturulur; adı değişen cihazların lokasyon adı güncellenir. Mevcut bakiyeler değişmez."
            confirmLabel="Senkronize et"
            loading={sync.isPending}
            error={syncError}
            onConfirm={runSync}
            onCancel={() => {
              if (!sync.isPending) setSyncOpen(false);
            }}
          />
        </>
      ) : null}
    </>
  );
}

function LocationRow({
  location: l,
  canEdit,
  onPress,
  onEdit,
}: {
  location: StockLocation;
  canEdit: boolean;
  onPress: () => void;
  onEdit: () => void;
}) {
  const styles = useStyles();
  const meta = LOCATION_TYPE_META[l.location_type];
  return (
    <View style={styles.rowWrap}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${l.name}, ${meta.label}${l.is_active ? "" : ", pasif"}${l.pos_device_sn ? `, cihaz ${l.pos_device_sn}` : ""}`}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
        testID={`location-row-${l.id}`}
      >
        <LocationTypeIcon type={l.location_type} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong" numberOfLines={1}>
            {l.name}
          </AppText>
          <View style={styles.meta}>
            <AppText variant="caption" color="textSecondary">
              {meta.label}
            </AppText>
            {l.pos_device_sn ? (
              <AppText variant="mono" color="textTertiary" numberOfLines={1}>
                · {l.pos_device_sn}
              </AppText>
            ) : null}
          </View>
        </View>
        {!l.is_active ? <AppBadge size="sm" label="Pasif" tone="neutral" dot /> : null}
        {!canEdit ? <AppIcon name="chevron-right" size={18} color="textTertiary" /> : null}
      </Pressable>
      {canEdit ? <AppIconButton icon="edit-2" label={`${l.name} lokasyonunu düzenle`} onPress={onEdit} testID={`location-edit-${l.id}`} /> : null}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    content: { paddingBottom: t.spacing.huge },
    header: { paddingTop: t.layout.screenPadding, paddingBottom: t.spacing.md, gap: t.spacing.md },
    actions: { flexDirection: "row", gap: t.spacing.sm, paddingHorizontal: t.layout.screenPadding },
    chips: { gap: t.spacing.sm, paddingHorizontal: t.layout.screenPadding },
    flex: { flex: 1 },
    rowWrap: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: t.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
      paddingRight: t.spacing.xs,
    },
    row: {
      flex: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      minHeight: 60,
      paddingVertical: t.spacing.sm,
      paddingLeft: t.layout.screenPadding,
      paddingRight: t.spacing.sm,
    },
    pressed: { backgroundColor: t.colors.surfacePressed },
    meta: { flexDirection: "row", alignItems: "center", gap: t.spacing.xs },
  })
);
