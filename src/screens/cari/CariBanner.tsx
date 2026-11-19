/**
 * Web `v2/partials/cari_snackbar.html` karşılığı: sayfa başlığının altında ince şerit.
 * Durum 1 sarı ("Ödenmemiş cari borcunuz"), 2–3 kırmızı ("Vadesi geçmiş faturanız"); "Hemen Öde" web ödeme sayfası.
 */
import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppIcon, AppText, makeStyles, useTheme } from "@/design-system";
import { formatCurrency } from "@/utils/number";
import { cariBannerText, openCariPayment, useCari } from "./useCari";

export function CariBanner() {
  const styles = useStyles();
  const { colors } = useTheme();
  const cari = useCari();
  if (!cari.showBanner) return null;

  const yellow = cari.state === 1;
  const fg = yellow ? colors.warning : colors.danger;
  const bg = yellow ? colors.warningSubtle : colors.dangerSubtle;
  const text = `Ödeme Bekleniyor: ${formatCurrency(cari.balance)} — ${cariBannerText(cari.state)}`;

  return (
    <View
      style={[styles.root, { backgroundColor: bg, borderColor: fg }]}
      accessibilityRole="alert"
      testID={`cari-banner-${cari.state}`}
    >
      <AppIcon name="alert-circle" size={16} color={yellow ? "warning" : "danger"} />
      <AppText variant="caption" style={[styles.text, { color: fg }]}>
        {text}
      </AppText>
      <Pressable
        onPress={() => openCariPayment(cari.paymentPath)}
        accessibilityRole="link"
        accessibilityLabel="Hemen Öde — web ödeme sayfasını açar"
        hitSlop={8}
        style={({ pressed }) => [styles.pay, { backgroundColor: fg }, pressed && styles.pressed]}
        testID="cari-banner-pay"
      >
        <AppText variant="caption" style={styles.payText}>
          Hemen Öde
        </AppText>
      </Pressable>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.sm,
      marginHorizontal: t.layout.screenPadding,
      marginTop: t.spacing.sm,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.sm,
      borderRadius: t.radius.sm,
      borderWidth: StyleSheet.hairlineWidth,
    },
    text: { flex: 1, fontWeight: "600" },
    pay: { paddingHorizontal: t.spacing.md, paddingVertical: 6, borderRadius: t.radius.sm },
    payText: { color: "#FFFFFF", fontWeight: "700" },
    pressed: { opacity: 0.8 },
  })
);
