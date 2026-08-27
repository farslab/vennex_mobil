import React, { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Line, Path, Rect } from "react-native-svg";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { reportsApi } from "@/api/reports";
import { useAppTheme } from "@/theme/colors";
import { radius, spacing } from "@/theme/spacing";
import { ErrorView, LoadingView, ScreenCard } from "@/components/Common";
import type { ReportType } from "@/types/reports";

// Örnek cihaz verisi tipi (Backend'den gelen veriyle uyumlu)
interface PosDeviceItem {
  id: string;
  label: string;
}

const REPORT_TYPE_CARDS = [
  {
    value: "pos_summary",
    title: "Özet",
    desc: "Cihaz/şirket bazlı satış adetleri ve cirolar",
  },
  {
    value: "pos_detail",
    title: "Detay",
    desc: "Her işlem ayrı satır (kart no, ürün, durum dahil)",
  },
  {
    value: "personel_kart",
    title: "PersonelKart Hareketleri",
    desc: "Yükleme, satış, iade, düzeltme, silme dahil tüm bakiye hareketleri",
  },
];

/* ==================== WEB İKONLARI (SVG) ==================== */

function FileDownIcon({ color = "#16A34A" }: { color?: string }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <Path
        d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path d="M14 2v6h6" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Line x1="12" y1="18" x2="12" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <Path d="M9 15l3 3 3-3" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

function CalendarIcon({ color = "#64748B" }: { color?: string }) {
  return (
    <Svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="4" width="18" height="18" rx="2" stroke={color} strokeWidth="2" />
      <Line x1="16" y1="2" x2="16" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="8" y1="2" x2="8" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="3" y1="10" x2="21" y2="10" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

export default function NewReportScreen() {
  const { colors, isDark } = useAppTheme();
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const { data: options, isLoading, error, refetch } = useQuery({
    queryKey: ["report-filter-options"],
    queryFn: reportsApi.filterOptions,
  });

  // Form State'leri
  const [reportType, setReportType] = useState<ReportType>("pos_summary");
  const [startDate, setStartDate] = useState("25.08.2026");
  const [endDate, setEndDate] = useState("25.08.2026");
  const [companyId, setCompanyId] = useState<number | null>(null);

  // Ek Filtreler (Web Arayüzü ile Birebir)
  const [selectedRegion, setSelectedRegion] = useState("İstanbul Anadolu Yakası");
  const [selectedLocation, setSelectedLocation] = useState("");
  const [deviceSearch, setDeviceSearch] = useState("");
  const [selectedDevices, setSelectedDevices] = useState<string[]>([]);
  const [txStatus, setTxStatus] = useState("Başarılı");
  const [paymentType, setPaymentType] = useState("Tümü");
  const [minAmount, setMinAmount] = useState("0.00");
  const [failReason, setFailReason] = useState("Tümü");

  // Örnek Cihaz Listesi
  const sampleDevices: PosDeviceItem[] = [
    { id: "PAX3080007269", label: "PAX3080007269 — IM25" },
    { id: "PAX1640302817", label: "PAX1640302817 — IM30" },
    { id: "UN20W600069", label: "UN20W600069 — Pavo Teknik test cihazı" },
    { id: "PAX1640302819", label: "PAX1640302819 — POS Cihazı" },
    { id: "PAV860066571", label: "PAV860066571 — POS Cihazı" },
    { id: "PAV200009951", label: "PAV200009951 — POS Cihazı" },
    { id: "UN20W000559", label: "UN20W000559 — POS Cihazı" },
    { id: "PAV200014945", label: "PAV200014945 — POS Cihazı" },
    { id: "PAV200015995", label: "PAV200015995 — POS Cihazı" },
  ];

  const filteredDevices = sampleDevices.filter((d) =>
    d.label.toLowerCase().includes(deviceSearch.toLowerCase())
  );

  const toggleDeviceSelect = (id: string) => {
    setSelectedDevices((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const handleSelectAllDevices = () => {
    setSelectedDevices(sampleDevices.map((d) => d.id));
  };

  const handleClearAllDevices = () => {
    setSelectedDevices([]);
  };

  const createMutation = useMutation({
    mutationFn: reportsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reports"] });
      Alert.alert("Rapor oluşturuldu", "Rapor kuyruğa alındı, durumunu listede takip edebilirsiniz.");
      navigation.goBack();
    },
    onError: (e) => Alert.alert("Hata", (e as Error).message),
  });

  const handleSubmit = () => {
    if (!startDate || !endDate) {
      Alert.alert("Eksik bilgi", "Başlangıç ve bitiş tarihi zorunludur.");
      return;
    }
    createMutation.mutate({
      report_type: reportType,
      start_date: startDate,
      end_date: endDate,
      company: companyId ?? undefined,
    });
  };

  if (isLoading) return <LoadingView label="Form yükleniyor..." />;
  if (error) return <ErrorView message={(error as Error).message} onRetry={refetch} />;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={{ padding: spacing.md, gap: spacing.md }}>
      <ScreenCard style={{ gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
          <FileDownIcon color="#16A34A" />
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>Yeni Rapor Oluştur</Text>
        </View>

        {/* 1. RAPOR TİPİ */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>RAPOR TİPİ</Text>
        <View style={{ gap: spacing.sm }}>
          {REPORT_TYPE_CARDS.map((card) => {
            const isSelected = reportType === card.value;
            return (
              <Pressable
                key={card.value}
                style={[
                  styles.typeCard,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? colors.surfaceAlt
                        : "#F4F7FF"
                      : colors.surface,
                    borderColor: isSelected ? colors.primary : colors.border,
                  },
                ]}
                onPress={() => setReportType(card.value as ReportType)}
              >
                <View
                  style={[
                    styles.radioCircle,
                    { borderColor: isSelected ? colors.primary : colors.border },
                  ]}
                >
                  {isSelected && <View style={[styles.radioInnerCircle, { backgroundColor: colors.primary }]} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text
                    style={[
                      styles.typeCardTitle,
                      { color: isSelected ? colors.primary : colors.textPrimary },
                    ]}
                  >
                    {card.title}
                  </Text>
                  <Text style={[styles.typeCardDesc, { color: colors.textMuted }]}>{card.desc}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* 2. TARİH ARALIĞI */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>BAŞLANGIÇ TARİHİ</Text>
            <View
              style={[
                styles.inputWithIcon,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: colors.border,
                },
              ]}
            >
              <TextInput
                style={[styles.inputInner, { color: colors.textPrimary }]}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="GG.AA.YYYY"
                placeholderTextColor={colors.textMuted}
              />
              <CalendarIcon color={colors.textMuted} />
            </View>
          </View>
          <View style={styles.fieldHalf}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>BİTİŞ TARİHİ</Text>
            <View
              style={[
                styles.inputWithIcon,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: colors.border,
                },
              ]}
            >
              <TextInput
                style={[styles.inputInner, { color: colors.textPrimary }]}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="GG.AA.YYYY"
                placeholderTextColor={colors.textMuted}
              />
              <CalendarIcon color={colors.textMuted} />
            </View>
          </View>
        </View>

        {/* 3. ŞİRKET, BÖLGE VE KONUM */}
        <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ŞİRKET</Text>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
          value="serpetco"
          onChangeText={() => {}}
          placeholderTextColor={colors.textMuted}
        />

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>BÖLGE (ÇOKLU SEÇİM — KAPSAMI İŞARETLER)</Text>
            <View
              style={[
                styles.multiSelectBox,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.multiSelectText, { color: colors.textPrimary }]}>{selectedRegion}</Text>
            </View>
          </View>
          <View style={styles.fieldHalf}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>KONUM (ÇOKLU SEÇİM — KAPSAMI İŞARETLER)</Text>
            <View
              style={[
                styles.multiSelectBox,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: colors.border,
                },
              ]}
            >
              <Text style={[styles.multiSelectPlaceholder, { color: colors.textMuted }]}>— Konum Seç —</Text>
            </View>
          </View>
        </View>

        {/* 4. POS CİHAZLARI */}
        <View style={styles.posHeaderRow}>
          <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>POS CİHAZLARI</Text>
          <Text style={[styles.counterText, { color: colors.textMuted }]}>
            {selectedDevices.length} / {sampleDevices.length} cihaz seçili
          </Text>
        </View>

        <View style={styles.actionBtnRow}>
          <Pressable
            style={[
              styles.smallActionBtn,
              { backgroundColor: isDark ? "#1E3A8A" : "#E0EAFF" },
            ]}
            onPress={handleSelectAllDevices}
          >
            <Text style={[styles.smallActionBtnText, { color: isDark ? "#93C5FD" : colors.primary }]}>
              Tümünü Seç
            </Text>
          </Pressable>
          <Pressable
            style={[
              styles.smallActionBtnAlt,
              {
                backgroundColor: isDark ? colors.surfaceAlt : "#F3F4F6",
                borderColor: colors.border,
                borderWidth: 1,
              },
            ]}
            onPress={handleClearAllDevices}
          >
            <Text style={[styles.smallActionBtnTextAlt, { color: colors.textSecondary }]}>Tümünü Temizle</Text>
          </Pressable>
        </View>

        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
          placeholder="Seri no veya isim ile ara..."
          placeholderTextColor={colors.textMuted}
          value={deviceSearch}
          onChangeText={setDeviceSearch}
        />

        {/* POS Cihazları Seçim Listesi */}
        <View
          style={[
            styles.deviceListContainer,
            {
              backgroundColor: isDark ? colors.surfaceAlt : "#F9FAFB",
              borderColor: colors.border,
            },
          ]}
        >
          {filteredDevices.map((dev) => {
            const isChecked = selectedDevices.includes(dev.id);
            return (
              <Pressable key={dev.id} style={styles.deviceRow} onPress={() => toggleDeviceSelect(dev.id)}>
                <View
                  style={[
                    styles.checkbox,
                    {
                      borderColor: isChecked ? colors.primary : colors.border,
                      backgroundColor: isChecked ? colors.primary : colors.surface,
                    },
                  ]}
                >
                  {isChecked && <Text style={styles.checkboxMark}>✓</Text>}
                </View>
                <Text style={[styles.deviceLabel, { color: colors.textPrimary }]}>{dev.label}</Text>
              </Pressable>
            );
          })}
        </View>

        {/* 5. İŞLEM DURUMU, ÖDEME TİPİ & MİNİMUM TUTAR */}
        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>İŞLEM DURUMU</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: colors.border,
                  color: colors.textPrimary,
                },
              ]}
              value={txStatus}
              onChangeText={setTxStatus}
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>ÖDEME TİPİ</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: colors.border,
                  color: colors.textPrimary,
                },
              ]}
              value={paymentType}
              onChangeText={setPaymentType}
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>MİNİMUM TUTAR (₺)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: colors.border,
                  color: colors.textPrimary,
                },
              ]}
              value={minAmount}
              onChangeText={setMinAmount}
              keyboardType="numeric"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={[styles.sectionLabel, { color: colors.textMuted }]}>BAŞARISIZ SEBEBİ</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: colors.border,
                  color: colors.textPrimary,
                },
              ]}
              value={failReason}
              onChangeText={setFailReason}
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        {/* 6. RAPOR OLUŞTUR BUTONU */}
        <Pressable
          style={[styles.createReportBtn, { backgroundColor: "#16A34A" }]}
          onPress={handleSubmit}
        >
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
            <FileDownIcon color="#FFFFFF" />
            <Text style={styles.createReportBtnText}>Rapor Oluştur</Text>
          </View>
        </Pressable>
      </ScreenCard>
    </ScrollView>
  );
}

