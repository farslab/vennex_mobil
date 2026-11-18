import { EMPTY_VALUE, formatQuantity, toNumber } from "@/utils/number";
import type { IconName, StatusTone } from "@/design-system";
import {
  BASE_UNIT_SHORT,
  MOVEMENT_TYPE_LABELS,
  STOCK_LOCATION_TYPE_LABELS,
  type StockBaseUnit,
  type StockLocationType,
  type StockMovementType,
} from "@/types/stock";

/** Lokasyon tipi ikonografisi — renk tek başına bilgi taşımaz, her zaman etiketle birlikte kullanılır */
export const LOCATION_TYPE_META: Record<StockLocationType, { icon: IconName; tone: StatusTone; label: string }> = {
  warehouse: { icon: "archive", tone: "info", label: STOCK_LOCATION_TYPE_LABELS.warehouse },
  depot: { icon: "layers", tone: "neutral", label: STOCK_LOCATION_TYPE_LABELS.depot },
  vehicle: { icon: "truck", tone: "warning", label: STOCK_LOCATION_TYPE_LABELS.vehicle },
  vending_machine: { icon: "monitor", tone: "success", label: STOCK_LOCATION_TYPE_LABELS.vending_machine },
};

export const MOVEMENT_TYPE_META: Record<StockMovementType, { icon: IconName; label: string }> = {
  receipt: { icon: "download", label: MOVEMENT_TYPE_LABELS.receipt },
  transfer: { icon: "repeat", label: MOVEMENT_TYPE_LABELS.transfer },
  adjustment: { icon: "sliders", label: MOVEMENT_TYPE_LABELS.adjustment },
  refill: { icon: "corner-down-right", label: MOVEMENT_TYPE_LABELS.refill },
  consumption: { icon: "shopping-cart", label: MOVEMENT_TYPE_LABELS.consumption },
};

export function movementMeta(type: string, display?: string): { icon: IconName; label: string } {
  const meta = MOVEMENT_TYPE_META[type as StockMovementType];
  if (meta) return meta;
  return { icon: "activity", label: display || type || EMPTY_VALUE };
}

/** Kısa birim: adet / g / ml. Bilinmiyorsa boş. */
export function unitShort(unit: StockBaseUnit | string | null | undefined): string {
  if (!unit) return "";
  return BASE_UNIT_SHORT[unit as StockBaseUnit] ?? "";
}

/** "12,5 g", "24 adet"; birim bilinmiyorsa yalnız sayı. Değer yoksa "—". */
export function formatStockQuantity(value: unknown, unit?: StockBaseUnit | string | null): string {
  const n = toNumber(value);
  if (n == null) return EMPTY_VALUE;
  const u = unitShort(unit);
  const digits = unit === "piece" ? 0 : 3;
  return u ? `${formatQuantity(n, digits)} ${u}` : formatQuantity(n);
}

/** Yönlü miktar: +12 adet / −5 g / 3 adet (yön yoksa işaretsiz) */
export function formatSignedQuantity(value: unknown, direction: 1 | -1 | 0, unit?: StockBaseUnit | string | null): string {
  const n = toNumber(value);
  if (n == null) return EMPTY_VALUE;
  const abs = formatStockQuantity(Math.abs(n), unit);
  if (direction > 0) return `+${abs}`;
  if (direction < 0) return `−${abs}`;
  return abs;
}

/** Stok seviyesi: backend eşik (min/max) tutmuyor → yalnız gerçek veriden türeyen durumlar */
export function stockLevelOf(quantity: number): { label: string; tone: StatusTone } | null {
  if (quantity < 0) return { label: "Negatif", tone: "danger" };
  if (quantity === 0) return { label: "Tükendi", tone: "warning" };
  return null;
}
