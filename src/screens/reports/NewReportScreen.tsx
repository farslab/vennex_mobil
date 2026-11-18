/**
 * Yeni rapor — seçenekler `GET /reports/filter-options/`, oluşturma `POST /reports/` (202).
 * Hatalar: 400 doğrulama · 403 NFC yetkisi · 404 kayıt yok · 429 başka aktif rapor (`reporting.py:65-140`).
 */
import React, { useMemo, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  AppButton,
  AppChip,
  AppEmptyState,
  AppErrorState,
  AppInput,
  AppListSkeleton,
  AppNotice,
  AppScreen,
  AppSection,
  AppSegmented,
  AppSelect,
  AppText,
  makeStyles,
  toast,
} from "@/design-system";
import { errorMessage, type ApiError } from "@/api/client";
import { reportsApi } from "@/api/reports";
import { queryKeys } from "@/api/queryKeys";
import { canViewSales } from "@/auth/permissions";
import { useAuthStore } from "@/store/authStore";
import { formatDate } from "@/utils/date";
import { formatInteger } from "@/utils/number";
import {
  REPORT_FAILURE_REASONS,
  REPORT_PAYMENT_TYPES,
  REPORT_TYPE_DESCRIPTIONS,
  type ReportFailureReason,
  type ReportFilterOptions,
  type ReportTransactionStatus,
} from "@/types/reports";
import type { RootStackParamList } from "@/navigation/types";
import {
  CUSTOM_NAME_MAX,
  DATE_PRESETS,
  availableDevices,
  availableLocations,
  availableRegions,
  defaultReportType,
  initialReportForm,
  isNfcReport,
  presetRange,
  pruneSelections,
  validateReportForm,
  type ReportFormErrors,
  type ReportFormState,
} from "./reportForm";

const ALL = "__all__";

