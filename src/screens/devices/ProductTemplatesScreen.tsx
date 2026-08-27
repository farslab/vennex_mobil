import React, { useEffect, useState } from "react";
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
import Svg, { Path, Line } from "react-native-svg";
import { useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { templatesApi, type ProductTemplate, type ProductTemplateItem } from "@/api/templates";
import { devicesApi } from "@/api/devices";
import { useAppTheme } from "@/theme/colors";
import { spacing, radius } from "@/theme/spacing";
import { EmptyState, ErrorView, LoadingView } from "@/components/Common";

function formatCurrency(n: number | string | null | undefined) {
  if (n == null) return "—";
  const num = typeof n === "string" ? parseFloat(n) : n;
  if (Number.isNaN(num)) return "—";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(num);
}

function normalizeMachineType(t: any): number {
  if (t === 1 || t === "1" || t === true) return 1;
  if (t === 0 || t === "0" || t === false) return 0;
  if (typeof t === "string") {
    const s = t.toLowerCase().trim();
    if (s.includes("kahve") || s.includes("coffee") || s.includes("hot")) return 1;
    if (s.includes("snack") || s.includes("cold") || s.includes("otomat")) return 0;
  }
  return 0;
}

function machineTypeLabel(t: 0 | 1 | number) {
  return normalizeMachineType(t) === 1 ? "Kahve" : "Snack";
}

function machineTypeColors(t: 0 | 1 | number, isDark: boolean) {
  return normalizeMachineType(t) === 1
    ? { bg: isDark ? "#78350F" : "#FEF3C7", text: isDark ? "#FDE68A" : "#D97706" }
    : { bg: isDark ? "#1E3A8A" : "#E0F2FE", text: isDark ? "#93C5FD" : "#0284C7" };
}

/* ==================== SVG İKONLAR ==================== */

function WebEditProductsIcon({ color = "#334155" }: { color?: string }) {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <Line x1="4" y1="6" x2="20" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="4" y1="12" x2="20" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="4" y1="18" x2="20" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function WebEditNameIcon({ color = "#334155" }: { color?: string }) {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <Path
        d="M12 20h9"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function WebTrashIcon({ color = "#EF4444" }: { color?: string }) {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 6h18"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export default function ProductTemplatesScreen() {
  const { colors, isDark } = useAppTheme();
  const queryClient = useQueryClient();
  const navigation = useNavigation<any>();
  const templatesQuery = useQuery({ queryKey: ["product-templates"], queryFn: templatesApi.list });

  const [createOpen, setCreateOpen] = useState(false);
  const [editTemplate, setEditTemplate] = useState<ProductTemplate | null>(null);
  const [assignTemplate, setAssignTemplate] = useState<ProductTemplate | null>(null);

  const [formName, setFormName] = useState("");
  const [formDescription, setFormDescription] = useState("");
  const [formMachineType, setFormMachineType] = useState<0 | 1>(0);

  const openCreate = () => {
    setFormName("");
    setFormDescription("");
    setFormMachineType(0);
    setCreateOpen(true);
  };

  const openEdit = (t: ProductTemplate) => {
    setFormName(t.name);
    setFormDescription(t.description ?? "");
    setFormMachineType(t.machine_type);
    setEditTemplate(t);
  };

  const handleCloseModal = () => {
    setCreateOpen(false);
    setEditTemplate(null);
  };

  const handleCreate = async () => {
    if (!formName.trim()) {
      Alert.alert("Hata", "Şablon adı gerekli");
      return;
    }
    try {
      await templatesApi.create({
        name: formName.trim(),
        description: formDescription.trim(),
        machine_type: formMachineType,
      });
      handleCloseModal();
      queryClient.invalidateQueries({ queryKey: ["product-templates"] });
    } catch (e) {
      Alert.alert("Hata", (e as Error).message);
    }
  };

  const handleEditSave = async () => {
    if (!editTemplate || !formName.trim()) return;
    try {
      await templatesApi.update(editTemplate.id, {
        name: formName.trim(),
        description: formDescription.trim(),
        machine_type: formMachineType,
      });
      handleCloseModal();
      queryClient.invalidateQueries({ queryKey: ["product-templates"] });
    } catch (e) {
      Alert.alert("Hata", (e as Error).message);
    }
  };

  const handleDelete = (t: ProductTemplate) => {
    Alert.alert("Şablonu Sil", `"${t.name}" şablonunu silmek istediğinizden emin misiniz?`, [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: async () => {
          try {
            await templatesApi.remove(t.id);
            queryClient.invalidateQueries({ queryKey: ["product-templates"] });
          } catch (e) {
            Alert.alert("Hata", (e as Error).message);
          }
        },
      },
    ]);
  };

  const handleEditProducts = (t: ProductTemplate) => {
    try {
      navigation.navigate("TemplateProductsEdit", {
        templateId: t.id,
        title: t.name,
      });
    } catch {
      navigation.navigate("Devices", {
        screen: "TemplateProductsEdit",
        params: { templateId: t.id, title: t.name },
      });
    }
  };

  if (templatesQuery.isLoading) return <LoadingView label="Şablonlar yükleniyor..." />;
  if (templatesQuery.error)
    return <ErrorView message={(templatesQuery.error as Error).message} onRetry={templatesQuery.refetch} />;

  const templates = templatesQuery.data ?? [];

  return (
    <View style={[styles.flex, { backgroundColor: isDark ? colors.bg : "#F8FAFC" }]}>
      <View style={styles.actionBar}>
        <Pressable style={[styles.primaryBtn, { backgroundColor: colors.primary }]} onPress={openCreate}>
          <Text style={styles.primaryBtnText}>+ Yeni Şablon</Text>
        </Pressable>
      </View>

      <FlatList
        contentContainerStyle={{ padding: spacing.md, paddingTop: 0, gap: spacing.md }}
        data={templates}
        keyExtractor={(t, idx) => `tpl-${t.id ?? idx}-${idx}`}
        ListEmptyComponent={<EmptyState label="Şablon bulunamadı" />}
        renderItem={({ item, index }) => (
          <ProductTemplateCard
            key={`template-card-${item.id ?? index}-${index}`}
            item={item}
            colors={colors}
            isDark={isDark}
            onEditName={() => openEdit(item)}
            onEditProducts={() => handleEditProducts(item)}
            onDelete={() => handleDelete(item)}
            onAssign={() => setAssignTemplate(item)}
          />
        )}
      />

      {/* Yeni Şablon / Düzenle Modalı */}
      <Modal
        visible={createOpen || editTemplate != null}
        transparent
        animationType="fade"
        onRequestClose={handleCloseModal}
      >
        <View style={styles.modalBackdrop}>
          <View
            style={[
              styles.webModalCard,
              {
                backgroundColor: colors.surface,
                borderColor: isDark ? colors.border : "#E2E8F0",
              },
            ]}
          >
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitleText, { color: colors.textPrimary }]}>
                {editTemplate ? "Şablon Adı Düzenle" : "Yeni Ürün Şablonu"}
              </Text>
              <TouchableOpacity
                onPress={handleCloseModal}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.modalCloseIcon, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ gap: 14 }}>
              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  ŞABLON ADI <Text style={styles.requiredStar}>*</Text>
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
                  value={formName}
                  onChangeText={setFormName}
                  placeholder="örn. Kış Sezonu"
                  placeholderTextColor={colors.textMuted}
                  autoFocus
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>AÇIKLAMA</Text>
                <TextInput
                  style={[
                    styles.webInput,
                    styles.webTextarea,
                    {
                      backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                      borderColor: isDark ? colors.border : "#CBD5E1",
                      color: colors.textPrimary,
                    },
                  ]}
                  value={formDescription}
                  onChangeText={setFormDescription}
                  placeholder="İsteğe bağlı..."
                  placeholderTextColor={colors.textMuted}
                  multiline
                  textAlignVertical="top"
                />
              </View>

              <View style={styles.inputGroup}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>
                  MAKİNE TİPİ <Text style={styles.requiredStar}>*</Text>
                </Text>
                <View style={styles.radioRow}>
                  <TouchableOpacity
                    style={[
                      styles.radioCard,
                      {
                        backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                        borderColor:
                          formMachineType === 0
                            ? colors.primary
                            : isDark
                            ? colors.border
                            : "#CBD5E1",
                      },
                    ]}
                    onPress={() => setFormMachineType(0)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        { borderColor: formMachineType === 0 ? colors.primary : "#94A3B8" },
                      ]}
                    >
                      {formMachineType === 0 && (
                        <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                      )}
                    </View>
                    <Text style={[styles.radioText, { color: colors.textPrimary }]}>Snack</Text>
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.radioCard,
                      {
                        backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                        borderColor:
                          formMachineType === 1
                            ? colors.primary
                            : isDark
                            ? colors.border
                            : "#CBD5E1",
                      },
                    ]}
                    onPress={() => setFormMachineType(1)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[
                        styles.radioOuter,
                        { borderColor: formMachineType === 1 ? colors.primary : "#94A3B8" },
                      ]}
                    >
                      {formMachineType === 1 && (
                        <View style={[styles.radioInner, { backgroundColor: colors.primary }]} />
                      )}
                    </View>
                    <Text style={[styles.radioText, { color: colors.textPrimary }]}>Kahve</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.infoNotes}>
                <Text style={[styles.infoText, { color: colors.textMuted }]}>
                  Şablon yalnızca aynı tipteki cihazlara eşlenebilir. Bileşen düzeni sadece kahve şablonlarında tanımlanır.
                </Text>
                <Text style={[styles.infoText, { color: colors.textMuted, marginTop: 4 }]}>
                  Oluşturduktan sonra ürün ekleyebilirsiniz.
                </Text>
              </View>
            </ScrollView>

            <View style={styles.modalActionsRow}>
              <TouchableOpacity
                style={[
                  styles.cancelBtn,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                  },
                ]}
                onPress={handleCloseModal}
              >
                <Text style={[styles.cancelBtnText, { color: colors.textPrimary }]}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.submitBtn, { backgroundColor: colors.primary }]}
                onPress={editTemplate ? handleEditSave : handleCreate}
              >
                <Text style={styles.submitBtnText}>
                  {editTemplate ? "Kaydet" : "Oluştur"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Cihazlara Eşle Modalı */}
      {assignTemplate && (
        <AssignDevicesModal
          template={assignTemplate}
          onClose={() => setAssignTemplate(null)}
          onDone={() => {
            setAssignTemplate(null);
            queryClient.invalidateQueries({ queryKey: ["product-templates"] });
          }}
        />
      )}
    </View>
  );
}

