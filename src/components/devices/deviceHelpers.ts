/**
 * Cihaz modülü saf yardımcıları — TEK kaynak. Kodlamalar backend'den:
 *  - pos_odemetip / template.machine_type: 0 Snack, 1 Kahve (api/models.py:703-711, 2634-2638)
 *  - price_management: 0/1/2 (api/models.py:621-631)
 *  - pt_type: 0–10 (api/models.py:2222-2234)
 *  - act_macstat: 0–5 (api/models.py:788)
 *  - operating_hours_mode: 0/1/2 (api/models.py:812-821)
 */
import { businessToday } from "@/utils/date";
import type { StatusTone } from "@/design-system";
import { toNumber } from "@/utils/number";
import type { WebBadgeColor } from "./webBadgeColors";
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

/** Web ile aynı adlar (`get_act_macstat_display`) ve renkler (pos_device_detail.html) */
const MACHINE_STATUS: Record<number, { label: string; tone: StatusTone }> = {
  0: { label: "START", tone: "neutral" },
  1: { label: "ENABLE", tone: "success" },
  2: { label: "IDLE", tone: "success" },
  3: { label: "VEND", tone: "warning" },
  4: { label: "DISABLED", tone: "danger" },
  5: { label: "INACTIVE", tone: "danger" },
};

/** Web listesindeki kırmızı ünlem: çevrimiçi cihazın makinesi DISABLED/INACTIVE (pos_device_rows.html) */
export function machineAlert(online: boolean | null | undefined, macstat: unknown): string | null {
  const n = toNumber(macstat);
  if (!online || (n !== 4 && n !== 5)) return null;
  return MACHINE_STATUS[n].label;
}

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

/**
 * Cihaz toplam doluluğu (web pos_device_list / pos_device_detail ile aynı kaynak):
 * slot kapasitesi varsa slotlardan; yoksa ve cihazda bileşen haznesi varsa
 * bileşenlerden (kahve otomatı). Kaynak, açıklama satırı için döner.
 */
export function deviceFillInfo(fill: FillRate | null | undefined): FillInfo & { source: "slots" | "containers" | null } {
  const slots = fillInfo(fill);
  if (slots.pct != null) return { ...slots, source: "slots" };
  const cp = fill?.containers_pct;
  if (cp != null && Number.isFinite(cp)) {
    return { ...fillInfo({ pct: cp, qty: 0, max: 0 }), source: "containers" };
  }
  return { ...slots, source: null };
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

/** Web POS cihazı listesindeki "Sırala" seçenekleri ve adları */
export const DEVICE_SORT_OPTIONS: { value: DeviceSortBy; label: string; sales?: boolean }[] = [
  { value: "default", label: "Varsayılan" },
  { value: "last_transaction_desc", label: "Son İşlem (Yeni → Eski)" },
  { value: "last_transaction_asc", label: "Son İşlem (Eski → Yeni)" },
  { value: "today_revenue_desc", label: "Bugün Ciro (Yüksek → Düşük)", sales: true },
  { value: "today_revenue_asc", label: "Bugün Ciro (Düşük → Yüksek)", sales: true },
  { value: "yesterday_revenue_desc", label: "Dün Ciro (Yüksek → Düşük)", sales: true },
  { value: "yesterday_revenue_asc", label: "Dün Ciro (Düşük → Yüksek)", sales: true },
  { value: "this_month_revenue_desc", label: "Bu Ay Ciro (Yüksek → Düşük)", sales: true },
  { value: "this_month_revenue_asc", label: "Bu Ay Ciro (Düşük → Yüksek)", sales: true },
  { value: "last_month_revenue_desc", label: "Geçen Ay Ciro (Yüksek → Düşük)", sales: true },
  { value: "last_month_revenue_asc", label: "Geçen Ay Ciro (Düşük → Yüksek)", sales: true },
  { value: "fill_rate_desc", label: "Doluluk (Yüksek → Düşük)" },
  { value: "fill_rate_asc", label: "Doluluk (Düşük → Yüksek)" },
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
export function presetRange(preset: Exclude<DatePreset, "custom">, now: Date = businessToday()): { start: Date; end: Date } {
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


/* ------------------------------------ İşlem kartı rozetleri (web pt_badge.html) */

const PT_BADGE: Record<number, { label: string; color: WebBadgeColor }> = {
  0: { label: "Nakit", color: "gray" },
  1: { label: "Kredi Kartı", color: "blue" },
  2: { label: "İstanbulKart", color: "orange" },
  3: { label: "Multinet", color: "purple" },
  4: { label: "Metropol", color: "pink" },
  5: { label: "Personel Kart", color: "emerald" },
  6: { label: "Setcard", color: "teal" },
  7: { label: "Ticket", color: "rose" },
  8: { label: "Pluxee", color: "indigo" },
  9: { label: "VennexSelf", color: "cyan" },
  10: { label: "TokenFlex", color: "amber" },
};

/** Web işlem listesindeki ödeme tipi rozeti — her tip ayrı renk */
export function ptBadge(ptType: unknown): { label: string; color: WebBadgeColor } {
  const n = toNumber(ptType);
  if (n == null) return { label: "—", color: "gray" };
  return PT_BADGE[n] ?? { label: ptTypeLabel(n), color: "gray" };
}

/** Kredi kartında okuma şekli rozeti (web: Temassız mor / Çip yeşil / QR Kod mavi / Manyetik turuncu) */
export function entryModeBadge(ptType: unknown, entryMode: unknown): { label: string; color: WebBadgeColor } | null {
  if (toNumber(ptType) !== 1) return null;
  const e = toNumber(entryMode);
  if (e === 7) return { label: "Temassız", color: "purple" };
  if (e === 5 || e === 1) return { label: "Çip", color: "green" };
  if (e === 3) return { label: "QR Kod", color: "sky" };
  if (e === 90) return { label: "Manyetik", color: "orange" };
  return null;
}

/** Web işlem kartındaki durum etiketi: başarısız kredi kartında nedeni yazılır */
export function txStatusLabel(status: boolean, ptType: unknown, iptalNo: unknown): string {
  if (status) return "Başarılı";
  if (toNumber(ptType) !== 1) return "Başarısız";
  const n = toNumber(iptalNo);
  if (n === 1) return "Zaman Aşımı";
  if (n === 2) return "Banka Reddi";
  if (n === 3) return "Teknik Hata";
  return "Başarısız";
}
