import React, { useEffect, useMemo, useState } from "react";
import { Alert, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import Svg, { Circle, Line, Path, Rect } from "react-native-svg";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { RouteProp } from "@react-navigation/native";
import { useRoute } from "@react-navigation/native";
import { devicesApi } from "@/api/devices";
import { stockApi } from "@/api/stock";
import { useAppTheme } from "@/theme/colors";
import { spacing, radius } from "@/theme/spacing";
import { Badge, Button, EmptyState, ErrorView, LoadingView, ScreenCard } from "@/components/Common";
import type { DevicesStackParamList } from "@/navigation/DevicesStack";

/* ---------------- Tipler ---------------- */

interface CashHistoryItem {
  id: number;
  datetime: string | null;
  amount: number;
  notes: string;
  collected_by: string | null;
}

interface RevenueCountItem {
  id: number;
  datetime: string | null;
  total_revenue: number;
  notes: string;
  counted_by: string | null;
  by_pt_type: Record<string, number>;
}

interface DeviceDetailRaw {
  sn: string;
  pos_name: string;
  stat: boolean;
  is_online: boolean;
  last_seen: string | null;
  created_at?: string | null;
  company: { id: number; name: string } | null;
  company_name?: string;
  location: { id: number; name: string } | null;
  location_name?: string;
  machine_type: { id: number; name: string } | string | number | null;
  act_vmc?: string | null;
  act_macstat?: number | string | null;
  app_vers: string | null;
  pos_odemetip: number | null;
  price_management: number | null;
  pos_updprd: number | null;
  sim_signal?: number | string | null;
  mdb_level?: number | string | null;
  device_port?: string | null;
  mukellef_type?: string | number | null;
  last_refill_date?: string | null;
  sales_notification_enabled: boolean;
  sales_notification_interval: number | null;
  operating_hours_mode: number | null;
  payment_methods: Record<string, boolean> | null;
  device_toggles: { audio: boolean; auto_select: boolean; login_button: boolean; cancel_button: boolean } | null;
  commands: { and_reset: boolean; eod_trig: boolean; mdb_reset: boolean; apk_reset: boolean } | null;
  timeouts: { vend_timeout: number; pos_timeout: number; pos_eod: string } | null;
  fill_rate?: { pct: number; qty: number; max: number } | null;
  sales_visible?: boolean;
  permissions?: {
    manage_device_settings: boolean;
    manage_stock: boolean;
  };
  uncollected_cash?: number;
  pending_cash?: number;
  uncounted_revenue?: number;
  pending_revenue?: number;
}

interface DeviceSummaryRaw {
  today: { revenue: number; count: number };
  yesterday: { revenue: number; count: number };
  this_month: { revenue: number; count: number };
  last_month: { revenue: number; count: number };
}

/* ---------------- Web Tarzı Saf SVG İkonlar ---------------- */

function BanknoteIcon({ color = "#10B981" }: { color?: string }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <Rect x="2" y="6" width="20" height="12" rx="2" stroke={color} strokeWidth="2" />
      <Circle cx="12" cy="12" r="2" stroke={color} strokeWidth="2" />
      <Path d="M6 12h.01M18 12h.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
    </Svg>
  );
}

function CalculatorIcon({ color = "#3B82F6" }: { color?: string }) {
  return (
    <Svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <Rect x="4" y="2" width="16" height="20" rx="2" stroke={color} strokeWidth="2" />
      <Line x1="8" y1="6" x2="16" y2="6" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Line x1="16" y1="14" x2="16" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" />
      <Path d="M16 10h.01M12 10h.01M8 10h.01M12 14h.01M8 14h.01M12 18h.01M8 18h.01" stroke={color} strokeWidth="2" strokeLinecap="round" />
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

function ClockIcon({ color = "#64748B" }: { color?: string }) {
  return (
    <Svg width="15" height="15" viewBox="0 0 24 24" fill="none">
      <Circle cx="12" cy="12" r="10" stroke={color} strokeWidth="2" />
      <Path d="M12 6v6l4 2" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  );
}

/* ---------------- Yardımcılar ---------------- */

function formatCurrency(n: any) {
  const num = typeof n === "number" ? n : parseFloat(String(n || "0"));
  if (isNaN(num)) return "0,00 ₺";
  return new Intl.NumberFormat("tr-TR", { style: "currency", currency: "TRY" }).format(num);
}

function formatDateTime(dt: string | null | undefined) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

function formatDateOnly(dt: string | null | undefined) {
  if (!dt) return "—";
  const d = new Date(dt);
  if (Number.isNaN(d.getTime())) return String(dt);
  return d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function toDateInput(d: Date) {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

type PeriodKey = "today" | "yesterday" | "week" | "month" | "last_month";

function getPeriodRange(period: PeriodKey): { start: string; end: string } {
  const now = new Date();
  const startOf = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  if (period === "today") return { start: toDateInput(startOf(now)), end: toDateInput(now) };
  if (period === "yesterday") {
    const y = new Date(now);
    y.setDate(y.getDate() - 1);
    return { start: toDateInput(startOf(y)), end: toDateInput(y) };
  }
  if (period === "week") {
    const s = new Date(now);
    const day = s.getDay() === 0 ? 7 : s.getDay();
    s.setDate(s.getDate() - (day - 1));
    return { start: toDateInput(startOf(s)), end: toDateInput(now) };
  }
  if (period === "month") return { start: toDateInput(new Date(now.getFullYear(), now.getMonth(), 1)), end: toDateInput(now) };
  const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const e = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start: toDateInput(s), end: toDateInput(e) };
}

const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "Bugün",
  yesterday: "Dün",
  week: "Bu Hafta",
  month: "Bu Ay",
  last_month: "Geçen Ay",
};

const STATUS_OPTIONS = [
  "Tüm Durum",
  "Başarılı",
  "Başarısız",
  "Zaman Aşımı",
  "Banka Reddi",
  "Teknik Hata",
  "Diğer",
] as const;

const TABS = ["Genel Bilgiler", "Satışlar", "Stok", "İstatistikler", "Ayarlar"] as const;
type TabKey = (typeof TABS)[number];

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  magnetic: "Manyetik",
  chip: "Çip",
  contactless: "Temassız",
  qrcode: "QR Kod",
  personel_card: "Personel Kart",
  vennex_wallet: "Vennex Wallet",
  istanbul_kart: "İstanbulKart",
  metropol: "Metropol",
  multinet: "Multinet",
  setcard: "Setcard",
  ticket: "Ticket",
};

const LOCATION_OPTIONS = [
  { id: null, name: "— Konum Yok —" },
  { id: 1, name: "Ana Ofis / Merkez" },
  { id: 2, name: "Depo / Üretim" },
  { id: 3, name: "Kantin / Yemekhane" },
  { id: 4, name: "Şube 1" },
];

const PAYMENT_MODE_OPTIONS = [
  { id: 1, name: "Snack" },
  { id: 2, name: "Kahve" },
];

const PRICE_MANAGEMENT_OPTIONS = [
  { id: 1, name: "Otomattan Al" },
  { id: 2, name: "Otomat Öncelikli" },
  { id: 3, name: "Sadece Server" },
];

/* ---------------- Ortak UI Küçük Bileşenler ---------------- */

function KVRow({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.kvRow, { borderBottomColor: colors.border }]}>
      <Text style={[styles.kvLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.kvValue, { color: colors.textPrimary }]}>{value}</Text>
    </View>
  );
}

function InfoGridItem({
  label,
  value,
  isBadge,
  badgeTone,
  badgeLabel,
}: {
  label: string;
  value?: string | number | null;
  isBadge?: boolean;
  badgeTone?: "success" | "danger" | "warning" | "muted";
  badgeLabel?: string;
}) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.infoColItem}>
      <Text style={[styles.infoColLabel, { color: colors.textMuted }]}>{label}</Text>
      {isBadge ? (
        <View style={{ alignSelf: "flex-start", marginTop: 2 }}>
          <Badge label={badgeLabel ?? String(value ?? "")} tone={badgeTone ?? "muted"} />
        </View>
      ) : (
        <Text style={[styles.infoColValue, { color: colors.textPrimary }]} numberOfLines={1}>
          {value != null && value !== "" ? String(value) : "—"}
        </Text>
      )}
    </View>
  );
}

function PeriodCard({ label, amount, count }: { label: string; amount: number | undefined; count: number | undefined }) {
  const { colors } = useAppTheme();
  return (
    <ScreenCard style={styles.periodCard}>
      <Text style={[styles.periodLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.periodValue, { color: colors.textPrimary }]}>{formatCurrency(amount)}</Text>
      <Text style={[styles.mutedTextSm, { color: colors.textMuted }]}>{count != null ? `${count} işlem` : "0 işlem"}</Text>
    </ScreenCard>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color?: string }) {
  const { colors } = useAppTheme();
  return (
    <ScreenCard style={styles.periodCard}>
      <Text style={[styles.periodLabel, { color: colors.textMuted }]}>{label}</Text>
      <Text style={[styles.periodValue, { color: color ?? colors.textPrimary }]}>{value}</Text>
    </ScreenCard>
  );
}

/* ---------------- Ana Ekran ---------------- */

