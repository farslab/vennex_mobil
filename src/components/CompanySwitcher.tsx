import React, { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppBadge, AppIcon, AppSheet, AppText, makeStyles } from "@/design-system";
import { useAuthStore, useSelectedCompany } from "@/store/authStore";
import { cariStateInfo } from "@/auth/permissions";

/**
 * Çok şirketli kullanıcılar için şirket seçici. Seçim X-Company-Id header'ı ile
 * tüm isteklere uygulanır; değişince şirket bazlı tüm veriler yeniden yüklenir.
 */
export function CompanySwitcher() {
  const styles = useStyles();
  const companies = useAuthStore((s) => s.user?.companies ?? []);
  const selectCompany = useAuthStore((s) => s.selectCompany);
  const selected = useSelectedCompany();
  const [open, setOpen] = useState(false);

  if (!selected) return null;
  const switchable = companies.length > 1;

  return (
    <>
      <Pressable
        onPress={() => switchable && setOpen(true)}
        disabled={!switchable}
        accessibilityRole={switchable ? "button" : "text"}
        accessibilityLabel={`Şirket: ${selected.name}${switchable ? ", değiştirmek için dokunun" : ""}`}
        // Görünür yükseklik ~20pt (caption + 2pt dolgu) → dikey 12pt hitSlop ile 44pt dokunma alanı
        hitSlop={{ top: 12, bottom: 12, left: 8, right: 8 }}
        style={({ pressed }) => [styles.chip, pressed && styles.pressed]}
        testID="company-switcher"
      >
        <AppText variant="caption" color="textSecondary" numberOfLines={1} style={styles.chipText}>
          {selected.name}
        </AppText>
        {switchable ? <AppIcon name="chevron-down" size={14} color="textTertiary" /> : null}
      </Pressable>

      <AppSheet visible={open} onClose={() => setOpen(false)} title="Şirket seçin" subtitle="Veriler seçili şirkete göre gösterilir">
        <View>
          {companies.map((c, i) => {
            const active = c.id === selected.id;
            const cari = cariStateInfo(c.cari_state);
            return (
              <Pressable
                key={c.id}
                onPress={async () => {
                  setOpen(false);
                  await selectCompany(c.id);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: active }}
                style={({ pressed }) => [styles.row, i < companies.length - 1 && styles.rowBorder, pressed && styles.pressed]}
              >
                <View style={styles.flex}>
                  <AppText variant="body" weight={active ? "600" : "400"}>
                    {c.name}
                  </AppText>
                  {c.cari_state ? <AppBadge label={`Cari: ${cari.label}`} tone={cari.tone} size="sm" /> : null}
                </View>
                {active ? <AppIcon name="check" size={18} color="primary" /> : null}
              </Pressable>
            );
          })}
        </View>
      </AppSheet>
    </>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1, gap: 4 },
    chip: {
      flexDirection: "row",
      alignItems: "center",
      gap: 4,
      maxWidth: 200,
      alignSelf: "flex-start",
      paddingVertical: 2,
    },
    chipText: { flexShrink: 1 },
    pressed: { opacity: 0.6 },
    row: { flexDirection: "row", alignItems: "center", gap: t.spacing.md, minHeight: 56, paddingVertical: t.spacing.md },
    rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
  })
);
