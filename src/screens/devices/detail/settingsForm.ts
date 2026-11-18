/**
 * Ayarlar formu — saf fonksiyonlar (test edilebilir).
 * Yalnız `POSDeviceSettingsSerializer` alanları yazılır (§3.11); `pos_updprd`, `timeouts`, `stat`, `act_*`
 * yazılamaz ve GÖNDERİLMEZ. Kodlamalar: pos_odemetip 0 Snack / 1 Kahve; price_management 0/1/2;
 * operating_hours.mode 0/1/2, schedule gün anahtarı "0".."6" (0 = Pazartesi), replace semantiği.
 */
import {
  isValidHHMM,
  operatingModeOf,
  scheduleFromDetail,
  scheduleToWrite,
  type WeekSchedule,
} from "@/components/devices/deviceHelpers";
import type {
  DeviceSettingsPatch,
  DeviceToggles,
  OperatingHoursMode,
  PaymentMethods,
  PosDeviceDetail,
} from "@/types/devices";

export interface SettingsForm {
  pos_name: string;
  location_id: number | null;
  pos_odemetip: number | null;
  price_management: number | null;
  sales_notification_enabled: boolean;
  sales_notification_interval: string;
  payment_methods: Partial<PaymentMethods>;
  device_toggles: Partial<DeviceToggles>;
  oh_mode: OperatingHoursMode;
  oh_week: WeekSchedule;
}

export function formFromDetail(d: PosDeviceDetail): SettingsForm {
  return {
    pos_name: d.pos_name ?? "",
    location_id: d.location?.id ?? null,
    pos_odemetip: d.pos_odemetip,
    price_management: d.price_management,
    sales_notification_enabled: d.sales_notification_enabled === true,
    sales_notification_interval: d.sales_notification_interval != null ? String(d.sales_notification_interval) : "",
    payment_methods: { ...(d.payment_methods ?? {}) },
    device_toggles: { ...(d.device_toggles ?? {}) },
    oh_mode: operatingModeOf(d),
    oh_week: scheduleFromDetail(d),
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

function boolDiff<T extends Record<string, boolean | undefined>>(base: T, cur: T): Partial<T> | null {
  const out: Partial<T> = {};
  let any = false;
  for (const k of Object.keys(cur) as (keyof T)[]) {
    if (typeof cur[k] === "boolean" && cur[k] !== base[k]) {
      out[k] = cur[k];
      any = true;
    }
  }
  return any ? out : null;
}

export function isDirty(base: SettingsForm, cur: SettingsForm): boolean {
  return !same(base, cur);
}

/** Değişen alanlardan PATCH gövdesi + alan doğrulama hataları */
export function buildSettingsPatch(
  base: SettingsForm,
  cur: SettingsForm
): { patch: DeviceSettingsPatch; errors: Record<string, string> } {
  const patch: DeviceSettingsPatch = {};
  const errors: Record<string, string> = {};

  if (cur.pos_name !== base.pos_name) {
    const name = cur.pos_name.trim();
    if (!name) errors.pos_name = "Cihaz adı boş olamaz.";
    else if (name.length > 30) errors.pos_name = "En fazla 30 karakter.";
    else patch.pos_name = name;
  }
  if (cur.location_id !== base.location_id) patch.location_id = cur.location_id;

  if (cur.pos_odemetip !== base.pos_odemetip) {
    if (cur.pos_odemetip === 0 || cur.pos_odemetip === 1) patch.pos_odemetip = cur.pos_odemetip;
    else errors.pos_odemetip = "Snack veya Kahve seçin.";
  }
  if (cur.price_management !== base.price_management) {
    if (cur.price_management === 0 || cur.price_management === 1 || cur.price_management === 2)
      patch.price_management = cur.price_management;
    else errors.price_management = "Fiyat yönetimi seçin.";
  }
  if (cur.sales_notification_enabled !== base.sales_notification_enabled)
    patch.sales_notification_enabled = cur.sales_notification_enabled;
  if (cur.sales_notification_interval !== base.sales_notification_interval) {
    const raw = cur.sales_notification_interval.trim();
    const n = /^\d+$/.test(raw) ? Number(raw) : NaN;
    if (!Number.isFinite(n) || n < 1) errors.sales_notification_interval = "1 veya daha büyük bir tam sayı girin.";
    else patch.sales_notification_interval = n;
  }

  const pm = boolDiff(base.payment_methods, cur.payment_methods);
  if (pm) patch.payment_methods = pm;
  const dt = boolDiff(base.device_toggles, cur.device_toggles);
  if (dt) patch.device_toggles = dt;

  if (cur.oh_mode !== base.oh_mode || !same(cur.oh_week, base.oh_week)) {
    const invalid = cur.oh_mode !== 0 && cur.oh_week.some((day) => day.some((r) => !isValidHHMM(r.start) || !isValidHHMM(r.end)));
    if (invalid) errors.operating_hours = "Saatleri SS:DD biçiminde girin (ör. 08:30).";
    else patch.operating_hours = { mode: cur.oh_mode, schedule: cur.oh_mode === 0 ? {} : scheduleToWrite(cur.oh_week) };
  }

  return { patch, errors };
}
