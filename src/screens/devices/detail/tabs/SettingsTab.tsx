/**
 * Ayarlar — `PATCH pos-devices/{sn}/` yalnız değişen ve YAZILABİLİR alanlarla (§3.11).
 * - Ayar alanları: manage_device_settings (yoksa salt okunur)
 * - Komutlar (and_reset / mdb_reset / eod_trig): sunucudaki ortak `send_device_commands` yeteneği
 *   (dashboard_v2/capabilities.py — web ile aynı kural); her biri AppConfirmSheet arkasında.
 * - Yanıttaki `_warnings` kullanıcıya gösterilir.
 */
import React, { useMemo, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppConfirmSheet,
  AppInput,
  AppNotice,
  AppSegmented,
  AppSelect,
  AppSwitchRow,
  AppText,
  makeStyles,
  toast,
} from "@/design-system";
import { devicesApi } from "@/api/devices";
import { errorMessage, type ApiError } from "@/api/client";
import { KeyValueRow } from "@/components/devices/DeviceUi";
import {
  DEVICE_COMMANDS,
  DEVICE_TOGGLE_LABELS,
  PAYMENT_METHOD_LABELS,
  PRICE_MANAGEMENT_OPTIONS,
  isKnownMachineType,
} from "@/components/devices/deviceHelpers";
import type { DeviceCommandKey, PosDeviceDetail } from "@/types/devices";
import { deviceLocationOptionsKey } from "../../list/DeviceFiltersSheet";
import { OperatingHoursEditor } from "../components/OperatingHoursEditor";
import { buildSettingsPatch, formFromDetail, isDirty, type SettingsForm } from "../settingsForm";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useInvalidateDevices, type DeviceAccess } from "../useDeviceQueries";

