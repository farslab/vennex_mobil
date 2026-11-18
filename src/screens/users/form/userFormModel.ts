/**
 * Teknisyen formu — doğrulama ve payload üretimi (saf fonksiyonlar, test edilebilir).
 * Backend: serializers/misc.py::StaffUserSerializer, views/users.py.
 */
import { isValidEmail, normalizePhone, validatePassword } from "@/utils/validation";
import type { AssignableOptions, CreateStaffUserPayload, StaffUser, UpdateStaffUserPayload } from "@/types/users";

export interface UserFormValues {
  username: string;
  password: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  group_names: string[];
  pos_device_ids: number[];
  default_stock_location_ids: number[];
}

export type UserFormField = keyof UserFormValues;
export type UserFormErrors = Partial<Record<UserFormField, string>>;

export const USER_FORM_FIELDS: readonly UserFormField[] = [
  "username",
  "password",
  "first_name",
  "last_name",
  "email",
  "phone",
  "group_names",
  "pos_device_ids",
  "default_stock_location_ids",
];

const NAME_MAX = 150;
/** Django UnicodeUsernameValidator: harf, rakam ve @ . + - _ */
const USERNAME_RE = /^[\p{L}\p{N}_.@+-]+$/u;

export function emptyUserForm(): UserFormValues {
  return {
    username: "",
    password: "",
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    group_names: [],
    pos_device_ids: [],
    default_stock_location_ids: [],
  };
}

/** Owner'ın atayabileceği gruplar: available ∪ always_available (sıralı, tekrarsız) */
export function assignableGroups(options: Pick<AssignableOptions, "available_groups" | "always_available_groups">): string[] {
  return Array.from(new Set([...(options.available_groups ?? []), ...(options.always_available_groups ?? [])])).sort(
    (a, b) => a.localeCompare(b, "tr")
  );
}

/**
 * Düzenleme formu başlangıç değerleri. Gruplardan yalnız atanabilir olanlar formda yönetilir;
 * diğerleri backend tarafından korunur (views/users.py:147-151 `kept`).
 */
export function userToForm(user: StaffUser, groups: string[]): UserFormValues {
  return {
    username: user.username,
    password: "",
    first_name: user.first_name,
    last_name: user.last_name,
    email: user.email,
    phone: user.phone ?? "",
    group_names: user.group_names.filter((g) => groups.includes(g)),
    pos_device_ids: [...user.pos_device_ids],
    default_stock_location_ids: [...user.default_stock_location_ids],
  };
}

export function validateUserForm(values: UserFormValues, mode: "create" | "edit"): UserFormErrors {
  const errors: UserFormErrors = {};
  if (mode === "create") {
    const username = values.username.trim();
    if (!username) errors.username = "Kullanıcı adı gerekli.";
    else if (username.length > 150) errors.username = "En fazla 150 karakter olabilir.";
    else if (!USERNAME_RE.test(username)) errors.username = "Yalnızca harf, rakam ve @ . + - _ kullanılabilir.";
    const passwordError = validatePassword(values.password);
    if (passwordError) errors.password = passwordError;
  }
  if (values.first_name.trim().length > NAME_MAX) errors.first_name = `En fazla ${NAME_MAX} karakter olabilir.`;
  if (values.last_name.trim().length > NAME_MAX) errors.last_name = `En fazla ${NAME_MAX} karakter olabilir.`;
  if (values.email.trim() && !isValidEmail(values.email)) errors.email = "Geçerli bir e-posta adresi girin.";
  if (values.phone.trim() && !normalizePhone(values.phone)) errors.phone = "Geçerli bir cep telefonu girin (05XX XXX XX XX).";
  return errors;
}

function phoneValue(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  return normalizePhone(trimmed) ?? trimmed;
}

const sortedNums = (a: number[]) => [...new Set(a)].sort((x, y) => x - y);
const sortedStrs = (a: string[]) => [...new Set(a)].sort();
const sameList = <T>(a: T[], b: T[]) => a.length === b.length && a.every((v, i) => v === b[i]);

/** POST users/ gövdesi. Parola KIRPILMAZ (doğrulama baştaki/sondaki boşluğu zaten reddeder). */
export function buildCreatePayload(values: UserFormValues): CreateStaffUserPayload {
  const payload: CreateStaffUserPayload = {
    username: values.username.trim(),
    password: values.password,
    first_name: values.first_name.trim(),
    last_name: values.last_name.trim(),
    pos_device_ids: sortedNums(values.pos_device_ids),
    group_names: sortedStrs(values.group_names),
    default_stock_location_ids: sortedNums(values.default_stock_location_ids),
  };
  const email = values.email.trim();
  if (email) payload.email = email;
  const phone = phoneValue(values.phone);
  if (phone) payload.phone = phone;
  return payload;
}

/** PATCH users/{id}/ — yalnız değişen alanlar; diziler küme olarak karşılaştırılır */
export function buildUpdatePatch(initial: UserFormValues, values: UserFormValues): UpdateStaffUserPayload {
  const patch: UpdateStaffUserPayload = {};
  for (const key of ["first_name", "last_name", "email"] as const) {
    const next = values[key].trim();
    if (next !== initial[key].trim()) patch[key] = next;
  }
  const nextPhone = phoneValue(values.phone);
  if (nextPhone !== phoneValue(initial.phone)) patch.phone = nextPhone || null;

  const groups = sortedStrs(values.group_names);
  if (!sameList(groups, sortedStrs(initial.group_names))) patch.group_names = groups;
  const devices = sortedNums(values.pos_device_ids);
  if (!sameList(devices, sortedNums(initial.pos_device_ids))) patch.pos_device_ids = devices;
  const locations = sortedNums(values.default_stock_location_ids);
  if (!sameList(locations, sortedNums(initial.default_stock_location_ids))) patch.default_stock_location_ids = locations;
  return patch;
}
