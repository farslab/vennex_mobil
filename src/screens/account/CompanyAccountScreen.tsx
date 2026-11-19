import React, { useState } from "react";
import { FlatList, Linking, StyleSheet, View } from "react-native";
import { useQuery } from "@tanstack/react-query";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import type { RootStackParamList } from "@/navigation/types";
import {
  AppBadge,
  AppButton,
  AppCard,
  AppEmptyState,
  AppErrorState,
  AppKpi,
  AppNotice,
  AppScreen,
  AppSection,
  AppSkeleton,
  AppText,
  makeStyles,
  toast,
} from "@/design-system";
import { accountApi } from "@/api/account";
import { errorMessage } from "@/api/client";
import { queryKeys } from "@/api/queryKeys";
import { useAuthStore, useSelectedCompany } from "@/store/authStore";
import { cariStateInfo, isOwner } from "@/auth/permissions";
import { errorStatus } from "@/components/account/formErrors";
import { formatCurrency, formatInteger } from "@/utils/number";
import type { CariInvoice, CariSummary, CompanyDetail } from "@/types/account";
import { InfoRow } from "./components/InfoRow";
import { InvoiceRow } from "./components/InvoiceRow";

function forbiddenOr(error: unknown, fallback: string): string {
  return errorStatus(error) === 403 ? "Bu bilgiyi görüntüleme yetkiniz yok." : errorMessage(error, fallback);
}

function CompanyInfoCard({ company }: { company: CompanyDetail }) {
  return (
    <AppCard padded={false} testID="company-info">
      <InfoRow label="Şirket ünvanı" value={company.name} />
      <InfoRow label="Vergi numarası" value={company.tax_number} />
      <InfoRow label="Üye işyeri" value={company.uye_isyeri} />
      <InfoRow label="Üye işyeri kısa adı" value={company.uye_isyeri_kisa_ad} />
      <InfoRow label="Adres" value={company.address} />
      <InfoRow label="Telefon" value={company.phone} />
      <InfoRow label="E-posta" value={company.email} last />
    </AppCard>
  );
}

function CariSummaryCard({ summary }: { summary: CariSummary }) {
  const styles = useStyles();
  const state = cariStateInfo(summary.cari_state);
  return (
    <View style={styles.stack} testID="cari-summary">
      <View style={styles.stateRow}>
        <AppText variant="callout" color="textSecondary">
          Cari durum
        </AppText>
        <AppBadge label={state.label} tone={state.tone} dot />
      </View>
      <View style={styles.kpis}>
        <AppKpi label="Vadesi geçen" value={formatCurrency(summary.overdue_total)} icon="alert-circle" />
        <AppKpi
          label={summary.balance_only ? "Cari bakiye" : "Toplam açık tutar"}
          value={formatCurrency(summary.all_total)}
          caption={`${formatInteger(summary.invoice_count)} açık fatura`}
          icon="file-text"
        />
      </View>
      {summary.is_locked ? (
        <AppNotice
          tone="danger"
          title="Cari hesap kilitli"
          message="Gecikmiş ödemeler nedeniyle hesabınız kilitlendi. Ödeme yapıldığında erişim açılır."
        />
      ) : null}
      {summary.balance_only ? (
        <AppNotice tone="info" message="Fatura ayrıntısı bulunmuyor; tutar Paraşüt cari bakiyesinden alınmıştır." />
      ) : null}
    </View>
  );
}

/**
 * Şirket bilgileri + cari (yalnız görüntüleme). Şirket detayı tüm yönetim kullanıcılarına,
 * cari uçları yalnız sahibe açıktır (backend IsOwner). Ödeme mobilde yoktur.
 */
