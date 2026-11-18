/**
 * Kart formu ve bakiye işlemi sayfaları — doğrudan bileşen testleri.
 * Finansal kurallar: onay özeti, onaysız istek yok, çift dokunmada tek istek, Türkçe tutar girişi.
 */
import React from "react";
import { Alert, type AlertButton } from "react-native";
import MockAdapter from "axios-mock-adapter";
import type { QueryClient } from "@tanstack/react-query";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { normalizeCard } from "@/api/cards";
import { canChangeCardBalance } from "@/auth/permissions";
import { useAuthStore } from "@/store/authStore";
import { useToastStore } from "@/design-system";
import { renderWithProviders } from "@/test/utils";
import type { PersonnelCard } from "@/types/cards";
import { BalanceOperationSheet } from "@/screens/cards/components/BalanceOperationSheet";
import { CardFormSheet } from "@/screens/cards/components/CardFormSheet";
import { cardJson, FULL, loginAs } from "./fixtures";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));
// Paralel koşuda ilk testin soğuk modül dönüşümü 5 sn varsayılanını aşabiliyor
jest.setTimeout(20_000);

const card = (id: number, over: Record<string, unknown> = {}): PersonnelCard => normalizeCard(cardJson(id, over));
const toastMessage = () => useToastStore.getState().current?.message ?? null;
/** Gecikmeli yanıt: istek sürerken ikinci dokunuşu sınamak için */
const delayed = (status: number, data: unknown, ms = 30) => () =>
  new Promise<[number, unknown]>((resolve) => setTimeout(() => resolve([status, data]), ms));
const GROUPS = {
  results: [
    { id: 1, name: "Ofis", active_cards_count: 3, pos_device_count: 1, created_at: null },
    { id: 2, name: "Depo", active_cards_count: 1, pos_device_count: 1, created_at: null },
  ],
};

/** Seçim alanı gruplar yüklenirken pasif: önce yüklemenin bitmesini bekle */
const waitGroupsLoaded = () => waitFor(() => expect(screen.queryByText("Yükleniyor…")).toBeNull());

let alertSpy: jest.SpyInstance;
/** Son Alert.alert çağrısındaki "Çık" butonuna basar */
function pressDiscard() {
  const buttons = alertSpy.mock.calls[alertSpy.mock.calls.length - 1][2] as AlertButton[];
  buttons.find((b) => b.text === "Çık")?.onPress?.();
}

/* ------------------------------------------------------------------ Bakiye */

