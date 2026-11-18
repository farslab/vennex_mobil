import React, { useEffect, useRef, useState } from "react";
import { FlatList, StyleSheet, View } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { AppBadge, AppButton, AppNotice, AppSheet, AppText, makeStyles, type ConfirmSummaryItem } from "@/design-system";
import { cardsApi } from "@/api/cards";
import { queryKeys } from "@/api/queryKeys";
import { errorMessage } from "@/api/client";
import type { CardQuotaCreatePayload, PersonnelCard } from "@/types/cards";
import { cardDisplayName } from "./format";
import { useOnOpen } from "../hooks/useOnOpen";

type ItemStatus = "waiting" | "running" | "created" | "exists" | "error" | "skipped";

interface ItemResult {
  card: PersonnelCard;
  status: ItemStatus;
  message?: string;
}

const STATUS_META: Record<ItemStatus, { label: string; tone: "neutral" | "info" | "success" | "warning" | "danger" }> = {
  waiting: { label: "Bekliyor", tone: "neutral" },
  running: { label: "Gönderiliyor", tone: "info" },
  created: { label: "Oluşturuldu", tone: "success" },
  exists: { label: "Zaten vardı", tone: "warning" },
  error: { label: "Hata", tone: "danger" },
  skipped: { label: "Gönderilmedi", tone: "neutral" },
};

/**
 * Gruptaki tüm kartlara istihkak: backend'de toplu/grup seçeneği YOK (`card-quotas/` tek kart
 * ister — views/personnel_cards.py:741). Kart başına sırayla bir POST atılır, her sonucun durumu
 * gösterilir, ilk hatada durulur; kullanıcı istediği an durdurabilir.
 */
