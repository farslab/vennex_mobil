import React from "react";
import MockAdapter from "axios-mock-adapter";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { renderWithProviders } from "@/test/utils";
import CardsScreen from "@/screens/cards/CardsScreen";
import { cardJson, cardPage, FULL, loginAs, NO_BALANCE } from "./fixtures";

const mockNavigate = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: mockNavigate, goBack: jest.fn(), setOptions: jest.fn() }),
  useFocusEffect: jest.fn(),
  useIsFocused: () => true,
}));

const cardGets = (mock: MockAdapter) => mock.history.get.filter((r) => r.url === "/cards/");

describe("Personel kartları sekmesi", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mockNavigate.mockReset();
    loginAs(FULL);
  });
  afterEach(() => mock.restore());

  it("ilk açılışta yalnız kart listesini çeker (diğer sekmeler tembel)", async () => {
    mock.onGet("/cards/").reply(200, cardPage([1, 2]));
    await renderWithProviders(<CardsScreen />);
    expect(await screen.findByText("Ad1 Soyad")).toBeOnTheScreen();
    expect(screen.getByText("Aktif (12)")).toBeOnTheScreen();
    expect(screen.getByText("Onay bekleyen (2)")).toBeOnTheScreen();
    const urls = mock.history.get.map((r) => r.url).filter((u) => u !== "/app/config/");
    expect(urls.every((u) => u === "/cards/")).toBe(true);
    expect(cardGets(mock)[0].params).toEqual({ status: "active", page: 1 });
  });

  it("sekme değişince yalnız o sekmenin verisi çekilir", async () => {
    mock.onGet("/cards/").reply(200, cardPage([1]));
    mock.onGet("/card-groups/").reply(200, { results: [{ id: 1, name: "Ofis", active_cards_count: 3, pos_device_count: 2, created_at: null }] });
    await renderWithProviders(<CardsScreen />);
    await screen.findByText("Ad1 Soyad");
    await fireEvent.press(screen.getByText("Kart Grupları"));
    expect(await screen.findByText("3 aktif kart · 2 POS cihazı")).toBeOnTheScreen();
    expect(mock.history.get.some((r) => r.url === "/recurring-balance/")).toBe(false);
  });

  it("arama debounce ile tek q isteği gönderir", async () => {
    mock.onGet("/cards/").reply(200, cardPage([1]));
    await renderWithProviders(<CardsScreen />);
    await screen.findByText("Ad1 Soyad");
    const input = screen.getByTestId("card-search");
    await fireEvent.changeText(input, "a");
    await fireEvent.changeText(input, "ay");
    await fireEvent.changeText(input, "ayş");
    await waitFor(() => expect(cardGets(mock).some((r) => r.params.q === "ayş")).toBe(true), { timeout: 2000 });
    const qs = cardGets(mock).map((r) => r.params.q).filter(Boolean);
    expect(qs).toEqual(["ayş"]);
    // Arama sırasında input DOM'da kalır
    expect(screen.getByTestId("card-search")).toBeOnTheScreen();
  });

  it("liste sonunda sonraki sayfayı ister", async () => {
    mock.onGet("/cards/", { params: { status: "active", page: 1 } }).reply(200, cardPage([1, 2], { count: 32, num_pages: 2 }));
    mock.onGet("/cards/", { params: { status: "active", page: 2 } }).reply(200, cardPage([3], { count: 32, page: 2, num_pages: 2 }));
    await renderWithProviders(<CardsScreen />);
    await screen.findByText("Ad1 Soyad");
    await fireEvent(screen.getByTestId("card-list"), "onEndReached");
    expect(await screen.findByText("Ad3 Soyad")).toBeOnTheScreen();
    expect(cardGets(mock).map((r) => r.params.page)).toEqual([1, 2]);
  });

  it("satıra basınca kart detayına gider", async () => {
    mock.onGet("/cards/").reply(200, cardPage([5]));
    await renderWithProviders(<CardsScreen />);
    await fireEvent.press(await screen.findByTestId("card-row-5"));
    expect(mockNavigate).toHaveBeenCalledWith("CardDetail", { id: 5 });
  });

  it("bekleyen kartı onaylar (ters UID seçeneğiyle)", async () => {
    mock.onGet("/cards/").reply(200, { ...cardPage([]), results: [cardJson(9, { is_active: false })] });
    mock.onPost("/cards/9/approve/").reply(200, cardJson(9));
    await renderWithProviders(<CardsScreen />);
    await fireEvent.press(await screen.findByText("Onay bekleyen (2)"));
    await fireEvent.press(await screen.findByTestId("approve-9"));
    expect(screen.getByText("Kartı onayla")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("approve-reverse-uid"));
    expect(screen.getByText("09 BB AA 04")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("approve-confirm"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(mock.history.post[0].url).toBe("/cards/9/approve/");
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ reverse_uid: true });
  });

  it("bekleyen kartı onaydan sonra reddeder", async () => {
    mock.onGet("/cards/").reply(200, { ...cardPage([]), results: [cardJson(9, { is_active: false })] });
    mock.onPost("/cards/9/reject/").reply(200, { detail: "Kart reddedildi." });
    await renderWithProviders(<CardsScreen />);
    await fireEvent.press(await screen.findByText("Onay bekleyen (2)"));
    await fireEvent.press(await screen.findByTestId("reject-9"));
    expect(screen.getByText("Bu işlem geri alınamaz.")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.post.map((r) => r.url)).toEqual(["/cards/9/reject/"]));
  });

  it("tümünü reddet: sayı özeti gösterir ve tek istek atar", async () => {
    mock.onGet("/cards/").reply(200, { ...cardPage([]), pending_count: 7, results: [cardJson(9, { is_active: false })] });
    mock.onPost("/cards/reject-all-pending/").reply(200, { detail: "7 bekleyen kart silindi.", count: 7 });
    await renderWithProviders(<CardsScreen />);
    await fireEvent.press(await screen.findByText("Onay bekleyen (7)"));
    await fireEvent.press(await screen.findByTestId("card-reject-all"));
    expect(screen.getByText("7 kart (tümü)")).toBeOnTheScreen();
    expect(screen.getByText(/TÜM kart kayıtları silinir; arama veya grup filtresi uygulanmaz/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.post.map((r) => r.url)).toEqual(["/cards/reject-all-pending/"]));
  });

  it("tümünü reddet: arama filtresi varken pasif ve açıklama gösterilir (backend filtreyi uygulamaz)", async () => {
    mock.onGet("/cards/").reply(200, { ...cardPage([]), pending_count: 1, results: [cardJson(9, { is_active: false })] });
    await renderWithProviders(<CardsScreen />);
    await fireEvent.press(await screen.findByText("Onay bekleyen (1)"));
    expect(await screen.findByTestId("card-reject-all")).toBeEnabled();
    expect(screen.queryByTestId("card-reject-all-hint")).toBeNull();

    await fireEvent.changeText(screen.getByTestId("card-search"), "ayşe");
    expect(screen.getByTestId("card-reject-all")).toBeDisabled();
    expect(screen.getByText("Filtre varken kullanılamaz; tüm bekleyen kartları reddeder.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("card-reject-all"));
    expect(screen.queryByText("Tüm bekleyen kartları reddet")).toBeNull();
    expect(mock.history.post).toHaveLength(0);

    // Filtre kalkınca yeniden kullanılabilir
    await fireEvent.changeText(screen.getByTestId("card-search"), "");
    await waitFor(() => expect(screen.getByTestId("card-reject-all")).toBeEnabled());
  });

  it("seçim toplamı yenilemeden sonra güncel bakiyeyi kullanır (eski kopya değil)", async () => {
    mock.onGet("/cards/").replyOnce(200, { ...cardPage([]), results: [cardJson(1, { balance: "10.00" }), cardJson(2, { balance: "5.00" })] });
    mock.onGet("/cards/").reply(200, { ...cardPage([]), results: [cardJson(1, { balance: "70.00" }), cardJson(2, { balance: "5.00" })] });
    const r = await renderWithProviders(<CardsScreen />);
    await fireEvent(await screen.findByTestId("card-row-1"), "onLongPress");
    await fireEvent.press(screen.getByTestId("card-row-2"));
    expect(screen.getByText("Toplam bakiye ₺15,00")).toBeOnTheScreen();

    // Yenileme (çekip bırakma / başka ekrandaki mutasyon sonrası invalidate)
    await act(() => r.queryClient.invalidateQueries({ queryKey: ["cards"] }));
    await waitFor(() => expect(cardGets(mock).length).toBeGreaterThanOrEqual(2));
    expect(await screen.findByText("Toplam bakiye ₺75,00")).toBeOnTheScreen();
    expect(screen.getByText("2 kart seçili")).toBeOnTheScreen();
  });

  it("toplu bakiye: özet doğru, tek istek, çift dokunmada ikinci istek yok", async () => {
    mock.onGet("/cards/").reply(200, {
      ...cardPage([]),
      results: [cardJson(1, { balance: "10.00" }), cardJson(2, { balance: "40.00" })],
    });
    mock.onPost("/cards/bulk/balance/").reply(
      () => new Promise((resolve) => setTimeout(() => resolve([200, { detail: "2 kart güncellendi.", count: 2 }]), 30))
    );
    await renderWithProviders(<CardsScreen />);
    await fireEvent(await screen.findByTestId("card-row-1"), "onLongPress");
    await fireEvent.press(screen.getByTestId("card-row-2"));
    expect(screen.getByText("2 kart seçili")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("bulk-balance"));
    await fireEvent.press(screen.getByText("Düş"));
    await fireEvent.changeText(screen.getByTestId("balance-amount"), "15,5");
    await fireEvent.press(screen.getByTestId("balance-continue"));

    // Özet: kart sayısı, işlem, tutar, mevcut ve yeni toplam (düşmede taban 0: 0 + 24,50)
    expect(screen.getByText("Bakiye işlemini onayla")).toBeOnTheScreen();
    expect(screen.getByText("2 kart")).toBeOnTheScreen();
    expect(screen.getByText("Bakiye düş")).toBeOnTheScreen();
    expect(screen.getByText("₺15,50")).toBeOnTheScreen();
    expect(screen.getByText("₺50,00")).toBeOnTheScreen();
    expect(screen.getByText("₺24,50")).toBeOnTheScreen();

    const confirm = screen.getByTestId("confirm-sheet-confirm");
    await fireEvent.press(confirm);
    await fireEvent.press(confirm); // ikinci dokunuş: istek sürerken kilitli
    await waitFor(() => expect(screen.queryByText("Bakiye işlemini onayla")).toBeNull());
    expect(mock.history.post).toHaveLength(1);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ card_ids: [1, 2], operation: "subtract", amount: "15.50" });
  });

  it("tutar alan hatası backend'den gelince input altında gösterilir", async () => {
    mock.onGet("/cards/").reply(200, cardPage([1]));
    mock.onPost("/cards/bulk/balance/").reply(400, { amount: ["En fazla 10 hane olmalı."] });
    await renderWithProviders(<CardsScreen />);
    await fireEvent(await screen.findByTestId("card-row-1"), "onLongPress");
    await fireEvent.press(screen.getByTestId("bulk-balance"));
    await fireEvent.changeText(screen.getByTestId("balance-amount"), "50");
    await fireEvent.press(screen.getByTestId("balance-continue"));
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    expect(await screen.findByText("En fazla 10 hane olmalı.")).toBeOnTheScreen();
    expect(screen.queryByText("Bakiye işlemini onayla")).toBeNull();
  });

  it("geçersiz tutar istek atmadan engellenir", async () => {
    mock.onGet("/cards/").reply(200, cardPage([1]));
    await renderWithProviders(<CardsScreen />);
    await fireEvent(await screen.findByTestId("card-row-1"), "onLongPress");
    await fireEvent.press(screen.getByTestId("bulk-balance"));
    await fireEvent.changeText(screen.getByTestId("balance-amount"), "abc");
    await fireEvent.press(screen.getByTestId("balance-continue"));
    expect(screen.getByText("Geçerli bir tutar girin (ör. 150 veya 150,50).")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);
  });

  it("change_card_balance yoksa bakiye aksiyonları görünmez", async () => {
    loginAs(NO_BALANCE, "tech");
    mock.onGet("/cards/").reply(200, cardPage([1]));
    await renderWithProviders(<CardsScreen />);
    await fireEvent(await screen.findByTestId("card-row-1"), "onLongPress");
    expect(screen.queryByTestId("bulk-balance")).toBeNull();
    expect(screen.getByTestId("bulk-groups")).toBeOnTheScreen();
    await fireEvent.press(screen.getByLabelText("Seçim modundan çık"));
    await fireEvent.press(screen.getByTestId("card-create"));
    expect(screen.queryByTestId("card-form-balance")).toBeNull();
    expect(screen.getByText("Bakiye değiştirme yetkiniz olmadığından kart 0 ₺ bakiye ile açılır.")).toBeOnTheScreen();
  });

  it("manage_personel_card yoksa modül kilitli ve istek atılmaz", async () => {
    loginAs(["tech"], "tech");
    await renderWithProviders(<CardsScreen />);
    expect(screen.getByText("Personel kart yetkiniz yok")).toBeOnTheScreen();
    // Kart verisi için hiç istek yok (yalnız uygulama geneli yapılandırma)
    expect(mock.history.get.filter((r) => r.url !== "/app/config/")).toHaveLength(0);
  });

  it("toplu silme geri alınamaz uyarısı ve bakiye özeti gösterir", async () => {
    mock.onGet("/cards/").reply(200, { ...cardPage([]), results: [cardJson(1, { balance: "12.00" }), cardJson(2, { balance: "3.00" })] });
    mock.onPost("/cards/bulk/delete/").reply(200, { detail: "1 kart silindi.", count: 1 });
    await renderWithProviders(<CardsScreen />);
    await fireEvent(await screen.findByTestId("card-row-1"), "onLongPress");
    await fireEvent.press(screen.getByTestId("card-row-2"));
    await fireEvent.press(screen.getByTestId("bulk-delete"));
    expect(screen.getByText("Bu işlem geri alınamaz.")).toBeOnTheScreen();
    expect(screen.getAllByText("₺15,00").length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ card_ids: [1, 2] });
  });

  it("kart oluşturma: backend alan hatası ilgili inputta gösterilir, form korunur", async () => {
    mock.onGet("/cards/").reply(200, cardPage([1]));
    mock.onGet("/card-groups/").reply(200, { results: [] });
    mock.onPost("/cards/").reply(400, { uid: ["Bu alanın 50 karakterden fazla karakter içermediğinden emin olun."] });
    await renderWithProviders(<CardsScreen />);
    await screen.findByText("Ad1 Soyad");
    await fireEvent.press(screen.getByTestId("card-create"));
    await fireEvent.changeText(screen.getByTestId("card-form-uid"), "04 11 22 33");
    await fireEvent.changeText(screen.getByTestId("card-form-first-name"), "Deniz");
    await fireEvent.press(screen.getByTestId("card-form-submit"));
    expect(await screen.findByText("Bu alanın 50 karakterden fazla karakter içermediğinden emin olun.")).toBeOnTheScreen();
    expect(screen.getByTestId("card-form-first-name").props.value).toBe("Deniz");
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      uid: "04 11 22 33",
      first_name: "Deniz",
      last_name: null,
      customer_no: 0,
      group_ids: [],
    });
  });

  it("başlangıç bakiyeli kart oluşturma önce onay özeti ister ve string tutar gönderir", async () => {
    mock.onGet("/cards/").reply(200, cardPage([1]));
    mock.onGet("/card-groups/").reply(200, { results: [] });
    mock.onPost("/cards/").reply(201, cardJson(77));
    await renderWithProviders(<CardsScreen />);
    await screen.findByText("Ad1 Soyad");
    await fireEvent.press(screen.getByTestId("card-create"));
    await fireEvent.changeText(screen.getByTestId("card-form-uid"), "04 11 22 33");
    await fireEvent.changeText(screen.getByTestId("card-form-balance"), "250");
    await fireEvent.press(screen.getByTestId("card-form-submit"));
    expect(mock.history.post).toHaveLength(0);
    const sheet = screen.getByText("Başlangıç bakiyesini onayla");
    expect(sheet).toBeOnTheScreen();
    expect(screen.getByText("₺250,00")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data).balance).toBe("250.00");
  });

  it("liste hatasında tekrar dene gösterir", async () => {
    mock.onGet("/cards/").replyOnce(500, { detail: "Sunucu hatası" });
    mock.onGet("/cards/").reply(200, cardPage([1]));
    await renderWithProviders(<CardsScreen />);
    expect(await screen.findByText(/Sunucu hatası/)).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Tekrar dene"));
    expect(await screen.findByText("Ad1 Soyad")).toBeOnTheScreen();
    expect(within(screen.getByTestId("card-list")).getByText("Ad1 Soyad")).toBeOnTheScreen();
  });
});
