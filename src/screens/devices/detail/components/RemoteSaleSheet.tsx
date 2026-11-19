import React, { useEffect, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import {
  AppBadge,
  AppButton,
  AppIcon,
  AppNotice,
  AppSheet,
  AppText,
  makeStyles,
  toast,
} from "@/design-system";
import { formatCurrency } from "@/utils/number";
import { kurusToLira, PosVendChannel, type ChannelState, type VendEvent } from "@/realtime/posVendChannel";

type Pending = { txId: string; amount: number; item: number | null };
type Phase = "waiting" | "pending" | "approving" | "approved" | "result";

const STATE_LABEL: Record<ChannelState, { label: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  connecting: { label: "Bağlanıyor", tone: "warning" },
  open: { label: "Bağlı", tone: "success" },
  reconnecting: { label: "Yeniden bağlanıyor", tone: "warning" },
  closed: { label: "Bağlantı kapalı", tone: "neutral" },
  unauthorized: { label: "Yetki yok", tone: "danger" },
};

const ERROR_TEXT: Record<string, string> = {
  tx_not_found: "Satış isteğinin süresi doldu veya zaten işlendi.",
  tx_pos_mismatch: "Satış isteği bu POS cihazına ait değil.",
  invalid_decision: "Geçersiz onay isteği.",
  tx_corrupted: "Satış isteği okunamadı.",
};

/**
 * Uzaktan satış: müşteri otomatta ürün seçince istek buraya düşer; kullanıcı onaylarsa cihaz ürünü verir.
 * Red mesajı yoktur — onaylanmazsa cihaz kendi zaman aşımıyla (~15 sn) iptal eder.
 * Sayfa kapanınca bağlantı kapatılır (cihaza "izleme bitti" sinyali gider) — web modalı gibi tek "Kapat".
 * Yeni bir istek (farklı tx_id) her zaman onaylanabilir duruma döner (web `showPending`); aynı isteğin
 * tekrarı (geç katılım) mevcut onay durumunu korur. Onay, ref kilidiyle istek başına bir kez gönderilir.
 */
export function RemoteSaleSheet({ visible, onClose, sn, deviceName }: {
  visible: boolean;
  onClose: () => void;
  sn: string;
  deviceName?: string | null;
}) {
  const styles = useStyles();
  const channelRef = useRef<PosVendChannel | null>(null);
  const [state, setState] = useState<ChannelState>("connecting");
  const [phase, setPhase] = useState<Phase>("waiting");
  const [pending, setPending] = useState<Pending | null>(null);
  const [result, setResult] = useState<{ tone: "success" | "danger" | "neutral"; text: string } | null>(null);
  // Olay işleyicisi ve çift dokunuş için senkron kopyalar (state bir sonraki çizime kadar eski kalır)
  const pendingRef = useRef<Pending | null>(null);
  const approveLock = useRef<string | null>(null);

  // Sayfa her açılışta temiz başlar (effect içinde setState yerine render sırasında önceki değere göre)
  const [wasVisible, setWasVisible] = useState(visible);
  if (visible !== wasVisible) {
    setWasVisible(visible);
    if (visible) {
      setState("connecting");
      setPhase("waiting");
      setPending(null);
      setResult(null);
    }
  }
  useEffect(() => {
    if (!visible) return;
    pendingRef.current = null;
    approveLock.current = null;
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const onEvent = (ev: VendEvent) => {
      switch (ev.type) {
        case "vend_pending":
          if (pendingRef.current?.txId === ev.tx_id) {
            // Geç katılımda aynı istek tekrar gelebilir — tek kez göster, onay durumunu koru
            setPhase((p) => (p === "approving" || p === "approved" ? p : "pending"));
          } else {
            // Yeni istek: önceki onay/sonuç durumundan bağımsız, onaylanabilir
            const next = { txId: ev.tx_id, amount: ev.amount, item: ev.item };
            pendingRef.current = next;
            approveLock.current = null;
            setPending(next);
            setPhase("pending");
          }
          setResult(null);
          break;
        case "remote_decision_ack":
          if (ev.tx_id && pendingRef.current && ev.tx_id !== pendingRef.current.txId) break;
          if (!ev.ok) approveLock.current = null;
          setPhase(ev.ok ? "approved" : "pending");
          break;
        case "vend_ended": {
          // Web gibi: başka bir isteğin sonucu güncel bekleyen isteği silmez
          if (ev.tx_id && pendingRef.current && ev.tx_id !== pendingRef.current.txId) break;
          const map = {
            success: { tone: "success" as const, text: "Satış başarılı — ürün verildi." },
            failure: { tone: "danger" as const, text: "Satış başarısız — ürün verilemedi." },
            cancelled: { tone: "neutral" as const, text: "Satış iptal edildi." },
          };
          const r = map[ev.result as keyof typeof map] ?? { tone: "neutral" as const, text: "Satış sonuçlandı." };
          setResult(r);
          pendingRef.current = null;
          approveLock.current = null;
          setPending(null);
          setPhase("result");
          if (ev.result === "success") toast.success("Uzaktan satış tamamlandı");
          break;
        }
        case "error":
          toast.error(ERROR_TEXT[ev.error] ?? "Uzaktan satış hatası.");
          approveLock.current = null;
          setPhase((p) => (p === "approving" ? "pending" : p));
          break;
      }
    };
    const ch = new PosVendChannel(sn, { onEvent, onState: setState });
    channelRef.current = ch;
    ch.connect();
    return () => {
      ch.close();
      channelRef.current = null;
    };
  }, [visible, sn]);

  const approve = () => {
    const cur = pendingRef.current;
    // `phase` bu çizimin değeri; hızlı ikinci dokunuşu senkron kilit yakalar
    if (!cur || phase !== "pending" || approveLock.current === cur.txId) return;
    approveLock.current = cur.txId;
    setPhase("approving");
    if (!channelRef.current?.approve(cur.txId)) {
      approveLock.current = null;
      setPhase("pending");
      toast.error("Bağlantı yok; onay gönderilemedi.");
    }
  };

  const st = STATE_LABEL[state];

  return (
    <AppSheet
      visible={visible}
      onClose={onClose}
      title="Uzaktan satış"
      subtitle={deviceName ? `${deviceName} · ${sn}` : sn}
      testID="remote-sale-sheet"
      footer={
        pending && (phase === "pending" || phase === "approving") ? (
          <>
            <AppButton title="Kapat" variant="outline" onPress={onClose} style={styles.flex} testID="remote-sale-close" />
            <AppButton
              testID="remote-sale-approve"
              title="Satışı onayla"
              icon="check"
              onPress={approve}
              loading={phase === "approving"}
              style={styles.flex}
            />
          </>
        ) : (
          <AppButton title="Kapat" variant="outline" onPress={onClose} style={styles.flex} />
        )
      }
    >
      <View style={styles.statusRow}>
        <AppText variant="callout" color="textSecondary">
          Canlı bağlantı
        </AppText>
        <AppBadge label={st.label} tone={st.tone} dot />
      </View>

      {state === "unauthorized" ? (
        <AppNotice
          tone="danger"
          title="Uzaktan satış yetkiniz yok"
          message="Bu POS cihazı için uzaktan satış yetkisi gerekiyor. Yöneticinizden 'Remote Vend' yetkisini isteyin."
        />
      ) : pending ? (
        <View style={styles.pending} accessibilityLiveRegion="assertive">
          <AppText variant="overline" color="textTertiary">
            Müşteri ürün seçti
          </AppText>
          <AppText variant="metricLg" testID="remote-sale-amount">
            {formatCurrency(kurusToLira(pending.amount))}
          </AppText>
          <AppText variant="body" color="textSecondary">
            {pending.item != null ? `Ürün no ${pending.item}` : "Ürün"}
            {phase === "approved" ? " · onay gönderildi, POS cihazı ürünü veriyor…" : ""}
          </AppText>
          <AppNotice tone="info" message="Onaylarsanız ürün ücretsiz verilir. Onaylamazsanız POS cihazı kısa süre sonra işlemi iptal eder." />
        </View>
      ) : result ? (
        <AppNotice tone={result.tone === "neutral" ? "info" : result.tone} message={result.text} />
      ) : (
        <View style={styles.waiting}>
          <AppIcon name="radio" size={22} color="textTertiary" />
          <AppText variant="body" color="textSecondary" align="center">
            Müşterinin otomatta ürün seçmesi bekleniyor. İstek geldiğinde burada görünür.
          </AppText>
        </View>
      )}
    </AppSheet>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    statusRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
    pending: { gap: t.spacing.sm, alignItems: "flex-start" },
    waiting: { alignItems: "center", gap: t.spacing.sm, paddingVertical: t.spacing.xl },
  })
);
