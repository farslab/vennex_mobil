import React from "react";
import { StyleSheet, View } from "react-native";
import { makeStyles } from "@/design-system";

/**
 * Geniş ekranlarda (iPad) her sahneyi okunabilir genişliğe ortalar; telefonda etkisizdir
 * (ekran `maxContentWidth`'ten dar). Liste ekranları (FlatList) dahil tüm ekranlar aynı
 * hizada durur. Navigator `screenLayout`'u olarak kullanılır — başlık ve sekme çubuğu tam genişlikte kalır.
 */
export function CenteredScreen({ children }: { children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.root}>
      <View style={styles.column}>{children}</View>
    </View>
  );
}

export const centeredScreenLayout = ({ children }: { children: React.ReactElement }) => (
  <CenteredScreen>{children}</CenteredScreen>
);

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    column: { flex: 1, width: "100%", maxWidth: t.layout.maxContentWidth, alignSelf: "center" },
  })
);
