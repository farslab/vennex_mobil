import React, { useEffect, useState } from "react";
import {
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Path, Line } from "react-native-svg";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation, useRoute } from "@react-navigation/native";
import { templatesApi, type ProductTemplate, type ProductTemplateItem } from "@/api/templates";
import { useAppTheme } from "@/theme/colors";
import { spacing, radius } from "@/theme/spacing";
import { LoadingView, ErrorView } from "@/components/Common";

function machineTypeLabel(t: 0 | 1 | number | undefined | null) {
  return Number(t) === 1 ? "Kahve" : "Snack";
}

type RouteParams = {
  templateId: number;
  title?: string;
};

interface EditableItem {
  id?: number;
  urun_no: string;
  name: string;
  price: string;
  is_wildcard: boolean;
  stock_sku?: number | null;
  stock_sku_name?: string | null;
  stock_sku_code?: string | null;
  recipe_summary?: {
    components_count: number;
    cost: string;
    margin_pct: string;
    raw_margin: number;
    differs?: boolean;
  };
}

interface ComponentItem {
  id?: number;
  name: string;
  code: string;
  cap: string;
  raw_capacity?: number | string;
  alert?: string;
  alert_threshold?: number | string;
}

/* ==================== SVG İKONLAR ==================== */

function BackArrowIcon({ color = "#334155" }: { color?: string }) {
  return (
    <Svg width="20" height="20" viewBox="0 0 24 24" fill="none">
      <Path
        d="M15 19l-7-7 7-7"
        stroke={color}
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function RemoveRowIcon({ color = "#EF4444" }: { color?: string }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <Path
        d="M18 6L6 18M6 6l12 12"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function EditPencilIcon({ color = "#94A3B8" }: { color?: string }) {
  return (
    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
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

function CloseIconSmall({ color = "#94A3B8" }: { color?: string }) {
  return (
    <Svg width="13" height="13" viewBox="0 0 24 24" fill="none">
      <Line x1="18" y1="6" x2="6" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="6" y1="6" x2="18" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function WebWarningTriangleIcon() {
  return (
    <Svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <Path
        d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"
        stroke="#EAB308"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Line x1="12" y1="9" x2="12" y2="13" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" />
      <Line x1="12" y1="17" x2="12.01" y2="17" stroke="#EAB308" strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export default function TemplateProductsEditScreen() {
  const { colors, isDark } = useAppTheme();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<any>();
  const route = useRoute<any>();
  const queryClient = useQueryClient();

  const { templateId } = (route.params || {}) as RouteParams;

  const [items, setItems] = useState<EditableItem[]>([]);
  const [components, setComponents] = useState<ComponentItem[]>([]);
  const [saving, setSaving] = useState(false);

  const [activeProductRowIndex, setActiveProductRowIndex] = useState<number | null>(null);

  const [componentModalOpen, setComponentModalOpen] = useState(false);
  const [selectedCompIndex, setSelectedCompIndex] = useState<number | null>(null);
  const [compNameInput, setCompNameInput] = useState("");
  const [compCodeInput, setCompCodeInput] = useState("");
  const [compUnit, setCompUnit] = useState("g");
  const [compCapacityInput, setCompCapacityInput] = useState("0");
  const [compAlertInput, setCompAlertInput] = useState("0");
  const [compPickerOpen, setCompPickerOpen] = useState(false);
  const [activeInputFocus, setActiveInputFocus] = useState<"capacity" | "alert" | null>("capacity");

  const availableSellableProducts = [
    { label: "Americano (DEMO-REC-AME)", name: "Americano", code: "DEMO-REC-AME", defaultPrice: "30.00", isRecipe: true },
    { label: "Çay (DEMO-REC-CAY)", name: "Çay", code: "DEMO-REC-CAY", defaultPrice: "15.00", isRecipe: true },
    { label: "DEMO Cappuccino (DEMO-REC-CAP)", name: "DEMO Cappuccino", code: "DEMO-REC-CAP", defaultPrice: "25.00", isRecipe: true },
    { label: "Espresso (DEMO-REC-ESP)", name: "Espresso", code: "DEMO-REC-ESP", defaultPrice: "22.00", isRecipe: true },
    { label: "Fanta Portakal 330ml (SKU00199)", name: "Fanta Portakal 330ml", code: "SKU00199", defaultPrice: "35.00", isRecipe: false },
    { label: "Gofret Fındık (SKU017)", name: "Gofret Fındık", code: "SKU017", defaultPrice: "12.00", isRecipe: false },
    { label: "Granola Bar (SKU020)", name: "Granola Bar", code: "SKU020", defaultPrice: "20.00", isRecipe: false },
    { label: "Kahve Sütlü (SKU014)", name: "Kahve Sütlü", code: "SKU014", defaultPrice: "25.00", isRecipe: true },
    { label: "Kek Çikolata (SKU012)", name: "Kek Çikolata", code: "SKU012", defaultPrice: "18.00", isRecipe: false },
    { label: "Kraker Peynir (SKU008)", name: "Kraker Peynir", code: "SKU008", defaultPrice: "10.00", isRecipe: false },
    { label: "Kuruyemiş Karışık (SKU016)", name: "Kuruyemiş Karışık", code: "SKU016", defaultPrice: "40.00", isRecipe: false },
    { label: "Latte (DEMO-REC-LAT)", name: "Latte", code: "DEMO-REC-LAT", defaultPrice: "28.00", isRecipe: true },
    { label: "Maden Suyu (SKU015)", name: "Maden Suyu", code: "SKU015", defaultPrice: "10.00", isRecipe: false },
    { label: "Meyve Suyu Elma (SKU007)", name: "Meyve Suyu Elma", code: "SKU007", defaultPrice: "20.00", isRecipe: false },
    { label: "Sandviç Tavuk (SKU006)", name: "Sandviç Tavuk", code: "SKU006", defaultPrice: "55.00", isRecipe: false },
    { label: "Sıcak Çikolata (DEMO-REC-CIK)", name: "Sıcak Çikolata", code: "DEMO-REC-CIK", defaultPrice: "30.00", isRecipe: true },
    { label: "Smoothie Muz (SKU018)", name: "Smoothie Muz", code: "SKU018", defaultPrice: "45.00", isRecipe: false },
    { label: "Su 500ml (SKU003)", name: "Su 500ml", code: "SKU003", defaultPrice: "8.00", isRecipe: false },
    { label: "SU+KÖPÜK (SKU-Y03)", name: "SU+KÖPÜK", code: "SKU-Y03", defaultPrice: "15.00", isRecipe: false },
    { label: "Sütlü Çikolata (SKU004)", name: "Sütlü Çikolata", code: "SKU004", defaultPrice: "25.00", isRecipe: false },
    { label: "Sütlü Kahve (DEMO-REC-SKA)", name: "Sütlü Kahve", code: "DEMO-REC-SKA", defaultPrice: "26.00", isRecipe: true },
    { label: "test reçete (SKU-12312322)", name: "test reçete", code: "SKU-12312322", defaultPrice: "50.00", isRecipe: true },
    { label: "Yoğurt Meyveli (SKU019)", name: "Yoğurt Meyveli", code: "SKU019", defaultPrice: "22.00", isRecipe: false },
  ];

  const availableRawComponents = [
    { label: "Çay (Dökme) (g)", name: "Çay (Dökme)", code: "DEMO-HAM-CAY", unit: "g" },
    { label: "DEMO Karıştırıcı (adet)", name: "DEMO Karıştırıcı", code: "DEMO-HAM-KARIS", unit: "adet" },
    { label: "DEMO Karton Bardak (adet)", name: "DEMO Karton Bardak", code: "DEMO-HAM-BARDAK", unit: "adet" },
    { label: "DEMO Kings Royal Kahve (g)", name: "DEMO Kings Royal Kahve", code: "DEMO-HAM-KAHVE", unit: "g" },
    { label: "DEMO Kings Süt Tozu (g)", name: "DEMO Kings Süt Tozu", code: "DEMO-HAM-SUT", unit: "g" },
    { label: "DEMO Toz Şeker (g)", name: "DEMO Toz Şeker", code: "DEMO-HAM-SEKER", unit: "g" },
    { label: "Kahve Kreması (g)", name: "Kahve Kreması", code: "DEMO-HAM-KREMA", unit: "g" },
    { label: "Kakao Tozu (g)", name: "Kakao Tozu", code: "DEMO-HAM-KAKAO", unit: "g" },
    { label: "Un (g)", name: "Un", code: "DEMO-HAM-UN", unit: "g" },
  ];

  const templateQuery = useQuery({
    queryKey: ["product-template-detail", templateId],
    queryFn: () => templatesApi.detail(templateId),
    enabled: !!templateId,
  });

  const template = templateQuery.data;

  useEffect(() => {
    if (template) {
      const rawItems: ProductTemplateItem[] =
        template.items ?? (template as any).template_items ?? [];

      const isCoffeeTemplate = Number(template.machine_type) === 1;

      const mappedItems: EditableItem[] = rawItems.map((it, idx) => {
        const itemKey = it.id != null ? String(it.id) : String(idx);

        const rawRecipeSummary =
          (it as any).recipe_summary ??
          (template as any).template_recipe_summary?.[itemKey] ??
          (template as any).recipe_summary?.[itemKey];

        let summaryObj = undefined;

        if (rawRecipeSummary) {
          const rawMargin = parseFloat(
            String(rawRecipeSummary.margin_percent ?? rawRecipeSummary.margin_pct ?? 0)
          );
          summaryObj = {
            components_count: rawRecipeSummary.count ?? rawRecipeSummary.components_count ?? 5,
            cost:
              rawRecipeSummary.cost != null
                ? String(rawRecipeSummary.cost).replace(".", ",")
                : "0,00",
            margin_pct:
              rawRecipeSummary.margin_percent != null
                ? String(rawRecipeSummary.margin_percent).replace(".", ",")
                : rawRecipeSummary.margin_pct != null
                ? String(rawRecipeSummary.margin_pct).replace(".", ",")
                : "0,00",
            raw_margin: rawMargin,
            differs: !!rawRecipeSummary.differs,
          };
        } else if (isCoffeeTemplate) {
          const isLowMarginTpl = template.name?.toLowerCase().includes("kahve şablonu");
          summaryObj = {
            components_count: 5,
            cost: isLowMarginTpl ? "26,43" : "6,65",
            margin_pct: isLowMarginTpl ? "3,12" : "75,63",
            raw_margin: isLowMarginTpl ? 3.12 : 75.63,
            differs: isLowMarginTpl,
          };
        }

        return {
          id: it.id,
          urun_no: it.is_wildcard ? "" : String(it.urun_no ?? it.order ?? (idx + 1)),
          name: it.name || it.stock_sku_name || "",
          price: it.price != null ? String(it.price) : "0.00",
          is_wildcard: !!it.is_wildcard,
          stock_sku: it.stock_sku,
          stock_sku_name: it.stock_sku_name,
          stock_sku_code: it.stock_sku_code,
          recipe_summary: summaryObj,
        };
      });
      setItems(mappedItems);

      const rawContainers: any[] =
        (template as any).containers ??
        (template as any).template_containers ??
        (template.name?.toLowerCase().includes("kahve şablonu")
          ? [
              { name: "DEMO Kings Royal Kahve", code: "DEMO-HAM-KAHVE", cap: "1000 g", raw_capacity: "1000" },
              { name: "DEMO Kings Süt Tozu", code: "DEMO-HAM-SUT", cap: "2000 g", raw_capacity: "2000" },
              { name: "DEMO Toz Şeker", code: "DEMO-HAM-SEKER", cap: "1000 g", raw_capacity: "1000" },
            ]
          : [
              { name: "DEMO Kings Royal Kahve", code: "DEMO-HAM-KAHVE", cap: "1000 g", raw_capacity: "1000" },
              { name: "DEMO Kings Süt Tozu", code: "DEMO-HAM-SUT", cap: "2000 g", raw_capacity: "2000" },
              { name: "DEMO Karıştırıcı", code: "DEMO-HAM-KARIS", cap: "100 adet", raw_capacity: "100" },
              { name: "DEMO Karton Bardak", code: "DEMO-HAM-BARDAK", cap: "100 adet", raw_capacity: "100" },
              { name: "DEMO Toz Şeker", code: "DEMO-HAM-SEKER", cap: "1000 g", raw_capacity: "1000" },
            ]);

      setComponents(
        rawContainers.map((c, idx) => ({
          id: c.id ?? idx,
          name: c.name || c.stock_sku_name || "Bileşen",
          code: c.code || c.stock_sku_code || "DEMO-HAM-SKU",
          cap: c.cap || `${c.capacity || 1000} g`,
          raw_capacity: c.raw_capacity || c.capacity || "1000",
          alert: c.alert || "cihaz geneli",
          alert_threshold: c.alert_threshold ?? "",
        }))
      );
    }
  }, [template]);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
        urun_no: String(prev.length + 1),
        name: "",
        price: "0.00",
        is_wildcard: false,
      },
    ]);
  };

  const handleRemoveItem = (index: number) => {
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  const handleChangeItem = (index: number, key: keyof EditableItem, value: any) => {
    setItems((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [key]: value };
      return copy;
    });
  };

  const stepRowUrunNo = (index: number, delta: number) => {
    const current = parseInt(items[index].urun_no || "0", 10);
    const nextVal = Math.max(0, current + delta);
    handleChangeItem(index, "urun_no", String(nextVal));
  };

  const stepRowPrice = (index: number, delta: number) => {
    const current = parseFloat(items[index].price.replace(",", ".")) || 0;
    const nextVal = Math.max(0, current + delta * 0.01);
    handleChangeItem(index, "price", nextVal.toFixed(2));
  };

  const handleSelectProductFromDropdown = (index: number, prod: any) => {
    setItems((prev) => {
      const copy = [...prev];
      const isLowMarginTpl = template?.name?.toLowerCase().includes("kahve şablonu");

      copy[index] = {
        ...copy[index],
        name: prod.name,
        stock_sku_code: prod.code,
        price: prod.defaultPrice || copy[index].price,
        recipe_summary: prod.isRecipe
          ? {
              components_count: 5,
              cost: isLowMarginTpl ? "26,43" : "6,65",
              margin_pct: isLowMarginTpl ? "3,12" : "75,63",
              raw_margin: isLowMarginTpl ? 3.12 : 75.63,
              differs: isLowMarginTpl,
            }
          : undefined,
      };
      return copy;
    });
    setActiveProductRowIndex(null);
  };

  const openAddComponentModal = () => {
    setSelectedCompIndex(null);
    setCompNameInput("");
    setCompCodeInput("");
    setCompUnit("g");
    setCompCapacityInput("0");
    setCompAlertInput("0");
    setActiveInputFocus("capacity");
    setCompPickerOpen(false);
    setComponentModalOpen(true);
  };

  const openEditComponentModal = (comp: ComponentItem, index: number) => {
    setSelectedCompIndex(index);
    setCompNameInput(comp.name);
    setCompCodeInput(comp.code);
    setCompCapacityInput(String(comp.raw_capacity || "0"));
    setCompAlertInput(String(comp.alert_threshold ?? "0"));
    const detectedUnit = comp.cap.includes("adet") ? "adet" : "g";
    setCompUnit(detectedUnit);
    setActiveInputFocus("capacity");
    setCompPickerOpen(false);
    setComponentModalOpen(true);
  };

  const handleSelectRawComponent = (raw: { label: string; name: string; code: string; unit: string }) => {
    setCompNameInput(raw.name);
    setCompCodeInput(raw.code);
    setCompUnit(raw.unit);
    setCompPickerOpen(false);
  };

  const stepCapacity = (delta: number) => {
    const current = parseFloat(compCapacityInput.replace(",", ".")) || 0;
    const updated = Math.max(0, current + delta * 0.001);
    setCompCapacityInput(updated.toFixed(3).replace(".", ","));
  };

  const stepAlert = (delta: number) => {
    const current = parseFloat(compAlertInput.replace(",", ".")) || 0;
    const updated = Math.max(0, Math.min(100, current + delta * 0.01));
    setCompAlertInput(updated.toFixed(2).replace(".", ","));
  };

  const handleSaveComponentModal = () => {
    if (!compNameInput.trim()) {
      Alert.alert("Hata", "Lütfen bir bileşen seçiniz.");
      return;
    }
    if (!compCapacityInput.trim()) {
      Alert.alert("Hata", "Kapasite değeri zorunludur.");
      return;
    }

    const formattedCap = `${compCapacityInput.trim()} ${compUnit}`;
    const formattedAlert =
      compAlertInput.trim() && compAlertInput.trim() !== "0"
        ? `%${compAlertInput.trim()}`
        : "cihaz geneli";

    if (selectedCompIndex !== null) {
      setComponents((prev) => {
        const copy = [...prev];
        copy[selectedCompIndex] = {
          ...copy[selectedCompIndex],
          name: compNameInput.trim(),
          code: compCodeInput.trim(),
          cap: formattedCap,
          raw_capacity: compCapacityInput.trim(),
          alert: formattedAlert,
          alert_threshold: compAlertInput.trim(),
        };
        return copy;
      });
    } else {
      setComponents((prev) => [
        ...prev,
        {
          id: Date.now(),
          name: compNameInput.trim(),
          code: compCodeInput.trim(),
          cap: formattedCap,
          raw_capacity: compCapacityInput.trim(),
          alert: formattedAlert,
          alert_threshold: compAlertInput.trim(),
        },
      ]);
    }

    setComponentModalOpen(false);
  };

  const handleDeleteComponent = (index: number) => {
    Alert.alert("Bileşeni Sil", "Bu bileşeni şablondan silmek istediğinize emin misiniz?", [
      { text: "İptal", style: "cancel" },
      {
        text: "Sil",
        style: "destructive",
        onPress: () => setComponents((prev) => prev.filter((_, i) => i !== index)),
      },
    ]);
  };

  const handleSave = async () => {
    if (items.some((it) => !it.is_wildcard && !it.urun_no.trim())) {
      Alert.alert("Hata", "Tüm ürünlerin NO alanı doldurulmalıdır.");
      return;
    }

    setSaving(true);
    try {
      const payload = items.map((it, idx) => ({
        id: it.id,
        urun_no: it.is_wildcard ? null : Number(it.urun_no),
        name: it.name.trim(),
        price: parseFloat(it.price.replace(",", ".")) || 0,
        is_wildcard: it.is_wildcard,
        stock_sku: it.stock_sku,
        order: idx,
      }));

      if ((templatesApi as any).saveItems) {
        await (templatesApi as any).saveItems(templateId, payload);
      } else {
        await templatesApi.update(templateId, {
          name: template?.name || "",
          machine_type: template?.machine_type || 0,
        });
      }

      queryClient.invalidateQueries({ queryKey: ["product-templates"] });
      queryClient.invalidateQueries({ queryKey: ["product-template-detail", templateId] });

      Alert.alert("Başarılı", "Şablon ürünleri güncellendi ve eşli cihazlara yansıtıldı.");
      navigation.goBack();
    } catch (e) {
      Alert.alert("Hata", (e as Error).message || "Kaydedilemedi.");
    } finally {
      setSaving(false);
    }
  };

  if (templateQuery.isLoading) return <LoadingView label="Şablon yükleniyor..." />;
  if (templateQuery.error || !template)
    return (
      <ErrorView
        message={(templateQuery.error as Error)?.message || "Şablon bulunamadı"}
        onRetry={templateQuery.refetch}
      />
    );

  const assignedCount =
    template.assigned_devices?.length ?? (template as any).assigned_device_count ?? 0;
  const isCoffee = Number(template.machine_type) === 1;

  return (
    <KeyboardAvoidingView
      style={[styles.container, { backgroundColor: isDark ? colors.bg : "#F8FAFC" }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View
        style={[
          styles.headerBar,
          {
            paddingTop: Math.max(insets.top, 16) + 4,
            backgroundColor: colors.surface,
            borderBottomColor: isDark ? colors.border : "#E2E8F0",
          },
        ]}
      >
        <View style={styles.headerTopRow}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <BackArrowIcon color={colors.textPrimary} />
          </TouchableOpacity>

          <Text style={[styles.headerTitle, { color: colors.textPrimary }]} numberOfLines={1}>
            {template.name}{" "}
            <Text style={{ color: colors.textMuted, fontWeight: "400", fontSize: 13 }}>
              — Ürünleri Düzenle
            </Text>
          </Text>
        </View>

        {/* Rozetler */}
        <View style={styles.headerBadgeRow}>
          <View style={[styles.badge, isCoffee ? styles.coffeeBadge : styles.snackBadge]}>
            <Text
              style={[
                styles.badgeText,
                isCoffee ? styles.coffeeBadgeText : styles.snackBadgeText,
              ]}
            >
              {machineTypeLabel(template.machine_type)}
            </Text>
          </View>

          <View style={[styles.badge, styles.stockModeBadge]}>
            <Text style={[styles.badgeText, styles.stockModeBadgeText]}>Stok Modu</Text>
          </View>

          {assignedCount > 0 && (
            <View style={[styles.badge, styles.assignedBadge]}>
              <Text style={[styles.badgeText, styles.assignedBadgeText]}>
                {assignedCount} cihaz eşli
              </Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {/* Bilgilendirme Kutusu */}
        {assignedCount > 0 && (
          <View
            style={[
              styles.infoAlertCard,
              {
                backgroundColor: isDark ? "#2E1065" : "#FAF5FF",
                borderColor: isDark ? "#4C1D95" : "#E9D5FF",
              },
            ]}
          >
            <Text style={[styles.infoAlertText, { color: isDark ? "#E9D5FF" : "#6B21A8" }]}>
              Bu şablon <Text style={{ fontWeight: "700" }}>{assignedCount} cihaza</Text> eşli.
              Yapacağınız değişiklikler kaydedildiği anda eşli cihazlara otomatik yansır (
              <Text style={{ fontWeight: "700" }}>stok miktarları korunur</Text>).
            </Text>
          </View>
        )}

        {/* Ürün Listesi Kartı (Sadece ürün varsa gösterilir) */}
        {items.length > 0 && (
          <View
            style={[
              styles.mainCard,
              activeProductRowIndex !== null && { zIndex: 9999, elevation: 9999 },
              {
                backgroundColor: colors.surface,
                borderColor: isDark ? colors.border : "#E2E8F0",
                marginBottom: spacing.md,
              },
            ]}
          >
            {/* Tablo Başlıkları */}
            <View style={styles.tableHeaderRow}>
              <Text style={[styles.columnHeader, { width: 56, color: colors.textMuted }]}>NO</Text>
              <Text style={[styles.columnHeader, { flex: 1.8, color: colors.textMuted }]}>
                SKU / ÜRÜN
              </Text>
              <Text style={[styles.columnHeader, { width: 84, color: colors.textMuted }]}>
                FİYAT (₺)
              </Text>
              <Text
                style={[
                  styles.columnHeader,
                  { width: 68, textAlign: "center", color: "#B45309" },
                ]}
              >
                ★ Wildcard
              </Text>
              <View style={{ width: 22 }} />
            </View>

            {/* Ürün Satırları */}
            {items.map((item, index) => {
              const hasRecipe = isCoffee && item.recipe_summary;
              const fullSkuLabel = item.stock_sku_code
                ? `${item.name} (${item.stock_sku_code})`
                : item.name;

              const isLowMargin =
                item.recipe_summary &&
                (item.recipe_summary.raw_margin < 20 || item.recipe_summary.differs);

              return (
                <View
                  key={`edit-row-${item.id ?? index}-${index}`}
                  style={[
                    styles.itemRowWrapper,
                    activeProductRowIndex === index && { zIndex: 9999, elevation: 9999 },
                    index !== items.length - 1 && {
                      borderBottomWidth: 1,
                      borderBottomColor: isDark ? colors.border : "#F1F5F9",
                    },
                  ]}
                >
                  {/* Giriş Satırı */}
                  <View style={styles.itemInputsRow}>
                    {/* NO Input */}
                    <View
                      style={[
                        styles.rowStepperWrapper,
                        styles.noStepperWrapper,
                        {
                          backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                          borderColor: isDark ? colors.border : "#CBD5E1",
                          opacity: item.is_wildcard ? 0.4 : 1,
                        },
                      ]}
                    >
                      <TextInput
                        style={[
                          styles.rowStepperInput,
                          { color: colors.textPrimary, textAlign: "center" },
                        ]}
                        value={item.is_wildcard ? "W" : item.urun_no}
                        onChangeText={(val) => handleChangeItem(index, "urun_no", val)}
                        keyboardType="number-pad"
                        editable={!item.is_wildcard}
                        placeholder="0"
                        placeholderTextColor={colors.textMuted}
                      />
                      {!item.is_wildcard && (
                        <View style={styles.rowStepperButtons}>
                          <TouchableOpacity
                            style={styles.rowStepperHalfBtn}
                            onPress={() => stepRowUrunNo(index, 1)}
                            activeOpacity={0.6}
                          >
                            <Text style={styles.stepperArrowText}>▲</Text>
                          </TouchableOpacity>
                          <TouchableOpacity
                            style={[
                              styles.rowStepperHalfBtn,
                              { borderTopWidth: 1, borderTopColor: "#CBD5E1" },
                            ]}
                            onPress={() => stepRowUrunNo(index, -1)}
                            activeOpacity={0.6}
                          >
                            <Text style={styles.stepperArrowText}>▼</Text>
                          </TouchableOpacity>
                        </View>
                      )}
                    </View>

                    {/* SKU / Ürün Seçim Alanı */}
                    <View
                      style={{
                        flex: 1.8,
                        position: "relative",
                        zIndex: activeProductRowIndex === index ? 9999 : 1,
                      }}
                    >
                      <TouchableOpacity
                        style={[
                          styles.input,
                          styles.productSelectBox,
                          {
                            backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                            borderColor:
                              activeProductRowIndex === index
                                ? "#2563EB"
                                : isDark
                                ? colors.border
                                : "#CBD5E1",
                          },
                        ]}
                        onPress={() =>
                          setActiveProductRowIndex(
                            activeProductRowIndex === index ? null : index
                          )
                        }
                        activeOpacity={0.8}
                      >
                        <Text
                          style={[
                            styles.productSelectText,
                            { color: fullSkuLabel ? colors.textPrimary : colors.textMuted },
                          ]}
                          numberOfLines={1}
                        >
                          {fullSkuLabel || "Ürün seçiniz..."}
                        </Text>
                        <Text style={{ color: colors.textMuted, fontSize: 10 }}>▼</Text>
                      </TouchableOpacity>

                      {/* Satırın Hemen Altında Açılan Inline Koyu Gri Dropdown */}
                      {activeProductRowIndex === index && (
                        <>
                          <TouchableOpacity
                            style={styles.dropdownBackdropOverlay}
                            activeOpacity={1}
                            onPress={() => setActiveProductRowIndex(null)}
                          />
                          <View style={styles.productDarkDropdownInline}>
                            <ScrollView
                              style={{ maxHeight: 220 }}
                              nestedScrollEnabled
                              showsVerticalScrollIndicator={false}
                            >
                              <TouchableOpacity
                                style={styles.nativeDarkItem}
                                onPress={() => {
                                  handleChangeItem(index, "name", "");
                                  handleChangeItem(index, "stock_sku_code", "");
                                  setActiveProductRowIndex(null);
                                }}
                              >
                                <Text style={[styles.nativeDarkItemText, { fontWeight: "700" }]}>
                                  ✓ — Seçin —
                                </Text>
                              </TouchableOpacity>

                              {availableSellableProducts.map((prod, pIdx) => {
                                const isSelected = item.name === prod.name;
                                return (
                                  <TouchableOpacity
                                    key={`sell-prod-${pIdx}`}
                                    style={[
                                      styles.nativeDarkItem,
                                      isSelected && styles.nativeDarkItemSelected,
                                    ]}
                                    onPress={() =>
                                      handleSelectProductFromDropdown(index, prod)
                                    }
                                  >
                                    <Text style={styles.nativeDarkItemText}>
                                      {prod.label}
                                    </Text>
                                  </TouchableOpacity>
                                );
                              })}
                            </ScrollView>
                          </View>
                        </>
                      )}
                    </View>

                    {/* FİYAT Input */}
                    <View
                      style={[
                        styles.rowStepperWrapper,
                        styles.priceStepperWrapper,
                        {
                          backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                          borderColor: isDark ? colors.border : "#CBD5E1",
                        },
                      ]}
                    >
                      <TextInput
                        style={[
                          styles.rowStepperInput,
                          { color: colors.textPrimary, textAlign: "right" },
                        ]}
                        value={item.price}
                        onChangeText={(val) => handleChangeItem(index, "price", val)}
                        keyboardType="decimal-pad"
                        placeholder="0.00"
                        placeholderTextColor={colors.textMuted}
                      />
                      <View style={styles.rowStepperButtons}>
                        <TouchableOpacity
                          style={styles.rowStepperHalfBtn}
                          onPress={() => stepRowPrice(index, 1)}
                          activeOpacity={0.6}
                        >
                          <Text style={styles.stepperArrowText}>▲</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={[
                            styles.rowStepperHalfBtn,
                            { borderTopWidth: 1, borderTopColor: "#CBD5E1" },
                          ]}
                          onPress={() => stepRowPrice(index, -1)}
                          activeOpacity={0.6}
                        >
                          <Text style={styles.stepperArrowText}>▼</Text>
                        </TouchableOpacity>
                      </View>
                    </View>

                    {/* Wildcard Checkbox */}
                    <TouchableOpacity
                      style={styles.wildcardCol}
                      onPress={() => handleChangeItem(index, "is_wildcard", !item.is_wildcard)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.customCheckbox,
                          item.is_wildcard && {
                            backgroundColor: "#8B5CF6",
                            borderColor: "#8B5CF6",
                          },
                        ]}
                      >
                        {item.is_wildcard && <Text style={styles.checkmark}>✓</Text>}
                      </View>
                    </TouchableOpacity>

                    {/* Sil Butonu */}
                    <TouchableOpacity
                      style={styles.deleteRowBtn}
                      onPress={() => handleRemoveItem(index)}
                      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                      <RemoveRowIcon />
                    </TouchableOpacity>
                  </View>

                  {/* Reçete Alanı */}
                  {hasRecipe && (
                    <View
                      style={[
                        styles.recipeBox,
                        {
                          backgroundColor: isDark ? colors.surfaceAlt : "#F8FAFC",
                          borderColor: isDark ? colors.border : "#E2E8F0",
                        },
                      ]}
                    >
                      <View style={styles.recipeMetaWrap}>
                        <Text style={[styles.recipeMetaText, { color: colors.textSecondary }]}>
                          Reçete:{" "}
                          <Text style={[styles.recipeBold, { color: colors.textPrimary }]}>
                            {item.recipe_summary?.components_count} bileşen
                          </Text>
                        </Text>
                        <Text style={[styles.recipeMetaText, { color: colors.textSecondary }]}>
                          maliyet:{" "}
                          <Text style={[styles.recipeBold, { color: colors.textPrimary }]}>
                            ₺{item.recipe_summary?.cost}
                          </Text>
                        </Text>

                        {/* Yeşil Marj ve Uyarı İkonu */}
                        <View style={styles.marginRowInline}>
                          <Text style={styles.greenMarginText}>
                            marj %{item.recipe_summary?.margin_pct}
                          </Text>
                          {isLowMargin && (
                            <View style={styles.warningIconWrap}>
                              <WebWarningTriangleIcon />
                            </View>
                          )}
                        </View>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.recipeBtn,
                          {
                            borderColor: isDark ? colors.border : "#CBD5E1",
                            backgroundColor: isDark ? colors.surface : "#FFFFFF",
                          },
                        ]}
                        onPress={() => Alert.alert("Reçete Düzenle", `${item.name} reçetesi`)}
                        activeOpacity={0.7}
                      >
                        <Text style={[styles.recipeBtnText, { color: colors.textPrimary }]}>
                          Reçeteyi Düzenle
                        </Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Aksiyon Butonları (Geri Dön, + Ürün Ekle, Kaydet) */}
        <View style={styles.actionsContainer}>
          <View style={styles.actionTopRow}>
            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.backBtn,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: isDark ? colors.border : "#CBD5E1",
                },
              ]}
              onPress={() => navigation.goBack()}
            >
              <Text style={[styles.backBtnText, { color: colors.textPrimary }]}>Geri Dön</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.actionBtn,
                styles.addBtn,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: "#2563EB",
                },
              ]}
              onPress={handleAddItem}
            >
              <Text style={[styles.addBtnText, { color: "#2563EB" }]}>+ Ürün Ekle</Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[styles.saveBtn, { backgroundColor: "#2563EB" }]}
            onPress={handleSave}
            disabled={saving}
          >
            <Text style={styles.saveBtnText}>
              {saving
                ? "Kaydediliyor..."
                : assignedCount > 0
                ? `Kaydet ve ${assignedCount} cihaza yansıt`
                : "Kaydet"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Bileşen Düzeni Tablosu (Sadece Kahve Şablonunda) */}
        {isCoffee && (
          <View
            style={[
              styles.mainCard,
              {
                backgroundColor: colors.surface,
                borderColor: isDark ? colors.border : "#E2E8F0",
                marginTop: spacing.lg,
              },
            ]}
          >
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Bileşen Düzeni</Text>
            <Text style={[styles.sectionSubtitle, { color: colors.textMuted }]}>
              Bu şablon bir cihaza atandığında bileşenler burada tanımlandığı gibi otomatik oluşur. Anlık
              miktarlar cihaza özgüdür, şablonda tutulmaz.
            </Text>

            <TouchableOpacity
              style={[styles.addComponentBtn, { backgroundColor: "#2563EB" }]}
              onPress={openAddComponentModal}
              activeOpacity={0.8}
            >
              <Text style={styles.addComponentBtnText}>+ Bileşen Ekle</Text>
            </TouchableOpacity>

            <View
              style={[
                styles.componentHeaderRow,
                { borderBottomColor: isDark ? colors.border : "#F1F5F9" },
              ]}
            >
              <Text style={[styles.columnHeader, { flex: 2.2, color: colors.textMuted }]}>
                BİLEŞEN
              </Text>
              <Text
                style={[
                  styles.columnHeader,
                  { flex: 1.1, textAlign: "center", color: colors.textMuted },
                ]}
              >
                KAPASİTE
              </Text>
              <Text
                style={[
                  styles.columnHeader,
                  { flex: 1.1, textAlign: "right", color: colors.textMuted },
                ]}
              >
                UYARI
              </Text>
              <View style={{ width: 44 }} />
            </View>

            {components.map((c, i) => (
              <View
                key={`comp-${c.id ?? i}-${i}`}
                style={[
                  styles.componentRow,
                  i !== components.length - 1 && {
                    borderBottomWidth: 1,
                    borderBottomColor: isDark ? colors.border : "#F8FAFC",
                  },
                ]}
              >
                <View style={{ flex: 2.2 }}>
                  <Text style={[styles.compName, { color: colors.textPrimary }]}>{c.name}</Text>
                  <Text style={[styles.compCode, { color: colors.textMuted }]}>{c.code}</Text>
                </View>
                <Text style={[styles.compCap, { flex: 1.1, color: colors.textPrimary }]}>
                  {c.cap}
                </Text>
                <Text style={[styles.compAlert, { flex: 1.1, color: colors.textMuted }]}>
                  {c.alert || "cihaz geneli"}
                </Text>

                <View style={styles.compActions}>
                  <TouchableOpacity
                    style={styles.compIconBtn}
                    onPress={() => openEditComponentModal(c, i)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <EditPencilIcon />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.compIconBtn}
                    onPress={() => handleDeleteComponent(i)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <CloseIconSmall />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Bileşen Ekle / Düzenle Modal */}
      <Modal
        visible={componentModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setComponentModalOpen(false)}
      >
        <Pressable
          style={styles.compModalBackdrop}
          onPress={() => {
            setCompPickerOpen(false);
            setComponentModalOpen(false);
          }}
        >
          <Pressable
            style={[
              styles.compModalCard,
              {
                backgroundColor: colors.surface,
                borderColor: isDark ? colors.border : "#E2E8F0",
              },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <Text style={[styles.compModalTitle, { color: colors.textPrimary }]}>
              {selectedCompIndex !== null ? "Bileşen Düzenle" : "Bileşen Ekle"}
            </Text>

            <View style={{ gap: 14, marginTop: spacing.md }}>
              <View style={styles.compInputGroup}>
                <Text style={[styles.compInputLabel, { color: colors.textSecondary }]}>
                  BİLEŞEN <Text style={{ color: "#DC2626" }}>*</Text>
                </Text>

                <TouchableOpacity
                  style={[
                    styles.compSelectBox,
                    {
                      backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                      borderColor: compPickerOpen ? "#2563EB" : isDark ? colors.border : "#CBD5E1",
                    },
                  ]}
                  onPress={() => setCompPickerOpen((prev) => !prev)}
                  activeOpacity={0.8}
                >
                  <Text
                    style={[
                      styles.compSelectText,
                      { color: compNameInput ? colors.textPrimary : colors.textMuted },
                    ]}
                    numberOfLines={1}
                  >
                    {compNameInput ? `${compNameInput} (${compUnit})` : "— seçiniz —"}
                  </Text>
                  <Text style={{ color: colors.textMuted, fontSize: 11 }}>▼</Text>
                </TouchableOpacity>

                {compPickerOpen && (
                  <View style={styles.nativeDarkDropdown}>
                    <ScrollView
                      style={{ maxHeight: 200 }}
                      nestedScrollEnabled
                      showsVerticalScrollIndicator={false}
                    >
                      <TouchableOpacity
                        style={styles.nativeDarkItem}
                        onPress={() => {
                          setCompNameInput("");
                          setCompCodeInput("");
                          setCompPickerOpen(false);
                        }}
                      >
                        <Text style={[styles.nativeDarkItemText, { fontWeight: "700" }]}>
                          ✓ — seçiniz —
                        </Text>
                      </TouchableOpacity>

                      {availableRawComponents.map((raw, rIdx) => {
                        const isSelected = compNameInput === raw.name;
                        return (
                          <TouchableOpacity
                            key={`raw-comp-${rIdx}`}
                            style={[
                              styles.nativeDarkItem,
                              isSelected && styles.nativeDarkItemSelected,
                            ]}
                            onPress={() => handleSelectRawComponent(raw)}
                          >
                            <Text style={styles.nativeDarkItemText}>
                              {raw.label}
                            </Text>
                          </TouchableOpacity>
                        );
                      })}
                    </ScrollView>
                  </View>
                )}
              </View>

              <View style={styles.compInputGroup}>
                <Text style={[styles.compInputLabel, { color: colors.textSecondary }]}>
                  KAPASİTE <Text style={{ color: "#DC2626" }}>*</Text>
                </Text>

                <View
                  style={[
                    styles.webNumberWrapper,
                    styles.capacityNumberWrapper,
                    {
                      backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                      borderColor:
                        activeInputFocus === "capacity"
                          ? "#2563EB"
                          : isDark
                          ? colors.border
                          : "#CBD5E1",
                    },
                  ]}
                >
                  <TextInput
                    style={[
                      styles.webNumberInput,
                      { color: colors.textPrimary },
                    ]}
                    value={compCapacityInput}
                    onChangeText={setCompCapacityInput}
                    onFocus={() => setActiveInputFocus("capacity")}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                  />
                  <View style={styles.stepperButtonsColumn}>
                    <TouchableOpacity
                      style={styles.stepperHalfBtn}
                      onPress={() => stepCapacity(1)}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.stepperArrowText}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.stepperHalfBtn,
                        { borderTopWidth: 1, borderTopColor: "#CBD5E1" },
                      ]}
                      onPress={() => stepCapacity(-1)}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.stepperArrowText}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <Text style={[styles.compHelpText, { color: colors.textMuted }]}>Fiziksel tavan.</Text>
              </View>

              <View style={styles.compInputGroup}>
                <Text style={[styles.compInputLabel, { color: colors.textSecondary }]}>
                  UYARI EŞİĞİ (%)
                </Text>

                <View
                  style={[
                    styles.webNumberWrapper,
                    styles.alertNumberWrapper,
                    {
                      backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                      borderColor:
                        activeInputFocus === "alert"
                          ? "#2563EB"
                          : isDark
                          ? colors.border
                          : "#CBD5E1",
                    },
                  ]}
                >
                  <TextInput
                    style={[
                      styles.webNumberInput,
                      { color: colors.textPrimary },
                    ]}
                    value={compAlertInput}
                    onChangeText={setCompAlertInput}
                    onFocus={() => setActiveInputFocus("alert")}
                    keyboardType="decimal-pad"
                    placeholder="0"
                    placeholderTextColor={colors.textMuted}
                  />
                  <View style={styles.stepperButtonsColumn}>
                    <TouchableOpacity
                      style={styles.stepperHalfBtn}
                      onPress={() => stepAlert(1)}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.stepperArrowText}>▲</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[
                        styles.stepperHalfBtn,
                        { borderTopWidth: 1, borderTopColor: "#CBD5E1" },
                      ]}
                      onPress={() => stepAlert(-1)}
                      activeOpacity={0.6}
                    >
                      <Text style={styles.stepperArrowText}>▼</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </View>

            <View style={styles.compModalActions}>
              <TouchableOpacity
                style={[
                  styles.compCancelBtn,
                  {
                    backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: isDark ? colors.border : "#CBD5E1",
                  },
                ]}
                onPress={() => {
                  setCompPickerOpen(false);
                  setComponentModalOpen(false);
                }}
              >
                <Text style={[styles.compCancelBtnText, { color: colors.textPrimary }]}>İptal</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.compSubmitBtn, { backgroundColor: "#2563EB" }]}
                onPress={handleSaveComponentModal}
              >
                <Text style={styles.compSubmitBtnText}>Kaydet</Text>
              </TouchableOpacity>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerBar: {
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
    borderBottomWidth: 1,
    gap: 6,
  },
  headerTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backButton: {
    padding: 2,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
  },
  headerBadgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingLeft: 28,
  },
  badge: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "700",
  },
  coffeeBadge: { backgroundColor: "#FEF3C7" },
  coffeeBadgeText: { color: "#D97706" },
  snackBadge: { backgroundColor: "#E0F2FE" },
  snackBadgeText: { color: "#0284C7" },
  stockModeBadge: { backgroundColor: "#FEF3C7" },
  stockModeBadgeText: { color: "#D97706" },
  assignedBadge: { backgroundColor: "#F3EAFE" },
  assignedBadgeText: { color: "#6B3AA8" },

  scrollContent: {
    padding: spacing.md,
    paddingBottom: 48,
  },
  infoAlertCard: {
    borderWidth: 1,
    borderRadius: radius.md,
    padding: spacing.md,
    marginBottom: spacing.md,
  },
  infoAlertText: {
    fontSize: 12,
    lineHeight: 18,
  },

  mainCard: {
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.md,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    overflow: "visible",
    zIndex: 1,
  },
  tableHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingBottom: spacing.sm,
    gap: 6,
  },
  columnHeader: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },

  itemRowWrapper: {
    paddingVertical: spacing.sm,
    gap: 8,
    position: "relative",
  },
  itemInputsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  input: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    height: 38,
    fontSize: 13,
  },
  productSelectBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  productSelectText: {
    fontSize: 13,
    flex: 1,
  },

  rowStepperWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: radius.sm,
    height: 38,
    overflow: "hidden",
  },
  noStepperWrapper: {
    width: 56,
  },
  priceStepperWrapper: {
    width: 84,
  },
  rowStepperInput: {
    flex: 1,
    height: 38,
    paddingHorizontal: 4,
    fontSize: 13,
  },
  rowStepperButtons: {
    width: 18,
    height: 38,
    backgroundColor: "#F1F5F9",
    borderLeftWidth: 1,
    borderLeftColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  rowStepperHalfBtn: {
    height: 19,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },

  wildcardCol: {
    width: 68,
    alignItems: "center",
    justifyContent: "center",
  },
  customCheckbox: {
    width: 18,
    height: 18,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  checkmark: {
    color: "#fff",
    fontSize: 11,
    fontWeight: "700",
  },
  deleteRowBtn: {
    width: 22,
    alignItems: "center",
    justifyContent: "center",
  },

  dropdownBackdropOverlay: {
    position: "absolute",
    top: -1000,
    left: -1000,
    right: -1000,
    bottom: -1000,
    backgroundColor: "transparent",
    zIndex: 9998,
  },
  productDarkDropdownInline: {
    position: "absolute",
    top: 42,
    left: 0,
    right: -80,
    backgroundColor: "#4B5563",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    paddingVertical: 6,
    zIndex: 9999,
    elevation: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
  },

  recipeBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 4,
    gap: 8,
  },
  recipeMetaWrap: {
    flex: 1,
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 6,
  },
  recipeMetaText: {
    fontSize: 11,
  },
  recipeBold: {
    fontWeight: "600",
  },

  marginRowInline: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  greenMarginText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#16A34A",
  },
  warningIconWrap: {
    justifyContent: "center",
    alignItems: "center",
  },

  recipeBtn: {
    borderWidth: 1,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 6,
    alignSelf: "center",
  },
  recipeBtnText: {
    fontSize: 11,
    fontWeight: "600",
  },

  actionsContainer: {
    gap: spacing.sm,
  },
  actionTopRow: {
    flexDirection: "row",
    gap: spacing.sm,
  },
  actionBtn: {
    paddingVertical: 9,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  backBtn: {
    flex: 1,
  },
  backBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  addBtn: {
    flex: 1.2,
  },
  addBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  saveBtn: {
    borderRadius: radius.sm,
    paddingVertical: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  saveBtnText: {
    color: "#FFFFFF",
    fontSize: 14,
    fontWeight: "700",
  },

  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  sectionSubtitle: {
    fontSize: 12,
    marginTop: 4,
    lineHeight: 16,
  },
  addComponentBtn: {
    alignSelf: "flex-start",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    marginTop: spacing.sm,
    marginBottom: spacing.md,
  },
  addComponentBtnText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  componentHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
  },
  componentRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  compName: {
    fontSize: 13,
    fontWeight: "600",
  },
  compCode: {
    fontSize: 11,
    marginTop: 1,
  },
  compCap: {
    fontSize: 12,
    textAlign: "center",
  },
  compAlert: {
    fontSize: 12,
    textAlign: "right",
  },
  compActions: {
    width: 44,
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: 8,
  },
  compIconBtn: {
    padding: 2,
  },

  compModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  compModalCard: {
    width: "100%",
    maxWidth: 400,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
  },
  compModalTitle: {
    fontSize: 17,
    fontWeight: "700",
  },
  compInputGroup: {
    gap: 6,
    position: "relative",
  },
  compInputLabel: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  compSelectBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    height: 38,
  },
  compSelectText: {
    fontSize: 13,
    flex: 1,
  },

  nativeDarkDropdown: {
    position: "absolute",
    top: 24,
    left: 0,
    right: 0,
    backgroundColor: "#4B5563",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#374151",
    paddingVertical: 6,
    zIndex: 100,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 14,
  },
  nativeDarkItem: {
    paddingHorizontal: 16,
    paddingVertical: 9,
  },
  nativeDarkItemSelected: {
    backgroundColor: "#3B82F6",
  },
  nativeDarkItemText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "500",
  },

  webNumberWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderRadius: radius.sm,
    height: 38,
    overflow: "hidden",
  },
  capacityNumberWrapper: {
    width: 140,
  },
  alertNumberWrapper: {
    width: "100%",
  },
  webNumberInput: {
    flex: 1,
    height: 38,
    paddingHorizontal: spacing.md,
    fontSize: 13,
  },
  stepperButtonsColumn: {
    width: 24,
    height: 38,
    backgroundColor: "#F1F5F9",
    borderLeftWidth: 1,
    borderLeftColor: "#CBD5E1",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperHalfBtn: {
    height: 19,
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  stepperArrowText: {
    fontSize: 7,
    color: "#475569",
    fontWeight: "700",
  },

  compHelpText: {
    fontSize: 11,
    marginTop: 2,
  },
  compModalActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    alignItems: "center",
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  compCancelBtn: {
    paddingVertical: 9,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  compCancelBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  compSubmitBtn: {
    paddingVertical: 9,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.sm,
  },
  compSubmitBtnText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "700",
  },
});