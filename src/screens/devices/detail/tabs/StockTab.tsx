/**
 * Stok / Slotlar — `GET pos-devices/{sn}/products/` (mode: stock|normal).
 * Stok modu yazma: manage_stock · normal mod yazma: manage_device_settings (views/pos_devices.py:789-890).
 * Şablon işlemleri backend'de yalnız Mgmt ister; uygulama varsayılan-RED gereği manage_device_settings arar.
 */
import { EXPORTS } from "@/api/exports";
import { useExcelExport } from "@/hooks/useExcelExport";
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppConfirmSheet,
  AppEmptyState,
  AppErrorState,
  AppListSkeleton,
  AppNotice,
  AppSelect,
  AppText,
  makeStyles,
  toast,
  useTheme,
} from "@/design-system";
import { devicesApi } from "@/api/devices";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { FillBar } from "@/components/devices/DeviceUi";
import { deviceFillInfo, productDisplayName, slotFill, slotLabel } from "@/components/devices/deviceHelpers";
import { formatCurrency, formatInteger } from "@/utils/number";
import type { BulkQuantityUpdate, PosDeviceDetail, PosProduct } from "@/types/devices";
import { useDeviceProducts, useInvalidateDevices, type DeviceAccess } from "../useDeviceQueries";
import { SlotFormSheet } from "../components/SlotFormSheet";
import { BulkQuantitiesSheet } from "../components/BulkQuantitiesSheet";
import { AssignTemplateSheet, SaveAsTemplateSheet } from "../components/DeviceTemplateSheets";

export const sourceLocationsKey = () => [...queryKeys.devices.all, "source-locations"] as const;

/** Tümünü doldur özeti — backend reçeteli (composite) slotları atladığından "tahmini" */
export function fillAllEstimate(items: PosProduct[]): { slots: number; units: number } {
  let slots = 0;
  let units = 0;
  for (const i of items) {
    const need = i.max_quantity - i.quantity;
    if (i.stock_sku != null && need > 0) {
      slots += 1;
      units += need;
    }
  }
  return { slots, units };
}

const TECH_DEFAULT = 0;

