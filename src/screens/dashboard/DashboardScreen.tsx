import React, { useState } from "react";
import {
  ActivityIndicator,
  GestureResponderEvent,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Circle, Defs, LinearGradient, Line, Path, Rect, Stop } from "react-native-svg";
import { useQuery } from "@tanstack/react-query";
import { useAppTheme } from "@/theme/colors";
import { radius, spacing } from "@/theme/spacing";
import { Badge, ErrorView, LoadingView, ScreenCard } from "@/components/Common";
import { PeriodSelector } from "@/components/PeriodSelector";
import { useDashboard } from "./useDashboard";
import { extractResultsList } from "@/api/overview";
import { cardsApi } from "@/api/cards";
import { useAuthStore } from "@/store/authStore";
import { useNavigation } from "@react-navigation/native";
import type { CardGroup } from "@/types/cards";

type SalesPoint = { date: string; value: number };

function formatCurrency(n: number | null | undefined) {
  if (n == null) return "—";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(n);
}

function getPaymentBadgeColors(label: string | undefined, isDark: boolean) {
  const key = String(label || "").toLowerCase();
  if (key.includes("personel")) {
    return isDark ? { bg: "#064E3B", text: "#6EE7B7" } : { bg: "#E9F9EF", text: "#1E7A43" };
  }
  if (key.includes("kredi") || key.includes("banka")) {
    return isDark ? { bg: "#1E3A8A", text: "#93C5FD" } : { bg: "#EAF1FF", text: "#2757C6" };
  }
  if (key.includes("nakit")) {
    return isDark ? { bg: "#1F2937", text: "#D1D5DB" } : { bg: "#F1F2F4", text: "#4B5563" };
  }
  return isDark ? { bg: "#1F2937", text: "#D1D5DB" } : { bg: "#F1F2F4", text: "#4B5563" };
}

const DEVICES_TAB_NAME = "Devices";

function goToDeviceDetail(navigation: any, sn: string | undefined, name: string | undefined) {
  if (!sn) return;
  navigation.navigate(DEVICES_TAB_NAME, {
    screen: "DeviceDetail",
    params: { sn, name: name ?? "Cihaz Detayı" },
  });
}

function goToDevicesList(navigation: any) {
  navigation.navigate(DEVICES_TAB_NAME);
}

/* ==================== WEB İKONLARI (SVG) ==================== */

function PosDevicesIcon({ color = "#3B82F6" }: { color?: string }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <Rect x="3" y="3" width="18" height="18" rx="2" stroke={color} strokeWidth="2" />
      <Line x1="3" y1="9" x2="21" y2="9" stroke={color} strokeWidth="2" />
      <Line x1="9" y1="21" x2="9" y2="9" stroke={color} strokeWidth="2" />
    </Svg>
  );
}

