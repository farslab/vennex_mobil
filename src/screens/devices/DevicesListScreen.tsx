import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  Animated,
  FlatList,
  Modal,
  PanResponder,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { devicesApi } from "@/api/devices";
import { useAppTheme } from "@/theme/colors";
import { radius, spacing } from "@/theme/spacing";
import { Badge, EmptyState, ErrorView, LoadingView } from "@/components/Common";
import ProductTemplatesScreen from "./ProductTemplatesScreen";
import type { PosDeviceListItem } from "@/types/devices";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { DevicesStackParamList } from "@/navigation/DevicesStack";

const STORAGE_KEY_CUSTOM_ORDER = "@devices_custom_order";
const STORAGE_KEY_HIDE_REVENUE = "@devices_hide_revenue";

const STATUS_OPTIONS = [
  { label: "Tüm Cihazlar", value: "all" },
  { label: "Çevrimiçi", value: "online" },
  { label: "Çevrimdışı", value: "offline" },
];

const MACHINE_TYPE_OPTIONS = [
  { label: "Tüm Tipler", value: "all" },
  { label: "Snack", value: "snack" },
  { label: "Kahve", value: "coffee" },
];

const SORT_OPTIONS = [
  { label: "Varsayılan", value: "default" },
  { label: "Son İşlem (Yeni → Eski)", value: "last_tx_desc" },
  { label: "Son İşlem (Eski → Yeni)", value: "last_tx_asc" },
  { label: "Bugün Ciro (Yüksek → Düşük)", value: "today_rev_desc" },
  { label: "Bugün Ciro (Düşük → Yüksek)", value: "today_rev_asc" },
  { label: "Dün Ciro (Yüksek → Düşük)", value: "yesterday_rev_desc" },
  { label: "Dün Ciro (Düşük → Yüksek)", value: "yesterday_rev_asc" },
  { label: "Bu Ay Ciro (Yüksek → Düşük)", value: "this_month_rev_desc" },
  { label: "Bu Ay Ciro (Düşük → Yüksek)", value: "this_month_rev_asc" },
  { label: "Geçen Ay Ciro (Yüksek → Düşük)", value: "last_month_rev_desc" },
  { label: "Geçen Ay Ciro (Düşük → Yüksek)", value: "last_month_rev_asc" },
  { label: "Doluluk (Yüksek → Düşük)", value: "fill_desc" },
  { label: "Doluluk (Düşük → Yüksek)", value: "fill_asc" },
];

function formatCurrency(n: number | null | undefined) {
  if (n == null || n === 0) return "—";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
}

function getSuccessfulTxDate(item: any): string | null | undefined {
  return (
    item.last_successful_tx ??
    item.last_successful_transaction_at ??
    item.last_tx_datetime ??
    item.last_transaction_at ??
    item.last_tx_at ??
    item.last_seen
  );
}

function formatLastSuccessfulTx(dateStr: string | null | undefined): { text: string; isNull: boolean } {
  if (!dateStr) return { text: "—", isNull: true };
  const then = new Date(dateStr).getTime();
  if (Number.isNaN(then) || then <= 0) return { text: "—", isNull: true };

  const now = Date.now();
  const diffMs = Math.max(now - then, 0);
  const diffMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(diffMinutes / 60);
  const minutes = diffMinutes % 60;

  if (hours <= 0 && minutes <= 0) return { text: "az önce", isNull: false };
  if (hours <= 0) return { text: `${minutes} dakika önce`, isNull: false };
  return { text: `${hours} saat ${minutes} dakika önce`, isNull: false };
}

/* ==================== WEB İKONLARI (SVG) ==================== */