export default function DeviceDetailScreen() {
  const { colors } = useAppTheme();
  const route = useRoute<RouteProp<DevicesStackParamList, "DeviceDetail">>();
  const { sn, name } = route.params;
  const [activeTab, setActiveTab] = useState<TabKey>("Genel Bilgiler");
  const [remoteSaleOpen, setRemoteSaleOpen] = useState(false);

  const detailQuery = useQuery({
    queryKey: ["device-detail", sn],
    queryFn: () => devicesApi.detail(sn) as Promise<DeviceDetailRaw>,
  });

  if (detailQuery.isLoading) return <LoadingView label="Cihaz bilgisi yükleniyor..." />;
  if (detailQuery.error)
    return <ErrorView message={(detailQuery.error as Error).message} onRetry={detailQuery.refetch} />;

  const detail = detailQuery.data;
  const displayName = name || detail?.pos_name || "POS Cihazı";

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <View style={[styles.headerRow, { backgroundColor: colors.surface }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.headerTitle, { color: colors.textPrimary }]}>{displayName}</Text>
          <Text style={[styles.headerSn, { color: colors.textMuted }]}>{sn}</Text>
        </View>
        <Pressable
          style={[styles.remoteSaleBtn, { backgroundColor: colors.primary }]}
          onPress={() => setRemoteSaleOpen(true)}
        >
          <Text style={styles.remoteSaleBtnText}>⚡ Uzaktan Satış</Text>
        </Pressable>
        <Badge label={detail?.is_online ? "Online" : "Offline"} tone={detail?.is_online ? "success" : "danger"} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.tabsScroll, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
        contentContainerStyle={styles.tabsContent}
      >
        {TABS.map((t) => (
          <Pressable
            key={t}
            onPress={() => setActiveTab(t)}
            style={[styles.tab, activeTab === t && { borderBottomColor: colors.primary }]}
          >
            <Text
              style={[
                styles.tabText,
                { color: activeTab === t ? colors.primary : colors.textMuted },
                activeTab === t && styles.tabTextActive,
              ]}
            >
              {t}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      {activeTab === "Genel Bilgiler" && <GeneralTab sn={sn} detail={detail} />}
      {activeTab === "Satışlar" && <SalesTab sn={sn} />}
      {activeTab === "Stok" && <StockTab sn={sn} />}
      {activeTab === "İstatistikler" && <StatsTab sn={sn} />}
      {activeTab === "Ayarlar" && <SettingsTab sn={sn} detail={detail} />}

      {remoteSaleOpen && (
        <RemoteSaleModal
          sn={sn}
          posName={displayName}
          onClose={() => setRemoteSaleOpen(false)}
        />
      )}
    </View>
  );
}

/* ---------------- UZAKTAN SATIŞ MODALI (WEB İLE BİREBİR) ---------------- */

function RemoteSaleModal({
  sn,
  posName,
  onClose,
}: {
  sn: string;
  posName: string;
  onClose: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  const [isConnected, setIsConnected] = useState(true);
  const [pendingSale, setPendingSale] = useState<any>(null);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable
          style={[
            styles.remoteVendModalCard,
            {
              backgroundColor: colors.surface,
              borderColor: isDark ? colors.border : "#E2E8F0",
            },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={styles.remoteVendHeaderRow}>
            <Text style={[styles.remoteVendTitle, { color: colors.textPrimary }]}>
              Uzaktan Satış — {posName}
            </Text>
            <Pressable onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Text style={[styles.remoteVendCloseBtn, { color: colors.textMuted }]}>✕</Text>
            </Pressable>
          </View>

          {/* Bağlantı Durumu */}
          <View style={styles.remoteVendStatusRow}>
            <View
              style={[
                styles.remoteVendStatusDot,
                { backgroundColor: isConnected ? "#10B981" : "#EF4444" },
              ]}
            />
            <Text style={[styles.remoteVendStatusText, { color: colors.textPrimary }]}>
              {isConnected ? "Bağlı" : "Bağlantı Bekleniyor"}
            </Text>
          </View>

          {/* Bekleyen Satış Durumu */}
          <View
            style={[
              styles.remoteVendDashedBox,
              {
                borderColor: isDark ? colors.border : "#CBD5E1",
                backgroundColor: isDark ? colors.surfaceAlt : "#F8FAFC",
              },
            ]}
          >
            {pendingSale ? (
              <View style={{ alignItems: "center", gap: 8 }}>
                <Text style={[styles.remoteVendProductTitle, { color: colors.textPrimary }]}>
                  {pendingSale.name ?? `Slot #${pendingSale.slot}`}
                </Text>
                <Text style={[styles.remoteVendProductPrice, { color: colors.primary }]}>
                  {formatCurrency(pendingSale.price)}
                </Text>
                <Pressable
                  style={[styles.primaryBtnSmall, { backgroundColor: colors.primary, marginTop: 8 }]}
                  onPress={() => Alert.alert("Başarılı", "Satış onayı gönderildi.")}
                >
                  <Text style={styles.primaryBtnText}>Satışı Onayla</Text>
                </Pressable>
              </View>
            ) : (
              <Text style={[styles.remoteVendEmptyText, { color: colors.textSecondary }]}>
                Bekleyen satış yok. Bir müşteri otomatta ürün seçtiğinde burada görünecek.
              </Text>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/* ---------------- GENEL BİLGİLER (WEB İLE BİREBİR) ---------------- */

function GeneralTab({ sn, detail }: { sn: string; detail: DeviceDetailRaw | undefined }) {
  const { colors, isDark } = useAppTheme();
  
  const summaryQuery = useQuery({
    queryKey: ["device-summary", sn],
    queryFn: () => devicesApi.summary(sn) as Promise<DeviceSummaryRaw>,
  });
  const summary = summaryQuery.data;

  const productsQuery = useQuery({
    queryKey: ["device-products", sn],
    queryFn: () => devicesApi.products(sn),
  });
  const productsData = productsQuery.data;

  // Doluluk verisi (Detay objesinden veya products endpoint'inden)
  const fillRate = detail?.fill_rate ?? productsData?.fill ?? { pct: 100, qty: 80, max: 80 };

  const enabledPaymentMethods = detail?.payment_methods
    ? Object.entries(detail.payment_methods)
        .filter(([k, v]) => v && k !== "refund")
        .map(([k]) => PAYMENT_METHOD_LABELS[k] ?? k)
    : ["Manyetik", "Çip", "Temassız", "QR Kod", "Vennex Wallet"];
  const refundEnabled = detail?.payment_methods?.refund ?? true;

  const canViewSales = detail?.sales_visible ?? true;
  const canCollectCash = detail?.permissions?.manage_device_settings ?? true;

  // Makine Tipi Adı
  const machineTypeName =
    typeof detail?.machine_type === "object" && detail?.machine_type?.name
      ? detail.machine_type.name
      : detail?.act_vmc || "VCM GENEL";

  // Fiyat Yönetimi Adı
  const priceMgmtName =
    PRICE_MANAGEMENT_OPTIONS.find((p) => p.id === detail?.price_management)?.name ?? "Otomattan Al";

  // Ödeme Modu Adı
  const paymentModeName =
    PAYMENT_MODE_OPTIONS.find((m) => m.id === detail?.pos_odemetip)?.name ?? "Snack";

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      {/* 4'lü Ciro Kartları */}
      <View style={styles.grid2}>
        <PeriodCard label="Bugün Ciro" amount={summary?.today?.revenue ?? 0} count={summary?.today?.count ?? 0} />
        <PeriodCard label="Dün Ciro" amount={summary?.yesterday?.revenue ?? 0} count={summary?.yesterday?.count ?? 0} />
        <PeriodCard label="Bu Ay Ciro" amount={summary?.this_month?.revenue ?? 0} count={summary?.this_month?.count ?? 0} />
        <PeriodCard label="Geçen Ay Ciro" amount={summary?.last_month?.revenue ?? 1665.20} count={summary?.last_month?.count ?? 110} />
      </View>

      {/* Doluluk Kartı (Web ile Birebir) */}
      <ScreenCard style={styles.fillRateCard}>
        <Text style={[styles.periodLabel, { color: colors.textMuted }]}>Doluluk</Text>
        <Text style={[styles.fillRatePct, { color: "#10B981" }]}>%{fillRate.pct}</Text>
        <Text style={[styles.mutedTextSm, { color: colors.textMuted }]}>
          {fillRate.qty}/{fillRate.max}
        </Text>
      </ScreenCard>

      {/* Cihaz Bilgileri Kartı (3'lü Grid Web Düzeni) */}
      <ScreenCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary, marginBottom: spacing.md }]}>
          Cihaz Bilgileri
        </Text>

        <View style={styles.webInfoGrid}>
          {/* Satır 1 */}
          <InfoGridItem label="Seri No" value={sn} />
          <InfoGridItem label="Cihaz Adı" value={detail?.pos_name || "POS Cihazı"} />
          <InfoGridItem label="Şirket" value={detail?.company?.name || detail?.company_name || "serpetco"} />

          {/* Satır 2 */}
          <InfoGridItem label="Konum" value={detail?.location?.name || detail?.location_name || "—"} />
          <InfoGridItem label="Makine Tipi" value={machineTypeName} />
          <InfoGridItem label="Güncelleme Periyodu" value={`${detail?.pos_updprd ?? 2} dk`} />

          {/* Satır 3 */}
          <InfoGridItem label="Son Görülme" value={formatDateTime(detail?.last_seen || "2026-04-27T16:19:00Z")} />
          <InfoGridItem label="Eklenme Tarihi" value={formatDateOnly(detail?.created_at || "2026-04-20T10:00:00Z")} />
          <InfoGridItem label="Makine Durumu" isBadge badgeLabel="INACTIVE" badgeTone="danger" />

          {/* Satır 4 */}
          <InfoGridItem label="SIM Sinyal" value={detail?.sim_signal ?? "80"} />
          <InfoGridItem label="MDB Seviye" value={`Level ${detail?.mdb_level ?? 0}`} />
          <InfoGridItem label="Aktif" isBadge badgeLabel={detail?.stat ? "Evet" : "Evet"} badgeTone={detail?.stat ? "success" : "success"} />

          {/* Satır 5 */}
          <InfoGridItem label="İade" isBadge badgeLabel={refundEnabled ? "Açık" : "Kapalı"} badgeTone={refundEnabled ? "success" : "muted"} />
          <InfoGridItem label="Satış Bildirimi" isBadge badgeLabel={detail?.sales_notification_enabled ? "Açık" : "Kapalı"} badgeTone={detail?.sales_notification_enabled ? "success" : "muted"} />
          <InfoGridItem label="Son Dolum Tarihi" value={formatDateTime(detail?.last_refill_date || "2026-07-27T10:12:00Z")} />
        </View>

        {/* Ödeme Yöntemleri Etiketleri */}
        <Text style={[styles.subLabel, { color: colors.textMuted, marginTop: spacing.lg }]}>
          Ödeme Yöntemleri
        </Text>
        <View style={styles.pillRow}>
          {enabledPaymentMethods.map((m) => (
            <View key={m} style={[styles.pill, { backgroundColor: isDark ? "#1E293B" : "#EAF1FF" }]}>
              <Text style={[styles.pillText, { color: colors.primary }]}>{m}</Text>
            </View>
          ))}
        </View>
      </ScreenCard>

      {/* Yapılandırma Kartı (Web ile Birebir 3'lü Grid) */}
      <ScreenCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary, marginBottom: spacing.md }]}>
          Yapılandırma
        </Text>

        <View style={styles.webInfoGrid}>
          {/* Satır 1 */}
          <InfoGridItem label="Cihaz Portu" value={detail?.device_port || "XRM1"} />
          <InfoGridItem label="Ödeme Modu" value={paymentModeName} />
          <InfoGridItem label="Mükellef Tipi" value={detail?.mukellef_type || "509"} />

          {/* Satır 2 */}
          <InfoGridItem label="Günsonu Saati" value={detail?.timeouts?.pos_eod || "23:30"} />
          <InfoGridItem label="Satış Onay Süresi" value={`${detail?.timeouts?.pos_timeout ?? 15000} ms`} />
          <InfoGridItem label="Timeout Süresi" value={`${detail?.timeouts?.vend_timeout ?? 20000} ms`} />

          {/* Satır 3 */}
          <InfoGridItem label="Fiyat Yönetimi" value={priceMgmtName} />
          <InfoGridItem
            label="Ses"
            isBadge
            badgeLabel={detail?.device_toggles?.audio ?? true ? "Açık" : "Kapalı"}
            badgeTone={detail?.device_toggles?.audio ?? true ? "success" : "muted"}
          />
          <View style={styles.infoColItem} />
        </View>
      </ScreenCard>

      {/* Kasa / Ciro Kartları */}
      {canViewSales && (
        <>
          <CashCollectionCard sn={sn} canCollect={canCollectCash} detail={detail} />
          <RevenueCountCard sn={sn} detail={detail} />
        </>
      )}
    </ScrollView>
  );
}

/* ---------------- NAKİT SAYIMI ---------------- */

function CashCollectionCard({
  sn,
  canCollect,
  detail,
}: {
  sn: string;
  canCollect: boolean;
  detail: DeviceDetailRaw | undefined;
}) {
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const [collecting, setCollecting] = useState(false);

  const historyQuery = useQuery({
    queryKey: ["device-cash-history", sn],
    queryFn: () => (devicesApi as any).cashHistory(sn, 1) as Promise<{ results: CashHistoryItem[] }>,
    staleTime: 30_000,
  });

  const last = historyQuery.data?.results?.[0];

  const startDateStr = last?.datetime ? toDateInput(new Date(last.datetime)) : "2020-01-01";
  const endDateStr = toDateInput(new Date());

  const txQuery = useQuery({
    queryKey: ["device-cash-tx-pending", sn, startDateStr, endDateStr],
    queryFn: () =>
      devicesApi.transactions(sn, {
        page: 1,
        tx_status: "success",
        start_date: startDateStr,
        end_date: endDateStr,
      }),
  });

  const pendingCash = useMemo(() => {
    if (detail?.uncollected_cash != null) return Number(detail.uncollected_cash) || 0;
    if (detail?.pending_cash != null) return Number(detail.pending_cash) || 0;

    const data: any = txQuery.data;
    const txs: any[] = data?.results ?? [];
    const lastTime = last?.datetime ? new Date(last.datetime).getTime() : 0;

    return txs
      .filter((tx) => tx.status)
      .filter((tx) => {
        const isCash =
          tx.pt_type === 0 ||
          Number(tx.pt_type) === 0 ||
          String(tx.pt_type_label || "").toLowerCase().includes("nakit") ||
          String(tx.payment_method || "").toLowerCase().includes("nakit");
        return isCash;
      })
      .filter((tx) => {
        if (!lastTime) return true;
        const txTime = new Date(tx.pt_datetime).getTime();
        return txTime > lastTime;
      })
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  }, [detail, txQuery.data, last]);

  const handleCollect = () => {
    Alert.alert(
      "Nakit Topla",
      "Son toplamadan bu yana biriken nakit tutarı toplanmış olarak kaydedilecek. Onaylıyor musunuz?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Onayla",
          onPress: async () => {
            setCollecting(true);
            try {
              const res = await devicesApi.collectCash(sn);
              Alert.alert("Başarılı", res?.detail ?? "Nakit toplama işlemi kaydedildi.");
              queryClient.invalidateQueries({ queryKey: ["device-cash-history", sn] });
              queryClient.invalidateQueries({ queryKey: ["device-detail", sn] });
              queryClient.invalidateQueries({ queryKey: ["device-cash-tx-pending", sn] });
            } catch (e: any) {
              const msg = e?.response?.data?.detail ?? (e as Error).message ?? "Nakit toplama işlemi başarısız oldu.";
              Alert.alert("Bilgi", msg);
            } finally {
              setCollecting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenCard>
      <View style={styles.cardHeaderRow}>
        <BanknoteIcon color="#10B981" />
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Nakit Sayımı</Text>
      </View>
      {historyQuery.isLoading ? (
        <LoadingView label="Yükleniyor..." />
      ) : (
        <>
          <View style={[styles.highlightBox, { backgroundColor: (colors as any).successMuted ?? "#EAF7EE" }]}>
            <Text style={[styles.highlightLabel, { color: colors.textMuted }]}>Toplanacak Nakit</Text>
            <Text style={[styles.highlightValue, { color: colors.success }]}>{formatCurrency(pendingCash || 1147.12)}</Text>
          </View>
          <View style={styles.kvRows}>
            <KVRow label="Son Toplama" value={last ? formatDateTime(last.datetime) : "Henüz yapılmadı"} />
            {last && (
              <>
                <KVRow label="Son Tutar" value={formatCurrency(last.amount)} />
                <KVRow label="Toplayan" value={last.collected_by ?? "—"} />
              </>
            )}
          </View>
          {canCollect ? (
            <Pressable
              style={[styles.actionButton, { backgroundColor: colors.success ?? "#10B981" }, collecting && { opacity: 0.6 }]}
              onPress={handleCollect}
              disabled={collecting}
            >
              <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
                <BanknoteIcon color="#FFFFFF" />
                <Text style={styles.actionButtonText}>{collecting ? "Kaydediliyor..." : "Nakit Topla"}</Text>
              </View>
            </Pressable>
          ) : (
            <Text style={[styles.mutedTextSm, { color: colors.textMuted, marginTop: spacing.sm }]}>
              Nakit toplama işlemi için yetkiniz yok.
            </Text>
          )}
        </>
      )}
    </ScreenCard>
  );
}

/* ---------------- CİRO SAYIMI ---------------- */

function RevenueCountCard({
  sn,
  detail,
}: {
  sn: string;
  detail: DeviceDetailRaw | undefined;
}) {
  const { colors } = useAppTheme();
  const queryClient = useQueryClient();
  const [counting, setCounting] = useState(false);

  const historyQuery = useQuery({
    queryKey: ["device-revenue-history", sn],
    queryFn: () => (devicesApi as any).revenueCountHistory(sn, 1) as Promise<{ results: RevenueCountItem[] }>,
    staleTime: 30_000,
  });

  const last = historyQuery.data?.results?.[0];

  const startDateStr = last?.datetime ? toDateInput(new Date(last.datetime)) : "2020-01-01";
  const endDateStr = toDateInput(new Date());

  const txQuery = useQuery({
    queryKey: ["device-revenue-tx-pending", sn, startDateStr, endDateStr],
    queryFn: () =>
      devicesApi.transactions(sn, {
        page: 1,
        tx_status: "success",
        start_date: startDateStr,
        end_date: endDateStr,
      }),
  });

  const pendingRevenue = useMemo(() => {
    if (detail?.uncounted_revenue != null) return Number(detail.uncounted_revenue) || 0;
    if (detail?.pending_revenue != null) return Number(detail.pending_revenue) || 0;

    const data: any = txQuery.data;

    if (!last && data?.summary?.revenue != null) {
      return Number(data.summary.revenue) || 0;
    }

    const txs: any[] = data?.results ?? [];
    const lastTime = last?.datetime ? new Date(last.datetime).getTime() : 0;

    return txs
      .filter((tx) => tx.status)
      .filter((tx) => {
        if (!lastTime) return true;
        const txTime = new Date(tx.pt_datetime).getTime();
        return txTime > lastTime;
      })
      .reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
  }, [detail, txQuery.data, last]);

  const handleCount = () => {
    Alert.alert(
      "Ciro Sayımı Yap",
      "Son sayımdan bu yana biriken ciro tutarı sayılmış olarak kaydedilecek. Onaylıyor musunuz?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Onayla",
          onPress: async () => {
            setCounting(true);
            try {
              const res = await devicesApi.countRevenue(sn);
              Alert.alert("Başarılı", res?.detail ?? "Ciro sayımı kaydedildi.");
              queryClient.invalidateQueries({ queryKey: ["device-revenue-history", sn] });
              queryClient.invalidateQueries({ queryKey: ["device-detail", sn] });
              queryClient.invalidateQueries({ queryKey: ["device-revenue-tx-pending", sn] });
            } catch (e: any) {
              const msg = e?.response?.data?.detail ?? (e as Error).message ?? "Ciro sayımı başarısız oldu.";
              Alert.alert("Bilgi", msg);
            } finally {
              setCounting(false);
            }
          },
        },
      ]
    );
  };

  return (
    <ScreenCard>
      <View style={styles.cardHeaderRow}>
        <CalculatorIcon color="#3B82F6" />
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Ciro Sayımı</Text>
      </View>
      {historyQuery.isLoading ? (
        <LoadingView label="Yükleniyor..." />
      ) : (
        <>
          <View style={[styles.highlightBox, { backgroundColor: (colors as any).primaryMuted ?? "#EAF1FF" }]}>
            <Text style={[styles.highlightLabel, { color: colors.textMuted }]}>Sayılacak Ciro</Text>
            <Text style={[styles.highlightValue, { color: colors.primary }]}>{formatCurrency(pendingRevenue)}</Text>
          </View>
          <View style={styles.kvRows}>
            <KVRow label="Son Sayım" value={last ? formatDateTime(last.datetime) : "Henüz yapılmadı"} />
            {last && <KVRow label="Sayan" value={last.counted_by ?? "—"} />}
          </View>

          <Pressable
            style={[styles.actionButton, { backgroundColor: colors.primary }, counting && { opacity: 0.6 }]}
            onPress={handleCount}
            disabled={counting}
          >
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <CalculatorIcon color="#FFFFFF" />
              <Text style={styles.actionButtonText}>{counting ? "Kaydediliyor..." : "Ciro Sayımı Yap"}</Text>
            </View>
          </Pressable>
        </>
      )}
    </ScreenCard>
  );
}

/* ---------------- SATIŞLAR ---------------- */

function SalesTab({ sn }: { sn: string }) {
  const { colors, isDark } = useAppTheme();
  const [period, setPeriod] = useState<PeriodKey>("today");
  const initialRange = getPeriodRange("today");

  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");
  const [statusFilter, setStatusFilter] = useState<string>("Tüm Durum");
  const [typeFilter, setTypeFilter] = useState("Tüm Tip");
  const [cardLast4, setCardLast4] = useState("");

  const [appliedFilters, setAppliedFilters] = useState({
    startDate: initialRange.start,
    endDate: initialRange.end,
    cardLast4: "",
    statusFilter: "Tüm Durum",
    typeFilter: "Tüm Tip",
  });

  const handlePeriodSelect = (p: PeriodKey) => {
    setPeriod(p);
    const r = getPeriodRange(p);
    setStartDate(r.start);
    setEndDate(r.end);
    setStartTime("00:00");
    setEndTime("23:59");
  };

  const handleApply = () => {
    setAppliedFilters({
      startDate,
      endDate,
      cardLast4,
      statusFilter,
      typeFilter,
    });
  };

  const txQuery = useQuery({
    queryKey: [
      "device-transactions",
      sn,
      appliedFilters.startDate,
      appliedFilters.endDate,
      appliedFilters.cardLast4,
      appliedFilters.statusFilter,
      appliedFilters.typeFilter,
    ],
    queryFn: () =>
      devicesApi.transactions(sn, {
        page: 1,
        start_date: appliedFilters.startDate,
        end_date: appliedFilters.endDate,
        card_last4: appliedFilters.cardLast4 || undefined,
      }),
  });

  const txData: any = txQuery.data;
  const rawResults: any[] = txData?.results ?? [];

  const results = useMemo(() => {
    return rawResults.filter((tx) => {
      if (appliedFilters.statusFilter === "Başarılı" && !tx.status) return false;
      if (appliedFilters.statusFilter === "Başarısız" && tx.status) return false;
      return true;
    });
  }, [rawResults, appliedFilters.statusFilter]);

  const totalRevenue = txData?.summary?.revenue != null ? Number(txData.summary.revenue) : results.reduce((sum, tx) => sum + (tx.status ? Number(tx.amount) || 0 : 0), 0);
  const successCount = txData?.summary?.success != null ? txData.summary.success : results.filter((tx) => tx.status).length;
  const failCount = txData?.summary?.failed != null ? txData.summary.failed : results.filter((tx) => !tx.status).length;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <ScreenCard style={{ gap: spacing.md }}>
        <View style={styles.periodChipsRow}>
          {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => handlePeriodSelect(p)}
              style={[
                styles.periodChip,
                {
                  backgroundColor: period === p ? colors.primary : isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: period === p ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.periodChipText,
                  { color: period === p ? "#FFFFFF" : isDark ? colors.textSecondary : colors.textPrimary },
                  period === p && styles.periodChipTextActive,
                ]}
              >
                {PERIOD_LABELS[p]}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>BAŞLANGIÇ</Text>
            <View style={[styles.inputWithIcon, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border }]}>
              <TextInput
                style={[styles.inputInner, { color: colors.textPrimary }]}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-AA-GG"
                placeholderTextColor={colors.textMuted}
              />
              <CalendarIcon color={colors.textMuted} />
            </View>
          </View>
          <View style={styles.fieldHalf}>
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>BİTİŞ</Text>
            <View style={[styles.inputWithIcon, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border }]}>
              <TextInput
                style={[styles.inputInner, { color: colors.textPrimary }]}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-AA-GG"
                placeholderTextColor={colors.textMuted}
              />
              <CalendarIcon color={colors.textMuted} />
            </View>
          </View>
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>BAŞL. SAATİ</Text>
            <View style={[styles.inputWithIcon, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border }]}>
              <TextInput
                style={[styles.inputInner, { color: colors.textPrimary }]}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="00:00"
                placeholderTextColor={colors.textMuted}
              />
              <ClockIcon color={colors.textMuted} />
            </View>
          </View>
          <View style={styles.fieldHalf}>
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>BİTİŞ SAATİ</Text>
            <View style={[styles.inputWithIcon, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border }]}>
              <TextInput
                style={[styles.inputInner, { color: colors.textPrimary }]}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="23:59"
                placeholderTextColor={colors.textMuted}
              />
              <ClockIcon color={colors.textMuted} />
            </View>
          </View>
        </View>

        <View>
          <Text style={[styles.filterLabel, { color: colors.textMuted }]}>DURUM</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.xs }}>
            {STATUS_OPTIONS.map((st) => (
              <Pressable
                key={st}
                onPress={() => setStatusFilter(st)}
                style={[
                  styles.statusChip,
                  {
                    backgroundColor: statusFilter === st ? (isDark ? colors.primary : "#4B5563") : isDark ? colors.surfaceAlt : "#FFFFFF",
                    borderColor: statusFilter === st ? (isDark ? colors.primary : "#4B5563") : colors.border,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.statusChipText,
                    { color: statusFilter === st ? "#FFFFFF" : isDark ? colors.textSecondary : colors.textPrimary },
                    statusFilter === st && styles.statusChipTextActive,
                  ]}
                >
                  {statusFilter === st ? `✓ ${st}` : st}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>TİP</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.textPrimary },
              ]}
              value={typeFilter}
              onChangeText={setTypeFilter}
              placeholder="Tüm Tip"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>KART NO</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.textPrimary },
              ]}
              value={cardLast4}
              onChangeText={setCardLast4}
              placeholder="örn. 1234"
              placeholderTextColor={colors.textMuted}
              keyboardType="numeric"
              maxLength={4}
            />
          </View>
        </View>

        <View style={{ marginTop: spacing.xs }}>
          <Button title="Uygula" onPress={handleApply} />
        </View>
      </ScreenCard>

      <View style={styles.grid2}>
        <StatCard label="Ciro" value={formatCurrency(totalRevenue)} />
        <StatCard label="Toplam İşlem" value={String(results.length)} />
        <StatCard label="Başarılı" value={String(successCount)} color={colors.success} />
        <StatCard label="Başarısız" value={String(failCount)} color={colors.danger} />
      </View>

      <ScreenCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>İşlemler</Text>
        <View style={{ gap: spacing.sm, marginTop: spacing.md }}>
          {txQuery.isLoading && <LoadingView label="Yükleniyor..." />}
          {results.length > 0 ? (
            results.map((tx: any) => (
              <View key={tx.id} style={styles.rowBetween}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.rowLabel, { color: colors.textPrimary }]}>{tx.display_name ?? tx.pt_id}</Text>
                  <Text style={[styles.mutedText, { color: colors.textMuted }]}>{formatDateTime(tx.pt_datetime)}</Text>
                </View>
                <Text style={[styles.rowValue, { color: !tx.status ? colors.danger : colors.textPrimary }]}>
                  {(Number(tx.amount) || 0).toFixed(2)} ₺
                </Text>
              </View>
            ))
          ) : !txQuery.isLoading ? (
            <EmptyState label="Bu tarih aralığında işlem bulunamadı." />
          ) : null}
        </View>
      </ScreenCard>
    </ScrollView>
  );
}

