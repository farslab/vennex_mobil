/**
 * Uzaktan satış (Remote Vend) WebSocket kanalı — web dashboard ve Flutter ile AYNI protokol
 * (backend docs/VENNEX_MOBILE_WS.md):
 *
 *   wss://<api host>/ws/dashboard/pos/<SN>/?token=<access_jwt>
 *   ← vend_pending {tx_id, pos_sn, amount (KURUŞ), item, ts}
 *   → remote_decision {tx_id, decision: "approve"}     (red yok: kapatılır, cihaz zaman aşımıyla iptal eder)
 *   ← remote_decision_ack {ok, tx_id} · vend_ended {tx_id, result: success|failure|cancelled} · error {error, tx_id}
 *
 * Yetki: backend'de superuser veya "Remote Vend" grubu + cihaza erişim (yoksa 4003 / HTTP 403).
 * Bağlantı yalnız uzaktan satış ekranı açıkken tutulur.
 */
import { API_BASE_URL } from "@/config/env";
import { tokenStorage } from "@/utils/tokenStorage";
import { apiClient } from "@/api/client";

export type VendEvent =
  | { type: "vend_pending"; tx_id: string; pos_sn?: string; amount: number; item: number | null; ts?: string }
  | { type: "vend_ended"; tx_id?: string; result: "success" | "failure" | "cancelled" | string }
  | { type: "remote_decision_ack"; ok: boolean; tx_id?: string }
  | { type: "error"; error: string; tx_id?: string };

export type ChannelState = "connecting" | "open" | "reconnecting" | "closed" | "unauthorized";

export interface PosVendChannelOptions {
  onEvent: (event: VendEvent) => void;
  onState: (state: ChannelState) => void;
  /** Test için enjekte edilebilir */
  createSocket?: (url: string) => WebSocket;
  getToken?: () => Promise<string | null>;
  refreshToken?: () => Promise<void>;
  /** API erişilebilir mi? (el sıkışma reddini ağ hatasından ayırmak için) */
  probeApi?: () => Promise<boolean>;
  maxBackoffMs?: number;
}

const AUTH_CODES = new Set([4003, 403]);

export function buildVendSocketUrl(sn: string, token: string, base = API_BASE_URL): string {
  const wsBase = base.replace(/^https:/i, "wss:").replace(/^http:/i, "ws:").replace(/\/+$/, "");
  return `${wsBase}/ws/dashboard/pos/${encodeURIComponent(sn.trim().toUpperCase())}/?token=${encodeURIComponent(token)}`;
}

/** Sunucu mesajını güvenle ayrıştırır; tanınmayanları atar */
export function parseVendEvent(raw: unknown): VendEvent | null {
  let msg: Record<string, unknown>;
  try {
    msg = typeof raw === "string" ? JSON.parse(raw) : (raw as Record<string, unknown>);
  } catch {
    return null;
  }
  if (!msg || typeof msg !== "object") return null;
  switch (msg.type) {
    case "vend_pending": {
      const amount = Number(msg.amount);
      if (typeof msg.tx_id !== "string" || !msg.tx_id || !Number.isFinite(amount)) return null;
      const item = Number(msg.item);
      return {
        type: "vend_pending",
        tx_id: msg.tx_id,
        pos_sn: typeof msg.pos_sn === "string" ? msg.pos_sn : undefined,
        amount,
        item: Number.isFinite(item) ? item : null,
        ts: typeof msg.ts === "string" ? msg.ts : undefined,
      };
    }
    case "vend_ended":
      return { type: "vend_ended", tx_id: msg.tx_id as string | undefined, result: String(msg.result ?? "") };
    case "remote_decision_ack":
      return { type: "remote_decision_ack", ok: msg.ok === true, tx_id: msg.tx_id as string | undefined };
    case "error":
      return { type: "error", error: String(msg.error ?? "unknown"), tx_id: msg.tx_id as string | undefined };
    default:
      return null;
  }
}

/** Kuruş → TL */
export function kurusToLira(amount: number): number {
  return Math.round(amount) / 100;
}

