import React from "react";
import { Linking } from "react-native";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import NotificationsScreen from "@/screens/notifications/NotificationsScreen";
import { useAuthStore } from "@/store/authStore";
import { makeUser, renderWithProviders } from "@/test/utils";
import type { NotificationItem } from "@/types/notifications";

// İkon fontu yükleyicisi (expo-font/expo-asset) testte gereksiz
jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

const mockNavigate = jest.fn();
const mockSetParams = jest.fn();
let mockRouteParams: Record<string, unknown> | undefined;
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), setOptions: jest.fn(), setParams: mockSetParams }),
  useRoute: () => ({ key: "n", name: "Notifications", params: mockRouteParams }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));

const notification = (overrides: Partial<NotificationItem>): NotificationItem => ({
  id: 1,
  timestamp: "2026-11-18T10:30:00Z",
  verb: "Bildirim",
  description: "Bildirim",
  unread: false,
  actor_str: null,
  target_str: null,
  data: null,
  ...overrides,
});

const page = (results: NotificationItem[], unread_count = results.filter((n) => n.unread).length, extra = {}) => ({
  count: results.length,
  page: 1,
  num_pages: 1,
  unread_count,
  results,
  ...extra,
});

const listGets = (mock: MockAdapter) => mock.history.get.filter((r) => r.url === "/notifications/");