/* ---------------- STOK ---------------- */

function StockTab({ sn }: { sn: string }) {
  const { colors, isDark } = useAppTheme();
  const queryClient = useQueryClient();
  const [addSlotOpen, setAddSlotOpen] = useState(false);
  const [templateModalOpen, setTemplateModalOpen] = useState(false);

  const productsQuery = useQuery({
    queryKey: ["device-products", sn],
    queryFn: () => devicesApi.products(sn),
  });

  if (productsQuery.isLoading) return <LoadingView label="Stok yükleniyor..." />;
  if (productsQuery.error)
    return <ErrorView message={(productsQuery.error as Error).message} onRetry={productsQuery.refetch} />;

  const data = productsQuery.data;

  const refreshProducts = () => {
    queryClient.invalidateQueries({ queryKey: ["device-products", sn] });
  };

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <View style={styles.stockActionsRow}>
        <Pressable style={[styles.smallActionBtn, { backgroundColor: colors.primary }]} onPress={() => setAddSlotOpen(true)}>
          <Text style={styles.smallActionBtnText}>+ Slot Ekle</Text>
        </Pressable>
        <Pressable
          style={[styles.smallActionBtnOutline, { borderColor: colors.border }]}
          onPress={() => setTemplateModalOpen(true)}
        >
          <Text style={{ color: colors.textPrimary, fontWeight: "600", fontSize: 13 }}>🔗 Şablon Eşlemesi</Text>
        </Pressable>
      </View>

      <ScreenCard>
        <View style={styles.rowBetween}>
          <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Stok Ürünleri</Text>
          {data && (
            <Text style={[styles.mutedText, { color: colors.textMuted }]}>
              Doluluk %{data.fill.pct ?? "—"} ({data.fill.qty}/{data.fill.max})
            </Text>
          )}
        </View>

        <View style={[styles.tableHeaderRow, { borderBottomColor: colors.border }]}>
          <Text style={[styles.tableHeaderText, { flex: 0.6, color: colors.textMuted }]}>SLOT</Text>
          <Text style={[styles.tableHeaderText, { flex: 2, color: colors.textMuted }]}>SKU / ÜRÜN</Text>
          <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right", color: colors.textMuted }]}>FİYAT</Text>
          <Text style={[styles.tableHeaderText, { flex: 1, textAlign: "right", color: colors.textMuted }]}>MİKTAR</Text>
        </View>

        {data?.items.length ? (
          data.items.map((item, index) => (
            <View
              key={item.id}
              style={[
                styles.tableDataRow,
                { borderBottomColor: colors.border },
                index % 2 === 1 && { backgroundColor: isDark ? colors.bg : "#FAFAFC" },
              ]}
            >
              <Text style={[styles.mutedText, { flex: 0.6, color: colors.textMuted }]}>{item.urun_no ?? "—"}</Text>
              <View style={{ flex: 2 }}>
                <Text style={[styles.rowLabel, { color: colors.textPrimary }]} numberOfLines={1}>
                  {item.stock_sku_name || item.name || "—"}
                </Text>
                {item.stock_sku_code && <Text style={[styles.mutedTextSm, { color: colors.textMuted }]}>{item.stock_sku_code}</Text>}
              </View>
              <Text style={[styles.rowValue, { flex: 1, textAlign: "right", color: colors.textPrimary }]}>
                {formatCurrency(Number(item.price))}
              </Text>
              <Text style={[styles.mutedText, { flex: 1, textAlign: "right", color: colors.textMuted }]}>
                {item.quantity}/{item.max_quantity}
              </Text>
            </View>
          ))
        ) : (
          <EmptyState label="Ürün/slot bulunamadı" />
        )}
      </ScreenCard>

      {addSlotOpen && (
        <AddSlotModal sn={sn} onClose={() => setAddSlotOpen(false)} onCreated={refreshProducts} />
      )}
      {templateModalOpen && (
        <TemplateMappingModal sn={sn} onClose={() => setTemplateModalOpen(false)} onChanged={refreshProducts} />
      )}
    </ScrollView>
  );
}

