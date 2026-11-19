import React, { useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import {
  AppButton,
  AppCard,
  AppEmptyState,
  AppInput,
  AppNotice,
  AppScreen,
  AppSection,
  makeStyles,
  toast,
} from "@/design-system";
import { authApi } from "@/api/auth";
import { queryKeys } from "@/api/queryKeys";
import { useAuthStore } from "@/store/authStore";
import { isValidEmail, normalizePhone } from "@/utils/validation";
import { splitApiError } from "@/components/account/formErrors";
import type { ProfileUpdatePayload } from "@/types/account";

const FIELDS = ["first_name", "last_name", "email", "phone"] as const;
type Field = (typeof FIELDS)[number];
type Values = Record<Field, string>;

/** serializers/auth.py::ProfileUpdateSerializer sınırları */
const NAME_MAX = 150;

export function validateProfile(values: Values): Partial<Record<Field, string>> {
  const errors: Partial<Record<Field, string>> = {};
  if (values.first_name.trim().length > NAME_MAX) errors.first_name = `En fazla ${NAME_MAX} karakter olabilir.`;
  if (values.last_name.trim().length > NAME_MAX) errors.last_name = `En fazla ${NAME_MAX} karakter olabilir.`;
  if (values.email.trim() && !isValidEmail(values.email)) errors.email = "Geçerli bir e-posta adresi girin.";
  if (values.phone.trim() && !normalizePhone(values.phone)) errors.phone = "Geçerli bir cep telefonu girin (05XX XXX XX XX).";
  return errors;
}

/** Yalnız değişen alanları üretir; telefon normalize edilir, boş telefon null gönderilir */
export function buildProfilePatch(initial: Values, values: Values): ProfileUpdatePayload {
  const patch: ProfileUpdatePayload = {};
  for (const key of ["first_name", "last_name", "email"] as const) {
    const next = values[key].trim();
    if (next !== initial[key].trim()) patch[key] = next;
  }
  const nextPhone = values.phone.trim() ? (normalizePhone(values.phone) ?? values.phone.trim()) : "";
  const prevPhone = initial.phone.trim() ? (normalizePhone(initial.phone) ?? initial.phone.trim()) : "";
  if (nextPhone !== prevPhone) patch.phone = nextPhone || null;
  return patch;
}

function valuesFromUser(user: { first_name?: string | null; last_name?: string | null; email?: string | null; phone?: string | null } | null): Values {
  return {
    first_name: user?.first_name ?? "",
    last_name: user?.last_name ?? "",
    email: user?.email ?? "",
    phone: user?.phone ?? "",
  };
}

export default function EditProfileScreen() {
  const styles = useStyles();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);

  // Fark tabanı ekran açılırken dondurulur: arka plandaki /me yenilemesi `user`'ı değiştirse bile
  // kullanıcının düzenlemediği alanlar PATCH'e girip sunucudaki yeni değeri geri almaz.
  // Form el değmemişse (taban = değerler) yeni kullanıcıya senkronlanır.
  const [initial, setInitial] = useState<Values>(() => valuesFromUser(user));
  const [values, setValues] = useState<Values>(initial);
  const [syncedUser, setSyncedUser] = useState(user);
  if (user !== syncedUser) {
    setSyncedUser(user);
    if (user && Object.keys(buildProfilePatch(initial, values)).length === 0) {
      const next = valuesFromUser(user);
      setInitial(next);
      setValues(next);
    }
  }
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [generalError, setGeneralError] = useState<string | null>(null);

  const patch = useMemo(() => buildProfilePatch(initial, values), [initial, values]);
  const dirty = Object.keys(patch).length > 0;
  const { leave } = useUnsavedChangesGuard(dirty);

  const mutation = useMutation({
    mutationFn: (body: ProfileUpdatePayload) => authApi.updateMe(body),
    onSuccess: (updated) => {
      setUser(updated);
      queryClient.setQueryData(queryKeys.me(), updated);
      toast.success("Profiliniz güncellendi.");
      leave(() => navigation.goBack());
    },
    onError: (error) => {
      const { fieldErrors, general } = splitApiError(error, FIELDS);
      setErrors(fieldErrors);
      setGeneralError(general);
    },
  });

  if (!user) return <AppEmptyState title="Oturum bulunamadı" icon="user-x" />;

  const set = (key: Field) => (text: string) => {
    setValues((v) => ({ ...v, [key]: text }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const submit = () => {
    const local = validateProfile(values);
    setErrors(local);
    setGeneralError(null);
    if (Object.keys(local).length > 0 || !dirty) return;
    mutation.mutate(patch);
  };

  return (
    <AppScreen
      footer={
        <AppButton
          title="Değişiklikleri kaydet"
          onPress={submit}
          loading={mutation.isPending}
          disabled={!dirty}
          fullWidth
          style={styles.flex}
          testID="profile-save"
        />
      }
    >
      <AppSection title="Kişisel bilgiler">
        <AppCard>
          <View style={styles.form}>
            <AppInput
              label="Ad"
              value={values.first_name}
              onChangeText={set("first_name")}
              error={errors.first_name}
              autoComplete="given-name"
              textContentType="givenName"
              maxLength={NAME_MAX}
              testID="input-first-name"
            />
            <AppInput
              label="Soyad"
              value={values.last_name}
              onChangeText={set("last_name")}
              error={errors.last_name}
              autoComplete="family-name"
              textContentType="familyName"
              maxLength={NAME_MAX}
              testID="input-last-name"
            />
            <AppInput
              label="Kullanıcı adı"
              value={user.username}
              disabled
              helper="Kullanıcı adı değiştirilemez."
              icon="at-sign"
            />
          </View>
        </AppCard>
      </AppSection>

      <AppSection title="İletişim">
        <AppCard>
          <View style={styles.form}>
            <AppInput
              label="E-posta"
              value={values.email}
              onChangeText={set("email")}
              error={errors.email}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              autoComplete="email"
              textContentType="emailAddress"
              helper="Şifre sıfırlama bağlantısı bu adrese gönderilir."
              testID="input-email"
            />
            <AppInput
              label="Telefon"
              value={values.phone}
              onChangeText={set("phone")}
              error={errors.phone}
              keyboardType="phone-pad"
              autoComplete="tel"
              textContentType="telephoneNumber"
              placeholder="05XX XXX XX XX"
              maxLength={20}
              testID="input-phone"
            />
          </View>
        </AppCard>
      </AppSection>

      {generalError ? <AppNotice tone="danger" title="Kaydedilemedi" message={generalError} /> : null}
    </AppScreen>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    form: { gap: t.spacing.lg },
    flex: { flex: 1 },
  })
);