export function SettingsTab({ sn, detail, access }: { sn: string; detail: PosDeviceDetail; access: DeviceAccess }) {
  const styles = useStyles();
  const invalidate = useInvalidateDevices();
  const editable = access.manageSettings;

  const [baseline, setBaseline] = useState<SettingsForm>(() => formFromDetail(detail));
  const [form, setForm] = useState<SettingsForm>(baseline);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [command, setCommand] = useState<DeviceCommandKey | null>(null);

  const dirty = isDirty(baseline, form);
  // Kaydedilmemiş ayar varken cihaz detayından çıkış onay ister
  useUnsavedChangesGuard(dirty);

  // Sunucudan yeni detay gelirse ve kullanıcı düzenleme yapmıyorsa formu güncelle
  const [syncedDetail, setSyncedDetail] = useState(detail);
  if (syncedDetail !== detail) {
    setSyncedDetail(detail);
    const next = formFromDetail(detail);
    if (!isDirty(baseline, form)) setForm(next);
    setBaseline(next);
  }

  const locations = useQuery({
    queryKey: deviceLocationOptionsKey(),
    queryFn: ({ signal }) => devicesApi.locationOptions(signal),
    enabled: editable,
    staleTime: 5 * 60_000,
  });

  const locationOptions = useMemo(() => {
    const opts = (locations.data ?? []).map((l) => ({ value: l.id, label: l.name, description: l.region_name ?? undefined }));
    if (detail.location && !opts.some((o) => o.value === detail.location?.id))
      opts.unshift({ value: detail.location.id, label: detail.location.name, description: undefined });
    return [{ value: -1, label: "Konum yok", description: undefined }, ...opts];
  }, [locations.data, detail.location]);

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof devicesApi.updateSettings>[1]) => devicesApi.updateSettings(sn, patch),
    onSuccess: (res) => {
      const w = res._warnings ?? [];
      setWarnings(w);
      const next = formFromDetail(res);
      setBaseline(next);
      setForm(next);
      if (w.length) toast.info("Kaydedildi; bazı alanlar atlandı.");
      else toast.success("Ayarlar kaydedildi.");
      invalidate();
    },
    onError: (e) => {
      const fe = (e as ApiError).fieldErrors;
      if (fe) setErrors(fe);
    },
  });

  const runCommand = useMutation({
    mutationFn: (key: DeviceCommandKey) => devicesApi.updateSettings(sn, { commands: { [key]: true } }),
    onSuccess: (res, key) => {
      const w = res._warnings ?? [];
      setWarnings(w);
      setCommand(null);
      const info = DEVICE_COMMANDS.find((c) => c.key === key);
      toast.success(`${info?.label ?? "Komut"} gönderildi; cihaz bir sonraki bağlantıda uygular.`);
      invalidate();
    },
  });

  const submit = () => {
    const { patch, errors: errs } = buildSettingsPatch(baseline, form);
    setErrors(errs);
    if (Object.keys(errs).length || Object.keys(patch).length === 0) return;
    save.mutate(patch);
  };

  const set = <K extends keyof SettingsForm>(k: K, v: SettingsForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const activeCommand = DEVICE_COMMANDS.find((c) => c.key === command) ?? null;

  return (
    <View style={styles.root} testID="tab-settings">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!editable ? (
          <AppNotice tone="info" message="Cihaz ayarlarını değiştirme yetkiniz yok; ayarlar salt okunur gösteriliyor." />
        ) : null}
        {warnings.length ? (
          <AppNotice tone="warning" title="Bazı değişiklikler uygulanmadı" message={warnings.join("\n")} />
        ) : null}
        {save.error && !(save.error as ApiError).fieldErrors ? <AppNotice tone="danger" message={errorMessage(save.error)} /> : null}

        <AppCard title="Genel">
          <View style={styles.gap}>
            <AppInput
              label="Cihaz adı"
              required
              value={form.pos_name}
              onChangeText={(v) => set("pos_name", v)}
              maxLength={30}
              disabled={!editable}
              error={errors.pos_name}
              testID="settings-name"
            />
            <AppSelect<number>
              label="Konum"
              options={locationOptions}
              value={form.location_id ?? -1}
              onChange={(v) => set("location_id", v === -1 ? null : v)}
              disabled={!editable}
              loading={editable && locations.isLoading}
              error={errors.location_id}
              searchable
              testID="settings-location"
            />
          </View>
        </AppCard>

        <AppCard title="Satış davranışı">
          <View style={styles.gap}>
            <View style={styles.field}>
              <AppText variant="label" color="textSecondary">
                Ödeme tipi
              </AppText>
              <AppSegmented<string>
                testID="settings-odemetip"
                value={form.pos_odemetip != null ? String(form.pos_odemetip) : ""}
                onChange={(k) => editable && set("pos_odemetip", Number(k))}
                items={[
                  { key: "0", label: "Snack" },
                  { key: "1", label: "Kahve" },
                ]}
              />
              {!isKnownMachineType(form.pos_odemetip) ? (
                <AppText variant="caption" color="warning">
                  {form.pos_odemetip == null ? "Ödeme tipi tanımsız." : `Cihazda tanımsız değer (${form.pos_odemetip}) kayıtlı; Snack veya Kahve seçin.`}
                </AppText>
              ) : (
                <AppText variant="caption" color="textTertiary">
                  Kahve modunda satış süresi kontrol edilmez. Şablonlar yalnız aynı tipteki cihazlara atanabilir.
                </AppText>
              )}
              {errors.pos_odemetip ? (
                <AppText variant="caption" color="danger">
                  {errors.pos_odemetip}
                </AppText>
              ) : null}
            </View>
            <AppSelect<number>
              label="Fiyat yönetimi"
              options={PRICE_MANAGEMENT_OPTIONS.map((o) => ({ value: o.value, label: o.label, description: o.description }))}
              value={form.price_management}
              onChange={(v) => set("price_management", v)}
              disabled={!editable}
              error={errors.price_management}
              testID="settings-price-management"
            />
          </View>
        </AppCard>

        <AppCard title="Satış bildirimi">
          <AppSwitchRow
            label="Satış bildirimleri"
            description="Bu cihazın satışları için bildirim gönder"
            value={form.sales_notification_enabled}
            onChange={(v) => set("sales_notification_enabled", v)}
            disabled={!editable}
            testID="settings-notif"
          />
          <AppInput
            label="Bildirim aralığı"
            value={form.sales_notification_interval}
            onChangeText={(v) => set("sales_notification_interval", v.replace(/\D/g, ""))}
            keyboardType="number-pad"
            suffix="dk"
            disabled={!editable}
            error={errors.sales_notification_interval}
            testID="settings-interval"
          />
        </AppCard>

        <AppCard title="Ödeme yöntemleri">
          {PAYMENT_METHOD_LABELS.filter((m) => typeof form.payment_methods[m.key] === "boolean").map((m) => (
            <AppSwitchRow
              key={m.key}
              label={m.label}
              value={form.payment_methods[m.key] === true}
              onChange={(v) => set("payment_methods", { ...form.payment_methods, [m.key]: v })}
              disabled={!editable}
              testID={`settings-pm-${m.key}`}
            />
          ))}
        </AppCard>

        <AppCard title="Cihaz davranışı">
          {DEVICE_TOGGLE_LABELS.filter((d) => typeof form.device_toggles[d.key] === "boolean").map((d) => (
            <AppSwitchRow
              key={d.key}
              label={d.label}
              description={d.description}
              value={form.device_toggles[d.key] === true}
              onChange={(v) => set("device_toggles", { ...form.device_toggles, [d.key]: v })}
              disabled={!editable}
              testID={`settings-toggle-${d.key}`}
            />
          ))}
        </AppCard>

        <AppCard title="Çalışma saatleri">
          <OperatingHoursEditor
            mode={form.oh_mode}
            week={form.oh_week}
            disabled={!editable}
            error={errors.operating_hours}
            onChange={(mode, week) => setForm((f) => ({ ...f, oh_mode: mode, oh_week: week }))}
          />
        </AppCard>

        <AppCard title="Salt okunur" subtitle="Bu alanlar mobil API üzerinden değiştirilemez">
          <KeyValueRow label="Makine modeli" value={detail.machine_type?.name} />
          <KeyValueRow label="Güncelleme periyodu" value={detail.pos_updprd != null ? `${detail.pos_updprd} dk` : null} />
          <KeyValueRow label="Satış zaman aşımı" value={detail.timeouts?.vend_timeout != null ? `${detail.timeouts.vend_timeout} sn` : null} />
          <KeyValueRow label="POS zaman aşımı" value={detail.timeouts?.pos_timeout != null ? `${detail.timeouts.pos_timeout} sn` : null} />
          <KeyValueRow label="Gün sonu saati" value={detail.timeouts?.pos_eod} last />
          {access.selectMachineType ? (
            <AppText variant="caption" color="textTertiary" style={styles.note}>
              Makine modeli seçimi için mobil API makine tipi listesi sağlamıyor.
            </AppText>
          ) : null}
        </AppCard>

        {access.sendCommands ? (
          <AppCard title="Cihaz komutları" subtitle="Cihaz bir sonraki bağlantısında uygular">
            {DEVICE_COMMANDS.map((c, i) => {
              const pending = detail.commands?.[c.key] === true;
              return (
                <View key={c.key} style={[styles.cmdRow, i < DEVICE_COMMANDS.length - 1 && styles.cmdBorder]}>
                  <View style={styles.flex}>
                    <View style={styles.cmdHead}>
                      <AppText variant="bodyStrong">{c.label}</AppText>
                      {pending ? <AppBadge size="sm" tone="warning" dot label="Bekliyor" /> : null}
                    </View>
                    <AppText variant="caption" color="textTertiary">
                      {c.description}
                    </AppText>
                  </View>
                  <AppButton
                    title="Gönder"
                    size="sm"
                    variant={c.irreversible ? "dangerOutline" : "outline"}
                    onPress={() => {
                      runCommand.reset();
                      setCommand(c.key);
                    }}
                    testID={`command-${c.key}`}
                  />
                </View>
              );
            })}
          </AppCard>
        ) : null}
      </ScrollView>

      {editable ? (
        <View style={styles.footer}>
          <AppButton
            title="Vazgeç"
            variant="outline"
            onPress={() => {
              setForm(baseline);
              setErrors({});
            }}
            disabled={!dirty || save.isPending}
            style={styles.flex}
          />
          <AppButton title="Kaydet" onPress={submit} disabled={!dirty} loading={save.isPending} style={styles.flex} testID="settings-save" />
        </View>
      ) : null}

      <AppConfirmSheet
        visible={activeCommand != null}
        title={activeCommand?.label ?? ""}
        message={activeCommand?.confirmMessage}
        summary={activeCommand ? [
          { label: "Cihaz", value: detail.pos_name || sn },
          { label: "Seri no", value: sn },
          { label: "Komut", value: activeCommand.label },
        ] : undefined}
        confirmLabel="Komutu gönder"
        destructive={activeCommand?.irreversible}
        irreversible={activeCommand?.irreversible}
        loading={runCommand.isPending}
        error={runCommand.error ? errorMessage(runCommand.error) : null}
        onConfirm={() => command && runCommand.mutate(command)}
        onCancel={() => setCommand(null)}
      />
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1 },
    flex: { flex: 1 },
    content: { padding: t.layout.screenPadding, gap: t.spacing.md, paddingBottom: t.spacing.huge },
    gap: { gap: t.spacing.md },
    field: { gap: t.spacing.xs },
    note: { marginTop: t.spacing.sm },
    cmdRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.md, paddingVertical: t.spacing.md },
    cmdBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    cmdHead: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    footer: {
      flexDirection: "row",
      gap: t.spacing.md,
      padding: t.layout.screenPadding,
      backgroundColor: t.colors.surface,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
  })
);
