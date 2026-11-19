/** Kart modülü sunum yardımcıları — saf fonksiyonlar (test edilebilir) */
import { formatCurrency, parseDecimal, toNumber } from "@/utils/number";
import type {
  BulkBalanceOperation,
  MoneyValue,
  PersonnelCard,
  QuotaPeriod,
  RecurringPeriod,
  RecurringUpdateType,
} from "@/types/cards";

/** Decimal(10,2) üst sınırı (serializers/personnel_card.py:60,72,158) */
export const MAX_AMOUNT = 99_999_999.99;

export const RECURRING_PERIOD_LABELS: Record<RecurringPeriod, string> = {
  daily: "Günlük",
  weekly: "Haftalık",
  monthly: "Aylık",
};

/** api/models.py QUOTA_PERIOD_CHOICES ile aynı etiketler */
export const QUOTA_PERIOD_LABELS: Record<QuotaPeriod, string> = {
  daily: "Günlük",
  weekly: "Haftalık",
  monthly: "Aylık",
  "3month": "3 Aylık",
  "6month": "6 Aylık",
  "9month": "9 Aylık",
  "12month": "12 Aylık",
};

/** RecurringBalanceUpdate.UPDATE_TYPE_CHOICES (api/models.py:1314-1317) */
export const UPDATE_TYPE_LABELS: Record<RecurringUpdateType, string> = {
  add: "Bakiyeye ekle",
  set: "Sıfırla ve ata",
};

export const BALANCE_OPERATION_LABELS: Record<BulkBalanceOperation, string> = {
  add: "Bakiye ekle",
  subtract: "Bakiye düş",
  set: "Bakiyeyi ayarla",
};

export function cardDisplayName(card: Pick<PersonnelCard, "full_name" | "first_name" | "last_name">): string {
  const name = card.full_name ?? [card.first_name, card.last_name].filter(Boolean).join(" ").trim();
  return name || "İsimsiz kart";
}

/** Kart numarası (UID) — web kart listesi gibi tam ve açık gösterilir */
export function cardUid(uid: string | null | undefined): string {
  const value = (uid ?? "").trim();
  return value || "—";
}

/** Ters çevrilebilir UID: backend boşlukla ayrılmış en az iki parça ister (views:240-247) */
export function canReverseUid(uid: string | null | undefined): boolean {
  return (uid ?? "").trim().split(/\s+/).length > 1;
}

export function reversedUid(uid: string): string {
  return uid.trim().split(/\s+/).reverse().join(" ");
}

/**
 * Tutar girişi doğrulaması. `allowZero` yalnız "ayarla" işleminde (bakiye 0'a çekilebilir).
 * Geçerliyse number, değilse hata mesajı döner.
 */
export function validateAmount(input: string, { allowZero = false } = {}): { value: number } | { error: string } {
  if (!input.trim()) return { error: "Tutar girin." };
  const n = parseDecimal(input);
  if (n == null) return { error: "Geçerli bir tutar girin (ör. 150 veya 150,50)." };
  if (n < 0) return { error: "Tutar negatif olamaz." };
  if (!allowZero && n === 0) return { error: "Tutar 0'dan büyük olmalı." };
  if (n > MAX_AMOUNT) return { error: "Tutar en fazla ₺99.999.999,99 olabilir." };
  if (Math.round(n * 100) / 100 !== n) return { error: "En fazla 2 ondalık hane girilebilir." };
  return { value: n };
}

/** Pozitif tam sayı (miktar) */
export function validatePositiveInt(input: string, label = "Miktar"): { value: number } | { error: string } {
  const s = input.trim();
  if (!/^\d+$/.test(s)) return { error: `${label} pozitif bir tam sayı olmalı.` };
  const n = Number(s);
  if (n < 1) return { error: `${label} en az 1 olmalı.` };
  if (n > 2_147_483_647) return { error: `${label} çok büyük.` };
  return { value: n };
}

/**
 * Ürün no biçimi (PersonelCardQuota.parse_product_no_tokens, api/models.py:1881):
 * "*", "12", "1,2,3", "20-40" veya karışık. Boş → "*".
 */
export function normalizeProductNo(input: string): { value: string } | { error: string } {
  const raw = input.trim();
  if (!raw) return { value: "*" };
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length === 0) return { value: "*" };
  for (const part of parts) {
    if (part === "*") continue;
    if (/^\d+$/.test(part)) continue;
    const m = /^(\d+)\s*-\s*(\d+)$/.exec(part);
    if (m && Number(m[1]) <= Number(m[2])) continue;
    return { error: `Geçersiz ürün no "${part}". Biçim: *, 12, 1,2,3 veya 20-40.` };
  }
  return { value: parts.join(",") };
}

export function sumBalances(cards: Pick<PersonnelCard, "balance">[]): number {
  return cards.reduce((acc, c) => acc + (toNumber(c.balance) ?? 0), 0);
}

/** Toplu bakiye işleminin sonucunu backend kuralıyla hesaplar (views:325-333; düşmede taban 0) */
export function projectBalances(
  cards: Pick<PersonnelCard, "balance">[],
  operation: BulkBalanceOperation,
  amount: number
): { before: number; after: number } {
  const before = sumBalances(cards);
  const after = cards.reduce((acc, c) => {
    const b = toNumber(c.balance) ?? 0;
    if (operation === "set") return acc + amount;
    if (operation === "subtract") return acc + Math.max(0, b - amount);
    return acc + b + amount;
  }, 0);
  return { before: round2(before), after: round2(after) };
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Onay özeti için kısa etki açıklaması */
export function balanceEffectText(operation: BulkBalanceOperation, amount: MoneyValue, count: number): string {
  const a = formatCurrency(amount);
  const target = count === 1 ? "Kartın" : `${count} kartın her birinin`;
  if (operation === "add") return `${target} bakiyesine ${a} eklenir.`;
  if (operation === "subtract") return `${target} bakiyesinden ${a} düşülür; bakiye 0'ın altına inmez.`;
  return `${target} bakiyesi ${a} olarak ayarlanır (mevcut bakiye silinir).`;
}
