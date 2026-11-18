import React, { useLayoutEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation, useRoute, type RouteProp } from "@react-navigation/native";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppCheckbox,
  AppConfirmSheet,
  AppDivider,
  AppEmptyState,
  AppErrorState,
  AppInput,
  AppListRow,
  AppLoading,
  AppNotice,
  AppScreen,
  AppSection,
  AppSelect,
  AppText,
  makeStyles,
  toast,
  type SelectOption,
} from "@/design-system";
import { usersApi } from "@/api/users";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { useAuthStore } from "@/store/authStore";
import { canManageUsers } from "@/auth/permissions";
import { errorStatus, splitApiError } from "@/components/account/formErrors";
import { PASSWORD_MIN_LENGTH } from "@/utils/validation";
import { fullName } from "@/utils/text";
import type { RootStackParamList } from "@/navigation/types";
import { stockLocationTypeLabel, type AssignableOptions, type StaffUser } from "@/types/users";
import {
  USER_FORM_FIELDS,
  assignableGroups,
  buildCreatePayload,
  buildUpdatePatch,
  emptyUserForm,
  userToForm,
  validateUserForm,
  type UserFormErrors,
  type UserFormField,
  type UserFormValues,
} from "./form/userFormModel";
import { ResetPasswordSheet } from "./form/ResetPasswordSheet";

/** Yeni/düzenle teknisyen — rota "UserForm" { userId? } */
export default function UserFormScreen() {
  const navigation = useNavigation();
  const route = useRoute<RouteProp<RootStackParamList, "UserForm">>();
  const userId = route.params?.userId;
  const isEdit = userId != null;
  const allowed = canManageUsers(useAuthStore((s) => s.user));

  useLayoutEffect(() => {
    navigation.setOptions({ title: isEdit ? "Kullanıcıyı düzenle" : "Yeni teknisyen" });
  }, [navigation, isEdit]);

  const optionsQuery = useQuery({
    queryKey: queryKeys.users.assignableOptions(),
    queryFn: ({ signal }) => usersApi.assignableOptions(signal),
    enabled: allowed,
  });
  const detailQuery = useQuery({
    queryKey: queryKeys.users.detail(userId ?? 0),
    queryFn: ({ signal }) => usersApi.detail(userId as number, signal),
    enabled: allowed && isEdit,
  });

  if (!allowed) {
    return (
      <AppEmptyState
        icon="lock"
        title="Erişiminiz yok"
        description="Kullanıcı yönetimi yalnızca hesap sahiplerine açıktır."
      />
    );
  }

  const failing = optionsQuery.isError ? optionsQuery : isEdit && detailQuery.isError ? detailQuery : null;
  if (failing) {
    const status = errorStatus(failing.error);
    return (
      <AppErrorState
        title={status === 404 ? "Kullanıcı bulunamadı" : undefined}
        message={errorMessage(failing.error, "Bilgiler yüklenemedi.")}
        onRetry={status === 404 || status === 403 ? undefined : () => failing.refetch()}
        retrying={failing.isFetching}
      />
    );
  }
  if (!optionsQuery.data || (isEdit && !detailQuery.data)) return <AppLoading label="Yükleniyor…" />;

  return (
    <UserFormBody
      key={isEdit ? `edit-${userId}` : "create"}
      options={optionsQuery.data}
      user={isEdit ? (detailQuery.data ?? null) : null}
      onDone={() => navigation.goBack()}
    />
  );
}