export function StockTab({
  sn,
  detail,
  access,
}: {
  sn: string;
  detail: PosDeviceDetail;
  access: DeviceAccess;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const invalidate = useInvalidateDevices();
  const excel = useExcelExport();
  const products = useDeviceProducts(sn);
  const data = products.data;
  const isStock = data?.mode === "stock";
  const canEditItems = data ? (isStock ? access.manageStock : access.manageSettings) : false;
  const canTemplates = access.manageSettings;

  const [editing, setEditing] = useState<PosProduct | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [fillConfirm, setFillConfirm] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [unassignConfirm, setUnassignConfirm] = useState(false);
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [sourceId, setSourceId] = useState<number | null>(access.isTech ? TECH_DEFAULT : null);

  const locations = useQuery({
    queryKey: sourceLocationsKey(),
    queryFn: ({ signal }) => devicesApi.sourceLocations(signal),
    enabled: isStock && access.manageStock,
    staleTime: 5 * 60_000,
  });

  const sourceOptions = useMemo(
    () => [
      ...(access.isTech ? [{ value: TECH_DEFAULT, label: "Varsayılan lokasyonum", description: "Size atanmış tek lokasyon kullanılır" }] : []),
      ...(locations.data ?? []).map((l) => ({ value: l.id, label: l.name, description: l.location_type_display ?? undefined })),
    ],
    [locations.data, access.isTech]
  );
  const sourceLabel = sourceOptions.find((o) => o.value === sourceId)?.label ?? "—";
  const sourceParam = sourceId == null || sourceId === TECH_DEFAULT ? null : sourceId;
  const sourceReady = sourceId != null;

  const fillAll = useMutation({
    mutationFn: () => devicesApi.fillAllStock(sn, sourceParam),
    onSuccess: (res) => {
      toast.success(res.detail || `${res.filled_count} slot dolduruldu.`);
      setFillConfirm(false);
      invalidate();
    },
  });

  const bulk = useMutation({
    mutationFn: (updates: BulkQuantityUpdate[]) => devicesApi.bulkQuantities(sn, updates, sourceParam),
    onSuccess: (res) => {
      toast.success(res.detail || `${res.updated_count} slot güncellendi.`);
      setBulkOpen(false);
      invalidate();
    },
  });

  const unassign = useMutation({
    mutationFn: () => devicesApi.unassignTemplate(sn),
    onSuccess: (res) => {
      toast.success(res.detail || "Şablon eşlemesi kaldırıldı.");
      setUnassignConfirm(false);
      invalidate(true);
    },
  });

  const estimate = useMemo(() => fillAllEstimate(data?.items ?? []), [data?.items]);
  const fill = deviceFillInfo(data?.fill);
  const templateKnown = data?.template !== undefined;
  const mappedTemplate = data?.template ?? null;

  const openNew = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const header = data ? (
    <View style={styles.header}>
      <AppCard>
        <View style={styles.fillHead}>
          <View style={styles.flex}>
            <AppText variant="overline" color="textTertiary">
              Toplam doluluk
            </AppText>
            <AppText variant="metricMd" testID="stock-fill-pct">
              {fill.label}
            </AppText>
          </View>
          <View style={styles.headRight}>
            <AppBadge tone="neutral" label={isStock ? "Stok modu" : "Normal mod"} />
            {fill.source === "containers" ? (
              <AppText variant="caption" color="textSecondary" testID="stock-fill-source">
                Bileşen hazneleri
              </AppText>
            ) : fill.detail ? (
              <AppText variant="numericSm" color="textSecondary">
                {fill.detail} adet
              </AppText>
            ) : null}
          </View>
        </View>
        <FillBar pct={fill.pct} tone={fill.tone} height={6} accessibilityLabel={`Toplam doluluk ${fill.label}`} />
        <AppButton
          title={excel.exporting ? "Excel hazırlanıyor…" : "Ürünleri Excel'e aktar"}
          icon="download"
          variant="ghost"
          size="sm"
          loading={excel.exporting}
          onPress={() => excel.run(EXPORTS.deviceProducts(sn))}
          testID="device-products-export"
        />
      </AppCard>

      {isStock && access.manageStock ? (
        <AppCard title="Dolum">
          <View style={styles.gap}>
            <AppSelect<number>
              label="Kaynak lokasyon"
              required={!access.isTech}
              options={sourceOptions}
              value={sourceId}
              onChange={setSourceId}
              loading={locations.isLoading}
              placeholder="Depo / araç seçin"
              testID="stock-source"
            />
            {locations.isError ? <AppNotice tone="warning" message={`Lokasyonlar alınamadı: ${errorMessage(locations.error)}`} /> : null}
            <View style={styles.actions}>
              <AppButton
                title="Tümünü doldur"
                icon="battery-charging"
                onPress={() => {
                  fillAll.reset();
                  setFillConfirm(true);
                }}
                disabled={!sourceReady || data.items.length === 0}
                style={styles.flex}
                testID="fill-all-button"
              />
              <AppButton
                title="Toplu dolum"
                icon="edit-3"
                variant="outline"
                onPress={() => {
                  bulk.reset();
                  setBulkOpen(true);
                }}
                disabled={!sourceReady || data.items.length === 0}
                style={styles.flex}
                testID="bulk-button"
              />
            </View>
            {!sourceReady ? (
              <AppText variant="caption" color="textTertiary">
                Dolum için önce kaynak lokasyon seçin.
              </AppText>
            ) : null}
          </View>
        </AppCard>
      ) : null}

      {canTemplates ? (
        <AppCard title="Şablon">
          {/* Web kuralı: eşli cihazda yalnız "Eşlemeyi kaldır"; eşli değilken "Şablon ata" ve
              (listesi varsa) "Şablon olarak kaydet". Bilgi gelmiyorsa (eski sunucu) hepsi. */}
          {mappedTemplate ? (
            <AppText variant="callout" color="textSecondary" testID="mapped-template">
              Bu cihaz <AppText variant="callout" weight="600">{mappedTemplate.name}</AppText> şablonuna eşli.
            </AppText>
          ) : templateKnown ? (
            <AppText variant="caption" color="textTertiary" testID="mapped-template-none">
              Cihaz bir şablona eşli değil.
            </AppText>
          ) : null}
          <View style={[styles.actions, templateKnown ? styles.mt : null]}>
            {!mappedTemplate ? (
              <AppButton title="Şablon ata" icon="layers" variant="outline" size="sm" onPress={() => setAssignOpen(true)} style={styles.flex} testID="assign-template-button" />
            ) : null}
            {mappedTemplate || !templateKnown ? (
              <AppButton title="Eşlemeyi kaldır" variant="outline" size="sm" onPress={() => setUnassignConfirm(true)} style={styles.flex} testID="unassign-template-button" />
            ) : null}
          </View>
          {!mappedTemplate && data.items.length > 0 ? (
            <AppButton
              title="Şablon olarak kaydet"
              icon="save"
              variant="ghost"
              size="sm"
              onPress={() => setSaveTplOpen(true)}
              style={styles.mt}
              testID="save-as-template-button"
            />
          ) : null}
        </AppCard>
      ) : null}

      <View style={styles.listHead}>
        <AppText variant="overline" color="textTertiary">
          {isStock ? "Slotlar" : "Ürünler"} · {formatInteger(data.items.length)}
        </AppText>
        {canEditItems ? (
          <AppButton title={isStock ? "Slot ekle" : "Ürün ekle"} icon="plus" size="sm" variant="ghost" onPress={openNew} testID="add-slot-button" />
        ) : null}
      </View>
      {!canEditItems ? (
        <AppText variant="caption" color="textTertiary" style={styles.hint}>
          {isStock ? "Slot düzenlemek için stok yönetimi yetkisi gerekir." : "Ürün düzenlemek için cihaz ayarı yetkisi gerekir."}
        </AppText>
      ) : null}
    </View>
  ) : null;

  if (products.isLoading) return <AppListSkeleton rows={6} />;
  if (products.isError || !data)
    return <AppErrorState message={errorMessage(products.error)} onRetry={() => products.refetch()} retrying={products.isFetching} />;

  return (
    <View style={styles.root} testID="tab-stock">
      <FlatList
        data={data.items}
        keyExtractor={(i) => String(i.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <AppEmptyState
            compact
            icon="package"
            title={isStock ? "Slot tanımlı değil" : "Ürün tanımlı değil"}
            description={canTemplates ? "Ürün ekleyin veya bir şablon atayın." : undefined}
          />
        }
        refreshControl={
          <RefreshControl refreshing={products.isRefetching && !products.isLoading} onRefresh={() => products.refetch()} tintColor={colors.primary} colors={[colors.primary]} />
        }
        renderItem={({ item }) => (
          <SlotRow
            item={item}
            onPress={
              canEditItems
                ? () => {
                    setEditing(item);
                    setFormOpen(true);
                  }
                : undefined
            }
          />
        )}
      />

      {canEditItems ? (
        <SlotFormSheet
          visible={formOpen}
          sn={sn}
          mode={data.mode}
          item={editing}
          canDelete={canEditItems}
          onClose={() => setFormOpen(false)}
          onSaved={() => invalidate()}
        />
      ) : null}

      {isStock && access.manageStock ? (
        <>
          <BulkQuantitiesSheet
            visible={bulkOpen}
            items={data.items}
            sourceLabel={sourceLabel}
            loading={bulk.isPending}
            error={bulk.error ? errorMessage(bulk.error) : null}
            onClose={() => setBulkOpen(false)}
            onSubmit={(u) => bulk.mutate(u)}
          />
          <AppConfirmSheet
            visible={fillConfirm}
            title="Tümünü doldur"
            message="Her slot kapasitesine kadar kaynak lokasyondan doldurulur. Kaynakta stok yetmezse bakiye eksiye düşer."
            summary={[
              { label: "Cihaz", value: detail.pos_name || sn },
              { label: "Kaynak", value: sourceLabel },
              { label: "Dolacak slot (tahmini)", value: formatInteger(estimate.slots) },
              { label: "Aktarılacak (tahmini)", value: `${formatInteger(estimate.units)} adet` },
            ]}
            confirmLabel="Doldur"
            irreversible
            loading={fillAll.isPending}
            error={fillAll.error ? errorMessage(fillAll.error) : null}
            onConfirm={() => fillAll.mutate()}
            onCancel={() => setFillConfirm(false)}
          />
        </>
      ) : null}

      {canTemplates ? (
        <>
          <AssignTemplateSheet
            visible={assignOpen}
            sn={sn}
            machineType={detail.pos_odemetip}
            onClose={() => setAssignOpen(false)}
            onDone={() => invalidate(true)}
          />
          <SaveAsTemplateSheet
            visible={saveTplOpen}
            sn={sn}
            onClose={() => setSaveTplOpen(false)}
            onDone={() => invalidate(true)}
          />
          <AppConfirmSheet
            visible={unassignConfirm}
            title="Şablon eşlemesini kaldır"
            message="POS cihazının şablonla bağı kaldırılır; mevcut ürünler/slotlar POS cihazında kalır ve şablon değişiklikleri artık yansımaz."
            confirmLabel="Kaldır"
            destructive
            loading={unassign.isPending}
            error={unassign.error ? errorMessage(unassign.error) : null}
            onConfirm={() => unassign.mutate()}
            onCancel={() => {
              setUnassignConfirm(false);
              unassign.reset();
            }}
          />
        </>
      ) : null}
    </View>
  );
}

function SlotRow({ item, onPress }: { item: PosProduct; onPress?: () => void }) {
  const styles = useStyles();
  const f = slotFill(item);
  const name = productDisplayName(item);
  const body = (
    <>
      <View style={[styles.slotNo, item.is_wildcard && styles.slotWildcard]}>
        <AppText variant="numericSm" color={item.is_wildcard ? "primary" : "textSecondary"}>
          {slotLabel(item)}
        </AppText>
      </View>
      <View style={styles.flex}>
        <AppText variant="calloutStrong" numberOfLines={1}>
          {name}
        </AppText>
        <View style={styles.slotMeta}>
          {item.stock_sku_code ? (
            <AppText variant="mono" color="textTertiary" numberOfLines={1}>
              {item.stock_sku_code}
            </AppText>
          ) : null}
          <View style={styles.slotBar}>
            <FillBar pct={f.pct} tone={f.tone} />
          </View>
          <AppText variant="numericSm" color="textSecondary">
            {formatInteger(item.quantity)}/{formatInteger(item.max_quantity)}
          </AppText>
        </View>
      </View>
      <AppText variant="numeric">{formatCurrency(item.price)}</AppText>
    </>
  );
  const label = `${item.is_wildcard ? "Wildcard" : `Slot ${slotLabel(item)}`}, ${name}, ${formatInteger(item.quantity)} / ${formatInteger(item.max_quantity)}, ${formatCurrency(item.price)}`;
  if (!onPress)
    return (
      <View style={styles.slotRow} accessible accessibilityLabel={label} testID={`slot-row-${item.id}`}>
        {body}
      </View>
    );
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint="Düzenler"
      style={({ pressed }) => [styles.slotRow, pressed && styles.pressed]}
      testID={`slot-row-${item.id}`}
    >
      {body}
    </Pressable>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1 },
    flex: { flex: 1 },
    gap: { gap: t.spacing.md },
    mt: { marginTop: t.spacing.sm, alignSelf: "flex-start" },
    header: { padding: t.layout.screenPadding, gap: t.spacing.md, paddingBottom: t.spacing.sm },
    fillHead: { flexDirection: "row", alignItems: "flex-end", marginBottom: t.spacing.sm },
    headRight: { alignItems: "flex-end", gap: t.spacing.xs },
    actions: { flexDirection: "row", gap: t.spacing.sm },
    listHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: t.spacing.xs },
    hint: { marginTop: -t.spacing.sm },
    slotRow: {
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
    slotNo: {
      width: 36,
      height: 36,
      borderRadius: t.radius.xs,
      backgroundColor: t.colors.surfaceMuted,
      alignItems: "center",
      justifyContent: "center",
    },
    slotWildcard: { backgroundColor: t.colors.primarySubtle },
    slotMeta: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, marginTop: 2 },
    slotBar: { width: 44 },
  })
);
