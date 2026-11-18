import React from "react";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { AppIconButton, AppText, makeStyles } from "@/design-system";
import { CompanySwitcher } from "@/components/CompanySwitcher";
import { useUnreadNotificationCount } from "@/hooks/useUnreadNotificationCount";
import type { RootStackParamList } from "./types";

/**
 * Sekme kök ekranlarının başlığı: büyük başlık + şirket seçici + bildirim zili.
 * Detay ekranları native stack başlığını kullanır.
 */
export function TabHeader({ title, right }: { title: string; right?: React.ReactNode }) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const unread = useUnreadNotificationCount();

  return (
    <View style={[styles.root, { paddingTop: insets.top + 6 }]}>
      <View style={styles.titleBlock}>
        <CompanySwitcher />
        <AppText variant="title" accessibilityRole="header" numberOfLines={1}>
          {title}
        </AppText>
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
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: {
      flexDirection: "row",
      alignItems: "flex-end",
      paddingHorizontal: t.layout.screenPadding,
      paddingBottom: t.spacing.sm,
      backgroundColor: t.colors.background,
      gap: t.spacing.sm,
    },
    titleBlock: { flex: 1, gap: 2 },
    actions: { flexDirection: "row", alignItems: "center", marginRight: -t.spacing.sm },
  })
);
