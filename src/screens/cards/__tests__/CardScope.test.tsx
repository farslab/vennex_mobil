import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { renderWithProviders } from "@/test/utils";
import { CardGroupsTab } from "@/screens/cards/tabs/CardGroupsTab";
import { CardFormSheet } from "@/screens/cards/components/CardFormSheet";
import { normalizeCard } from "@/api/cards";
import { cardJson, loginAs, NO_BALANCE } from "./fixtures";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

const GROUPS = { results: [{ id: 1, name: "Ofis", active_cards_count: 3, pos_device_count: 1 }] };

describe("kart grubu kısıtlı teknisyen (web ile aynı)", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet("/card-groups/").reply(200, GROUPS);
    loginAs(NO_BALANCE, "tech");
  });
  afterEach(() => mock.restore());

  it("kısıtlıysa 'Yeni grup' yok; kısıtlı değilse var", async () => {
    mock.onGet("/app/config/").reply(200, { card_scope_restricted: true });
    const r = await renderWithProviders(<CardGroupsTab />);
    expect(await screen.findByText("Ofis")).toBeOnTheScreen();
    await waitFor(() => expect(r.queryClient.isFetching()).toBe(0));
    expect(screen.queryByTestId("group-create")).toBeNull();
  });

  it("kısıtlı değilse 'Yeni grup' görünür", async () => {
    mock.onGet("/app/config/").reply(200, { card_scope_restricted: false });
    await renderWithProviders(<CardGroupsTab />);
    expect(await screen.findByTestId("group-create")).toBeOnTheScreen();
  });

  it("kısıtlıysa yeni kartta grup zorunlu; istek atılmaz", async () => {
    mock.onGet("/app/config/").reply(200, { card_scope_restricted: true });
    const r = await renderWithProviders(<CardFormSheet visible card={null} canChangeBalance={false} onClose={jest.fn()} />);
    await waitFor(() => expect(r.queryClient.isFetching()).toBe(0));
    await fireEvent.changeText(screen.getByTestId("card-form-uid"), "04 AA BB CC");
    await fireEvent.press(screen.getByTestId("card-form-submit"));
    expect(await screen.findByText("Yetkili olduğunuz bir grup seçin.")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);
  });

  it("düzenlemede kapsam dışı gruplar sabit gösterilir (kaldırılamaz) ve yetkili grup sayısına katılmaz", async () => {
    mock.onGet("/app/config/").reply(200, { card_scope_restricted: true });
    mock.onPatch("/cards/3/").reply(200, cardJson(3));
    const c = normalizeCard(
      cardJson(3, {
        groups: [
          { id: 1, name: "Ofis", pos_device_ids: [] },
          { id: 5, name: "Gizli Depo", pos_device_ids: [] },
        ],
      })
    );
    const r = await renderWithProviders(<CardFormSheet visible card={c} canChangeBalance={false} onClose={jest.fn()} />);
    await waitFor(() => expect(r.queryClient.isFetching()).toBe(0));
    expect(await screen.findByText("Değiştirilemeyen gruplar")).toBeOnTheScreen();
    expect(screen.getByText("Gizli Depo: yetki kapsamınız dışında; kartta korunur, buradan kaldırılamaz.")).toBeOnTheScreen();
    // Seçim alanında yalnız yetkili grup görünür
    expect(screen.getByLabelText("Kart grupları: Ofis")).toBeOnTheScreen();

    // Yetkili tek grup kaldırılırsa, kapsam dışı grup kalsa bile kayıt engellenir (backend 400 verir)
    await fireEvent.press(screen.getByLabelText("Kart grupları: Ofis"));
    const ofis = await screen.findAllByText("Ofis");
    await fireEvent.press(ofis[ofis.length - 1]);
    await fireEvent.press(screen.getByText(/^Uygula/));
    await fireEvent.press(screen.getByTestId("card-form-submit"));
    expect(await screen.findByText("Yetkili olduğunuz bir grup seçin.")).toBeOnTheScreen();
    expect(mock.history.patch).toHaveLength(0);
  });
});
