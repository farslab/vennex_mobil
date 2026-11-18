import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { AppEmptyState, AppSegmented, makeStyles } from "@/design-system";
import { useCardAccess } from "./hooks/useCardAccess";
import { PersonnelCardsTab } from "./tabs/PersonnelCardsTab";
import { CardGroupsTab } from "./tabs/CardGroupsTab";
import { RecurringBalanceTab } from "./tabs/RecurringBalanceTab";
import { CardQuotasTab } from "./tabs/CardQuotasTab";
import { RecurringQuotaTab } from "./tabs/RecurringQuotaTab";

export type CardsTabKey = "cards" | "groups" | "recurring-balance" | "quotas" | "recurring-quota";

const TABS: { key: CardsTabKey; label: string }[] = [
  { key: "cards", label: "Personel Kartları" },
  { key: "groups", label: "Kart Grupları" },
  { key: "recurring-balance", label: "Bakiye Yükleme" },
  { key: "quotas", label: "İstihkak" },
  { key: "recurring-quota", label: "İstihkak Yenileme" },
];

/**
 * Kartlar sekme kökü (başlık TabHeader'dan gelir). Alt sekmeler tembel bağlanır: yalnız görünen
 * sekme render edilir ve veri çeker; önceki sekmelerin verisi React Query önbelleğinde kalır.
 */
export default function CardsScreen() {
  const styles = useStyles();
  const access = useCardAccess();
  const [tab, setTab] = useState<CardsTabKey>("cards");

  if (!access.canManage) {
    return (
      <View style={styles.root}>
        <AppEmptyState
          icon="lock"
          title="Personel kart yetkiniz yok"
          description="Bu modül için 'Personel Kart' yetkisi gerekir. Yöneticinizle iletişime geçin."
        />
      </View>
    );
  }

  return (
    <View style={styles.root} testID="cards-screen">
      <AppSegmented<CardsTabKey> variant="tabs" items={TABS} value={tab} onChange={setTab} testID="cards-tabs" />
      <View style={styles.flex}>
        {tab === "cards" ? <PersonnelCardsTab /> : null}
        {tab === "groups" ? <CardGroupsTab /> : null}
        {tab === "recurring-balance" ? <RecurringBalanceTab /> : null}
        {tab === "quotas" ? <CardQuotasTab /> : null}
        {tab === "recurring-quota" ? <RecurringQuotaTab /> : null}
      </View>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    flex: { flex: 1 },
  })
);
