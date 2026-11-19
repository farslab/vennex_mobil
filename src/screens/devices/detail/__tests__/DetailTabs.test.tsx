/**
 * Cihaz detayı sekmeleri (Genel / İstatistikler / Nakit & Ciro) ve işlem detayı sayfası —
 * DeviceDetailScreen.test.tsx'in dolaylı olarak kapsamadığı senaryolar. Sekmeler doğrudan render edilir.
 */
import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { normalizeDeviceDetail, normalizeDeviceTransaction } from "@/api/devices";
import { useToastStore } from "@/design-system";
import { renderWithProviders } from "@/test/utils";
import { businessToday, toApiDate } from "@/utils/date";
import { PosVendChannel, type ChannelState } from "@/realtime/posVendChannel";
import { GeneralTab } from "@/screens/devices/detail/tabs/GeneralTab";
import { StatsTab } from "@/screens/devices/detail/tabs/StatsTab";
import { CashTab } from "@/screens/devices/detail/tabs/CashTab";
import { TransactionDetailSheet } from "@/screens/devices/detail/components/TransactionDetailSheet";
import type { DeviceAccess } from "@/screens/devices/detail/useDeviceQueries";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

// Uzaktan satış kanalı: gerçek WebSocket açılmaz
jest.mock("@/realtime/posVendChannel", () => {
  const actual = jest.requireActual<typeof import("@/realtime/posVendChannel")>("@/realtime/posVendChannel");
  return {
    ...actual,
    PosVendChannel: jest.fn().mockImplementation((_sn: string, opts: { onState: (s: ChannelState) => void }) => ({
      connect: jest.fn(async () => opts.onState("open")),
      approve: jest.fn(() => true),
      close: jest.fn(),
    })),
  };
});

const SN = "PAV1";
const base = `/pos-devices/${SN}`;

const access = (o: Partial<DeviceAccess> = {}): DeviceAccess => ({
  sales: true,
  manageSettings: true,
  sendCommands: false,
  manageStock: false,
  selectMachineType: false,
  remoteVend: false,
  isTech: false,
  ...o,
});

const detail = (o: Record<string, unknown> = {}) =>
  normalizeDeviceDetail({
    sn: SN,
    pos_name: "Lobi Otomatı",
    stat: true,
    is_online: true,
    last_seen: null,
    payment_methods: { chip: true },
    ...o,
  });

