import React, { useMemo, useState } from "react";
import {
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Line, Path } from "react-native-svg";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { stockApi } from "@/api/stock";
import { useAppTheme } from "@/theme/colors";
import { radius, spacing } from "@/theme/spacing";
import { Badge, ScreenCard, EmptyState, ErrorView, LoadingView } from "@/components/Common";
import {
  SKU_KIND_LABELS,
  STOCK_LOCATION_TYPE_LABELS,
  type StockLocation,
  type StockLocationType,
  type StockSku,
} from "@/types/stock";

const TABS = [
  { key: "overview", label: "Özet" },
  { key: "locations", label: "Lokasyonlar" },
  { key: "skus", label: "SKU / Ürünler" },
  { key: "transfer", label: "Transfer" },
  { key: "receipt", label: "Stok Girişi" },
  { key: "adjustment", label: "Düzeltme" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/* ==================== WEB İKONLARI (SVG) ==================== */

function EditIcon({ color = "#94A3B8" }: { color?: string }) {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <Path
        d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function TrashIcon({ color = "#EF4444" }: { color?: string }) {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1="10" y1="11" x2="10" y2="17" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="14" y1="11" x2="14" y2="17" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function getLocationTypeBadgeColors(type: StockLocationType, isDark: boolean) {
  switch (type) {
    case "warehouse":
      return isDark ? { bg: "#1E3A8A", text: "#93C5FD" } : { bg: "#EAF1FF", text: "#2757C6" };
    case "vehicle":
      return isDark ? { bg: "#78350F", text: "#FCD34D" } : { bg: "#FDF3E2", text: "#B6781F" };
    case "depot":
      return isDark ? { bg: "#581C87", text: "#D8B4FE" } : { bg: "#F0E9FB", text: "#6B3AA8" };
    case "vending_machine":
    default:
      return isDark ? { bg: "#1F2937", text: "#D1D5DB" } : { bg: "#F1F2F4", text: "#4B5563" };
  }
}

export default function StockOverviewScreen() {
  const { colors, isDark } = useAppTheme();
  const [activeTab, setActiveTab] = useState<TabKey>("overview");

  return (
    <View style={[styles.container, { backgroundColor: isDark ? colors.bg : "#F8FAFC" }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[
          styles.tabsScroll,
          { backgroundColor: colors.surface, borderBottomColor: isDark ? colors.border : "#E2E8F0" },
        ]}
        contentContainerStyle={styles.tabsContent}
      >
        {TABS.map((t) => {
          const isActive = activeTab === t.key;
          return (
            <Pressable
              key={t.key}
              onPress={() => setActiveTab(t.key)}
              style={[
                styles.tab,
                {
                  backgroundColor: isActive ? colors.primary : isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: isActive ? colors.primary : isDark ? colors.border : "#CBD5E1",
                },
              ]}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: isActive ? "#FFFFFF" : isDark ? colors.textSecondary : colors.textPrimary },
                  isActive && styles.tabTextActive,
                ]}
              >
                {t.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {activeTab === "overview" && <OverviewTab />}
      {activeTab === "locations" && <LocationsTab />}
      {activeTab === "skus" && <SkusTab />}
      {activeTab === "transfer" && <TransferTab />}
      {activeTab === "receipt" && <ReceiptTab />}
      {activeTab === "adjustment" && <AdjustmentTab />}
    </View>
  );
}

/* ================= ÖZET ================= */

interface LocationBreakdownEntry {
  location: StockLocation;
  quantity: number;
}

function useStockBreakdownMap() {
  return useQuery({
    queryKey: ["stock-overview-breakdown"],
    queryFn: async () => {
      const locations = await stockApi.locations.list({ active_only: true });
      const nonVending = locations.filter((l) => l.location_type !== "vending_machine");

      const perLocation = await Promise.all(
        nonVending.map((loc) =>
          stockApi.locations.inventory(loc.id).then((rows) => ({ loc, rows }))
        )
      );

      const map = new Map<number, LocationBreakdownEntry[]>();
      for (const { loc, rows } of perLocation) {
        for (const row of rows) {
          const skuId = (row as any).sku as number;
          const list = map.get(skuId) ?? [];
          list.push({ location: loc, quantity: row.quantity });
          map.set(skuId, list);
        }
      }
      return map;
    },
    staleTime: 60_000,
  });
}

const LOCATION_TYPE_SORT_ORDER: Record<StockLocationType, number> = {
  warehouse: 0,
  depot: 1,
  vehicle: 2,
  vending_machine: 3,
};

function OverviewTab() {
  const { colors, isDark } = useAppTheme();
  const overviewQuery = useQuery({ queryKey: ["stock-overview"], queryFn: stockApi.overview });
  const skusQuery = useQuery({
    queryKey: ["stock-skus-all"],
    queryFn: () => stockApi.skus.list({ active_only: true }),
  });
  const breakdownQuery = useStockBreakdownMap();

  const [expandedSkuIds, setExpandedSkuIds] = useState<Set<number>>(new Set());

  const toggleExpanded = (skuId: number) => {
    setExpandedSkuIds((prev) => {
      const next = new Set(prev);
      if (next.has(skuId)) {
        next.delete(skuId);
      } else {
        next.add(skuId);
      }
      return next;
    });
  };

  if (overviewQuery.isLoading || skusQuery.isLoading) return <LoadingView label="Stok yükleniyor..." />;
  if (overviewQuery.error)
    return <ErrorView message={(overviewQuery.error as Error).message} onRetry={overviewQuery.refetch} />;
  if (skusQuery.error)
    return <ErrorView message={(skusQuery.error as Error).message} onRetry={skusQuery.refetch} />;

  const items = overviewQuery.data ?? [];
  const skus = skusQuery.data ?? [];

  const skuMetaById = new Map<number, { unit: string; packageSize: number }>();
  skus.forEach((s: any) => {
    skuMetaById.set(s.id, { unit: s.unit_short, packageSize: Number(s.package_size) || 1 });
  });

  return (
    <View style={styles.flex}>
      <FlatList
        contentContainerStyle={{ padding: spacing.md }}
        data={items}
        keyExtractor={(item) => String(item.sku_id)}
        ListHeaderComponent={
          <View
            style={[
              styles.tableContainerCard,
              {
                backgroundColor: colors.surface,
                borderColor: isDark ? colors.border : "#E2E8F0",
              },
            ]}
          >
            <Text style={[styles.tableTitle, { color: colors.textPrimary }]}>Stok Özeti</Text>
            <View
              style={[
                styles.tableHeaderRow,
                {
                  borderTopColor: isDark ? colors.border : "#E2E8F0",
                  backgroundColor: isDark ? colors.surfaceAlt : "#F8FAFC",
                },
              ]}
            >
              <Text style={[styles.tableHeaderText, { width: 18 }]} />
              <Text style={[styles.tableHeaderText, { flex: 1.4, color: colors.textMuted }]}>
                ÜRÜN / SKU KODU
              </Text>
              <Text style={[styles.tableHeaderText, { width: 95, textAlign: "right", color: colors.textMuted }]}>
                TOPLAM
              </Text>
              <Text style={[styles.tableHeaderText, { width: 75, textAlign: "right", color: colors.textMuted }]}>
                PAKET
              </Text>
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState label="Stok kaydı bulunamadı" />}
        renderItem={({ item, index }) => {
          const meta = skuMetaById.get(item.sku_id);
          const packageValue = meta ? item.total / meta.packageSize : null;
          const isExpanded = expandedSkuIds.has(item.sku_id);

          const breakdown = (breakdownQuery.data?.get(item.sku_id) ?? [])
            .slice()
            .sort((a, b) => {
              const typeDiff =
                LOCATION_TYPE_SORT_ORDER[a.location.location_type] -
                LOCATION_TYPE_SORT_ORDER[b.location.location_type];
              if (typeDiff !== 0) return typeDiff;
              return a.location.name.localeCompare(b.location.name, "tr");
            });
          const breakdownTotal = breakdown.reduce((sum, b) => sum + b.quantity, 0);

          return (
            <View>
              <Pressable
                onPress={() => toggleExpanded(item.sku_id)}
                style={[
                  styles.rowCard,
                  {
                    backgroundColor: index % 2 === 1 ? (isDark ? colors.bg : "#FAFAFC") : colors.surface,
                    borderColor: isDark ? colors.border : "#E2E8F0",
                    borderBottomWidth: isExpanded ? 0 : 1,
                  },
                ]}
              >
                <View style={{ width: 18 }}>
                  <Text style={[styles.chevron, { color: colors.textMuted }]}>{isExpanded ? "⌄" : "›"}</Text>
                </View>

                <View style={{ flex: 1.4, paddingRight: 6 }}>
                  <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={2}>
                    {item.sku_name}
                  </Text>
                  <Text style={[styles.skuCodeText, { color: colors.textMuted }]} numberOfLines={1}>
                    {item.sku_code}
                  </Text>
                </View>

                <View style={{ width: 95, alignItems: "flex-end" }}>
                  <Text style={[styles.totalValue, { color: colors.textPrimary }]}>
                    {item.total.toLocaleString("tr-TR")}
                    {meta?.unit ? (
                      <Text style={[styles.unitText, { color: colors.textMuted }]}> {meta.unit}</Text>
                    ) : null}
                  </Text>
                </View>

                <View style={{ width: 75, alignItems: "flex-end" }}>
                  <Text style={[styles.packageValue, { color: colors.textSecondary }]} numberOfLines={1}>
                    {packageValue != null
                      ? packageValue.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                      : "—"}
                  </Text>
                </View>
              </Pressable>

              {isExpanded && (
                <View
                  style={[
                    styles.breakdownContainer,
                    {
                      backgroundColor: isDark ? colors.bg : "#F8FAFC",
                      borderColor: isDark ? colors.border : "#E2E8F0",
                    },
                  ]}
                >
                  <Text style={[styles.breakdownHeader, { color: colors.textMuted }]}>
                    Depo / araç stokları — otomatlar hariç
                  </Text>

                  {breakdownQuery.isLoading ? (
                    <LoadingView label="Yükleniyor..." />
                  ) : breakdownQuery.error ? (
                    <Text style={[styles.mutedTextSmall, { color: colors.danger }]}>
                      Kırılım verisi alınamadı.
                    </Text>
                  ) : breakdown.length === 0 ? (
                    <Text style={[styles.mutedTextSmall, { color: colors.textMuted }]}>
                      Bu ürün için depo/araç kaydı yok.
                    </Text>
                  ) : (
                    <>
                      {breakdown.map((b) => (
                        <View key={b.location.id} style={styles.breakdownRow}>
                          <Text style={[styles.breakdownLocationText, { color: colors.textPrimary }]} numberOfLines={1}>
                            {b.location.name}
                          </Text>
                          <Text
                            style={[
                              styles.breakdownQtyText,
                              { color: b.quantity < 0 ? colors.danger : colors.textPrimary },
                            ]}
                          >
                            {b.quantity.toLocaleString("tr-TR")}
                          </Text>
                        </View>
                      ))}

                      <View style={[styles.breakdownTotalRow, { borderTopColor: isDark ? colors.border : "#E2E8F0" }]}>
                        <Text style={[styles.breakdownTotalLabel, { color: colors.textPrimary }]}>
                          Depo/araç toplamı
                        </Text>
                        <Text style={[styles.breakdownTotalValue, { color: colors.textPrimary }]}>
                          {breakdownTotal.toLocaleString("tr-TR")}
                        </Text>
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>
          );
        }}
      />
    </View>
  );
}

/* ================= LOKASYONLAR ================= */
function LocationsTab() {
  const { colors, isDark } = useAppTheme();
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<StockLocationType>("warehouse");
  const [typePickerOpen, setTypePickerOpen] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const locationsQuery = useQuery({
    queryKey: ["stock-locations"],
    queryFn: () => stockApi.locations.list({ active_only: true }),
  });

  const handleCreate = async () => {
    if (!newName.trim()) {
      Alert.alert("Hata", "Lokasyon adı gerekli");
      return;
    }
    try {
      await stockApi.locations.create({ name: newName.trim(), location_type: newType });
      setNewName("");
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["stock-locations"] });
    } catch (e) {
      Alert.alert("Hata", (e as Error).message);
    }
  };

  const handleDelete = (loc: StockLocation) => {
    Alert.alert("Lokasyonu sil", `${loc.name} lokasyonunu silmek istediğinize emin misiniz?`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await stockApi.locations.remove(loc.id);
            queryClient.invalidateQueries({ queryKey: ["stock-locations"] });
          } catch (e) {
            Alert.alert("Hata", (e as Error).message);
          }
        },
      },
    ]);
  };

  const handleSync = async () => {
    setSyncing(true);
    try {
      await stockApi.locations.syncVending();
      queryClient.invalidateQueries({ queryKey: ["stock-locations"] });
    } catch (e) {
      Alert.alert("Hata", (e as Error).message);
    } finally {
      setSyncing(false);
    }
  };

  if (locationsQuery.isLoading) return <LoadingView label="Lokasyonlar yükleniyor..." />;
  if (locationsQuery.error)
    return <ErrorView message={(locationsQuery.error as Error).message} onRetry={locationsQuery.refetch} />;

  const locations = locationsQuery.data ?? [];

  return (
    <View style={styles.flex}>
      <View style={styles.actionBar}>
        <Pressable
          style={[styles.secondaryBtn, { backgroundColor: colors.surface, borderColor: isDark ? colors.border : "#CBD5E1" }]}
          onPress={handleSync}
          disabled={syncing}
        >
          <Text style={[styles.secondaryBtnText, { color: colors.textSecondary }]}>
            {syncing ? "Senkronize ediliyor..." : "↻ Otomatları Senkronize Et"}
          </Text>
        </Pressable>
        <Pressable style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={() => setCreateOpen(true)}>
          <Text style={styles.primaryBtnText}>+ Lokasyon</Text>
        </Pressable>
      </View>

      <FlatList
        contentContainerStyle={{ padding: spacing.md, paddingTop: spacing.sm }}
        data={locations}
        keyExtractor={(loc) => String(loc.id)}
        ListHeaderComponent={
          <View
            style={[
              styles.tableContainerCard,
              {
                backgroundColor: colors.surface,
                borderColor: isDark ? colors.border : "#E2E8F0",
              },
            ]}
          >
            <Text style={[styles.tableTitle, { color: colors.textPrimary }]}>Lokasyonlar</Text>
            <View
              style={[
                styles.tableHeaderRow,
                {
                  borderTopColor: isDark ? colors.border : "#E2E8F0",
                  backgroundColor: isDark ? colors.surfaceAlt : "#F8FAFC",
                },
              ]}
            >
              <Text style={[styles.tableHeaderText, { flex: 1.4, color: colors.textMuted }]}>AD</Text>
              <Text style={[styles.tableHeaderText, { flex: 1, color: colors.textMuted }]}>TİP</Text>
              <Text style={[styles.tableHeaderText, { width: 65, textAlign: "center", color: colors.textMuted }]}>DURUM</Text>
              <Text style={[styles.tableHeaderText, { width: 45, textAlign: "right", color: colors.textMuted }]}>İŞLEM</Text>
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState label="Lokasyon bulunamadı" />}
        renderItem={({ item: loc, index }) => {
          const typeColors = getLocationTypeBadgeColors(loc.location_type, isDark);
          return (
            <View
              style={[
                styles.rowCard,
                {
                  backgroundColor: index % 2 === 1 ? (isDark ? colors.bg : "#FAFAFC") : colors.surface,
                  borderColor: isDark ? colors.border : "#E2E8F0",
                },
              ]}
            >
              <Text style={[styles.rowTitle, { flex: 1.4, color: colors.textPrimary }]} numberOfLines={1}>
                {loc.name}
              </Text>
              <View style={{ flex: 1 }}>
                <View style={[styles.typePill, { backgroundColor: typeColors.bg }]}>
                  <Text style={[styles.typePillText, { color: typeColors.text }]} numberOfLines={1}>
                    {STOCK_LOCATION_TYPE_LABELS[loc.location_type]}
                  </Text>
                </View>
              </View>
              <View style={{ width: 65, alignItems: "center" }}>
                <Badge label={loc.is_active ? "Aktif" : "Pasif"} tone={loc.is_active ? "success" : "muted"} />
              </View>
              <Pressable style={{ width: 45, alignItems: "flex-end" }} onPress={() => handleDelete(loc)}>
                <Text style={[styles.deleteLink, { color: colors.danger }]}>Sil</Text>
              </Pressable>
            </View>
          );
        }}
      />

      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCreateOpen(false)}>
          <Pressable style={[styles.formSheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Yeni Lokasyon</Text>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Ad</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: isDark ? colors.border : "#CBD5E1",
                  color: colors.textPrimary,
                },
              ]}
              value={newName}
              onChangeText={setNewName}
              placeholder="Lokasyon adı"
              placeholderTextColor={colors.textMuted}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Tip</Text>
            <Pressable
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: isDark ? colors.border : "#CBD5E1",
                },
              ]}
              onPress={() => setTypePickerOpen(true)}
            >
              <Text style={{ color: colors.textPrimary }}>{STOCK_LOCATION_TYPE_LABELS[newType]}</Text>
            </Pressable>

            <Pressable style={[styles.primaryBtnFull, { backgroundColor: colors.primary }]} onPress={handleCreate}>
              <Text style={styles.primaryBtnText}>Oluştur</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal visible={typePickerOpen} transparent animationType="fade" onRequestClose={() => setTypePickerOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setTypePickerOpen(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            {(Object.keys(STOCK_LOCATION_TYPE_LABELS) as StockLocationType[]).map((key) => (
              <Pressable
                key={key}
                style={[styles.modalOption, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setNewType(key);
                  setTypePickerOpen(false);
                }}
              >
                <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>
                  {STOCK_LOCATION_TYPE_LABELS[key]}
                </Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ================= SKU / ÜRÜNLER ================= */
function SkusTab() {
  const { colors, isDark } = useAppTheme();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [kindFilter, setKindFilter] = useState<StockSku["kind"]>("simple");

  const skusQuery = useQuery({
    queryKey: ["stock-skus", q],
    queryFn: () => stockApi.skus.list({ active_only: true, q: q || undefined }),
  });

  const [editTarget, setEditTarget] = useState<StockSku | null>(null);
  const [editName, setEditName] = useState("");
  const [editBarcode, setEditBarcode] = useState("");
  const [editUnitCost, setEditUnitCost] = useState("");
  const [editSalePrice, setEditSalePrice] = useState("");
  const [editVatRate, setEditVatRate] = useState("");
  const [saving, setSaving] = useState(false);

  const openEdit = (sku: StockSku) => {
    setEditTarget(sku);
    setEditName(sku.name);
    setEditBarcode(sku.barcode ?? "");
    setEditUnitCost(sku.unit_cost != null ? String(sku.unit_cost) : "");
    setEditSalePrice(sku.sale_price != null ? String(sku.sale_price) : "");
    setEditVatRate(sku.vat_rate != null ? String(sku.vat_rate) : "");
  };

  const handleSaveEdit = async () => {
    if (!editTarget) return;
    setSaving(true);
    try {
      await stockApi.skus.update(editTarget.id, {
        name: editName.trim(),
        barcode: editBarcode.trim() || null,
        unit_cost: editUnitCost ? Number(editUnitCost) : undefined,
        sale_price: editSalePrice ? Number(editSalePrice) : undefined,
        vat_rate: editVatRate ? Number(editVatRate) : undefined,
      });
      queryClient.invalidateQueries({ queryKey: ["stock-skus"] });
      queryClient.invalidateQueries({ queryKey: ["stock-skus-all"] });
      setEditTarget(null);
    } catch (e) {
      Alert.alert("Hata", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (sku: StockSku) => {
    Alert.alert("SKU sil", `"${sku.name}" ürününü silmek istediğinize emin misiniz?`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await stockApi.skus.remove(sku.id);
            queryClient.invalidateQueries({ queryKey: ["stock-skus"] });
            queryClient.invalidateQueries({ queryKey: ["stock-skus-all"] });
          } catch (e) {
            Alert.alert("Hata", (e as Error).message);
          }
        },
      },
    ]);
  };

  if (skusQuery.isLoading) return <LoadingView label="Ürünler yükleniyor..." />;
  if (skusQuery.error) return <ErrorView message={(skusQuery.error as Error).message} onRetry={skusQuery.refetch} />;

  const allSkus = skusQuery.data ?? [];
  const grouped = {
    simple: allSkus.filter((s) => s.kind === "simple"),
    composite: allSkus.filter((s) => s.kind === "composite"),
    ingredient: allSkus.filter((s) => s.kind === "ingredient"),
  };
  const skus = grouped[kindFilter];

  return (
    <>
      <FlatList
        style={styles.flex}
        contentContainerStyle={{ padding: spacing.md }}
        data={skus}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View>
            <TextInput
              style={[
                styles.search,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: isDark ? colors.border : "#CBD5E1",
                  color: colors.textPrimary,
                },
              ]}
              placeholder="Ürün adı veya SKU kodu ara..."
              placeholderTextColor={colors.textMuted}
              value={q}
              onChangeText={setQ}
            />

            <View style={styles.skuKindTabsRow}>
              {(Object.keys(SKU_KIND_LABELS) as StockSku["kind"][]).map((k) => {
                const active = kindFilter === k;
                return (
                  <Pressable
                    key={k}
                    onPress={() => setKindFilter(k)}
                    style={[
                      styles.skuKindTab,
                      {
                        backgroundColor: active ? colors.primary : isDark ? colors.surfaceAlt : "#FFFFFF",
                        borderColor: active ? colors.primary : isDark ? colors.border : "#CBD5E1",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        color: active ? "#FFFFFF" : isDark ? colors.textSecondary : colors.textPrimary,
                        fontSize: 13,
                        fontWeight: "600",
                      }}
                    >
                      {SKU_KIND_LABELS[k]} {grouped[k].length}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View
              style={[
                styles.tableContainerCard,
                { backgroundColor: colors.surface, borderColor: isDark ? colors.border : "#E2E8F0" },
              ]}
            >
              <Text style={[styles.tableTitle, { color: colors.textPrimary }]}>SKU / Ürün Kataloğu</Text>
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState label="Ürün bulunamadı" />}
        renderItem={({ item, index }) => (
          <View
            style={[
              styles.skuCard,
              {
                backgroundColor: index % 2 === 1 ? (isDark ? colors.bg : "#FAFAFC") : colors.surface,
                borderColor: isDark ? colors.border : "#E2E8F0",
              },
            ]}
          >
            <View style={styles.rowBetween}>
              <View style={{ flex: 1, paddingRight: 8 }}>
                <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.name}
                </Text>
                <Text style={[styles.skuCodeText, { color: colors.textMuted }]} numberOfLines={1}>
                  {item.sku_code}
                  {item.package_label ? ` · ${item.package_label}` : ""}
                </Text>
              </View>
              {/* Web ile Birebir SVG Düzenle ve Sil Butonları */}
              <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
                <TouchableOpacity onPress={() => openEdit(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <EditIcon color={isDark ? colors.textSecondary : "#94A3B8"} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => handleDelete(item)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <TrashIcon color="#EF4444" />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.skuMetaGrid}>
              <View style={styles.skuMetaCell}>
                <Text style={[styles.skuMetaLabel, { color: colors.textMuted }]}>BARKOD</Text>
                <Text style={[styles.skuMetaValue, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.barcode || "—"}
                </Text>
              </View>
              <View style={styles.skuMetaCell}>
                <Text style={[styles.skuMetaLabel, { color: colors.textMuted }]}>ALIŞ (KDV DAHİL)</Text>
                <Text style={[styles.skuMetaValue, { color: colors.textPrimary }]}>
                  {item.unit_cost != null ? `${item.unit_cost} ₺/${item.unit_short}` : "—"}
                </Text>
              </View>
              <View style={styles.skuMetaCell}>
                <Text style={[styles.skuMetaLabel, { color: colors.textMuted }]}>KDV</Text>
                <Text style={[styles.skuMetaValue, { color: colors.textPrimary }]}>
                  {item.vat_rate != null ? `%${item.vat_rate}` : "—"}
                </Text>
              </View>
              <View style={styles.skuMetaCell}>
                <Text style={[styles.skuMetaLabel, { color: colors.textMuted }]}>SATIŞ (KDV DAHİL)</Text>
                <Text style={[styles.skuMetaValue, { color: colors.primary }]}>
                  {item.sale_price != null ? `${item.sale_price} ₺` : "—"}
                </Text>
              </View>
            </View>

            {item.kind === "composite" && (
              <View style={styles.recipeBadgeRow}>
                <Text style={[styles.recipeBadgeText, { color: colors.primary }]}>
                  {item.recipe_summary
                    ? `${item.recipe_summary.component_count} bileşen`
                    : "Reçete verisi yok"}
                </Text>
                {item.recipe_summary?.margin_percent != null && (
                  <Text style={[styles.recipeBadgeMargin, { color: "#16A34A" }]}>
                    {" · "}marj %{item.recipe_summary.margin_percent.toFixed(2)}
                  </Text>
                )}
              </View>
            )}
          </View>
        )}
      />

      <Modal visible={!!editTarget} transparent animationType="fade" onRequestClose={() => setEditTarget(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setEditTarget(null)}>
          <Pressable style={[styles.formSheet, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>SKU Düzenle</Text>

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Ürün Adı</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: isDark ? colors.border : "#CBD5E1",
                  color: colors.textPrimary,
                },
              ]}
              value={editName}
              onChangeText={setEditName}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Barkod</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: isDark ? colors.border : "#CBD5E1",
                  color: colors.textPrimary,
                },
              ]}
              value={editBarcode}
              onChangeText={setEditBarcode}
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Alış Fiyatı (KDV dahil)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: isDark ? colors.border : "#CBD5E1",
                  color: colors.textPrimary,
                },
              ]}
              value={editUnitCost}
              onChangeText={setEditUnitCost}
              keyboardType="decimal-pad"
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Satış Fiyatı (KDV dahil)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: isDark ? colors.border : "#CBD5E1",
                  color: colors.textPrimary,
                },
              ]}
              value={editSalePrice}
              onChangeText={setEditSalePrice}
              keyboardType="decimal-pad"
            />

            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>KDV (%)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: isDark ? colors.border : "#CBD5E1",
                  color: colors.textPrimary,
                },
              ]}
              value={editVatRate}
              onChangeText={setEditVatRate}
              keyboardType="decimal-pad"
            />

            <Pressable
              style={[styles.primaryBtnFull, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}
              onPress={handleSaveEdit}
              disabled={saving}
            >
              <Text style={styles.primaryBtnText}>{saving ? "Kaydediliyor..." : "Kaydet"}</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

/* ================= ORTAK: Lokasyon/SKU Seçici ================= */
function useLocationsAndSkus() {
  const locationsQuery = useQuery({
    queryKey: ["stock-locations-all"],
    queryFn: () => stockApi.locations.list({ active_only: true }),
  });
  const skusQuery = useQuery({
    queryKey: ["stock-skus-all"],
    queryFn: () => stockApi.skus.list({ active_only: true }),
  });
  return { locationsQuery, skusQuery };
}

function PickerField({
  label,
  value,
  placeholder,
  onPress,
}: {
  label: string;
  value: string | null;
  placeholder: string;
  onPress: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  return (
    <>
      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>{label}</Text>
      <Pressable
        style={[
          styles.input,
          {
            backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
            borderColor: isDark ? colors.border : "#CBD5E1",
          },
        ]}
        onPress={onPress}
      >
        <Text style={{ color: value ? colors.textPrimary : colors.textMuted }}>{value ?? placeholder}</Text>
      </Pressable>
    </>
  );
}

function SimplePickerModal({
  visible,
  onClose,
  options,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  options: { id: number | string; label: string }[];
  onSelect: (id: number | string) => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.modalSheet, { backgroundColor: colors.surface, maxHeight: "70%" }]}>
          <ScrollView>
            {options.map((opt) => (
              <Pressable
                key={opt.id}
                style={[styles.modalOption, { borderBottomColor: colors.border }]}
                onPress={() => {
                  onSelect(opt.id);
                  onClose();
                }}
              >
                <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>{opt.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      </Pressable>
    </Modal>
  );
}

interface StockMovementRaw {
  id: number;
  movement_type: string;
  sku: number;
  sku_name: string;
  sku_code?: string;
  from_location?: number;
  from_location_name?: string;
  to_location?: number;
  to_location_name?: string;
  location?: number;
  location_name?: string;
  quantity: number;
  reason?: string | null;
  datetime: string;
  created_at: string;
  created_by: number;
  created_by_username: string;
}

function extractMovements(raw: any): StockMovementRaw[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.results)) return raw.results;
  return [];
}

function formatDateTime(dt: string | null | undefined) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return dt;
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/* ================= TRANSFER ================= */
function TransferTab() {
  const { colors, isDark } = useAppTheme();
  const queryClient = useQueryClient();
  const { locationsQuery, skusQuery } = useLocationsAndSkus();

  const [fromId, setFromId] = useState<number | null>(null);
  const [toId, setToId] = useState<number | null>(null);
  const [skuId, setSkuId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState("");

  const [fromPickerOpen, setFromPickerOpen] = useState(false);
  const [toPickerOpen, setToPickerOpen] = useState(false);
  const [skuPickerOpen, setSkuPickerOpen] = useState(false);

  const historyQuery = useQuery({ queryKey: ["stock-transfers"], queryFn: () => stockApi.transfers.list() });

  const locations = locationsQuery.data ?? [];
  const skus = skusQuery.data ?? [];
  const movements = extractMovements(historyQuery.data);

  const fromName = locations.find((l) => l.id === fromId)?.name ?? null;
  const toName = locations.find((l) => l.id === toId)?.name ?? null;
  const skuName = skus.find((s) => s.id === skuId)?.name ?? null;

  const handleSubmit = async () => {
    if (!fromId || !toId || !skuId || !quantity.trim()) {
      Alert.alert("Hata", "Tüm alanları doldurun");
      return;
    }
    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty <= 0) {
      Alert.alert("Hata", "Geçerli bir miktar girin");
      return;
    }
    try {
      await stockApi.transfers.create({
        from_location_id: fromId,
        to_location_id: toId,
        sku_id: skuId,
        quantity: qty,
      });
      setQuantity("");
      queryClient.invalidateQueries({ queryKey: ["stock-transfers"] });
      queryClient.invalidateQueries({ queryKey: ["stock-overview"] });
      queryClient.invalidateQueries({ queryKey: ["stock-overview-breakdown"] });
      Alert.alert("Başarılı", "Transfer gerçekleştirildi");
    } catch (e) {
      Alert.alert("Hata", (e as Error).message);
    }
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ padding: spacing.md }}>
      <ScreenCard style={{ marginBottom: spacing.md }}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Transfer Et</Text>

        <PickerField label="Kaynak Lokasyon" value={fromName} placeholder="Seçiniz" onPress={() => setFromPickerOpen(true)} />
        <PickerField label="Hedef Lokasyon" value={toName} placeholder="Seçiniz" onPress={() => setToPickerOpen(true)} />
        <PickerField label="SKU" value={skuName} placeholder="Seçiniz" onPress={() => setSkuPickerOpen(true)} />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Miktar</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
              borderColor: isDark ? colors.border : "#CBD5E1",
              color: colors.textPrimary,
            },
          ]}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.textMuted}
        />

        <Pressable style={[styles.primaryBtnFull, { backgroundColor: colors.primary }]} onPress={handleSubmit}>
          <Text style={styles.primaryBtnText}>Transfer Et</Text>
        </Pressable>
      </ScreenCard>

      <View
        style={[
          styles.tableContainerCard,
          {
            backgroundColor: colors.surface,
            borderColor: isDark ? colors.border : "#E2E8F0",
          },
        ]}
      >
        <Text style={[styles.tableTitle, { color: colors.textPrimary }]}>Transfer Geçmişi</Text>

        {historyQuery.isLoading ? (
          <LoadingView label="Yükleniyor..." />
        ) : movements.length === 0 ? (
          <EmptyState label="Kayıt bulunamadı" />
        ) : (
          movements.map((m, i) => (
            <View
              key={m.id}
              style={[
                styles.movementItemRow,
                {
                  backgroundColor: i % 2 === 1 ? (isDark ? colors.bg : "#FAFAFC") : colors.surface,
                  borderTopColor: isDark ? colors.border : "#E2E8F0",
                },
              ]}
            >
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {m.sku_name}
                  </Text>
                  {m.sku_code ? (
                    <Text style={[styles.skuCodeText, { color: colors.textMuted }]}>{m.sku_code}</Text>
                  ) : null}
                </View>
                <View style={styles.qtyBadge}>
                  <Text style={styles.qtyBadgeText}>+{m.quantity}</Text>
                </View>
              </View>

              <View style={[styles.rowBetween, { marginTop: 6 }]}>
                <Text style={[styles.routePathText, { color: colors.textPrimary }]} numberOfLines={1}>
                  {m.from_location_name ?? "—"} <Text style={{ color: colors.primary }}>→</Text> {m.to_location_name ?? "—"}
                </Text>
              </View>

              <View style={[styles.rowBetween, { marginTop: 4 }]}>
                <Text style={[styles.mutedTextSmall, { color: colors.textMuted }]}>{formatDateTime(m.datetime)}</Text>
                <Text style={[styles.mutedTextSmall, { color: colors.textMuted }]}>
                  {m.created_by_username || "—"}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <SimplePickerModal
        visible={fromPickerOpen}
        onClose={() => setFromPickerOpen(false)}
        options={locations.map((l) => ({ id: l.id, label: l.name }))}
        onSelect={(id) => setFromId(Number(id))}
      />
      <SimplePickerModal
        visible={toPickerOpen}
        onClose={() => setToPickerOpen(false)}
        options={locations.map((l) => ({ id: l.id, label: l.name }))}
        onSelect={(id) => setToId(Number(id))}
      />
      <SimplePickerModal
        visible={skuPickerOpen}
        onClose={() => setSkuPickerOpen(false)}
        options={skus.map((s) => ({ id: s.id, label: s.name }))}
        onSelect={(id) => setSkuId(Number(id))}
      />
    </ScrollView>
  );
}

/* ================= STOK GİRİŞİ ================= */
function ReceiptTab() {
  const { colors, isDark } = useAppTheme();
  const queryClient = useQueryClient();
  const { locationsQuery, skusQuery } = useLocationsAndSkus();

  const [toId, setToId] = useState<number | null>(null);
  const [skuId, setSkuId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState("");
  const [toPickerOpen, setToPickerOpen] = useState(false);
  const [skuPickerOpen, setSkuPickerOpen] = useState(false);

  const historyQuery = useQuery({ queryKey: ["stock-receipts"], queryFn: () => stockApi.receipts.list() });

  const locations = locationsQuery.data ?? [];
  const skus = skusQuery.data ?? [];
  const movements = extractMovements(historyQuery.data);

  const toName = locations.find((l) => l.id === toId)?.name ?? null;
  const skuName = skus.find((s) => s.id === skuId)?.name ?? null;

  const handleSubmit = async () => {
    if (!toId || !skuId || !quantity.trim()) {
      Alert.alert("Hata", "Tüm alanları doldurun");
      return;
    }
    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty <= 0) {
      Alert.alert("Hata", "Geçerli bir miktar girin");
      return;
    }
    try {
      await stockApi.receipts.create({ to_location_id: toId, sku_id: skuId, quantity: qty });
      setQuantity("");
      queryClient.invalidateQueries({ queryKey: ["stock-receipts"] });
      queryClient.invalidateQueries({ queryKey: ["stock-overview"] });
      queryClient.invalidateQueries({ queryKey: ["stock-overview-breakdown"] });
      Alert.alert("Başarılı", "Stok girişi yapıldı");
    } catch (e) {
      Alert.alert("Hata", (e as Error).message);
    }
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ padding: spacing.md }}>
      <ScreenCard style={{ marginBottom: spacing.md }}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Stok Girişi</Text>

        <PickerField label="Hedef Lokasyon" value={toName} placeholder="Seçiniz" onPress={() => setToPickerOpen(true)} />
        <PickerField label="SKU" value={skuName} placeholder="Seçiniz" onPress={() => setSkuPickerOpen(true)} />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Miktar</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
              borderColor: isDark ? colors.border : "#CBD5E1",
              color: colors.textPrimary,
            },
          ]}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numeric"
          placeholder="0"
          placeholderTextColor={colors.textMuted}
        />

        <Pressable style={[styles.primaryBtnFull, { backgroundColor: colors.primary }]} onPress={handleSubmit}>
          <Text style={styles.primaryBtnText}>Stok Girişi Yap</Text>
        </Pressable>
      </ScreenCard>

      <View
        style={[
          styles.tableContainerCard,
          {
            backgroundColor: colors.surface,
            borderColor: isDark ? colors.border : "#E2E8F0",
          },
        ]}
      >
        <Text style={[styles.tableTitle, { color: colors.textPrimary }]}>Stok Girişi Geçmişi</Text>

        {historyQuery.isLoading ? (
          <LoadingView label="Yükleniyor..." />
        ) : movements.length === 0 ? (
          <EmptyState label="Kayıt bulunamadı" />
        ) : (
          movements.map((m, i) => (
            <View
              key={m.id}
              style={[
                styles.movementItemRow,
                {
                  backgroundColor: i % 2 === 1 ? (isDark ? colors.bg : "#FAFAFC") : colors.surface,
                  borderTopColor: isDark ? colors.border : "#E2E8F0",
                },
              ]}
            >
              <View style={styles.rowBetween}>
                <View style={{ flex: 1, paddingRight: 8 }}>
                  <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {m.sku_name}
                  </Text>
                  {m.sku_code ? (
                    <Text style={[styles.skuCodeText, { color: colors.textMuted }]}>{m.sku_code}</Text>
                  ) : null}
                </View>
                <View style={styles.qtyBadge}>
                  <Text style={styles.qtyBadgeText}>+{m.quantity}</Text>
                </View>
              </View>

              <View style={[styles.rowBetween, { marginTop: 6 }]}>
                <Text style={[styles.routePathText, { color: colors.textPrimary }]}>
                  Hedef: {m.to_location_name ?? m.location_name ?? "—"}
                </Text>
              </View>

              <View style={[styles.rowBetween, { marginTop: 4 }]}>
                <Text style={[styles.mutedTextSmall, { color: colors.textMuted }]}>{formatDateTime(m.datetime)}</Text>
                <Text style={[styles.mutedTextSmall, { color: colors.textMuted }]}>
                  {m.created_by_username || "—"}
                </Text>
              </View>
            </View>
          ))
        )}
      </View>

      <SimplePickerModal
        visible={toPickerOpen}
        onClose={() => setToPickerOpen(false)}
        options={locations.map((l) => ({ id: l.id, label: l.name }))}
        onSelect={(id) => setToId(Number(id))}
      />
      <SimplePickerModal
        visible={skuPickerOpen}
        onClose={() => setSkuPickerOpen(false)}
        options={skus.map((s) => ({ id: s.id, label: s.name }))}
        onSelect={(id) => setSkuId(Number(id))}
      />
    </ScrollView>
  );
}