describe("BalanceOperationSheet", () => {
  let mock: MockAdapter;
  const onClose = jest.fn();
  const onDone = jest.fn();

  /** Gerçek kullanım gibi: kapalı bağlanır, sonra açılır (useOnOpen sıfırlaması çalışsın) */
  async function open(cards: PersonnelCard[]) {
    const el = (visible: boolean) => <BalanceOperationSheet visible={visible} cards={cards} onClose={onClose} onDone={onDone} />;
    const r = await renderWithProviders(el(false));
    await r.rerender(el(true));
    return r;
  }

  async function fillAndContinue(amount: string, op?: "Ekle" | "Düş" | "Ayarla") {
    if (op) await fireEvent.press(screen.getByText(op));
    await fireEvent.changeText(screen.getByTestId("balance-amount"), amount);
    await fireEvent.press(screen.getByTestId("balance-continue"));
  }

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    loginAs(FULL);
    useToastStore.setState({ current: null });
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });
  afterEach(() => {
    mock.restore();
    alertSpy.mockRestore();
  });

  it("tek kart ekleme: '12,5' girişi özetle onaylanır ve 12.50 olarak gönderilir", async () => {
    mock.onPost("/cards/bulk/balance/").reply(200, { detail: "1 kart güncellendi.", count: 1 });
    await open([card(1, { balance: "100.00" })]);
    expect(screen.getByText("Bakiye işlemi")).toBeOnTheScreen();

    await fireEvent.changeText(screen.getByTestId("balance-amount"), "12,5");
    expect(screen.getByText("Kartın bakiyesine ₺12,50 eklenir.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("balance-continue"));

    // Onay ekranı + özet; henüz istek yok
    expect(screen.getByText("Bakiye işlemini onayla")).toBeOnTheScreen();
    expect(screen.getByText("Bakiye ekle")).toBeOnTheScreen();
    expect(screen.getByText("₺12,50")).toBeOnTheScreen();
    expect(screen.getByText("Mevcut bakiye")).toBeOnTheScreen();
    expect(screen.getByText("₺100,00")).toBeOnTheScreen();
    expect(screen.getByText("Yeni bakiye")).toBeOnTheScreen();
    expect(screen.getByText("₺112,50")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);

    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onDone).toHaveBeenCalledTimes(1);
    expect(mock.history.post).toHaveLength(1);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ card_ids: [1], operation: "add", amount: "12.50" });
    expect(toastMessage()).toBe("1 kartın bakiyesi güncellendi.");
  });

  it("çoklu düşme: kart sayısı ve 0 tabanlı yeni toplam özetlenir, subtract gövdesi gider", async () => {
    mock.onPost("/cards/bulk/balance/").reply(200, { detail: "3 kart güncellendi.", count: 3 });
    await open([card(1, { balance: "5.00" }), card(2, { balance: "30.00" }), card(3, { balance: "100.00" })]);
    expect(screen.getByText("Toplu bakiye işlemi")).toBeOnTheScreen();
    expect(screen.getByText("3 kart seçili")).toBeOnTheScreen();

    await fireEvent.press(screen.getByText("Düş"));
    expect(screen.getByText("Bakiyesi tutardan düşük kartlar 0 ₺'ye çekilir; eksi bakiye oluşmaz.")).toBeOnTheScreen();
    await fillAndContinue("1.250,75");
    // 1.250,75 > tüm bakiyeler → hepsi 0
    expect(screen.getByText("3 kart")).toBeOnTheScreen();
    expect(screen.getByText("Bakiye düş")).toBeOnTheScreen();
    expect(screen.getByText("₺1.250,75")).toBeOnTheScreen();
    expect(screen.getByText("Mevcut toplam")).toBeOnTheScreen();
    expect(screen.getByText("₺135,00")).toBeOnTheScreen();
    expect(screen.getByText("₺0,00")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ card_ids: [1, 2, 3], operation: "subtract", amount: "1250.75" });
  });

  it("ayarla: 0 tutara izin verir, uyarı gösterir ve set gövdesi gönderir", async () => {
    mock.onPost("/cards/bulk/balance/").reply(200, { detail: "ok", count: 2 });
    await open([card(1, { balance: "10.00" }), card(2, { balance: "20.00" })]);
    await fireEvent.press(screen.getByText("Ayarla"));
    expect(screen.getByText("Ayarla işlemi mevcut bakiyenin üzerine yazar.")).toBeOnTheScreen();
    await fillAndContinue("0");
    expect(screen.getByText("Bakiyeyi ayarla")).toBeOnTheScreen();
    expect(screen.getAllByText("2 kartın her birinin bakiyesi ₺0,00 olarak ayarlanır (mevcut bakiye silinir).").length).toBeGreaterThan(0);
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ card_ids: [1, 2], operation: "set", amount: "0.00" });
  });

  it.each([
    ["", "Tutar girin."],
    ["0", "Tutar 0'dan büyük olmalı."],
    ["-5", "Tutar negatif olamaz."],
    ["1,234", "En fazla 2 ondalık hane girilebilir."],
    ["100000000", "Tutar en fazla ₺99.999.999,99 olabilir."],
    ["12a", "Geçerli bir tutar girin (ör. 150 veya 150,50)."],
  ])("geçersiz tutar '%s' onay açmadan ve istek atmadan reddedilir", async (input, message) => {
    await open([card(1)]);
    await fillAndContinue(input);
    expect(screen.getByText(message)).toBeOnTheScreen();
    expect(screen.queryByText("Bakiye işlemini onayla")).toBeNull();
    expect(mock.history.post).toHaveLength(0);
  });

  it("onay ekranında Vazgeç: istek atılmaz, forma dönülür", async () => {
    await open([card(1)]);
    await fillAndContinue("50");
    expect(screen.getByText("Bakiye işlemini onayla")).toBeOnTheScreen();
    const cancels = screen.getAllByText("Vazgeç");
    await fireEvent.press(cancels[0]); // iç içe onay sayfası formun alt çubuğundan önce render edilir
    expect(screen.queryByText("Bakiye işlemini onayla")).toBeNull();
    expect(screen.getByTestId("balance-amount").props.value).toBe("50");
    expect(mock.history.post).toHaveLength(0);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("çift dokunuşta tek istek gider", async () => {
    mock.onPost("/cards/bulk/balance/").reply(delayed(200, { detail: "ok", count: 1 }));
    await open([card(1)]);
    await fillAndContinue("20");
    const confirm = screen.getByTestId("confirm-sheet-confirm");
    await fireEvent.press(confirm);
    await fireEvent.press(confirm);
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(mock.history.post).toHaveLength(1);
  });

  it("yetki kapsamı dışında atlanan kartları bildirir", async () => {
    mock.onPost("/cards/bulk/balance/").reply(200, { detail: "2 kart güncellendi.", count: 2 });
    await open([card(1), card(2), card(3)]);
    await fillAndContinue("10");
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() =>
      expect(toastMessage()).toBe("2 kart güncellendi; 1 kart yetki kapsamınız dışında olduğu için atlandı.")
    );
  });

  it("genel sunucu hatası onay ekranında gösterilir ve sayfa açık kalır", async () => {
    mock.onPost("/cards/bulk/balance/").reply(500, { detail: "Sunucu hatası" });
    await open([card(1)]);
    await fillAndContinue("10");
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    expect(await screen.findByText("İşlem başarısız")).toBeOnTheScreen();
    expect(screen.getByText("Sunucu hatası")).toBeOnTheScreen();
    expect(screen.getByText("Bakiye işlemini onayla")).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("kart yoksa Devam pasif ve istek atılmaz", async () => {
    await open([]);
    await fireEvent.changeText(screen.getByTestId("balance-amount"), "10");
    await fireEvent.press(screen.getByTestId("balance-continue"));
    expect(screen.queryByText("Bakiye işlemini onayla")).toBeNull();
    expect(mock.history.post).toHaveLength(0);
  });

  it("kaydedilmemiş tutar varken Vazgeç onay ister; 'Çık' ile kapanır", async () => {
    await open([card(1)]);
    await fireEvent.changeText(screen.getByTestId("balance-amount"), "10");
    await fireEvent.press(screen.getByText("Vazgeç"));
    expect(alertSpy).toHaveBeenCalledWith("Değişiklikler kaydedilmedi", "Çıkarsanız girdiğiniz bilgiler kaybolur.", expect.any(Array));
    expect(onClose).not.toHaveBeenCalled();
    pressDiscard();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("değişiklik yokken Vazgeç doğrudan kapatır", async () => {
    await open([card(1)]);
    await fireEvent.press(screen.getByText("Vazgeç"));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("yeniden açılışta form sıfırlanır", async () => {
    const cards = [card(1)];
    const el = (visible: boolean) => <BalanceOperationSheet visible={visible} cards={cards} onClose={onClose} />;
    const r = await renderWithProviders(el(false));
    await r.rerender(el(true));
    await fireEvent.press(screen.getByText("Düş"));
    await fireEvent.changeText(screen.getByTestId("balance-amount"), "99");
    await r.rerender(el(false));
    await r.rerender(el(true));
    expect(screen.getByTestId("balance-amount").props.value).toBe("");
    expect(screen.queryByText("Bakiyesi tutardan düşük kartlar 0 ₺'ye çekilir; eksi bakiye oluşmaz.")).toBeNull();
  });
});

/* -------------------------------------------------------------------- Form */

describe("CardFormSheet", () => {
  let mock: MockAdapter;
  const onClose = jest.fn();
  const onSaved = jest.fn();

  async function open(props: { card?: PersonnelCard | null; canChangeBalance?: boolean } = {}) {
    const el = (visible: boolean) => (
      <CardFormSheet
        visible={visible}
        card={props.card ?? null}
        canChangeBalance={props.canChangeBalance ?? true}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
    const r = await renderWithProviders(el(false));
    current = r.queryClient;
    await r.rerender(el(true));
    await waitGroupsLoaded(); // grup sorgusu test bitiminden sonra çözülüp act uyarısı vermesin
    return r;
  }
  let current: QueryClient | null = null;

  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet("/card-groups/").reply(200, GROUPS);
    loginAs(FULL);
    useToastStore.setState({ current: null });
    alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
  });
  afterEach(async () => {
    // Başarı sonrası cards.all invalidate → grup sorgusu yeniden çekilir; bitmesini bekle
    const qc = current;
    if (qc) await waitFor(() => expect(qc.isFetching()).toBe(0));
    current = null;
    mock.restore();
    alertSpy.mockRestore();
  });

  it("bakiyesiz oluşturma: onay istemeden tek POST, alanlar kırpılır, grup seçimi gider", async () => {
    mock.onPost("/cards/").reply(201, cardJson(77));
    await open();
    expect(screen.getByText("Yeni kart")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("card-form-uid"), "  04 11 22 33 ");
    await fireEvent.changeText(screen.getByTestId("card-form-first-name"), " Deniz ");
    await fireEvent.changeText(screen.getByLabelText("Kullanıcı no"), "42");
    await waitGroupsLoaded();
    await fireEvent.press(screen.getByLabelText("Kart grupları: seçilmedi"));
    await fireEvent.press(await screen.findByText("Depo"));
    await fireEvent.press(screen.getByText("Uygula (1)"));
    await fireEvent.press(screen.getByTestId("card-form-submit"));

    await waitFor(() => expect(onSaved).toHaveBeenCalledTimes(1));
    expect(screen.queryByText("Başlangıç bakiyesini onayla")).toBeNull();
    expect(mock.history.post).toHaveLength(1);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      uid: "04 11 22 33",
      first_name: "Deniz",
      last_name: null,
      customer_no: 42,
      group_ids: [2],
    });
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSaved.mock.calls[0][0].id).toBe(77);
    expect(toastMessage()).toBe("Kart oluşturuldu.");
  });

  it("başlangıç bakiyesi '12,5': özet onayı olmadan istek yok; onayda balance '12.50'", async () => {
    mock.onPost("/cards/").reply(201, cardJson(78));
    await open();
    await fireEvent.changeText(screen.getByTestId("card-form-uid"), "04 11 22 33");
    await fireEvent.changeText(screen.getByTestId("card-form-first-name"), "Deniz");
    await fireEvent.changeText(screen.getByTestId("card-form-last-name"), "Yılmaz");
    await fireEvent.changeText(screen.getByTestId("card-form-balance"), "12,5");
    await fireEvent.press(screen.getByTestId("card-form-submit"));

    expect(screen.getByText("Başlangıç bakiyesini onayla")).toBeOnTheScreen();
    expect(screen.getByText("Deniz Yılmaz")).toBeOnTheScreen();
    expect(screen.getByText("₺12,50")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);

    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({
      uid: "04 11 22 33",
      first_name: "Deniz",
      last_name: "Yılmaz",
      customer_no: 0,
      group_ids: [],
      balance: "12.50",
    });
  });

  it("bakiye onayında Vazgeç istek atmaz; çift dokunuşta tek POST gider", async () => {
    mock.onPost("/cards/").reply(delayed(201, cardJson(79)));
    await open();
    await fireEvent.changeText(screen.getByTestId("card-form-uid"), "04 11");
    await fireEvent.changeText(screen.getByTestId("card-form-balance"), "250");
    await fireEvent.press(screen.getByTestId("card-form-submit"));
    const cancels = screen.getAllByText("Vazgeç");
    await fireEvent.press(cancels[0]); // iç içe onay sayfası formun alt çubuğundan önce render edilir
    expect(screen.queryByText("Başlangıç bakiyesini onayla")).toBeNull();
    expect(mock.history.post).toHaveLength(0);

    await fireEvent.press(screen.getByTestId("card-form-submit"));
    const confirm = screen.getByTestId("confirm-sheet-confirm");
    await fireEvent.press(confirm);
    await fireEvent.press(confirm);
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(mock.history.post).toHaveLength(1);
  });

  it("bakiye '0' girilirse onay istenmez ve balance gönderilmez", async () => {
    mock.onPost("/cards/").reply(201, cardJson(80));
    await open();
    await fireEvent.changeText(screen.getByTestId("card-form-uid"), "04 11");
    await fireEvent.changeText(screen.getByTestId("card-form-balance"), "0");
    await fireEvent.press(screen.getByTestId("card-form-submit"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).not.toHaveProperty("balance");
  });

  it("istemci doğrulaması istek atmadan alan hatalarını gösterir", async () => {
    await open();
    await fireEvent.changeText(screen.getByLabelText("Kullanıcı no"), "12a");
    await fireEvent.changeText(screen.getByTestId("card-form-balance"), "abc");
    await fireEvent.press(screen.getByTestId("card-form-submit"));
    expect(screen.getByText("UID zorunludur.")).toBeOnTheScreen();
    expect(screen.getByText("Kullanıcı no 0 veya pozitif tam sayı olmalı.")).toBeOnTheScreen();
    expect(screen.getByText("Geçerli bir tutar girin (ör. 150 veya 150,50).")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);
    // Alan düzeltilince hatası kalkar
    await fireEvent.changeText(screen.getByTestId("card-form-uid"), "04");
    expect(screen.queryByText("UID zorunludur.")).toBeNull();
  });

  it("onay sırasında backend bakiye alan hatası: onay kapanır, hata inputta gösterilir", async () => {
    mock.onPost("/cards/").reply(400, { balance: ["En fazla 10 hane olmalı."] });
    await open();
    await fireEvent.changeText(screen.getByTestId("card-form-uid"), "04 11");
    await fireEvent.changeText(screen.getByTestId("card-form-balance"), "50");
    await fireEvent.press(screen.getByTestId("card-form-submit"));
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    expect(await screen.findByText("En fazla 10 hane olmalı.")).toBeOnTheScreen();
    expect(screen.queryByText("Başlangıç bakiyesini onayla")).toBeNull();
    expect(screen.getByTestId("card-form-balance").props.value).toBe("50");
  });

  it("alan dışı backend hatası 'Kaydedilemedi' uyarısıyla gösterilir", async () => {
    mock.onPost("/cards/").reply(403, { detail: "Bu işlem için yetkiniz yok." });
    await open();
    await fireEvent.changeText(screen.getByTestId("card-form-uid"), "04 11");
    await fireEvent.press(screen.getByTestId("card-form-submit"));
    expect(await screen.findByText("Kaydedilemedi")).toBeOnTheScreen();
    expect(screen.getByText("Bu işlem için yetkiniz yok.")).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("canChangeBalance=false: bakiye alanı yok, bilgi notu var, gövdede balance yok", async () => {
    mock.onPost("/cards/").reply(201, cardJson(81));
    await open({ canChangeBalance: false });
    expect(screen.queryByTestId("card-form-balance")).toBeNull();
    expect(screen.getByText("Bakiye değiştirme yetkiniz olmadığından kart 0 ₺ bakiye ile açılır.")).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByTestId("card-form-uid"), "04 11");
    await fireEvent.press(screen.getByTestId("card-form-submit"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    expect(JSON.parse(mock.history.post[0].data)).not.toHaveProperty("balance");
  });

  it("varsayılan RED: owner rolü tek başına change_card_balance vermez, bakiye alanı gizli", async () => {
    loginAs(["owner", "manage_personel_card"], "owner");
    function PermissionAwareForm({ visible }: { visible: boolean }) {
      const user = useAuthStore((s) => s.user);
      return <CardFormSheet visible={visible} card={null} canChangeBalance={canChangeCardBalance(user)} onClose={onClose} />;
    }
    const r = await renderWithProviders(<PermissionAwareForm visible={false} />);
    current = r.queryClient;
    await r.rerender(<PermissionAwareForm visible />);
    expect(screen.queryByTestId("card-form-balance")).toBeNull();
    expect(screen.getByText("Bakiye değiştirme yetkiniz olmadığından kart 0 ₺ bakiye ile açılır.")).toBeOnTheScreen();
  });

  it("düzenleme: bakiye alanı yok; değişiklik yoksa istek atmadan kapanır", async () => {
    await open({ card: card(5) });
    expect(screen.getByText("Kartı düzenle")).toBeOnTheScreen();
    expect(screen.queryByTestId("card-form-balance")).toBeNull();
    expect(screen.getByTestId("card-form-uid").props.value).toBe("04 AA BB 05");
    await fireEvent.press(screen.getByTestId("card-form-submit"));
    expect(mock.history.patch).toHaveLength(0);
    expect(toastMessage()).toBe("Değişiklik yapılmadı.");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("düzenleme: yalnız değişen alanlar (soyad temizleme + grup ekleme) PATCH edilir", async () => {
    mock.onPatch("/cards/5/").reply(200, cardJson(5, { last_name: null }));
    await open({ card: card(5) });
    await fireEvent.changeText(screen.getByTestId("card-form-last-name"), "  ");
    await waitGroupsLoaded();
    await fireEvent.press(screen.getByLabelText("Kart grupları: Ofis"));
    await fireEvent.press(await screen.findByText("Depo"));
    await fireEvent.press(screen.getByText("Uygula (2)"));
    await fireEvent.press(screen.getByTestId("card-form-submit"));
    await waitFor(() => expect(mock.history.patch).toHaveLength(1));
    expect(JSON.parse(mock.history.patch[0].data)).toEqual({ last_name: null, group_ids: [1, 2] });
    expect(toastMessage()).toBe("Kart güncellendi.");
  });

  it("kaydedilmemiş değişiklikte Vazgeç onay ister", async () => {
    await open();
    await fireEvent.changeText(screen.getByTestId("card-form-uid"), "04");
    await fireEvent.press(screen.getByText("Vazgeç"));
    expect(alertSpy).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();
    pressDiscard();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("gruplar yüklenemezse alan hatası gösterilir", async () => {
    mock.onGet("/card-groups/").reply(500, { detail: "x" });
    await open();
    expect(await screen.findByText("Gruplar yüklenemedi.")).toBeOnTheScreen();
  });
});
