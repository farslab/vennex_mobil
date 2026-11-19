/**
 * Ürün şablonları — route "ProductTemplates" (başlık stack'ten).
 * Liste `GET product-templates/` (sayfasız) alanlarıyla çizilir: item_count, assigned_device_count,
 * machine_type — şablon başına detay isteği (N+1) YOK. Arama/tip filtresi istemcide (backend desteklemiyor).
 */
import React, { useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AppBadge,
  AppButton,
  AppEmptyState,
  AppErrorState,
  AppIconButton,
  AppListRow,
  AppListSkeleton,
  AppSearchField,
  AppSegmented,
  AppSheet,
  AppText,
  makeStyles,
  useTheme,
} from "@/design-system";
import { templatesApi } from "@/api/templates";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { useAuthStore } from "@/store/authStore";
import { canManageDeviceSettings } from "@/auth/permissions";
import { machineTypeLabel } from "@/components/devices/deviceHelpers";
import { formatInteger } from "@/utils/number";
import { formatRelative } from "@/utils/date";
import { normalizeForSearch } from "@/utils/text";
import type { RootStackParamList } from "@/navigation/types";
import type { ProductTemplateSummary } from "@/types/templates";
import { TemplateFormSheet } from "./TemplateFormSheet";
import { TemplateOps, type TemplateOp } from "./TemplateOps";

type TypeFilter = "all" | "0" | "1";

/** Seçili şirket stok modunda mı (send/ad alanı davranışı için) */
export function useCompanyStockMode(): boolean | null {
  return useAuthStore((s) => {
    const c = s.user?.companies?.find((x) => x.id === s.selectedCompanyId) ?? s.user?.companies?.[0];
    return c ? !!c.uses_stock_mode : null;
  });
}

