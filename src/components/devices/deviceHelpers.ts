/**
 * Cihaz modülü saf yardımcıları — TEK kaynak. Kodlamalar backend'den:
 *  - pos_odemetip / template.machine_type: 0 Snack, 1 Kahve (api/models.py:703-711, 2634-2638)
 *  - price_management: 0/1/2 (api/models.py:621-631)
 *  - pt_type: 0–10 (api/models.py:2222-2234)
 *  - act_macstat: 0–5 (api/models.py:788)
 *  - operating_hours_mode: 0/1/2 (api/models.py:812-821)
 */
import type { StatusTone } from "@/design-system";
import { toNumber } from "@/utils/number";
import type {
  DeviceCommandKey,
  DeviceSortBy,
  DeviceToggleKey,
  FillRate,
  OperatingHoursMode,
  PaymentMethodKey,
  PosDeviceDetail,
  PosDeviceListItem,
  PosProduct,
  TimeRange,
} from "@/types/devices";

/* ------------------------------------------------------------ Makine tipi */

export const MACHINE_TYPE_OPTIONS = [
  { value: 0, label: "Snack" },
  { value: 1, label: "Kahve" },
] as const;

/** Snack/Kahve etiketi. 0 → Snack, 1 → Kahve; başka/boş değer → "—" (asla varsayılan tipe düşmez). */
export function machineTypeLabel(value: unknown): string {
  const n = toNumber(value);
  if (n === 0) return "Snack";
  if (n === 1) return "Kahve";
  return "—";
}

/** Değer anlamlı bir Snack/Kahve kodu mu? (PATCH 0–10 kabul eder ama yalnız 0/1 anlamlı) */
export function isKnownMachineType(value: unknown): value is 0 | 1 {
  return value === 0 || value === 1;
}

/* -------------------------------------------------------- Fiyat yönetimi */

export const PRICE_MANAGEMENT_OPTIONS = [
  { value: 0, label: "Otomattan al", description: "Fiyatlar otomattan okunur" },
  { value: 1, label: "Otomat öncelikli", description: "Otomat fiyatı yoksa sunucu fiyatı kullanılır" },
  { value: 2, label: "Sadece sunucu", description: "Fiyatlar yalnızca sunucudan gelir" },
] as const;

export function priceManagementLabel(value: unknown): string {
  const n = toNumber(value);
  return PRICE_MANAGEMENT_OPTIONS.find((o) => o.value === n)?.label ?? "—";
}

/* -------------------------------------------------------- Ödeme türleri */

export const PT_TYPE_LABELS: Record<number, string> = {
  0: "Nakit",
  1: "Kredi/Banka Kartı",
  2: "İstanbulKart",
  3: "Multinet",
  4: "Metropol",
  5: "Personel Kart",
  6: "Setcard",
  7: "Ticket",
  8: "Pluxee",
  9: "VennexSelf",
  10: "TokenFlex",
};

export function ptTypeLabel(value: unknown): string {
  const n = toNumber(value);
  if (n == null) return "—";
  return PT_TYPE_LABELS[n] ?? `Tür ${n}`;
}

export const PT_TYPE_OPTIONS = Object.entries(PT_TYPE_LABELS).map(([value, label]) => ({
  value: Number(value),
  label,
}));

export const CANCEL_REASON_LABELS: Record<string, string> = {
  "1": "Zaman aşımı",
  "2": "Banka reddi",
  "3": "Teknik hata",
  other: "Diğer",
};

export function cancelReasonLabel(iptalNo: unknown): string {
  const n = toNumber(iptalNo);
  if (n === 1 || n === 2 || n === 3) return CANCEL_REASON_LABELS[String(n)];
  return CANCEL_REASON_LABELS.other;
}

/* ------------------------------------------------------- Makine durumu */

const MACHINE_STATUS: Record<number, { label: string; tone: StatusTone }> = {
  0: { label: "Başlatılıyor", tone: "info" },
  1: { label: "Etkin", tone: "success" },
  2: { label: "Boşta", tone: "neutral" },
  3: { label: "Satışta", tone: "info" },
  4: { label: "Devre dışı", tone: "warning" },
  5: { label: "Pasif", tone: "neutral" },
};

export function machineStatusInfo(value: unknown): { label: string; tone: StatusTone } | null {
  const n = toNumber(value);
  return n == null ? null : (MACHINE_STATUS[n] ?? null);
}

/* ------------------------------------------------- Bağlantı / doluluk */

export function connectivityInfo(online: boolean | null | undefined): { label: string; tone: StatusTone } {
  if (online == null) return { label: "Bilinmiyor", tone: "neutral" };
  return online ? { label: "Çevrimiçi", tone: "success" } : { label: "Çevrimdışı", tone: "danger" };
}

export interface FillInfo {
  /** 0–100 aralığına kırpılmış yüzde; hesaplanamıyorsa null */
  pct: number | null;
  tone: StatusTone;
  /** "%72" veya "—" */
  label: string;
  /** "36 / 50" veya null */
  detail: string | null;
}