export default function NewReportScreen() {
  const styles = useStyles();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const queryClient = useQueryClient();
  const allowed = canViewSales(useAuthStore((s) => s.user));

  const optionsQuery = useQuery({
    queryKey: queryKeys.reports.filterOptions(),
    queryFn: ({ signal }) => reportsApi.filterOptions(signal),
    staleTime: 10 * 60_000,
    enabled: allowed,
  });
  const options = optionsQuery.data;

  const [form, setForm] = useState<ReportFormState>(() => initialReportForm());
  const [errors, setErrors] = useState<ReportFormErrors>({});
  const reportType = form.reportType || defaultReportType(options);
  const nfc = isNfcReport(reportType);

  const update = (patch: Partial<ReportFormState>, prune = false) => {
    setForm((f) => {
      const next = { ...f, ...patch };
      return prune ? pruneSelections(next, options) : next;
    });
    setErrors((e) => {
      const copy = { ...e };
      Object.keys(patch).forEach((k) => delete copy[k as keyof ReportFormErrors]);
      if ("startInput" in patch || "endInput" in patch) delete copy.range;
      return copy;
    });
  };

  const create = useMutation({
    mutationFn: reportsApi.create,
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.reports.all });
      toast.success(
        res.estimated_rows != null
          ? `Rapor kuyruğa alındı (~${formatInteger(res.estimated_rows)} satır).`
          : "Rapor kuyruğa alındı."
      );
      navigation.goBack();
    },
  });
  const apiError = create.error as ApiError | null;

  const submit = () => {
    if (create.isPending) return;
    const result = validateReportForm({ ...form, reportType });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setErrors({});
    create.mutate(result.payload);
  };

  if (!allowed) {
    return (
      <AppEmptyState icon="lock" title="Rapor yetkiniz yok" description="Raporlar satış görüntüleme yetkisi gerektirir." />
    );
  }
  if (optionsQuery.isLoading) {
    return (
      <AppScreen>
        <AppListSkeleton rows={6} />
      </AppScreen>
    );
  }
  if (!options) {
    return (
      <AppErrorState
        title="Form seçenekleri alınamadı"
        message={errorMessage(optionsQuery.error)}
        onRetry={() => optionsQuery.refetch()}
        retrying={optionsQuery.isFetching}
      />
    );
  }

  const fieldError = (key: "start_date" | "end_date") => apiError?.fieldErrors?.[key] ?? null;

  return (
    <AppScreen
      testID="new-report-screen"
      footer={
        <AppButton
          title="Rapor oluştur"
          icon="file-plus"
          onPress={submit}
          loading={create.isPending}
          disabled={!reportType}
          fullWidth
          testID="submit-report"
        />
      }
    >
      <SubmitErrorNotice error={apiError} onGoReports={() => navigation.navigate("Reports")} />

      <AppSection title="Rapor tipi">
        {options.report_types.length === 0 ? (
          <AppNotice tone="warning" message="Sunucu kullanılabilir rapor tipi döndürmedi." />
        ) : (
          <View style={styles.typeList} accessibilityRole="radiogroup">
            {options.report_types.map((t) => {
              const disabled = isNfcReport(t.value) && !options.has_personel_kart_pos;
              const selected = reportType === t.value;
              const desc = disabled
                ? "Şirketinizde PersonelKart özelliği aktif POS bulunmuyor."
                : (REPORT_TYPE_DESCRIPTIONS as Record<string, string>)[t.value];
              return (
                <Pressable
                  key={t.value}
                  onPress={() => update({ reportType: t.value })}
                  disabled={disabled}
                  accessibilityRole="radio"
                  accessibilityState={{ selected, disabled }}
                  accessibilityLabel={`${t.label}${desc ? `. ${desc}` : ""}`}
                  style={({ pressed }) => [
                    styles.typeCard,
                    selected && styles.typeCardOn,
                    disabled && styles.disabled,
                    pressed && !selected && styles.pressed,
                  ]}
                  testID={`report-type-${t.value}`}
                >
                  <View style={[styles.radio, selected && styles.radioOn]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="calloutStrong" color={selected ? "primary" : "text"}>
                      {t.label}
                    </AppText>
                    {desc ? (
                      <AppText variant="caption" color="textTertiary">
                        {desc}
                      </AppText>
                    ) : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        )}
        {errors.reportType ? (
          <AppText variant="caption" color="danger">
            {errors.reportType}
          </AppText>
        ) : null}
      </AppSection>

      <AppSection title="Tarih aralığı">
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips} style={styles.chipScroll}>
          {DATE_PRESETS.map((p) => {
            const r = presetRange(p.key);
            const selected = form.startInput === formatDate(r.start) && form.endInput === formatDate(r.end);
            return (
              <AppChip
                key={p.key}
                label={p.label}
                selected={selected}
                onPress={() => update({ startInput: formatDate(r.start), endInput: formatDate(r.end) })}
              />
            );
          })}
        </ScrollView>
        <View style={styles.row}>
          <View style={styles.flex}>
            <AppInput
              label="Başlangıç"
              required
              placeholder="GG.AA.YYYY"
              value={form.startInput}
              onChangeText={(v) => update({ startInput: v })}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              error={errors.startInput ?? fieldError("start_date")}
              testID="report-start"
            />
          </View>
          <View style={styles.flex}>
            <AppInput
              label="Bitiş"
              required
              placeholder="GG.AA.YYYY"
              value={form.endInput}
              onChangeText={(v) => update({ endInput: v })}
              keyboardType="numbers-and-punctuation"
              maxLength={10}
              error={errors.endInput ?? fieldError("end_date")}
              testID="report-end"
            />
          </View>
        </View>
        {errors.range ? <AppNotice tone="danger" message={errors.range} /> : null}
      </AppSection>

      {nfc ? (
        <NfcFilters options={options} form={form} update={update} />
      ) : (
        <PosFilters options={options} form={form} update={update} errors={errors} />
      )}

      <AppSection title="Rapor adı">
        <AppInput
          placeholder="İsteğe bağlı, ör. Kasım satışları"
          value={form.customName}
          onChangeText={(v) => update({ customName: v })}
          maxLength={CUSTOM_NAME_MAX}
          error={errors.customName}
          helper="Listede ve dosya adında kullanılır."
          testID="report-name"
        />
      </AppSection>
    </AppScreen>
  );
}

/* ---------------------------------------------------------------- Parts */

type Update = (patch: Partial<ReportFormState>, prune?: boolean) => void;

function PosFilters({
  options,
  form,
  update,
  errors,
}: {
  options: ReportFilterOptions;
  form: ReportFormState;
  update: Update;
  errors: ReportFormErrors;
}) {
  const styles = useStyles();
  const regions = useMemo(() => availableRegions(options, form.companies), [options, form.companies]);
  const locations = useMemo(
    () => availableLocations(options, form.companies, form.regions),
    [options, form.companies, form.regions]
  );
  const devices = useMemo(
    () => availableDevices(options, form.companies, form.locations),
    [options, form.companies, form.locations]
  );

  return (
    <AppSection title="Filtreler">
      <View style={styles.fields}>
        {options.companies.length > 1 ? (
          <AppSelect<number>
            multiple
            label="Şirketler"
            placeholder="Tüm şirketler"
            options={options.companies.map((c) => ({ value: c.id, label: c.name }))}
            value={form.companies}
            onChange={(v) => update({ companies: v }, true)}
            testID="report-companies"
          />
        ) : null}
        {regions.length > 0 ? (
          <AppSelect<number>
            multiple
            label="Bölgeler"
            placeholder="Tüm bölgeler"
            options={regions.map((r) => ({ value: r.id, label: r.name }))}
            value={form.regions}
            onChange={(v) => update({ regions: v }, true)}
            testID="report-regions"
          />
        ) : null}
        {locations.length > 0 ? (
          <AppSelect<number>
            multiple
            label="Konumlar"
            placeholder="Tüm konumlar"
            options={locations.map((l) => ({ value: l.id, label: l.name, description: l.region_name ?? undefined }))}
            value={form.locations}
            onChange={(v) => update({ locations: v }, true)}
            testID="report-locations"
          />
        ) : null}
        <AppSelect<string>
          multiple
          label="POS cihazları"
          placeholder={devices.length ? `Tüm cihazlar (${devices.length})` : "Cihaz bulunamadı"}
          options={devices.map((d) => ({ value: d.sn, label: d.pos_name || d.sn, description: d.sn }))}
          value={form.devices}
          onChange={(v) => update({ devices: v })}
          disabled={devices.length === 0}
          searchable
          testID="report-devices"
        />

        <View style={styles.field}>
          <AppText variant="label" color="textSecondary">
            İşlem durumu
          </AppText>
          <AppSegmented<ReportTransactionStatus>
            items={[
              { key: "all", label: "Tümü" },
              { key: "success", label: "Başarılı" },
              { key: "fail", label: "Başarısız" },
            ]}
            value={form.transactionStatus}
            onChange={(v) => update({ transactionStatus: v, failureReason: v === "fail" ? form.failureReason : "" })}
            testID="report-tx-status"
          />
        </View>

        {form.transactionStatus === "fail" ? (
          <AppSelect<string>
            label="Başarısızlık nedeni"
            placeholder="Tüm nedenler"
            options={[{ value: ALL, label: "Tüm nedenler" }, ...REPORT_FAILURE_REASONS]}
            value={form.failureReason || ALL}
            onChange={(v) => update({ failureReason: v === ALL ? "" : (v as ReportFailureReason) })}
            testID="report-failure-reason"
          />
        ) : null}

        <View style={styles.row}>
          <View style={styles.flex}>
            <AppSelect<string>
              label="Ödeme tipi"
              placeholder="Tümü"
              options={[{ value: ALL, label: "Tümü" }, ...REPORT_PAYMENT_TYPES]}
              value={form.paymentType === "" ? ALL : form.paymentType}
              onChange={(v) => update({ paymentType: v === ALL ? "" : v })}
              testID="report-payment-type"
            />
          </View>
          <View style={styles.flex}>
            <AppInput
              label="En az tutar"
              placeholder="0,00"
              suffix="₺"
              keyboardType="decimal-pad"
              value={form.minAmount}
              onChangeText={(v) => update({ minAmount: v })}
              error={errors.minAmount}
              testID="report-min-amount"
            />
          </View>
        </View>
      </View>
    </AppSection>
  );
}

function NfcFilters({ options, form, update }: { options: ReportFilterOptions; form: ReportFormState; update: Update }) {
  const styles = useStyles();
  if (!options.nfc_sources.length && !options.nfc_operations.length) return null;
  return (
    <AppSection title="Filtreler">
      <View style={styles.fields}>
        {options.nfc_sources.length ? (
          <AppSelect<string>
            label="Kaynak"
            placeholder="Tüm kaynaklar"
            options={[{ value: ALL, label: "Tüm kaynaklar" }, ...options.nfc_sources]}
            value={form.nfcSource || ALL}
            onChange={(v) => update({ nfcSource: v === ALL ? "" : v })}
            testID="report-nfc-source"
          />
        ) : null}
        {options.nfc_operations.length ? (
          <AppSelect<string>
            label="İşlem türü"
            placeholder="Tüm işlemler"
            options={[{ value: ALL, label: "Tüm işlemler" }, ...options.nfc_operations]}
            value={form.nfcOperation || ALL}
            onChange={(v) => update({ nfcOperation: v === ALL ? "" : v })}
            testID="report-nfc-operation"
          />
        ) : null}
      </View>
    </AppSection>
  );
}

function SubmitErrorNotice({ error, onGoReports }: { error: ApiError | null; onGoReports: () => void }) {
  const styles = useStyles();
  if (!error) return null;
  if (error.status === 429) {
    return (
      <View style={styles.noticeBlock}>
        <AppNotice
          tone="warning"
          title="Önceki rapor hazırlanıyor"
          message={`${error.message} Aynı anda yalnızca bir rapor hazırlanabilir.`}
        />
        <AppButton title="Raporlara git" variant="outline" size="sm" icon="list" onPress={onGoReports} />
      </View>
    );
  }
  if (error.status === 404) {
    return <AppNotice tone="info" title="Kayıt bulunamadı" message="Bu filtrelerle hiç kayıt yok. Tarih aralığını veya filtreleri değiştirin." />;
  }
  if (error.fieldErrors && Object.keys(error.fieldErrors).every((k) => k === "start_date" || k === "end_date")) {
    return null; // alan hataları ilgili inputta
  }
  return <AppNotice tone="danger" title="Rapor oluşturulamadı" message={error.message} />;
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    row: { flexDirection: "row", gap: t.spacing.md },
    fields: { gap: t.spacing.lg },
    field: { gap: t.spacing.xs },
    chipScroll: { marginHorizontal: -t.layout.screenPadding },
    chips: { gap: t.spacing.sm, paddingHorizontal: t.layout.screenPadding },
    typeList: { gap: t.spacing.sm },
    typeCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      padding: t.spacing.md,
      minHeight: 56,
      borderRadius: t.radius.md,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
    },
    typeCardOn: { borderColor: t.colors.primary, backgroundColor: t.colors.primarySubtle },
    pressed: { backgroundColor: t.colors.surfacePressed },
    disabled: { opacity: 0.5 },
    radio: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    radioOn: { borderColor: t.colors.primary },
    radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: t.colors.primary },
    noticeBlock: { gap: t.spacing.sm, alignItems: "flex-start" },
  })
);