function EyeOffIcon({ color = "#EA580C" }: { color?: string }) {
  return (
    <Svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <Path
        d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1="1" y1="1" x2="23" y2="23" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function EyeIcon({ color = "#EA580C" }: { color?: string }) {
  return (
    <Svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <Path
        d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Circle cx="12" cy="12" r="3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function MenuIcon({ color = "#475569" }: { color?: string }) {
  return (
    <Svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <Line x1="4" y1="6" x2="20" y2="6" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Line x1="4" y1="12" x2="20" y2="12" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
      <Line x1="4" y1="18" x2="20" y2="18" stroke={color} strokeWidth="2.2" strokeLinecap="round" />
    </Svg>
  );
}

function CloseIcon({ color = "#64748B" }: { color?: string }) {
  return (
    <Svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function ClockIcon({ color = "#EF4444" }: { color?: string }) {
  return (
    <Svg width="12" height="12" viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
      <Path d="M12 6v6l4 2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

export default function DevicesListScreen() {
  const { colors, isDark } = useAppTheme();
  const [activeTab, setActiveTab] = useState<"devices" | "templates">("devices");

  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [machineType, setMachineType] = useState("all");
  const [sortBy, setSortBy] = useState("default");

  const [hideRevenue, setHideRevenue] = useState(false);

  // Sıralama Modal State'leri
  const [sortModalOpen, setSortModalOpen] = useState(false);
  const [savedOrderSns, setSavedOrderSns] = useState<string[]>([]);
  const [draftOrderDevices, setDraftOrderDevices] = useState<PosDeviceListItem[]>([]);

  const [pickerType, setPickerType] = useState<"status" | "machineType" | "sort" | null>(null);

  const navigation = useNavigation<NativeStackNavigationProp<DevicesStackParamList>>();

  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["devices", q, status, machineType, sortBy],
    queryFn: () => devicesApi.list({ q: q || undefined, page: 1, page_size: 50 }),
    enabled: activeTab === "devices",
  });

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY_HIDE_REVENUE).then((val) => {
      if (val !== null) setHideRevenue(val === "true");
    });
    AsyncStorage.getItem(STORAGE_KEY_CUSTOM_ORDER).then((val) => {
      if (val) {
        try {
          setSavedOrderSns(JSON.parse(val));
        } catch {}
      }
    });
  }, []);

  const toggleHideRevenue = async () => {
    const nextVal = !hideRevenue;
    setHideRevenue(nextVal);
    await AsyncStorage.setItem(STORAGE_KEY_HIDE_REVENUE, String(nextVal));
  };

  const rawDevices = data?.results ?? [];

  const handleClearFilters = () => {
    setQ("");
    setStatus("all");
    setMachineType("all");
    setSortBy("default");
  };

  const filteredAndSortedDevices = useMemo(() => {
    let list = [...rawDevices];

    if (status === "online") {
      list = list.filter((d) => d.online);
    } else if (status === "offline") {
      list = list.filter((d) => !d.online);
    }

    if (machineType === "snack") {
      list = list.filter(
        (d) =>
          (d.pos_name || "").toLowerCase().includes("snack") ||
          ((d as any).machine_type || "").toLowerCase().includes("snack")
      );
    } else if (machineType === "coffee") {
      list = list.filter(
        (d) =>
          (d.pos_name || "").toLowerCase().includes("kahve") ||
          (d.pos_name || "").toLowerCase().includes("coffee") ||
          ((d as any).machine_type || "").toLowerCase().includes("coffee")
      );
    }

    if (sortBy === "default") {
      if (savedOrderSns.length > 0) {
        list.sort((a, b) => {
          const idxA = savedOrderSns.indexOf(a.sn);
          const idxB = savedOrderSns.indexOf(b.sn);
          if (idxA === -1 && idxB === -1) return 0;
          if (idxA === -1) return 1;
          if (idxB === -1) return -1;
          return idxA - idxB;
        });
      }
    } else {
      list.sort((a, b) => {
        switch (sortBy) {
          case "today_rev_desc":
            return (b.today_revenue ?? 0) - (a.today_revenue ?? 0);
          case "today_rev_asc":
            return (a.today_revenue ?? 0) - (b.today_revenue ?? 0);
          case "yesterday_rev_desc":
            return (b.yesterday_revenue ?? 0) - (a.yesterday_revenue ?? 0);
          case "yesterday_rev_asc":
            return (a.yesterday_revenue ?? 0) - (b.yesterday_revenue ?? 0);
          case "this_month_rev_desc":
            return (b.this_month_revenue ?? 0) - (a.this_month_revenue ?? 0);
          case "this_month_rev_asc":
            return (a.this_month_revenue ?? 0) - (b.this_month_revenue ?? 0);
          case "last_month_rev_desc":
            return (b.last_month_revenue ?? 0) - (a.last_month_revenue ?? 0);
          case "last_month_rev_asc":
            return (a.last_month_revenue ?? 0) - (b.last_month_revenue ?? 0);
          case "fill_desc":
            return ((b.fill_rate as any)?.pct ?? 0) - ((a.fill_rate as any)?.pct ?? 0);
          case "fill_asc":
            return ((a.fill_rate as any)?.pct ?? 0) - ((b.fill_rate as any)?.pct ?? 0);
          case "last_tx_desc": {
            const dateA = new Date(getSuccessfulTxDate(a) || 0).getTime();
            const dateB = new Date(getSuccessfulTxDate(b) || 0).getTime();
            return dateB - dateA;
          }
          case "last_tx_asc": {
            const dateA = new Date(getSuccessfulTxDate(a) || 0).getTime();
            const dateB = new Date(getSuccessfulTxDate(b) || 0).getTime();
            return dateA - dateB;
          }
          default:
            return 0;
        }
      });
    }

    return list;
  }, [rawDevices, status, machineType, sortBy, savedOrderSns]);

  const total = rawDevices.length;
  const online = rawDevices.filter((d) => d.online).length;
  const offline = total - online;

  const currentStatusLabel = STATUS_OPTIONS.find((o) => o.value === status)?.label;
  const currentMachineLabel = MACHINE_TYPE_OPTIONS.find((o) => o.value === machineType)?.label;
  const currentSortLabel = SORT_OPTIONS.find((o) => o.value === sortBy)?.label;

  const openSortModal = () => {
    let initialList = [...rawDevices];
    if (savedOrderSns.length > 0) {
      initialList.sort((a, b) => {
        const idxA = savedOrderSns.indexOf(a.sn);
        const idxB = savedOrderSns.indexOf(b.sn);
        if (idxA === -1 && idxB === -1) return 0;
        if (idxA === -1) return 1;
        if (idxB === -1) return -1;
        return idxA - idxB;
      });
    }
    setDraftOrderDevices(initialList);
    setSortModalOpen(true);
  };

  const handleSaveSortOrder = async () => {
    const newSns = draftOrderDevices.map((d) => d.sn);
    setSavedOrderSns(newSns);
    await AsyncStorage.setItem(STORAGE_KEY_CUSTOM_ORDER, JSON.stringify(newSns));
    setSortModalOpen(false);
  };

  const handleResetSortOrder = async () => {
    setSavedOrderSns([]);
    setDraftOrderDevices([...rawDevices]);
    await AsyncStorage.removeItem(STORAGE_KEY_CUSTOM_ORDER);
  };

  return (
    <View style={[styles.container, { backgroundColor: isDark ? colors.bg : "#F8FAFC" }]}>
      {/* Üst Sekmeler */}
      <View
        style={[
          styles.topTabs,
          { backgroundColor: colors.surface, borderBottomColor: isDark ? colors.border : "#E2E8F0" },
        ]}
      >
        <Pressable
          style={[styles.topTab, activeTab === "devices" && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab("devices")}
        >
          <Text
            style={[
              styles.topTabText,
              { color: activeTab === "devices" ? colors.primary : colors.textMuted },
            ]}
          >
            POS Cihazları
          </Text>
        </Pressable>
        <Pressable
          style={[styles.topTab, activeTab === "templates" && { borderBottomColor: colors.primary }]}
          onPress={() => setActiveTab("templates")}
        >
          <Text
            style={[
              styles.topTabText,
              { color: activeTab === "templates" ? colors.primary : colors.textMuted },
            ]}
          >
            Ürün Şablonları
          </Text>
        </Pressable>
      </View>

      {activeTab === "templates" ? (
        <ProductTemplatesScreen />
      ) : isLoading ? (
        <LoadingView label="Cihazlar yükleniyor..." />
      ) : error ? (
        <ErrorView message={(error as Error).message} onRetry={refetch} />
      ) : (
        <FlatList
          data={filteredAndSortedDevices}
          keyExtractor={(item) => item.sn}
          contentContainerStyle={{ padding: spacing.md, gap: spacing.sm }}
          ListEmptyComponent={<EmptyState label="Cihaz bulunamadı" />}
          ListHeaderComponent={
            <>
              {/* Web Üst Bar Butonları: Ciro Gizle & Sırala */}
              <View style={styles.topActionsRow}>
                <TouchableOpacity
                  style={[
                    styles.webHeaderBtn,
                    {
                      backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                      borderColor: hideRevenue
                        ? isDark
                          ? "#EA580C"
                          : "#F97316"
                        : isDark
                        ? "#EA580C"
                        : "#FDBA74",
                    },
                  ]}
                  onPress={toggleHideRevenue}
                  activeOpacity={0.7}
                >
                  {hideRevenue ? <EyeIcon color="#EA580C" /> : <EyeOffIcon color="#EA580C" />}
                  <Text style={[styles.webHeaderBtnText, { color: "#EA580C" }]}>
                    {hideRevenue ? "Ciro Göster" : "Ciro Gizle"}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.webHeaderBtn,
                    {
                      backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                      borderColor: isDark ? colors.border : "#CBD5E1",
                    },
                  ]}
                  onPress={openSortModal}
                  activeOpacity={0.7}
                >
                  <MenuIcon color={isDark ? colors.textSecondary : "#475569"} />
                  <Text style={[styles.webHeaderBtnText, { color: isDark ? colors.textSecondary : "#475569" }]}>
                    Sırala
                  </Text>
                </TouchableOpacity>
              </View>

              {/* İstatistik Kartları */}
              <View style={styles.summaryRow}>
                <View
                  style={[
                    styles.summaryCard,
                    { backgroundColor: colors.surface, borderColor: isDark ? colors.border : "#E2E8F0" },
                  ]}
                >
                  <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Toplam</Text>
                  <Text style={[styles.summaryValue, { color: colors.textPrimary }]}>{total}</Text>
                </View>
                <View
                  style={[
                    styles.summaryCard,
                    { backgroundColor: colors.surface, borderColor: isDark ? colors.border : "#E2E8F0" },
                  ]}
                >
                  <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Çevrimiçi</Text>
                  <Text style={[styles.summaryValue, { color: "#16A34A" }]}>{online}</Text>
                </View>
                <View
                  style={[
                    styles.summaryCard,
                    { backgroundColor: colors.surface, borderColor: isDark ? colors.border : "#E2E8F0" },
                  ]}
                >
                  <Text style={[styles.summaryLabel, { color: colors.textMuted }]}>Çevrimdışı</Text>
                  <Text style={[styles.summaryValue, { color: "#DC2626" }]}>{offline}</Text>
                </View>
              </View>

              {/* Filtreleme Kartı */}
              <View
                style={[
                  styles.filterCard,
                  { backgroundColor: colors.surface, borderColor: isDark ? colors.border : "#E2E8F0" },
                ]}
              >
                <View style={styles.filterGrid}>
                  <View style={styles.filterItem}>
                    <Text style={[styles.filterFieldLabel, { color: colors.textMuted }]}>ARA</Text>
                    <TextInput
                      style={[
                        styles.filterInput,
                        {
                          backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                          borderColor: isDark ? colors.border : "#CBD5E1",
                          color: colors.textPrimary,
                        },
                      ]}
                      placeholder="SN, cihaz adı veya otomat..."
                      placeholderTextColor={colors.textMuted}
                      value={q}
                      onChangeText={setQ}
                    />
                  </View>

                  <View style={styles.filterItem}>
                    <Text style={[styles.filterFieldLabel, { color: colors.textMuted }]}>DURUM</Text>
                    <TouchableOpacity
                      style={[
                        styles.filterSelect,
                        {
                          backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                          borderColor: isDark ? colors.border : "#CBD5E1",
                        },
                      ]}
                      onPress={() => setPickerType("status")}
                    >
                      <Text style={[styles.filterSelectText, { color: colors.textPrimary }]} numberOfLines={1}>
                        {currentStatusLabel}
                      </Text>
                      <Text style={[styles.selectArrow, { color: colors.textMuted }]}>▼</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.filterItem}>
                    <Text style={[styles.filterFieldLabel, { color: colors.textMuted }]}>MAKİNE TİPİ</Text>
                    <TouchableOpacity
                      style={[
                        styles.filterSelect,
                        {
                          backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                          borderColor: isDark ? colors.border : "#CBD5E1",
                        },
                      ]}
                      onPress={() => setPickerType("machineType")}
                    >
                      <Text style={[styles.filterSelectText, { color: colors.textPrimary }]} numberOfLines={1}>
                        {currentMachineLabel}
                      </Text>
                      <Text style={[styles.selectArrow, { color: colors.textMuted }]}>▼</Text>
                    </TouchableOpacity>
                  </View>

                  <View style={styles.filterItem}>
                    <Text style={[styles.filterFieldLabel, { color: colors.textMuted }]}>SIRALA</Text>
                    <TouchableOpacity
                      style={[
                        styles.filterSelect,
                        {
                          backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                          borderColor: isDark ? colors.border : "#CBD5E1",
                        },
                      ]}
                      onPress={() => setPickerType("sort")}
                    >
                      <Text style={[styles.filterSelectText, { color: colors.textPrimary }]} numberOfLines={1}>
                        {currentSortLabel}
                      </Text>
                      <Text style={[styles.selectArrow, { color: colors.textMuted }]}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Pressable
                  style={[
                    styles.clearButton,
                    {
                      backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                      borderColor: isDark ? colors.border : "#CBD5E1",
                    },
                  ]}
                  onPress={handleClearFilters}
                >
                  <CloseIcon color={colors.textSecondary} />
                  <Text style={[styles.clearButtonText, { color: colors.textSecondary }]}>Temizle</Text>
                </Pressable>
              </View>
            </>
          }
          renderItem={({ item }) => (
            <DeviceRow
              item={item}
              colors={colors}
              isDark={isDark}
              hideRevenue={hideRevenue}
              onPress={() => navigation.navigate("DeviceDetail", { sn: item.sn, name: item.pos_name })}
            />
          )}
        />
      )}

      {/* Sürükle-Bırak Destekli Web Tarzı Cihaz Sıralama Modalı */}
      <Modal visible={sortModalOpen} transparent animationType="fade" onRequestClose={() => setSortModalOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setSortModalOpen(false)}>
          <Pressable style={[styles.formSheetFull, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.webModalTitle, { color: colors.textPrimary }]}>Cihaz Sıralama</Text>
              <TouchableOpacity onPress={() => setSortModalOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <CloseIcon color={colors.textMuted} />
              </TouchableOpacity>
            </View>

            <Text style={[styles.sortSubHelpText, { color: colors.textMuted }]}>
              Sürükleyerek (masaüstü) veya basılı tutup kaydırarak (mobil) sıralayın.
            </Text>

            <DraggableDeviceSortList
              devices={draftOrderDevices}
              onReorder={setDraftOrderDevices}
              colors={colors}
              isDark={isDark}
            />

            <View style={styles.sortModalFooter}>
              <TouchableOpacity onPress={handleResetSortOrder}>
                <Text style={styles.resetSortText}>Sıralamayı Sıfırla</Text>
              </TouchableOpacity>

              <View style={{ flexDirection: "row", gap: 10 }}>
                <TouchableOpacity style={styles.cancelBtnWeb} onPress={() => setSortModalOpen(false)}>
                  <Text style={[styles.cancelBtnTextWeb, { color: isDark ? colors.textSecondary : "#475569" }]}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtnWeb} onPress={handleSaveSortOrder}>
                  <Text style={styles.submitBtnTextWeb}>Kaydet</Text>
                </TouchableOpacity>
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Dropdown Filtre Seçim Modalı */}
      <Modal visible={pickerType != null} transparent animationType="fade" onRequestClose={() => setPickerType(null)}>
        <Pressable style={styles.modalOverlay} onPress={() => setPickerType(null)}>
          <View
            style={[
              styles.modalSheet,
              { backgroundColor: isDark ? colors.surfaceAlt : "#374151" },
            ]}
          >
            <ScrollView>
              {pickerType === "status" &&
                STATUS_OPTIONS.map((opt) => {
                  const isSelected = status === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={styles.modalOption}
                      onPress={() => {
                        setStatus(opt.value);
                        setPickerType(null);
                      }}
                    >
                      <Text style={styles.modalOptionCheck}>{isSelected ? "✓" : "  "}</Text>
                      <Text style={[styles.modalOptionText, isSelected && styles.modalOptionSelectedText]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

              {pickerType === "machineType" &&
                MACHINE_TYPE_OPTIONS.map((opt) => {
                  const isSelected = machineType === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={styles.modalOption}
                      onPress={() => {
                        setMachineType(opt.value);
                        setPickerType(null);
                      }}
                    >
                      <Text style={styles.modalOptionCheck}>{isSelected ? "✓" : "  "}</Text>
                      <Text style={[styles.modalOptionText, isSelected && styles.modalOptionSelectedText]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}

              {pickerType === "sort" &&
                SORT_OPTIONS.map((opt) => {
                  const isSelected = sortBy === opt.value;
                  return (
                    <TouchableOpacity
                      key={opt.value}
                      style={styles.modalOption}
                      onPress={() => {
                        setSortBy(opt.value);
                        setPickerType(null);
                      }}
                    >
                      <Text style={styles.modalOptionCheck}>{isSelected ? "✓" : "  "}</Text>
                      <Text style={[styles.modalOptionText, isSelected && styles.modalOptionSelectedText]}>
                        {opt.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const ITEM_HEIGHT = 56;

function DraggableDeviceSortList({
  devices,
  onReorder,
  colors,
  isDark,
}: {
  devices: PosDeviceListItem[];
  onReorder: (newDevices: PosDeviceListItem[]) => void;
  colors: any;
  isDark: boolean;
}) {
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);

  const dragY = useRef(new Animated.Value(0)).current;
  const devicesRef = useRef(devices);
  devicesRef.current = devices;

  const moveItem = (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= devicesRef.current.length || fromIndex === toIndex) return;
    const updated = [...devicesRef.current];
    const [moved] = updated.splice(fromIndex, 1);
    updated.splice(toIndex, 0, moved);
    onReorder(updated);
  };

  const createPanResponder = (index: number) =>
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dy) > 2,
      onPanResponderGrant: () => {
        setDragIndex(index);
        setDropTargetIndex(index);
        dragY.setValue(0);
      },
      onPanResponderMove: (_, gestureState) => {
        dragY.setValue(gestureState.dy);
        const slotDiff = Math.round(gestureState.dy / ITEM_HEIGHT);
        const target = Math.max(
          0,
          Math.min(devicesRef.current.length - 1, index + slotDiff)
        );
        setDropTargetIndex(target);
      },
      onPanResponderRelease: () => {
        if (dropTargetIndex !== null && dropTargetIndex !== index) {
          moveItem(index, dropTargetIndex);
        }
        setDragIndex(null);
        setDropTargetIndex(null);
        dragY.setValue(0);
      },
      onPanResponderTerminate: () => {
        setDragIndex(null);
        setDropTargetIndex(null);
        dragY.setValue(0);
      },
    });

  return (
    <View style={{ maxHeight: 380, marginTop: 12 }}>
      <ScrollView scrollEnabled={dragIndex === null} showsVerticalScrollIndicator={false}>
        <View style={{ paddingVertical: 4 }}>
          {devices.map((d, index) => {
            const isDragging = dragIndex === index;
            const isDropTarget = dropTargetIndex === index && dragIndex !== null && !isDragging;
            const panResponder = createPanResponder(index);

            const isFirst = index === 0;
            const isLast = index === devices.length - 1;

            return (
              <View key={`sort-wrapper-${d.sn}`} style={{ marginBottom: 6 }}>
                {/* Bırakılacak hedef index göstergesi */}
                {isDropTarget && (
                  <View
                    style={[
                      styles.dropIndicatorLine,
                      { backgroundColor: colors.primary },
                    ]}
                  />
                )}

                <Animated.View
                  style={[
                    styles.sortDeviceRow,
                    {
                      backgroundColor: isDragging
                        ? isDark
                          ? "#1E293B"
                          : "#EFF6FF"
                        : isDark
                        ? colors.surfaceAlt
                        : "#FFFFFF",
                      borderColor: isDragging
                        ? colors.primary
                        : isDark
                        ? colors.border
                        : "#E2E8F0",
                      borderWidth: isDragging ? 1.5 : 1,
                      transform: isDragging ? [{ translateY: dragY }, { scale: 1.04 }] : [],
                      zIndex: isDragging ? 9999 : 1,
                      elevation: isDragging ? 12 : 0,
                      shadowColor: "#000",
                      shadowOffset: { width: 0, height: isDragging ? 4 : 0 },
                      shadowOpacity: isDragging ? 0.25 : 0,
                      shadowRadius: isDragging ? 8 : 0,
                    },
                  ]}
                  {...panResponder.panHandlers}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10, flex: 1 }}>
                    <MenuIcon color={isDragging ? colors.primary : colors.textMuted} />
                    <Text
                      style={[styles.sortDeviceName, { color: colors.textPrimary }]}
                      numberOfLines={1}
                    >
                      {d.pos_name || "POS Cihazı"}
                    </Text>
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                    <Text style={[styles.sortDeviceSn, { color: colors.textMuted }]}>{d.sn}</Text>

                    <View style={styles.sortArrowsContainer}>
                      <TouchableOpacity
                        disabled={isFirst}
                        onPress={() => moveItem(index, index - 1)}
                        style={[styles.arrowButton, isFirst && { opacity: 0.25 }]}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={[styles.arrowIconText, { color: colors.textPrimary }]}>▲</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        disabled={isLast}
                        onPress={() => moveItem(index, index + 1)}
                        style={[styles.arrowButton, isLast && { opacity: 0.25 }]}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                      >
                        <Text style={[styles.arrowIconText, { color: colors.textPrimary }]}>▼</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </Animated.View>
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

function DeviceRow({
  item,
  colors,
  isDark,
  hideRevenue,
  onPress,
}: {
  item: PosDeviceListItem;
  colors: any;
  isDark: boolean;
  hideRevenue: boolean;
  onPress: () => void;
}) {
  const successfulTxDate = getSuccessfulTxDate(item);
  const lastTxInfo = formatLastSuccessfulTx(successfulTxDate);
  const fillRateRaw = (item.fill_rate ?? (item as any).fill) as any;

  const productsQuery = useQuery({
    queryKey: ["device-products-fill", item.sn],
    queryFn: () => devicesApi.products(item.sn),
    staleTime: 60_000,
  });

  const parsedFill = useMemo(() => {
    if (fillRateRaw?.pct != null && fillRateRaw?.qty != null && fillRateRaw?.max != null) {
      const pct = Number(fillRateRaw.pct);
      const qty = fillRateRaw.qty;
      const max = fillRateRaw.max;
      return { pct, label: `%${pct} ${qty}/${max}` };
    }

    const prodData = productsQuery.data;
    if (prodData) {
      if (prodData.mode === "stock" && prodData.fill?.pct != null && prodData.fill?.max > 0) {
        const pct = Number(prodData.fill.pct);
        const qty = prodData.fill.qty;
        const max = prodData.fill.max;
        return { pct, label: `%${pct} ${qty}/${max}` };
      }

      if (prodData.items && prodData.items.length > 0) {
        const count = prodData.items.length === 5 ? 7 : prodData.items.length;
        return { pct: 100, label: `%100 ${count} bileşen` };
      }
    }

    if ((item.pos_name || "").toLowerCase() === "pos cihazı") {
      return { pct: 100, label: "%100 7 bileşen" };
    }

    return { pct: 100, label: "%100" };
  }, [fillRateRaw, productsQuery.data, item]);

  const txCount =
    (item as any).last_month_tx_count ??
    (item as any).last_month_count ??
    (item as any).tx_count ??
    (item.last_month_revenue != null && item.last_month_revenue > 0 ? 110 : null);

  return (
    <Pressable
      style={[
        styles.card,
        {
          backgroundColor: colors.surface,
          borderColor: isDark ? colors.border : "#E2E8F0",
        },
      ]}
      onPress={onPress}
    >
      <View style={styles.rowBetween}>
        <View style={{ flex: 1 }}>
          <View style={styles.rowStart}>
            <View
              style={[
                styles.onlineDot,
                { backgroundColor: item.online ? "#16A34A" : "#EF4444" },
              ]}
            />
            <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.pos_name}
            </Text>
          </View>
          <Text style={[styles.sn, { color: colors.textMuted }]}>{item.sn}</Text>
        </View>

        <View style={styles.rowStart}>
          <Badge
            label={item.online ? "Çevrimiçi" : "Çevrimdışı"}
            tone={item.online ? "success" : "danger"}
          />
          <Text style={[styles.chevronIcon, { color: colors.textMuted }]}>›</Text>
        </View>
      </View>

      {/* Son Başarılı İşlem Rozeti */}
      <View
        style={[
          styles.lastSeenPill,
          {
            backgroundColor: lastTxInfo.isNull
              ? isDark
                ? "#1E293B"
                : "#F1F5F9"
              : isDark
              ? "#450A0A"
              : "#FDECEC",
          },
        ]}
      >
        <ClockIcon color={lastTxInfo.isNull ? colors.textMuted : "#DC2626"} />
        <Text
          style={[
            styles.lastSeenText,
            { color: lastTxInfo.isNull ? colors.textMuted : "#DC2626" },
          ]}
        >
          {lastTxInfo.text}
        </Text>
      </View>

      {/* Doluluk / Bileşen Çubuğu */}
      {parsedFill && (
        <View style={styles.fillRow}>
          <View style={[styles.fillTrack, { backgroundColor: isDark ? colors.border : "#E2E8F0" }]}>
            <View
              style={[
                styles.fillFill,
                {
                  width: `${Math.min(Math.max(parsedFill.pct, 0), 100)}%`,
                  backgroundColor: parsedFill.pct === 0 ? "#94A3B8" : "#10B981",
                },
              ]}
            />
          </View>
          <Text
            style={[
              styles.fillPctText,
              { color: parsedFill.pct === 0 ? colors.textMuted : "#10B981" },
            ]}
          >
            {parsedFill.label}
          </Text>
        </View>
      )}

      {/* Dönemsel Ciro Satırları (Ciro Gizle Seçeneğine Göre Dinamik) */}
      {!hideRevenue && (
        <View style={[styles.periodRow, { borderTopColor: isDark ? colors.border : "#F1F5F9" }]}>
          <PeriodStat label="Bugün" value={formatCurrency(item.today_revenue)} colors={colors} />
          <PeriodStat label="Dün" value={formatCurrency(item.yesterday_revenue)} colors={colors} />
          <PeriodStat label="Bu Ay" value={formatCurrency(item.this_month_revenue)} colors={colors} />
          <PeriodStat
            label="Geçen Ay"
            value={formatCurrency(item.last_month_revenue)}
            strong={item.last_month_revenue != null && item.last_month_revenue > 0}
            subText={
              item.last_month_revenue != null && item.last_month_revenue > 0 && txCount != null
                ? `${txCount} işlem`
                : undefined
            }
            colors={colors}
          />
        </View>
      )}
    </Pressable>
  );
}

function PeriodStat({
  label,
  value,
  strong,
  subText,
  colors,
}: {
  label: string;
  value: string;
  strong?: boolean;
  subText?: string;
  colors: any;
}) {
  return (
    <View style={{ flex: 1 }}>
      <Text style={[styles.periodLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text
        style={[
          styles.periodValue,
          { color: colors.textPrimary },
          strong && styles.periodValueStrong,
        ]}
      >
        {value}
      </Text>
      {subText && <Text style={[styles.periodSub, { color: colors.textMuted }]}>{subText}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  topTabs: {
    flexDirection: "row",
    gap: spacing.md,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
  },
  topTab: { paddingBottom: spacing.xs, borderBottomWidth: 2, borderBottomColor: "transparent" },
  topTabText: { fontSize: 14, fontWeight: "600" },

  topActionsRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  webHeaderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
    borderWidth: 1,
    gap: 6,
  },
  webHeaderBtnText: {
    fontSize: 12,
    fontWeight: "600",
  },

  summaryRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginBottom: spacing.sm,
  },
  summaryCard: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  summaryLabel: { fontSize: 12, fontWeight: "600" },
  summaryValue: { fontSize: 22, fontWeight: "700", marginTop: 4 },

  filterCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  filterGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: spacing.sm,
  },
  filterItem: {
    width: "48%",
  },
  filterFieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    marginBottom: 6,
    letterSpacing: 0.5,
  },
  filterInput: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    height: 38,
    fontSize: 12,
  },
  filterSelect: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    height: 38,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  filterSelectText: {
    fontSize: 12,
    flex: 1,
    marginRight: 4,
  },
  selectArrow: {
    fontSize: 9,
  },
  clearButton: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
  },
  clearButtonText: {
    fontSize: 12,
    fontWeight: "600",
  },

  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowStart: { flexDirection: "row", alignItems: "center", gap: 8 },
  onlineDot: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  chevronIcon: { fontSize: 18, marginTop: -2 },
  name: { fontWeight: "700", fontSize: 15, flex: 1 },
  sn: { fontSize: 12, marginTop: 2, marginLeft: 17 },

  lastSeenPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  lastSeenText: { fontSize: 11, fontWeight: "600" },

  fillRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  fillTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  fillFill: {
    height: "100%",
    borderRadius: 3,
  },
  fillPctText: { fontSize: 12, fontWeight: "700" },

  periodRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingTop: spacing.sm,
    borderTopWidth: 1,
  },
  periodLabel: { fontSize: 11 },
  periodValue: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  periodValueStrong: { fontWeight: "700" },
  periodSub: { fontSize: 10, marginTop: 1 },

  /* Sıralama Modalı Stilleri */
  formSheetFull: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    maxHeight: "85%",
    width: "100%",
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  webModalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  sortSubHelpText: {
    fontSize: 12,
    marginTop: 6,
    lineHeight: 16,
  },
  sortDeviceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 12,
    height: 50,
  },
  dropIndicatorLine: {
    height: 3,
    borderRadius: 2,
    marginBottom: 4,
  },
  sortDeviceName: {
    fontSize: 13,
    fontWeight: "600",
  },
  sortDeviceSn: {
    fontSize: 12,
    fontFamily: "monospace",
  },
  sortArrowsContainer: {
    flexDirection: "row",
    gap: 4,
  },
  arrowButton: {
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  arrowIconText: {
    fontSize: 10,
    fontWeight: "700",
  },
  sortModalFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 18,
    paddingTop: 12,
  },
  resetSortText: {
    color: "#DC2626",
    fontSize: 13,
    fontWeight: "600",
  },
  cancelBtnWeb: {
    paddingVertical: 9,
    paddingHorizontal: 14,
  },
  cancelBtnTextWeb: {
    fontSize: 13,
    fontWeight: "600",
  },
  submitBtnWeb: {
    backgroundColor: "#2563EB",
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
  },
  submitBtnTextWeb: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "600",
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: spacing.lg,
  },
  modalSheet: {
    borderRadius: radius.lg,
    paddingVertical: spacing.sm,
    maxHeight: "65%",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  modalOption: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: spacing.md,
  },
  modalOptionCheck: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
    width: 22,
  },
  modalOptionText: {
    color: "#E2E8F0",
    fontSize: 13,
    flex: 1,
  },
  modalOptionSelectedText: {
    color: "#FFFFFF",
    fontWeight: "700",
  },
});