export function QuotaBatchSheet({
  visible,
  cards,
  base,
  summary,
  onClose,
}: {
  visible: boolean;
  cards: PersonnelCard[];
  base: Omit<CardQuotaCreatePayload, "card"> | null;
  /** Başlatmadan önce gösterilen işlem özeti */
  summary: ConfirmSummaryItem[];
  onClose: () => void;
}) {
  const styles = useStyles();
  const queryClient = useQueryClient();
  // Açık bağlanırsa da (useOnOpen yalnız kapalı→açık geçişte çalışır) liste dolu başlasın
  const [items, setItems] = useState<ItemResult[]>(() =>
    visible ? cards.map((card) => ({ card, status: "waiting" as ItemStatus })) : []
  );
  const [started, setStarted] = useState(false);
  const [running, setRunning] = useState(false);
  const [finished, setFinished] = useState(false);
  const cancelled = useRef(false);
  const controller = useRef<AbortController | null>(null);

  useOnOpen(visible, () => {
    setStarted(false);
    setFinished(false);
    setItems(cards.map((card) => ({ card, status: "waiting" as ItemStatus })));
  });

  useEffect(() => {
    if (!visible || !started || !base) return;
    cancelled.current = false;
    let active = true;

    const update = (index: number, patch: Partial<ItemResult>) =>
      setItems((prev) => prev.map((it, i) => (i === index ? { ...it, ...patch } : it)));

    (async () => {
      for (let i = 0; i < cards.length; i++) {
        if (cancelled.current || !active) {
          setItems((prev) => prev.map((it) => (it.status === "waiting" ? { ...it, status: "skipped" } : it)));
          break;
        }
        update(i, { status: "running" });
        controller.current = new AbortController();
        try {
          const res = await cardsApi.quotas.create({ ...base, card: cards[i].id }, controller.current.signal);
          update(i, res.created_ids.length > 0 ? { status: "created" } : { status: "exists", message: res.detail });
        } catch (e) {
          update(i, { status: "error", message: errorMessage(e) });
          setItems((prev) => prev.map((it) => (it.status === "waiting" ? { ...it, status: "skipped" } : it)));
          break;
        }
      }
      if (!active) return;
      setRunning(false);
      setFinished(true);
      queryClient.invalidateQueries({ queryKey: queryKeys.cards.all });
    })();

    return () => {
      active = false;
      controller.current?.abort();
    };
    // Yalnız "Başlat" ile bir kez çalışır
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started]);

  const counts = items.reduce(
    (acc, it) => ({ ...acc, [it.status]: (acc[it.status] ?? 0) + 1 }),
    {} as Partial<Record<ItemStatus, number>>
  );
  const done = (counts.created ?? 0) + (counts.exists ?? 0) + (counts.error ?? 0);
  const failed = items.find((it) => it.status === "error");

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title={started ? "Gruba istihkak atanıyor" : "Gruba istihkak ata"}
      subtitle={started ? `${done}/${items.length} kart işlendi` : `${items.length} kart`}
      scrollable={false}
      dismissible={!running}
      footer={
        !started ? (
          <>
            <AppButton title="Vazgeç" variant="outline" onPress={onClose} style={styles.flex} />
            <AppButton title={`Başlat (${items.length} istek)`} onPress={() => {
              setStarted(true);
              setRunning(true);
            }} style={styles.flex} testID="quota-batch-start" />
          </>
        ) : running ? (
          <AppButton
            title="Durdur"
            variant="dangerOutline"
            icon="pause"
            onPress={() => {
              cancelled.current = true;
            }}
            fullWidth
            style={styles.flex}
            testID="quota-batch-stop"
          />
        ) : (
          <AppButton title="Kapat" onPress={onClose} style={styles.flex} testID="quota-batch-close" />
        )
      }
    >
      {!started ? (
        <>
          <AppText variant="callout" color="textSecondary">
            Backend toplu istihkak desteklemediğinden her kart için ayrı istek gönderilir. İlk hatada işlem durur; o ana kadar oluşturulanlar kalır.
          </AppText>
          <View style={styles.summary}>
            {summary.map((it, i) => (
              <View key={it.label} style={[styles.summaryRow, i < summary.length - 1 && styles.summaryBorder]}>
                <AppText variant="callout" color="textSecondary">
                  {it.label}
                </AppText>
                <AppText variant="calloutStrong" style={styles.summaryValue}>
                  {it.value}
                </AppText>
              </View>
            ))}
          </View>
        </>
      ) : finished ? (
        <AppNotice
          tone={failed ? "danger" : "success"}
          title={failed ? "İşlem hatada durduruldu" : "Tamamlandı"}
          message={
            `${counts.created ?? 0} oluşturuldu · ${counts.exists ?? 0} zaten vardı` +
            ((counts.skipped ?? 0) > 0 ? ` · ${counts.skipped} gönderilmedi` : "") +
            (failed ? `. Hata: ${failed.message ?? "bilinmiyor"}` : "")
          }
        />
      ) : (
        <AppText variant="callout" color="textSecondary">
          Backend toplu istihkak desteklemediğinden her kart için ayrı istek gönderiliyor. İlk hatada işlem durur.
        </AppText>
      )}
      {started ? (
      <FlatList
        data={items}
        style={styles.list}
        keyExtractor={(it) => String(it.card.id)}
        renderItem={({ item }) => (
          <View style={styles.row} accessible accessibilityLabel={`${cardDisplayName(item.card)}: ${STATUS_META[item.status].label}`}>
            <View style={styles.flex}>
              <AppText variant="callout" numberOfLines={1}>
                {cardDisplayName(item.card)}
              </AppText>
              {item.message && item.status === "error" ? (
                <AppText variant="caption" color="danger" numberOfLines={2}>
                  {item.message}
                </AppText>
              ) : null}
            </View>
            <AppBadge size="sm" tone={STATUS_META[item.status].tone} label={STATUS_META[item.status].label} />
          </View>
        )}
      />
      ) : null}
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    list: { maxHeight: 380 },
    summary: {
      borderRadius: t.radius.sm,
      borderWidth: StyleSheet.hairlineWidth * 2,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surfaceMuted,
    },
    summaryRow: { flexDirection: "row", justifyContent: "space-between", gap: t.spacing.md, paddingHorizontal: t.spacing.md, paddingVertical: t.spacing.sm + 2 },
    summaryBorder: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: t.colors.border },
    summaryValue: { flexShrink: 1, textAlign: "right" },
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.md,
      minHeight: 44,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: t.colors.border,
    },
  })
);
