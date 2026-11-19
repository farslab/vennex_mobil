/**
 * Kart onayı, toplu grup ataması, gruba istihkak (sıralı istekler) ve grup filtresi sayfaları.
 */
import React from "react";
import MockAdapter from "axios-mock-adapter";
import { act, fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { normalizeCard } from "@/api/cards";
import { useToastStore } from "@/design-system";
import { renderWithProviders } from "@/test/utils";
import type { PersonnelCard } from "@/types/cards";
import { ApproveCardSheet } from "@/screens/cards/components/ApproveCardSheet";
import { BulkGroupsSheet } from "@/screens/cards/components/BulkGroupsSheet";
import { GroupFilterSheet } from "@/screens/cards/components/GroupFilterSheet";
import { cardJson, FULL, loginAs } from "./fixtures";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));
// Paralel koşuda ilk testin soğuk modül dönüşümü 5 sn varsayılanını aşabiliyor
jest.setTimeout(20_000);

const card = (id: number, over: Record<string, unknown> = {}): PersonnelCard => normalizeCard(cardJson(id, over));
const toastMessage = () => useToastStore.getState().current?.message ?? null;
const delayed = (status: number, data: unknown, ms = 30) => () =>
  new Promise<[number, unknown]>((resolve) => setTimeout(() => resolve([status, data]), ms));
const GROUPS = {
  results: [
    { id: 1, name: "Ofis", active_cards_count: 3, pos_device_count: 1, created_at: null },
    { id: 2, name: "Depo", active_cards_count: 1, pos_device_count: 1, created_at: null },
  ],
};

let mock: MockAdapter;
beforeEach(() => {
  mock = new MockAdapter(apiClient);
  loginAs(FULL);
  useToastStore.setState({ current: null });
});
afterEach(() => mock.restore());

/* ------------------------------------------------------------------ Onay */

describe("ApproveCardSheet", () => {
  const onCancel = jest.fn();
  const onConfirm = jest.fn();
  const el = (c: PersonnelCard | null, extra: { loading?: boolean; error?: string | null } = {}) => (
    <ApproveCardSheet card={c} loading={extra.loading ?? false} error={extra.error ?? null} onCancel={onCancel} onConfirm={onConfirm} />
  );

  it("kart yokken hiçbir şey göstermez", async () => {
    await renderWithProviders(el(null));
    expect(screen.queryByText("Kartı onayla")).toBeNull();
  });

  it("özet (sahip, UID, bakiye) gösterir; düz onay reverse=false ile çağrılır", async () => {
    await renderWithProviders(el(card(9, { balance: "45.5" })));
    expect(screen.getByText("Kartı onayla")).toBeOnTheScreen();
    expect(screen.getByText("Ad9 Soyad")).toBeOnTheScreen();
    expect(screen.getByText("04 AA BB 09")).toBeOnTheScreen();
    expect(screen.getByText("₺45,50")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("approve-confirm"));
    expect(onConfirm).toHaveBeenCalledWith(false);
  });

  it("ters UID seçeneği önizlemeyi değiştirir ve reverse=true gönderir", async () => {
    await renderWithProviders(el(card(9)));
    await fireEvent.press(screen.getByTestId("approve-reverse-uid"));
    expect(screen.getByText("09 BB AA 04")).toBeOnTheScreen();
    expect(screen.queryByText("04 AA BB 09")).toBeNull();
    await fireEvent.press(screen.getByTestId("approve-confirm"));
    expect(onConfirm).toHaveBeenCalledWith(true);
  });

  it("tek parçalı UID'de ters çevirme seçeneği sunulmaz", async () => {
    await renderWithProviders(el(card(9, { uid: "04AABB09" })));
    expect(screen.queryByTestId("approve-reverse-uid")).toBeNull();
  });

  it("başka karta geçince ters UID seçimi sıfırlanır", async () => {
    const r = await renderWithProviders(el(card(9)));
    await fireEvent.press(screen.getByTestId("approve-reverse-uid"));
    await r.rerender(el(card(8)));
    expect(screen.getByText("04 AA BB 08")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("approve-confirm"));
    expect(onConfirm).toHaveBeenCalledWith(false);
  });

  it("yüklenirken onay ve vazgeç kilitli; hata uyarısı gösterilir", async () => {
    await renderWithProviders(el(card(9), { loading: true, error: "Kart zaten onaylı." }));
    expect(screen.getByText("Onaylanamadı")).toBeOnTheScreen();
    expect(screen.getByText("Kart zaten onaylı.")).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId("approve-confirm"));
    await fireEvent.press(screen.getByText("Vazgeç"));
    expect(onConfirm).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });
});

