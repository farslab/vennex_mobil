/**
 * Cihaz detayı sekmeleri (Genel + altındaki nakit/ciro bölümü / İstatistikler) ve işlem detayı sayfası —
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
import { CashSection } from "@/screens/devices/detail/components/CashSection";
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
const localIso = (y: number, m: number, d: number, h: number, mi: number, s = 0) => new Date(Date.UTC(y, m - 1, d, h - 3, mi, s)).toISOString();
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

    const today = await screen.findByTestId("summary-Bugün Ciro");
    await waitFor(() => expect(within(today).getByText("₺1.234,50")).toBeOnTheScreen());
    expect(within(today).getByText("1.234 işlem")).toBeOnTheScreen();
    // 0 geçerli bir değerdir: "—" değil ₺0,00
    expect(within(screen.getByTestId("summary-Dün Ciro")).getByText("₺0,00")).toBeOnTheScreen();
    expect(within(screen.getByTestId("summary-Dün Ciro")).getByText("0 işlem")).toBeOnTheScreen();
    expect(within(screen.getByTestId("summary-Bu Ay Ciro")).getByText("₺98.765,43")).toBeOnTheScreen();
    expect(within(screen.getByTestId("summary-Bu Ay Ciro")).getByText("5.000 işlem")).toBeOnTheScreen();
    const lastMonth = screen.getByTestId("summary-Geçen Ay Ciro");
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
    expect(screen.getByText("Hayır")).toBeOnTheScreen(); // web: "Aktif: Hayır"
    expect(screen.getByText("DISABLED")).toBeOnTheScreen(); // web: get_act_macstat_display
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

  it("kahve otomatı: slot kapasitesi yoksa doluluk bileşen haznelerinden gelir (web 'Bileşenler' ve liste ile aynı)", async () => {
    mock.onGet(`${base}/summary/`).reply(200, {});
    mock.onGet(`${base}/products/`).reply(200, {
      mode: "stock",
      items: [{ id: 1, urun_no: 0, is_wildcard: false, stock_sku: 5, stock_sku_name: "Cappuccino", stock_sku_code: "CAP", price: "25.00", quantity: 0, max_quantity: 0 }],
      fill: { qty: 0, max: 0, pct: null, containers_pct: 96.44 },
      recipe_slot_ids: [1],
    });

    await renderWithProviders(<GeneralTab sn={SN} detail={detail()} access={access()} refreshing={false} onRefresh={noop} />);

    expect(await screen.findByText("Stok modu")).toBeOnTheScreen();
    expect(screen.getByTestId("general-fill-pct")).toHaveTextContent("%96");
    expect(screen.getByTestId("general-fill-source")).toHaveTextContent("Bileşen hazneleri");
    expect(screen.queryByText(/adet/)).toBeNull();
  });

  it("bağlantı bilinmiyorsa ve tüm ödeme yöntemleri kapalıysa açıkça belirtir; bilinmeyen makine durumu '—'", async () => {
    mock.onGet(`${base}/summary/`).reply(200, {});
    mock.onGet(`${base}/products/`).reply(200, productsBody);
    const d = detail({ is_online: null, act_macstat: 9, payment_methods: { chip: false, contactless: false } });

    await renderWithProviders(<GeneralTab sn={SN} detail={d} access={access()} refreshing={false} onRefresh={noop} />);

    expect(await screen.findByText("Tüm ödeme yöntemleri kapalı.")).toBeOnTheScreen();
    expect(screen.getByText("0 / 2 açık")).toBeOnTheScreen();
    expect(screen.getByText("Bilinmiyor")).toBeOnTheScreen();
    expect(screen.getByLabelText("Makine Durumu: —")).toBeOnTheScreen();
    expect(screen.getByLabelText("Son Görülme: —")).toBeOnTheScreen();
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

  it("uzaktan satış Genel sekmesinde değil (başlıkta); sekme açılınca kanal kurulmaz", async () => {
    mock.onGet(`${base}/summary/`).reply(200, {});
    mock.onGet(`${base}/products/`).reply(200, productsBody);

    await renderWithProviders(<GeneralTab sn={SN} detail={detail()} access={access({ remoteVend: true })} refreshing={false} onRefresh={noop} />);

    expect(await screen.findByText("Normal mod")).toBeOnTheScreen();
    expect(screen.queryByTestId("open-remote-sale")).toBeNull();
    expect(jest.mocked(PosVendChannel)).not.toHaveBeenCalled();
  });

  const mockCashEndpoints = () => {
    mock.onGet(`${base}/summary/`).reply(200, {});
    mock.onGet(`${base}/products/`).reply(200, productsBody);
    mock.onGet(`${base}/cash-history/`).reply(200, { results: [] });
    mock.onGet(`${base}/revenue-counts/`).reply(200, { results: [] });
  };

  it("nakit & ciro bölümü Genel'in en altında (satış yetkisi)", async () => {
    mockCashEndpoints();
    await renderWithProviders(<GeneralTab sn={SN} detail={detail()} access={access()} refreshing={false} onRefresh={noop} />);
    expect(await screen.findByTestId("cash-section")).toBeOnTheScreen();
    expect(screen.getByTestId("collect-cash-button")).toBeOnTheScreen();
  });

  it("satış yetkisi ve teknisyen rolü yoksa nakit & ciro bölümü yok", async () => {
    mockCashEndpoints();
    await renderWithProviders(
      <GeneralTab sn={SN} detail={detail()} access={access({ sales: false, isTech: false })} refreshing={false} onRefresh={noop} />
    );
    expect(await screen.findByText("Normal mod")).toBeOnTheScreen();
    expect(screen.queryByTestId("cash-section")).toBeNull();
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

describe("CashSection (Genel sekmesinin altı)", () => {
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

    await renderWithProviders(<CashSection sn={SN} detail={detail()} access={access()} />);

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

    await renderWithProviders(<CashSection sn={SN} detail={detail()} access={access()} />);

    expect(await screen.findByText("Bu POS cihazı için nakit toplama yapılmamış.")).toBeOnTheScreen();
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
      <CashSection sn={SN} detail={detail()} access={access({ manageSettings: false })} />
    );
    expect(await screen.findByText("Bu POS cihazı için ciro sayımı yapılmamış.")).toBeOnTheScreen();
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

    await renderWithProviders(<CashSection sn={SN} detail={detail()} access={access()} />);
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

    await renderWithProviders(<CashSection sn={SN} detail={detail()} access={access()} />);
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
      <CashSection sn={SN} detail={detail()} access={access({ sales: false, manageSettings: false, isTech: true })} />
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
      <CashSection sn={SN} detail={detail()} access={access({ sales: false, manageSettings: false })} />
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

    await renderWithProviders(<CashSection sn={SN} detail={detail()} access={access()} />);

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

/* ------------------------------------------------ Dijital fiş + uzaktan iade */

