import { buildVendSocketUrl, kurusToLira, parseVendEvent, PosVendChannel, type ChannelState } from "@/realtime/posVendChannel";

/** Sahte WebSocket — sunucu olaylarını testten tetikler */
class FakeSocket {
  static instances: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  closedWith: number | null = null;
  onopen: (() => void) | null = null;
  onmessage: ((e: { data: unknown }) => void) | null = null;
  onclose: ((e: { code?: number }) => void) | null = null;
  onerror: (() => void) | null = null;
  constructor(public url: string) {
    FakeSocket.instances.push(this);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close(code?: number) {
    this.closedWith = code ?? 1000;
    this.readyState = 3;
    this.onclose?.({ code: code ?? 1000 });
  }
  // test yardımcıları
  open() {
    this.readyState = 1;
    this.onopen?.();
  }
  receive(msg: object) {
    this.onmessage?.({ data: JSON.stringify(msg) });
  }
  drop(code: number) {
    this.readyState = 3;
    this.onclose?.({ code });
  }
}

const flush = () => new Promise((r) => setTimeout(r, 0));

describe("posVendChannel yardımcıları", () => {
  it("API adresinden WS adresi üretir (https→wss, http→ws), SN büyük harf ve kodlanmış", () => {
    expect(buildVendSocketUrl("pav200000884", "a.b c", "https://tms.vennex.com.tr")).toBe(
      "wss://tms.vennex.com.tr/ws/dashboard/pos/PAV200000884/?token=a.b%20c"
    );
    expect(buildVendSocketUrl("X1", "t", "http://localhost:4010/")).toBe("ws://localhost:4010/ws/dashboard/pos/X1/?token=t");
  });

  it("olayları güvenle ayrıştırır, bozuk/bilinmeyenleri atar", () => {
    expect(parseVendEvent('{"type":"vend_pending","tx_id":"t1","amount":1250,"item":7}')).toMatchObject({
      type: "vend_pending",
      tx_id: "t1",
      amount: 1250,
      item: 7,
    });
    expect(parseVendEvent('{"type":"vend_pending","amount":5}')).toBeNull(); // tx_id yok
    expect(parseVendEvent("bozuk json")).toBeNull();
    expect(parseVendEvent('{"type":"ping"}')).toBeNull();
    expect(parseVendEvent('{"type":"vend_ended","result":"success"}')).toMatchObject({ result: "success" });
  });

  it("kuruşu TL'ye çevirir", () => {
    expect(kurusToLira(1250)).toBe(12.5);
  });
});

describe("PosVendChannel", () => {
  beforeEach(() => {
    FakeSocket.instances = [];
    jest.useRealTimers();
  });

  const make = (over: Partial<ConstructorParameters<typeof PosVendChannel>[1]> = {}) => {
    const events: unknown[] = [];
    const states: ChannelState[] = [];
    const ch = new PosVendChannel("PAV1", {
      onEvent: (e) => events.push(e),
      onState: (s) => states.push(s),
      createSocket: (u) => new FakeSocket(u) as unknown as WebSocket,
      getToken: async () => "jwt",
      refreshToken: jest.fn(async () => undefined),
      maxBackoffMs: 20,
      ...over,
    });
    return { ch, events, states };
  };

  it("bağlanır, olayları iletir ve onayı doğru formatta gönderir", async () => {
    const { ch, events, states } = make();
    await ch.connect();
    const s = FakeSocket.instances[0];
    expect(s.url).toContain("/ws/dashboard/pos/PAV1/?token=jwt");
    s.open();
    s.receive({ type: "vend_pending", tx_id: "t1", amount: 1250, item: 3 });
    expect(events[0]).toMatchObject({ type: "vend_pending", tx_id: "t1" });
    expect(ch.approve("t1")).toBe(true);
    expect(JSON.parse(s.sent[0])).toEqual({ type: "remote_decision", tx_id: "t1", decision: "approve" });
    expect(states).toEqual(["connecting", "open"]);
  });

  it("bağlantı açık değilken onay göndermez", async () => {
    const { ch } = make();
    await ch.connect();
    expect(ch.approve("t1")).toBe(false);
  });

  it("4003'te bir kez token yeniler, yine reddedilirse yetkisiz olur (sonsuz döngü yok)", async () => {
    const refreshToken = jest.fn(async () => undefined);
    const { ch, states } = make({ refreshToken });
    await ch.connect();
    FakeSocket.instances[0].drop(4003);
    await flush();
    expect(refreshToken).toHaveBeenCalledTimes(1);
    expect(FakeSocket.instances).toHaveLength(2);
    FakeSocket.instances[1].drop(4003);
    await flush();
    expect(states[states.length - 1]).toBe("unauthorized");
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it("el sıkışma reddi (açılmadan 1006): bir kez yeniler, API erişilebilirse yetkisiz olur", async () => {
    const refreshToken = jest.fn(async () => undefined);
    const probeApi = jest.fn(async () => true);
    const { ch, states } = make({ refreshToken, probeApi });
    await ch.connect();
    FakeSocket.instances[0].drop(1006);
    await flush();
    expect(refreshToken).toHaveBeenCalledTimes(1);
    FakeSocket.instances[1].drop(1006);
    await flush();
    await flush();
    expect(probeApi).toHaveBeenCalled();
    expect(states[states.length - 1]).toBe("unauthorized");
    await new Promise((r) => setTimeout(r, 30));
    expect(FakeSocket.instances).toHaveLength(2);
  });

  it("açılmadan kapanma + API de erişilemiyorsa ağ hatasıdır: yeniden dener", async () => {
    const { ch, states } = make({ probeApi: async () => false });
    await ch.connect();
    FakeSocket.instances[0].drop(1006);
    await flush();
    FakeSocket.instances[1].drop(1006);
    await flush();
    await flush();
    expect(states).toContain("reconnecting");
    expect(states).not.toContain("unauthorized");
    ch.close();
  });

  it("ağ kopmasında üstel beklemeyle yeniden bağlanır", async () => {
    const { ch, states } = make();
    await ch.connect();
    FakeSocket.instances[0].open();
    FakeSocket.instances[0].drop(1006);
    expect(states).toContain("reconnecting");
    await new Promise((r) => setTimeout(r, 30));
    expect(FakeSocket.instances).toHaveLength(2);
    ch.close();
  });

  it("kullanıcı kapatınca yeniden bağlanmaz ve 1000 ile kapatır", async () => {
    const { ch, states } = make();
    await ch.connect();
    const s = FakeSocket.instances[0];
    s.open();
    ch.close();
    expect(s.closedWith).toBe(1000);
    await new Promise((r) => setTimeout(r, 30));
    expect(FakeSocket.instances).toHaveLength(1);
    expect(states[states.length - 1]).toBe("closed");
  });

  it("token yoksa bağlanmaz, yetkisiz durumuna geçer", async () => {
    const { ch, states } = make({ getToken: async () => null });
    await ch.connect();
    expect(FakeSocket.instances).toHaveLength(0);
    expect(states).toContain("unauthorized");
  });
});