export default function CompanyAccountScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const styles = useStyles();
  const owner = isOwner(useAuthStore((s) => s.user));
  const company = useSelectedCompany();
  const companyId = company?.id ?? null;
  const [openingId, setOpeningId] = useState<number | null>(null);

  const companyQuery = useQuery({
    queryKey: queryKeys.account.company(companyId ?? 0),
    queryFn: ({ signal }) => accountApi.company(companyId as number, signal),
    enabled: companyId != null,
  });
  const summaryQuery = useQuery({
    queryKey: queryKeys.account.cariSummary(),
    queryFn: ({ signal }) => accountApi.cariSummary(signal),
    enabled: owner && companyId != null,
  });
  const invoicesQuery = useQuery({
    queryKey: queryKeys.account.cariInvoices(),
    queryFn: ({ signal }) => accountApi.cariInvoices(signal),
    enabled: owner && companyId != null,
  });

  if (companyId == null) {
    return (
      <AppScreen>
        <AppEmptyState title="Seçili şirket yok" description="Hesabınıza bağlı bir şirket bulunmuyor." icon="briefcase" />
      </AppScreen>
    );
  }

  const refreshing = companyQuery.isRefetching || summaryQuery.isRefetching || invoicesQuery.isRefetching;
  const refresh = () => {
    companyQuery.refetch();
    if (owner) {
      summaryQuery.refetch();
      invoicesQuery.refetch();
    }
  };

  const openPdf = async (invoice: CariInvoice) => {
    if (openingId != null) return;
    setOpeningId(invoice.id);
    try {
      const { pdf_url } = await accountApi.cariInvoicePdf(invoice.id);
      if (!pdf_url) throw new Error("PDF bağlantısı alınamadı.");
      await Linking.openURL(pdf_url);
    } catch (e) {
      toast.error(errorMessage(e, "PDF açılamadı."));
    } finally {
      setOpeningId(null);
    }
  };

  const header = (
    <View style={styles.header}>
      <AppSection title="Şirket bilgileri">
        {companyQuery.isLoading ? (
          <AppCard>
            <View style={styles.stack}>
              <AppSkeleton width="60%" />
              <AppSkeleton width="40%" />
              <AppSkeleton width="70%" />
            </View>
          </AppCard>
        ) : companyQuery.isError ? (
          errorStatus(companyQuery.error) === 403 ? (
            <AppNotice tone="danger" message="Bu şirkete erişiminiz yok." />
          ) : (
            <AppCard>
              <AppErrorState
                compact
                message={errorMessage(companyQuery.error, "Şirket bilgileri alınamadı.")}
                onRetry={() => companyQuery.refetch()}
                retrying={companyQuery.isFetching}
              />
            </AppCard>
          )
        ) : companyQuery.data ? (
          <CompanyInfoCard company={companyQuery.data} />
        ) : null}
      </AppSection>

      {owner ? (
        <AppSection title="Cari">
          {summaryQuery.isLoading ? (
            <AppCard>
              <AppSkeleton height={56} />
            </AppCard>
          ) : summaryQuery.isError ? (
            <AppCard>
              <AppErrorState
                compact
                message={forbiddenOr(summaryQuery.error, "Cari özeti alınamadı.")}
                onRetry={errorStatus(summaryQuery.error) === 403 ? undefined : () => summaryQuery.refetch()}
                retrying={summaryQuery.isFetching}
              />
            </AppCard>
          ) : summaryQuery.data ? (
            <CariSummaryCard summary={summaryQuery.data} />
          ) : null}
          {summaryQuery.data && Number(summaryQuery.data.all_total) > 0 ? (
            <AppButton title="Ödeme yap" icon="credit-card" onPress={() => navigation.navigate("CariPayment")} fullWidth testID="company-cari-pay" />
          ) : null}
        </AppSection>
      ) : (
        <AppNotice tone="info" message="Cari ve fatura bilgileri yalnızca şirket sahibine gösterilir." />
      )}

      {owner ? (
        <AppText variant="overline" color="textTertiary" accessibilityRole="header" style={styles.listTitle}>
          Açık faturalar
        </AppText>
      ) : null}
    </View>
  );

  const invoices = owner ? (invoicesQuery.data ?? []) : [];

  return (
    <AppScreen scroll={false}>
      <FlatList
        data={invoices}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => <InvoiceRow invoice={item} loading={openingId === item.id} onOpenPdf={openPdf} />}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        ListEmptyComponent={
          !owner ? null : invoicesQuery.isLoading ? (
            <AppSkeleton height={72} radius={12} />
          ) : invoicesQuery.isError ? (
            <AppErrorState
              compact
              message={forbiddenOr(invoicesQuery.error, "Faturalar alınamadı.")}
              onRetry={errorStatus(invoicesQuery.error) === 403 ? undefined : () => invoicesQuery.refetch()}
              retrying={invoicesQuery.isFetching}
            />
          ) : (
            <AppEmptyState compact icon="check-circle" title="Açık fatura yok" description="Ödenmemiş faturanız bulunmuyor." />
          )
        }
        contentContainerStyle={styles.content}
        refreshing={refreshing}
        onRefresh={refresh}
        testID="company-account-list"
      />
    </AppScreen>
  );
}

function Separator() {
  const styles = useStyles();
  return <View style={styles.separator} />;
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    content: { padding: t.layout.screenPadding, paddingBottom: t.spacing.huge },
    header: { gap: t.layout.sectionGap, marginBottom: t.spacing.sm },
    stack: { gap: t.spacing.md },
    kpis: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.md },
    stateRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: t.spacing.md },
    separator: { height: t.spacing.sm },
    listTitle: { paddingHorizontal: 2 },
  })
);
