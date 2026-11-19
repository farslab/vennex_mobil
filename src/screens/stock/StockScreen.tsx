import React, { useState } from "react";
import { EXPORTS } from "@/api/exports";
import { useHeaderExcel } from "@/navigation/useHeaderExcel";
import { StyleSheet, View } from "react-native";
import { AppNotice, AppSegmented, makeStyles } from "@/design-system";
import { useAuthStore } from "@/store/authStore";
import { canManageStock } from "@/auth/permissions";
import { OverviewTab } from "./tabs/OverviewTab";
import { LocationsTab } from "./tabs/LocationsTab";
import { SkusTab } from "./tabs/SkusTab";
import { MovementsTab } from "./tabs/MovementsTab";

type TabKey = "overview" | "locations" | "skus" | "movements";

const TABS: { key: TabKey; label: string }[] = [
  { key: "overview", label: "Özet" },
  { key: "locations", label: "Lokasyonlar" },
  { key: "skus", label: "Ürünler" },
  { key: "movements", label: "Hareketler" },
];

/**
 * Stok sekmesi kökü (başlığı TabHeader verir). Sekmeler ilk ziyarette mount edilir ve
 * sonra state'leri (arama, filtre, kaydırma) korunarak gizlenir.
 */
export default function StockScreen() {
  const styles = useStyles();
  const user = useAuthStore((s) => s.user);
  const canManage = canManageStock(user);
  const [tab, setTab] = useState<TabKey>("overview");
  // Excel (stok özeti): Genel Bakış gibi başlıkta; yalnız Özet sekmesindeyken
  useHeaderExcel("Stok", tab === "overview" ? EXPORTS.stockOverview : null);
  const [visited, setVisited] = useState<Set<TabKey>>(() => new Set<TabKey>(["overview"]));

  const select = (key: TabKey) => {
    setTab(key);
    setVisited((v) => (v.has(key) ? v : new Set(v).add(key)));
  };

  const pane = (key: TabKey, node: React.ReactNode) =>
    visited.has(key) ? (
      <View key={key} style={[styles.pane, tab !== key && styles.hidden]} accessibilityElementsHidden={tab !== key} importantForAccessibility={tab === key ? "auto" : "no-hide-descendants"}>
        {node}
      </View>
    ) : null;

  return (
    <View style={styles.root} testID="stock-screen">
      <View style={styles.tabs}>
        <AppSegmented<TabKey> variant="tabs" items={TABS} value={tab} onChange={select} testID="stock-tabs" />
      </View>
      {!canManage ? (
        <View style={styles.notice}>
          <AppNotice tone="warning" title="Salt görüntüleme" message="Stok Yönetimi yetkiniz olmadığı için kayıt ve hareket işlemleri kapalı." />
        </View>
      ) : null}
      {pane("overview", <OverviewTab />)}
      {pane("locations", <LocationsTab canManage={canManage} />)}
      {pane("skus", <SkusTab canManage={canManage} />)}
      {pane("movements", <MovementsTab canManage={canManage} />)}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { flex: 1, backgroundColor: t.colors.background },
    tabs: { backgroundColor: t.colors.surface },
    notice: { paddingHorizontal: t.layout.screenPadding, paddingTop: t.spacing.md },
    pane: { flex: 1 },
    hidden: { display: "none" },
  })
);