function UserFormBody({
  options,
  user,
  onDone,
}: {
  options: AssignableOptions;
  user: StaffUser | null;
  onDone: () => void;
}) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  const mode = user ? "edit" : "create";
  const groups = useMemo(() => assignableGroups(options), [options]);
  const initial = useMemo(() => (user ? userToForm(user, groups) : emptyUserForm()), [user, groups]);
  const [values, setValues] = useState<UserFormValues>(initial);
  const [errors, setErrors] = useState<UserFormErrors>({});
  const [generalError, setGeneralError] = useState<string | null>(null);
  const [resetOpen, setResetOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  /** Kullanıcının, owner'ın yönetemediği grupları (backend korur) */
  const lockedGroups = useMemo(() => (user ? user.group_names.filter((g) => !groups.includes(g)) : []), [user, groups]);
  const alwaysAvailable = useMemo(() => new Set(options.always_available_groups), [options]);

  const deviceOptions = useMemo<SelectOption<number>[]>(() => {
    const list: SelectOption<number>[] = options.pos_devices.map((d) => ({
      value: d.id,
      label: d.pos_name || d.sn,
      description: [d.sn, d.location_name, d.company_name].filter(Boolean).join(" · "),
    }));
    // Kullanıcıya atanmış ama owner listesinde olmayan cihazlar (backend kaydederken düşürür)
    for (const d of user?.pos_devices ?? []) {
      if (!list.some((o) => o.value === d.id)) {
        list.push({ value: d.id, label: d.pos_name || d.sn, description: `${d.sn} · erişiminiz dışında` });
      }
    }
    return list;
  }, [options, user]);

  const locationOptions = useMemo<SelectOption<number>[]>(() => {
    const list: SelectOption<number>[] = options.stock_locations.map((l) => ({
      value: l.id,
      label: l.name,
      description: stockLocationTypeLabel(l.location_type),
    }));
    for (const l of user?.default_stock_locations ?? []) {
      if (!list.some((o) => o.value === l.id)) {
        list.push({ value: l.id, label: l.name, description: `${stockLocationTypeLabel(l.location_type)} · başka şirket` });
      }
    }
    return list;
  }, [options, user]);

  const patch = useMemo(() => (user ? buildUpdatePatch(initial, values) : null), [user, initial, values]);
  const dirty = mode === "create" || Object.keys(patch ?? {}).length > 0;

  const handleError = (error: unknown) => {
    const { fieldErrors, general } = splitApiError(error, USER_FORM_FIELDS);
    // Kullanıcı adı çakışması `{detail}` ile gelir (views/users.py:83-84) → ilgili alana taşı
    if (mode === "create" && !fieldErrors.username && general && /kullanıcı adı/i.test(general)) {
      setErrors({ ...fieldErrors, username: general });
      setGeneralError(null);
      return;
    }
    setErrors(fieldErrors);
    setGeneralError(general);
  };

  const saveMutation = useMutation({
    mutationFn: () =>
      user ? usersApi.update(user.id, patch ?? {}) : usersApi.create(buildCreatePayload(values)),
    onSuccess: (saved) => {
      queryClient.setQueryData(queryKeys.users.detail(saved.id), saved);
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      toast.success(user ? "Kullanıcı güncellendi." : "Teknisyen oluşturuldu.");
      onDone();
    },
    onError: handleError,
  });

  const deleteMutation = useMutation({
    mutationFn: () => usersApi.remove((user as StaffUser).id),
    onSuccess: () => {
      setDeleteOpen(false);
      queryClient.removeQueries({ queryKey: queryKeys.users.detail((user as StaffUser).id) });
      queryClient.invalidateQueries({ queryKey: queryKeys.users.all });
      toast.success("Kullanıcı silindi.");
      onDone();
    },
  });

  const set =
    <K extends UserFormField>(key: K) =>
    (value: UserFormValues[K]) => {
      setValues((v) => ({ ...v, [key]: value }));
      if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
    };

  const toggleGroup = (group: string, checked: boolean) =>
    set("group_names")(checked ? [...values.group_names, group] : values.group_names.filter((g) => g !== group));

  const submit = () => {
    const local = validateUserForm(values, mode);
    setErrors(local);
    setGeneralError(null);
    if (Object.keys(local).length > 0) {
      toast.error("Lütfen işaretli alanları düzeltin.");
      return;
    }
    if (!dirty) return;
    saveMutation.mutate();
  };

  const selectedDeviceNames = deviceOptions.filter((o) => values.pos_device_ids.includes(o.value)).map((o) => o.label);
  const displayName = user ? fullName(user.first_name, user.last_name) || user.username : "";

  return (
    <AppScreen
      footer={
        <AppButton
          title={mode === "create" ? "Teknisyeni oluştur" : "Değişiklikleri kaydet"}
          onPress={submit}
          loading={saveMutation.isPending}
          disabled={!dirty}
          style={styles.flex}
          testID="user-form-submit"
        />
      }
    >
      {user && !user.is_active ? (
        <AppNotice tone="warning" title="Pasif kullanıcı" message="Bu kullanıcı şu anda giriş yapamaz." />
      ) : null}

      <AppSection title="Kimlik">
        <AppCard>
          <View style={styles.form}>
            <AppInput
              label="Ad"
              value={values.first_name}
              onChangeText={set("first_name")}
              error={errors.first_name}
              autoComplete="off"
              maxLength={150}
              testID="user-first-name"
            />
            <AppInput
              label="Soyad"
              value={values.last_name}
              onChangeText={set("last_name")}
              error={errors.last_name}
              autoComplete="off"
              maxLength={150}
              testID="user-last-name"
            />
            {mode === "create" ? (
              <>
                <AppInput
                  label="Kullanıcı adı"
                  required
                  value={values.username}
                  onChangeText={set("username")}
                  error={errors.username}
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="off"
                  helper="Giriş için kullanılır; sonradan değiştirilemez."
                  maxLength={150}
                  testID="user-username"
                />
                <AppInput
                  label="Şifre"
                  required
                  value={values.password}
                  onChangeText={set("password")}
                  error={errors.password}
                  secure
                  autoCapitalize="none"
                  autoCorrect={false}
                  autoComplete="new-password"
                  textContentType="newPassword"
                  helper={`En az ${PASSWORD_MIN_LENGTH} karakter; yalnızca rakamlardan oluşamaz.`}
                  testID="user-password"
                />
              </>
            ) : (
              <AppInput
                label="Kullanıcı adı"
                value={values.username}
                disabled
                icon="at-sign"
                helper="Kullanıcı adı değiştirilemez."
              />
            )}
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
              autoComplete="off"
              testID="user-email"
            />
            <AppInput
              label="Telefon"
              value={values.phone}
              onChangeText={set("phone")}
              error={errors.phone}
              keyboardType="phone-pad"
              placeholder="05XX XXX XX XX"
              maxLength={20}
              testID="user-phone"
            />
          </View>
        </AppCard>
      </AppSection>

      <AppSection title="Yetki grupları">
        <AppCard>
          <View style={styles.groups}>
            {groups.length === 0 ? (
              <AppText variant="callout" color="textSecondary">
                Atayabileceğiniz yetki grubu bulunmuyor.
              </AppText>
            ) : (
              groups.map((group) => (
                <AppCheckbox
                  key={group}
                  label={group}
                  description={alwaysAvailable.has(group) ? "Tüm hesap sahiplerince atanabilir" : undefined}
                  checked={values.group_names.includes(group)}
                  onChange={(checked) => toggleGroup(group, checked)}
                  testID={`group-${group}`}
                />
              ))
            )}
            {errors.group_names ? (
              <AppText variant="caption" color="danger">
                {errors.group_names}
              </AppText>
            ) : null}
            {lockedGroups.length > 0 ? (
              <>
                <AppDivider />
                <AppText variant="caption" color="textTertiary">
                  Sizin yönetemediğiniz gruplar (korunur):
                </AppText>
                <View style={styles.badges}>
                  {lockedGroups.map((g) => (
                    <AppBadge key={g} label={g} icon="lock" size="sm" />
                  ))}
                </View>
              </>
            ) : null}
          </View>
        </AppCard>
      </AppSection>

      <AppSection title="Cihazlar ve stok">
        <AppCard>
          <View style={styles.form}>
            <AppSelect<number>
              multiple
              searchable
              label="POS cihazları"
              sheetTitle="Cihaz seçin"
              placeholder={deviceOptions.length ? "Cihaz seçin" : "Atanabilir cihaz yok"}
              options={deviceOptions}
              value={values.pos_device_ids}
              onChange={set("pos_device_ids")}
              disabled={deviceOptions.length === 0}
              error={errors.pos_device_ids}
              testID="user-devices"
            />
            {selectedDeviceNames.length > 0 ? (
              <AppText variant="caption" color="textTertiary" numberOfLines={2}>
                {selectedDeviceNames.slice(0, 3).join(", ")}
                {selectedDeviceNames.length > 3 ? ` +${selectedDeviceNames.length - 3}` : ""}
              </AppText>
            ) : null}
            {locationOptions.length > 0 ? (
              <AppSelect<number>
                multiple
                searchable={locationOptions.length >= 8}
                label="Varsayılan stok lokasyonları"
                sheetTitle="Stok lokasyonu seçin"
                options={locationOptions}
                value={values.default_stock_location_ids}
                onChange={set("default_stock_location_ids")}
                error={errors.default_stock_location_ids}
                testID="user-locations"
              />
            ) : (
              <AppText variant="caption" color="textTertiary">
                Seçili şirkette atanabilir stok lokasyonu yok.
              </AppText>
            )}
          </View>
        </AppCard>
      </AppSection>

      {generalError ? <AppNotice tone="danger" title="Kaydedilemedi" message={generalError} /> : null}

      {user ? (
        <AppSection title="Hesap işlemleri">
          <AppCard padded={false}>
            <AppListRow
              icon="key"
              title="Şifreyi sıfırla"
              subtitle="Yeni bir şifre belirleyin"
              onPress={() => setResetOpen(true)}
              testID="user-reset-password"
            />
            <AppListRow
              icon="trash-2"
              destructive
              title="Kullanıcıyı sil"
              subtitle="Hesap kalıcı olarak silinir"
              onPress={() => setDeleteOpen(true)}
              last
              testID="user-delete"
            />
          </AppCard>
        </AppSection>
      ) : null}

      {user ? (
        <>
          <ResetPasswordSheet
            visible={resetOpen}
            userId={user.id}
            username={user.username}
            onClose={() => setResetOpen(false)}
          />
          <AppConfirmSheet
            visible={deleteOpen}
            title="Kullanıcıyı sil"
            message="Kullanıcının hesabı kalıcı olarak silinir ve uygulamaya giriş yapamaz."
            summary={[
              { label: "Kullanıcı", value: displayName },
              { label: "Kullanıcı adı", value: user.username },
              { label: "Atanmış cihaz", value: String(user.pos_device_count) },
            ]}
            confirmLabel="Kalıcı olarak sil"
            destructive
            irreversible
            loading={deleteMutation.isPending}
            error={deleteMutation.isError ? errorMessage(deleteMutation.error) : null}
            onConfirm={() => deleteMutation.mutate()}
            onCancel={() => {
              setDeleteOpen(false);
              deleteMutation.reset();
            }}
          />
        </>
      ) : null}
    </AppScreen>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    form: { gap: t.spacing.lg },
    groups: { gap: t.spacing.xs },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.xs },
  })
);
