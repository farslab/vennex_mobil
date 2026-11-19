/**
 * Bildirim detayı — listede 3 satıra kısalan metnin tamamı alttan açılan sayfada.
 * İlgili ekran varsa (POS cihazı, kart, raporlar, cari) altta onu açan düğme;
 * yoksa ve bildirim bir web bağlantısı taşıyorsa, alan adı gösterilerek tarayıcıda açılır.
 */
import React, { useState } from "react";
import { Linking, StyleSheet, View } from "react-native";
import { AppButton, AppIcon, AppSheet, AppText, makeStyles, toast } from "@/design-system";
import { formatDateTime, formatRelative } from "@/utils/date";
import type { NotificationItem } from "@/types/notifications";
import { notificationIcon, notificationSender, type NotificationTarget, type NotificationWebLink } from "./notificationTarget";

const TARGET_LABEL: Record<NotificationTarget["name"], string> = {
  DeviceDetail: "POS cihazını aç",
  CardDetail: "Kartı aç",
  Reports: "Raporları aç",
  CompanyAccount: "Cari bilgilerini aç",
};

export function NotificationSheet({
  item: itemProp,
  target: targetProp,
  link: linkProp,
  onClose,
  onOpenTarget,
}: {
  item: NotificationItem | null;
  target: NotificationTarget | null;
  link: NotificationWebLink | null;
  onClose: () => void;
  onOpenTarget: (target: NotificationTarget) => void;
}) {
  const styles = useStyles();
  // Kapanma animasyonu sürerken içerik boşalmasın: son gösterilen bildirim, yenisi gelene kadar tutulur
  const [last, setLast] = useState<{ item: NotificationItem; target: NotificationTarget | null; link: NotificationWebLink | null } | null>(
    itemProp ? { item: itemProp, target: targetProp, link: linkProp } : null
  );
  if (itemProp && (last?.item !== itemProp || last.target !== targetProp || last.link !== linkProp)) {
    setLast({ item: itemProp, target: targetProp, link: linkProp });
  }
  const visible = !!itemProp;
  const item = itemProp ?? last?.item ?? null;
  const target = itemProp ? targetProp : (last?.target ?? null);
  const link = itemProp ? linkProp : (last?.link ?? null);
  const title = item?.verb?.trim() || "Bildirim";
  const body = item?.description?.trim() || "";
  // Göreli zaman yalnız "3 sa önce" gibi gerçekten göreli ise eklenir; eski kayıtta tarih tekrarlanmaz
  const sender = item ? notificationSender(item) : null;
  const relative = item?.timestamp ? formatRelative(item.timestamp) : "";
  const when = item?.timestamp
    ? /\d{2}\.\d{2}\.\d{4}/.test(relative)
      ? formatDateTime(item.timestamp)
      : `${formatDateTime(item.timestamp)} · ${relative}`
    : null;

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={title}
      scrollable
      testID="notification-sheet"
      footer={
        target ? (
          <AppButton
            title={TARGET_LABEL[target.name]}
            icon="arrow-right"
            onPress={() => onOpenTarget(target)}
            style={styles.flex}
            testID="notification-open-target"
          />
        ) : link ? (
          <AppButton
            title="Bağlantıyı aç"
            icon="external-link"
            onPress={() => {
              Linking.openURL(link.url).catch(() => toast.error("Bağlantı açılamadı."));
            }}
            style={styles.flex}
            testID="notification-open-link"
          />
        ) : undefined
      }
    >
      {item ? (
        <View style={styles.content}>
          <View style={styles.metaRow}>
            <View style={styles.icon}>
              <AppIcon name={notificationIcon(item)} size={16} color="primary" />
            </View>
            <View style={styles.flex}>
              {sender ? (
                <AppText variant="calloutStrong" selectable testID="notification-sheet-sender">
                  {sender}
                </AppText>
              ) : null}
              {when ? (
                <AppText variant="caption" color="textTertiary" testID="notification-sheet-time">
                  {when}
                </AppText>
              ) : null}
            </View>
          </View>
          {body && body !== title ? (
            <AppText variant="body" selectable testID="notification-sheet-body">
              {body}
            </AppText>
          ) : null}
          {link ? (
            <View style={styles.linkRow} testID="notification-link">
              <AppIcon name="link" size={14} color="textTertiary" />
              <AppText variant="caption" color="textSecondary" numberOfLines={2} style={styles.flex} selectable>
                {link.host}
              </AppText>
            </View>
          ) : null}
          {item.target_str ? (
            <AppText variant="caption" color="textSecondary">
              İlgili: {item.target_str}
            </AppText>
          ) : null}
        </View>
      ) : null}
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    content: { gap: t.spacing.md, paddingBottom: t.spacing.sm },
    metaRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.md },
    flex: { flex: 1, gap: 2 },
    linkRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.xs },
    icon: {
      width: 32,
      height: 32,
      borderRadius: t.radius.xs,
      backgroundColor: t.colors.primarySubtle,
      alignItems: "center",
      justifyContent: "center",
    },
  })
);