/** Liste satırındaki `fill_rate` veya ürünler yanıtındaki `fill` → gösterim bilgisi. Uydurma değer yok. */
export function fillInfo(fill: FillRate | null | undefined): FillInfo {
  if (!fill) return { pct: null, tone: "neutral", label: "—", detail: null };
  const raw = fill.pct;
  const detail = fill.max > 0 ? `${formatCount(fill.qty)} / ${formatCount(fill.max)}` : null;
  if (raw == null || !Number.isFinite(raw)) return { pct: null, tone: "neutral", label: "—", detail };
  const pct = Math.max(0, Math.min(100, Math.round(raw)));
  const tone: StatusTone = pct < 25 ? "danger" : pct < 50 ? "warning" : "success";
  return { pct, tone, label: `%${pct}`, detail };
}

function formatCount(n: number): string {
  return new Intl.NumberFormat("tr-TR", { maximumFractionDigits: 2 }).format(n);
}

/** Slot/ürün için doluluk (miktar / kapasite) */
export function slotFill(item: Pick<PosProduct, "quantity" | "max_quantity">): FillInfo {
  return fillInfo({
    qty: item.quantity,
    max: item.max_quantity,
    pct: item.max_quantity > 0 ? (100 * item.quantity) / item.max_quantity : null,
  });
}

export function productDisplayName(p: Pick<PosProduct, "name" | "stock_sku_name">): string {
  return p.stock_sku_name || p.name || "Adsız ürün";
}

export function slotLabel(p: Pick<PosProduct, "urun_no" | "is_wildcard">): string {
  if (p.is_wildcard) return "W";
  return p.urun_no != null ? String(p.urun_no) : "—";
}

/* ---------------------------------------------------- Liste sıralaması */

export const DEVICE_SORT_OPTIONS: { value: DeviceSortBy; label: string; sales?: boolean }[] = [
  { value: "default", label: "Varsayılan (özel sıra)" },
  { value: "last_transaction_desc", label: "Son işlem · yeni → eski" },
  { value: "last_transaction_asc", label: "Son işlem · eski → yeni" },
  { value: "fill_rate_asc", label: "Doluluk · düşük → yüksek" },
  { value: "fill_rate_desc", label: "Doluluk · yüksek → düşük" },
  { value: "today_revenue_desc", label: "Bugün ciro · yüksek → düşük", sales: true },
  { value: "today_revenue_asc", label: "Bugün ciro · düşük → yüksek", sales: true },
  { value: "yesterday_revenue_desc", label: "Dün ciro · yüksek → düşük", sales: true },
  { value: "yesterday_revenue_asc", label: "Dün ciro · düşük → yüksek", sales: true },
  { value: "this_month_revenue_desc", label: "Bu ay ciro · yüksek → düşük", sales: true },
  { value: "this_month_revenue_asc", label: "Bu ay ciro · düşük → yüksek", sales: true },
  { value: "last_month_revenue_desc", label: "Geçen ay ciro · yüksek → düşük", sales: true },
  { value: "last_month_revenue_asc", label: "Geçen ay ciro · düşük → yüksek", sales: true },
];

export type RevenueColumn = "today_revenue" | "yesterday_revenue" | "this_month_revenue" | "last_month_revenue";

/** Satırda gösterilecek ciro dönemi sıralamayı takip eder (dün cirosuna göre sıralanınca dün cirosu görünür) */
export function revenueColumnForSort(sort: DeviceSortBy): { key: RevenueColumn; label: string } {
  if (sort.startsWith("yesterday_revenue")) return { key: "yesterday_revenue", label: "Dün" };
  if (sort.startsWith("this_month_revenue")) return { key: "this_month_revenue", label: "Bu ay" };
  if (sort.startsWith("last_month_revenue")) return { key: "last_month_revenue", label: "Geçen ay" };
  return { key: "today_revenue", label: "Bugün" };
}

export function deviceTitle(d: Pick<PosDeviceListItem, "pos_name" | "sn">): string {
  return d.pos_name?.trim() || d.sn;
}

/* ------------------------------------------- Ödeme yöntemleri / ayarlar */

export const PAYMENT_METHOD_LABELS: { key: PaymentMethodKey; label: string }[] = [
  { key: "contactless", label: "Temassız" },
  { key: "chip", label: "Çipli kart" },
  { key: "magnetic", label: "Manyetik kart" },
  { key: "qrcode", label: "QR kod" },
  { key: "personel_card", label: "Personel kart" },
  { key: "vennex_wallet", label: "Vennex Cüzdan" },
  { key: "istanbul_kart", label: "İstanbulKart" },
  { key: "metropol", label: "Metropol" },
  { key: "multinet", label: "Multinet" },
  { key: "setcard", label: "Setcard" },
  { key: "ticket", label: "Ticket" },
  { key: "pluxee", label: "Pluxee" },
  { key: "tokenflex", label: "TokenFlex" },
  { key: "refund", label: "İade" },
];