describe("İşlem detayı · fiş ve uzaktan iade (web ile aynı)", () => {
  const receiptUrl = `${base}/transactions/5/receipt/`;
  const refundUrl = `${base}/transactions/5/refund/`;
  const saleTx = normalizeDeviceTransaction({ id: 5, pt_id: "TX5", pt_datetime: localIso(2026, 11, 18, 8, 15), amount: "45.00", pt_type: 1, status: true });
  const state = (o: Record<string, unknown> = {}) => ({
    ok: true,
    tx: { id: 5, amount: "45,00", status: true, iptal_no: null, datetime: "18.11.2026 08:15:00" },
    receipts: [{ kind: "sale", label: "Satış fişi", text: "VENNEX OTOMAT\nTUTAR: 45,00 TL", created_at: "18.11.2026 08:15:02" }],
    has_sale_receipt: true,
    refund: null,
    can_refund: true,
    refund_block: "",
    ...o,
  });
  const req = (o: Record<string, unknown> = {}) => ({
    id: "r1", status: "sent", label: "İade sürüyor", mode: "auto", executed_mode: null, executed_label: "",
    waiting_card: false, card_seconds_left: 0, reject_reason: null, error_code: null, message: null,
    requested_by: "mobile:demo", created_at: "18.11.2026 08:20:00", poll: true, ...o,
  });

  it("vennexRN değilse fiş/iade bölümü yok ve istek atılmaz", async () => {
    await renderWithProviders(<TransactionDetailSheet tx={saleTx} onClose={noop} sn={SN} receiptsEnabled={false} />);
    expect(screen.queryByTestId("tx-receipt-refund")).toBeNull();
    expect(mock.history.get.some((r) => r.url === receiptUrl)).toBe(false);
  });

  it("fiş metnini gösterir ve paylaşım menüsünü açar", async () => {
    const { Share } = jest.requireActual<typeof import("react-native")>("react-native");
    const share = jest.spyOn(Share, "share").mockResolvedValue({ action: "sharedAction" });
    mock.onGet(receiptUrl).reply(200, state());
    await renderWithProviders(<TransactionDetailSheet tx={saleTx} onClose={noop} sn={SN} receiptsEnabled />);
    expect(await screen.findByText("Satış fişi")).toBeOnTheScreen();
    expect(screen.getByText("VENNEX OTOMAT\nTUTAR: 45,00 TL")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("receipt-share-sale"));
    expect(share).toHaveBeenCalledWith({ title: "Fiş · Satış fişi", message: "VENNEX OTOMAT\nTUTAR: 45,00 TL" });
    share.mockRestore();
  });

  it("iade: onaydan sonra POST, sonuç web gibi sorgulanarak izlenir", async () => {
    mock.onGet(receiptUrl).replyOnce(200, state());
    mock.onPost(refundUrl).reply(200, { ...state({ refund: req(), can_refund: false, refund_block: "Bu işlem için açık bir iade isteği var." }), message: "İade isteği cihaza gönderildi." });
    mock.onGet(receiptUrl).reply(200, state({ refund: req({ status: "ok", label: "Başarılı · Kartsız iade", poll: false }), can_refund: false, refund_block: "İşlem iade edilmiş." }));
    await renderWithProviders(<TransactionDetailSheet tx={saleTx} onClose={noop} sn={SN} receiptsEnabled />);

    await fireEvent.press(await screen.findByTestId("tx-refund"));
    expect(mock.history.post).toHaveLength(0); // onay olmadan istek yok
    expect(screen.getByText("Bu işlem geri alınamaz.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.post.map((r) => r.url)).toEqual([refundUrl]));
    expect(await screen.findByText("İade sürüyor")).toBeOnTheScreen();
    expect(await screen.findByText("Başarılı · Kartsız iade", {}, { timeout: 5000 })).toBeOnTheScreen();
    expect(screen.getByTestId("tx-refund-block")).toHaveTextContent("İşlem iade edilmiş.");
  }, 15000);

  it("kart bekleniyorsa uyarı ve geri sayım; kural dışıysa sunucu mesajı", async () => {
    mock.onGet(receiptUrl).reply(200, state({ refund: req({ status: "accepted", label: "Kart bekleniyor", waiting_card: true, card_seconds_left: 42, poll: false }), can_refund: false, refund_block: "Bu işlem için açık bir iade isteği var." }));
    await renderWithProviders(<TransactionDetailSheet tx={saleTx} onClose={noop} sn={SN} receiptsEnabled />);
    expect(await screen.findByText(/okutmalı.*42 sn/)).toBeOnTheScreen();
    expect(screen.queryByTestId("tx-refund")).toBeNull();
  });
});

/* --------------------------------------------- Satışlar · web mobil kartları */

describe("SalesTab işlem kartı (web mobil görünümü)", () => {
  it("kart no + ödeme tipi + okuma şekli, durum nedeni, saniyeli tarih, ürün no ve son iade durumu", async () => {
    const { SalesTab } = jest.requireActual<typeof import("@/screens/devices/detail/tabs/SalesTab")>("@/screens/devices/detail/tabs/SalesTab");
    mock.onGet(`${base}/transactions/`).reply(200, {
      count: 2,
      page: 1,
      num_pages: 1,
      summary: { total: 2, success: 1, failed: 1, revenue: 35 },
      receipts_refund_enabled: true,
      results: [
        { id: 1, pt_id: "A", pt_datetime: localIso(2026, 11, 19, 17, 31, 42), amount: "35.00", pt_type: 1, status: true, entry_mode: 7, product_no: 8708, pt_pan: "4074", display_name: "Sade Kahve", rr_show: true, refund_label: "" },
        { id: 2, pt_id: "B", pt_datetime: localIso(2026, 11, 19, 17, 20, 5), amount: "20.00", pt_type: 1, status: false, iptalNo: 3, product_no: 65535, pt_pan: "1111", display_name: "Su", rr_show: true, refund_label: "İade başarısız" },
      ],
    });
    await renderWithProviders(<SalesTab sn={SN} />);
    const card = await screen.findByTestId("tx-row-1");
    expect(within(card).getByText("4074")).toBeOnTheScreen();
    expect(within(card).getByText("Kredi Kartı")).toBeOnTheScreen();
    expect(within(card).getByText("Temassız")).toBeOnTheScreen();
    expect(within(card).getByText("Başarılı")).toBeOnTheScreen();
    expect(within(card).getByText("19.11.2026 17:31:42")).toBeOnTheScreen();
    expect(within(card).getByText("Ürün No 8708")).toBeOnTheScreen();
    expect(within(card).queryByText("Detaylar")).toBeNull(); // karta dokunmak detayı açar
    const failed = screen.getByTestId("tx-row-2");
    expect(within(failed).getByText("Teknik Hata")).toBeOnTheScreen();
    expect(within(failed).queryByText(/Ürün No/)).toBeNull(); // 65535 gösterilmez (web)
    expect(within(failed).getByText("İade başarısız")).toBeOnTheScreen();
  });
});
