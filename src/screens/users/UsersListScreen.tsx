import React, { useMemo, useState } from "react";
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
import Svg, { Path } from "react-native-svg";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/api/users";
import { useAppTheme } from "@/theme/colors";
import { radius, spacing } from "@/theme/spacing";
import { Button, EmptyState, ErrorView, LoadingView, ScreenCard } from "@/components/Common";
import type { AssignableOptions, StaffUser } from "@/types/users";

/* ==================== SVG İKONLAR ==================== */

function UserPlusIcon({ color = "#FFFFFF" }: { color?: string }) {
  return (
    <Svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <Path
        d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M8.5 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M20 8v6M23 11h-6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

const GROUP_LABEL_MAP: Record<string, string> = {
  tech_stock: "Stok Yönetimi",
  tech_sales: "Satış Görüntüleme",
  tech_settings: "Cihaz Ayarları",
  tech_cards: "Personel Kart",
};

export default function UsersListScreen() {
  const { colors, isDark } = useAppTheme();
  const queryClient = useQueryClient();

  // Şifre Sıfırlama State'leri
  const [resetTarget, setResetTarget] = useState<StaffUser | null>(null);
  const [newPassword, setNewPassword] = useState("");

  // Teknisyen Ekleme Modalı State'leri
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const [deviceSearch, setDeviceSearch] = useState("");
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<Set<number>>(new Set());
  const [selectedGroupNames, setSelectedGroupNames] = useState<Set<string>>(new Set());
  const [selectedStockLocationIds, setSelectedStockLocationIds] = useState<Set<number>>(new Set());

  // Backend Listesi
  const { data, isLoading, error, refetch } = useQuery({
    queryKey: ["staff-users"],
    queryFn: () => usersApi.list(1),
  });

  // Teknisyen Ekleme İçin Seçenekler (Cihazlar, Gruplar, Stok Lokasyonları)
  const optionsQuery = useQuery<AssignableOptions>({
    queryKey: ["staff-assignable-options"],
    queryFn: () => usersApi.assignableOptions(),
    enabled: createModalOpen,
  });

  const assignable = optionsQuery.data;

  // Şifre Sıfırlama Mutasyonu
  const resetPasswordMutation = useMutation({
    mutationFn: ({ id, password }: { id: number; password: string }) =>
      usersApi.resetPassword(id, password),
    onSuccess: () => {
      Alert.alert("Başarılı", "Şifre sıfırlandı.");
      setResetTarget(null);
      setNewPassword("");
    },
    onError: (e) => Alert.alert("Hata", (e as Error).message),
  });

  // Silme Mutasyonu
  const removeMutation = useMutation({
    mutationFn: (id: number) => usersApi.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["staff-users"] }),
    onError: (e) => Alert.alert("Hata", (e as Error).message),
  });

  // Teknisyen Oluşturma Mutasyonu
  const createMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["staff-users"] });
      setCreateModalOpen(false);
      resetCreateForm();
      Alert.alert("Başarılı", "Teknisyen kullanıcısı oluşturuldu.");
    },
    onError: (e: any) => {
      const msg = e?.response?.data?.detail || (e as Error).message || "Kullanıcı oluşturulamadı.";
      Alert.alert("Hata", msg);
    },
  });

  const resetCreateForm = () => {
    setFirstName("");
    setLastName("");
    setUsername("");
    setPassword("");
    setEmail("");
    setPhone("");
    setDeviceSearch("");
    setSelectedDeviceIds(new Set());
    setSelectedGroupNames(new Set());
    setSelectedStockLocationIds(new Set());
  };

  const openCreateModal = () => {
    resetCreateForm();
    setCreateModalOpen(true);
  };

  const handleCreateSubmit = () => {
    if (!username.trim()) {
      Alert.alert("Eksik Bilgi", "Kullanıcı adı zorunludur.");
      return;
    }
    if (!password.trim() || password.length < 6) {
      Alert.alert("Eksik Bilgi", "Şifre en az 6 karakter olmalıdır.");
      return;
    }

    createMutation.mutate({
      username: username.trim(),
      password: password.trim(),
      first_name: firstName.trim(),
      last_name: lastName.trim(),
      email: email.trim() || undefined,
      phone: phone.trim() || undefined,
      pos_device_ids: Array.from(selectedDeviceIds),
      group_names: Array.from(selectedGroupNames),
      default_stock_location_ids: Array.from(selectedStockLocationIds),
    });
  };

  const submitResetPassword = () => {
    if (!resetTarget) return;
    if (newPassword.length < 6) {
      Alert.alert("Geçersiz şifre", "Şifre en az 6 karakter olmalı.");
      return;
    }
    resetPasswordMutation.mutate({ id: resetTarget.id, password: newPassword });
  };

  const handleRemove = (user: StaffUser) => {
    Alert.alert(
      "Kullanıcıyı Sil",
      `"${user.username}" kullanıcısını silmek istediğinize emin misiniz?`,
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Sil",
          style: "destructive",
          onPress: () => removeMutation.mutate(user.id),
        },
      ]
    );
  };

  // Cihaz Seçim Yardımcıları
  const filteredDevices = useMemo(() => {
    if (!assignable?.pos_devices) return [];
    if (!deviceSearch.trim()) return assignable.pos_devices;
    const term = deviceSearch.toLowerCase();
    return assignable.pos_devices.filter(
      (d) =>
        d.sn.toLowerCase().includes(term) ||
        d.pos_name.toLowerCase().includes(term) ||
        (d.company_name && d.company_name.toLowerCase().includes(term))
    );
  }, [assignable?.pos_devices, deviceSearch]);

  const toggleDevice = (id: number) => {
    setSelectedDeviceIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleGroup = (name: string) => {
    setSelectedGroupNames((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const toggleStockLoc = (id: number) => {
    setSelectedStockLocationIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) return <LoadingView label="Kullanıcılar yükleniyor..." />;
  if (error) return <ErrorView message={(error as Error).message} onRetry={refetch} />;

  return (
    <View style={[styles.container, { backgroundColor: isDark ? colors.bg : "#F8FAFC" }]}>
      <FlatList
        contentContainerStyle={styles.listContent}
        data={data?.results ?? []}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={
          <View style={{ gap: spacing.sm, marginBottom: spacing.xs }}>
            {/* Üst Kısım: Açıklama ve Teknisyen Ekle Butonu */}
            <View style={styles.topBarRow}>
              <Text style={[styles.headerNote, { color: colors.textMuted, flex: 1 }]}>
                Bu liste yalnızca sizin şirketinize atadığınız personel/teknisyen hesaplarını gösterir.
              </Text>
              <TouchableOpacity
                style={[styles.addTechBtn, { backgroundColor: colors.primary }]}
                onPress={openCreateModal}
                activeOpacity={0.8}
              >
                <UserPlusIcon color="#FFFFFF" />
                <Text style={styles.addTechBtnText}>Teknisyen Ekle</Text>
              </TouchableOpacity>
            </View>
          </View>
        }
        ListEmptyComponent={<EmptyState label="Henüz personel kullanıcı eklenmedi" />}
        renderItem={({ item }) => {
          const displayName =
            item.first_name || item.last_name
              ? `${item.first_name ?? ""} ${item.last_name ?? ""}`.trim()
              : item.username;

          const userEmail = (item as any).email || null;
          const userPhone = (item as any).phone || null;
          const stockLocations = item.default_stock_location_ids?.length ?? (item as any).default_stock_locations?.length ?? 1;

          return (
            <View
              style={[
                styles.card,
                {
                  backgroundColor: colors.surface,
                  borderColor: isDark ? colors.border : "#E2E8F0",
                },
              ]}
            >
              {/* Başlık: Ad Soyad, Kullanıcı Adı ve İşlemler */}
              <View style={styles.cardHeader}>
                <View style={styles.userInfo}>
                  <Text style={[styles.name, { color: colors.textPrimary }]}>{displayName}</Text>
                  <Text style={[styles.username, { color: colors.textMuted }]}>@{item.username}</Text>
                </View>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    onPress={() => {
                      setNewPassword("");
                      setResetTarget(item);
                    }}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.actionPassword}>Şifre</Text>
                  </TouchableOpacity>

                  <Text style={styles.actionDivider}>•</Text>

                  <TouchableOpacity
                    onPress={() => handleRemove(item)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Text style={styles.actionDelete}>Sil</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={[styles.divider, { backgroundColor: isDark ? colors.border : "#F1F5F9" }]} />

              <View style={styles.detailsContainer}>
                {userEmail || userPhone ? (
                  <View style={styles.infoRow}>
                    {userEmail ? (
                      <View style={styles.infoCol}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>E-POSTA</Text>
                        <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>{userEmail}</Text>
                      </View>
                    ) : null}
                    {userPhone ? (
                      <View style={styles.infoCol}>
                        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>TELEFON</Text>
                        <Text style={[styles.fieldValue, { color: colors.textPrimary }]}>{userPhone}</Text>
                      </View>
                    ) : null}
                  </View>
                ) : null}

                <View style={styles.infoRow}>
                  <View style={styles.infoCol}>
                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>ERİŞİLEN CİHAZLAR</Text>
                    <View style={styles.deviceBadge}>
                      <Text style={styles.deviceBadgeText}>{item.pos_device_count ?? 0} cihaz</Text>
                    </View>
                  </View>

                  <View style={styles.infoCol}>
                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>STOK LOKASYONLARI</Text>
                    <View style={styles.stockBadge}>
                      <Text style={styles.stockBadgeText}>{stockLocations} lokasyon</Text>
                    </View>
                  </View>
                </View>

                {item.group_names && item.group_names.length > 0 && (
                  <View style={styles.groupSection}>
                    <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>GRUP İZİNLERİ</Text>
                    <View style={styles.groupBadgeContainer}>
                      {item.group_names.map((group) => {
                        const label = GROUP_LABEL_MAP[group] || group;
                        return (
                          <View
                            key={group}
                            style={[
                              styles.groupBadge,
                              { backgroundColor: isDark ? colors.surfaceAlt : "#F1F5F9" },
                            ]}
                          >
                            <Text style={[styles.groupBadgeText, { color: isDark ? colors.textPrimary : "#475569" }]}>
                              {label}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                )}
              </View>
            </View>
          );
        }}
      />

      {/* Web ile Birebir Yeni Teknisyen Ekle Modalı */}
      <Modal
        visible={createModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCreateModalOpen(false)}
      >
        <Pressable style={styles.modalOverlay} onPress={() => setCreateModalOpen(false)}>
          <Pressable
            style={[styles.formSheetFull, { backgroundColor: colors.surface }]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeaderRow}>
              <Text style={[styles.webModalTitle, { color: colors.textPrimary }]}>Yeni Teknisyen</Text>
              <TouchableOpacity onPress={() => setCreateModalOpen(false)} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                <Text style={[styles.closeIconText, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 24 }}>
              {/* AD & SOYAD (Yan Yana) */}
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
                    placeholder="Ali"
                    placeholderTextColor={colors.textMuted}
                    value={firstName}
                    onChangeText={setFirstName}
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
                    placeholder="Yılmaz"
                    placeholderTextColor={colors.textMuted}
                    value={lastName}
                    onChangeText={setLastName}
                  />
                </View>
              </View>

              {/* KULLANICI ADI */}
              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>
                KULLANICI ADI <Text style={{ color: "#DC2626" }}>*</Text>
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
                placeholder="serpetotadmin"
                placeholderTextColor={colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
              />

              {/* ŞİFRE */}
              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>
                ŞİFRE <Text style={{ color: "#DC2626" }}>*</Text>
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
                placeholder="••••••••••••"
                placeholderTextColor={colors.textMuted}
                secureTextEntry
                value={password}
                onChangeText={setPassword}
              />

              {/* E-POSTA & TELEFON (Yan Yana) */}
              <View style={styles.twoColRow}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>E-POSTA</Text>
                  <TextInput
                    style={[
                      styles.webInput,
                      {
                        backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                        color: colors.textPrimary,
                      },
                    ]}
                    placeholder="ali@example.com"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    value={email}
                    onChangeText={setEmail}
                  />
                </View>

                <View style={{ flex: 1 }}>
                  <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155" }]}>TELEFON</Text>
                  <TextInput
                    style={[
                      styles.webInput,
                      {
                        backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                        borderColor: isDark ? colors.border : "#CBD5E1",
                        color: colors.textPrimary,
                      },
                    ]}
                    placeholder="05xx xxx xx xx"
                    placeholderTextColor={colors.textMuted}
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                  />
                </View>
              </View>

              {/* ERİŞİM İZNİ VERİLECEK CİHAZLAR */}
              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155", marginTop: 16 }]}>
                ERİŞİM İZNİ VERİLECEK CİHAZLAR
              </Text>
              
              <TextInput
                style={[
                  styles.webInput,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    color: colors.textPrimary,
                    marginBottom: 8,
                  },
                ]}
                placeholder="Cihaz ara..."
                placeholderTextColor={colors.textMuted}
                value={deviceSearch}
                onChangeText={setDeviceSearch}
              />

              <View
                style={[
                  styles.webGroupsBox,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    maxHeight: 180,
                  },
                ]}
              >
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {optionsQuery.isLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ padding: 10 }} />
                  ) : filteredDevices.length > 0 ? (
                    filteredDevices.map((d) => {
                      const isChecked = selectedDeviceIds.has(d.id);
                      return (
                        <TouchableOpacity
                          key={`dev-${d.id}`}
                          style={styles.checkboxRowItem}
                          onPress={() => toggleDevice(d.id)}
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
                          <Text style={[styles.checkboxLabelText, { color: colors.textPrimary }]} numberOfLines={1}>
                            {d.pos_name} {d.company_name ? `· ${d.company_name}` : ""} ({d.sn})
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={[styles.emptyGroupText, { color: colors.textMuted }]}>Cihaz bulunamadı.</Text>
                  )}
                </ScrollView>
              </View>

              {/* GRUP İZİNLERİ */}
              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155", marginTop: 16 }]}>
                GRUP İZİNLERİ
              </Text>
              <View
                style={[
                  styles.webGroupsBox,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                  },
                ]}
              >
                {optionsQuery.isLoading ? (
                  <ActivityIndicator size="small" color={colors.primary} style={{ padding: 10 }} />
                ) : (assignable?.available_groups ?? ["tech_cards", "tech_sales", "tech_stock", "tech_settings"]).map((gName) => {
                  const isChecked = selectedGroupNames.has(gName);
                  const label = GROUP_LABEL_MAP[gName] || gName;
                  return (
                    <TouchableOpacity
                      key={`grp-${gName}`}
                      style={styles.checkboxRowItem}
                      onPress={() => toggleGroup(gName)}
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
                      <Text style={[styles.checkboxLabelText, { color: colors.textPrimary }]}>{label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* VARSAYILAN STOK LOKASYONLARI */}
              <Text style={[styles.inputLabelWeb, { color: isDark ? colors.textSecondary : "#334155", marginTop: 16 }]}>
                VARSAYILAN STOK LOKASYONLARI
              </Text>
              <View
                style={[
                  styles.webGroupsBox,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                    maxHeight: 180,
                  },
                ]}
              >
                <ScrollView nestedScrollEnabled showsVerticalScrollIndicator={false}>
                  {optionsQuery.isLoading ? (
                    <ActivityIndicator size="small" color={colors.primary} style={{ padding: 10 }} />
                  ) : (assignable?.stock_locations ?? []).length > 0 ? (
                    assignable!.stock_locations.map((loc) => {
                      const isChecked = selectedStockLocationIds.has(loc.id);
                      return (
                        <TouchableOpacity
                          key={`loc-${loc.id}`}
                          style={styles.checkboxRowItem}
                          onPress={() => toggleStockLoc(loc.id)}
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
                          <Text style={[styles.checkboxLabelText, { color: colors.textPrimary }]}>
                            {loc.name} <Text style={{ color: colors.textMuted }}>· {loc.location_type}</Text>
                          </Text>
                        </TouchableOpacity>
                      );
                    })
                  ) : (
                    <Text style={[styles.emptyGroupText, { color: colors.textMuted }]}>Stok lokasyonu bulunamadı.</Text>
                  )}
                </ScrollView>
              </View>
              <Text style={[styles.fieldHelpText, { color: isDark ? colors.textMuted : "#64748B" }]}>
                Tech kullanıcısının dolum yaparken seçebileceği kaynak lokasyonlar (Stok Yönetimi grubu için anlamlıdır).
              </Text>

              {/* Alt Butonlar */}
              <View style={styles.modalActionButtonsRow}>
                <TouchableOpacity style={styles.cancelBtnWeb} onPress={() => setCreateModalOpen(false)}>
                  <Text style={[styles.cancelBtnTextWeb, { color: isDark ? colors.textSecondary : "#475569" }]}>İptal</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.submitBtnWeb} onPress={handleCreateSubmit} disabled={createMutation.isPending}>
                  <Text style={styles.submitBtnTextWeb}>
                    {createMutation.isPending ? "Oluşturuluyor..." : "Oluştur"}
                  </Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>

      {/* Şifre Sıfırlama Modalı */}
      <Modal
        visible={!!resetTarget}
        transparent
        animationType="fade"
        onRequestClose={() => setResetTarget(null)}
      >
        <View style={styles.modalOverlay}>
          <ScreenCard style={styles.modalCard}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Şifre Sıfırla</Text>
            <Text style={[styles.modalSubtext, { color: colors.textMuted }]}>
              {resetTarget?.username} için yeni şifre belirleyin
            </Text>
            <TextInput
              style={[
                styles.modalInput,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#F1F5F9",
                  borderColor: colors.border,
                  color: colors.textPrimary,
                },
              ]}
              placeholder="Yeni şifre (en az 6 karakter)"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              value={newPassword}
              onChangeText={setNewPassword}
              autoFocus
            />
            <View style={styles.modalButtons}>
              <View style={{ flex: 1 }}>
                <Button title="Vazgeç" variant="secondary" onPress={() => setResetTarget(null)} />
              </View>
              <View style={{ flex: 1 }}>
                <Button title="Sıfırla" onPress={submitResetPassword} loading={resetPasswordMutation.isPending} />
              </View>
            </View>
          </ScreenCard>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  listContent: {
    padding: spacing.md,
    gap: spacing.sm,
  },
  topBarRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  headerNote: {
    fontSize: 12,
    lineHeight: 16,
  },
  addTechBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: radius.sm,
  },
  addTechBtnText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: 14,
    gap: 10,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  userInfo: {
    flex: 1,
    marginRight: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: "700",
  },
  username: {
    fontSize: 13,
    marginTop: 2,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 2,
  },
  actionPassword: {
    fontSize: 13,
    fontWeight: "600",
    color: "#D97706",
  },
  actionDelete: {
    fontSize: 13,
    fontWeight: "600",
    color: "#DC2626",
  },
  actionDivider: {
    fontSize: 10,
    color: "#94A3B8",
  },
  divider: {
    height: 1,
    width: "100%",
  },
  detailsContainer: {
    gap: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 16,
  },
  infoCol: {
    alignItems: "flex-start",
    gap: 4,
  },
  fieldLabel: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  fieldValue: {
    fontSize: 13,
    fontWeight: "500",
  },
  deviceBadge: {
    backgroundColor: "#E0F2FE",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  deviceBadgeText: {
    color: "#0284C7",
    fontSize: 12,
    fontWeight: "600",
  },
  stockBadge: {
    backgroundColor: "#FEF3C7",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  stockBadgeText: {
    color: "#D97706",
    fontSize: 12,
    fontWeight: "600",
  },
  groupSection: {
    gap: 6,
  },
  groupBadgeContainer: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
  },
  groupBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  groupBadgeText: {
    fontSize: 12,
    fontWeight: "500",
  },

  /* Web Birebir Modal Stilleri */
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  formSheetFull: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 20,
    maxHeight: "92%",
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
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
    marginTop: 10,
    marginBottom: 5,
  },
  webInput: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    fontSize: 13,
  },
  twoColRow: {
    flexDirection: "row",
    gap: 12,
  },
  webGroupsBox: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 10,
  },
  checkboxRowItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 5,
  },
  webCheckboxSquare: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  webCheckIcon: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "900",
  },
  checkboxLabelText: {
    fontSize: 13,
    fontWeight: "500",
    flex: 1,
  },
  emptyGroupText: {
    fontSize: 12,
    paddingVertical: 4,
  },
  fieldHelpText: {
    fontSize: 11,
    marginTop: 6,
    lineHeight: 15,
  },
  modalActionButtonsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 12,
    marginTop: 20,
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

  /* Şifre Sıfırla Modalı */
  modalCard: {
    gap: spacing.xs,
  },
  modalTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  modalSubtext: {
    fontSize: 13,
    marginBottom: spacing.xs,
  },
  modalInput: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 14,
  },
  modalButtons: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.md,
  },
});