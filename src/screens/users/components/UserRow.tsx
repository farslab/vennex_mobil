import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { AppBadge, AppIcon, AppText, makeStyles } from "@/design-system";
import { Avatar } from "@/components/account/Avatar";
import { fullName } from "@/utils/text";
import type { StaffUser } from "@/types/users";

const MAX_BADGES = 3;

export function UserRow({ user, onPress }: { user: StaffUser; onPress: (user: StaffUser) => void }) {
  const styles = useStyles();
  const name = fullName(user.first_name, user.last_name) || user.username;
  const extraGroups = Math.max(0, user.group_names.length - MAX_BADGES);
  const devices = user.pos_device_count;
  const locations = user.default_stock_location_ids.length;

  const a11y = [
    name,
    `kullanıcı adı ${user.username}`,
    user.is_active ? null : "pasif",
    `${devices} POS cihazı`,
    user.group_names.length ? `gruplar: ${user.group_names.join(", ")}` : "yetki grubu yok",
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <Pressable
      onPress={() => onPress(user)}
      accessibilityRole="button"
      accessibilityLabel={a11y}
      accessibilityHint="Kullanıcıyı düzenler"
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      testID={`user-row-${user.id}`}
    >
      <Avatar name={name} />
      <View style={styles.main}>
        <View style={styles.titleRow}>
          <AppText variant="bodyStrong" numberOfLines={1} style={styles.flexShrink}>
            {name}
          </AppText>
          {!user.is_active ? <AppBadge label="Pasif" tone="warning" size="sm" /> : null}
        </View>
        <AppText variant="caption" color="textTertiary" numberOfLines={1}>
          @{user.username}
        </AppText>
        <View style={styles.badges}>
          {user.group_names.length === 0 ? (
            <AppText variant="caption" color="textTertiary">
              Yetki grubu yok
            </AppText>
          ) : (
            user.group_names.slice(0, MAX_BADGES).map((g) => <AppBadge key={g} label={g} tone="info" size="sm" />)
          )}
          {extraGroups > 0 ? <AppBadge label={`+${extraGroups}`} size="sm" /> : null}
        </View>
      </View>
      <View style={styles.side}>
        <View style={styles.meta}>
          <AppIcon name="pos" size={13} color="textTertiary" />
          <AppText variant="numericSm" color="textSecondary">
            {devices}
          </AppText>
        </View>
        {locations > 0 ? (
          <View style={styles.meta}>
            <AppIcon name="package" size={13} color="textTertiary" />
            <AppText variant="numericSm" color="textSecondary">
              {locations}
            </AppText>
          </View>
        ) : null}
      </View>
      <AppIcon name="chevron-right" size={18} color="textTertiary" />
    </Pressable>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenPadding,
      paddingVertical: t.spacing.md,
      minHeight: 64,
      backgroundColor: t.colors.surface,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
    pressed: { backgroundColor: t.colors.surfacePressed },
    main: { flex: 1, gap: 2 },
    titleRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.sm },
    flexShrink: { flexShrink: 1 },
    badges: { flexDirection: "row", flexWrap: "wrap", gap: t.spacing.xs, marginTop: t.spacing.xs },
    side: { alignItems: "flex-end", gap: t.spacing.xs },
    meta: { flexDirection: "row", alignItems: "center", gap: 4 },
  })
);