/* ================= DÜZELTME ================= */
function AdjustmentTab() {
  const { colors, isDark } = useAppTheme();
  const queryClient = useQueryClient();
  const { locationsQuery, skusQuery } = useLocationsAndSkus();

  const [locationId, setLocationId] = useState<number | null>(null);
  const [skuId, setSkuId] = useState<number | null>(null);
  const [quantity, setQuantity] = useState("");
  const [reason, setReason] = useState("");
  const [locationPickerOpen, setLocationPickerOpen] = useState(false);
  const [skuPickerOpen, setSkuPickerOpen] = useState(false);

  const historyQuery = useQuery({ queryKey: ["stock-adjustments"], queryFn: () => stockApi.adjustments.list() });

  const locations = locationsQuery.data ?? [];
  const skus = skusQuery.data ?? [];
  const movements = extractMovements(historyQuery.data);

  const locationNameSelected = locations.find((l) => l.id === locationId)?.name ?? null;
  const skuName = skus.find((s) => s.id === skuId)?.name ?? null;

  const handleSubmit = async () => {
    if (!locationId || !skuId || !quantity.trim()) {
      Alert.alert("Hata", "Lokasyon, SKU ve miktar gerekli");
      return;
    }
    const qty = Number(quantity);
    if (Number.isNaN(qty) || qty === 0) {
      Alert.alert("Hata", "Geçerli bir miktar girin (pozitif ekler, negatif çıkarır)");
      return;
    }
    try {
      await stockApi.adjustments.create({ location_id: locationId, sku_id: skuId, quantity: qty, reason });
      setQuantity("");
      setReason("");
      queryClient.invalidateQueries({ queryKey: ["stock-adjustments"] });
      queryClient.invalidateQueries({ queryKey: ["stock-overview"] });
      queryClient.invalidateQueries({ queryKey: ["stock-overview-breakdown"] });
      Alert.alert("Başarılı", "Düzeltme kaydedildi");
    } catch (e) {
      Alert.alert("Hata", (e as Error).message);
    }
  };

  return (
    <ScrollView style={styles.flex} contentContainerStyle={{ padding: spacing.md }}>
      <ScreenCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Stok Düzeltme</Text>
        <Text style={[styles.mutedText, { color: colors.textMuted }]}>Pozitif değer ekler, negatif değer çıkarır.</Text>

        <PickerField
          label="Lokasyon"
          value={locationNameSelected}
          placeholder="Seçiniz"
          onPress={() => setLocationPickerOpen(true)}
        />
        <PickerField label="SKU" value={skuName} placeholder="Seçiniz" onPress={() => setSkuPickerOpen(true)} />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Miktar (+ ekleme / − çıkarma)</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
              borderColor: isDark ? colors.border : "#CBD5E1",
              color: colors.textPrimary,
            },
          ]}
          value={quantity}
          onChangeText={setQuantity}
          keyboardType="numbers-and-punctuation"
          placeholder="örn. 5 veya -3"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Sebep</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
              borderColor: isDark ? colors.border : "#CBD5E1",
              color: colors.textPrimary,
            },
          ]}
          value={reason}
          onChangeText={setReason}
          placeholder="Düzeltme sebebi"
          placeholderTextColor={colors.textMuted}
        />

        <Pressable style={[styles.primaryBtnFull, { backgroundColor: colors.warning }]} onPress={handleSubmit}>
          <Text style={styles.primaryBtnText}>Düzeltme Yap</Text>
        </Pressable>
      </ScreenCard>

      <View
        style={[
          styles.tableContainerCard,
          {
            marginTop: spacing.md,
            backgroundColor: colors.surface,
            borderColor: isDark ? colors.border : "#E2E8F0",
          },
        ]}
      >
        <Text style={[styles.tableTitle, { color: colors.textPrimary }]}>Düzeltme Geçmişi</Text>
        {historyQuery.isLoading ? (
          <LoadingView label="Yükleniyor..." />
        ) : movements.length === 0 ? (
          <EmptyState label="Kayıt bulunamadı" />
        ) : (
          movements.map((m, i) => {
            const qty = m.quantity;
            return (
              <View
                key={m.id}
                style={[
                  styles.movementItemRow,
                  {
                    backgroundColor: i % 2 === 1 ? (isDark ? colors.bg : "#FAFAFC") : colors.surface,
                    borderTopColor: isDark ? colors.border : "#E2E8F0",
                  },
                ]}
              >
                <View style={styles.rowBetween}>
                  <Text style={[styles.rowTitle, { color: colors.textPrimary }]} numberOfLines={1}>
                    {m.sku_name}
                  </Text>
                  <Text style={[styles.totalValue, { color: qty < 0 ? colors.danger : "#16A34A" }]}>
                    {qty > 0 ? `+${qty}` : qty}
                  </Text>
                </View>
                <Text style={[styles.mutedText, { color: colors.textMuted }]}>
                  {m.location_name ?? m.to_location_name ?? "—"}
                  {m.reason ? ` · ${m.reason}` : ""}
                </Text>
                <View style={styles.rowBetween}>
                  <Text style={[styles.mutedTextSmall, { color: colors.textMuted }]}>{formatDateTime(m.datetime)}</Text>
                  <Text style={[styles.mutedTextSmall, { color: colors.textMuted }]}>{m.created_by_username}</Text>
                </View>
              </View>
            );
          })
        )}
      </View>

      <SimplePickerModal
        visible={locationPickerOpen}
        onClose={() => setLocationPickerOpen(false)}
        options={locations.map((l) => ({ id: l.id, label: l.name }))}
        onSelect={(id) => setLocationId(Number(id))}
      />
      <SimplePickerModal
        visible={skuPickerOpen}
        onClose={() => setSkuPickerOpen(false)}
        options={skus.map((s) => ({ id: s.id, label: s.name }))}
        onSelect={(id) => setSkuId(Number(id))}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },

  tabsScroll: { flexGrow: 0, borderBottomWidth: 1 },
  tabsContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  tabText: { fontWeight: "600", fontSize: 13 },
  tabTextActive: { color: "#fff" },

  actionBar: { flexDirection: "row", gap: spacing.sm, padding: spacing.md, paddingBottom: 0 },
  secondaryBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  secondaryBtnText: { fontSize: 12, fontWeight: "600" },
  primaryBtn: {
    flex: 1,
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
  },
  primaryBtnFull: {
    alignItems: "center",
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    marginTop: spacing.md,
  },
  primaryBtnText: { color: "#fff", fontSize: 13, fontWeight: "700" },

  /* Tablo ve Kart Düzeni */
  tableContainerCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    overflow: "hidden",
  },
  tableTitle: { fontWeight: "700", fontSize: 15, padding: spacing.md, paddingBottom: spacing.sm },
  tableHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderTopWidth: 1,
  },
  tableHeaderText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },

  rowCard: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderTopWidth: 0,
  },
  rowTitle: { fontSize: 13, fontWeight: "600" },
  skuCodeText: { fontSize: 11, marginTop: 2, fontFamily: "monospace" },
  totalValue: { fontSize: 13, fontWeight: "700" },
  unitText: { fontSize: 11, fontWeight: "400" },
  packageValue: { fontSize: 12, fontWeight: "500" },

  chevron: { fontSize: 15, fontWeight: "700" },

  breakdownContainer: {
    borderWidth: 1,
    borderTopWidth: 0,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    gap: 2,
  },
  breakdownHeader: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.3,
    marginBottom: spacing.xs,
    textTransform: "uppercase",
  },
  breakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 5,
    paddingLeft: spacing.md,
  },
  breakdownLocationText: { fontSize: 13, flex: 1, paddingRight: spacing.sm },
  breakdownQtyText: { fontSize: 13, fontWeight: "600" },
  breakdownTotalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.xs,
    marginTop: 4,
    paddingLeft: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  breakdownTotalLabel: { fontSize: 13, fontWeight: "700" },
  breakdownTotalValue: { fontSize: 13, fontWeight: "700" },

  deleteLink: { fontSize: 13, fontWeight: "600" },
  mutedText: { fontSize: 12 },
  mutedTextSmall: { fontSize: 11 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },

  typePill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  typePillText: {
    fontSize: 10,
    fontWeight: "600",
  },

  /* SKU / Ürünler sekmesi */
  skuKindTabsRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.sm },
  skuKindTab: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 999, borderWidth: 1 },

  skuCard: { borderRadius: radius.md, borderWidth: 1, padding: spacing.md, marginBottom: spacing.sm },
  skuMetaGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.sm, gap: spacing.md },
  skuMetaCell: { minWidth: "45%" },
  skuMetaLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4, marginBottom: 2 },
  skuMetaValue: { fontSize: 13, fontWeight: "600" },

  recipeBadgeRow: { flexDirection: "row", marginTop: spacing.sm },
  recipeBadgeText: { fontSize: 12, fontWeight: "600" },
  recipeBadgeMargin: { fontSize: 12, fontWeight: "600" },

  /* Transfer & Giriş Geçmiş Kartları */
  movementItemRow: {
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderTopWidth: 1,
  },
  qtyBadge: {
    backgroundColor: "#DCFCE7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  qtyBadgeText: {
    color: "#16A34A",
    fontSize: 12,
    fontWeight: "700",
  },
  routePathText: {
    fontSize: 12,
    fontWeight: "500",
  },

  search: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    marginBottom: spacing.sm,
    fontSize: 13,
  },

  cardTitle: { fontWeight: "700", fontSize: 15, marginBottom: spacing.sm },
  fieldLabel: { fontSize: 12, marginTop: spacing.sm, marginBottom: 4 },
  input: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
  },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: "60%",
  },
  formSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
  },
  modalTitle: { fontSize: 15, fontWeight: "700", marginBottom: spacing.sm },
  modalOption: { paddingVertical: spacing.sm, borderBottomWidth: 1 },
  modalOptionText: { fontSize: 14 },
});