export class PosVendChannel {
  private socket: WebSocket | null = null;
  private closedByUser = false;
  private attempt = 0;
  private retryTimer: ReturnType<typeof setTimeout> | null = null;
  private triedRefresh = false;
  private opened = false;

  constructor(
    private readonly sn: string,
    private readonly opts: PosVendChannelOptions
  ) {}

  async connect(): Promise<void> {
    this.closedByUser = false;
    this.opts.onState(this.attempt === 0 ? "connecting" : "reconnecting");
    const token = await (this.opts.getToken ?? (() => tokenStorage.getAccess()))();
    if (this.closedByUser) return;
    if (!token) {
      this.opts.onState("unauthorized");
      return;
    }
    const url = buildVendSocketUrl(this.sn, token);
    const ws = (this.opts.createSocket ?? ((u: string) => new WebSocket(u)))(url);
    this.socket = ws;

    this.opened = false;
    ws.onopen = () => {
      this.opened = true;
      this.attempt = 0;
      this.triedRefresh = false;
      this.opts.onState("open");
    };
    ws.onmessage = (e: { data: unknown }) => {
      const ev = parseVendEvent(e.data);
      if (ev) this.opts.onEvent(ev);
    };
    ws.onclose = (e: { code?: number }) => this.handleClose(e.code);
    // onerror ardından onclose gelir; yeniden bağlanma orada yönetilir
    ws.onerror = () => {};
  }

  private async handleClose(code?: number) {
    this.socket = null;
    if (this.closedByUser) {
      this.opts.onState("closed");
      return;
    }
    // Sunucu yetkisiz bağlantıyı EL SIKIŞMA sırasında reddeder (HTTP 403); istemci bunu çoğu
    // zaman 4003 değil genel hata (1002/1006) olarak görür. Hiç açılmadan kapanan bağlantıda:
    // önce token yenilenir; yine açılmazsa API erişilebiliyorsa sorun yetkidir (döngüye girme).
    const handshakeRejected = !this.opened && (code == null || code === 1002 || code === 1006);
    if (handshakeRejected && this.triedRefresh) {
      const apiReachable = await (
        this.opts.probeApi ??
        (() =>
          apiClient
            .get("/app/ping/")
            .then(() => true)
            .catch((e: { status?: number }) => e?.status != null))
      )();
      if (this.closedByUser) return;
      if (apiReachable) {
        this.opts.onState("unauthorized");
        return;
      }
    }
    if ((code != null && AUTH_CODES.has(code)) || (handshakeRejected && !this.triedRefresh)) {
      // Erişim token'ı süresi dolmuş olabilir: bir kez yenileyip tekrar dene; yine reddedilirse yetki yok
      if (!this.triedRefresh) {
        this.triedRefresh = true;
        try {
          await (this.opts.refreshToken ?? (() => apiClient.get("/app/ping/").then(() => undefined)))();
        } catch {
          // yenileme başarısızsa aşağıda yetkisiz kabul edilir
        }
        if (!this.closedByUser) return this.connect();
        return;
      }
      this.opts.onState("unauthorized");
      return;
    }
    if (code === 1000) {
      this.opts.onState("closed");
      return;
    }
    // Ağ kopması / sunucu yeniden başlatma → üstel bekleme ile yeniden bağlan
    this.attempt += 1;
    const delay = Math.min(1000 * 2 ** (this.attempt - 1), this.opts.maxBackoffMs ?? 30_000);
    this.opts.onState("reconnecting");
    this.retryTimer = setTimeout(() => {
      if (!this.closedByUser) this.connect();
    }, delay);
  }

  /** Müşterinin seçtiği ürünü onayla */
  approve(txId: string): boolean {
    if (!this.socket || this.socket.readyState !== 1) return false;
    this.socket.send(JSON.stringify({ type: "remote_decision", tx_id: txId, decision: "approve" }));
    return true;
  }

  close() {
    this.closedByUser = true;
    if (this.retryTimer) clearTimeout(this.retryTimer);
    this.retryTimer = null;
    const ws = this.socket;
    this.socket = null;
    if (ws) ws.close(1000);
    else this.opts.onState("closed");
  }
}