/* ----------------------------------------------------------- Toplu gruplar */

describe("BulkGroupsSheet", () => {
  const onClose = jest.fn();
  const onDone = jest.fn();

  async function open(cardIds: number[]) {
    const el = (visible: boolean) => <BulkGroupsSheet visible={visible} cardIds={cardIds} onClose={onClose} onDone={onDone} />;
    const r = await renderWithProviders(el(false));
    await r.rerender(el(true));
    return r;
  }

  async function pickGroups(names: string[]) {
    // Seçim alanı gruplar yüklenirken pasif: önce yüklemenin bitmesini bekle
    await waitFor(() => expect(screen.queryByText("Yükleniyor…")).toBeNull());
    await fireEvent.press(screen.getByLabelText("Gruplar: seçilmedi"));
    for (const n of names) await fireEvent.press(await screen.findByText(n));
    await fireEvent.press(screen.getByText(`Uygula (${names.length})`));
  }

  it("grup seçilmeden devam edilemez, istek atılmaz", async () => {
    mock.onGet("/card-groups/").reply(200, GROUPS);
    await open([1, 2]);
    await screen.findByLabelText("Gruplar: seçilmedi");
    await fireEvent.press(screen.getByTestId("bulk-groups-continue"));
    expect(screen.getByText("En az bir grup seçin.")).toBeOnTheScreen();
    expect(screen.queryByText("Grup atamasını onayla")).toBeNull();
    expect(mock.history.post).toHaveLength(0);
  });

  it("gruba ekleme: özet (kart sayısı, işlem, gruplar) sonrası tek istek ve doğru gövde", async () => {
    mock.onGet("/card-groups/").reply(200, GROUPS);
    mock.onPost("/cards/bulk/groups/").reply(200, { detail: "3 kart güncellendi.", count: 3 });
    await open([1, 2, 3]);
    expect(screen.getByText("3 kart seçili")).toBeOnTheScreen();
    await pickGroups(["Ofis", "Depo"]);
    await fireEvent.press(screen.getByTestId("bulk-groups-continue"));

    expect(screen.getByText("Grup atamasını onayla")).toBeOnTheScreen();
    expect(screen.getByText("3 kart")).toBeOnTheScreen();
    expect(screen.getByText("Gruplara ekle")).toBeOnTheScreen();
    expect(screen.getByText("Ofis, Depo")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);

    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(mock.history.post).toHaveLength(1);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ card_ids: [1, 2, 3], group_ids: [1, 2], operation: "add_groups" });
    expect(toastMessage()).toBe("3 kartın grupları güncellendi.");
  });

  it("gruptan çıkarma remove_groups gönderir; çift dokunuşta tek istek", async () => {
    mock.onGet("/card-groups/").reply(200, GROUPS);
    mock.onPost("/cards/bulk/groups/").reply(delayed(200, { detail: "ok", count: 2 }));
    await open([4, 5]);
    await fireEvent.press(screen.getByText("Gruptan çıkar"));
    await pickGroups(["Depo"]);
    await fireEvent.press(screen.getByTestId("bulk-groups-continue"));
    expect(screen.getByText("Gruplardan çıkar")).toBeOnTheScreen();
    const confirm = screen.getByTestId("confirm-sheet-confirm");
    await fireEvent.press(confirm);
    await fireEvent.press(confirm);
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(mock.history.post).toHaveLength(1);
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ card_ids: [4, 5], group_ids: [2], operation: "remove_groups" });
  });

  it("kapsam dışında kalan (atlanan) kartlar bildirimde belirtilir", async () => {
    mock.onGet("/card-groups/").reply(200, GROUPS);
    mock.onPost("/cards/bulk/groups/").reply(200, { detail: "2 kart güncellendi.", count: 2 });
    await open([1, 2, 3]);
    await pickGroups(["Ofis"]);
    await fireEvent.press(screen.getByTestId("bulk-groups-continue"));
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(onDone).toHaveBeenCalled());
    expect(toastMessage()).toBe("2 kartın grupları güncellendi; 1 kart yetki kapsamınız dışında olduğu için atlandı.");
  });

  it("istek sürerken sayfa kapatılamaz (Vazgeç ve Kapat pasif)", async () => {
    mock.onGet("/card-groups/").reply(200, GROUPS);
    // Yanıt test kontrolünde: yük altında bile istek sürerken doğrulanır
    let release: () => void = () => undefined;
    mock.onPost("/cards/bulk/groups/").reply(
      () => new Promise<[number, unknown]>((resolve) => (release = () => resolve([200, { detail: "ok", count: 1 }])))
    );
    await open([1]);
    await pickGroups(["Ofis"]);
    await fireEvent.press(screen.getByTestId("bulk-groups-continue"));
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    await waitFor(() => expect(mock.history.post).toHaveLength(1));
    // react-query durum bildirimi bir sonraki tick'te render olur
    await waitFor(() => {
      for (const close of screen.getAllByLabelText("Kapat")) expect(close).toBeDisabled();
    });
    expect(onClose).not.toHaveBeenCalled();
    await act(async () => release());
    await waitFor(() => expect(onDone).toHaveBeenCalled());
  });

  it("backend hatası onay ekranında gösterilir, sayfa kapanmaz", async () => {
    mock.onGet("/card-groups/").reply(200, GROUPS);
    mock.onPost("/cards/bulk/groups/").reply(400, { detail: "Grup kapsamınız dışında." });
    await open([1]);
    await pickGroups(["Ofis"]);
    await fireEvent.press(screen.getByTestId("bulk-groups-continue"));
    await fireEvent.press(screen.getByTestId("confirm-sheet-confirm"));
    expect(await screen.findByText("Grup kapsamınız dışında.")).toBeOnTheScreen();
    expect(onClose).not.toHaveBeenCalled();
    expect(onDone).not.toHaveBeenCalled();
  });

  it("gruplar yüklenemezse alan hatası gösterilir", async () => {
    mock.onGet("/card-groups/").reply(500, { detail: "x" });
    await open([1]);
    expect(await screen.findByText("Gruplar yüklenemedi.")).toBeOnTheScreen();
  });
});