/* ---------------- Stiller ---------------- */

const styles = StyleSheet.create({
  container: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: "700" },
  sectionLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginTop: spacing.xs, marginBottom: 4 },

  /* Rapor Tipi Kart Stilleri */
  typeCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: spacing.sm,
  },
  radioCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 2,
  },
  radioInnerCircle: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
  },
  typeCardTitle: { fontSize: 14, fontWeight: "700" },
  typeCardDesc: { fontSize: 11, marginTop: 2 },

  /* Form & Input Stilleri */
  fieldRow: { flexDirection: "row", gap: spacing.sm },
  fieldHalf: { flex: 1 },
  input: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 13,
  },
  inputWithIcon: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    height: 40,
  },
  inputInner: { flex: 1, paddingVertical: spacing.xs, fontSize: 13 },

  multiSelectBox: {
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.md,
    minHeight: 60,
  },
  multiSelectText: { fontSize: 12, fontWeight: "500" },
  multiSelectPlaceholder: { fontSize: 12 },

  /* POS Cihazları Kısmı Stilleri */
  posHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.xs },
  counterText: { fontSize: 11 },
  actionBtnRow: { flexDirection: "row", gap: spacing.xs, marginBottom: spacing.xs },
  smallActionBtn: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  smallActionBtnText: { fontSize: 11, fontWeight: "600" },
  smallActionBtnAlt: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.sm,
  },
  smallActionBtnTextAlt: { fontSize: 11, fontWeight: "600" },

  deviceListContainer: {
    borderRadius: radius.sm,
    borderWidth: 1,
    padding: spacing.sm,
    maxHeight: 200,
  },
  deviceRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs, paddingVertical: spacing.xs },
  checkbox: {
    width: 16,
    height: 16,
    borderRadius: 4,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
  },
  checkboxMark: { color: "#fff", fontSize: 10, fontWeight: "700" },
  deviceLabel: { fontSize: 12 },

  /* Yeşil Rapor Oluştur Butonu */
  createReportBtn: {
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
    marginTop: spacing.md,
  },
  createReportBtnText: { color: "#FFFFFF", fontSize: 14, fontWeight: "700" },
});