describe("NotificationsScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet("/notifications/unread-count/").reply(200, { unread_count: 0 });
    useAuthStore.setState({ user: makeUser({ permissions: ["owner", "view_sales", "manage_personel_card"] }) });
  });
  afterEach(() => {
    mock.restore();
  });

  it("yüklenirken iskelet, bildirim yoksa boş durum gösterir", async () => {
    let resolve: (v: [number, unknown]) => void = () => {};
    mock.onGet("/notifications/").reply(() => new Promise((r) => (resolve = r)));
    await renderWithProviders(<NotificationsScreen />);
    expect(screen.getByLabelText("Yükleniyor")).toBeOnTheScreen();

    resolve([200, page([])]);
    expect(await screen.findByText("Henüz bildirim yok")).toBeOnTheScreen();
    expect(screen.queryByText("Tümünü okundu işaretle")).toBeNull();
  });

  it("API hatasında mesaj ve tekrar dene; tekrar dene yeniden ister", async () => {
    mock.onGet("/notifications/").replyOnce(500, { detail: "Sunucu hatası" });
    mock.onGet("/notifications/").reply(200, page([notification({ id: 5, description: "Kurtarıldı" })]));

    await renderWithProviders(<NotificationsScreen />);
    expect(await screen.findByText("Sunucu hatası")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Tekrar dene"));
    expect(await screen.findByText("Kurtarıldı")).toBeOnTheScreen();
  });

  it("ilk sayfayı page=1 ile ister; okunmamış filtresi unread=true gönderir", async () => {
    mock.onGet("/notifications/").reply(200, page([notification({ id: 1, description: "A", unread: true })]));
    await renderWithProviders(<NotificationsScreen />);
    await screen.findByText("A");
    expect(listGets(mock)[0].params).toEqual({ page: 1 });

    await fireEvent.press(screen.getByText("Okunmamış (1)"));
    await waitFor(() => expect(listGets(mock)).toHaveLength(2));
    expect(listGets(mock)[1].params).toEqual({ page: 1, unread: "true" });
  });

  it("okunmamış bildirime basınca okundu işaretler ve tam metni alt sayfada açar; POS cihazına düğmeyle gider", async () => {
    const long = "Ödeme hatası! UN20W000559 seri numaralı POS Cihazı cihazında ürün adı: DEMO Cappuccino, ürün numarası: 3, otomat fiyatı: 110 TL, sistem fiyatı: 25.00 TL. Lütfen kontrol edin.";
    mock.onGet("/notifications/").reply(
      200,
      page([
        notification({
          id: 11,
          verb: "Ödeme hatası",
          description: long,
          unread: true,
          actor_str: "UN20W000559",
          data: { url: "/pos-cihazi/UN20W000559/" },
        }),
        notification({ id: 12, description: "Rapor hazır", unread: false }),
      ])
    );
    mock.onPost("/notifications/11/read/").reply(200, { detail: "Okundu işaretlendi." });

    await renderWithProviders(<NotificationsScreen />);
    await fireEvent.press(await screen.findByText(long));

    // gezinmez; alt sayfada başlık + metnin tamamı
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(await screen.findByTestId("notification-sheet-body")).toHaveTextContent(long);
    expect(screen.getAllByText("Ödeme hatası").length).toBeGreaterThan(0);
    await waitFor(() => expect(mock.history.post.map((r) => r.url)).toEqual(["/notifications/11/read/"]));
    await waitFor(() => expect(listGets(mock).length).toBe(2));

    await fireEvent.press(screen.getByTestId("notification-open-target"));
    expect(mockNavigate).toHaveBeenCalledWith("DeviceDetail", { sn: "UN20W000559" });
  });

  it("okunmuş ve hedefsiz bildirim: istek atmaz, alt sayfa açılır, ilgili ekran düğmesi yok", async () => {
    mock.onGet("/notifications/").reply(200, page([notification({ id: 12, verb: "Duyuru", description: "Sistem bakımı yarın 02:00'de.", unread: false })]));
    await renderWithProviders(<NotificationsScreen />);
    await fireEvent.press(await screen.findByText("Sistem bakımı yarın 02:00'de."));
    expect(await screen.findByTestId("notification-sheet-body")).toHaveTextContent("Sistem bakımı yarın 02:00'de.");
    expect(screen.queryByTestId("notification-open-target")).toBeNull();
    expect(mock.history.post).toHaveLength(0);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("okunmuş ama hedefi olan bildirim: okundu isteği atmaz; 'Kartı aç' ile kart detayına gider", async () => {
    mock.onGet("/notifications/").reply(
      200,
      page([notification({ id: 13, description: "Kart onayı", data: { event: "card.pending", card_id: "42", uid: "AB" } })])
    );
    await renderWithProviders(<NotificationsScreen />);
    await fireEvent.press(await screen.findByText("Kart onayı"));
    const open = await screen.findByTestId("notification-open-target");
    expect(open).toHaveTextContent("Kartı aç");
    await fireEvent.press(open);
    expect(mockNavigate).toHaveBeenCalledWith("CardDetail", { id: 42 });
    expect(mock.history.post).toHaveLength(0);
  });

  it("web bağlantılı bildirim: alan adını gösterir, 'Bağlantıyı aç' tarayıcıda açar, uygulama içinde gezinmez", async () => {
    const openURL = jest.spyOn(Linking, "openURL").mockResolvedValue(true);
    mock.onGet("/notifications/").reply(
      200,
      page([notification({ id: 14, verb: "Sistem Bakımı", description: "Bakım duyurusu", data: { sent_by_admin: true, url: "https://sp.serpetpay.com/duyuru" } })])
    );
    await renderWithProviders(<NotificationsScreen />);
    await fireEvent.press(await screen.findByText("Bakım duyurusu"));
    expect(await screen.findByTestId("notification-link")).toHaveTextContent("sp.serpetpay.com");
    expect(screen.queryByTestId("notification-open-target")).toBeNull();
    await fireEvent.press(screen.getByTestId("notification-open-link"));
    expect(openURL).toHaveBeenCalledWith("https://sp.serpetpay.com/duyuru");
    expect(mockNavigate).not.toHaveBeenCalled();
    openURL.mockRestore();
  });

  it("push'tan gelindiyse (open) bildirimin tamamı alt sayfada açılır, okundu işaretlenir; kapatınca param temizlenir", async () => {
    mockRouteParams = { open: { id: 77, title: "Bakım", body: "Gece 02:00-06:00 bakım var.", url: "https://sp.serpetpay.com/duyuru" } };
    mock.onGet("/notifications/").reply(200, page([]));
    mock.onPost("/notifications/77/read/").reply(200, {});
    await renderWithProviders(<NotificationsScreen />);
    expect(await screen.findByTestId("notification-sheet-body")).toHaveTextContent("Gece 02:00-06:00 bakım var.");
    expect(screen.getByTestId("notification-sheet-sender")).toHaveTextContent("Vennex");
    expect(screen.getByTestId("notification-link")).toHaveTextContent("sp.serpetpay.com");
    await waitFor(() => expect(mock.history.post.map((r) => r.url)).toContain("/notifications/77/read/"));
    expect(mockSetParams).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByLabelText("Kapat"));
    expect(mockSetParams).toHaveBeenCalledWith({ open: undefined });
    mockRouteParams = undefined;
  });

  it("'Tümünü okundu işaretle' istek sürerken kilitlenir ve read-all çağırır", async () => {
    mock.onGet("/notifications/").reply(200, page([notification({ id: 11, description: "Yeni kart", unread: true })]));
    let resolve: (v: [number, unknown]) => void = () => {};
    mock.onPost("/notifications/read-all/").reply(() => new Promise((r) => (resolve = r)));

    await renderWithProviders(<NotificationsScreen />);
    await screen.findByText("Yeni kart");
    await fireEvent.press(screen.getByTestId("mark-all-read"));

    await waitFor(() => expect(screen.getByTestId("mark-all-read")).toBeDisabled());
    await fireEvent.press(screen.getByTestId("mark-all-read"));
    expect(mock.history.post.map((r) => r.url)).toEqual(["/notifications/read-all/"]);

    resolve([200, { detail: "1 bildirim okundu işaretlendi.", count: 1 }]);
    await waitFor(() => expect(listGets(mock).length).toBe(2));
  });
});
