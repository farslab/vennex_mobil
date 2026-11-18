import React from "react";
import { StyleSheet, View } from "react-native";
import { AppBadge, AppCard, AppDivider, AppIcon, AppText, makeStyles } from "@/design-system";
import { Avatar } from "@/components/account/Avatar";
import { roleLabel, roleTone } from "@/components/account/labels";
import { cariStateInfo } from "@/auth/permissions";
import { fullName } from "@/utils/text";
import type { AuthUser, Company } from "@/types/auth";

/** Kimlik kartı: avatar, ad, kullanıcı adı, rol ve seçili şirketin cari durumu */
export function IdentityCard({ user, company }: { user: AuthUser; company: Company | null }) {
  const styles = useStyles();
  const name = fullName(user.first_name, user.last_name) || user.username;
  const cari = company ? cariStateInfo(company.cari_state) : null;
  const companyCount = user.companies?.length ?? 0;

  return (
    <AppCard testID="identity-card">
      <View style={styles.head}>
        <Avatar name={name} size="lg" />
        <View style={styles.flex}>
          <AppText variant="headline" numberOfLines={1} accessibilityRole="header">
            {name}
          </AppText>
          <AppText variant="callout" color="textTertiary" numberOfLines={1}>
            @{user.username}
          </AppText>
          <View style={styles.badges}>
            <AppBadge label={roleLabel(user.role)} tone={roleTone(user.role)} size="sm" />
          </View>
        </View>
      </View>
      <AppDivider />
      <View style={styles.companyRow}>
        <AppIcon name="briefcase" size={16} color="textTertiary" />
        <View style={styles.flex}>
          <AppText variant="calloutStrong" numberOfLines={1}>
            {company?.name ?? "Şirket atanmamış"}
          </AppText>
          {companyCount > 1 ? (
            <AppText variant="caption" color="textTertiary">
              {companyCount} şirkete erişiminiz var · üst menüden değiştirin
            </AppText>
          ) : null}
        </View>
        {cari ? <AppBadge label={`Cari: ${cari.label}`} tone={cari.tone} dot size="sm" /> : null}
      </View>
    </AppCard>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    head: { flexDirection: "row", alignItems: "center", gap: t.spacing.md, marginBottom: t.spacing.md },
    flex: { flex: 1, gap: 2 },
    badges: { flexDirection: "row", gap: t.spacing.xs, marginTop: t.spacing.xs },
    companyRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, marginTop: t.spacing.md, minHeight: 32 },
  })
);
