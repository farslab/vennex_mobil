/**
 * Şablon editörü — route "TemplateProductsEdit" { templateId, title? } (headerShown: true; başlık setOptions).
 * Kalemler gerçek `GET product-templates/{id}/items/` yanıtından; her yazma tek kalem (POST/PATCH/DELETE).
 * Reçete/bileşen düzenleme mobil API'de YOK → sahte reçete arayüzü gösterilmez.
 */
import React, { useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppEmptyState,
  AppErrorState,
  AppListRow,
  AppListSkeleton,
  AppNotice,
  AppText,
  makeStyles,
  useTheme,
} from "@/design-system";
import { templatesApi } from "@/api/templates";
import { errorMessage, type ApiError } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { useAuthStore } from "@/store/authStore";
import { canManageDeviceSettings } from "@/auth/permissions";
import { machineTypeLabel } from "@/components/devices/deviceHelpers";
import { formatCurrency, formatInteger } from "@/utils/number";
import type { RootScreenProps } from "@/navigation/types";
import type { TemplateItem } from "@/types/templates";
import { TemplateItemSheet } from "./TemplateItemSheet";
import { TemplateFormSheet } from "./TemplateFormSheet";
import { TemplateOps, type TemplateOp } from "./TemplateOps";
import { useCompanyStockMode } from "./ProductTemplatesScreen";

export default function TemplateEditorScreen({ route, navigation }: RootScreenProps<"TemplateProductsEdit">) {
  const { templateId, title } = route.params;
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = canManageDeviceSettings(user);
  const stockMode = useCompanyStockMode() === true;

  const [itemSheet, setItemSheet] = useState<{ item: TemplateItem | null } | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [op, setOp] = useState<TemplateOp>(null);

  const detail = useQuery({
    queryKey: queryKeys.templates.detail(templateId),
    queryFn: ({ signal }) => templatesApi.detail(templateId, signal),
  });
  const items = useQuery({
    queryKey: queryKeys.templates.items(templateId),
    queryFn: ({ signal }) => templatesApi.items(templateId, signal),
  });

  const tpl = detail.data;
  const headerTitle = tpl?.name || title || "Şablon";
  useEffect(() => {
    navigation.setOptions({ title: headerTitle });
  }, [navigation, headerTitle]);

  const list = useMemo(() => items.data ?? [], [items.data]);
  const nextOrder = useMemo(() => list.reduce((m, i) => Math.max(m, i.order), -1) + 1, [list]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
    // Kalem değişiklikleri eşli cihazlara senkronlanır
    queryClient.invalidateQueries({ queryKey: queryKeys.devices.all });
  };

  const refresh = () => {
    detail.refetch();
    items.refetch();
  };

  if (detail.isLoading) return <AppListSkeleton rows={6} />;
  if (detail.isError || !tpl) {
    const status = (detail.error as ApiError | null)?.status;
    return (
      <View style={styles.root}>
        <AppErrorState
          title={status === 404 ? "Şablon bulunamadı" : "Şablon yüklenemedi"}
          message={status === 404 ? "Şablon silinmiş olabilir." : errorMessage(detail.error)}
          onRetry={() => detail.refetch()}
        />
      </View>
    );
  }

  const opTarget = {
    id: tpl.id,
    name: tpl.name,
    machine_type: tpl.machine_type,
    item_count: list.length,
    assigned_device_count: tpl.assigned_devices.length,
    assigned_sns: tpl.assigned_devices.map((d) => d.sn),
  };

  const header = (
    <View style={styles.header}>
      <AppCard>
        <View style={styles.headTop}>
          <View style={styles.flex}>
            <AppText variant="cardTitle" numberOfLines={2}>
              {tpl.name}
            </AppText>
            {tpl.description ? (
              <AppText variant="callout" color="textSecondary">
                {tpl.description}
              </AppText>
            ) : null}
          </View>
          <AppBadge tone={tpl.machine_type === 1 ? "warning" : "info"} label={machineTypeLabel(tpl.machine_type)} />
        </View>
        <AppText variant="numericSm" color="textTertiary" style={styles.counts}>
          {formatInteger(list.length)} kalem · {formatInteger(tpl.assigned_devices.length)} eşli cihaz · {stockMode ? "Stok modu" : "Normal mod"}
        </AppText>
        {canManage ? (
          <View style={styles.actions}>
            <AppButton title="Cihazlara ata" icon="link" size="sm" onPress={() => setOp("assign")} style={styles.flex} disabled={list.length === 0} testID="editor-assign" />
            <AppButton title="Düzenle" icon="edit-2" size="sm" variant="outline" onPress={() => setFormOpen(true)} style={styles.flex} />
            <AppButton title="Sil" icon="trash-2" size="sm" variant="dangerOutline" onPress={() => setOp("delete")} />
          </View>
        ) : null}
        {canManage && list.length === 0 ? (
          <AppText variant="caption" color="textTertiary" style={styles.counts}>
            Atama için şablonda en az bir kalem olmalı.
          </AppText>
        ) : null}
      </AppCard>
      {!canManage ? <AppNotice tone="info" message="Şablonu düzenlemek için cihaz ayarı yetkisi gerekir." /> : null}
      {stockMode ? (
        <AppText variant="caption" color="textTertiary">
          Reçete ve bileşen düzeni mobil uygulamada düzenlenemez; yönetim panelinden yapılır.
        </AppText>
      ) : null}
      <View style={styles.listHead}>
        <AppText variant="overline" color="textTertiary">
          Kalemler
        </AppText>
        {canManage ? (
          <AppButton title="Kalem ekle" icon="plus" size="sm" variant="ghost" onPress={() => setItemSheet({ item: null })} testID="editor-add-item" />
        ) : null}
      </View>
    </View>
  );

  const footer = (
    <View style={styles.footer}>
      <AppText variant="overline" color="textTertiary" style={styles.footerTitle}>
        Eşli cihazlar · {formatInteger(tpl.assigned_devices.length)}
      </AppText>
      {tpl.assigned_devices.length === 0 ? (
        <AppText variant="caption" color="textTertiary" style={styles.footerTitle}>
          Bu şablon henüz bir cihaza eşlenmedi.
        </AppText>
      ) : (
        <AppCard padded={false}>
          {tpl.assigned_devices.map((d, i) => (
            <AppListRow
              key={d.sn}
              icon="cpu"
              title={d.pos_name || d.sn}
              subtitle={d.sn}
              last={i === tpl.assigned_devices.length - 1}
              onPress={() => navigation.navigate("DeviceDetail", { sn: d.sn, name: d.pos_name ?? undefined })}
            />
          ))}
        </AppCard>
      )}
    </View>
  );

  return (
    <View style={styles.root} testID="template-editor">
      <FlatList
        data={list}
        keyExtractor={(i) => String(i.id)}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
        refreshControl={<RefreshControl refreshing={(detail.isRefetching || items.isRefetching) && !items.isLoading} onRefresh={refresh} tintColor={colors.primary} colors={[colors.primary]} />}
        ListEmptyComponent={
          items.isLoading ? (
            <AppListSkeleton rows={4} />
          ) : items.isError ? (
            <AppErrorState compact message={errorMessage(items.error)} onRetry={() => items.refetch()} />
          ) : (
            <AppEmptyState compact icon="package" title="Kalem yok" description={canManage ? "“Kalem ekle” ile ürün ekleyin." : undefined} />
          )
        }
        renderItem={({ item }) => (
          <ItemRow item={item} onPress={canManage ? () => setItemSheet({ item }) : undefined} />
        )}
      />

      {canManage ? (
        <>
          <TemplateItemSheet
            visible={itemSheet != null}
            templateId={templateId}
            stockMode={stockMode}
            item={itemSheet?.item ?? null}
            nextOrder={nextOrder}
            onClose={() => setItemSheet(null)}
            onSaved={invalidate}
          />
          <TemplateFormSheet
            visible={formOpen}
            template={{ ...tpl, assigned_device_count: tpl.assigned_devices.length }}
            onClose={() => setFormOpen(false)}
            onSaved={invalidate}
          />
          <TemplateOps op={op} template={opTarget} onClose={() => setOp(null)} onDeleted={() => navigation.goBack()} />
        </>
      ) : null}
    </View>
  );
}