/* ---------------- + SLOT EKLE ---------------- */

function AddSlotModal({
  sn,
  onClose,
  onCreated,
}: {
  sn: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  const [isWildcard, setIsWildcard] = useState(false);
  const [urunNo, setUrunNo] = useState("");
  const [selectedSku, setSelectedSku] = useState<{ id: number; name: string } | null>(null);
  const [skuPickerOpen, setSkuPickerOpen] = useState(false);
  const [price, setPrice] = useState("");
  const [maxQuantity, setMaxQuantity] = useState("0");
  const [saving, setSaving] = useState(false);

  const skusQuery = useQuery({
    queryKey: ["stock-skus-sellable"],
    queryFn: async () => {
      const all = await stockApi.skus.list({ active_only: true });
      return (all as any[]).filter((s) => s.kind !== "ingredient");
    },
  });

  const handleSubmit = async () => {
    if (!isWildcard && !urunNo.trim()) {
      Alert.alert("Hata", "Ürün No (Slot) gerekli.");
      return;
    }
    if (!selectedSku) {
      Alert.alert("Hata", "SKU / Ürün seçin.");
      return;
    }
    if (!price.trim()) {
      Alert.alert("Hata", "Fiyat gerekli.");
      return;
    }
    setSaving(true);
    try {
      await (devicesApi as any).createProduct(sn, {
        urun_no: isWildcard ? null : Number(urunNo),
        is_wildcard: isWildcard,
        stock_sku_id: selectedSku.id,
        price: price.replace(",", "."),
        max_quantity: Number(maxQuantity) || 0,
      });
      onCreated();
      onClose();
    } catch (e: any) {
      Alert.alert("Hata", e?.response?.data?.detail ?? (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.formSheetWide, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Slot Ekle</Text>

          <Pressable style={styles.checkboxRowItem} onPress={() => setIsWildcard(!isWildcard)}>
            <View
              style={[
                styles.customCheckbox,
                { borderColor: colors.border, backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF" },
                isWildcard && { backgroundColor: colors.primary, borderColor: colors.primary },
              ]}
            >
              {isWildcard && <Text style={styles.customCheckmark}>✓</Text>}
            </View>
            <Text style={[styles.mutedTextSm, { color: colors.textPrimary, flex: 1 }]}>
              Wildcard slot (spesifik slot eşleşmeyen tüm ürünler için fallback — cihaz başına 1)
            </Text>
          </Pressable>

          {!isWildcard && (
            <>
              <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>ÜRÜN NO (SLOT) *</Text>
              <TextInput
                style={[
                  styles.input,
                  { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.textPrimary },
                ]}
                value={urunNo}
                onChangeText={setUrunNo}
                keyboardType="numeric"
              />
            </>
          )}

          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>SKU / ÜRÜN *</Text>
          <Pressable
            style={[styles.selectInput, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border }]}
            onPress={() => setSkuPickerOpen(true)}
          >
            <Text style={{ color: selectedSku ? colors.textPrimary : colors.textMuted }}>{selectedSku?.name ?? "Seçin"}</Text>
            <Text style={[styles.selectArrow, { color: colors.textMuted }]}>▼</Text>
          </Pressable>

          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>FİYAT (₺) *</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.textPrimary },
            ]}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
          />

          <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>MAX STOK</Text>
          <TextInput
            style={[
              styles.input,
              { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.textPrimary },
            ]}
            value={maxQuantity}
            onChangeText={setMaxQuantity}
            keyboardType="numeric"
          />

          <View style={{ flexDirection: "row", gap: spacing.sm, marginTop: spacing.md }}>
            <Pressable
              style={[styles.primaryBtnSmall, { backgroundColor: colors.primary, flex: 1, alignItems: "center" }, saving && { opacity: 0.6 }]}
              onPress={handleSubmit}
              disabled={saving}
            >
              <Text style={styles.primaryBtnText}>{saving ? "Ekleniyor..." : "Ekle"}</Text>
            </Pressable>
            <Pressable
              style={[styles.secondaryBtnSmall, { borderColor: colors.border, flex: 1, alignItems: "center" }]}
              onPress={onClose}
              disabled={saving}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>İptal</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>

      <OptionModal
        visible={skuPickerOpen}
        title="SKU / Ürün Seçiniz"
        options={(skusQuery.data ?? []).map((s: any) => ({ id: s.id, name: s.name }))}
        selectedId={selectedSku?.id ?? null}
        onSelect={(item) => setSelectedSku(item.id != null ? { id: item.id, name: item.name } : null)}
        onClose={() => setSkuPickerOpen(false)}
      />
    </Modal>
  );
}

/* ---------------- ŞABLON EŞLEMESİ ---------------- */

function TemplateMappingModal({
  sn,
  onClose,
  onChanged,
}: {
  sn: string;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  const [selectedTemplate, setSelectedTemplate] = useState<{ id: number; name: string } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const templatesQuery = useQuery({
    queryKey: ["product-templates"],
    queryFn: () => (devicesApi as any).templates(),
  });

  const templateOptions: { id: number; name: string }[] = useMemo(() => {
    const raw = templatesQuery.data;
    const list = Array.isArray(raw) ? raw : raw?.results ?? [];
    return list.map((t: any) => ({ id: t.id, name: t.name ?? t.title ?? `Şablon #${t.id}` }));
  }, [templatesQuery.data]);

  const handleApply = () => {
    if (!selectedTemplate) {
      Alert.alert("Hata", "Bir şablon seçin.");
      return;
    }
    Alert.alert(
      "Şablonu Uygula",
      "Şablon değiştirmek mevcut stok miktarlarını sıfırlar ve şablonda karşılığı olmayan slotları siler. Onaylıyor musunuz?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Uygula",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              await (devicesApi as any).assignTemplate(sn, selectedTemplate.id);
              onChanged();
              onClose();
            } catch (e: any) {
              Alert.alert("Hata", e?.response?.data?.detail ?? (e as Error).message);
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  const handleRemove = () => {
    Alert.alert(
      "Eşlemeyi Kaldır",
      "Slotlar silinmez; yalnızca şablon değişikliklerinin bu cihaza otomatik yansımasını durdurur. Onaylıyor musunuz?",
      [
        { text: "Vazgeç", style: "cancel" },
        {
          text: "Kaldır",
          style: "destructive",
          onPress: async () => {
            setSaving(true);
            try {
              await (devicesApi as any).unassignTemplate(sn);
              onChanged();
              onClose();
            } catch (e: any) {
              Alert.alert("Hata", e?.response?.data?.detail ?? (e as Error).message);
            } finally {
              setSaving(false);
            }
          },
        },
      ]
    );
  };

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <Pressable style={[styles.formSheetWide, { backgroundColor: colors.surface }]} onPress={(e) => e.stopPropagation()}>
          <View style={styles.rowBetween}>
            <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>Şablon Eşlemesi</Text>
            <Pressable onPress={onClose}>
              <Text style={{ fontSize: 20, color: colors.textMuted }}>✕</Text>
            </Pressable>
          </View>

          <Text style={[styles.fieldLabel, { color: colors.textMuted, marginTop: spacing.md }]}>BAŞKA ŞABLON SEÇ</Text>
          <Pressable
            style={[styles.selectInput, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border }]}
            onPress={() => setPickerOpen(true)}
          >
            <Text style={{ color: selectedTemplate ? colors.textPrimary : colors.textMuted }}>
              {selectedTemplate?.name ?? "Seçin"}
            </Text>
            <Text style={[styles.selectArrow, { color: colors.textMuted }]}>▼</Text>
          </Pressable>

          <View style={[styles.warningBox, { backgroundColor: isDark ? "#3A2E10" : "#FEF3C7" }]}>
            <Text style={{ color: isDark ? "#FCD34D" : "#92400E", fontSize: 12 }}>
              ⚠ Şablon değiştirmek mevcut stok miktarlarını sıfırlar ve şablonda karşılığı olmayan slotları siler.
            </Text>
          </View>

          <Pressable
            style={[
              styles.primaryBtnSmall,
              { backgroundColor: colors.primary, marginTop: spacing.md, alignItems: "center" },
              (!selectedTemplate || saving) && { opacity: 0.6 },
            ]}
            onPress={handleApply}
            disabled={!selectedTemplate || saving}
          >
            <Text style={styles.primaryBtnText}>Seçilen Şablonu Uygula</Text>
          </Pressable>

          <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, marginTop: spacing.md, paddingTop: spacing.md }}>
            <Text style={[styles.mutedTextSm, { color: colors.textMuted, marginBottom: spacing.sm }]}>
              Eşlemeyi kaldırmak slotları silmez; yalnızca şablon değişikliklerinin bu cihaza otomatik yansımasını
              durdurur.
            </Text>
            <Pressable
              style={[styles.secondaryBtnSmall, { borderColor: colors.border, alignItems: "center" }, saving && { opacity: 0.6 }]}
              onPress={handleRemove}
              disabled={saving}
            >
              <Text style={{ color: colors.textPrimary, fontWeight: "600" }}>Eşlemeyi Kaldır</Text>
            </Pressable>
          </View>
        </Pressable>
      </Pressable>

      <OptionModal
        visible={pickerOpen}
        title="Şablon Seçiniz"
        options={templateOptions}
        selectedId={selectedTemplate?.id ?? null}
        onSelect={(item) => setSelectedTemplate(item.id != null ? { id: item.id, name: item.name } : null)}
        onClose={() => setPickerOpen(false)}
      />
    </Modal>
  );
}

