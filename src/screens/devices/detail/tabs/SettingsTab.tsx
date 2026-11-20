/**
 * Ayarlar — web `pos_device_detail.html` ayarlar sekmesiyle aynı bölümler ve sıra:
 * Genel (seri no, cihaz adı, marka yazısı, konum) · Yapılandırma (makine tipi [select_machine_type],
 * ödeme modu, fiyat yönetimi, salt okunur süreler, ses/başlat/vazgeç/ücretsiz vend/dil seçici) ·
 * Ödeme yöntemleri · Durum ve bildirimler (iade, satış bildirimi, aralık) · Çalışma saatleri · Cihaz kontrolleri.
 * Cihaz logosu yükleme henüz mobilde yok (web'de var).
 * `PATCH pos-devices/{sn}/` yalnız değişen ve YAZILABİLİR alanlarla (§3.11).
 * - Ayar alanları: manage_device_settings (yoksa salt okunur)
 * - Komutlar (and_reset / mdb_reset / eod_trig): sunucudaki ortak `send_device_commands` yeteneği
 *   (dashboard_v2/capabilities.py — web ile aynı kural); her biri AppConfirmSheet arkasında.
 * - Yanıttaki `_warnings` kullanıcıya gösterilir.
 */
import React, { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
  AppButton,
  AppConfirmSheet,
  AppIcon,
  AppInput,
  AppNotice,
  AppSelect,
  AppSheet,
  AppText,
  makeStyles,
  toast,
  useTheme,
  type IconName,
} from "@/design-system";
import { devicesApi } from "@/api/devices";
import { errorMessage, type ApiError } from "@/api/client";
import {
  DEVICE_COMMANDS,
  DEVICE_TOGGLE_LABELS,
  PAYMENT_METHOD_LABELS,
  PRICE_MANAGEMENT_OPTIONS,
  isKnownMachineType,
} from "@/components/devices/deviceHelpers";
import type { DeviceCommandKey, DeviceToggleKey, PosDeviceDetail } from "@/types/devices";
import { useOnOpen } from "@/components/devices/useOnOpen";
import { deviceLocationOptionsKey } from "../../list/DeviceFiltersSheet";
import { OperatingHoursEditor } from "../components/OperatingHoursEditor";
import { buildSettingsPatch, formFromDetail, isDirty, type SettingsForm } from "../settingsForm";
import { useUnsavedChangesGuard } from "@/hooks/useUnsavedChangesGuard";
import { useSingleFlight } from "@/hooks/useSingleFlight";
import { useInvalidateDevices, type DeviceAccess } from "../useDeviceQueries";

