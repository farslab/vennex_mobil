import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { getTheme } from "@/design-system";
import LegalConsentGateScreen from "@/screens/legal/LegalConsentGateScreen";
import LegalDocumentScreen from "@/screens/legal/LegalDocumentScreen";
import { makeMarkdownStyles } from "@/screens/legal/markdownStyles";
import { createTestQueryClient, makeUser, renderWithProviders } from "@/test/utils";

/** Mutasyon gc zamanlayıcısı (varsayılan 5 dk) jest sürecini açık tutmasın */
function makeClient() {
  const client = createTestQueryClient();
  client.setDefaultOptions({ ...client.getDefaultOptions(), mutations: { retry: false, gcTime: Infinity } });
  return client;
}

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useRoute: () => ({ key: "LegalDocument", name: "LegalDocument", params: { slug: "privacy" } }),
}));

const doc = (slug: string, title: string, version = 3) => ({
  slug,
  title,
  content_md: `# ${title}\n\nMadde metni.`,
  web_url: null,
  version,
  updated_at: "2026-10-01T09:00:00+03:00",
});

const mockLogout = jest.fn(async () => {});

describe("LegalConsentGateScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mock.onGet("/legal/kvkk/").reply(200, doc("kvkk", "KVKK Aydınlatma Metni", 3));
    mock.onGet("/legal/terms/").reply(200, doc("terms", "Kullanım Koşulları", 5));
    useAuthStore.setState({
      status: "authenticated",
      user: makeUser({ pending_legal_docs: ["kvkk", "terms"] }),
      selectedCompanyId: 10,
      logout: mockLogout,
    });
  });
  afterEach(() => mock.restore());

  it("adım sayacı ile belgeleri sırayla onaylatır ve setUser ile bekleyen listeyi günceller", async () => {
    mock
      .onPost("/legal/accept/")
      .replyOnce(200, makeUser({ pending_legal_docs: ["terms"] }))
      .onPost("/legal/accept/")
      .replyOnce(200, makeUser({ pending_legal_docs: [] }));

    await renderWithProviders(<LegalConsentGateScreen />, { queryClient: makeClient() });
    expect(await screen.findByText("YASAL ONAY · ADIM 1/2")).toBeOnTheScreen();
    expect(await screen.findByText("Sürüm 3 · Güncelleme 01.10.2026")).toBeOnTheScreen();

    await fireEvent.press(screen.getByTestId("legal-gate-accept"));
    await waitFor(() => expect(useAuthStore.getState().user?.pending_legal_docs).toEqual(["terms"]));
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ slug: "kvkk", version: 3 });

    expect(await screen.findByText("YASAL ONAY · ADIM 2/2")).toBeOnTheScreen();
    await screen.findByText("Sürüm 5 · Güncelleme 01.10.2026");
    await fireEvent.press(screen.getByTestId("legal-gate-accept"));
    await waitFor(() => expect(useAuthStore.getState().user?.pending_legal_docs).toEqual([]));
    expect(JSON.parse(mock.history.post[1].data)).toEqual({ slug: "terms", version: 5 });
  });

  it("onay hatasını gösterir, kullanıcı çıkış yapabilir", async () => {
    mock.onPost("/legal/accept/").reply(500, { detail: "Sunucu hatası" });
    await renderWithProviders(<LegalConsentGateScreen />, { queryClient: makeClient() });
    await screen.findByText("Sürüm 3 · Güncelleme 01.10.2026");

    await fireEvent.press(screen.getByTestId("legal-gate-accept"));
    expect(await screen.findByText("Onay kaydedilemedi")).toBeOnTheScreen();
    expect(useAuthStore.getState().user?.pending_legal_docs).toEqual(["kvkk", "terms"]);

    await fireEvent.press(screen.getByTestId("legal-gate-logout"));
    await waitFor(() => expect(mockLogout).toHaveBeenCalled());
  });
});

describe("LegalDocumentScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => mock.restore());

  it("başlık, sürüm/güncelleme ve içeriği gösterir", async () => {
    mock.onGet("/legal/privacy/").reply(200, doc("privacy", "Gizlilik Politikası", 2));
    await renderWithProviders(<LegalDocumentScreen />, { queryClient: makeClient() });
    expect(await screen.findByText("Sürüm 2 · Güncelleme 01.10.2026")).toBeOnTheScreen();
    expect(screen.getByText("Madde metni.")).toBeOnTheScreen();
  });
});

describe("markdownStyles", () => {
  it("açık ve koyu temada metin rengi tema token'ından gelir (beyaz-üstüne-beyaz yok)", () => {
    const light = makeMarkdownStyles(getTheme("light"));
    const dark = makeMarkdownStyles(getTheme("dark"));
    expect(light.heading1.color).toBe(getTheme("light").colors.text);
    expect(dark.heading1.color).toBe(getTheme("dark").colors.text);
    expect(light.body.color).not.toBe(getTheme("light").colors.surface);
  });
});
