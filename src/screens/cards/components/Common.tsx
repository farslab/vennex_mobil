import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { AppBadge, AppIcon, AppInput, AppText, makeStyles, useTheme, type IconName } from "@/design-system";
import { formatDate, parseUserDate, toApiDate } from "@/utils/date";

/** Sayfalı listelerin altındaki "yükleniyor" göstergesi */
export function ListFooter({ loading }: { loading: boolean }) {
  const { colors } = useTheme();
  const styles = useStyles();
  if (!loading) return <View style={styles.footerSpace} />;
  return (
    <View style={styles.footer} accessibilityLabel="Daha fazla yükleniyor">
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function ActiveBadge({ active }: { active: boolean }) {
  return <AppBadge size="sm" dot tone={active ? "success" : "neutral"} label={active ? "Aktif" : "Pasif"} />;
}

/** Kural/istihkak listelerinde kompakt satır kabuğu */
export function RuleRow({
  title,
  subtitle,
  meta,
  right,
  badge,
  onPress,
  accessibilityLabel,
  testID,
}: {
  title: string;
  subtitle?: string | null;
  meta?: string | null;
  right?: React.ReactNode;
  badge?: React.ReactNode;
  onPress?: () => void;
  accessibilityLabel?: string;
  testID?: string;
}) {
  const styles = useStyles();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={!onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.rowMain}>
        <View style={styles.rowTitle}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.flexShrink}>
            {title}
          </AppText>
          {badge}
        </View>
        {subtitle ? (
          <AppText variant="callout" color="textSecondary" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
        {meta ? (
          <AppText variant="caption" color="textTertiary" numberOfLines={1}>
            {meta}
          </AppText>
        ) : null}
      </View>
      {right ? <View style={styles.rowRight}>{right}</View> : null}
      {onPress ? <AppIcon name="chevron-right" size={18} color="textTertiary" /> : null}
    </Pressable>
  );
}

/** Tarih girişi (GG.AA.YYYY); geçerli tarihi `YYYY-MM-DD` olarak bildirir */
export function DateField({
  label,
  value,
  onChangeText,
  error,
  helper,
  required,
  testID,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  error?: string | null;
  helper?: string;
  required?: boolean;
  testID?: string;
}) {
  return (
    <AppInput
      label={label}
      value={value}
      onChangeText={onChangeText}
      placeholder="GG.AA.YYYY"
      keyboardType="numbers-and-punctuation"
      autoCorrect={false}
      maxLength={10}
      error={error}
      helper={helper}
      required={required}
      icon="calendar"
      testID={testID}
    />
  );
}

/** GG.AA.YYYY metnini API tarihine çevirir; geçersizse null */
export function userDateToApi(input: string): string | null {
  const d = parseUserDate(input);
  return d ? toApiDate(d) : null;
}

/** API tarihi (YYYY-MM-DD) → form metni (GG.AA.YYYY) */
export function apiDateToUser(value: string | null | undefined): string {
  if (!value) return "";
  const d = parseUserDate(value.slice(0, 10));
  return d ? formatDate(d) : "";
}

/** Bir bölüm başlığı + ikon (detay sayfaları) */
export function InfoLine({ icon, label, value, mono }: { icon: IconName; label: string; value: string; mono?: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.info} accessible accessibilityLabel={`${label}: ${value}`}>
      <AppIcon name={icon} size={16} color="textTertiary" />
      <AppText variant="callout" color="textSecondary" style={styles.infoLabel}>
        {label}
      </AppText>
      <AppText variant={mono ? "mono" : "calloutStrong"} style={styles.infoValue} selectable>
        {value}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    footer: { paddingVertical: t.spacing.lg, alignItems: "center" },
    footerSpace: { height: t.spacing.xxxl },
    row: {
      minHeight: 64,
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.md,
      backgroundColor: t.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    pressed: { backgroundColor: t.colors.surfacePressed },
    rowMain: { flex: 1, gap: t.spacing.xxs },
    rowTitle: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    flexShrink: { flexShrink: 1 },
    rowRight: { alignItems: "flex-end", gap: t.spacing.xxs },
    info: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm, minHeight: 32 },
    infoLabel: { width: 110 },
    infoValue: { flex: 1, textAlign: "right" },
  })
);
