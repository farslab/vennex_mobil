import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIconButton, AppText, makeStyles } from "@/design-system";
import { CompanySwitcher } from "@/components/CompanySwitcher";
import { VennexLogo } from "@/components/brand/VennexLogo";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";
import type { RootStackParamList } from "./types";

/**
 * Sekme kök ekranlarının başlığı: büyük başlık + şirket seçici + bildirim zili.
 * Detay ekranları native stack başlığını kullanır.
 */
export function TabHeader({ title, right, logo = false }: { title: string; right?: React.ReactNode; logo?: boolean }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const unread = useUnreadNotificationCount();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.row}>
        <View style={styles.titleBlock}>
          <CompanySwitcher />
          {logo ? (
            // Genel Bakış: başlık yerine Vennex logosu (ekran okuyucuya başlık adı söylenir)
            <View accessible accessibilityRole="header" accessibilityLabel={title} style={styles.logo} testID="header-logo">
              <VennexLogo height={42} />
            </View>
          ) : (
            <AppText variant="title" accessibilityRole="header" numberOfLines={1}>
              {title}
            </AppText>
          )}
        </View>
        <View style={styles.actions}>
          {right}
          <AppIconButton
            icon="bell"
            label="Bildirimler"
            badge={unread}
            onPress={() => navigation.navigate("Notifications")}
            testID="header-notifications"
          />
        </View>
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: {
      paddingHorizontal: t.layout.screenPadding,
      paddingBottom: t.spacing.sm,
      backgroundColor: t.colors.background,
    },
    // iPad'de sahnelerle aynı okunabilir genişliğe hizalanır (CenteredScreen)
    row: {
      flexDirection: "row",
      alignItems: "flex-end",
      gap: t.spacing.sm,
      width: "100%",
      maxWidth: t.layout.maxContentWidth - 2 * t.layout.screenPadding,
      alignSelf: "center",
    },
    titleBlock: { flex: 1, gap: 2 },
    logo: { paddingVertical: 4, alignSelf: "flex-start" },
    actions: { flexDirection: "row", alignItems: "center", marginRight: -t.spacing.sm },
  })
);