describe("GroupFilterSheet", () => {
  const onClose = jest.fn();
  const onSelect = jest.fn();
  const el = (visible: boolean, selectedId: number | null = null) => (
    <GroupFilterSheet visible={visible} selectedId={selectedId} onClose={onClose} onSelect={onSelect} />
  );
  const groupGets = () => mock.history.get.filter((r) => r.url === "/card-groups/");

  it("kapalıyken istek atmaz; açılınca 'Tüm gruplar' ile listeyi gösterir", async () => {
    mock.onGet("/card-groups/").reply(200, GROUPS);
    const r = await renderWithProviders(el(false));
    expect(groupGets()).toHaveLength(0);
    await r.rerender(el(true));
    expect(await screen.findByText("Ofis")).toBeOnTheScreen();
    expect(screen.getByText("Tüm gruplar")).toBeOnTheScreen();
    expect(screen.getByText("3 aktif kart")).toBeOnTheScreen();
    expect(groupGets()[0].params).toBeUndefined();
  });

  it("seçili grup işaretlenir; satır seçimi onSelect ile döner", async () => {
    mock.onGet("/card-groups/").reply(200, GROUPS);
    await renderWithProviders(el(true, 2));
    await screen.findByText("Depo");
    const radios = screen.getAllByRole("radio");
    expect(radios.map((r) => r.props.accessibilityState?.checked)).toEqual([false, false, true]);
    await fireEvent.press(screen.getByText("Ofis"));
    expect(onSelect).toHaveBeenLastCalledWith({ id: 1, name: "Ofis" });
    await fireEvent.press(screen.getByText("Tüm gruplar"));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it("arama debounce sonrası tek q isteği gönderir", async () => {
    mock.onGet("/card-groups/").reply(200, GROUPS);
    const { queryClient } = await renderWithProviders(el(true));
    await screen.findByText("Ofis");
    const input = screen.getByLabelText("Grup adı ara");
    await fireEvent.changeText(input, "d");
    await fireEvent.changeText(input, "de");
    await fireEvent.changeText(input, "dep ");
    await waitFor(() => expect(groupGets().some((r) => r.params?.q === "dep")).toBe(true), { timeout: 2000 });
    expect(groupGets().map((r) => r.params?.q).filter(Boolean)).toEqual(["dep"]);
    await waitFor(() => expect(queryClient.isFetching()).toBe(0));
  });

  it("hata durumunda tekrar dene ile yeniden yükler", async () => {
    mock.onGet("/card-groups/").replyOnce(500, { detail: "Sunucu hatası" });
    mock.onGet("/card-groups/").reply(200, GROUPS);
    await renderWithProviders(el(true));
    expect(await screen.findByText("Sunucu hatası")).toBeOnTheScreen();
    await fireEvent.press(screen.getByText("Tekrar dene"));
    expect(await screen.findByText("Ofis")).toBeOnTheScreen();
  });
});