export default function ProductTemplatesScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const styles = useStyles();
  const { colors } = useTheme();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const canManage = canManageDeviceSettings(user);
  const stockMode = useCompanyStockMode();

  const [search, setSearch] = useState("");
  const [type, setType] = useState<TypeFilter>("all");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ProductTemplateSummary | null>(null);
  const [actionsFor, setActionsFor] = useState<ProductTemplateSummary | null>(null);
  const [op, setOp] = useState<TemplateOp>(null);
  const [opTarget, setOpTarget] = useState<ProductTemplateSummary | null>(null);

  const query = useQuery({
    queryKey: queryKeys.templates.list(),
    queryFn: ({ signal }) => templatesApi.list(signal),
  });

  const filtered = useMemo(() => {
    const q = normalizeForSearch(search);
    return (query.data ?? []).filter(
      (t) =>
        (type === "all" || String(t.machine_type) === type) &&
        (!q || normalizeForSearch(`${t.name} ${t.description ?? ""}`).includes(q))
    );
  }, [query.data, search, type]);

  const openEditor = (t: ProductTemplateSummary) => navigation.navigate("TemplateProductsEdit", { templateId: t.id, title: t.name });

  const startOp = (next: TemplateOp, t: ProductTemplateSummary) => {
    setActionsFor(null);
    setOpTarget(t);
    setOp(next);
  };

  return (
    <View style={styles.root} testID="templates-screen">
      <View style={styles.toolbar}>
        <View style={styles.searchRow}>
          <View style={styles.flex}>
            <AppSearchField value={search} onChangeText={setSearch} placeholder="Şablon ara" testID="templates-search" />
          </View>
          {canManage ? (
            <AppButton
              title="Yeni"
              icon="plus"
              size="sm"
              onPress={() => {
                setEditing(null);
                setFormOpen(true);
              }}
              testID="template-new"
            />
          ) : null}
        </View>
        <AppSegmented<TypeFilter>
          value={type}
          onChange={setType}
          items={[
            { key: "all", label: "Tümü" },
            { key: "0", label: "Snack" },
            { key: "1", label: "Kahve" },
          ]}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(t) => String(t.id)}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={query.isRefetching && !query.isLoading}
            onRefresh={() => query.refetch()}
            tintColor={colors.primary}
            colors={[colors.primary]}
          />
        }
        ListEmptyComponent={
          query.isLoading ? (
            <AppListSkeleton rows={4} />
          ) : query.isError ? (
            <AppErrorState compact message={errorMessage(query.error)} onRetry={() => query.refetch()} />
          ) : (
            <AppEmptyState
              compact
              icon="layers"
              title={search || type !== "all" ? "Eşleşen şablon yok" : "Henüz şablon yok"}
              description={canManage && !search ? "POS cihazlarına hızlıca ürün dağıtmak için bir şablon oluşturun." : undefined}
            />
          )
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openEditor(item)}
            accessibilityRole="button"
            accessibilityLabel={`${item.name}, ${machineTypeLabel(item.machine_type)}, ${formatInteger(item.item_count)} kalem, ${formatInteger(item.assigned_device_count)} POS cihazı`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            testID={`template-row-${item.id}`}
          >
            <View style={styles.flex}>
              <View style={styles.titleRow}>
                <AppText variant="bodyStrong" numberOfLines={1} style={styles.shrink}>
                  {item.name}
                </AppText>
                <AppBadge size="sm" tone={item.machine_type === 1 ? "warning" : "info"} label={machineTypeLabel(item.machine_type)} />
              </View>
              {item.description ? (
                <AppText variant="caption" color="textSecondary" numberOfLines={1}>
                  {item.description}
                </AppText>
              ) : null}
              <AppText variant="numericSm" color="textTertiary">
                {formatInteger(item.item_count)} kalem · {formatInteger(item.assigned_device_count)} POS cihazı
                {item.updated_at ? ` · ${formatRelative(item.updated_at)}` : ""}
              </AppText>
            </View>
            {canManage ? (
              <AppIconButton icon="more-horizontal" label={`${item.name} işlemleri`} onPress={() => setActionsFor(item)} testID={`template-actions-${item.id}`} />
            ) : null}
          </Pressable>
        )}
      />

      <AppSheet visible={actionsFor != null} onClose={() => setActionsFor(null)} title={actionsFor?.name ?? ""} testID="template-actions">
        {actionsFor ? (
          <View style={styles.actions}>
            <AppListRow icon="edit-2" title="Kalemleri düzenle" onPress={() => { const t = actionsFor; setActionsFor(null); openEditor(t); }} />
            <AppListRow
              icon="type"
              title="Adı ve açıklamayı düzenle"
              onPress={() => {
                setEditing(actionsFor);
                setActionsFor(null);
                setFormOpen(true);
              }}
            />
            <AppListRow icon="link" title="POS cihazlarına ata" subtitle="Şablon değişiklikleri eşli POS cihazlarına otomatik yansır" onPress={() => startOp("assign", actionsFor)} />
            {stockMode === false ? (
              <AppListRow icon="send" title="POS cihazına gönder" subtitle="POS cihazının ürünlerini bir kez şablonla değiştirir" onPress={() => startOp("send", actionsFor)} />
            ) : null}
            <AppListRow icon="trash-2" title="Sil" destructive last onPress={() => startOp("delete", actionsFor)} />
          </View>
        ) : null}
      </AppSheet>

      {canManage ? (
        <>
          <TemplateFormSheet
            visible={formOpen}
            template={editing}
            onClose={() => setFormOpen(false)}
            onSaved={(t) => {
              queryClient.invalidateQueries({ queryKey: queryKeys.templates.all });
              if (!editing) navigation.navigate("TemplateProductsEdit", { templateId: t.id, title: t.name });
            }}
          />
          <TemplateOps
            op={op}
            template={opTarget}
            onClose={() => {
              setOp(null);
            }}
          />
        </>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
    shrink: { flexShrink: 1 },
    toolbar: {
      gap: t.spacing.sm,
      paddingHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.sm,
      backgroundColor: t.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    searchRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    listContent: { flexGrow: 1 },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.sm,
      minHeight: 72,
      paddingLeft: t.layout.screenPadding,
      paddingRight: t.spacing.xs,
      paddingVertical: t.spacing.md,
      backgroundColor: t.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    pressed: { backgroundColor: t.colors.surfacePressed },
    titleRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    actions: { marginHorizontal: -t.layout.screenPadding },
  })
);