/** Yerel saatle ISO tarih → formatDateTime çıktısı saat diliminden bağımsız olur */
/** Türkiye duvar saatindeki an (UTC+3) */
const localIso = (y: number, m: number, d: number, h: number, mi: number) => new Date(Date.UTC(y, m - 1, d, h - 3, mi)).toISOString();
const pad = (n: number) => String(n).padStart(2, "0");
/** Türkiye saatiyle (uygulama sunucu zamanlarını her zaman TR saatiyle gösterir) */
const trDateTime = (d: Date) => {
  const t = new Date(d.getTime() + 3 * 3600_000);
  return `${pad(t.getUTCDate())}.${pad(t.getUTCMonth() + 1)}.${t.getUTCFullYear()} ${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
};

type Reply = [number, unknown];
function deferred() {
  let release: (r: Reply) => void = () => {};
  const promise = new Promise<Reply>((resolve) => {
    release = resolve;
  });
  return { promise, release };
}

const noop = () => {};
const toastMessage = () => useToastStore.getState().current?.message;
const getsTo = (mock: MockAdapter, url: string) => mock.history.get.filter((r) => r.url === url);

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
  useToastStore.setState({ current: null });
});
afterEach(() => mock.restore());

/* ------------------------------------------------------------------ Genel */

describe("GeneralTab", () => {
  const productsBody = { mode: "normal", items: [{ id: 1, urun_no: 1, quantity: 3, max_quantity: 5 }], fill: { qty: 11, max: 18, pct: 61.4 } };

  it("dört dönemin cirosu ve işlem sayısı Türkçe biçimde eşlenir; sayısı olmayan dönemde alt yazı yok", async () => {
    mock.onGet(`${base}/summary/`).reply(200, {
      today: { revenue: "1234.5", count: 1234 },
      yesterday: { revenue: 0, count: 0 },
      this_month: { revenue: 98765.43, count: 5000 },
      last_month: { revenue: null, count: null },
    });
    mock.onGet(`${base}/products/`).reply(200, productsBody);

    await renderWithProviders(<GeneralTab sn={SN} detail={detail()} access={access()} refreshing={false} onRefresh={noop} />);

    const today = await screen.findByTestId("summary-Bugün");
    await waitFor(() => expect(within(today).getByText("₺1.234,50")).toBeOnTheScreen());
    expect(within(today).getByText("1.234 işlem")).toBeOnTheScreen();
    // 0 geçerli bir değerdir: "—" değil ₺0,00
    expect(within(screen.getByTestId("summary-Dün")).getByText("₺0,00")).toBeOnTheScreen();
    expect(within(screen.getByTestId("summary-Dün")).getByText("0 işlem")).toBeOnTheScreen();
    expect(within(screen.getByTestId("summary-Bu ay")).getByText("₺98.765,43")).toBeOnTheScreen();
    expect(within(screen.getByTestId("summary-Bu ay")).getByText("5.000 işlem")).toBeOnTheScreen();
    const lastMonth = screen.getByTestId("summary-Geçen ay");
    expect(within(lastMonth).getByText("—")).toBeOnTheScreen();
    expect(within(lastMonth).queryByText(/işlem/)).toBeNull();

    expect(getsTo(mock, `${base}/summary/`)).toHaveLength(1);
    expect(getsTo(mock, `${base}/products/`)).toHaveLength(1);
  });

  it("durum, doluluk, ödeme yöntemleri ve cihaz bilgisi gerçek alanlardan eşlenir", async () => {
    const seen = new Date(Date.now() - 2 * 3600_000);
    mock.onGet(`${base}/summary/`).reply(200, {});
    mock.onGet(`${base}/products/`).reply(200, productsBody);
    const d = detail({
      is_online: false,
      stat: false,
      act_macstat: 4,
      last_seen: seen.toISOString(),
      act_vmc: "Crane",
      act_vmcsn: "VMC-9",
      pos_odemetip: 1,
      price_management: 2,
      company: { id: 10, name: "Test Şirketi" },
      location: { id: 3, name: "Lobi" },
      machine_type: null,
      app_vers: "3.5.0",
      tp_vers: "2.1.0",
      act_sim_pw: 0,
      pos_updprd: 15,
      payment_methods: { contactless: true, chip: false, qrcode: true },
    });

    await renderWithProviders(<GeneralTab sn={SN} detail={d} access={access()} refreshing={false} onRefresh={noop} />);

    expect(await screen.findByText("Normal mod")).toBeOnTheScreen();
    expect(screen.getByTestId("general-fill-pct")).toHaveTextContent("%61");
    expect(screen.getByText("11 / 18 adet")).toBeOnTheScreen();

    expect(screen.getByText("Çevrimdışı")).toBeOnTheScreen();
    expect(screen.getByText("Pasif")).toBeOnTheScreen();
    expect(screen.getByText("Devre dışı")).toBeOnTheScreen();
    expect(screen.getByText(`2 sa önce · ${trDateTime(seen)}`)).toBeOnTheScreen();

    expect(screen.getByText("2 / 3 açık")).toBeOnTheScreen();
    expect(screen.getByText("Temassız")).toBeOnTheScreen();
    expect(screen.getByText("QR kod")).toBeOnTheScreen();
    expect(screen.queryByText("Çipli kart")).toBeNull();

    expect(screen.getByLabelText("Ödeme tipi: Kahve")).toBeOnTheScreen();
    expect(screen.getByLabelText("Fiyat yönetimi: Sadece sunucu")).toBeOnTheScreen();
    expect(screen.getByLabelText("Makine modeli: —")).toBeOnTheScreen();
    expect(screen.getByLabelText("Şirket: Test Şirketi")).toBeOnTheScreen();
    expect(screen.getByLabelText("Konum: Lobi")).toBeOnTheScreen();
    expect(screen.getByLabelText("Otomat seri no: VMC-9")).toBeOnTheScreen();
    expect(screen.getByLabelText("BKM sürümü: 2.1.0")).toBeOnTheScreen();
    // 0 sinyal gücü gerçek bir değer: "—"e düşmez
    expect(screen.getByLabelText("SIM sinyal gücü: 0")).toBeOnTheScreen();
    expect(screen.getByLabelText("Güncelleme periyodu: 15 dk")).toBeOnTheScreen();
  });

  it("bağlantı bilinmiyorsa ve tüm ödeme yöntemleri kapalıysa açıkça belirtir; bilinmeyen makine durumu '—'", async () => {
    mock.onGet(`${base}/summary/`).reply(200, {});
    mock.onGet(`${base}/products/`).reply(200, productsBody);
    const d = detail({ is_online: null, act_macstat: 9, payment_methods: { chip: false, contactless: false } });

    await renderWithProviders(<GeneralTab sn={SN} detail={d} access={access()} refreshing={false} onRefresh={noop} />);

    expect(await screen.findByText("Tüm ödeme yöntemleri kapalı.")).toBeOnTheScreen();
    expect(screen.getByText("0 / 2 açık")).toBeOnTheScreen();
    expect(screen.getByText("Bilinmiyor")).toBeOnTheScreen();
    expect(screen.getByLabelText("Makine durumu: —")).toBeOnTheScreen();
    expect(screen.getByLabelText("Son iletişim: —")).toBeOnTheScreen();
  });

  it("özet ve ürün uçları hata verirse uyarı gösterir, sahte değer üretmez", async () => {
    mock.onGet(`${base}/summary/`).reply(500, { detail: "Sunucu hatası" });
    mock.onGet(`${base}/products/`).reply(503, {});

    await renderWithProviders(<GeneralTab sn={SN} detail={detail()} access={access()} refreshing={false} onRefresh={noop} />);

    expect(await screen.findByText("Özet alınamadı: Sunucu hatası")).toBeOnTheScreen();
    expect(await screen.findByText("Ürün bilgisi alınamadı: Servis geçici olarak kullanılamıyor.")).toBeOnTheScreen();
    expect(screen.queryByText(/₺/)).toBeNull();
    expect(screen.queryByTestId("general-fill-pct")).toBeNull();
  });

  it("uzaktan satış yalnız remote_vend ile görünür; kanal yalnız açılınca ve cihaz SN'i ile kurulur", async () => {
    mock.onGet(`${base}/summary/`).reply(200, {});
    mock.onGet(`${base}/products/`).reply(200, productsBody);
    const Channel = jest.mocked(PosVendChannel);

    await renderWithProviders(<GeneralTab sn={SN} detail={detail()} access={access({ remoteVend: true })} refreshing={false} onRefresh={noop} />);

    const open = await screen.findByTestId("open-remote-sale");
    expect(Channel).not.toHaveBeenCalled();
    await fireEvent.press(open);

    expect(await screen.findByText("Lobi Otomatı · PAV1")).toBeOnTheScreen();
    expect(Channel).toHaveBeenCalledTimes(1);
    expect(Channel.mock.calls[0][0]).toBe(SN);
  });

  it("remote_vend yoksa uzaktan satış kartı yok ve kanal hiç kurulmaz", async () => {
    mock.onGet(`${base}/summary/`).reply(200, {});
    mock.onGet(`${base}/products/`).reply(200, productsBody);

    await renderWithProviders(<GeneralTab sn={SN} detail={detail()} access={access({ remoteVend: false })} refreshing={false} onRefresh={noop} />);

    expect(await screen.findByText("Normal mod")).toBeOnTheScreen();
    expect(screen.queryByTestId("open-remote-sale")).toBeNull();
    expect(screen.queryByText("Uzaktan satış")).toBeNull();
    expect(jest.mocked(PosVendChannel)).not.toHaveBeenCalled();
  });
});

/* ---------------------------------------------------------- İstatistikler */

describe("StatsTab", () => {
  const today = toApiDate(businessToday());

  it("doğru uçları doğru parametrelerle çağırır; KPI, değişim ve bugünkü işlemler eşlenir", async () => {
    mock.onGet(`${base}/summary/`).reply(200, {
      today: { revenue: 250, count: 7 },
      yesterday: { revenue: 100, count: 3 },
      this_month: { revenue: 4000, count: 120 },
      last_month: { revenue: 0, count: 0 },
    });
    mock.onGet(`${base}/transactions/`).reply(200, { count: 3, results: [], summary: { total: 3, success: 2, failed: 1, revenue: 30 } });
    mock.onGet(`${base}/revenue-counts/`).reply(200, { results: [] });

    await renderWithProviders(<StatsTab sn={SN} refreshing={false} onRefresh={noop} />);

    const todayKpi = await screen.findByTestId("stats-today");
    expect(within(todayKpi).getByText("₺250,00")).toBeOnTheScreen();
    expect(within(todayKpi).getByText("▲ %150")).toBeOnTheScreen();
    expect(screen.getByTestId("stats-today-caption")).toHaveTextContent("Dün ₺100,00");
    const month = screen.getByTestId("stats-month");
    expect(within(month).getByText("₺4.000,00")).toBeOnTheScreen();
    // önceki dönem 0 → yüzde değişim uydurulmaz
    expect(within(month).queryByText(/[▲▼]/)).toBeNull();
    expect(screen.getByTestId("stats-month-caption")).toHaveTextContent("Geçen ay ₺0,00");

    expect(await screen.findByLabelText("Toplam: 3")).toBeOnTheScreen();
    expect(screen.getByLabelText("Başarılı: 2")).toBeOnTheScreen();
    expect(screen.getByLabelText("Başarısız: 1")).toBeOnTheScreen();
    expect(screen.getByLabelText("Başarı oranı: %66,7")).toBeOnTheScreen();

    const tx = getsTo(mock, `${base}/transactions/`);
    expect(tx).toHaveLength(1);
    expect(tx[0].params).toEqual({ page: 1, start_date: today, end_date: today });
    expect(getsTo(mock, `${base}/revenue-counts/`)[0].params).toEqual({ limit: 25 });
    expect(getsTo(mock, `${base}/summary/`)).toHaveLength(1);
  });

  it("ödeme türü kırılımı en son sayımdan, sıfırlar atılarak büyükten küçüğe sıralanır", async () => {
    mock.onGet(`${base}/summary/`).reply(200, {});
    mock.onGet(`${base}/transactions/`).reply(200, { results: [] });
    mock.onGet(`${base}/revenue-counts/`).reply(200, {
      results: [
        { id: 2, datetime: localIso(2026, 11, 18, 9, 5), total_revenue: "350.75", notes: "", counted_by: "ali", by_pt_type: { "0": 100, "1": "250.75", "2": 0 } },
        { id: 1, datetime: localIso(2026, 11, 1, 9, 0), total_revenue: 999, notes: "", counted_by: "ali", by_pt_type: { "3": 999 } },
      ],
    });

    await renderWithProviders(<StatsTab sn={SN} refreshing={false} onRefresh={noop} />);

    expect(await screen.findByText("Son ciro sayımı · 18.11.2026 09:05")).toBeOnTheScreen();
    const labels = screen.getAllByText(/^(Nakit|Kredi\/Banka Kartı|İstanbulKart|Multinet)$/).map((n) => n.props.children);
    expect(labels).toEqual(["Kredi/Banka Kartı", "Nakit"]);
    expect(screen.getByText("₺250,75")).toBeOnTheScreen();
    expect(screen.getByText("₺100,00")).toBeOnTheScreen();
    expect(screen.getByText("₺350,75")).toBeOnTheScreen();
    expect(screen.queryByText("₺999,00")).toBeNull();
  });

  it("boş yanıtlarda sahte değer göstermez: KPI '—', işlem özeti '—', sayım yoksa açıklama", async () => {
    mock.onGet(`${base}/summary/`).reply(200, {});
    mock.onGet(`${base}/transactions/`).reply(200, { results: [] });
    mock.onGet(`${base}/revenue-counts/`).reply(200, { results: [] });

    await renderWithProviders(<StatsTab sn={SN} refreshing={false} onRefresh={noop} />);

    expect(await screen.findByText("Henüz ciro sayımı yapılmamış; kırılım gösterilemiyor.")).toBeOnTheScreen();
    expect(within(screen.getByTestId("stats-today")).getByText("—")).toBeOnTheScreen();
    expect(within(screen.getByTestId("stats-today")).queryByText(/[▲▼]/)).toBeNull();
    expect(await screen.findByLabelText("Toplam: —")).toBeOnTheScreen();
    expect(screen.getByLabelText("Başarı oranı: —")).toBeOnTheScreen();
    expect(screen.queryByText(/₺\d/)).toBeNull();
  });

  it("son sayımda tüm türler sıfırsa 'Son sayımda ciro yok.' der", async () => {
    mock.onGet(`${base}/summary/`).reply(200, {});
    mock.onGet(`${base}/transactions/`).reply(200, { results: [] });
    mock.onGet(`${base}/revenue-counts/`).reply(200, {
      results: [{ id: 3, datetime: localIso(2026, 11, 18, 10, 0), total_revenue: 0, by_pt_type: { "0": 0, "1": 0 } }],
    });

    await renderWithProviders(<StatsTab sn={SN} refreshing={false} onRefresh={noop} />);

    expect(await screen.findByText("Son sayımda ciro yok.")).toBeOnTheScreen();
  });

  it("her bölüm kendi hatasını sunucu mesajıyla gösterir", async () => {
    mock.onGet(`${base}/summary/`).reply(500, { detail: "Sunucu hatası" });
    mock.onGet(`${base}/transactions/`).reply(403, { detail: "Satışları görme yetkiniz yok." });
    mock.onGet(`${base}/revenue-counts/`).reply(500, {});

    await renderWithProviders(<StatsTab sn={SN} refreshing={false} onRefresh={noop} />);

    expect(await screen.findByText("Özet alınamadı: Sunucu hatası")).toBeOnTheScreen();
    expect(await screen.findByText("Satışları görme yetkiniz yok.")).toBeOnTheScreen();
    expect(await screen.findByText("Sunucuda bir hata oluştu. Lütfen daha sonra tekrar deneyin.")).toBeOnTheScreen();
    expect(screen.queryByTestId("stats-today")).toBeNull();
  });
});

/* -------------------------------------------------------- Nakit & Ciro */

describe("CashTab", () => {
  it("geçmiş listeleri limit=25 ile çekilir; tutar/tarih Türkçe, yapan kişi/not ve tür kırılımı gösterilir", async () => {
    mock.onGet(`${base}/cash-history/`).reply(200, {
      results: [
        { id: 1, datetime: localIso(2026, 11, 18, 9, 5), amount: "1250.5", notes: "haftalık", collected_by: "ali" },
        { id: 2, datetime: null, amount: null, notes: "", collected_by: null },
      ],
    });
    mock.onGet(`${base}/revenue-counts/`).reply(200, {
      results: [{ id: 7, datetime: localIso(2026, 11, 17, 18, 30), total_revenue: 300, notes: "", counted_by: "ayse", by_pt_type: { "0": 100, "1": 200, "5": 0 } }],
    });

    await renderWithProviders(<CashTab sn={SN} detail={detail()} access={access()} refreshing={false} onRefresh={noop} />);

    expect(await screen.findByText("₺1.250,50")).toBeOnTheScreen();
    expect(screen.getByText("18.11.2026 09:05")).toBeOnTheScreen();
    expect(screen.getByText("İşlemi yapan: ali · haftalık")).toBeOnTheScreen();
    // boş alanlar uydurulmaz
    expect(screen.getByLabelText("—, —")).toBeOnTheScreen();
    expect(screen.getByText("İşlemi yapan: —")).toBeOnTheScreen();

    const count = await screen.findByLabelText("₺300,00, 17.11.2026 18:30, ayse");
    expect(within(count).getByText("İşlemi yapan: ayse")).toBeOnTheScreen();
    expect(within(count).getByText("Kredi/Banka Kartı")).toBeOnTheScreen();
    expect(within(count).getByText("₺200,00")).toBeOnTheScreen();
    expect(within(count).getByText("Nakit")).toBeOnTheScreen();
    expect(within(count).queryByText("Personel Kart")).toBeNull();

    expect(getsTo(mock, `${base}/cash-history/`)[0].params).toEqual({ limit: 25 });
    expect(getsTo(mock, `${base}/revenue-counts/`)[0].params).toEqual({ limit: 25 });
  });

  it("boş geçmişte boş durum, hatalı geçmişte sunucu mesajı gösterilir", async () => {
    mock.onGet(`${base}/cash-history/`).reply(200, { results: [] });
    mock.onGet(`${base}/revenue-counts/`).reply(500, { detail: "Sayım geçmişi alınamadı." });

    await renderWithProviders(<CashTab sn={SN} detail={detail()} access={access()} refreshing={false} onRefresh={noop} />);

    expect(await screen.findByText("Bu cihaz için nakit toplama yapılmamış.")).toBeOnTheScreen();
    expect(await screen.findByText("Sayım geçmişi alınamadı.")).toBeOnTheScreen();
  });

  it("ciro say: not kırpılarak gönderilir; başarıda son sayım kartı, sunucu mesajı ve geçmiş yenilenir", async () => {
    mock.onGet(`${base}/cash-history/`).reply(200, { results: [] });
    mock.onGet(`${base}/revenue-counts/`).reply(200, { results: [] });
    mock.onPost(`${base}/count-revenue/`).reply(200, {
      detail: "350.75₺ ciro sayımı kaydedildi.",
      total_revenue: "350.75",
      by_pt_type: { "0": "100.25", "1": 250.5, "2": 0 },
    });

    // Web: satış yetkisi olan, cihaz ayarı yetkisi olmasa da nakit toplayabilir (`collect_cash`)
    await renderWithProviders(
      <CashTab sn={SN} detail={detail()} access={access({ manageSettings: false })} refreshing={false} onRefresh={noop} />
    );
    expect(await screen.findByText("Bu cihaz için ciro sayımı yapılmamış.")).toBeOnTheScreen();
    expect(screen.getByTestId("collect-cash-button")).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId("cash-notes"), "  akşam sayımı  ");
    await fireEvent.press(screen.getByTestId("count-revenue-button"));

    expect(await screen.findByText("Ciro sayımı")).toBeOnTheScreen();
    expect(screen.getByText("Lobi Otomatı")).toBeOnTheScreen();
    expect(screen.getByText("akşam sayımı")).toBeOnTheScreen();
    expect(screen.getByText("Sayımı kaydet")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);

    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(mock.history.post[0].url).toBe(`${base}/count-revenue/`);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ notes: "akşam sayımı" });

    expect(await screen.findByText("Son ciro sayımı")).toBeOnTheScreen();
    expect(screen.getByText("₺350,75")).toBeOnTheScreen();
    expect(screen.getByText("₺250,50")).toBeOnTheScreen();
    expect(screen.getByText("₺100,25")).toBeOnTheScreen();
    expect(toastMessage()).toBe("350.75₺ ciro sayımı kaydedildi.");
    expect(screen.getByTestId("cash-notes").props.value).toBe("");
    await waitFor(() => expect(getsTo(mock, `${base}/revenue-counts/`).length).toBeGreaterThanOrEqual(2));
  });

  it("nakit topla: istek sürerken onay kilitlenir, tekrar basış ikinci istek atmaz; başarıda tutar toast'ta (view_sales)", async () => {
    mock.onGet(`${base}/cash-history/`).reply(200, { results: [] });
    mock.onGet(`${base}/revenue-counts/`).reply(200, { results: [] });
    const d = deferred();
    mock.onPost(`${base}/collect-cash/`).reply(() => d.promise);

    await renderWithProviders(<CashTab sn={SN} detail={detail()} access={access()} refreshing={false} onRefresh={noop} />);
    await fireEvent.press(await screen.findByTestId("collect-cash-button"));
    await fireEvent.press(await screen.findByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(screen.getByTestId("confirm-sheet-confirm")).toBeDisabled());
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    expect(mock.history.post).toHaveLength(1);

    d.release([200, { detail: "320.00₺ nakit toplama işlemi başarıyla kaydedildi.", amount_collected: "320" }]);
    await waitFor(() => expect(toastMessage()).toBe("₺320,00 nakit toplama kaydedildi."));
    expect(screen.queryByTestId("confirm-sheet-confirm")).toBeNull();
    expect(mock.history.post).toHaveLength(1);
  });

  // BİLİNEN HATA (CashTab.tsx:225): onConfirm={() => active.mutate()} ref kilidi kullanmıyor.
  // React Query isPending'i bir sonraki tikte yayınladığından, buton kilitlenmeden gelen ikinci
  // dokunuş ikinci POST collect-cash atar (stok modülündeki useStockMutation.run bunu ref ile önler).
  it("nakit topla: yeniden çizim beklenmeden gelen art arda iki dokunuş tek istek atmalı", async () => {
    mock.onGet(`${base}/cash-history/`).reply(200, { results: [] });
    mock.onGet(`${base}/revenue-counts/`).reply(200, { results: [] });
    const d = deferred();
    mock.onPost(`${base}/collect-cash/`).reply(() => d.promise);

    await renderWithProviders(<CashTab sn={SN} detail={detail()} access={access()} refreshing={false} onRefresh={noop} />);
    await fireEvent.press(await screen.findByTestId("collect-cash-button"));
    const confirm = await screen.findByTestId("confirm-sheet-confirm");
    // Sahte zamanlayıcı: iki dokunuş arasında React Query bildirim tiki (setTimeout 0) çalışmaz —
    // yoğun JS iş parçacığında art arda kuyruğa giren iki dokunuşun deterministik karşılığı.
    jest.useFakeTimers();
    try {
      await fireEvent.press(confirm);
      await fireEvent.press(confirm);
      await waitFor(() => expect(screen.getByTestId("confirm-sheet-confirm")).toBeDisabled());
      d.release([200, { detail: "", amount_collected: 1 }]);
      await waitFor(() => expect(screen.queryByTestId("confirm-sheet-confirm")).toBeNull());
    } finally {
      jest.useRealTimers();
    }
    expect(mock.history.post).toHaveLength(1);
  });

  it("teknisyen, view_sales yoksa: geçmiş istenmez, Ciro say gizli, nakit toplar ama tutar gösterilmez (web)", async () => {
    mock.onPost(`${base}/collect-cash/`).reply(200, { detail: "Nakit toplama işlemi başarıyla kaydedildi.", amount_collected: 320 });

    await renderWithProviders(
      <CashTab sn={SN} detail={detail()} access={access({ sales: false, manageSettings: false, isTech: true })} refreshing={false} onRefresh={noop} />
    );

    expect(screen.queryByTestId("count-revenue-button")).toBeNull();
    expect(screen.queryByText("Nakit toplama geçmişi")).toBeNull();
    expect(screen.queryByText("Ciro sayım geçmişi")).toBeNull();

    await fireEvent.press(screen.getByTestId("collect-cash-button"));
    await fireEvent.press(await screen.findByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(toastMessage()).toBe("Nakit toplama kaydedildi."));

    expect(JSON.parse(mock.history.post[0].data)).toEqual({});
    expect(screen.queryByText(/₺/)).toBeNull();
    expect(mock.history.get).toHaveLength(0);
  });

  it("hiçbir işlem yetkisi yoksa açıklama gösterir, aksiyon ve geçmiş yoktur", async () => {
    await renderWithProviders(
      <CashTab sn={SN} detail={detail()} access={access({ sales: false, manageSettings: false })} refreshing={false} onRefresh={noop} />
    );

    expect(screen.getByText("Bu sekmedeki işlemler için yetkiniz yok.")).toBeOnTheScreen();
    expect(screen.queryByTestId("collect-cash-button")).toBeNull();
    expect(screen.queryByTestId("count-revenue-button")).toBeNull();
    expect(screen.queryByTestId("cash-notes")).toBeNull();
    expect(mock.history.get).toHaveLength(0);
  });

  it("vazgeçince istek atılmaz; hata sonrası yeniden açılan onay sayfası eski hatayı göstermez", async () => {
    mock.onGet(`${base}/cash-history/`).reply(200, { results: [] });
    mock.onGet(`${base}/revenue-counts/`).reply(200, { results: [] });
    mock.onPost(`${base}/count-revenue/`).reply(400, { detail: "Sayılacak ciro bulunmamaktadır." });

    await renderWithProviders(<CashTab sn={SN} detail={detail()} access={access()} refreshing={false} onRefresh={noop} />);

    await fireEvent.press(await screen.findByTestId("collect-cash-button"));
    await fireEvent.press(await screen.findByText("Vazgeç"));
    await waitFor(() => expect(screen.queryByTestId("confirm-sheet-confirm")).toBeNull());
    expect(mock.history.post).toHaveLength(0);

    await fireEvent.press(screen.getByTestId("count-revenue-button"));
    await fireEvent.press(await screen.findByTestId("confirm-sheet-confirm"));
    expect(await screen.findByText("Sayılacak ciro bulunmamaktadır.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Vazgeç"));

    await fireEvent.press(screen.getByTestId("count-revenue-button"));
    expect(await screen.findByText("Sayımı kaydet")).toBeOnTheScreen();
    expect(screen.queryByText("Sayılacak ciro bulunmamaktadır.")).toBeNull();
    expect(mock.history.post).toHaveLength(1);
  });
});

/* ---------------------------------------------------- İşlem detayı sayfası */

describe("TransactionDetailSheet", () => {
  const tx = (o: Record<string, unknown> = {}) =>
    normalizeDeviceTransaction({
      id: 5,
      pt_id: "TX5",
      pt_datetime: localIso(2026, 11, 18, 8, 15),
      amount: "12.50",
      pt_type: 1,
      status: true,
      iptalNo: 0,
      product_no: 4,
      pt_pan: "5400********1234",
      bankRefNo: "BR1",
      display_name: "Su",
      ...o,
    });

  it("başarılı işlemi Türkçe tutar/tarihle gösterir; hata nedeni satırı yoktur", async () => {
    await render(<TransactionDetailSheet tx={tx()} onClose={noop} />);

    expect(screen.getByText("İşlem detayı")).toBeOnTheScreen();
    expect(screen.getByText("₺12,50")).toBeOnTheScreen();
    expect(screen.getByText("Başarılı")).toBeOnTheScreen();
    expect(screen.getByLabelText("Tarih: 18.11.2026 08:15")).toBeOnTheScreen();
    expect(screen.getByLabelText("Ürün: Su")).toBeOnTheScreen();
    expect(screen.getByLabelText("Ürün no: 4")).toBeOnTheScreen();
    expect(screen.getByLabelText("Ödeme türü: Kredi/Banka Kartı")).toBeOnTheScreen();
    expect(screen.getByLabelText("Kart: 5400********1234")).toBeOnTheScreen();
    expect(screen.getByLabelText("İşlem no: TX5")).toBeOnTheScreen();
    expect(screen.queryByText("Hata nedeni")).toBeNull();
  });

  it("başarısız işlemde hata nedeni; ad yoksa 'Ürün no N', boş alanlar '—'", async () => {
    await render(
      <TransactionDetailSheet
        tx={tx({ status: false, iptalNo: 2, display_name: "", pt_pan: "", bankRefNo: null, pt_type: 0, amount: "abc" })}
        onClose={noop}
      />
    );

    expect(screen.getByText("Başarısız")).toBeOnTheScreen();
    expect(screen.getByLabelText("Hata nedeni: Banka reddi")).toBeOnTheScreen();
    expect(screen.getByLabelText("Ürün: Ürün no 4")).toBeOnTheScreen();
    expect(screen.getByLabelText("Ödeme türü: Nakit")).toBeOnTheScreen();
    expect(screen.getByLabelText("Kart: —")).toBeOnTheScreen();
    expect(screen.getByLabelText("Banka referansı: —")).toBeOnTheScreen();
    // geçersiz tutar sayıya çevrilip uydurulmaz
    expect(screen.queryByText(/₺/)).toBeNull();
  });

  it("ürün adı ve numarası yoksa ürün '—'; bilinmeyen iptal kodu 'Diğer'", async () => {
    await render(<TransactionDetailSheet tx={tx({ status: false, iptalNo: 77, display_name: null, product_no: null })} onClose={noop} />);

    expect(screen.getByLabelText("Ürün: —")).toBeOnTheScreen();
    expect(screen.getByLabelText("Ürün no: —")).toBeOnTheScreen();
    expect(screen.getByLabelText("Hata nedeni: Diğer")).toBeOnTheScreen();
  });

  it("tx null iken kapalıdır; Kapat onClose çağırır", async () => {
    const onClose = jest.fn();
    const { rerender } = await render(<TransactionDetailSheet tx={null} onClose={onClose} />);
    expect(screen.queryByText("İşlem detayı")).toBeNull();

    await rerender(<TransactionDetailSheet tx={tx()} onClose={onClose} />);
    await fireEvent.press(screen.getAllByLabelText("Kapat")[0]);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
