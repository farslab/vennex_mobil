import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import Svg, { Line, Path, Rect } from "react-native-svg";
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import {
  cardsApi,
  type CardQuota,
  type PosDeviceItem,
  type RecurringBalanceRule,
  type RecurringQuotaRule,
} from "@/api/cards";
import { useAppTheme } from "@/theme/colors";
import { radius, spacing } from "@/theme/spacing";
import { Badge, EmptyState, ErrorView, LoadingView, ScreenCard } from "@/components/Common";
import type { CardGroup, NfcCard } from "@/types/cards";

const TOP_TABS = [
  "Personel Kartları",
  "Kart Grupları",
  "Bakiye Yükleme",
  "İstihkak Yönetimi",
  "İstihkak Yenileme",
] as const;
type TopTabKey = (typeof TOP_TABS)[number];

const PERIOD_LABELS: Record<string, string> = {
  daily: "Günlük",
  weekly: "Haftalık",
  monthly: "Aylık",
};

const OPERATION_LABELS: Record<string, string> = {
  add: "Ekle",
  set: "Ayarla",
  subtract: "Çıkar",
};

function formatCurrency(n: number | string | null | undefined) {
  if (n == null || n === "") return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(num);
}

function formatDate(dt: string | null | undefined) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return dt;
  return d.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

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

