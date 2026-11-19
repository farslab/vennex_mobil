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
import { cardsApi } from "@/api/cards";
import { canManagePersonelCard, canViewSales } from "@/auth/permissions";
import { useAuthStore } from "@/store/authStore";
import { formatDate } from "@/utils/date";
import { formatInteger } from "@/utils/number";
import {
  REPORT_FAILURE_REASONS,
  REPORT_PAYMENT_TYPES,
  type ReportFailureReason,
  type ReportFilterOptions,
  type ReportTransactionStatus,
} from "@/types/reports";
import { CardPicker, GroupPicker } from "@/screens/cards/components/Pickers";
import { cardDisplayName } from "@/screens/cards/components/format";
import type { RootStackParamList } from "@/navigation/types";
import {
  CUSTOM_NAME_MAX,
  DATE_PRESETS,
  MONTH_NAMES,
  analysisYears,
  availableDevices,
  availableLocations,
  availableRegions,
  defaultReportType,
  initialReportForm,
  isNfcReport,
  monthlyAnalysisAvailable,
  presetRange,
  pruneSelections,
  scopeDevices,
  validateReportForm,
  visibleReportTypes,
  type ReportFormErrors,
  type ReportFormState,
} from "./reportForm";

/** Grup seçimi kartları işaretler (web); büyük gruplarda üst sınır */
const GROUP_CARD_LIMIT = 1000;

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

  const headerCompanyId = useAuthStore((s) => s.selectedCompanyId);
  const [rawForm, setForm] = useState<ReportFormState>(() => initialReportForm());
  const [companyChosen, setCompanyChosen] = useState(false);
  const [errors, setErrors] = useState<ReportFormErrors>({});

  // Web: oturumdaki şirket önseçili; kullanıcı şirket seçene kadar o geçerlidir
  const presetCompany = useMemo(() => {
    const ids = options?.companies.map((c) => c.id) ?? [];
    if (headerCompanyId != null && ids.includes(headerCompanyId)) return headerCompanyId;
    return ids.length === 1 ? ids[0] : null;
  }, [options, headerCompanyId]);
  const form = companyChosen ? rawForm : { ...rawForm, company: presetCompany };
  const reportType = form.reportType || defaultReportType(options);
  const nfc = isNfcReport(reportType);

  const update = (patch: Partial<ReportFormState>, prune = false) => {
    if ("company" in patch) setCompanyChosen(true);
    setForm((f) => {
      const base = companyChosen || "company" in patch ? f : { ...f, company: presetCompany };
      const next = { ...base, ...patch };
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
    const result = validateReportForm({ ...form, reportType }, options);
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
        {visibleReportTypes(options).length === 0 ? (
          <AppNotice tone="warning" message="Sunucu kullanılabilir rapor tipi döndürmedi." />
        ) : (
          <View style={styles.typeList} accessibilityRole="radiogroup">
            {visibleReportTypes(options).map((t) => {
              const selected = reportType === t.value;
              return (
                <Pressable
                  key={t.value}
                  onPress={() => update({ reportType: t.value, nfcMonthly: false })}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${t.label}. ${t.description}`}
                  style={({ pressed }) => [styles.typeCard, selected && styles.typeCardOn, pressed && !selected && styles.pressed]}
                  testID={`report-type-${t.value}`}
                >
                  <View style={[styles.radio, selected && styles.radioOn]}>
                    {selected ? <View style={styles.radioDot} /> : null}
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="calloutStrong" color={selected ? "primary" : "text"}>
                      {t.label}
                    </AppText>
                    <AppText variant="caption" color="textTertiary">
                      {t.description}
                    </AppText>
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

      {nfc && form.nfcMonthly ? null : (
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
      )}

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

function CompanySelect({ options, form, update }: { options: ReportFilterOptions; form: ReportFormState; update: Update }) {
  if (options.companies.length <= 1) return null;
  return (
    <AppSelect<string>
      label="Şirket"
      placeholder="Tümü"
      options={[{ value: ALL, label: "Tümü" }, ...options.companies.map((c) => ({ value: String(c.id), label: c.name }))]}
      value={form.company == null ? ALL : String(form.company)}
      onChange={(v) => update({ company: v === ALL ? null : Number(v), nfcCardUids: [] }, true)}
      testID="report-company"
    />
  );
}

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
  const regions = useMemo(() => availableRegions(options, form.company), [options, form.company]);
  const locations = useMemo(() => availableLocations(options, form.company, form.regions), [options, form.company, form.regions]);
  const devices = useMemo(() => availableDevices(options, form.company), [options, form.company]);
  const scoped = useMemo(() => scopeDevices(options, form), [options, form]);

  const deviceHint = form.devices.length
    ? `${form.devices.length} cihaz seçildi`
    : scoped
      ? `Seçilen bölge/konumdaki ${scoped.length} cihaz rapora girer`
      : null;

  return (
    <AppSection title="Filtreler">
      <View style={styles.fields}>
        <CompanySelect options={options} form={form} update={update} />
        {regions.length > 0 ? (
          <AppSelect<number>
            multiple
            label="Bölge"
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
            label="Konum"
            placeholder="Tüm konumlar"
            options={locations.map((l) => ({ value: l.id, label: l.name, description: l.region_name ?? undefined }))}
            value={form.locations}
            onChange={(v) => update({ locations: v }, true)}
            searchable
            testID="report-locations"
          />
        ) : null}
        <AppSelect<string>
          multiple
          label="POS cihazları"
          placeholder={devices.length ? `Tüm cihazlar (${formatInteger(devices.length)})` : "Cihaz bulunamadı"}
          options={devices.map((d) => ({ value: d.sn, label: d.pos_name || d.sn, description: d.sn }))}
          value={form.devices}
          onChange={(v) => update({ devices: v })}
          disabled={devices.length === 0}
          searchable
          testID="report-devices"
        />
        {deviceHint ? (
          <AppText variant="caption" color="textSecondary" testID="report-scope-hint">
            {deviceHint}
          </AppText>
        ) : null}
        {errors.scope ? <AppNotice tone="danger" message={errors.scope} /> : null}

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
            label="Başarısız sebebi"
            placeholder="Tümü"
            options={[{ value: ALL, label: "Tümü" }, ...REPORT_FAILURE_REASONS]}
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
              label="Minimum tutar"
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
  const user = useAuthStore((s) => s.user);
  // Kart/grup listeleri kart yetkisi ister; yoksa rapor yetki kapsamındaki tüm kartları içerir
  const canPickCards = canManagePersonelCard(user);
  const [labels, setLabels] = useState<Record<string, string>>({});
  const [groupLoading, setGroupLoading] = useState(false);
  const [groupNote, setGroupNote] = useState<string | null>(null);
  const years = useMemo(() => analysisYears(), []);

  const addCards = (items: { uid: string; label: string }[]) => {
    setLabels((l) => ({ ...l, ...Object.fromEntries(items.map((i) => [i.uid, i.label])) }));
    update({ nfcCardUids: Array.from(new Set([...form.nfcCardUids, ...items.map((i) => i.uid)])) });
  };

  /** Web: grup seçimi gruptaki kartları işaretler */
  const selectGroup = async (groupId: number, groupLabel: string) => {
    setGroupLoading(true);
    setGroupNote(null);
    try {
      const picked: { uid: string; label: string }[] = [];
      let page = 1;
      let pages = 1;
      do {
        const res = await cardsApi.list({ status: "active", group_id: groupId, page });
        res.results.forEach((c) => picked.push({ uid: c.uid, label: cardDisplayName(c) }));
        pages = res.num_pages;
        page += 1;
      } while (page <= pages && picked.length < GROUP_CARD_LIMIT);
      addCards(picked.slice(0, GROUP_CARD_LIMIT));
      setGroupNote(
        picked.length >= GROUP_CARD_LIMIT
          ? `${groupLabel}: ilk ${formatInteger(GROUP_CARD_LIMIT)} kart işaretlendi.`
          : `${groupLabel}: ${formatInteger(picked.length)} kart işaretlendi.`
      );
    } catch (e) {
      setGroupNote(`Grup kartları alınamadı: ${errorMessage(e)}`);
    } finally {
      setGroupLoading(false);
    }
  };

  return (
    <AppSection title="PersonelKart filtreleri">
      <View style={styles.fields}>
        <CompanySelect options={options} form={form} update={update} />
        {monthlyAnalysisAvailable(options) ? (
          <Pressable
            onPress={() => update({ nfcMonthly: !form.nfcMonthly })}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: form.nfcMonthly }}
            style={[styles.typeCard, form.nfcMonthly && styles.typeCardOn]}
            testID="report-nfc-monthly"
          >
            <View style={[styles.checkbox, form.nfcMonthly && styles.checkboxOn]}>
              {form.nfcMonthly ? <View style={styles.checkboxDot} /> : null}
            </View>
            <View style={styles.flex}>
              <AppText variant="calloutStrong">Aylık Analiz</AppText>
              <AppText variant="caption" color="textTertiary">
                Tüm kart logları yerine seçilen ay için özet: eklenen kartlar, çıkan kartlar ve yüklenen bakiyeler.
              </AppText>
            </View>
          </Pressable>
        ) : null}

        {form.nfcMonthly ? (
          <View style={styles.field}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <AppSelect<number>
                  label="Analiz ayı"
                  options={MONTH_NAMES.map((m, i) => ({ value: i + 1, label: m }))}
                  value={form.analysisMonth}
                  onChange={(v) => update({ analysisMonth: v })}
                  testID="report-analysis-month"
                />
              </View>
              <View style={styles.flex}>
                <AppSelect<number>
                  label="Yıl"
                  options={years.map((y) => ({ value: y, label: String(y) }))}
                  value={form.analysisYear}
                  onChange={(v) => update({ analysisYear: v })}
                  testID="report-analysis-year"
                />
              </View>
            </View>
            <AppText variant="caption" color="textTertiary">
              Analiz seçilen ayın tamamı (1&apos;i – ay sonu) için üretilir.
            </AppText>
          </View>
        ) : (
          <>
            {options.nfc_sources.length ? (
              <AppSelect<string>
                label="Kaynak"
                placeholder="Tümü"
                options={[{ value: ALL, label: "Tümü" }, ...options.nfc_sources]}
                value={form.nfcSource || ALL}
                onChange={(v) => update({ nfcSource: v === ALL ? "" : v })}
                testID="report-nfc-source"
              />
            ) : null}
            {options.nfc_operations.length ? (
              <AppSelect<string>
                label="İşlem"
                placeholder="Tümü"
                options={[{ value: ALL, label: "Tümü" }, ...options.nfc_operations]}
                value={form.nfcOperation || ALL}
                onChange={(v) => update({ nfcOperation: v === ALL ? "" : v })}
                testID="report-nfc-operation"
              />
            ) : null}
          </>
        )}

        {canPickCards ? (
          <View style={styles.field}>
            <GroupPicker
              label="Grup (kartları işaretler)"
              value={null}
              onChange={(g) => selectGroup(g.id, g.label)}
              disabled={groupLoading}
              testID="report-nfc-group"
            />
            <CardPicker
              label="Kart ekle"
              value={null}
              onChange={(c) => {
                const uid = c.label.split(" · ").pop() ?? "";
                if (uid) addCards([{ uid, label: c.label.split(" · ")[0] }]);
              }}
              testID="report-nfc-card"
            />
            {groupNote ? (
              <AppText variant="caption" color="textSecondary">
                {groupNote}
              </AppText>
            ) : null}
            <View style={styles.cardSummary}>
              <AppText variant="caption" color="textSecondary" style={styles.flex} testID="report-nfc-card-count">
                {form.nfcCardUids.length
                  ? `${formatInteger(form.nfcCardUids.length)} kart seçildi`
                  : "Kart seçilmedi: tüm kartlar rapora girer"}
              </AppText>
              {form.nfcCardUids.length ? (
                <AppButton
                  title="Tümünü temizle"
                  variant="ghost"
                  size="sm"
                  onPress={() => {
                    update({ nfcCardUids: [] });
                    setGroupNote(null);
                  }}
                  testID="report-nfc-clear"
                />
              ) : null}
            </View>
            {form.nfcCardUids.length > 0 && form.nfcCardUids.length <= 20 ? (
              <View style={styles.chipWrap}>
                {form.nfcCardUids.map((uid) => (
                  <AppChip
                    key={uid}
                    label={labels[uid] ? `${labels[uid]} · ${uid}` : uid}
                    selected
                    icon="x"
                    onPress={() => update({ nfcCardUids: form.nfcCardUids.filter((u) => u !== uid) })}
                  />
                ))}
              </View>
            ) : null}
          </View>
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
    checkbox: {
      width: 20,
      height: 20,
      borderRadius: 4,
      borderWidth: 1.5,
      borderColor: t.colors.borderStrong,
      alignItems: "center",
      justifyContent: "center",
    },
    checkboxOn: { borderColor: t.colors.primary, backgroundColor: t.colors.primary },
    checkboxDot: { width: 8, height: 8, borderRadius: 2, backgroundColor: t.colors.onPrimary },
    cardSummary: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.xs },
  })
);
