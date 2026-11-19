/**
 * Sayfalı listelerin alt bilgisi: sonraki sayfa yüklenirken gösterge; yükleme hata verirse
 * liste sessizce durmaz — sunucu mesajı ve "Tekrar dene" gösterilir.
 */
import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { AppButton, AppText, makeStyles, useTheme } from "@/design-system";
import { errorMessage } from "@/api/client";

export function ListLoadMoreFooter({
  loading,
  error,
  onRetry,
  testID = "list-load-more",
}: {
  loading: boolean;
  error?: unknown;
  onRetry?: () => void;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  if (loading) {
    return (
      <View style={styles.footer} accessibilityLabel="Daha fazla yükleniyor">
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }
  if (error) {
    return (
      <View style={styles.error} testID={`${testID}-error`}>
        <AppText variant="caption" color="textSecondary" style={styles.center}>
          Devamı yüklenemedi: {errorMessage(error)}
        </AppText>
        {onRetry ? (
          <AppButton title="Tekrar dene" icon="refresh-cw" variant="outline" size="sm" onPress={onRetry} testID={`${testID}-retry`} />
        ) : null}
      </View>
    );
  }
  return <View style={styles.space} />;
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    footer: { paddingVertical: t.spacing.lg },
    error: { paddingVertical: t.spacing.lg, paddingHorizontal: t.layout.screenPadding, alignItems: "center", gap: t.spacing.sm },
    center: { textAlign: "center" },
    space: { height: t.spacing.lg },
  })
);