export const DEVICE_TOGGLE_LABELS: { key: DeviceToggleKey; label: string; description: string }[] = [
  { key: "audio", label: "Ses", description: "Cihaz sesli uyarıları" },
  { key: "auto_select", label: "Otomatik seçim", description: "Ürün seçimini otomatik algıla" },
  { key: "login_button", label: "Giriş butonu", description: "Ekranda giriş butonunu göster" },
  { key: "cancel_button", label: "İptal butonu", description: "Ekranda iptal butonunu göster" },
];

export const DEVICE_COMMANDS: {
  key: DeviceCommandKey;
  label: string;
  description: string;
  confirmMessage: string;
  irreversible: boolean;
}[] = [
  {
    key: "and_reset",
    label: "Cihazı yeniden başlat",
    description: "POS uygulaması bir sonraki bağlantıda yeniden başlar.",
    confirmMessage: "Cihaz bir sonraki bağlantısında yeniden başlatılacak. Bu sırada satış yapılamaz.",
    irreversible: false,
  },
  {
    key: "mdb_reset",
    label: "MDB sıfırla",
    description: "Otomat ile POS arasındaki MDB bağlantısı sıfırlanır.",
    confirmMessage: "Otomat–POS MDB bağlantısı sıfırlanacak. Devam eden satış kesilebilir.",
    irreversible: false,
  },
  {
    key: "eod_trig",
    label: "Gün sonu tetikle",
    description: "Banka gün sonu işlemi başlatılır (finansal etkisi vardır).",
    confirmMessage:
      "Cihazda banka gün sonu (EOD) tetiklenecek. Günün kart işlemleri bankaya kapatılır; işlem geri alınamaz.",
    irreversible: true,
  },
];

/* --------------------------------------------------- Çalışma saatleri */

export const OPERATING_MODE_OPTIONS: { value: OperatingHoursMode; label: string }[] = [
  { value: 0, label: "Kapalı" },
  { value: 1, label: "Çalışma saatleri" },
  { value: 2, label: "Çalışmama saatleri" },
];

/** Okuma şeklindeki gün anahtarları (api/models.py:1007) → PATCH gün indeksleri "0".."6" */
export const DAY_KEYS = ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"] as const;
export const DAY_LABELS = ["Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi", "Pazar"] as const;

export type WeekSchedule = TimeRange[][];

export function operatingModeOf(detail: Pick<PosDeviceDetail, "operating_hours_mode" | "operating_hours">): OperatingHoursMode {
  const m = detail.operating_hours_mode;
  if (m === 0 || m === 1 || m === 2) return m;
  const s = detail.operating_hours?.mode;
  if (s === "working") return 1;
  if (s === "non_working") return 2;
  return 0;
}

/** Okuma şeklini 7 günlük diziye çevirir (gün anahtarı "monday" veya "0" olabilir) */
export function scheduleFromDetail(detail: Pick<PosDeviceDetail, "operating_hours">): WeekSchedule {
  const src = detail.operating_hours?.schedule ?? {};
  return DAY_KEYS.map((key, i) => [...(src[key] ?? src[String(i)] ?? [])].map((r) => ({ start: r.start, end: r.end })));
}

/** 7 günlük dizi → PATCH `schedule` ("0".."6"; boş günler atlanır) */
export function scheduleToWrite(week: WeekSchedule): Record<string, TimeRange[]> {
  const out: Record<string, TimeRange[]> = {};
  week.forEach((ranges, i) => {
    const valid = ranges.filter((r) => r.start && r.end);
    if (valid.length) out[String(i)] = valid.map((r) => ({ start: r.start, end: r.end }));
  });
  return out;
}

export function isValidHHMM(value: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(value.trim());
  if (!m) return false;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h >= 0 && h <= 23 && min >= 0 && min <= 59;
}

/* --------------------------------------------------------- İşlem tarihi */

export type DatePreset = "today" | "yesterday" | "last7" | "this_month" | "custom";

export const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "today", label: "Bugün" },
  { key: "yesterday", label: "Dün" },
  { key: "last7", label: "Son 7 gün" },
  { key: "this_month", label: "Bu ay" },
  { key: "custom", label: "Özel" },
];

/** Hazır tarih aralığı (yerel gün) */
export function presetRange(preset: Exclude<DatePreset, "custom">, now: Date = new Date()): { start: Date; end: Date } {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  switch (preset) {
    case "today":
      return { start: today, end: today };
    case "yesterday": {
      const y = new Date(today);
      y.setDate(y.getDate() - 1);
      return { start: y, end: y };
    }
    case "last7": {
      const s = new Date(today);
      s.setDate(s.getDate() - 6);
      return { start: s, end: today };
    }
    case "this_month":
      return { start: new Date(today.getFullYear(), today.getMonth(), 1), end: today };
  }
}