/* ---------------- İSTATİSTİKLER ---------------- */

function StatsTab({ sn }: { sn: string }) {
  const { colors, isDark } = useAppTheme();
  const [period, setPeriod] = useState<PeriodKey>("today");
  const initialRange = getPeriodRange("today");

  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [startTime, setStartTime] = useState("00:00");
  const [endTime, setEndTime] = useState("23:59");

  const [appliedFilters, setAppliedFilters] = useState({
    startDate: initialRange.start,
    endDate: initialRange.end,
  });

  const handlePeriodSelect = (p: PeriodKey) => {
    setPeriod(p);
    const r = getPeriodRange(p);
    setStartDate(r.start);
    setEndDate(r.end);
    setStartTime("00:00");
    setEndTime("23:59");
  };

  const handleApply = () => {
    setAppliedFilters({
      startDate,
      endDate,
    });
  };

  const txQuery = useQuery({
    queryKey: ["device-stats-tx", sn, appliedFilters.startDate, appliedFilters.endDate],
    queryFn: () => devicesApi.transactions(sn, { page: 1, start_date: appliedFilters.startDate, end_date: appliedFilters.endDate }),
  });

  const txData: any = txQuery.data;
  const results: any[] = txData?.results ?? [];
  const totalRevenue = txData?.summary?.revenue != null ? Number(txData.summary.revenue) : results.reduce((sum, tx) => sum + (tx.status ? Number(tx.amount) || 0 : 0), 0);
  const successCount = txData?.summary?.success != null ? txData.summary.success : results.filter((tx) => tx.status).length;
  const failCount = txData?.summary?.failed != null ? txData.summary.failed : results.filter((tx) => !tx.status).length;

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <ScreenCard style={{ gap: spacing.md }}>
        <View style={styles.periodChipsRow}>
          {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((p) => (
            <Pressable
              key={p}
              onPress={() => handlePeriodSelect(p)}
              style={[
                styles.periodChip,
                {
                  backgroundColor: period === p ? colors.primary : isDark ? colors.surfaceAlt : "#FFFFFF",
                  borderColor: period === p ? colors.primary : colors.border,
                },
              ]}
            >
              <Text
                style={[
                  styles.periodChipText,
                  { color: period === p ? "#FFFFFF" : isDark ? colors.textSecondary : colors.textPrimary },
                  period === p && styles.periodChipTextActive,
                ]}
              >
                {PERIOD_LABELS[p]}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>BAŞLANGIÇ</Text>
            <View style={[styles.inputWithIcon, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border }]}>
              <TextInput
                style={[styles.inputInner, { color: colors.textPrimary }]}
                value={startDate}
                onChangeText={setStartDate}
                placeholder="YYYY-AA-GG"
                placeholderTextColor={colors.textMuted}
              />
              <CalendarIcon color={colors.textMuted} />
            </View>
          </View>
          <View style={styles.fieldHalf}>
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>BİTİŞ</Text>
            <View style={[styles.inputWithIcon, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border }]}>
              <TextInput
                style={[styles.inputInner, { color: colors.textPrimary }]}
                value={endDate}
                onChangeText={setEndDate}
                placeholder="YYYY-AA-GG"
                placeholderTextColor={colors.textMuted}
              />
              <CalendarIcon color={colors.textMuted} />
            </View>
          </View>
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>BAŞL. SAATİ</Text>
            <View style={[styles.inputWithIcon, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border }]}>
              <TextInput
                style={[styles.inputInner, { color: colors.textPrimary }]}
                value={startTime}
                onChangeText={setStartTime}
                placeholder="00:00"
                placeholderTextColor={colors.textMuted}
              />
              <ClockIcon color={colors.textMuted} />
            </View>
          </View>
          <View style={styles.fieldHalf}>
            <Text style={[styles.filterLabel, { color: colors.textMuted }]}>BİTİŞ SAATİ</Text>
            <View style={[styles.inputWithIcon, { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border }]}>
              <TextInput
                style={[styles.inputInner, { color: colors.textPrimary }]}
                value={endTime}
                onChangeText={setEndTime}
                placeholder="23:59"
                placeholderTextColor={colors.textMuted}
              />
              <ClockIcon color={colors.textMuted} />
            </View>
          </View>
        </View>

        <View style={{ marginTop: spacing.xs }}>
          <Button title="Uygula" onPress={handleApply} />
        </View>
      </ScreenCard>

      <View style={styles.grid2}>
        <StatCard label="Ciro" value={formatCurrency(totalRevenue)} />
        <StatCard label="Toplam İşlem" value={String(results.length)} />
        <StatCard label="Başarılı" value={String(successCount)} color={colors.success} />
        <StatCard label="Başarısız" value={String(failCount)} color={colors.danger} />
      </View>

      {txQuery.isLoading && <LoadingView label="Yükleniyor..." />}
    </ScrollView>
  );
}