function TotalTransactionsIcon({ color = "#10B981" }: { color?: string }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <Path
        d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Rect x="8" y="2" width="8" height="4" rx="1" stroke={color} strokeWidth="2" />
      <Path
        d="M9 14l2 2 4-4"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function FailedTransactionsIcon({ color = "#EF4444" }: { color?: string }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
      <Line x1="12" y1="8" x2="12" y2="12" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="12" y1="16" x2="12.01" y2="16" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

export default function DashboardScreen() {
  const { colors, isDark } = useAppTheme();
  const {
    period,
    setPeriod,
    customStartDate,
    customEndDate,
    setCustomRange,
    customRangeValidation,
    data,
    isLoading,
    isRefetching,
    error,
    refresh,
  } = useDashboard();
  const user = useAuthStore((s) => s.user);
  const navigation = useNavigation<any>();

  const [isManualRefreshing, setIsManualRefreshing] = useState(false);

  const [startInput, setStartInput] = useState(customStartDate ?? "");
  const [endInput, setEndInput] = useState(customEndDate ?? "");

  const handleRefresh = async () => {
    if (isManualRefreshing) return;
    setIsManualRefreshing(true);
    try {
      await refresh();
    } finally {
      setIsManualRefreshing(false);
    }
  };

  const applyCustomRange = () => {
    setCustomRange(startInput.trim() || null, endInput.trim() || null);
  };

  const isCustomPeriod = period === "custom";
  const customRangeReady = !isCustomPeriod || customRangeValidation.valid;

  if (isLoading && customRangeReady) return <LoadingView label="Panel yükleniyor..." />;
  if (error) return <ErrorView message={(error as Error).message} onRetry={refresh} />;

  const showCustomRangeGate = isCustomPeriod && !customRangeValidation.valid;

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: colors.bg }]}
      contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}
      refreshControl={
        <RefreshControl
          refreshing={isRefetching || isManualRefreshing}
          onRefresh={handleRefresh}
          tintColor={colors.primary}
        />
      }
    >
      <View>
        <Text style={[styles.greeting, { color: colors.textPrimary }]}>
          Merhaba, {user?.first_name || user?.username}
        </Text>
        <Text style={[styles.subGreeting, { color: colors.textSecondary }]}>
          {data ? `İşte ${data.summary.period_label.toLowerCase()} özeti` : "Panel"}
        </Text>
      </View>

      <PeriodSelector value={period} onChange={setPeriod} />

      {isCustomPeriod && (
        <ScreenCard>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Özel Tarih Aralığı</Text>
          <View style={styles.customRangeRow}>
            <TextInput
              style={[styles.dateInput, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="Başlangıç (YYYY-AA-GG)"
              placeholderTextColor={colors.textMuted}
              value={startInput}
              onChangeText={setStartInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
            <TextInput
              style={[styles.dateInput, { color: colors.textPrimary, borderColor: colors.border }]}
              placeholder="Bitiş (YYYY-AA-GG)"
              placeholderTextColor={colors.textMuted}
              value={endInput}
              onChangeText={setEndInput}
              autoCapitalize="none"
              autoCorrect={false}
            />
          </View>
          <TouchableOpacity
            style={[styles.applyButton, { backgroundColor: colors.primary }]}
            onPress={applyCustomRange}
            activeOpacity={0.8}
          >
            <Text style={styles.applyButtonText}>Uygula</Text>
          </TouchableOpacity>
          {!customRangeValidation.valid && (
            <Text style={[styles.customRangeError, { color: colors.danger }]}>
              {customRangeValidation.error}
            </Text>
          )}
        </ScreenCard>
      )}

      {showCustomRangeGate ? (
        <ScreenCard>
          <Text style={[styles.mutedCenter, { color: colors.textSecondary }]}>
            Verileri görmek için geçerli bir tarih aralığı girip "Uygula"ya basın.
          </Text>
        </ScreenCard>
      ) : isLoading || !data ? (
        <LoadingView label="Panel yükleniyor..." />
      ) : !data.summary.sales_visible ? (
        <ScreenCard>
          <Text style={[styles.mutedCenter, { color: colors.textSecondary }]}>
            Satış verilerini görüntüleme yetkiniz yok.
          </Text>
        </ScreenCard>
      ) : (
        <DashboardContent data={data} colors={colors} isDark={isDark} navigation={navigation} />
      )}
    </ScrollView>
  );
}

function DashboardContent({
  data,
  colors,
  isDark,
  navigation,
}: {
  data: any;
  colors: any;
  isDark: boolean;
  navigation: any;
}) {
  const { summary } = data;
  const paymentBreakdown = extractResultsList(data.payment_breakdown);
  const topDevices = extractResultsList(data.top_devices);
  const recentTx = extractResultsList(data.recent_transactions);

  const [selectedGroupModalData, setSelectedGroupModalData] = useState<any | null>(null);

  const groupsQuery = useQuery<CardGroup[]>({
    queryKey: ["card-groups"],
    queryFn: () => cardsApi.groups.list(),
  });

  const salesChart: SalesPoint[] = (data.revenue_timeseries?.labels ?? []).map(
    (label: string, i: number) => ({
      date: label,
      value: Number(data.revenue_timeseries?.amounts?.[i] ?? 0),
    })
  );

  const failedBreakdown = {
    timeout: summary.failures.timeout ?? 0,
    bank: summary.failures.bank ?? 0,
    technical: summary.failures.technical ?? 0,
    other: summary.failures.other ?? 0,
  };

  const totalPaymentAmount = paymentBreakdown.reduce(
    (acc: number, p: any) => acc + (p.amount ?? 0),
    0
  );

  const rawGroups: CardGroup[] = groupsQuery.data ?? [];
  const totalCardsInGroups = rawGroups.reduce((acc, g) => acc + (g.active_cards_count || 1), 0);

  const calculatedGroups =
    selectedGroupModalData?.groups && selectedGroupModalData.groups.length > 0
      ? selectedGroupModalData.groups
      : rawGroups.map((g, idx) => {
          const weight =
            totalCardsInGroups > 0 ? (g.active_cards_count || 1) / totalCardsInGroups : 1 / (rawGroups.length || 1);
          const totalAmount = selectedGroupModalData?.amount ?? 0;
          const totalTx = selectedGroupModalData?.count ?? 0;

          return {
            id: g.id,
            name: g.name,
            card_count: g.active_cards_count ?? 1,
            count: Math.round(totalTx * weight),
            amount: idx === rawGroups.length - 1 ? totalAmount - Math.round(totalAmount * (1 - weight)) : totalAmount * weight,
          };
        });

  return (
    <>
      <View style={styles.grid2}>
        <TouchableOpacity
          style={styles.gridCard}
          onPress={() => goToDevicesList(navigation)}
          activeOpacity={0.7}
        >
          <ScreenCard>
            <View style={styles.rowBetween}>
              <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>POS Cihazları</Text>
              <View style={[styles.iconBubble, { backgroundColor: isDark ? "#1E293B" : "#EAF0FF" }]}>
                <PosDevicesIcon color="#3B82F6" />
              </View>
            </View>
            <Text style={[styles.bigNumberSm, { color: colors.textPrimary }]}>
              {summary.devices.total}
            </Text>
            <View style={{ gap: 2, marginTop: spacing.xs }}>
              <DotLine
                color={colors.success}
                text={`${summary.devices.online} çevrimiçi`}
                textColor={colors.textMuted}
              />
              <DotLine
                color={colors.danger}
                text={`${summary.devices.offline} çevrimdışı`}
                textColor={colors.textMuted}
              />
            </View>
          </ScreenCard>
        </TouchableOpacity>

        <ScreenCard style={styles.gridCard}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Toplam Ciro</Text>
            <View style={[styles.iconBubble, { backgroundColor: isDark ? "#2E1065" : "#F3EAFE" }]}>
              <Text style={{ fontSize: 16, fontWeight: "700", color: "#8B5CF6" }}>₺</Text>
            </View>
          </View>
          <Text style={[styles.bigNumberSm, { color: colors.textPrimary }]}>
            {formatCurrency(summary.revenue)}
          </Text>
          {summary.change_pct != null && (
            <View style={{ marginTop: spacing.xs, alignSelf: "flex-start" }}>
              <Badge
                label={`${summary.change_positive ? "▲" : "▼"} %${Math.abs(
                  summary.change_pct
                ).toFixed(1)}`}
                tone={summary.change_positive ? "success" : "danger"}
              />
            </View>
          )}
          {summary.comparison_label && (
            <Text style={[styles.mutedTextSm, { color: colors.textMuted }]}>
              {summary.comparison_label}
            </Text>
          )}
          {summary.previous_revenue != null && (
            <Text style={[styles.mutedTextSm, { color: colors.textMuted }]}>
              {formatCurrency(summary.previous_revenue)}
            </Text>
          )}
        </ScreenCard>

        <ScreenCard style={styles.gridCard}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>Toplam İşlem</Text>
            <View style={[styles.iconBubble, { backgroundColor: isDark ? "#064E3B" : "#E9F9EF" }]}>
              <TotalTransactionsIcon color="#10B981" />
            </View>
          </View>
          <Text style={[styles.bigNumberSm, { color: colors.textPrimary }]}>
            {summary.transactions.total ?? "—"}
          </Text>
          <View style={{ gap: 2, marginTop: spacing.xs }}>
            <DotLine
              color={colors.success}
              text={`${summary.transactions.success ?? 0} Başarılı`}
              textColor={colors.textMuted}
            />
            <DotLine
              color={colors.danger}
              text={`${summary.transactions.failed ?? 0} Başarısız`}
              textColor={colors.textMuted}
            />
          </View>
        </ScreenCard>

        <ScreenCard style={styles.gridCard}>
          <View style={styles.rowBetween}>
            <Text style={[styles.cardLabel, { color: colors.textSecondary }]}>
              Başarısız İşlemler
            </Text>
            <View style={[styles.iconBubble, { backgroundColor: isDark ? "#450A0A" : "#FDECEC" }]}>
              <FailedTransactionsIcon color="#EF4444" />
            </View>
          </View>
          <Text style={[styles.bigNumberSm, { color: colors.danger }]}>
            {summary.transactions.failed ?? "—"}
          </Text>
          <View style={styles.failGrid}>
            <Text style={[styles.mutedTextSm, { color: colors.textMuted }]}>
              Zaman Aş.:{" "}
              <Text style={[styles.boldSm, { color: colors.textPrimary }]}>
                {failedBreakdown.timeout}
              </Text>
            </Text>
            <Text style={[styles.mutedTextSm, { color: colors.textMuted }]}>
              Banka R.:{" "}
              <Text style={[styles.boldSm, { color: colors.textPrimary }]}>
                {failedBreakdown.bank}
              </Text>
            </Text>
            <Text style={[styles.mutedTextSm, { color: colors.textMuted }]}>
              Teknik İ.:{" "}
              <Text style={[styles.boldSm, { color: colors.textPrimary }]}>
                {failedBreakdown.technical}
              </Text>
            </Text>
            <Text style={[styles.mutedTextSm, { color: colors.textMuted }]}>
              Diğer:{" "}
              <Text style={[styles.boldSm, { color: colors.textPrimary }]}>
                {failedBreakdown.other}
              </Text>
            </Text>
          </View>
        </ScreenCard>
      </View>

      <ScreenCard>
        <View style={styles.rowBetween}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Satış Grafiği</Text>
          <Text style={[styles.mutedTextSm, { color: colors.textMuted }]}>
            {summary.period_label}
          </Text>
        </View>
        <SalesChart data={salesChart} colors={colors} isDark={isDark} />
      </ScreenCard>

      <ScreenCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Ödeme Türüne Göre</Text>
        {paymentBreakdown.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>Bu dönemde işlem yok.</Text>
          </View>
        ) : (
          <View style={{ marginTop: spacing.md }}>
            {paymentBreakdown.map((p: any, index: number) => {
              const pct =
                totalPaymentAmount > 0
                  ? Math.round(((p.amount ?? 0) / totalPaymentAmount) * 100)
                  : 0;

              const labelStr = String(p?.label || "").toLowerCase();
              const ptTypeStr = String(p?.pt_type || "").toLowerCase();
              const isPersonnel = labelStr.includes("personel") || ptTypeStr.includes("personel");

              const handleRowPress = () => {
                if (isPersonnel) {
                  setSelectedGroupModalData(p);
                }
              };

              return (
                <View
                  key={`payment-${p.pt_type ?? p.label ?? index}-${index}`}
                  style={[
                    styles.paymentRow,
                    index !== paymentBreakdown.length - 1 && [
                      styles.paymentRowDivider,
                      { borderBottomColor: colors.border },
                    ],
                  ]}
                >
                  <TouchableOpacity
                    onPress={handleRowPress}
                    disabled={!isPersonnel}
                    activeOpacity={0.6}
                  >
                    <View style={styles.rowBetween}>
                      <View style={styles.rowStart}>
                        <Text style={[styles.paymentLabel, { color: colors.textPrimary }]}>
                          {p.label}
                        </Text>
                        {isPersonnel && (
                          <Text style={[styles.chevronIcon, { color: colors.textMuted }]}>›</Text>
                        )}
                      </View>
                      <View style={styles.paymentMeta}>
                        <Text style={[styles.paymentMetaText, { color: colors.textMuted }]}>
                          {p.count} işlem
                        </Text>
                        <Text style={[styles.paymentMetaText, { color: colors.textMuted }]}>
                          %{pct}
                        </Text>
                        <Text style={[styles.paymentAmount, { color: colors.textPrimary }]}>
                          {formatCurrency(p.amount)}
                        </Text>
                      </View>
                    </View>
                    <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
                      <View
                        style={[
                          styles.progressFill,
                          { width: `${pct}%`, backgroundColor: p.color || colors.primary },
                        ]}
                      />
                    </View>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )}
      </ScreenCard>

      {/* Personel Kartı — Grup Dağılımı Modalı */}
      <Modal
        visible={!!selectedGroupModalData}
        transparent
        animationType="fade"
        onRequestClose={() => setSelectedGroupModalData(null)}
      >
        <Pressable
          style={styles.modalBackdropCenter}
          onPress={() => setSelectedGroupModalData(null)}
        >
          <Pressable
            style={[
              styles.groupDistributionCard,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.modalHeaderRow}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6, flex: 1 }}>
                <Text style={[styles.modalHeaderTitle, { color: colors.textPrimary }]}>
                  {selectedGroupModalData?.label || "Personel Kart"} — Grup Dağılımı
                </Text>
                <Text style={[styles.modalHeaderSub, { color: colors.textMuted }]}>
                  ({formatCurrency(selectedGroupModalData?.amount)})
                </Text>
              </View>
              <TouchableOpacity
                style={styles.closeBtn}
                onPress={() => setSelectedGroupModalData(null)}
                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
              >
                <Text style={[styles.closeBtnText, { color: colors.textMuted }]}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={[styles.distTableHeader, { borderBottomColor: colors.border }]}>
              <Text style={[styles.distHeaderCell, { color: colors.textMuted, flex: 1.8 }]}>
                Grup
              </Text>
              <Text
                style={[
                  styles.distHeaderCell,
                  { color: colors.textMuted, flex: 1, textAlign: "center" },
                ]}
              >
                İşlem
              </Text>
              <Text
                style={[
                  styles.distHeaderCell,
                  { color: colors.textMuted, flex: 1.2, textAlign: "right" },
                ]}
              >
                Tutar
              </Text>
            </View>

            {groupsQuery.isLoading ? (
              <View style={styles.modalEmpty}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : (
              <ScrollView style={{ maxHeight: 300 }}>
                {calculatedGroups.length > 0 ? (
                  calculatedGroups.map((item: any, idx: number) => (
                    <View
                      key={`calc-group-${item.id ?? idx}-${idx}`}
                      style={[
                        styles.distTableRow,
                        idx !== calculatedGroups.length - 1 && {
                          borderBottomWidth: StyleSheet.hairlineWidth,
                          borderBottomColor: colors.border,
                        },
                      ]}
                    >
                      <View style={{ flex: 1.8 }}>
                        <Text style={[styles.distGroupName, { color: colors.textPrimary }]}>
                          {item.name}
                        </Text>
                        <Text style={[styles.distCardCount, { color: colors.textMuted }]}>
                          {item.card_count} kart
                        </Text>
                      </View>
                      <Text
                        style={[
                          styles.distCellText,
                          { color: colors.textPrimary, flex: 1, textAlign: "center" },
                        ]}
                      >
                        {item.count}
                      </Text>
                      <Text
                        style={[
                          styles.distAmountText,
                          { color: colors.textPrimary, flex: 1.2, textAlign: "right" },
                        ]}
                      >
                        {formatCurrency(item.amount)}
                      </Text>
                    </View>
                  ))
                ) : (
                  <View style={styles.modalEmpty}>
                    <Text style={[styles.emptyText, { color: colors.textMuted }]}>
                      Grup tanımlı değil.
                    </Text>
                  </View>
                )}
              </ScrollView>
            )}
          </Pressable>
        </Pressable>
      </Modal>

      <ScreenCard style={{ padding: 0, overflow: "hidden" }}>
        <Text style={[styles.cardTitle, styles.tableCardTitle, { color: colors.textPrimary }]}>
          En Çok Satan Cihazlar
        </Text>

        {topDevices.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
            ]}
          >
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Bu dönemde satış yok.
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.tableHeaderRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.tableHeaderText, { color: colors.textMuted, flex: 2 }]}>
                CİHAZ
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  { color: colors.textMuted, flex: 1, textAlign: "right" },
                ]}
              >
                CİRO
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  { color: colors.textMuted, flex: 1, textAlign: "right" },
                ]}
              >
                İŞLEM
              </Text>
            </View>

            {topDevices.map((d: any, index: number) => (
              <View
                key={`top-device-${d.sn ?? index}-${index}`}
                style={[
                  styles.tableDataRow,
                  { borderBottomColor: colors.border },
                  index % 2 === 1 && { backgroundColor: colors.bg },
                ]}
              >
                <TouchableOpacity
                  style={{ flex: 2 }}
                  onPress={() => goToDeviceDetail(navigation, d.sn, d.pos_name)}
                >
                  <Text style={[styles.deviceLink, { color: colors.primary }]} numberOfLines={1}>
                    {d.pos_name}
                  </Text>
                </TouchableOpacity>
                <Text
                  style={[
                    styles.tableCellStrong,
                    { color: colors.textPrimary, flex: 1, textAlign: "right" },
                  ]}
                >
                  {formatCurrency(d.revenue)}
                </Text>
                <Text
                  style={[
                    styles.tableCellMuted,
                    { color: colors.textMuted, flex: 1, textAlign: "right" },
                  ]}
                >
                  {d.tx_count}
                </Text>
              </View>
            ))}
          </>
        )}
      </ScreenCard>

      <ScreenCard style={{ padding: 0, overflow: "hidden" }}>
        <Text style={[styles.cardTitle, styles.tableCardTitle, { color: colors.textPrimary }]}>
          Son İşlemler
        </Text>

        {recentTx.length === 0 ? (
          <View
            style={[
              styles.emptyBox,
              { paddingHorizontal: spacing.lg, paddingBottom: spacing.lg },
            ]}
          >
            <Text style={[styles.emptyText, { color: colors.textMuted }]}>
              Bu dönemde işlem yok.
            </Text>
          </View>
        ) : (
          <>
            <View style={[styles.tableHeaderRow, { borderBottomColor: colors.border }]}>
              <Text style={[styles.tableHeaderText, { color: colors.textMuted, flex: 1.1 }]}>
                TARİH
              </Text>
              <Text style={[styles.tableHeaderText, { color: colors.textMuted, flex: 1.3 }]}>
                CİHAZ
              </Text>
              <Text style={[styles.tableHeaderText, { color: colors.textMuted, flex: 1.2 }]}>
                TİP
              </Text>
              <Text
                style={[
                  styles.tableHeaderText,
                  { color: colors.textMuted, flex: 1, textAlign: "right" },
                ]}
              >
                TUTAR
              </Text>
            </View>

            {recentTx.map((tx: any, index: number) => {
              const badgeColors = getPaymentBadgeColors(tx.pt_type_label, isDark);
              return (
                <View
                  key={`recent-tx-${tx.id ?? index}-${index}`}
                  style={[
                    styles.tableDataRow,
                    { borderBottomColor: colors.border },
                    index % 2 === 1 && { backgroundColor: colors.bg },
                  ]}
                >
                  <Text
                    style={[styles.tableCellMuted, { color: colors.textMuted, flex: 1.1 }]}
                    numberOfLines={1}
                  >
                    {formatDateTime(tx.datetime)}
                  </Text>
                  <TouchableOpacity
                    style={{ flex: 1.3 }}
                    onPress={() => goToDeviceDetail(navigation, tx.sn, tx.pos_name)}
                  >
                    <Text style={[styles.deviceLink, { color: colors.primary }]} numberOfLines={1}>
                      {tx.pos_name}
                    </Text>
                  </TouchableOpacity>
                  <View style={{ flex: 1.2 }}>
                    <View
                      style={[
                        styles.typeBadge,
                        { backgroundColor: badgeColors.bg, alignSelf: "flex-start" },
                      ]}
                    >
                      <Text
                        style={[styles.typeBadgeText, { color: badgeColors.text }]}
                        numberOfLines={1}
                      >
                        {tx.pt_type_label}
                      </Text>
                    </View>
                  </View>
                  <View
                    style={{
                      flex: 1,
                      flexDirection: "row",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <Text
                      style={[
                        styles.tableCellStrong,
                        { color: tx.status ? colors.textPrimary : colors.textMuted },
                        !tx.status && styles.strikethrough,
                      ]}
                    >
                      {formatCurrency(tx.amount)}
                    </Text>
                    <View
                      style={[
                        styles.statusIcon,
                        {
                          backgroundColor: tx.status
                            ? isDark
                              ? "#064E3B"
                              : "#E9F9EF"
                            : isDark
                            ? "#450A0A"
                            : "#FDECEC",
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.statusIconText,
                          { color: tx.status ? colors.success : colors.danger },
                        ]}
                      >
                        {tx.status ? "✓" : "✕"}
                      </Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </>
        )}
      </ScreenCard>
    </>
  );
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

function DotLine({
  color,
  text,
  textColor,
  style,
}: {
  color: string;
  text: string;
  textColor: string;
  style?: any;
}) {
  return (
    <View style={[styles.rowStart, style]}>
      <View style={[styles.dot, { backgroundColor: color }]} />
      <Text style={[styles.mutedTextSm, { color: textColor }]}>{text}</Text>
    </View>
  );
}

function createControlledSmoothPath(points: { x: number; y: number }[], bottomY: number): string {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;
  if (points.length === 2) return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;

  let path = `M ${points[0].x},${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p1 = points[i];
    const p2 = points[i + 1];

    const dx = p2.x - p1.x;
    const cp1x = p1.x + dx / 2.8;
    const cp2x = p2.x - dx / 2.8;

    const cp1y = Math.min(p1.y, bottomY);
    const cp2y = Math.min(p2.y, bottomY);

    path += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  return path;
}

const TOOLTIP_WIDTH = 118;
const TOOLTIP_HEIGHT = 52;

function SalesChart({
  data,
  colors,
  isDark,
}: {
  data: SalesPoint[];
  colors: any;
  isDark: boolean;
}) {
  const chartWidth = 320;
  const chartHeight = 180;
  const yAxisWidth = 40;
  const paddingTop = 10;
  const paddingBottom = 20;

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [plotContainerWidth, setPlotContainerWidth] = useState(chartWidth);

  const plotHeight = chartHeight - paddingTop - paddingBottom;
  const bottomY = paddingTop + plotHeight;

  const values = data.map((d) => d.value);
  const rawMax = Math.max(...values, 0);

  let niceMax = 1;
  let ySteps = 10;

  if (rawMax > 0) {
    if (rawMax <= 1) {
      niceMax = 1;
      ySteps = 10;
    } else if (rawMax <= 10) {
      niceMax = 10;
      ySteps = 10;
    } else {
      const magnitude = Math.pow(10, Math.floor(Math.log10(rawMax)));
      niceMax = Math.ceil(rawMax / magnitude) * magnitude;
      ySteps = 10;
    }
  }

  const stepValue = niceMax / ySteps;
  const yLabels = Array.from({ length: ySteps + 1 }, (_, i) => {
    const val = niceMax - i * stepValue;
    return val;
  });

  const stepX = data.length > 1 ? chartWidth / (data.length - 1) : chartWidth;

  const points = data.map((d, i) => {
    const x = data.length > 1 ? i * stepX : chartWidth / 2;
    const ratio = niceMax > 0 ? Math.min(Math.max(d.value / niceMax, 0), 1) : 0;
    const y = bottomY - ratio * plotHeight;
    return { x, y };
  });

  const smoothLinePath = createControlledSmoothPath(points, bottomY);
  const smoothAreaPath =
    points.length > 0
      ? `${smoothLinePath} L ${points[points.length - 1].x},${bottomY} L ${points[0].x},${bottomY} Z`
      : "";

  const verticalGridCount = 10;
  const vStepX = chartWidth / verticalGridCount;
  const vLines = Array.from({ length: verticalGridCount + 1 }, (_, i) => i * vStepX);

  const handleTouch = (evt: GestureResponderEvent) => {
    if (data.length === 0) return;
    const localX = evt.nativeEvent.locationX;
    const scaleX = plotContainerWidth > 0 ? chartWidth / plotContainerWidth : 1;
    const chartX = localX * scaleX;

    let nearestIndex = 0;
    let nearestDist = Infinity;
    points.forEach((p, i) => {
      const dist = Math.abs(p.x - chartX);
      if (dist < nearestDist) {
        nearestDist = dist;
        nearestIndex = i;
      }
    });
    setSelectedIndex(nearestIndex);
  };

  const clearSelection = () => setSelectedIndex(null);

  const scaleX = plotContainerWidth > 0 ? plotContainerWidth / chartWidth : 1;
  const selectedPoint = selectedIndex != null ? points[selectedIndex] : null;

  let tooltipLeft = 0;
  if (selectedPoint) {
    const rawLeft = selectedPoint.x * scaleX - TOOLTIP_WIDTH / 2;
    tooltipLeft = Math.max(0, Math.min(rawLeft, Math.max(plotContainerWidth - TOOLTIP_WIDTH, 0)));
  }
  const tooltipTop = selectedPoint ? Math.max(selectedPoint.y - TOOLTIP_HEIGHT - 10, 0) : 0;

  const labelInterval = Math.max(1, Math.ceil(data.length / 8));

  return (
    <View style={{ marginTop: spacing.md, flexDirection: "row" }}>
      <View
        style={{
          width: yAxisWidth,
          height: chartHeight,
          paddingTop: paddingTop - 6,
          justifyContent: "space-between",
          paddingBottom: paddingBottom - 6,
        }}
      >
        {yLabels.map((val, i) => {
          let formattedText = `₺${val}`;
          if (niceMax <= 1) {
            formattedText = `₺${val.toFixed(1).replace(".", ",")}`;
          } else if (val >= 1000) {
            formattedText = `₺${Math.round(val)}`;
          }
          return (
            <Text
              key={i}
              style={[styles.yAxisLabel, { color: isDark ? colors.textMuted : "#94A3B8" }]}
              numberOfLines={1}
            >
              {formattedText}
            </Text>
          );
        })}
      </View>

      <View
        style={{ flex: 1 }}
        onLayout={(e) => setPlotContainerWidth(e.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={handleTouch}
        onResponderMove={handleTouch}
        onResponderRelease={clearSelection}
        onResponderTerminate={clearSelection}
      >
        <Svg width="100%" height={chartHeight} viewBox={`0 0 ${chartWidth} ${chartHeight}`}>
          <Defs>
            <LinearGradient id="blueGradient" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#2563EB" stopOpacity="0.25" />
              <Stop offset="100%" stopColor="#2563EB" stopOpacity="0.0" />
            </LinearGradient>
          </Defs>

          {vLines.map((vx, i) => (
            <Line
              key={`v-${i}`}
              x1={vx}
              y1={paddingTop}
              x2={vx}
              y2={bottomY}
              stroke={isDark ? "#334155" : "#F1F5F9"}
              strokeWidth={1}
            />
          ))}

          {yLabels.map((_, i) => {
            const y = paddingTop + (plotHeight / ySteps) * i;
            return (
              <Line
                key={`h-${i}`}
                x1={0}
                y1={y}
                x2={chartWidth}
                y2={y}
                stroke={isDark ? "#334155" : "#F1F5F9"}
                strokeWidth={1}
              />
            );
          })}

          {smoothAreaPath !== "" && <Path d={smoothAreaPath} fill="url(#blueGradient)" />}

          {smoothLinePath !== "" && (
            <Path d={smoothLinePath} fill="none" stroke="#2563EB" strokeWidth={2.2} />
          )}

          {selectedPoint && (
            <>
              <Line
                x1={selectedPoint.x}
                y1={paddingTop}
                x2={selectedPoint.x}
                y2={bottomY}
                stroke="#2563EB"
                strokeWidth={1}
                strokeDasharray="4,4"
              />
              <Circle
                cx={selectedPoint.x}
                cy={selectedPoint.y}
                r={4.5}
                fill="#2563EB"
                stroke="#FFFFFF"
                strokeWidth={2}
              />
            </>
          )}
        </Svg>

        {selectedIndex != null && data[selectedIndex] && (
          <View
            style={[
              styles.chartTooltip,
              {
                left: tooltipLeft,
                top: tooltipTop,
                backgroundColor: isDark ? "#0F172A" : "#1E293B",
              },
            ]}
            pointerEvents="none"
          >
            <Text style={styles.chartTooltipDate}>{data[selectedIndex].date}</Text>
            <View style={styles.chartTooltipRow}>
              <View style={[styles.chartTooltipSwatch, { backgroundColor: "#2563EB" }]} />
              <Text style={styles.chartTooltipValue}>
                {formatCurrency(data[selectedIndex].value)}
              </Text>
            </View>
          </View>
        )}

        <View style={styles.xAxisRow}>
          {data.map((d, i) => {
            const isVisible =
              i === 0 ||
              i === data.length - 1 ||
              i % labelInterval === 0;

            return (
              <Text
                key={i}
                style={[
                  styles.xAxisLabel,
                  {
                    color: isDark ? colors.textMuted : "#94A3B8",
                    opacity: isVisible ? 1 : 0,
                  },
                ]}
                numberOfLines={1}
              >
                {d.date}
              </Text>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  greeting: { fontSize: 20, fontWeight: "700" },
  subGreeting: { fontSize: 13, marginTop: 2 },
  cardLabel: { fontSize: 13, fontWeight: "600" },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  bigNumberSm: { fontSize: 24, fontWeight: "700", marginTop: spacing.xs },
  mutedText: { fontSize: 12, marginTop: 2 },
  mutedTextSm: { fontSize: 11 },
  mutedCenter: { textAlign: "center" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowStart: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  grid2: { flexDirection: "row", flexWrap: "wrap", gap: spacing.md, justifyContent: "space-between" },
  gridCard: { width: "48%" },
  iconBubble: { width: 32, height: 32, borderRadius: 16, alignItems: "center", justifyContent: "center" },
  boldSm: { fontWeight: "700" },
  failGrid: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, marginTop: spacing.xs },
  yAxisLabel: { fontSize: 9, textAlign: "right", paddingRight: 6 },
  xAxisRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 4,
    paddingHorizontal: 2,
  },
  xAxisLabel: { fontSize: 9 },
  chartTooltip: {
    position: "absolute",
    width: TOOLTIP_WIDTH,
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },
  chartTooltipDate: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
  },
  chartTooltipRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  chartTooltipSwatch: {
    width: 8,
    height: 8,
    borderRadius: 2,
  },
  chartTooltipValue: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "700",
  },
  paymentRow: { paddingVertical: spacing.sm },
  paymentRowDivider: { borderBottomWidth: 1, marginBottom: spacing.xs },
  paymentLabel: { fontSize: 15, fontWeight: "500" },
  chevronIcon: { fontSize: 18, fontWeight: "600", marginLeft: 2 },
  paymentMeta: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  paymentMetaText: { fontSize: 12 },
  paymentAmount: { fontSize: 15, fontWeight: "700" },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    marginTop: spacing.xs,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: 3,
  },
  tableCardTitle: { paddingHorizontal: spacing.lg, paddingTop: spacing.lg, paddingBottom: spacing.sm },
  tableHeaderRow: {
    flexDirection: "row",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  tableHeaderText: {
    fontSize: 10,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  tableDataRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  deviceLink: {
    fontSize: 13,
    fontWeight: "500",
  },
  tableCellStrong: {
    fontSize: 13,
    fontWeight: "700",
  },
  tableCellMuted: {
    fontSize: 12,
  },
  strikethrough: {
    textDecorationLine: "line-through",
  },
  typeBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
  },
  typeBadgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  statusIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statusIconText: {
    fontSize: 11,
    fontWeight: "700",
  },
  emptyBox: {
    paddingVertical: 32,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyText: {
    fontSize: 13,
  },
  customRangeRow: {
    flexDirection: "row",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  dateInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: spacing.sm,
    paddingVertical: 10,
    fontSize: 13,
  },
  applyButton: {
    marginTop: spacing.sm,
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: "center",
  },
  applyButtonText: {
    color: "#FFFFFF",
    fontWeight: "700",
    fontSize: 13,
  },
  customRangeError: {
    marginTop: spacing.xs,
    fontSize: 12,
  },

  modalBackdropCenter: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.4)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  groupDistributionCard: {
    width: "100%",
    maxWidth: 380,
    borderRadius: radius.lg,
    padding: spacing.md,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 8,
  },
  modalHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingBottom: spacing.sm,
  },
  modalHeaderTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  modalHeaderSub: {
    fontSize: 12,
  },
  closeBtn: {
    padding: 4,
  },
  closeBtnText: {
    fontSize: 14,
    fontWeight: "700",
  },
  distTableHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.xs,
    borderBottomWidth: 1,
    marginTop: 4,
  },
  distHeaderCell: {
    fontSize: 11,
    fontWeight: "600",
  },
  distTableRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: spacing.sm,
  },
  distGroupName: {
    fontSize: 13,
    fontWeight: "600",
  },
  distCardCount: {
    fontSize: 11,
    marginTop: 1,
  },
  distCellText: {
    fontSize: 13,
  },
  distAmountText: {
    fontSize: 13,
    fontWeight: "700",
  },
  modalEmpty: {
    paddingVertical: spacing.lg,
    alignItems: "center",
  },
});