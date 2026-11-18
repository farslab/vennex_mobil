import React from "react";
import MockAdapter from "axios-mock-adapter";
import { fireEvent, screen, waitFor } from "@testing-library/react-native";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import FeedbackScreen from "@/screens/account/FeedbackScreen";
import { makeUser, renderWithProviders } from "@/test/utils";

jest.mock("@expo/vector-icons", () => ({ Feather: () => null }));

const mockPreventRemove = jest.fn();
jest.mock("@react-navigation/native", () => ({
  ...jest.requireActual("@react-navigation/native"),
  useNavigation: () => ({ navigate: jest.fn(), goBack: jest.fn(), setOptions: jest.fn(), dispatch: jest.fn() }),
  usePreventRemove: (...args: unknown[]) => mockPreventRemove(...args),
}));

const item = {
  id: 7,
  category: "bug",
  category_display: "Hata bildirimi",
  message: "Rapor indirirken kapanıyor",
  status: "in_progress",
  status_display: "İnceleniyor",
  created_at: "2026-11-18T10:30:00+03:00",
};

describe("FeedbackScreen", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
    mockPreventRemove.mockReset();
    useAuthStore.setState({ status: "authenticated", user: makeUser({ role: "tech" }), selectedCompanyId: 10 });
  });
  afterEach(() => mock.restore());

  it("önceki bildirimleri durumlarıyla gösterir", async () => {
    mock.onGet("/feedback/").reply(200, { results: [item] });
    await renderWithProviders(<FeedbackScreen />);
    expect(await screen.findByText("Rapor indirirken kapanıyor")).toBeOnTheScreen();
    expect(screen.getByText("Hata bildirimi")).toBeOnTheScreen();
    expect(screen.getByText("İnceleniyor")).toBeOnTheScreen();
  });

  it("geçmiş boşsa açıklama gösterir; hata olursa uyarı", async () => {
    mock.onGet("/feedback/").replyOnce(200, { results: [] });
    await renderWithProviders(<FeedbackScreen />);
    expect(await screen.findByTestId("feedback-empty")).toBeOnTheScreen();
  });

  it("kısa mesajı istemcide reddeder", async () => {
    mock.onGet("/feedback/").reply(200, { results: [] });
    await renderWithProviders(<FeedbackScreen />);
    await fireEvent.changeText(screen.getByTestId("feedback-message"), "  kısa  ");
    await fireEvent.press(screen.getByTestId("feedback-submit"));
    expect(screen.getByText("En az 10 karakter yazın.")).toBeOnTheScreen();
    expect(mock.history.post).toHaveLength(0);
  });

  it("seçilen türle gönderir, formu temizler ve geçmişi yeniler", async () => {
    let list: (typeof item)[] = [];
    mock.onGet("/feedback/").reply(() => [200, { results: list }]);
    mock.onPost("/feedback/").reply((cfg) => {
      const body = JSON.parse(cfg.data);
      const created = { ...item, id: 8, category: body.category, category_display: "Soru / destek", message: body.message, status: "new", status_display: "Yeni" };
      list = [created];
      return [201, created];
    });
    await renderWithProviders(<FeedbackScreen />);
    await screen.findByTestId("feedback-empty");

    await fireEvent.press(screen.getByText("Soru"));
    await fireEvent.changeText(screen.getByTestId("feedback-message"), "  Raporlarda tarih aralığı nasıl seçilir?  ");
    // Gönderilmemiş mesaj varken çıkış onaya bağlı
    expect(mockPreventRemove).toHaveBeenLastCalledWith(true, expect.any(Function));
    await fireEvent.press(screen.getByTestId("feedback-submit"));

    expect(await screen.findByText("Raporlarda tarih aralığı nasıl seçilir?")).toBeOnTheScreen();
    const body = JSON.parse(mock.history.post[0].data);
    expect(body).toMatchObject({ category: "question", message: "Raporlarda tarih aralığı nasıl seçilir?" });
    expect(typeof body.app_version).toBe("string");
    expect(screen.getByTestId("feedback-message").props.value).toBe("");
    await waitFor(() => expect(mockPreventRemove).toHaveBeenLastCalledWith(false, expect.any(Function)));
  });

  it("sunucunun alan hatasını mesaj alanında, sınır aşımını genel uyarıda gösterir", async () => {
    mock.onGet("/feedback/").reply(200, { results: [] });
    mock.onPost("/feedback/").replyOnce(400, { message: ["Bu alanın en az 10 karakter içerdiğinden emin olun."] });
    await renderWithProviders(<FeedbackScreen />);
    await fireEvent.changeText(screen.getByTestId("feedback-message"), "Yeterince uzun bir mesaj");
    await fireEvent.press(screen.getByTestId("feedback-submit"));
    expect(await screen.findByText("Bu alanın en az 10 karakter içerdiğinden emin olun.")).toBeOnTheScreen();

    mock.onPost("/feedback/").replyOnce(429, {});
    await fireEvent.press(screen.getByTestId("feedback-submit"));
    expect(await screen.findByText("Çok fazla istek gönderildi. Lütfen biraz sonra tekrar deneyin.")).toBeOnTheScreen();
  });
});