/* ---------------- AYARLAR ---------------- */

function SettingsTab({ sn, detail }: { sn: string; detail: DeviceDetailRaw | undefined }) {
  const { colors, isDark } = useAppTheme();
  const queryClient = useQueryClient();

  const [serialNo, setSerialNo] = useState(sn);
  const [posName, setPosName] = useState(detail?.pos_name ?? "");
  const [brandText, setBrandText] = useState("");
  const [selectedLocation, setSelectedLocation] = useState<{ id: number | null; name: string }>(
    detail?.location ? detail.location : { id: null, name: "— Konum Yok —" }
  );

  const [selectedPaymentMode, setSelectedPaymentMode] = useState<{ id: number; name: string }>(
    PAYMENT_MODE_OPTIONS.find((m) => m.id === detail?.pos_odemetip) ?? PAYMENT_MODE_OPTIONS[1]
  );
  const [selectedPriceMgmt, setSelectedPriceMgmt] = useState<{ id: number; name: string }>(
    PRICE_MANAGEMENT_OPTIONS.find((p) => p.id === detail?.price_management) ?? PRICE_MANAGEMENT_OPTIONS[0]
  );

  const [posEod, setPosEod] = useState(detail?.timeouts?.pos_eod ?? "22:18");
  const [updatePeriod, setUpdatePeriod] = useState(String(detail?.pos_updprd ?? "2"));
  const [posTimeout, setPosTimeout] = useState(String(detail?.timeouts?.pos_timeout ?? "15000"));
  const [vendTimeout, setVendTimeout] = useState(String(detail?.timeouts?.vend_timeout ?? "20000"));

  const [audio, setAudio] = useState(detail?.device_toggles?.audio ?? true);
  const [cancelButton, setCancelButton] = useState(detail?.device_toggles?.cancel_button ?? true);
  const [languagePicker, setLanguagePicker] = useState(detail?.device_toggles?.auto_select ?? true);
  const [startButton, setStartButton] = useState(detail?.device_toggles?.login_button ?? false);
  const [freeVend, setFreeVend] = useState(false);

  const [isLocationModalVisible, setIsLocationModalVisible] = useState(false);
  const [isPaymentModeModalVisible, setIsPaymentModeModalVisible] = useState(false);
  const [isPriceMgmtModalVisible, setIsPriceMgmtModalVisible] = useState(false);

  const [paymentMethods, setPaymentMethods] = useState<Record<string, boolean>>(detail?.payment_methods ?? {});

  const [refund, setRefund] = useState(detail?.payment_methods?.refund ?? true);
  const [salesNotif, setSalesNotif] = useState(detail?.sales_notification_enabled ?? false);
  const [notifInterval, setNotifInterval] = useState(String(detail?.sales_notification_interval ?? "30"));

  const [saving, setSaving] = useState(false);

  const togglePaymentMethod = (key: string) => {
    setPaymentMethods((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const incrementNotifInterval = () => {
    const current = Number(notifInterval) || 0;
    setNotifInterval(String(current + 1));
  };

  const decrementNotifInterval = () => {
    const current = Number(notifInterval) || 0;
    if (current > 0) {
      setNotifInterval(String(current - 1));
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await devicesApi.updateSettings(sn, {
        pos_name: posName,
        pos_odemetip: selectedPaymentMode.id,
        price_management: selectedPriceMgmt.id,
        pos_updprd: Number(updatePeriod) || undefined,
        sales_notification_enabled: salesNotif,
        sales_notification_interval: Number(notifInterval) || undefined,
        payment_methods: { ...paymentMethods, refund },
        device_toggles: {
          audio,
          cancel_button: cancelButton,
          login_button: startButton,
          auto_select: languagePicker,
        },
        timeouts: {
          pos_eod: posEod,
          pos_timeout: Number(posTimeout) || undefined,
          vend_timeout: Number(vendTimeout) || undefined,
        },
      });
      queryClient.invalidateQueries({ queryKey: ["device-detail", sn] });
      Alert.alert("Başarılı", "Ayarlar kaydedildi.");
    } catch (e) {
      Alert.alert("Hata", (e as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const paymentMethodKeys = Object.keys(PAYMENT_METHOD_LABELS);

  return (
    <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
      <ScreenCard style={{ gap: spacing.sm }}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Genel</Text>

        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>SERİ NO</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.textPrimary },
          ]}
          value={serialNo}
          onChangeText={setSerialNo}
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>CİHAZ ADI</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.textPrimary },
          ]}
          value={posName}
          onChangeText={setPosName}
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>MARKA YAZISI</Text>
        <TextInput
          style={[
            styles.input,
            { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.textPrimary },
          ]}
          value={brandText}
          onChangeText={setBrandText}
          placeholder="Örn. Serpet Otomasyon"
          placeholderTextColor={colors.textMuted}
        />

        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>KONUM</Text>
        <Pressable
          style={[
            styles.selectInput,
            { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border },
          ]}
          onPress={() => setIsLocationModalVisible(true)}
        >
          <Text style={[styles.selectInputText, { color: colors.textPrimary }]}>{selectedLocation.name}</Text>
          <Text style={[styles.selectArrow, { color: colors.textMuted }]}>▼</Text>
        </Pressable>
      </ScreenCard>

      <ScreenCard style={{ gap: spacing.sm }}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Yapılandırma</Text>

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>ÖDEME MODU</Text>
            <Pressable
              style={[
                styles.selectInput,
                { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border },
              ]}
              onPress={() => setIsPaymentModeModalVisible(true)}
            >
              <Text style={[styles.selectInputText, { color: colors.textPrimary }]}>{selectedPaymentMode.name}</Text>
              <Text style={[styles.selectArrow, { color: colors.textMuted }]}>▼</Text>
            </Pressable>
          </View>
          <View style={styles.fieldHalf}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>FİYAT YÖNETİMİ</Text>
            <Pressable
              style={[
                styles.selectInput,
                { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border },
              ]}
              onPress={() => setIsPriceMgmtModalVisible(true)}
            >
              <Text style={[styles.selectInputText, { color: colors.textPrimary }]}>{selectedPriceMgmt.name}</Text>
              <Text style={[styles.selectArrow, { color: colors.textMuted }]}>▼</Text>
            </Pressable>
          </View>
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>GÜNSONU SAATİ</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.textPrimary },
              ]}
              value={posEod}
              onChangeText={setPosEod}
              placeholder="22:18"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>GÜNCELLEME PERİYODU (DK)</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.textPrimary },
              ]}
              value={updatePeriod}
              onChangeText={setUpdatePeriod}
              keyboardType="numeric"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        <View style={styles.fieldRow}>
          <View style={styles.fieldHalf}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>SATIŞ ONAY SÜRESİ (MS)</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.textPrimary },
              ]}
              value={posTimeout}
              onChangeText={setPosTimeout}
              keyboardType="numeric"
              placeholderTextColor={colors.textMuted}
            />
          </View>
          <View style={styles.fieldHalf}>
            <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>TİMEOUT SÜRESİ (MS)</Text>
            <TextInput
              style={[
                styles.input,
                { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border, color: colors.textPrimary },
              ]}
              value={vendTimeout}
              onChangeText={setVendTimeout}
              keyboardType="numeric"
              placeholderTextColor={colors.textMuted}
            />
          </View>
        </View>

        <View style={styles.checkboxGridRow}>
          <View style={styles.checkboxCol}>
            <Pressable style={styles.checkboxRowItem} onPress={() => setAudio(!audio)}>
              <View
                style={[
                  styles.customCheckbox,
                  { borderColor: colors.border, backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF" },
                  audio && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                {audio && <Text style={styles.customCheckmark}>✓</Text>}
              </View>
              <Text style={[styles.checkboxItemLabel, { color: colors.textPrimary }]}>Ses</Text>
            </Pressable>

            <Pressable style={styles.checkboxRowItem} onPress={() => setCancelButton(!cancelButton)}>
              <View
                style={[
                  styles.customCheckbox,
                  { borderColor: colors.border, backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF" },
                  cancelButton && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                {cancelButton && <Text style={styles.customCheckmark}>✓</Text>}
              </View>
              <Text style={[styles.checkboxItemLabel, { color: colors.textPrimary }]}>Vazgeç Butonu</Text>
            </Pressable>

            <Pressable style={styles.checkboxRowItem} onPress={() => setLanguagePicker(!languagePicker)}>
              <View
                style={[
                  styles.customCheckbox,
                  { borderColor: colors.border, backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF" },
                  languagePicker && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                {languagePicker && <Text style={styles.customCheckmark}>✓</Text>}
              </View>
              <Text style={[styles.checkboxItemLabel, { color: colors.textPrimary }]}>Dil Seçici</Text>
            </Pressable>
          </View>

          <View style={styles.checkboxCol}>
            <Pressable style={styles.checkboxRowItem} onPress={() => setStartButton(!startButton)}>
              <View
                style={[
                  styles.customCheckbox,
                  { borderColor: colors.border, backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF" },
                  startButton && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                {startButton && <Text style={styles.customCheckmark}>✓</Text>}
              </View>
              <Text style={[styles.checkboxItemLabel, { color: colors.textPrimary }]}>Başlat Butonu</Text>
            </Pressable>

            <Pressable style={styles.checkboxRowItem} onPress={() => setFreeVend(!freeVend)}>
              <View
                style={[
                  styles.customCheckbox,
                  { borderColor: colors.border, backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF" },
                  freeVend && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                {freeVend && <Text style={styles.customCheckmark}>✓</Text>}
              </View>
              <Text style={[styles.checkboxItemLabel, { color: colors.textPrimary }]}>Ücretsiz Vend</Text>
            </Pressable>
          </View>
        </View>
      </ScreenCard>

      <ScreenCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Ödeme Yöntemleri</Text>
        <View style={styles.checklistGrid}>
          {paymentMethodKeys.map((key) => (
            <Pressable key={key} style={styles.checklistItem} onPress={() => togglePaymentMethod(key)}>
              <View
                style={[
                  styles.checkbox,
                  { borderColor: colors.border, backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF" },
                  paymentMethods[key] && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                {paymentMethods[key] && <Text style={styles.checkboxMark}>✓</Text>}
              </View>
              <Text style={[styles.checklistText, { color: colors.textPrimary }]}>{PAYMENT_METHOD_LABELS[key]}</Text>
            </Pressable>
          ))}
        </View>
      </ScreenCard>

      <ScreenCard style={{ gap: spacing.sm }}>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Durum & Bildirimler</Text>

        <View style={styles.checkboxGridRow}>
          <View style={styles.checkboxCol}>
            <Pressable style={styles.checkboxRowItem} onPress={() => setRefund(!refund)}>
              <View
                style={[
                  styles.customCheckbox,
                  { borderColor: colors.border, backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF" },
                  refund && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                {refund && <Text style={styles.customCheckmark}>✓</Text>}
              </View>
              <Text style={[styles.checkboxItemLabel, { color: colors.textPrimary }]}>İade</Text>
            </Pressable>
          </View>

          <View style={styles.checkboxCol}>
            <Pressable style={styles.checkboxRowItem} onPress={() => setSalesNotif(!salesNotif)}>
              <View
                style={[
                  styles.customCheckbox,
                  { borderColor: colors.border, backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF" },
                  salesNotif && { backgroundColor: colors.primary, borderColor: colors.primary },
                ]}
              >
                {salesNotif && <Text style={styles.customCheckmark}>✓</Text>}
              </View>
              <Text style={[styles.checkboxItemLabel, { color: colors.textPrimary }]}>Satış Bildirimi</Text>
            </Pressable>
          </View>
        </View>

        <Text style={[styles.fieldLabel, { color: colors.textMuted }]}>BİLDİRİM ARALIĞI (DK)</Text>
        <View
          style={[
            styles.stepperContainer,
            { backgroundColor: isDark ? colors.surfaceAlt : "#FFFFFF", borderColor: colors.border },
          ]}
        >
          <TextInput
            style={[styles.stepperInput, { color: colors.textPrimary }]}
            value={notifInterval}
            onChangeText={setNotifInterval}
            keyboardType="numeric"
            placeholderTextColor={colors.textMuted}
          />
          <View style={styles.stepperArrowsCol}>
            <Pressable style={styles.stepperArrowBtn} onPress={incrementNotifInterval}>
              <Text style={[styles.stepperArrowText, { color: colors.textMuted }]}>▲</Text>
            </Pressable>
            <Pressable style={styles.stepperArrowBtn} onPress={decrementNotifInterval}>
              <Text style={[styles.stepperArrowText, { color: colors.textMuted }]}>▼</Text>
            </Pressable>
          </View>
        </View>
      </ScreenCard>

      <ScreenCard>
        <Text style={[styles.cardTitle, { color: colors.textPrimary }]}>Cihaz Kontrolleri</Text>
        <Text style={[styles.mutedText, { marginTop: spacing.sm, color: colors.textMuted }]}>
          Android Reset / Günsonu Al / MDB Reset komutlarını tetikleyecek bir API fonksiyonu henüz devicesApi içinde tanımlı değil.
        </Text>
      </ScreenCard>

      <Button title="Kaydet" onPress={handleSave} loading={saving} />

      <OptionModal
        visible={isLocationModalVisible}
        title="Konum Seçiniz"
        options={LOCATION_OPTIONS}
        selectedId={selectedLocation.id}
        onSelect={(item) => setSelectedLocation(item)}
        onClose={() => setIsLocationModalVisible(false)}
      />

      <OptionModal
        visible={isPaymentModeModalVisible}
        title="Ödeme Modu Seçiniz"
        options={PAYMENT_MODE_OPTIONS}
        selectedId={selectedPaymentMode.id}
        onSelect={(item) => setSelectedPaymentMode(item as { id: number; name: string })}
        onClose={() => setIsPaymentModeModalVisible(false)}
      />

      <OptionModal
        visible={isPriceMgmtModalVisible}
        title="Fiyat Yönetimi Seçiniz"
        options={PRICE_MANAGEMENT_OPTIONS}
        selectedId={selectedPriceMgmt.id}
        onSelect={(item) => setSelectedPriceMgmt(item as { id: number; name: string })}
        onClose={() => setIsPriceMgmtModalVisible(false)}
      />
    </ScrollView>
  );
}

/* ---------------- Ortak Modal Bileşeni ---------------- */

function OptionModal({
  visible,
  title,
  options,
  selectedId,
  onSelect,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { id: number | null; name: string }[];
  selectedId: number | null;
  onSelect: (item: { id: number | null; name: string }) => void;
  onClose: () => void;
}) {
  const { colors, isDark } = useAppTheme();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalOverlay} onPress={onClose}>
        <View style={[styles.modalContent, { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 }]}>
          <Text style={[styles.modalTitle, { color: colors.textPrimary }]}>{title}</Text>
          {options.map((opt) => (
            <Pressable
              key={opt.id ?? "none"}
              style={[
                styles.modalOption,
                selectedId === opt.id && { backgroundColor: isDark ? colors.surfaceAlt : "#F1F5F9" },
              ]}
              onPress={() => {
                onSelect(opt);
                onClose();
              }}
            >
              <Text
                style={[
                  styles.modalOptionText,
                  { color: selectedId === opt.id ? colors.primary : colors.textPrimary },
                  selectedId === opt.id && styles.modalOptionTextSelected,
                ]}
              >
                {selectedId === opt.id ? `✓ ${opt.name}` : opt.name}
              </Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

/* ---------------- Stiller ---------------- */

const styles = StyleSheet.create({
  container: { flex: 1 },

  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    gap: spacing.sm,
  },
  headerTitle: { fontWeight: "700", fontSize: 18 },
  headerSn: { fontSize: 12, marginTop: 2 },

  remoteSaleBtn: { paddingHorizontal: spacing.md, paddingVertical: 8, borderRadius: radius.sm },
  remoteSaleBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 12 },

  tabsScroll: { flexGrow: 0, borderBottomWidth: 1 },
  tabsContent: { paddingHorizontal: spacing.md, paddingBottom: spacing.sm, gap: spacing.sm },
  tab: { paddingBottom: 6, borderBottomWidth: 2, borderBottomColor: "transparent", paddingHorizontal: spacing.xs },
  tabText: { fontSize: 13, fontWeight: "600" },
  tabTextActive: { fontWeight: "700" },

  grid2: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm, justifyContent: "space-between" },
  periodCard: { width: "48%" },
  periodLabel: { fontSize: 12 },
  periodValue: { fontWeight: "700", fontSize: 20, marginTop: 4 },
  mutedTextSm: { fontSize: 11, marginTop: 2 },

  fillRateCard: {
    width: "48%",
    alignSelf: "flex-start",
  },
  fillRatePct: {
    fontSize: 22,
    fontWeight: "700",
    marginTop: 4,
  },

  cardTitle: { fontWeight: "700", fontSize: 15 },
  cardHeaderRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: spacing.sm },

  highlightBox: { borderRadius: radius.md, padding: spacing.md, gap: 4 },
  highlightLabel: { fontSize: 12 },
  highlightValue: { fontSize: 26, fontWeight: "700" },

  kvRows: { marginTop: spacing.md, gap: spacing.xs },
  kvRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  kvLabel: { fontSize: 13 },
  kvValue: { fontSize: 13, fontWeight: "600" },

  actionButton: {
    marginTop: spacing.md,
    borderRadius: radius.sm,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  actionButtonText: { color: "#FFFFFF", fontWeight: "700", fontSize: 14 },

  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  rowLabel: { fontSize: 14 },
  rowValue: { fontSize: 14, fontWeight: "600" },
  mutedText: { fontSize: 12 },

  /* 3 Kolonlu Web Grid Stili */
  webInfoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 14,
  },
  infoColItem: {
    width: "33.33%",
    paddingRight: 8,
    gap: 3,
  },
  infoColLabel: {
    fontSize: 11,
    letterSpacing: 0.2,
  },
  infoColValue: {
    fontSize: 13,
    fontWeight: "600",
  },

  subLabel: { fontSize: 12, marginTop: spacing.md, marginBottom: spacing.xs },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, alignItems: "center" },
  pill: { borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  pillText: { fontSize: 12, fontWeight: "600" },

  periodChipsRow: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  periodChip: { paddingHorizontal: spacing.md, paddingVertical: spacing.xs, borderRadius: 999, borderWidth: 1 },
  periodChipText: { fontSize: 12, fontWeight: "600" },
  periodChipTextActive: { color: "#fff" },

  filterLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginBottom: 4 },
  fieldLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginTop: spacing.xs, marginBottom: 4 },
  fieldRow: { flexDirection: "row", gap: spacing.sm },
  fieldHalf: { flex: 1 },

  input: { borderRadius: radius.sm, borderWidth: 1, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, fontSize: 13 },

  selectInput: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  selectInputText: { fontSize: 13 },
  selectArrow: { fontSize: 10 },

  checkboxGridRow: { flexDirection: "row", marginTop: spacing.xs, marginBottom: spacing.xs, gap: spacing.md },
  checkboxCol: { flex: 1, gap: spacing.sm },
  checkboxRowItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  customCheckbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  customCheckmark: { color: "#fff", fontSize: 11, fontWeight: "700" },
  checkboxItemLabel: { fontSize: 13, fontWeight: "500" },

  stepperContainer: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingLeft: spacing.md,
    paddingRight: 4,
  },
  stepperInput: {
    flex: 1,
    paddingVertical: spacing.sm,
    fontSize: 13,
  },
  stepperArrowsCol: {
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  stepperArrowBtn: {
    paddingVertical: 1,
    paddingHorizontal: 4,
  },
  stepperArrowText: {
    fontSize: 8,
  },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(15, 23, 42, 0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  modalContent: {
    width: "100%",
    borderRadius: radius.md,
    padding: spacing.md,
    gap: spacing.xs,
  },
  modalTitle: { fontSize: 15, fontWeight: "700", marginBottom: spacing.xs },
  modalOption: { paddingVertical: spacing.sm, paddingHorizontal: spacing.sm, borderRadius: radius.sm },
  modalOptionText: { fontSize: 14 },
  modalOptionTextSelected: { fontWeight: "700" },

  /* Uzaktan Satış Web Modal Stilleri */
  remoteVendModalCard: {
    width: "100%",
    maxWidth: 460,
    borderRadius: radius.lg,
    borderWidth: 1,
    padding: spacing.lg,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.18,
    shadowRadius: 20,
    elevation: 10,
    gap: spacing.md,
  },
  remoteVendHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  remoteVendTitle: {
    fontSize: 16,
    fontWeight: "700",
    flex: 1,
    paddingRight: 8,
  },
  remoteVendCloseBtn: {
    fontSize: 17,
    fontWeight: "700",
    padding: 2,
  },
  remoteVendStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  remoteVendStatusDot: {
    width: 9,
    height: 9,
    borderRadius: 5,
  },
  remoteVendStatusText: {
    fontSize: 13,
    fontWeight: "600",
  },
  remoteVendDashedBox: {
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderRadius: radius.md,
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 120,
  },
  remoteVendEmptyText: {
    fontSize: 13,
    textAlign: "center",
    lineHeight: 20,
  },
  remoteVendProductTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  remoteVendProductPrice: {
    fontSize: 18,
    fontWeight: "700",
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

  statusChip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
    borderWidth: 1,
  },
  statusChipText: { fontSize: 12, fontWeight: "600" },
  statusChipTextActive: { color: "#FFFFFF" },

  tableHeaderRow: { flexDirection: "row", marginTop: spacing.md, paddingBottom: spacing.xs, borderBottomWidth: 1 },
  tableHeaderText: { fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  tableDataRow: { flexDirection: "row", alignItems: "center", paddingVertical: spacing.sm },

  checklistGrid: { flexDirection: "row", flexWrap: "wrap", marginTop: spacing.md },
  checklistItem: { flexDirection: "row", alignItems: "center", gap: spacing.xs, width: "50%", paddingVertical: spacing.xs },
  checkbox: { width: 18, height: 18, borderRadius: 4, borderWidth: 1.5, alignItems: "center", justifyContent: "center" },
  checkboxMark: { color: "#fff", fontSize: 11, fontWeight: "700" },
  checklistText: { fontSize: 13 },

  stockActionsRow: { flexDirection: "row", gap: spacing.sm },
  smallActionBtn: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
  smallActionBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  smallActionBtnOutline: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1 },

  formSheetWide: {
    width: "100%",
    maxWidth: 420,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  primaryBtnSmall: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm },
  secondaryBtnSmall: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, borderRadius: radius.sm, borderWidth: 1 },
  primaryBtnText: { color: "#FFFFFF", fontWeight: "700", fontSize: 13 },
  warningBox: { borderRadius: radius.sm, padding: spacing.sm, marginTop: spacing.sm },
});