function ItemRow({ item, onPress }: { item: TemplateItem; onPress?: () => void }) {
  const styles = useStyles();
  const name = item.stock_sku_name || item.name || "Adsız kalem";
  const slot = item.is_wildcard ? "W" : item.urun_no != null ? String(item.urun_no) : "—";
  const content = (
    <>
      <View style={[styles.slot, item.is_wildcard && styles.slotWildcard]}>
        <AppText variant="numericSm" color={item.is_wildcard ? "primary" : "textSecondary"}>
          {slot}
        </AppText>
      </View>
      <View style={styles.flex}>
        <AppText variant="calloutStrong" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="caption" color="textTertiary" numberOfLines={1}>
          {item.stock_sku_code ? `${item.stock_sku_code} · ` : ""}Kapasite {formatInteger(item.max_quantity)}
        </AppText>
      </View>
      <AppText variant="numeric">{formatCurrency(item.price)}</AppText>
    </>
  );
  const label = `${item.is_wildcard ? "Wildcard" : `Slot ${slot}`}, ${name}, ${formatCurrency(item.price)}`;
  return onPress ? (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label} accessibilityHint="Kalemi düzenler" style={({ pressed }) => [styles.row, pressed && styles.pressed]} testID={`template-item-${item.id}`}>
      {content}
    </Pressable>
  ) : (
    <View style={styles.row} accessible accessibilityLabel={label} testID={`template-item-${item.id}`}>
      {content}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    header: { padding: t.layout.screenPadding, gap: t.spacing.md, paddingBottom: t.spacing.sm },
    headTop: { flexDirection: "row", alignItems: "flex-start", gap: t.spacing.md },
    counts: { marginTop: t.spacing.sm },
    actions: { flexDirection: "row", gap: t.spacing.sm, marginTop: t.spacing.md },
    listHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      minHeight: 56,
      paddingHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.sm,
      backgroundColor: t.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    pressed: { backgroundColor: t.colors.surfacePressed },
    slot: {
      width: 36,
      height: 36,
      borderRadius: t.radius.xs,
      backgroundColor: t.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    slotWildcard: { backgroundColor: t.colors.primarySubtle },
    footer: { padding: t.layout.screenPadding, gap: t.spacing.sm, paddingBottom: t.spacing.huge },
    footerTitle: { paddingHorizontal: 2 },
  })
);