export function SettingsTab({
  sn,
  detail,
  access,
  onDirtyChange,
}: {
  sn: string;
  detail: PosDeviceDetail;
  access: DeviceAccess;
  /** Kaydedilmemiş değişiklik durumu — ekran sekme değişiminde onay sorar (sekme kapanınca form kaybolur) */
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const styles = useStyles();
  const invalidate = useInvalidateDevices();
  const editable = access.manageSettings;

  const [baseline, setBaseline] = useState<SettingsForm>(() => formFromDetail(detail));
  const [form, setForm] = useState<SettingsForm>(baseline);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [warnings, setWarnings] = useState<string[]>([]);
  const [command, setCommand] = useState<DeviceCommandKey | null>(null);
  const [editing, setEditing] = useState<TextField | null>(null);
  const [pmOpen, setPmOpen] = useState(false);
  const [ohOpen, setOhOpen] = useState(false);

  const dirty = isDirty(baseline, form);
  // Kaydedilmemiş ayar varken cihaz detayından çıkış onay ister
  useUnsavedChangesGuard(dirty);
  useEffect(() => {
    onDirtyChange?.(dirty);
  }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

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

  // Makine tipi listesi yalnız 'Makine Tipi' grubu üyelerine (web ile aynı)
  const machineTypes = useQuery({
    queryKey: ["machine-types"],
    queryFn: ({ signal }) => devicesApi.machineTypes(signal),
    enabled: editable && access.selectMachineType,
    staleTime: 30 * 60_000,
  });
  const machineTypeOptions = useMemo(() => {
    const opts = (machineTypes.data ?? []).map((m) => ({ value: m.id, label: m.name }));
    if (detail.machine_type && !opts.some((o) => o.value === detail.machine_type?.id))
      opts.unshift({ value: detail.machine_type.id, label: detail.machine_type.name });
    return [{ value: -1, label: "Makine tipi yok" }, ...opts];
  }, [machineTypes.data, detail.machine_type]);

  const locationOptions = useMemo(() => {
    const opts = (locations.data ?? []).map((l) => ({
      value: l.id,
      label: l.name,
      description: l.region_name ?? undefined,
    }));
    if (detail.location && !opts.some((o) => o.value === detail.location?.id))
      opts.unshift({ value: detail.location.id, label: detail.location.name, description: undefined });
    return [{ value: -1, label: "Konum yok", description: undefined }, ...opts];
  }, [locations.data, detail.location]);

  const save = useMutation({
    mutationFn: (patch: Parameters<typeof devicesApi.updateSettings>[1]) =>
      devicesApi.updateSettings(sn, patch),
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
      toast.success(`${info?.label ?? "Komut"} gönderildi; POS cihazı bir sonraki bağlantıda uygular.`);
      invalidate();
    },
  });

  // Komut onayı tek uçuşlu: art arda dokunuş ikinci komutu göndermez
  const confirmCommand = useSingleFlight(() =>
    command ? runCommand.mutateAsync(command) : Promise.resolve()
  );

  const submit = () => {
    const { patch, errors: errs } = buildSettingsPatch(baseline, form);
    setErrors(errs);
    if (Object.keys(errs).length || Object.keys(patch).length === 0) return;
    save.mutate(patch);
  };

  const knownPm = PAYMENT_METHOD_LABELS.filter(
    (m) => m.key !== "refund" && typeof form.payment_methods[m.key] === "boolean"
  ).length;
  const enabledPm = PAYMENT_METHOD_LABELS.filter(
    (m) => m.key !== "refund" && form.payment_methods[m.key] === true
  ).length;

  const set = <K extends keyof SettingsForm>(k: K, v: SettingsForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const activeCommand = DEVICE_COMMANDS.find((c) => c.key === command) ?? null;

  return (
    <View style={styles.root} testID="tab-settings">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {!editable ? (
          <AppNotice
            tone="info"
            message="Cihaz ayarlarını değiştirme yetkiniz yok; ayarlar salt okunur gösteriliyor."
          />
        ) : null}
        {warnings.length ? (
          <AppNotice tone="warning" title="Bazı değişiklikler uygulanmadı" message={warnings.join("\n")} />
        ) : null}
        {save.error && !(save.error as ApiError).fieldErrors ? (
          <AppNotice tone="danger" message={errorMessage(save.error)} />
        ) : null}

        {/* iOS ayarları gibi: renkli simgeli satırlar; dokununca alttan düzenleme, değer satırın sağında */}
        <SettingsGroup title="Genel">
          <SettingRow icon="hash" iconBg={C.slate} label="Seri no" value={detail.sn} mono />
          <SettingRow
            icon="edit-3"
            iconBg={C.blue}
            label="Cihaz adı"
            value={form.pos_name || "—"}
            error={errors.pos_name}
            onPress={editable ? () => setEditing("pos_name") : undefined}
            testID="settings-name-row"
          />
          <SettingRow
            icon="type"
            iconBg={C.indigo}
            label="Marka yazısı"
            value={form.pos_text.trim() || "Yok"}
            muted={!form.pos_text.trim()}
            error={errors.pos_text}
            onPress={editable ? () => setEditing("pos_text") : undefined}
            testID="settings-brand-row"
          />
          <AppSelect<number>
            variant="row"
            icon="map-pin"
            iconBg={C.red}
            label="Konum"
            sheetTitle="Konum"
            options={locationOptions}
            value={form.location_id ?? -1}
            onChange={(v) => set("location_id", v === -1 ? null : v)}
            disabled={!editable}
            loading={editable && locations.isLoading}
            error={errors.location_id}
            searchable
            testID="settings-location"
          />
        </SettingsGroup>

        <SettingsGroup title="Yapılandırma">
          {access.selectMachineType ? (
            <AppSelect<number>
              variant="row"
              icon="cpu"
              iconBg={C.teal}
              label="Makine tipi"
              sheetTitle="Makine tipi"
              options={machineTypeOptions}
              value={form.machine_type_id ?? -1}
              onChange={(v) => set("machine_type_id", v === -1 ? null : v)}
              disabled={!editable}
              loading={machineTypes.isLoading}
              searchable
              testID="settings-machine-type"
            />
          ) : null}
          <AppSelect<number>
            variant="row"
            icon="coffee"
            iconBg={C.amber}
            label="Ödeme modu"
            sheetTitle="Ödeme modu"
            options={[
              { value: 0, label: "Snack" },
              { value: 1, label: "Kahve", description: "Satış süresi kontrol edilmez" },
            ]}
            value={isKnownMachineType(form.pos_odemetip) ? form.pos_odemetip : null}
            placeholder={form.pos_odemetip == null ? "Tanımsız" : `Tanımsız (${form.pos_odemetip})`}
            onChange={(v) => set("pos_odemetip", v)}
            disabled={!editable}
            error={errors.pos_odemetip}
            testID="settings-odemetip"
          />
          <AppSelect<number>
            variant="row"
            icon="dollar-sign"
            iconBg={C.green}
            label="Fiyat yönetimi"
            sheetTitle="Fiyat yönetimi"
            options={PRICE_MANAGEMENT_OPTIONS.map((o) => ({
              value: o.value,
              label: o.label,
              description: o.description,
            }))}
            value={form.price_management}
            onChange={(v) => set("price_management", v)}
            disabled={!editable}
            error={errors.price_management}
            testID="settings-price-management"
          />
          {DEVICE_TOGGLE_LABELS.filter((d) => typeof form.device_toggles[d.key] === "boolean").map((d) => (
            <SettingSwitch
              key={d.key}
              icon={TOGGLE_ICONS[d.key].icon}
              iconBg={TOGGLE_ICONS[d.key].bg}
              label={d.label}
              value={form.device_toggles[d.key] === true}
              onChange={(v) => set("device_toggles", { ...form.device_toggles, [d.key]: v })}
              disabled={!editable}
              testID={`settings-toggle-${d.key}`}
            />
          ))}
        </SettingsGroup>

        {/* Web'de salt okunur: cihaz yönetir */}
        <SettingsGroup
          title="Cihaz zamanlamaları"
          footer="Bu değerleri cihaz belirler; buradan değiştirilemez."
        >
          <View style={styles.roGrid}>
            <ReadOnlyTile icon="moon" label="Gün sonu saati" value={detail.timeouts?.pos_eod ?? null} />
            <ReadOnlyTile
              icon="refresh-cw"
              label="Güncelleme periyodu"
              value={detail.pos_updprd != null ? `${detail.pos_updprd} dk` : null}
            />
            <ReadOnlyTile
              icon="check-circle"
              label="Satış onay süresi"
              value={msLabel(detail.timeouts?.vend_timeout)}
            />
            <ReadOnlyTile icon="clock" label="Timeout süresi" value={msLabel(detail.timeouts?.pos_timeout)} />
          </View>
        </SettingsGroup>

        <SettingsGroup title="Ödeme ve bildirimler">
          <SettingRow
            icon="credit-card"
            iconBg={C.blue}
            label="Ödeme yöntemleri"
            value={`${enabledPm} / ${knownPm} açık`}
            onPress={() => setPmOpen(true)}
            testID="settings-pm-row"
          />
          {typeof form.payment_methods.refund === "boolean" ? (
            <SettingSwitch
              icon="rotate-ccw"
              iconBg={C.pink}
              label="İade"
              value={form.payment_methods.refund === true}
              onChange={(v) => set("payment_methods", { ...form.payment_methods, refund: v })}
              disabled={!editable}
              testID="settings-pm-refund"
            />
          ) : null}
          <SettingSwitch
            icon="bell"
            iconBg={C.red}
            label="Satış bildirimi"
            value={form.sales_notification_enabled}
            onChange={(v) => set("sales_notification_enabled", v)}
            disabled={!editable}
            testID="settings-notif"
          />
          <SettingRow
            icon="watch"
            iconBg={C.purple}
            label="Bildirim aralığı"
            value={form.sales_notification_interval ? `${form.sales_notification_interval} dk` : "—"}
            error={errors.sales_notification_interval}
            onPress={editable ? () => setEditing("sales_notification_interval") : undefined}
            testID="settings-interval-row"
          />
        </SettingsGroup>

        <SettingsGroup title="Çalışma saatleri">
          <SettingRow
            icon="calendar"
            iconBg={C.teal}
            label="Mod"
            value={OH_LABEL[form.oh_mode]}
            sub={form.oh_mode !== 0 ? `${form.oh_week.reduce((n, d) => n + d.length, 0)} aralık` : undefined}
            error={errors.operating_hours}
            onPress={() => setOhOpen(true)}
            testID="settings-oh-row"
          />
        </SettingsGroup>

        {access.sendCommands ? (
          <SettingsGroup
            title="Cihaz kontrolleri"
            footer="Komutlar cihaz bir sonraki bağlantısında uygulanır; cihazı yeniden başlatabilir."
          >
            {DEVICE_COMMANDS.map((c) => {
              const pending = detail.commands?.[c.key] === true;
              return (
                <SettingRow
                  key={c.key}
                  icon={c.key === "eod_trig" ? "moon" : c.key === "mdb_reset" ? "refresh-cw" : "power"}
                  iconBg={c.irreversible ? C.red : C.orange}
                  label={c.label}
                  sub={c.description}
                  value={pending ? "Bekliyor" : ""}
                  valueTone={pending ? "warning" : undefined}
                  danger={c.irreversible}
                  onPress={() => {
                    runCommand.reset();
                    setCommand(c.key);
                  }}
                  testID={`command-${c.key}`}
                />
              );
            })}
          </SettingsGroup>
        ) : null}
      </ScrollView>

      <TextEditSheet
        field={editing}
        form={form}
        onClose={() => setEditing(null)}
        onApply={(k, v) => {
          set(k, v);
          setEditing(null);
        }}
      />
      <AppSheet
        visible={pmOpen}
        onClose={() => setPmOpen(false)}
        title="Ödeme yöntemleri"
        subtitle={`${enabledPm} / ${knownPm} açık`}
        testID="settings-pm-sheet"
      >
        <View style={styles.pmGrid}>
          {PAYMENT_METHOD_LABELS.filter(
            (m) => m.key !== "refund" && typeof form.payment_methods[m.key] === "boolean"
          ).map((m) => {
            const on = form.payment_methods[m.key] === true;
            return (
              <Pressable
                key={m.key}
                onPress={() => editable && set("payment_methods", { ...form.payment_methods, [m.key]: !on })}
                disabled={!editable}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: on, disabled: !editable }}
                accessibilityLabel={m.label}
                style={({ pressed }) => [
                  styles.pm,
                  on && styles.pmOn,
                  pressed && styles.pressed,
                  !editable && styles.disabled,
                ]}
                testID={`settings-pm-${m.key}`}
              >
                <View style={[styles.pmBox, on && styles.pmBoxOn]}>
                  {on ? <AppIcon name="check" size={13} color="onPrimary" /> : null}
                </View>
                <AppText
                  variant="callout"
                  weight={on ? "700" : "500"}
                  color={on ? "primary" : "text"}
                  numberOfLines={1}
                  style={styles.flexMin}
                >
                  {m.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </AppSheet>
      <AppSheet
        visible={ohOpen}
        onClose={() => setOhOpen(false)}
        title="Çalışma saatleri"
        subtitle="Cihazın çalışabileceği veya çalışamayacağı saatler"
        testID="settings-oh-sheet"
      >
        <OperatingHoursEditor
          mode={form.oh_mode}
          week={form.oh_week}
          disabled={!editable}
          error={errors.operating_hours}
          onChange={(mode, week) => setForm((f) => ({ ...f, oh_mode: mode, oh_week: week }))}
        />
      </AppSheet>

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
          <AppButton
            title="Kaydet"
            onPress={submit}
            disabled={!dirty}
            loading={save.isPending}
            style={styles.flex}
            testID="settings-save"
          />
        </View>
      ) : null}

      <AppConfirmSheet
        visible={activeCommand != null}
        title={activeCommand?.label ?? ""}
        message={activeCommand?.confirmMessage}
        summary={
          activeCommand
            ? [
                { label: "Cihaz", value: detail.pos_name || sn },
                { label: "Seri no", value: sn },
                { label: "Komut", value: activeCommand.label },
              ]
            : undefined
        }
        confirmLabel="Komutu gönder"
        destructive={activeCommand?.irreversible}
        irreversible={activeCommand?.irreversible}
        loading={runCommand.isPending}
        error={runCommand.error ? errorMessage(runCommand.error) : null}
        onConfirm={confirmCommand}
        onCancel={() => setCommand(null)}
      />
    </View>
  );
}

/** iOS ayarları tarzı simge kutusu renkleri */
const C = {
  blue: "#2563EB",
  indigo: "#4F46E5",
  purple: "#7C3AED",
  pink: "#DB2777",
  red: "#DC2626",
  orange: "#EA580C",
  amber: "#D97706",
  green: "#16A34A",
  teal: "#0D9488",
  slate: "#64748B",
} as const;

const TOGGLE_ICONS: Record<DeviceToggleKey, { icon: IconName; bg: string }> = {
  audio: { icon: "volume-2", bg: C.pink },
  auto_select: { icon: "zap", bg: C.amber },
  login_button: { icon: "play", bg: C.green },
  cancel_button: { icon: "x-circle", bg: C.red },
  free_mode: { icon: "gift", bg: C.purple },
  language_selector: { icon: "globe", bg: C.blue },
};

const OH_LABEL: Record<0 | 1 | 2, string> = { 0: "Kapalı", 1: "Çalışma saatleri", 2: "Çalışmama saatleri" };

type TextField = "pos_name" | "pos_text" | "sales_notification_interval";
const TEXT_FIELDS: Record<
  TextField,
  { title: string; placeholder?: string; numeric?: boolean; suffix?: string; testID: string; hint?: string }
> = {
  pos_name: { title: "Cihaz adı", testID: "settings-name", hint: "En fazla 30 karakter." },
  pos_text: {
    title: "Marka yazısı",
    placeholder: "Örn. Serpet Otomasyon",
    testID: "settings-brand-text",
    hint: "Cihaz ekranında görünür. Boş bırakılırsa gösterilmez.",
  },
  sales_notification_interval: {
    title: "Bildirim aralığı",
    numeric: true,
    suffix: "dk",
    testID: "settings-interval",
    hint: "Dakika cinsinden, en az 1.",
  },
};

/** Cihaz milisaniye tutar; okunaklı saniye (ör. 30000 → "30 sn") */
function msLabel(ms: number | null | undefined): string | null {
  if (ms == null) return null;
  return `${(ms / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 1 })} sn`;
}

/** Grup: başlık kart dışında, satırlar beyaz kartta ince çizgilerle; isteğe bağlı alt not */
function SettingsGroup({
  title,
  footer,
  children,
}: {
  title: string;
  footer?: string;
  children: React.ReactNode;
}) {
  const styles = useStyles();
  const { isDark } = useTheme();
  const rows = React.Children.toArray(children).filter(Boolean);
  return (
    <View style={styles.group}>
      <AppText variant="cardTitle" accessibilityRole="header" style={styles.groupTitle}>
        {title}
      </AppText>
      <View style={[styles.groupCard, isDark ? styles.cardDark : styles.cardLight]}>
        {rows.map((r, i) => (
          <View key={i}>
            {/* Ayırıcı simgenin sağından başlar (iOS ayarları gibi) */}
            {i > 0 ? <View style={styles.rowDivider} /> : null}
            {r}
          </View>
        ))}
      </View>
      {footer ? (
        <AppText variant="caption" color="textTertiary" style={styles.groupFooter}>
          {footer}
        </AppText>
      ) : null}
    </View>
  );
}

function IconTile({ icon, bg }: { icon: IconName; bg: string }) {
  const styles = useStyles();
  return (
    <View style={[styles.iconTile, { backgroundColor: bg }]}>
      <AppIcon name={icon} size={16} color="#FFFFFF" />
    </View>
  );
}

/** Satır: simge · etiket (+ alt yazı) · sağda değer · ok (dokunulabilirse) */
function SettingRow({
  icon,
  iconBg,
  label,
  sub,
  value,
  valueTone,
  muted,
  mono,
  danger,
  error,
  onPress,
  testID,
}: {
  icon: IconName;
  iconBg: string;
  label: string;
  sub?: string;
  value?: string;
  valueTone?: "warning";
  muted?: boolean;
  mono?: boolean;
  danger?: boolean;
  error?: string | null;
  onPress?: () => void;
  testID?: string;
}) {
  const styles = useStyles();
  const body = (
    <>
      <IconTile icon={icon} bg={iconBg} />
      <View style={styles.flexMin}>
        <AppText variant="body" color={danger ? "danger" : "text"} numberOfLines={1}>
          {label}
        </AppText>
        {sub ? (
          <AppText variant="caption" color="textTertiary" numberOfLines={2}>
            {sub}
          </AppText>
        ) : null}
        {error ? (
          <AppText variant="caption" color="danger">
            {error}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText
          variant={mono ? "mono" : "callout"}
          color={valueTone === "warning" ? "warning" : muted ? "textTertiary" : "textSecondary"}
          weight={valueTone ? "700" : undefined}
          numberOfLines={1}
          style={styles.rowValue}
        >
          {value}
        </AppText>
      ) : null}
      {onPress ? <AppIcon name="chevron-right" size={18} color="textTertiary" /> : null}
    </>
  );
  return onPress ? (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}${value ? `: ${value}` : ""}`}
      style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
      testID={testID}
    >
      {body}
    </Pressable>
  ) : (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value ?? "—"}`} testID={testID}>
      {body}
    </View>
  );
}

/** Anahtarlı satır: simge · etiket · anahtar */
function SettingSwitch({
  icon,
  iconBg,
  label,
  value,
  onChange,
  disabled,
  testID,
}: {
  icon: IconName;
  iconBg: string;
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  return (
    <View style={[styles.row, disabled && styles.disabled]}>
      <IconTile icon={icon} bg={iconBg} />
      <AppText variant="body" numberOfLines={1} style={styles.flexMin}>
        {label}
      </AppText>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        accessibilityLabel={label}
        trackColor={{ true: colors.primary, false: colors.borderStrong }}
        thumbColor="#FFFFFF"
        ios_backgroundColor={colors.borderStrong}
        testID={testID}
      />
    </View>
  );
}

/** Salt okunur küçük kutu */
function ReadOnlyTile({ icon, label, value }: { icon: IconName; label: string; value: string | null }) {
  const styles = useStyles();
  return (
    <View style={styles.roTile} accessible accessibilityLabel={`${label}: ${value ?? "—"}`}>
      <View style={styles.roHead}>
        <AppIcon name={icon} size={13} color="textTertiary" />
        <AppText variant="caption" color="textTertiary" numberOfLines={1} style={styles.flexMin}>
          {label}
        </AppText>
      </View>
      <AppText variant="bodyStrong">{value ?? "—"}</AppText>
    </View>
  );
}

/** Metin alanı düzenleme sayfası — "Tamam" taslağı forma yazar (kaydetme alttaki Kaydet ile) */
function TextEditSheet({
  field,
  form,
  onClose,
  onApply,
}: {
  field: TextField | null;
  form: SettingsForm;
  onClose: () => void;
  onApply: (k: TextField, v: string) => void;
}) {
  const styles = useStyles();
  const [draft, setDraft] = useState("");
  useOnOpen(field != null, () => setDraft(field ? form[field] : ""));
  const cfg = field ? TEXT_FIELDS[field] : null;
  return (
    <AppSheet
      visible={field != null}
      onClose={onClose}
      title={cfg?.title ?? ""}
      footer={
        <>
          <AppButton title="Vazgeç" variant="outline" onPress={onClose} style={styles.flex} />
          <AppButton
            title="Tamam"
            onPress={() => field && onApply(field, draft)}
            style={styles.flex}
            testID="settings-text-apply"
          />
        </>
      }
    >
      {cfg ? (
        <View style={styles.gapSm}>
          <AppInput
            label={cfg.title}
            value={draft}
            onChangeText={(v) => setDraft(cfg.numeric ? v.replace(/\D/g, "") : v)}
            keyboardType={cfg.numeric ? "number-pad" : "default"}
            maxLength={cfg.numeric ? 5 : 30}
            placeholder={cfg.placeholder}
            suffix={cfg.suffix}
            autoFocus
            testID={cfg.testID}
          />
          {cfg.hint ? (
            <AppText variant="caption" color="textTertiary">
              {cfg.hint}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1 },
    flex: { flex: 1 },
    content: { padding: t.layout.screenPadding, gap: t.spacing.lg, paddingBottom: t.spacing.huge },
    group: { gap: t.spacing.sm },
    gapSm: { gap: t.spacing.xs },
    groupTitle: { paddingHorizontal: 2 },
    groupFooter: { paddingHorizontal: 4 },
    groupCard: { borderRadius: 16, backgroundColor: t.colors.surface, overflow: "hidden" },
    cardLight: {
      shadowColor: "#0F172A",
      shadowOpacity: 0.07,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 2,
    },
    cardDark: { borderWidth: StyleSheet.hairlineWidth, borderColor: t.colors.border },
    rowDivider: {
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
      marginLeft: t.layout.cardPadding + 30 + t.spacing.md,
    },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      minHeight: 52,
      paddingHorizontal: t.layout.cardPadding,
      paddingVertical: t.spacing.sm,
    },
    rowPressed: { backgroundColor: t.colors.surfacePressed },
    rowValue: { flexShrink: 1, maxWidth: "50%", textAlign: "right" },
    iconTile: { width: 30, height: 30, borderRadius: 8, alignItems: "center", justifyContent: "center" },
    roHead: { flexDirection: "row", alignItems: "center", gap: 5 },
    flexMin: { flex: 1, minWidth: 0 },
    pressed: { opacity: 0.7 },
    disabled: { opacity: 0.6 },
    roGrid: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm, padding: t.spacing.md },
    roTile: {
      flexBasis: "47%",
      flexGrow: 1,
      gap: 2,
      padding: t.spacing.sm + 2,
      borderRadius: 12,
      backgroundColor: t.colors.surfaceMuted,
    },
    pmGrid: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.sm },
    pm: {
      flexBasis: "47%",
      flexGrow: 1,
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm + 2,
      borderRadius: 12,
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    pmOn: { backgroundColor: t.colors.primarySubtle, borderColor: t.colors.primarySubtle },
    pmBox: {
      width: 20,
      height: 20,
      borderRadius: 6,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    pmBoxOn: { backgroundColor: t.colors.primary, borderColor: t.colors.primary },
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
