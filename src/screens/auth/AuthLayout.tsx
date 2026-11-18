import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText, makeStyles } from "@/design-system";
import { VennexLogo } from "@/components/brand/VennexLogo";
import { APP_ENV } from "@/config/env";

/** Giriş akışı ekranlarının ortak düzeni: logo, başlık, form kartı, alt bilgi */
export function AuthLayout({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  return (
    <KeyboardAvoidingView style={styles.root} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.brand}>
          <VennexLogo height={40} />
          {APP_ENV !== "production" ? (
            <View style={styles.envBadge}>
              <AppText variant="caption" color="warning" weight="700">
                {APP_ENV === "staging" ? "TEST ORTAMI" : "GELİŞTİRME ORTAMI"}
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={styles.header}>
          <AppText variant="title" accessibilityRole="header">
            {title}
          </AppText>
          {subtitle ? (
            <AppText variant="callout" color="textSecondary">
              {subtitle}
            </AppText>
          ) : null}
        </View>
        <View style={styles.card}>{children}</View>
        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    content: {
      flexGrow: 1,
      paddingHorizontal: t.spacing.xxl,
      width: "100%",
      maxWidth: 460,
      alignSelf: "center",
      gap: t.spacing.xxl,
    },
    brand: { alignItems: "flex-start", gap: t.spacing.md },
    envBadge: {
      paddingHorizontal: t.spacing.sm,
      paddingVertical: 2,
      borderRadius: t.radius.xs,
      backgroundColor: t.colors.warningSubtle,
    },
    header: { gap: t.spacing.xs },
    card: { gap: t.spacing.lg },
    footer: { marginTop: "auto", alignItems: "center", gap: t.spacing.sm },
  })
);