function TrashIcon({ color = "#94A3B8" }: { color?: string }) {
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

function CalendarIcon({ color = "#64748B" }: { color?: string }) {
  return (
    <Svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="2" />
      <Line x1="16" y1="2" x2="16" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="8" y1="2" x2="8" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="3" y1="10" x2="21" y2="10" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

export default function CardsListScreen() {
  const { colors, isDark } = useAppTheme();
  const [topTab, setTopTab] = useState<TopTabKey>("Personel Kartları");

  return (
    <View style={[styles.container, { backgroundColor: isDark ? colors.bg : "#F8FAFC" }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.topTabsScroll, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
        contentContainerStyle={styles.topTabsContent}
      >
        {TOP_TABS.map((t) => {
          const isActive = topTab === t;
          return (
            <Pressable
              key={`top-tab-${t}`}
              onPress={() => setTopTab(t)}
              style={[styles.topTab, isActive && { borderBottomColor: colors.primary }]}
            >
              <Text
                style={[
                  styles.topTabText,
                  { color: isActive ? colors.primary : colors.textMuted },
                  isActive && styles.topTabTextActive,
                ]}
              >
                {t}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {topTab === "Personel Kartları" && <PersonelKartlariTab />}
      {topTab === "Kart Grupları" && <KartGruplariTab />}
      {topTab === "Bakiye Yükleme" && <BakiyeYuklemeTab />}
      {topTab === "İstihkak Yönetimi" && <IstihkakYonetimiTab />}
      {topTab === "İstihkak Yenileme" && <IstihkakYenilemeTab />}
    </View>
  );
}

/* ==================== PERSONEL KARTLARI ==================== */

const TABS: { key: string; label: string }[] = [
  { key: "active", label: "Aktif" },
  { key: "pending", label: "Bekleyen" },
];

function PersonelKartlariTab() {
  const { colors, isDark } = useAppTheme();
  const [status, setStatus] = useState("active");
  const [q, setQ] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [groupPickerOpen, setGroupPickerOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();

  const [createCardModalOpen, setCreateCardModalOpen] = useState(false);
  const [newCardUid, setNewCardUid] = useState("");
  const [newCustomerNo, setNewCustomerNo] = useState("0");
  const [newFirstName, setNewFirstName] = useState("");
  const [newLastName, setNewLastName] = useState("");
  const [newInitialBalance, setNewInitialBalance] = useState("0");
  const [newSelectedGroupIds, setNewSelectedGroupIds] = useState<Set<number>>(new Set());

  const {
    data,
    isLoading,
    error,
    refetch,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["cards", status, selectedGroup],
    queryFn: ({ pageParam = 1 }) =>
      cardsApi.list({
        status,
        page: pageParam as number,
        group_id: selectedGroup ? Number(selectedGroup) : undefined,
      }),
    initialPageParam: 1,
    getNextPageParam: (lastPage: any) => {
      if (lastPage?.page && lastPage?.num_pages && lastPage.page < lastPage.num_pages) {
        return lastPage.page + 1;
      }
      if (lastPage?.next) {
        return (lastPage.page || 1) + 1;
      }
      return undefined;
    },
  });

  const cards = useMemo(() => {
    return data?.pages.flatMap((page: any) => page?.results ?? page ?? []) ?? [];
  }, [data]);

  const totalCount = useMemo(() => {
    const firstPage: any = data?.pages?.[0];
    if (!firstPage) return cards.length;
    if (status === "active" && firstPage.active_count != null) return firstPage.active_count;
    if (status === "pending" && firstPage.pending_count != null) return firstPage.pending_count;
    return firstPage.count ?? cards.length;
  }, [data, cards.length, status]);

  const groupsQuery = useQuery<CardGroup[]>({
    queryKey: ["card-groups"],
    queryFn: () => cardsApi.groups.list(),
  });

  const availableGroups = groupsQuery.data ?? [];

  const filteredCards = useMemo(() => {
    let result = cards;
    if (q.trim()) {
      const term = q.trim().toLowerCase();
      result = result.filter((item: NfcCard) => {
        const fullName = `${item.first_name ?? ""} ${item.last_name ?? ""}`.toLowerCase();
        return fullName.includes(term) || (item.uid ?? "").toLowerCase().includes(term);
      });
    }
    return result;
  }, [cards, q]);

  const selectedGroupName = selectedGroup
    ? availableGroups.find((g) => String(g.id) === selectedGroup)?.name ?? "Tüm Gruplar"
    : "Tüm Gruplar";

  const handleClearFilters = () => {
    setQ("");
    setSelectedGroup(null);
  };

  const isCurrentSelectionFull =
    filteredCards.length > 0 && filteredCards.every((item: NfcCard) => selectedIds.has(item.id));

  const toggleSelectAll = () => {
    if (isCurrentSelectionFull) {
      setSelectedIds(new Set());
    } else {
      const allIds = new Set(filteredCards.map((item: NfcCard) => item.id));
      setSelectedIds(allIds);
    }
  };

  const clearAllSelection = () => {
    setSelectedIds(new Set());
  };

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const openCreateModal = () => {
    setNewCardUid("");
    setNewCustomerNo("0");
    setNewFirstName("");
    setNewLastName("");
    setNewInitialBalance("0");
    setNewSelectedGroupIds(new Set());
    setCreateCardModalOpen(true);
  };

  const toggleGroupSelection = (groupId: number) => {
    setNewSelectedGroupIds((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const handleCreateCardSubmit = async () => {
    if (!newCardUid.trim()) {
      Alert.alert("Hata", "UID alanı zorunludur.");
      return;
    }

    try {
      await cardsApi.create({
        uid: newCardUid.trim(),
        customer_no: parseInt(newCustomerNo, 10) || 0,
        first_name: newFirstName.trim() || undefined,
        last_name: newLastName.trim() || undefined,
        balance: parseFloat(newInitialBalance) || 0,
        group_ids: Array.from(newSelectedGroupIds),
      });
      setCreateCardModalOpen(false);
      queryClient.invalidateQueries({ queryKey: ["cards"] });
    } catch (e: any) {
      const errorMsg = e.response?.data?.detail || e.message || "Kart oluşturulamadı.";
      Alert.alert("Hata", errorMsg);
    }
  };

  const handleApprove = async (card: NfcCard) => {
    try {
      await cardsApi.approve(card.id, false);
      queryClient.invalidateQueries({ queryKey: ["cards"] });
    } catch (e) {
      Alert.alert("Hata", (e as Error).message);
    }
  };

  const handleReject = async (card: NfcCard) => {
    Alert.alert(
      "Kartı Reddet",
      `${card.first_name || ""} ${card.last_name || ""} için kart talebini reddetmek istiyor musunuz?`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Reddet",
          style: "destructive",
          onPress: async () => {
            try {
              await cardsApi.reject(card.id);
              queryClient.invalidateQueries({ queryKey: ["cards"] });
            } catch (e) {
              Alert.alert("Hata", (e as Error).message);
            }
          },
        },
      ]
    );
  };

  const handleDelete = (card: NfcCard) => {
    Alert.alert("Kartı Sil", `${card.first_name || card.uid} kartını silmek istediğinize emin misiniz?`, [
      { text: "Vazgeç", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await cardsApi.remove(card.id);
            queryClient.invalidateQueries({ queryKey: ["cards"] });
          } catch (e) {
            Alert.alert("Hata", (e as Error).message);
          }
        },
      },
    ]);
  };

  if (isLoading && !data) return <LoadingView label="Kartlar yükleniyor..." />;
  if (error) return <ErrorView message={(error as Error).message} onRetry={refetch} />;

  return (
    <View style={styles.tabFlex}>
      <FlatList
        data={filteredCards}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.listContent}
        onEndReached={() => {
          if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
          }
        }}
        onEndReachedThreshold={0.5}
        ListHeaderComponent={
          <View style={styles.headerWrapper}>
            <View style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: isDark ? colors.border : "#E2E8F0" }]}>
              <Text style={[styles.filterLabel, { color: colors.textMuted }]}>ARA</Text>
              <TextInput
                style={[
                  styles.search,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    color: colors.textPrimary,
                  },
                ]}
                placeholder="UID, ad veya soyad..."
                placeholderTextColor={colors.textMuted}
                value={q}
                onChangeText={setQ}
              />

              <Text style={[styles.filterLabel, { color: colors.textMuted, marginTop: spacing.sm }]}>GRUP</Text>
              <Pressable
                style={[
                  styles.groupSelect,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                  },
                ]}
                onPress={() => setGroupPickerOpen(true)}
              >
                <Text style={[styles.groupSelectText, { color: colors.textPrimary }]}>{selectedGroupName}</Text>
              </Pressable>

              <View style={styles.filterButtonsRow}>
                <Pressable
                  style={[styles.filterBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={() => refetch()}
                >
                  <Text style={styles.filterBtnPrimaryText}>Filtrele</Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.filterBtn,
                    {
                      backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                      borderColor: isDark ? colors.border : "#CBD5E1",
                    },
                  ]}
                  onPress={handleClearFilters}
                >
                  <Text style={[styles.filterBtnText, { color: colors.textSecondary }]}>Temizle</Text>
                </Pressable>
                <Pressable
                  style={[styles.filterBtn, { backgroundColor: colors.primary, borderColor: colors.primary }]}
                  onPress={openCreateModal}
                >
                  <Text style={styles.filterBtnPrimaryText}>+ Yeni Kart</Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.tabs}>
              {TABS.map((t) => {
                const isActive = status === t.key;
                return (
                  <Pressable
                    key={`personel-tab-${t.key}`}
                    onPress={() => {
                      setStatus(t.key);
                      setSelectedIds(new Set());
                    }}
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
                      {t.label} ({status === t.key ? totalCount : 0})
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            <View
              style={[
                styles.selectionHeader,
                {
                  backgroundColor: colors.surface,
                  borderColor: isDark ? colors.border : "#E2E8F0",
                },
              ]}
            >
              <TouchableOpacity style={styles.selectionLeft} onPress={toggleSelectAll} activeOpacity={0.8}>
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: isCurrentSelectionFull ? colors.primary : "#94A3B8",
                      backgroundColor: isCurrentSelectionFull ? colors.primary : "transparent",
                    },
                  ]}
                >
                  {isCurrentSelectionFull && <Text style={styles.checkMark}>✓</Text>}
                </View>
                <Text style={[styles.selectionTitle, { color: colors.textPrimary }]}>
                  {selectedIds.size > 0 ? `${selectedIds.size} Kart Seçildi` : "Tümünü Seç"}
                </Text>
              </TouchableOpacity>

              {selectedIds.size > 0 && (
                <TouchableOpacity onPress={clearAllSelection}>
                  <Text style={[styles.selectAllLink, { color: colors.danger }]}>Seçimi Temizle</Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState label="Kart bulunamadı" />}
        ListFooterComponent={
          isFetchingNextPage ? (
            <View style={styles.footerLoader}>
              <ActivityIndicator size="small" color={colors.primary} />
            </View>
          ) : null
        }
        renderItem={({ item }) => {
          const isSelected = selectedIds.has(item.id);
          const fullName =
            item.first_name || item.last_name
              ? `${item.first_name ?? ""} ${item.last_name ?? ""}`.trim()
              : "İsimsiz Kart";

          return (
            <View
              style={[
                styles.itemCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: isSelected ? colors.primary : isDark ? colors.border : "#E2E8F0",
                },
                isSelected && { borderWidth: 1.5 },
              ]}
            >
              <View style={styles.cardHeaderRow}>
                <View style={styles.headerLeft}>
                  <TouchableOpacity
                    style={[
                      styles.checkbox,
                      {
                        borderColor: isSelected ? colors.primary : "#94A3B8",
                        backgroundColor: isSelected ? colors.primary : "transparent",
                      },
                    ]}
                    onPress={() => toggleSelect(item.id)}
                  >
                    {isSelected && <Text style={styles.checkMark}>✓</Text>}
                  </TouchableOpacity>

                  <View style={styles.nameBlock}>
                    <Text style={[styles.cardFullName, { color: colors.textPrimary }]}>{fullName}</Text>
                    <Text style={[styles.cardUid, { color: colors.textMuted }]}>
                      UID: <Text style={{ fontFamily: "monospace", color: colors.textPrimary }}>{item.uid}</Text>
                    </Text>
                  </View>
                </View>

                {status === "pending" ? (
                  <View style={styles.pendingActions}>
                    <TouchableOpacity onPress={() => handleApprove(item)}>
                      <Text style={[styles.actionBtnText, { color: "#16A34A" }]}>Onayla</Text>
                    </TouchableOpacity>
                    <Text style={styles.actionDot}>•</Text>
                    <TouchableOpacity onPress={() => handleReject(item)}>
                      <Text style={[styles.actionBtnText, { color: "#DC2626" }]}>Reddet</Text>
                    </TouchableOpacity>
                  </View>
                ) : (
                  <View style={styles.actionsRow}>
                    <TouchableOpacity onPress={() => navigation.navigate("CardEdit", { id: item.id })}>
                      <Text style={[styles.actionBtnText, { color: colors.primary }]}>Düzenle</Text>
                    </TouchableOpacity>
                    <Text style={styles.actionDot}>•</Text>
                    <TouchableOpacity onPress={() => navigation.navigate("CardDetail", { id: item.id })}>
                      <Text style={[styles.actionBtnText, { color: colors.primary }]}>Detay</Text>
                    </TouchableOpacity>
                    <Text style={styles.actionDot}>•</Text>
                    <TouchableOpacity onPress={() => handleDelete(item)}>
                      <Text style={[styles.actionBtnText, { color: "#DC2626" }]}>Sil</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>

              <View style={[styles.cardDivider, { backgroundColor: isDark ? colors.border : "#F1F5F9" }]} />

              <View style={styles.cardDetailsRow}>
                <View style={styles.infoCol}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>DURUM</Text>
                  <View style={styles.badgeRow}>
                    <Badge
                      label={status === "pending" ? "Bekliyor" : item.is_active ? "Aktif" : "Pasif"}
                      tone={status === "pending" ? "warning" : item.is_active ? "success" : "muted"}
                    />
                  </View>
                </View>

                <View style={styles.infoCol}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>BAKİYE</Text>
                  <Text style={[styles.balanceValue, { color: colors.textPrimary }]}>
                    {formatCurrency(item.balance)}
                  </Text>
                </View>

                <View style={[styles.infoCol, { flex: 1.2 }]}>
                  <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>GRUPLAR</Text>
                  <View style={styles.groupPillsWrap}>
                    {item.groups && item.groups.length > 0 ? (
                      item.groups.map((g: { id: number | string; name: string }, idx: number) => (
                        <View
                          key={`card-group-${item.id}-${g.id}-${idx}`}
                          style={[styles.groupPill, { backgroundColor: isDark ? colors.surfaceAlt : "#F1F5F9" }]}
                        >
                          <Text style={[styles.groupPillText, { color: colors.textPrimary }]}>{g.name}</Text>
                        </View>
                      ))
                    ) : (
                      <Text style={[styles.emptyGroupText, { color: colors.textMuted }]}>—</Text>
                    )}
                  </View>
                </View>
              </View>
            </View>
          );
        }}
      />

      <Modal visible={groupPickerOpen} transparent animationType="fade" onRequestClose={() => setGroupPickerOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setGroupPickerOpen(false)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Grup Seç</Text>
            <Pressable
              style={[styles.modalOption, { borderBottomColor: colors.border }]}
              onPress={() => {
                setSelectedGroup(null);
                setGroupPickerOpen(false);
              }}
            >
              <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>Tüm Gruplar</Text>
            </Pressable>
            {availableGroups.map((g, idx) => (
              <Pressable
                key={`picker-group-${g.id}-${idx}`}
                style={[styles.modalOption, { borderBottomColor: colors.border }]}
                onPress={() => {
                  setSelectedGroup(String(g.id));
                  setGroupPickerOpen(false);
                }}
              >
                <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>{g.name}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

      <Modal
        visible={createCardModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateCardModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCreateCardModalOpen(false)}>
          <Pressable style={[styles.formSheetFull, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.webModalTitle, { color: colors.textPrimary }]}>Yeni Personel Kartı</Text>
              <TouchableOpacity onPress={() => setCreateCardModalOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[styles.closeIconText, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>
                UID <Text style={{ color: "#DC2626" }}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.webInput,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    color: colors.textPrimary,
                  },
                ]}
                placeholder="Kart UID"
                placeholderTextColor={colors.textMuted}
                value={newCardUid}
                onChangeText={setNewCardUid}
                autoCapitalize="none"
              />

              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>MÜŞTERİ NO</Text>
              <TextInput
                style={[
                  styles.webInput,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    color: colors.textPrimary,
                  },
                ]}
                value={newCustomerNo}
                onChangeText={setNewCustomerNo}
                keyboardType="numeric"
              />

              <View style={styles.twoColRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>AD</Text>
                  <TextInput
                    style={[
                      styles.webInput,
                      {
                        backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                        color: colors.textPrimary,
                      },
                    ]}
                    placeholder="Ad"
                    placeholderTextColor={colors.textMuted}
                    value={newFirstName}
                    onChangeText={setNewFirstName}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>SOYAD</Text>
                  <TextInput
                    style={[
                      styles.webInput,
                      {
                        backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                        color: colors.textPrimary,
                      },
                    ]}
                    placeholder="Soyad"
                    placeholderTextColor={colors.textMuted}
                    value={newLastName}
                    onChangeText={setNewLastName}
                  />
                </View>
              </View>

              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>
                BAŞLANGIÇ BAKİYESİ (₺)
              </Text>
              <TextInput
                style={[
                  styles.webInput,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    color: colors.textPrimary,
                  },
                ]}
                value={newInitialBalance}
                onChangeText={setNewInitialBalance}
                keyboardType="numeric"
              />

              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>GRUPLAR</Text>
              <View
                style={[
                  styles.webGroupsBox,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                  },
                ]}
              >
                {availableGroups.length > 0 ? (
                  availableGroups.map((g, idx) => {
                    const isChecked = newSelectedGroupIds.has(g.id);
                    return (
                      <TouchableOpacity
                        key={`create-card-group-${g.id}-${idx}`}
                        style={styles.groupCheckboxRow}
                        onPress={() => toggleGroupSelection(g.id)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.webCheckboxSquare,
                            {
                              backgroundColor: isChecked ? "#2563EB" : "transparent",
                              borderColor: isChecked ? "#2563EB" : isDark ? colors.border : "#94A3B8",
                            },
                          ]}
                        >
                          {isChecked && <Text style={styles.webCheckIcon}>✓</Text>}
                        </View>
                        <Text style={[styles.groupCheckboxLabel, { color: colors.textPrimary }]}>{g.name}</Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <Text style={[styles.emptyGroupText, { color: colors.textMuted }]}>Kayıtlı grup bulunamadı.</Text>
                )}
              </View>

              <View style={styles.modalActionButtonsRow}>
                <TouchableOpacity style={styles.cancelBtnWeb} onPress={() => setCreateCardModalOpen(false)}>
                  <Text style={[styles.cancelBtnTextWeb, { color: isDark ? colors.textSecondary : "#475569" }]}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtnWeb} onPress={handleCreateCardSubmit}>
                  <Text style={styles.submitBtnTextWeb}>Ekle</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ==================== KART GRUPLARI ==================== */

function KartGruplariTab() {
  const { colors, isDark } = useAppTheme();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroup, setEditGroup] = useState<CardGroup | null>(null);
  const [groupName, setGroupName] = useState("");
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<number>>(new Set());
  const [groupDevicesMap, setGroupDevicesMap] = useState<Record<number, any[]>>({});

  const groupsQuery = useQuery<CardGroup[]>({
    queryKey: ["card-groups"],
    queryFn: () => cardsApi.groups.list(),
  });

  const groups: CardGroup[] = groupsQuery.data ?? [];

  const posDevicesQuery = useQuery<PosDeviceItem[]>({
    queryKey: ["all-pos-devices"],
    queryFn: () => cardsApi.posDevices.list(),
  });

  const allPosDevices = posDevicesQuery.data ?? [];

  useEffect(() => {
    if (!groups || groups.length === 0) return;

    groups.forEach((g: CardGroup) => {
      const posCount = g.pos_device_count ?? g.pos_device_ids?.length ?? 0;
      if (posCount > 0 && !groupDevicesMap[g.id]) {
        cardsApi.groups
          .detail(g.id)
          .then((res: any) => {
            if (res && res.pos_devices) {
              setGroupDevicesMap((prev) => ({
                ...prev,
                [g.id]: res.pos_devices,
              }));
            }
          })
          .catch(() => {});
      }
    });
  }, [groups]);

  const filteredGroups = useMemo(() => {
    if (!q.trim()) return groups;
    const term = q.trim().toLowerCase();
    return groups.filter((g: CardGroup) => g.name.toLowerCase().includes(term));
  }, [groups, q]);

  const openCreate = () => {
    setGroupName("");
    setSelectedDeviceIds(new Set());
    setCreateOpen(true);
  };

  const openEdit = (g: CardGroup) => {
    setGroupName(g.name);
    const initialDevIds = new Set<number>(
      g.pos_device_ids || (groupDevicesMap[g.id] ? groupDevicesMap[g.id].map((d) => d.id) : [])
    );
    setSelectedDeviceIds(initialDevIds);
    setEditGroup(g);
  };

  const toggleDeviceSelection = (deviceId: number) => {
    setSelectedDeviceIds((prev) => {
      const next = new Set(prev);
      if (next.has(deviceId)) {
        next.delete(deviceId);
      } else {
        next.add(deviceId);
      }
      return next;
    });
  };

  const handleCreate = async () => {
    if (!groupName.trim()) {
      Alert.alert("Hata", "Grup adı zorunludur.");
      return;
    }
    try {
      await cardsApi.groups.create(groupName.trim(), Array.from(selectedDeviceIds));
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["card-groups"] });
    } catch (e: any) {
      const errorMsg = e.response?.data?.detail || e.message || "Grup oluşturulamadı.";
      Alert.alert("Hata", errorMsg);
    }
  };

  const handleEditSave = async () => {
    if (!editGroup || !groupName.trim()) return;
    try {
      await cardsApi.groups.update(editGroup.id, {
        name: groupName.trim(),
        pos_device_ids: Array.from(selectedDeviceIds),
      });
      setEditGroup(null);
      queryClient.invalidateQueries({ queryKey: ["card-groups"] });
    } catch (e: any) {
      const errorMsg = e.response?.data?.detail || e.message || "Grup güncellenemedi.";
      Alert.alert("Hata", errorMsg);
    }
  };

  const handleDelete = (g: CardGroup) => {
    Alert.alert("Grubu Sil", `${g.name} grubunu silmek istediğinizden emin misiniz?`, [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await cardsApi.groups.remove(g.id);
            queryClient.invalidateQueries({ queryKey: ["card-groups"] });
          } catch (e) {
            Alert.alert("Hata", (e as Error).message);
          }
        },
      },
    ]);
  };

  const handleOpenActionMenu = (g: CardGroup) => {
    Alert.alert(g.name, "İşlem seçiniz:", [
      { text: "İptal", style: "cancel" },
      { text: "Adı Düzenle", onPress: () => openEdit(g) },
      { text: "Sil", style: "destructive", onPress: () => handleDelete(g) },
    ]);
  };

  if (groupsQuery.isLoading) return <LoadingView label="Gruplar yükleniyor..." />;
  if (groupsQuery.error)
    return <ErrorView message={(groupsQuery.error as Error).message} onRetry={groupsQuery.refetch} />;

  return (
    <View style={styles.tabFlex}>
      <View style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: isDark ? colors.border : "#E2E8F0" }]}>
        <View style={styles.groupSearchRow}>
          <TextInput
            style={[
              styles.search,
              {
                flex: 1,
                marginTop: 0,
                backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                borderColor: isDark ? colors.border : "#CBD5E1",
                color: colors.textPrimary,
              },
            ]}
            placeholder="Grup adı ara..."
            placeholderTextColor={colors.textMuted}
            value={q}
            onChangeText={setQ}
          />
          <Pressable
            style={[
              styles.filterBtn,
              {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
                flexGrow: 0,
                paddingHorizontal: spacing.lg,
              },
            ]}
          >
            <Text style={styles.filterBtnPrimaryText}>Ara</Text>
          </Pressable>
        </View>

        <Pressable
          style={[
            styles.filterBtn,
            {
              backgroundColor: colors.primary,
              borderColor: colors.primary,
              marginTop: spacing.sm,
              alignSelf: "flex-start",
              paddingHorizontal: spacing.lg,
            },
          ]}
          onPress={openCreate}
        >
          <Text style={styles.filterBtnPrimaryText}>+ Yeni Grup</Text>
        </Pressable>
      </View>

      <FlatList
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md }}
        data={filteredGroups}
        keyExtractor={(g) => String(g.id)}
        ListEmptyComponent={<EmptyState label="Grup bulunamadı" />}
        renderItem={({ item }) => {
          const rawItem = item as any;
          const posCount = item.pos_device_count ?? item.pos_device_ids?.length ?? 0;
          const devices: any[] = groupDevicesMap[item.id] || rawItem.pos_devices || [];

          return (
            <ScreenCard>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.groupCardTitle, { color: colors.textPrimary }]}>{item.name}</Text>
                  <Text style={[styles.mutedText, { color: colors.textMuted, marginTop: 3 }]}>
                    {item.active_cards_count ?? 0} aktif kart · {posCount} cihaz
                  </Text>
                </View>
                <TouchableOpacity
                  hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                  onPress={() => handleOpenActionMenu(item)}
                  style={styles.moreButton}
                >
                  <Text style={[styles.moreIcon, { color: colors.textMuted }]}>⋮</Text>
                </TouchableOpacity>
              </View>

              {posCount > 0 && (
                <View style={styles.linkedDevicesContainer}>
                  <Text style={[styles.linkedDevicesTitle, { color: colors.textMuted }]}>Bağlı Cihazlar</Text>
                  <View style={styles.devicePillsWrap}>
                    {devices.length > 0 ? (
                      devices.map((d: any, idx: number) => {
                        let label = "";
                        if (d.pos_name && d.sn) {
                          label = `${d.pos_name}(${d.sn})`;
                        } else if (d.pos_name) {
                          label = d.pos_name;
                        } else if (d.sn) {
                          label = `POS Cihazı(${d.sn})`;
                        } else {
                          label = `POS Cihazı #${d.id}`;
                        }

                        return (
                          <View
                            key={`linked-device-${item.id}-${d.id || idx}`}
                            style={[
                              styles.devicePill,
                              { backgroundColor: isDark ? colors.surfaceAlt : "#F1F5F9" },
                            ]}
                          >
                            <Text style={[styles.devicePillText, { color: isDark ? colors.textPrimary : "#475569" }]}>
                              {label}
                            </Text>
                          </View>
                        );
                      })
                    ) : (
                      <Text style={[styles.devicePillText, { color: colors.textMuted, fontStyle: "italic" }]}>
                        Cihazlar yükleniyor...
                      </Text>
                    )}
                  </View>
                </View>
              )}
            </ScreenCard>
          );
        }}
      />

      <Modal
        visible={createOpen || editGroup != null}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setCreateOpen(false);
          setEditGroup(null);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setCreateOpen(false);
            setEditGroup(null);
          }}
        >
          <Pressable style={[styles.formSheetFull, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.webModalTitle, { color: colors.textPrimary }]}>
                {editGroup ? "Grup Adını Düzenle" : "Yeni Kart Grubu"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setCreateOpen(false);
                  setEditGroup(null);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.closeIconText, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>
                GRUP ADI <Text style={{ color: "#DC2626" }}>*</Text>
              </Text>
              <TextInput
                style={[
                  styles.webInput,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    color: colors.textPrimary,
                  },
                ]}
                value={groupName}
                onChangeText={setGroupName}
                placeholder="örn. Ofis Personeli"
                placeholderTextColor={colors.textMuted}
              />

              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155", marginTop: 16 }]}>
                ERİŞİM İZNİ VERİLECEK CİHAZLAR
              </Text>
              <View
                style={[
                  styles.webGroupsBox,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    paddingVertical: 4,
                  },
                ]}
              >
                {allPosDevices.length > 0 ? (
                  allPosDevices.map((d, index) => {
                    const isChecked = selectedDeviceIds.has(d.id);
                    const isLast = index === allPosDevices.length - 1;
                    return (
                      <TouchableOpacity
                        key={`create-group-pos-${d.id}-${index}`}
                        style={[
                          styles.deviceCheckboxRow,
                          !isLast && { borderBottomWidth: 1, borderBottomColor: isDark ? colors.border : "#F1F5F9" },
                        ]}
                        onPress={() => toggleDeviceSelection(d.id)}
                        activeOpacity={0.7}
                      >
                        <View
                          style={[
                            styles.webCheckboxSquare,
                            {
                              backgroundColor: isChecked ? "#2563EB" : "transparent",
                              borderColor: isChecked ? "#2563EB" : isDark ? colors.border : "#94A3B8",
                            },
                          ]}
                        >
                          {isChecked && <Text style={styles.webCheckIcon}>✓</Text>}
                        </View>
                        <Text style={[styles.groupCheckboxLabel, { color: colors.textPrimary }]}>
                          {d.pos_name || d.sn || `POS Cihazı #${d.id}`}
                        </Text>
                      </TouchableOpacity>
                    );
                  })
                ) : (
                  <View style={{ padding: 12 }}>
                    <Text style={[styles.emptyGroupText, { color: colors.textMuted }]}>
                      Erişilebilir POS cihazı bulunamadı.
                    </Text>
                  </View>
                )}
              </View>

              <View style={styles.modalActionButtonsRow}>
                <TouchableOpacity
                  style={styles.cancelBtnWeb}
                  onPress={() => {
                    setCreateOpen(false);
                    setEditGroup(null);
                  }}
                >
                  <Text style={[styles.cancelBtnTextWeb, { color: isDark ? colors.textSecondary : "#475569" }]}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtnWeb} onPress={editGroup ? handleEditSave : handleCreate}>
                  <Text style={styles.submitBtnTextWeb}>{editGroup ? "Kaydet" : "Oluştur"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ==================== BAKİYE YÜKLEME ==================== */

function BakiyeYuklemeTab() {
  const { colors, isDark } = useAppTheme();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editItem, setEditItem] = useState<RecurringBalanceRule | null>(null);

  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [updateType, setUpdateType] = useState<"add" | "set">("add");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [targetType, setTargetType] = useState<"group" | "card">("group");
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [nextRunDate, setNextRunDate] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [pickerModalType, setPickerModalType] = useState<"operation" | "targetType" | "group" | "card" | "period" | null>(null);

  const groupsQuery = useQuery<CardGroup[]>({
    queryKey: ["card-groups"],
    queryFn: () => cardsApi.groups.list(),
  });

  const cardsQuery = useQuery({
    queryKey: ["all-cards-list"],
    queryFn: () => cardsApi.list({ page: 1 }),
  });

  const rulesQuery = useQuery<RecurringBalanceRule[]>({
    queryKey: ["recurring-balance", q],
    queryFn: () => cardsApi.recurringBalance.list({ q }),
  });

  const rules: RecurringBalanceRule[] = useMemo(() => {
    const raw = rulesQuery.data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as any).results)) return (raw as any).results;
    return [];
  }, [rulesQuery.data]);

  const filteredRules = useMemo(() => {
    if (!q.trim()) return rules;
    const term = q.trim().toLowerCase();
    return rules.filter(
      (r) =>
        (r.name ?? "").toLowerCase().includes(term) ||
        (r.target_card_uid ?? "").toLowerCase().includes(term) ||
        (r.target_group_name ?? "").toLowerCase().includes(term)
    );
  }, [rules, q]);

  const openCreateModal = () => {
    setName("");
    setAmount("");
    setUpdateType("add");
    setPeriod("monthly");
    setTargetType("group");
    setSelectedGroup(groupsQuery.data?.[0]?.id ?? null);
    setSelectedCard(null);
    setStartDate(new Date().toISOString().split("T")[0]);
    setNextRunDate("");
    setIsActive(true);
    setEditItem(null);
    setCreateOpen(true);
  };

  const openEditModal = (rule: RecurringBalanceRule) => {
    setName(rule.name || "");
    setAmount(String(rule.amount || ""));
    setUpdateType(rule.update_type || "add");
    setPeriod(rule.period || "monthly");
    setTargetType(rule.target_type || "group");
    setSelectedGroup(rule.target_group ?? groupsQuery.data?.[0]?.id ?? null);
    setSelectedCard(rule.target_card ?? null);
    setStartDate(rule.start_date || new Date().toISOString().split("T")[0]);
    setNextRunDate(rule.next_run || "");
    setIsActive(rule.is_active ?? true);
    setEditItem(rule);
    setCreateOpen(true);
  };

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert("Hata", "Ad alanı zorunludur.");
      return;
    }
    if (!amount.trim() || Number.isNaN(Number(amount))) {
      Alert.alert("Hata", "Geçerli bir miktar girin.");
      return;
    }
    if (targetType === "group" && !selectedGroup) {
      Alert.alert("Hata", "Lütfen bir grup seçin.");
      return;
    }
    if (targetType === "card" && !selectedCard) {
      Alert.alert("Hata", "Lütfen bir kart seçin.");
      return;
    }

    try {
      if (editItem) {
        await cardsApi.recurringBalance.update(editItem.id, {
          name: name.trim(),
          amount: Number(amount),
          update_type: updateType,
          period,
          target_type: targetType,
          target_card: targetType === "card" ? selectedCard : null,
          target_group: targetType === "group" ? selectedGroup : null,
          start_date: startDate,
          is_active: isActive,
        });
      } else {
        await cardsApi.recurringBalance.create({
          name: name.trim(),
          amount: Number(amount),
          update_type: updateType,
          period,
          target_type: targetType,
          target_card: targetType === "card" ? selectedCard : null,
          target_group: targetType === "group" ? selectedGroup : null,
          start_date: startDate,
          is_active: isActive,
        });
      }
      setCreateOpen(false);
      setEditItem(null);
      queryClient.invalidateQueries({ queryKey: ["recurring-balance"] });
    } catch (e: any) {
      const errorMsg = e.response?.data?.detail || e.message || "İşlem başarısız.";
      Alert.alert("Hata", errorMsg);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert("Kuralı Sil", "Bu bakiye yükleme kuralını silmek istediğinizden emin misiniz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await cardsApi.recurringBalance.remove(id);
            queryClient.invalidateQueries({ queryKey: ["recurring-balance"] });
          } catch (e) {
            Alert.alert("Hata", (e as Error).message);
          }
        },
      },
    ]);
  };

  const currentGroupName = groupsQuery.data?.find((g) => g.id === selectedGroup)?.name || "Grup seç...";
  const currentCardName =
    cardsQuery.data?.results?.find((c: NfcCard) => c.id === selectedCard)
      ? `${cardsQuery.data.results.find((c: NfcCard) => c.id === selectedCard)?.first_name || ""} (${cardsQuery.data.results.find((c: NfcCard) => c.id === selectedCard)?.uid})`
      : "Kart seç...";

  if (rulesQuery.isLoading) return <LoadingView label="Kurallar yükleniyor..." />;
  if (rulesQuery.error)
    return <ErrorView message={(rulesQuery.error as Error).message} onRetry={rulesQuery.refetch} />;

  return (
    <View style={styles.tabFlex}>
      <View style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: isDark ? colors.border : "#E2E8F0" }]}>
        <Text style={[styles.filterLabel, { color: colors.textMuted }]}>İSİM, KART UID, GRUP...</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
          <TextInput
            style={[
              styles.search,
              {
                flex: 1,
                marginTop: 0,
                backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                borderColor: isDark ? colors.border : "#CBD5E1",
                color: colors.textPrimary,
              },
            ]}
            placeholder="İsim, kart UID, grup..."
            placeholderTextColor={colors.textMuted}
            value={q}
            onChangeText={setQ}
          />
          <Pressable
            style={[
              styles.filterBtn,
              {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
                flexGrow: 0,
                paddingHorizontal: spacing.lg,
              },
            ]}
            onPress={() => rulesQuery.refetch()}
          >
            <Text style={styles.filterBtnPrimaryText}>Ara</Text>
          </Pressable>
        </View>

        <Pressable
          style={[
            styles.filterBtn,
            {
              backgroundColor: colors.primary,
              borderColor: colors.primary,
              marginTop: spacing.sm,
              alignSelf: "flex-start",
              paddingHorizontal: spacing.lg,
            },
          ]}
          onPress={openCreateModal}
        >
          <Text style={styles.filterBtnPrimaryText}>+ Yeni Kural</Text>
        </Pressable>
      </View>

      <FlatList
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.md }}
        data={filteredRules}
        keyExtractor={(r) => String(r.id)}
        ListEmptyComponent={<EmptyState label="Bakiye yükleme kuralı bulunamadı." />}
        renderItem={({ item }) => {
          const rawItem = item as any;
          const op = item.update_type || rawItem.operation || "add";
          const opText = OPERATION_LABELS[op] || op;
          const perText = PERIOD_LABELS[item.period] || item.period;
          const nextRun = item.next_run || rawItem.next_run_date;

          return (
            <ScreenCard>
              <View style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.ruleCardTitle, { color: colors.textPrimary }]}>{item.name}</Text>
                  <Text style={[styles.ruleDetailText, { color: isDark ? colors.textSecondary : "#64748B" }]}>
                    {opText} · {formatCurrency(item.amount)} · {perText}
                  </Text>
                  <Text style={[styles.ruleDateText, { color: isDark ? colors.textMuted : "#94A3B8" }]}>
                    Sonraki: {formatDate(nextRun)}
                  </Text>
                </View>

                <View
                  style={[
                    styles.webStyleBadge,
                    { backgroundColor: item.is_active ? (isDark ? "#064E3B" : "#ECFDF5") : (isDark ? "#374151" : "#F1F5F9") },
                  ]}
                >
                  <Text
                    style={[
                      styles.webStyleBadgeText,
                      { color: item.is_active ? "#10B981" : isDark ? colors.textMuted : "#64748B" },
                    ]}
                  >
                    {item.is_active ? "Aktif" : "Pasif"}
                  </Text>
                </View>
              </View>

              {/* Web ile Birebir SVG Düzenle ve Sil İkonları */}
              <View style={styles.webActionIconsRow}>
                <TouchableOpacity
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => openEditModal(item)}
                  style={styles.webActionBtn}
                >
                  <EditIcon color={isDark ? colors.textSecondary : "#94A3B8"} />
                </TouchableOpacity>
                <TouchableOpacity
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                  onPress={() => handleDelete(item.id)}
                  style={styles.webActionBtn}
                >
                  <TrashIcon color={isDark ? colors.textSecondary : "#94A3B8"} />
                </TouchableOpacity>
              </View>
            </ScreenCard>
          );
        }}
      />

      <Modal
        visible={createOpen}
        transparent
        animationType="fade"
        onRequestClose={() => {
          setCreateOpen(false);
          setEditItem(null);
        }}
      >
        <Pressable
          style={styles.modalOverlay}
          onPress={() => {
            setCreateOpen(false);
            setEditItem(null);
          }}
        >
          <Pressable style={[styles.formSheetFull, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.webModalTitle, { color: colors.textPrimary }]}>
                {editItem ? "Periyodik Bakiye Yüklemeyi Düzenle" : "Yeni Periyodik Bakiye Yükleme"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setCreateOpen(false);
                  setEditItem(null);
                }}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.closeIconText, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>Ad</Text>
              <TextInput
                style={[
                  styles.webInput,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    color: colors.textPrimary,
                  },
                ]}
                value={name}
                onChangeText={setName}
              />

              <View style={styles.twoColRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>
                    Miktar (₺)
                  </Text>
                  <TextInput
                    style={[
                      styles.webInput,
                      {
                        backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                        color: colors.textPrimary,
                      },
                    ]}
                    value={amount}
                    onChangeText={setAmount}
                    keyboardType="numeric"
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>
                    İşlem Tipi
                  </Text>
                  <Pressable
                    style={[
                      styles.webSelect,
                      {
                        backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                      },
                    ]}
                    onPress={() => setPickerModalType("operation")}
                  >
                    <Text style={[styles.webSelectText, { color: colors.textPrimary }]}>
                      {OPERATION_LABELS[updateType]}
                    </Text>
                    <Text style={[styles.chevronDown, { color: colors.textMuted }]}>⌄</Text>
                  </Pressable>
                </View>
              </View>

              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>
                Hedef Tip
              </Text>
              <Pressable
                style={[
                  styles.webSelect,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                  },
                ]}
                onPress={() => setPickerModalType("targetType")}
              >
                <Text style={[styles.webSelectText, { color: colors.textPrimary }]}>
                  {targetType === "group" ? "Tüm Grup" : "Tekil Kart"}
                </Text>
                <Text style={[styles.chevronDown, { color: colors.textMuted }]}>⌄</Text>
              </Pressable>

              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>
                {targetType === "group" ? "Grup" : "Kart Seç"}
              </Text>
              <Pressable
                style={[
                  styles.webSelect,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                  },
                ]}
                onPress={() => setPickerModalType(targetType === "group" ? "group" : "card")}
              >
                <Text style={[styles.webSelectText, { color: (targetType === "group" ? selectedGroup : selectedCard) ? colors.textPrimary : colors.textMuted }]}>
                  {targetType === "group" ? currentGroupName : currentCardName}
                </Text>
                <Text style={[styles.chevronDown, { color: colors.textMuted }]}>⌄</Text>
              </Pressable>

              <View style={styles.twoColRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>
                    Periyot
                  </Text>
                  <Pressable
                    style={[
                      styles.webSelect,
                      {
                        backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                      },
                    ]}
                    onPress={() => setPickerModalType("period")}
                  >
                    <Text style={[styles.webSelectText, { color: colors.textPrimary }]}>
                      {PERIOD_LABELS[period]}
                    </Text>
                    <Text style={[styles.chevronDown, { color: colors.textMuted }]}>⌄</Text>
                  </Pressable>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>
                    Başlangıç
                  </Text>
                  <View
                    style={[
                      styles.webDateInputWrapper,
                      {
                        backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                      },
                    ]}
                  >
                    <TextInput
                      style={[styles.webDateTextInput, { color: colors.textPrimary }]}
                      value={startDate}
                      onChangeText={setStartDate}
                      placeholder="YYYY-AA-GG"
                      placeholderTextColor={colors.textMuted}
                    />
                    <CalendarIcon color={colors.textMuted} />
                  </View>
                </View>
              </View>

              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>
                Sonraki Çalışma (opsiyonel)
              </Text>
              <View
                style={[
                  styles.webDateInputWrapper,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                  },
                ]}
              >
                <TextInput
                  style={[styles.webDateTextInput, { color: colors.textPrimary }]}
                  value={nextRunDate}
                  onChangeText={setNextRunDate}
                  placeholder="YYYY-AA-GG"
                  placeholderTextColor={colors.textMuted}
                />
                <CalendarIcon color={colors.textMuted} />
              </View>
              <Text style={[styles.fieldHelpText, { color: isDark ? colors.textMuted : "#64748B" }]}>
                Boş bırakılırsa başlangıç tarihine göre otomatik hesaplanır. Seçilen gün 00:00'da (TR) çalışır.
              </Text>

              <TouchableOpacity
                style={styles.checkboxRowWeb}
                onPress={() => setIsActive(!isActive)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.webCheckboxSquare,
                    {
                      backgroundColor: isActive ? "#2563EB" : "transparent",
                      borderColor: isActive ? "#2563EB" : isDark ? colors.border : "#94A3B8",
                    },
                  ]}
                >
                  {isActive && <Text style={styles.webCheckIcon}>✓</Text>}
                </View>
                <Text style={[styles.checkboxLabelWeb, { color: colors.textPrimary }]}>Aktif</Text>
              </TouchableOpacity>

              <View style={styles.modalActionButtonsRow}>
                <TouchableOpacity
                  style={styles.cancelBtnWeb}
                  onPress={() => {
                    setCreateOpen(false);
                    setEditItem(null);
                  }}
                >
                  <Text style={[styles.cancelBtnTextWeb, { color: isDark ? colors.textSecondary : "#475569" }]}>
                    İptal
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtnWeb} onPress={handleSave}>
                  <Text style={styles.submitBtnTextWeb}>{editItem ? "Kaydet" : "Oluştur"}</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={pickerModalType !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerModalType(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPickerModalType(null)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {pickerModalType === "operation" && "İşlem Tipi Seçin"}
              {pickerModalType === "targetType" && "Hedef Tip Seçin"}
              {pickerModalType === "group" && "Grup Seçin"}
              {pickerModalType === "card" && "Kart Seçin"}
              {pickerModalType === "period" && "Periyot Seçin"}
            </Text>

            {pickerModalType === "operation" &&
              (["add", "set"] as const).map((op) => (
                <Pressable
                  key={`op-opt-${op}`}
                  style={[styles.modalOption, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setUpdateType(op);
                    setPickerModalType(null);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>{OPERATION_LABELS[op]}</Text>
                </Pressable>
              ))}

            {pickerModalType === "targetType" && (
              <>
                <Pressable
                  key="target-type-balance-group"
                  style={[styles.modalOption, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setTargetType("group");
                    setPickerModalType(null);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>Tüm Grup</Text>
                </Pressable>
                <Pressable
                  key="target-type-balance-card"
                  style={[styles.modalOption, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setTargetType("card");
                    setPickerModalType(null);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>Tekil Kart</Text>
                </Pressable>
              </>
            )}

            {pickerModalType === "group" &&
              (groupsQuery.data || []).map((g, idx) => (
                <Pressable
                  key={`balance-picker-grp-${g.id}-${idx}`}
                  style={[styles.modalOption, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setSelectedGroup(g.id);
                    setPickerModalType(null);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>{g.name}</Text>
                </Pressable>
              ))}

            {pickerModalType === "card" &&
              (cardsQuery.data?.results || []).map((c: NfcCard, idx: number) => (
                <Pressable
                  key={`balance-picker-card-${c.id}-${idx}`}
                  style={[styles.modalOption, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setSelectedCard(c.id);
                    setPickerModalType(null);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>
                    {c.first_name || c.last_name ? `${c.first_name || ""} ${c.last_name || ""}`.trim() : "İsimsiz Kart"} ({c.uid})
                  </Text>
                </Pressable>
              ))}

            {pickerModalType === "period" &&
              (["daily", "weekly", "monthly"] as const).map((p, idx) => (
                <Pressable
                  key={`balance-period-opt-${p}-${idx}`}
                  style={[styles.modalOption, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setPeriod(p);
                    setPickerModalType(null);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>{PERIOD_LABELS[p]}</Text>
                </Pressable>
              ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ==================== İSTİHKAK YÖNETİMİ ==================== */

function IstihkakYonetimiTab() {
  const { colors, isDark } = useAppTheme();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const [selectedCardId, setSelectedCardId] = useState<number | null>(null);
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [productNo, setProductNo] = useState("*");
  const [quantity, setQuantity] = useState("1");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [isActive, setIsActive] = useState(true);

  const [pickerModalType, setPickerModalType] = useState<"card" | "group" | "period" | null>(null);

  const groupsQuery = useQuery<CardGroup[]>({
    queryKey: ["card-groups"],
    queryFn: () => cardsApi.groups.list(),
  });

  const cardsQuery = useQuery({
    queryKey: ["all-cards-list"],
    queryFn: () => cardsApi.list({ page: 1 }),
  });

  const quotasQuery = useQuery<CardQuota[]>({
    queryKey: ["card-quotas", q],
    queryFn: () => cardsApi.quotas.list({ q }),
  });

  const quotas: CardQuota[] = useMemo(() => {
    const raw = quotasQuery.data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as any).results)) return (raw as any).results;
    return [];
  }, [quotasQuery.data]);

  const filteredQuotas = useMemo(() => {
    if (!q.trim()) return quotas;
    const term = q.trim().toLowerCase();
    return quotas.filter(
      (r: any) =>
        (r.card_uid ?? "").toLowerCase().includes(term) ||
        (r.group_name ?? "").toLowerCase().includes(term)
    );
  }, [quotas, q]);

  const openCreate = () => {
    setSelectedCardId(null);
    setSelectedGroupId(groupsQuery.data?.[0]?.id ?? null);
    setProductNo("*");
    setQuantity("1");
    setPeriod("monthly");
    setIsActive(true);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!selectedGroupId) {
      Alert.alert("Hata", "Lütfen bir grup seçin.");
      return;
    }

    try {
      if (selectedCardId) {
        await cardsApi.quotas.create({
          card: selectedCardId,
          group: selectedGroupId,
          product_no: productNo.trim() || "*",
          quantity: parseInt(quantity, 10) || 1,
          period,
          is_active: isActive,
        });
      } else {
        const cardsInGroup = (cardsQuery.data?.results || []).filter((c: NfcCard) =>
          c.groups?.some((g) => g.id === selectedGroupId)
        );

        if (cardsInGroup.length === 0) {
          Alert.alert("Bilgi", "Seçilen grupta aktif kart bulunamadı.");
          return;
        }

        for (const card of cardsInGroup) {
          await cardsApi.quotas.create({
            card: card.id,
            group: selectedGroupId,
            product_no: productNo.trim() || "*",
            quantity: parseInt(quantity, 10) || 1,
            period,
            is_active: isActive,
          });
        }
      }

      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["card-quotas"] });
    } catch (e: any) {
      const errorMsg = e.response?.data?.detail || e.message || "Kota oluşturulamadı.";
      Alert.alert("Hata", errorMsg);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert("Kotayı Sil", "Bu kota tanımını silmek istediğinizden emin misiniz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await cardsApi.quotas.remove(id);
            queryClient.invalidateQueries({ queryKey: ["card-quotas"] });
          } catch (e) {
            Alert.alert("Hata", (e as Error).message);
          }
        },
      },
    ]);
  };

  const currentSelectedCardText = selectedCardId
    ? `${cardsQuery.data?.results?.find((c: NfcCard) => c.id === selectedCardId)?.first_name || ""} (${cardsQuery.data?.results?.find((c: NfcCard) => c.id === selectedCardId)?.uid})`
    : "Gruptaki tüm kartlar";

  const currentSelectedGroupText =
    groupsQuery.data?.find((g) => g.id === selectedGroupId)?.name || "Grup seçin";

  if (quotasQuery.isLoading) return <LoadingView label="Kotalar yükleniyor..." />;
  if (quotasQuery.error)
    return <ErrorView message={(quotasQuery.error as Error).message} onRetry={quotasQuery.refetch} />;

  return (
    <View style={styles.tabFlex}>
      <View style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: isDark ? colors.border : "#E2E8F0" }]}>
        <Text style={[styles.filterLabel, { color: colors.textMuted }]}>KART UID, İSİM, GRUP...</Text>
        <TextInput
          style={[
            styles.search,
            {
              backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
              borderColor: isDark ? colors.border : "#CBD5E1",
              color: colors.textPrimary,
            },
          ]}
          placeholder="Kart UID, isim, grup..."
          placeholderTextColor={colors.textMuted}
          value={q}
          onChangeText={setQ}
        />
        <Pressable
          style={[
            styles.filterBtn,
            {
              backgroundColor: colors.primary,
              borderColor: colors.primary,
              marginTop: spacing.sm,
              alignSelf: "flex-start",
              paddingHorizontal: spacing.lg,
            },
          ]}
          onPress={openCreate}
        >
          <Text style={styles.filterBtnPrimaryText}>+ Yeni Kota</Text>
        </Pressable>
      </View>

      <FlatList
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.sm }}
        data={filteredQuotas}
        keyExtractor={(r: any) => String(r.id)}
        ListEmptyComponent={<EmptyState label="Kota tanımı bulunamadı." />}
        renderItem={({ item }: { item: any }) => (
          <ScreenCard>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.groupCardTitle, { color: colors.textPrimary }]}>
                  {item.card_uid ? `Kart (${item.card_uid})` : `Kart #${item.card}`}
                </Text>
                <Text style={[styles.mutedText, { color: colors.textSecondary, marginTop: 2 }]}>
                  {item.group_name ? `Grup: ${item.group_name} · ` : ""}Ürün: {item.product_no} · {item.quantity} Adet · {PERIOD_LABELS[item.period] ?? item.period}
                </Text>
              </View>
              <Badge label={item.is_active ? "Aktif" : "Pasif"} tone={item.is_active ? "success" : "muted"} />
            </View>
            <View style={[styles.cardActionsRow, { borderTopColor: colors.border }]}>
              <Pressable style={styles.smallLink} onPress={() => handleDelete(item.id)}>
                <Text style={[styles.smallLinkText, { color: colors.danger }]}>Sil</Text>
              </Pressable>
            </View>
          </ScreenCard>
        )}
      />

      <Modal
        visible={createOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCreateOpen(false)}>
          <Pressable style={[styles.formSheetFull, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.webModalTitle, { color: colors.textPrimary }]}>Yeni Kota Tanımı</Text>
              <TouchableOpacity onPress={() => setCreateOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[styles.closeIconText, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>
                Kart <Text style={{ fontWeight: "400", color: colors.textMuted }}>(opsiyonel)</Text>
              </Text>
              <Pressable
                style={[
                  styles.webSelect,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                  },
                ]}
                onPress={() => setPickerModalType("card")}
              >
                <Text style={[styles.webSelectText, { color: colors.textPrimary }]}>
                  {currentSelectedCardText}
                </Text>
                <Text style={[styles.chevronDown, { color: colors.textMuted }]}>⌄</Text>
              </Pressable>
              <Text style={[styles.fieldHelpText, { color: isDark ? colors.textMuted : "#64748B" }]}>
                Boş bırakılırsa kota, seçilen gruptaki tüm aktif kartlara uygulanır.
              </Text>

              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155", marginTop: 14 }]}>
                Grup <Text style={{ color: "#DC2626" }}>*</Text>
              </Text>
              <Pressable
                style={[
                  styles.webSelect,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                  },
                ]}
                onPress={() => setPickerModalType("group")}
              >
                <Text style={[styles.webSelectText, { color: selectedGroupId ? colors.textPrimary : colors.textMuted }]}>
                  {currentSelectedGroupText}
                </Text>
                <Text style={[styles.chevronDown, { color: colors.textMuted }]}>⌄</Text>
              </Pressable>

              <View style={[styles.twoColRow, { marginTop: 4 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>
                    Ürün No
                  </Text>
                  <TextInput
                    style={[
                      styles.webInput,
                      {
                        backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                        color: colors.textPrimary,
                      },
                    ]}
                    value={productNo}
                    onChangeText={setProductNo}
                  />
                  <Text style={[styles.fieldHelpText, { color: isDark ? colors.textMuted : "#64748B" }]}>
                    "*" = tüm ürünler · "1,2,3" virgüllü · "20-40" aralık · karışık ("1,5-7") da olur
                  </Text>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>
                    Miktar
                  </Text>
                  <TextInput
                    style={[
                      styles.webInput,
                      {
                        backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                        color: colors.textPrimary,
                      },
                    ]}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155", marginTop: 14 }]}>
                Periyot
              </Text>
              <Pressable
                style={[
                  styles.webSelect,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                  },
                ]}
                onPress={() => setPickerModalType("period")}
              >
                <Text style={[styles.webSelectText, { color: colors.textPrimary }]}>
                  {PERIOD_LABELS[period]}
                </Text>
                <Text style={[styles.chevronDown, { color: colors.textMuted }]}>⌄</Text>
              </Pressable>

              <TouchableOpacity
                style={styles.checkboxRowWeb}
                onPress={() => setIsActive(!isActive)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.webCheckboxSquare,
                    {
                      backgroundColor: isActive ? "#2563EB" : "transparent",
                      borderColor: isActive ? "#2563EB" : isDark ? colors.border : "#94A3B8",
                    },
                  ]}
                >
                  {isActive && <Text style={styles.webCheckIcon}>✓</Text>}
                </View>
                <Text style={[styles.checkboxLabelWeb, { color: colors.textPrimary }]}>Aktif</Text>
              </TouchableOpacity>

              <View style={styles.modalActionButtonsRow}>
                <TouchableOpacity style={styles.cancelBtnWeb} onPress={() => setCreateOpen(false)}>
                  <Text style={[styles.cancelBtnTextWeb, { color: isDark ? colors.textSecondary : "#475569" }]}>
                    İptal
                  </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtnWeb} onPress={handleCreate}>
                  <Text style={styles.submitBtnTextWeb}>Oluştur</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={pickerModalType !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerModalType(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPickerModalType(null)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {pickerModalType === "card" && "Kart Seçin"}
              {pickerModalType === "group" && "Grup Seçin"}
              {pickerModalType === "period" && "Periyot Seçin"}
            </Text>

            {pickerModalType === "card" && (
              <>
                <Pressable
                  key="quota-all-cards-in-group"
                  style={[styles.modalOption, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setSelectedCardId(null);
                    setPickerModalType(null);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: colors.textPrimary, fontWeight: "600" }]}>
                    Gruptaki tüm kartlar
                  </Text>
                </Pressable>
                {(cardsQuery.data?.results || []).map((c: NfcCard, idx: number) => (
                  <Pressable
                    key={`quota-card-opt-${c.id}-${idx}`}
                    style={[styles.modalOption, { borderBottomColor: colors.border }]}
                    onPress={() => {
                      setSelectedCardId(c.id);
                      setPickerModalType(null);
                    }}
                  >
                    <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>
                      {c.first_name || c.last_name ? `${c.first_name || ""} ${c.last_name || ""}`.trim() : "İsimsiz Kart"} ({c.uid})
                    </Text>
                  </Pressable>
                ))}
              </>
            )}

            {pickerModalType === "group" &&
              (groupsQuery.data || []).map((g, idx) => (
                <Pressable
                  key={`quota-grp-opt-${g.id}-${idx}`}
                  style={[styles.modalOption, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setSelectedGroupId(g.id);
                    setPickerModalType(null);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>{g.name}</Text>
                </Pressable>
              ))}

            {pickerModalType === "period" &&
              (["daily", "weekly", "monthly"] as const).map((p, idx) => (
                <Pressable
                  key={`quota-period-opt-${p}-${idx}`}
                  style={[styles.modalOption, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setPeriod(p);
                    setPickerModalType(null);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>{PERIOD_LABELS[p]}</Text>
                </Pressable>
              ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

/* ==================== İSTİHKAK YENİLEME ==================== */

function IstihkakYenilemeTab() {
  const { colors, isDark } = useAppTheme();
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [createOpen, setCreateOpen] = useState(false);

  const [name, setName] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<number | null>(null);
  const [targetType, setTargetType] = useState<"group" | "card">("group");
  const [selectedCard, setSelectedCard] = useState<number | null>(null);
  const [productNo, setProductNo] = useState("*");
  const [quantity, setQuantity] = useState("1");
  const [period, setPeriod] = useState<"daily" | "weekly" | "monthly">("monthly");
  const [startDate, setStartDate] = useState(new Date().toISOString().split("T")[0]);
  const [nextRunDate, setNextRunDate] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);

  const [pickerModalType, setPickerModalType] = useState<"group" | "targetType" | "period" | "card" | null>(null);

  const groupsQuery = useQuery<CardGroup[]>({
    queryKey: ["card-groups"],
    queryFn: () => cardsApi.groups.list(),
  });

  const cardsQuery = useQuery({
    queryKey: ["all-cards-list"],
    queryFn: () => cardsApi.list({ page: 1 }),
  });

  const rulesQuery = useQuery<RecurringQuotaRule[]>({
    queryKey: ["recurring-quota", q],
    queryFn: () => cardsApi.recurringQuota.list({ q }),
  });

  const rules: RecurringQuotaRule[] = useMemo(() => {
    const raw = rulesQuery.data;
    if (!raw) return [];
    if (Array.isArray(raw)) return raw;
    if (Array.isArray((raw as any).results)) return (raw as any).results;
    return [];
  }, [rulesQuery.data]);

  const filteredRules = useMemo(() => {
    if (!q.trim()) return rules;
    const term = q.trim().toLowerCase();
    return rules.filter(
      (r) =>
        (r.name ?? "").toLowerCase().includes(term) ||
        (r.group_name ?? "").toLowerCase().includes(term) ||
        (r.target_card_uid ?? "").toLowerCase().includes(term)
    );
  }, [rules, q]);

  const openCreate = () => {
    setName("");
    setSelectedGroup(groupsQuery.data?.[0]?.id ?? null);
    setTargetType("group");
    setSelectedCard(null);
    setProductNo("*");
    setQuantity("1");
    setPeriod("monthly");
    setStartDate(new Date().toISOString().split("T")[0]);
    setNextRunDate("");
    setDescription("");
    setIsActive(true);
    setCreateOpen(true);
  };

  const handleCreate = async () => {
    if (!name.trim()) {
      Alert.alert("Hata", "Ad alanı zorunludur.");
      return;
    }
    if (!selectedGroup) {
      Alert.alert("Hata", "Lütfen bir grup seçin.");
      return;
    }
    if (targetType === "card" && !selectedCard) {
      Alert.alert("Hata", "Lütfen bir kart seçin.");
      return;
    }

    try {
      await cardsApi.recurringQuota.create({
        name: name.trim(),
        group: selectedGroup,
        product_no: productNo.trim() || "*",
        quantity: parseInt(quantity, 10) || 1,
        period,
        target_type: targetType,
        target_card: targetType === "card" ? selectedCard : null,
        start_date: startDate,
        description: description.trim() || undefined,
        is_active: isActive,
      });
      setCreateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["recurring-quota"] });
    } catch (e) {
      Alert.alert("Hata", (e as Error).message);
    }
  };

  const handleDelete = (id: number) => {
    Alert.alert("Kuralı Sil", "Bu istihkak yenileme kuralını silmek istediğinizden emin misiniz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await cardsApi.recurringQuota.remove(id);
            queryClient.invalidateQueries({ queryKey: ["recurring-quota"] });
          } catch (e) {
            Alert.alert("Hata", (e as Error).message);
          }
        },
      },
    ]);
  };

  const currentGroupName = groupsQuery.data?.find((g) => g.id === selectedGroup)?.name || "Grup seç...";
  const currentCardName =
    cardsQuery.data?.results?.find((c: NfcCard) => c.id === selectedCard)
      ? `${cardsQuery.data.results.find((c: NfcCard) => c.id === selectedCard)?.first_name || ""} (${cardsQuery.data.results.find((c: NfcCard) => c.id === selectedCard)?.uid})`
      : "Kart seç...";

  if (rulesQuery.isLoading) return <LoadingView label="Kurallar yükleniyor..." />;
  if (rulesQuery.error)
    return <ErrorView message={(rulesQuery.error as Error).message} onRetry={rulesQuery.refetch} />;

  return (
    <View style={styles.tabFlex}>
      <View style={[styles.filterCard, { backgroundColor: colors.surface, borderColor: isDark ? colors.border : "#E2E8F0" }]}>
        <Text style={[styles.filterLabel, { color: colors.textMuted }]}>İSİM, KART UID, GRUP...</Text>
        <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.xs }}>
          <TextInput
            style={[
              styles.search,
              {
                flex: 1,
                marginTop: 0,
                backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                borderColor: isDark ? colors.border : "#CBD5E1",
                color: colors.textPrimary,
              },
            ]}
            placeholder="İsim, kart UID, grup..."
            placeholderTextColor={colors.textMuted}
            value={q}
            onChangeText={setQ}
          />
          <Pressable
            style={[
              styles.filterBtn,
              {
                backgroundColor: colors.primary,
                borderColor: colors.primary,
                flexGrow: 0,
                paddingHorizontal: spacing.lg,
              },
            ]}
            onPress={() => rulesQuery.refetch()}
          >
            <Text style={styles.filterBtnPrimaryText}>Ara</Text>
          </Pressable>
        </View>
        <Pressable
          style={[
            styles.filterBtn,
            {
              backgroundColor: colors.primary,
              borderColor: colors.primary,
              marginTop: spacing.sm,
              alignSelf: "flex-start",
              paddingHorizontal: spacing.lg,
            },
          ]}
          onPress={openCreate}
        >
          <Text style={styles.filterBtnPrimaryText}>+ Yeni Kural</Text>
        </Pressable>
      </View>

      <FlatList
        contentContainerStyle={{ padding: spacing.lg, paddingTop: 0, gap: spacing.sm }}
        data={filteredRules}
        keyExtractor={(r: any) => String(r.id)}
        ListEmptyComponent={<EmptyState label="Periyodik kota yenilemesi bulunamadı." />}
        renderItem={({ item }: { item: any }) => (
          <ScreenCard>
            <View style={styles.rowBetween}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.groupCardTitle, { color: colors.textPrimary }]}>{item.name}</Text>
                <Text style={[styles.mutedText, { color: colors.textSecondary, marginTop: 2 }]}>
                  {item.group_name ? `Grup: ${item.group_name}` : `Kart #${item.target_card_uid || item.target_card}`} · {item.quantity} Adet · {PERIOD_LABELS[item.period] ?? item.period}
                </Text>
                <Text style={[styles.mutedText, { color: colors.textMuted, marginTop: 2 }]}>Sonraki: {formatDate(item.next_run)}</Text>
              </View>
              <Badge label={item.is_active ? "Aktif" : "Pasif"} tone={item.is_active ? "success" : "muted"} />
            </View>
            <View style={[styles.cardActionsRow, { borderTopColor: colors.border }]}>
              <Pressable style={styles.smallLink} onPress={() => handleDelete(item.id)}>
                <Text style={[styles.smallLinkText, { color: colors.danger }]}>Sil</Text>
              </Pressable>
            </View>
          </ScreenCard>
        )}
      />

      <Modal visible={createOpen} transparent animationType="fade" onRequestClose={() => setCreateOpen(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setCreateOpen(false)}>
          <Pressable style={[styles.formSheetFull, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.webModalTitle, { color: colors.textPrimary }]}>Yeni Periyodik Kota Yenileme</Text>
              <TouchableOpacity onPress={() => setCreateOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[styles.closeIconText, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>Ad</Text>
              <TextInput
                style={[
                  styles.webInput,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    color: colors.textPrimary,
                  },
                ]}
                value={name}
                onChangeText={setName}
              />

              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>Grup</Text>
              <Pressable
                style={[
                  styles.webSelect,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                  },
                ]}
                onPress={() => setPickerModalType("group")}
              >
                <Text style={[styles.webSelectText, { color: selectedGroup ? colors.textPrimary : colors.textMuted }]}>
                  {currentGroupName}
                </Text>
                <Text style={[styles.chevronDown, { color: colors.textMuted }]}>⌄</Text>
              </Pressable>

              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>Hedef Tip</Text>
              <Pressable
                style={[
                  styles.webSelect,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                  },
                ]}
                onPress={() => setPickerModalType("targetType")}
              >
                <Text style={[styles.webSelectText, { color: colors.textPrimary }]}>
                  {targetType === "group" ? "Tüm Grup" : "Tekil Kart"}
                </Text>
                <Text style={[styles.chevronDown, { color: colors.textMuted }]}>⌄</Text>
              </Pressable>

              {targetType === "card" && (
                <>
                  <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>Kart Seç</Text>
                  <Pressable
                    style={[
                      styles.webSelect,
                      {
                        backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                      },
                    ]}
                    onPress={() => setPickerModalType("card")}
                  >
                    <Text style={[styles.webSelectText, { color: selectedCard ? colors.textPrimary : colors.textMuted }]}>
                      {currentCardName}
                    </Text>
                    <Text style={[styles.chevronDown, { color: colors.textMuted }]}>⌄</Text>
                  </Pressable>
                </>
              )}

              <View style={styles.twoColRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>Ürün No</Text>
                  <TextInput
                    style={[
                      styles.webInput,
                      {
                        backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                        color: colors.textPrimary,
                      },
                    ]}
                    value={productNo}
                    onChangeText={setProductNo}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>Miktar</Text>
                  <TextInput
                    style={[
                      styles.webInput,
                      {
                        backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                        color: colors.textPrimary,
                      },
                    ]}
                    value={quantity}
                    onChangeText={setQuantity}
                    keyboardType="numeric"
                  />
                </View>
              </View>

              <View style={styles.twoColRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>Periyot</Text>
                  <Pressable
                    style={[
                      styles.webSelect,
                      {
                        backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                      },
                    ]}
                    onPress={() => setPickerModalType("period")}
                  >
                    <Text style={[styles.webSelectText, { color: colors.textPrimary }]}>
                      {PERIOD_LABELS[period]}
                    </Text>
                    <Text style={[styles.chevronDown, { color: colors.textMuted }]}>⌄</Text>
                  </Pressable>
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>Başlangıç</Text>
                  <View
                    style={[
                      styles.webDateInputWrapper,
                      {
                        backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                      },
                    ]}
                  >
                    <TextInput
                      style={[styles.webDateTextInput, { color: colors.textPrimary }]}
                      value={startDate}
                      onChangeText={setStartDate}
                      placeholder="YYYY-AA-GG"
                      placeholderTextColor={colors.textMuted}
                    />
                    <CalendarIcon color={colors.textMuted} />
                  </View>
                </View>
              </View>

              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>
                Sonraki Çalışma (opsiyonel)
              </Text>
              <View
                style={[
                  styles.webDateInputWrapper,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                  },
                ]}
              >
                <TextInput
                  style={[styles.webDateTextInput, { color: colors.textPrimary }]}
                  value={nextRunDate}
                  onChangeText={setNextRunDate}
                  placeholder="YYYY-AA-GG"
                  placeholderTextColor={colors.textMuted}
                />
                <CalendarIcon color={colors.textMuted} />
              </View>
              <Text style={[styles.fieldHelpText, { color: isDark ? colors.textMuted : "#64748B" }]}>
                Boş bırakılırsa başlangıç tarihine göre otomatik hesaplanır. Seçilen gün 00:00'da (TR) çalışır.
              </Text>

              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>Açıklama</Text>
              <TextInput
                style={[
                  styles.webTextArea,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    color: colors.textPrimary,
                  },
                ]}
                value={description}
                onChangeText={setDescription}
                multiline
                numberOfLines={3}
              />

              <TouchableOpacity
                style={styles.checkboxRowWeb}
                onPress={() => setIsActive(!isActive)}
                activeOpacity={0.8}
              >
                <View
                  style={[
                    styles.webCheckboxSquare,
                    {
                      backgroundColor: isActive ? "#2563EB" : "transparent",
                      borderColor: isActive ? "#2563EB" : isDark ? colors.border : "#94A3B8",
                    },
                  ]}
                >
                  {isActive && <Text style={styles.webCheckIcon}>✓</Text>}
                </View>
                <Text style={[styles.checkboxLabelWeb, { color: colors.textPrimary }]}>Aktif</Text>
              </TouchableOpacity>

              <View style={styles.modalActionButtonsRow}>
                <TouchableOpacity style={styles.cancelBtnWeb} onPress={() => setCreateOpen(false)}>
                  <Text style={[styles.cancelBtnTextWeb, { color: isDark ? colors.textSecondary : "#475569" }]}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtnWeb} onPress={handleCreate}>
                  <Text style={styles.submitBtnTextWeb}>Oluştur</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      <Modal
        visible={pickerModalType !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setPickerModalType(null)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setPickerModalType(null)}>
          <View style={[styles.modalSheet, { backgroundColor: colors.surface }]}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>
              {pickerModalType === "group" && "Grup Seçin"}
              {pickerModalType === "targetType" && "Hedef Tip Seçin"}
              {pickerModalType === "period" && "Periyot Seçin"}
              {pickerModalType === "card" && "Kart Seçin"}
            </Text>

            {pickerModalType === "group" &&
              (groupsQuery.data || []).map((g, idx) => (
                <Pressable
                  key={`picker-grp-${g.id}-${idx}`}
                  style={[styles.modalOption, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setSelectedGroup(g.id);
                    setPickerModalType(null);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>{g.name}</Text>
                </Pressable>
              ))}

            {pickerModalType === "targetType" && (
              <>
                <Pressable
                  key="target-type-group"
                  style={[styles.modalOption, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setTargetType("group");
                    setPickerModalType(null);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>Tüm Grup</Text>
                </Pressable>
                <Pressable
                  key="target-type-card"
                  style={[styles.modalOption, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setTargetType("card");
                    setPickerModalType(null);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>Tekil Kart</Text>
                </Pressable>
              </>
            )}

            {pickerModalType === "period" &&
              (["daily", "weekly", "monthly"] as const).map((p, idx) => (
                <Pressable
                  key={`period-opt-${p}-${idx}`}
                  style={[styles.modalOption, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setPeriod(p);
                    setPickerModalType(null);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>{PERIOD_LABELS[p]}</Text>
                </Pressable>
              ))}

            {pickerModalType === "card" &&
              (cardsQuery.data?.results || []).map((c: NfcCard, idx: number) => (
                <Pressable
                  key={`picker-card-${c.id}-${idx}`}
                  style={[styles.modalOption, { borderBottomColor: colors.border }]}
                  onPress={() => {
                    setSelectedCard(c.id);
                    setPickerModalType(null);
                  }}
                >
                  <Text style={[styles.modalOptionText, { color: colors.textPrimary }]}>
                    {c.first_name || c.last_name ? `${c.first_name || ""} ${c.last_name || ""}`.trim() : "İsimsiz Kart"} ({c.uid})
                  </Text>
                </Pressable>
              ))}
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  tabFlex: { flex: 1 },

  topTabsScroll: { flexGrow: 0, borderBottomWidth: 1 },
  topTabsContent: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.md },
  topTab: { paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: "transparent" },
  topTabText: { fontSize: 13, fontWeight: "600" },
  topTabTextActive: { fontWeight: "700" },

  headerWrapper: {
    gap: spacing.sm,
    marginBottom: spacing.xs,
  },
  filterCard: {
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
  },
  groupSearchRow: {
    flexDirection: "row",
    gap: spacing.sm,
    alignItems: "center",
  },
  filterLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  search: {
    marginTop: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
  },
  groupSelect: {
    marginTop: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  groupSelectText: { fontSize: 13 },
  filterButtonsRow: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.md, flexWrap: "wrap" },
  filterBtn: {
    flexGrow: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  filterBtnText: { fontWeight: "600", fontSize: 13 },
  filterBtnPrimaryText: { color: "#fff", fontWeight: "600", fontSize: 13 },

  tabs: { flexDirection: "row", gap: spacing.sm },
  tab: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  tabText: { fontWeight: "600", fontSize: 13 },
  tabTextActive: { color: "#fff" },

  selectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  selectionLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
  },
  selectionTitle: {
    fontSize: 13,
    fontWeight: "600",
  },
  selectAllLink: {
    fontSize: 12,
    fontWeight: "700",
  },

  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  itemCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 12,
    gap: 8,
  },
  cardHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    flex: 1,
  },
  nameBlock: {
    flex: 1,
  },
  cardFullName: {
    fontSize: 15,
    fontWeight: "700",
  },
  cardUid: {
    fontSize: 11,
    marginTop: 1,
  },

  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 5,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkMark: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
    marginTop: -1,
  },

  actionsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  pendingActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  actionBtnText: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionDot: {
    fontSize: 10,
    color: "#94A3B8",
  },

  cardDivider: {
    height: 1,
    width: "100%",
  },

  cardDetailsRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: 8,
  },
  infoCol: {
    flex: 1,
    gap: 3,
  },
  fieldLabel: {
    fontSize: 9,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  balanceValue: {
    fontSize: 13,
    fontWeight: "700",
  },
  groupPillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 4,
  },
  groupPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 999,
  },
  groupPillText: {
    fontSize: 11,
    fontWeight: "500",
  },
  emptyGroupText: {
    fontSize: 12,
  },

  footerLoader: {
    paddingVertical: spacing.md,
    alignItems: "center",
    justifyContent: "center",
  },

  mutedText: { fontSize: 12 },
  groupCardTitle: { fontWeight: "700", fontSize: 16 },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  moreButton: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  moreIcon: {
    fontSize: 18,
    fontWeight: "700",
  },
  linkedDevicesContainer: {
    marginTop: spacing.md,
    gap: 6,
  },
  linkedDevicesTitle: {
    fontSize: 12,
    fontWeight: "600",
  },
  devicePillsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 2,
  },
  devicePill: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
  },
  devicePillText: {
    fontSize: 12,
    fontWeight: "500",
  },

  ruleCardTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  ruleDetailText: {
    fontSize: 13,
    marginTop: 4,
    fontWeight: "500",
  },
  ruleDateText: {
    fontSize: 12,
    marginTop: 3,
  },
  webStyleBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
  },
  webStyleBadgeText: {
    fontSize: 12,
    fontWeight: "600",
  },
  webActionIconsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
    marginTop: spacing.sm,
  },
  webActionBtn: {
    padding: 6,
  },

  cardActionsRow: { flexDirection: "row", gap: spacing.lg, marginTop: spacing.md, borderTopWidth: 1, paddingTop: spacing.sm },
  smallLink: {},
  smallLinkText: { fontSize: 12, fontWeight: "600" },
  formSheet: { borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: spacing.lg, maxHeight: "85%" },

  formSheetFull: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    maxHeight: "90%",
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  webModalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  closeIconText: {
    fontSize: 18,
    fontWeight: "600",
  },
  inputLabelWeb: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 12,
    marginBottom: 6,
  },
  webInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  webSelect: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  webSelectText: {
    fontSize: 14,
  },
  chevronDown: {
    fontSize: 14,
  },
  twoColRow: {
    flexDirection: "row",
    gap: 12,
  },
  webDateInputWrapper: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: 44,
  },
  webDateTextInput: {
    flex: 1,
    fontSize: 14,
    paddingVertical: 0,
  },
  fieldHelpText: {
    fontSize: 11,
    marginTop: 4,
    lineHeight: 15,
  },
  webTextArea: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 14,
    minHeight: 70,
    textAlignVertical: "top",
  },
  checkboxRowWeb: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 16,
    marginBottom: 8,
  },
  webCheckboxSquare: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  webCheckIcon: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  checkboxLabelWeb: {
    fontSize: 14,
    fontWeight: "500",
  },
  modalActionButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
  },
  cancelBtnWeb: {
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  cancelBtnTextWeb: {
    fontSize: 14,
    fontWeight: "600",
  },
  submitBtnWeb: {
    backgroundColor: "#2563EB",
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  submitBtnTextWeb: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "600",
  },

  webGroupsBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    gap: 10,
    marginTop: 2,
  },
  groupCheckboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  deviceCheckboxRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
  groupCheckboxLabel: {
    fontSize: 14,
    fontWeight: "500",
  },

  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  modalSheet: {
    borderTopLeftRadius: radius.lg,
    borderTopRightRadius: radius.lg,
    padding: spacing.lg,
    maxHeight: "60%",
  },
  modalTitle: { fontSize: 16, fontWeight: "700", marginBottom: spacing.sm },
  modalOption: { paddingVertical: spacing.sm, borderBottomWidth: 1 },
  modalOptionText: { fontSize: 15 },
});