function ProductTemplateCard({
  item,
  colors,
  isDark,
  onEditName,
  onEditProducts,
  onDelete,
  onAssign,
}: {
  item: ProductTemplate;
  colors: any;
  isDark: boolean;
  onEditName: () => void;
  onEditProducts: () => void;
  onDelete: () => void;
  onAssign: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const tc = machineTypeColors(item.machine_type, isDark);

  const detailQuery = useQuery({
    queryKey: ["product-template-detail", item.id],
    queryFn: () => templatesApi.detail(item.id),
    staleTime: 60_000,
  });

  const detailData = detailQuery.data;
  const rawItems: ProductTemplateItem[] =
    detailData?.items ??
    (item as any).items ??
    (item as any).template_items ??
    [];
  const hasItems = rawItems.length > 0;

  const assignedCount =
    detailData?.assigned_devices?.length ??
    item.assigned_device_count ??
    (item as any).assigned_devices?.length ??
    0;

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
      {/* Kart Üst Başlık ve 3 Nokta Butonu */}
      <View style={styles.cardTopArea}>
        <View style={{ flex: 1, paddingRight: 8 }}>
          <View style={styles.titleRow}>
            <Text style={[styles.title, { color: colors.textPrimary }]} numberOfLines={1}>
              {item.name}
            </Text>
            <View style={[styles.typePill, { backgroundColor: tc.bg }]}>
              <Text style={[styles.typePillText, { color: tc.text }]}>
                {machineTypeLabel(item.machine_type)}
              </Text>
            </View>
          </View>

          {!!item.description && (
            <Text style={[styles.description, { color: colors.textMuted }]} numberOfLines={2}>
              {item.description}
            </Text>
          )}

          <Text style={[styles.metaText, { color: colors.textMuted }]}>
            {item.item_count ?? rawItems.length ?? 0} ürün ·{" "}
            {item.created_at ? new Date(item.created_at).toLocaleDateString("tr-TR") : "—"}
          </Text>

          {assignedCount > 0 && (
            <View
              style={[
                styles.assignedBadge,
                { backgroundColor: isDark ? "#2E1065" : "#F3EAFE" },
              ]}
            >
              <Text
                style={[
                  styles.assignedBadgeText,
                  { color: isDark ? "#D8B4FE" : "#6B3AA8" },
                ]}
              >
                🔗 {assignedCount} cihaz eşli
              </Text>
            </View>
          )}
        </View>

        {/* 3 Nokta Buton Alanı */}
        <View style={{ position: "relative" }}>
          <TouchableOpacity
            style={[
              styles.moreButton,
              {
                backgroundColor: isDark ? "#1E293B" : "#F1F5F9",
              },
            ]}
            onPress={() => setMenuOpen((prev) => !prev)}
            activeOpacity={0.7}
          >
            <Text style={[styles.moreButtonText, { color: colors.textSecondary }]}>⋮</Text>
          </TouchableOpacity>

          {/* Web Tarzı Açılır Dropdown Menü */}
          {menuOpen && (
            <>
              <TouchableOpacity
                style={styles.dropdownBackdrop}
                activeOpacity={1}
                onPress={() => setMenuOpen(false)}
              />

              <View
                style={[
                  styles.webDropdownMenu,
                  {
                    backgroundColor: colors.surface,
                    borderColor: isDark ? colors.border : "#E2E8F0",
                  },
                ]}
              >
                {/* 1. Ürünleri Düzenle */}
                <TouchableOpacity
                  style={styles.dropdownMenuItem}
                  onPress={() => {
                    setMenuOpen(false);
                    setTimeout(() => onEditProducts(), 50);
                  }}
                  activeOpacity={0.6}
                >
                  <WebEditProductsIcon color={colors.textPrimary} />
                  <Text style={[styles.dropdownItemText, { color: colors.textPrimary }]}>
                    Ürünleri Düzenle
                  </Text>
                </TouchableOpacity>

                {/* 2. Şablon Adı Düzenle */}
                <TouchableOpacity
                  style={styles.dropdownMenuItem}
                  onPress={() => {
                    setMenuOpen(false);
                    onEditName();
                  }}
                  activeOpacity={0.6}
                >
                  <WebEditNameIcon color={colors.textPrimary} />
                  <Text style={[styles.dropdownItemText, { color: colors.textPrimary }]}>
                    Şablon Adı Düzenle
                  </Text>
                </TouchableOpacity>

                {/* 3. Sil */}
                <TouchableOpacity
                  style={[styles.dropdownMenuItem, styles.dropdownItemDelete]}
                  onPress={() => {
                    setMenuOpen(false);
                    onDelete();
                  }}
                  activeOpacity={0.6}
                >
                  <WebTrashIcon color="#EF4444" />
                  <Text style={[styles.dropdownItemText, { color: "#EF4444", fontWeight: "600" }]}>
                    Sil
                  </Text>
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>

      {/* Web Tarzı Ürün Listesi */}
      {hasItems && (
        <View style={styles.itemsSection}>
          <View
            style={[
              styles.divider,
              { backgroundColor: isDark ? colors.border : "#F1F5F9" },
            ]}
          />
          <View style={styles.itemsBox}>
            {rawItems.map((it, i) => {
              const orderNum = it.urun_no ?? it.order ?? i;
              const displayName = it.name || it.stock_sku_name || "Ürün";
              return (
                <View
                  key={`tpl-item-${it.id ?? it.urun_no ?? i}-${i}`}
                  style={styles.itemRow}
                >
                  <Text
                    style={[styles.itemName, { color: colors.textSecondary }]}
                    numberOfLines={1}
                  >
                    {orderNum}. {displayName}
                  </Text>
                  <Text style={[styles.itemPrice, { color: colors.textPrimary }]}>
                    {formatCurrency(it.price)}
                  </Text>
                </View>
              );
            })}
          </View>
        </View>
      )}

      {/* Cihazlara Eşle Butonu */}
      <View style={styles.assignBtnWrapper}>
        <TouchableOpacity
          style={[
            styles.assignBtn,
            {
              backgroundColor: isDark ? "#2E1065" : "#F3EAFE",
            },
          ]}
          onPress={onAssign}
          activeOpacity={0.8}
        >
          <Text style={[styles.assignBtnText, { color: isDark ? "#D8B4FE" : "#6B3AA8" }]}>
            🔗  Cihazlara Eşle
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

function AssignDevicesModal({
  template,
  onClose,
  onDone,
}: {
  template: ProductTemplate;
  onClose: () => void;
  onDone: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [submitting, setSubmitting] = useState(false);

  // Şirket cihazlarını çek (/pos-devices/). Şirket tek olduğu için
  // (bkz. AuthUser.companies) `GET /pos-devices/` zaten yalnızca bu
  // şirketin cihazlarını döner — ayrıca company_id filtresine gerek yok.
  const devicesQuery = useQuery({
    queryKey: ["devices-for-assign"],
    queryFn: () => devicesApi.list({ page: 1, page_size: 100 }),
  });

  const allDevices: any[] = devicesQuery.data?.results ?? [];

  const tplMachineType = normalizeMachineType(template.machine_type);

  // Makine tipi eşleşmesi için backend gerçeği: ProductTemplate.machine_type,
  // cihazın `pos_odemetip` alanından türetiliyor (bkz. pos_device_list /
  // save_pos_products_as_template). `GET /pos-devices/` LİSTE endpoint'i
  // (POSDeviceListSerializer) bu alanı döndürmüyor — yalnızca
  // `GET /pos-devices/{sn}/` DETAY endpoint'i (POSDeviceDetailSerializer)
  // içeriyor. Backend değiştirilemediği için, şirketteki her cihaz için
  // paralel detay çağrısı yapıp gerçek `pos_odemetip` değerini buradan
  // okuyoruz — `act_macstat` artık kullanılmıyor (garanti aynı kodlamayı
  // paylaştığı doğrulanmadı).
  const deviceDetailQueries = useQueries({
    queries: allDevices.map((d: any) => ({
      queryKey: ["device-detail-for-assign", d.sn],
      queryFn: () => devicesApi.detail(d.sn),
      enabled: !!d.sn,
      staleTime: 5 * 60_000,
    })),
  });

  const detailsLoading = allDevices.length > 0 && deviceDetailQueries.some((q) => q.isLoading);

  // sn -> pos_odemetip haritası (detay sorgularından)
  const posOdemetipBySn: Record<string, number | null> = {};
  allDevices.forEach((d: any, idx: number) => {
    const detail = deviceDetailQueries[idx]?.data as any;
    posOdemetipBySn[d.sn] = detail?.pos_odemetip ?? null;
  });

  // Web ile birebir filtreleme: yalnızca gerçek `pos_odemetip` şablonun
  // `machine_type`'ıyla eşleşen cihazlar listelenir.
  const filteredDevices = allDevices.filter((d: any) => {
    const pos_odemetip = posOdemetipBySn[d.sn];
    if (pos_odemetip == null) return false;
    return normalizeMachineType(pos_odemetip) === tplMachineType;
  });

  useEffect(() => {
    if (filteredDevices.length > 0) {
      const initialSelected = new Set<string>();
      filteredDevices.forEach((d: any) => {
        // Cihaza atanmış şablon ID'si
        const assignedId =
          d.product_template?.id ??
          d.product_template_id ??
          d.product_template ??
          d.template_id ??
          d.template?.id;

        if (assignedId != null && String(assignedId) === String(template.id)) {
          initialSelected.add(d.sn);
        }
      });
      setSelected(initialSelected);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [devicesQuery.data, detailsLoading, template.id, tplMachineType]);

  const toggle = (sn: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sn)) next.delete(sn);
      else next.add(sn);
      return next;
    });
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const snList = Array.from(selected);

      // 1. Eğer templatesApi'de assign varsa onu çağır
      if ((templatesApi as any).assignDevices) {
        await (templatesApi as any).assignDevices(template.id, snList);
      } else {
        // 2. Her cihaz için tek tek assignTemplate çağrısı yap
        await Promise.all(
          filteredDevices.map(async (d: any) => {
            const isCurrentlyAssigned =
              String(d.product_template?.id ?? d.product_template_id ?? d.template_id) ===
              String(template.id);
            const isSelectedNow = selected.has(d.sn);

            if (isSelectedNow && !isCurrentlyAssigned) {
              await devicesApi.assignTemplate(d.sn, template.id);
            } else if (!isSelectedNow && isCurrentlyAssigned) {
              await devicesApi.unassignTemplate(d.sn);
            }
          })
        );
      }

      Alert.alert("Başarılı", "Cihaz eşleme ayarları güncellendi.");
      onDone();
    } catch (e) {
      Alert.alert("Hata", (e as Error).message);
    } finally {
      setSubmitting(false);
    }
  };

  const isCoffee = tplMachineType === 1;
  const isLoading = devicesQuery.isLoading || detailsLoading;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.assignModalCard,
            {
              backgroundColor: colors.surface,
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={[styles.assignTitleText, { color: colors.textPrimary }]}>
                Cihazlara Eşle
              </Text>
              <Text style={[styles.assignSubTitle, { color: colors.textMuted }]}>
                {template.name}
              </Text>
            </View>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Text style={[styles.modalCloseIcon, { color: colors.textMuted }]}>✕</Text>
            </TouchableOpacity>
          </View>

          {/* Web Bilgi Metni */}
          <Text style={[styles.assignInfoParagraph, { color: colors.textSecondary }]}>
            İlk eşlemede cihazların ürün/slot tanımları şablondan baştan oluşturulur ve{" "}
            <Text style={{ fontWeight: "700", color: colors.textPrimary }}>mevcut stok sıfırlanır</Text>
            . Sonraki şablon değişiklikleri otomatik yansır ve{" "}
            <Text style={{ fontWeight: "700", color: colors.textPrimary }}>stok korunur</Text>.
          </Text>

          {/* Cihaz Listesi Container */}
          {isLoading ? (
            <View style={{ paddingVertical: spacing.xl }}>
              <LoadingView label="Cihazlar yükleniyor..." />
            </View>
          ) : (
            <View
              style={[
                styles.devicesListContainer,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: isDark ? colors.border : "#E2E8F0",
                },
              ]}
            >
              <ScrollView style={{ maxHeight: 200 }} nestedScrollEnabled showsVerticalScrollIndicator={false}>
                {filteredDevices.length === 0 ? (
                  <View style={{ padding: spacing.md, alignItems: "center" }}>
                    <Text style={{ color: colors.textMuted, fontSize: 12 }}>
                      Bu tipe uygun şirket cihazı bulunamadı.
                    </Text>
                  </View>
                ) : (
                  filteredDevices.map((d: any, idx: number) => {
                    const isChecked = selected.has(d.sn);
                    const currentTemplateName =
                      d.product_template?.name ??
                      d.product_template_name ??
                      d.template_name ??
                      d.template?.name;

                    return (
                      <Pressable
                        key={`assign-dev-${d.sn ?? idx}-${idx}`}
                        style={[
                          styles.deviceCheckRow,
                          idx !== filteredDevices.length - 1 && [
                            styles.deviceRowDivider,
                            { borderBottomColor: isDark ? colors.border : "#F1F5F9" },
                          ],
                        ]}
                        onPress={() => toggle(d.sn)}
                      >
                        <View
                          style={[
                            styles.checkbox,
                            isChecked && {
                              backgroundColor: "#6B3AA8",
                              borderColor: "#6B3AA8",
                            },
                          ]}
                        >
                          {isChecked && <Text style={styles.checkboxMark}>✓</Text>}
                        </View>
                        <View style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}>
                          <Text
                            style={[styles.deviceCheckText, { color: colors.textPrimary }]}
                            numberOfLines={1}
                          >
                            {d.pos_name || d.name || "POS Cihazı"}
                          </Text>
                          {!!currentTemplateName && (
                            <Text style={styles.currentTemplateTag} numberOfLines={1}>
                              [{currentTemplateName}]
                            </Text>
                          )}
                        </View>
                      </Pressable>
                    );
                  })
                )}
              </ScrollView>
            </View>
          )}

          {/* Alt Bilgilendirme */}
          <Text style={[styles.assignFooterNote, { color: colors.textMuted }]}>
            Yalnızca <Text style={{ fontWeight: "700", color: isCoffee ? "#D97706" : "#0284C7" }}>{machineTypeLabel(template.machine_type)}</Text> tipindeki cihazlar listelenir.
          </Text>

          {/* Alt Butonlar */}
          <View style={styles.assignActionsRow}>
            <TouchableOpacity
              style={[
                styles.cancelBtn,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: isDark ? colors.border : "#CBD5E1",
                },
              ]}
              onPress={onClose}
            >
              <Text style={[styles.cancelBtnText, { color: colors.textPrimary }]}>İptal</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.purpleSubmitBtn, { backgroundColor: "#8B5CF6" }]}
              onPress={handleSubmit}
              disabled={submitting}
              activeOpacity={0.8}
            >
              <Text style={styles.purpleSubmitBtnText}>
                {submitting ? "Eşleniyor..." : "Eşle"}
              </Text>
            </TouchableOpacity>
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actionBar: { padding: spacing.md, paddingBottom: spacing.xs },
  primaryBtn: {
    borderRadius: radius.sm,
    alignItems: "center",
    paddingVertical: 10,
  },
  primaryBtnText: { color: "#fff", fontWeight: "700", fontSize: 13 },

  card: {
    borderRadius: radius.md,
    borderWidth: 1,
    paddingTop: spacing.md,
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.md,
    gap: 10,
    overflow: "visible",
  },
  cardTopArea: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    zIndex: 10,
  },
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  title: { fontWeight: "700", fontSize: 16 },
  typePill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  typePillText: { fontSize: 11, fontWeight: "600" },
  description: { fontSize: 13, marginTop: 4 },
  metaText: { fontSize: 12, marginTop: 4 },
  assignedBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    marginTop: 6,
  },
  assignedBadgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  moreButton: {
    width: 28,
    height: 28,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  moreButtonText: {
    fontSize: 18,
    fontWeight: "700",
    lineHeight: 18,
  },

  /* Web Tarzı Açılır Dropdown Menü */
  dropdownBackdrop: {
    position: "absolute",
    top: -500,
    left: -500,
    right: -500,
    bottom: -500,
    backgroundColor: "transparent",
    zIndex: 90,
  },
  webDropdownMenu: {
    position: "absolute",
    top: 34,
    right: 0,
    width: 195,
    borderRadius: 10,
    borderWidth: 1,
    paddingVertical: 6,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    elevation: 12,
    zIndex: 100,
  },
  dropdownMenuItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  dropdownItemDelete: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#F1F5F9",
    marginTop: 3,
  },
  dropdownItemText: {
    fontSize: 13,
    fontWeight: "500",
  },

  itemsSection: {
    marginTop: 2,
  },
  divider: {
    height: 1,
    width: "100%",
    marginBottom: spacing.sm,
  },
  itemsBox: {
    gap: 6,
  },
  itemRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
  },
  itemName: { fontSize: 13, flex: 1, marginRight: 8 },
  itemPrice: { fontSize: 13, fontWeight: "700" },

  assignBtnWrapper: {
    marginTop: 4,
  },
  assignBtn: {
    borderRadius: radius.sm,
    alignItems: "center",
    paddingVertical: 10,
  },
  assignBtnText: { fontWeight: "700", fontSize: 13 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  webModalCard: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 20,
    elevation: 10,
  },
  assignModalCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: spacing.sm,
  },
  modalTitleText: {
    fontSize: 17,
    fontWeight: "700",
  },
  assignTitleText: {
    fontSize: 16,
    fontWeight: "700",
  },
  assignSubTitle: {
    fontSize: 12,
    marginTop: 2,
  },
  modalCloseIcon: {
    fontSize: 16,
    fontWeight: "700",
    padding: 4,
  },

  assignInfoParagraph: {
    fontSize: 12,
    lineHeight: 18,
    marginBottom: spacing.md,
  },

  devicesListContainer: {
    borderWidth: 1,
    borderRadius: radius.md,
    overflow: "hidden",
    marginBottom: spacing.sm,
  },
  deviceCheckRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
  },
  deviceRowDivider: {
    borderBottomWidth: 1,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxMark: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  deviceCheckText: {
    fontSize: 13,
    fontWeight: "500",
  },
  currentTemplateTag: {
    fontSize: 12,
    color: "#8B5CF6",
    fontWeight: "600",
  },

  assignFooterNote: {
    fontSize: 11,
    marginTop: 2,
    marginBottom: spacing.md,
  },

  assignActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: spacing.sm,
  },
  purpleSubmitBtn: {
    paddingVertical: 9,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.sm,
  },
  purpleSubmitBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },

  inputGroup: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  requiredStar: {
    color: "#DC2626",
  },
  webInput: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontSize: 13,
  },
  webTextarea: {
    minHeight: 80,
  },

  radioRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  radioCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    borderRadius: radius.sm,
    borderWidth: 1.5,
  },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  radioText: {
    fontSize: 13,
    fontWeight: "600",
  },

  infoNotes: {
    paddingVertical: 2,
  },
  infoText: {
    fontSize: 11,
    lineHeight: 16,
  },

  modalActionsRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  cancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  cancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  submitBtn: {
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
  },
  submitBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});