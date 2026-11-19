import MockAdapter from "axios-mock-adapter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "@/api/client";
import { useAuthStore } from "@/store/authStore";
import { tokenStorage } from "@/utils/tokenStorage";
import { makeUser, resetSecureStore } from "@/test/utils";

const initialState = useAuthStore.getState();

describe("authStore", () => {
  let mock: MockAdapter;

  beforeEach(async () => {
    resetSecureStore();
    await AsyncStorage.clear();
    useAuthStore.setState(initialState, true);
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => mock.restore());

  describe("bootstrap", () => {
    it("token yoksa unauthenticated olur ve istek atmaz", async () => {
      await useAuthStore.getState().bootstrap();
      expect(useAuthStore.getState().status).toBe("unauthenticated");
      expect(mock.history.get).toHaveLength(0);
    });

    it("yeni kurulumda (iOS Keychain'de kalmış) eski token ile oturum AÇMAZ", async () => {
      await AsyncStorage.clear(); // uygulama silinip yeniden kuruldu
      await tokenStorage.setTokens("ESKI", "ESKI-R");
      await useAuthStore.getState().bootstrap();
      expect(useAuthStore.getState().status).toBe("unauthenticated");
      expect(await tokenStorage.getAccess()).toBeNull();
      expect(mock.history.get).toHaveLength(0);
    });

    it("token geçerliyse /auth/me/ ile kullanıcıyı yükler", async () => {
      await AsyncStorage.setItem("vennex.install.marker", "1");
      await tokenStorage.setTokens("A", "R");
      const user = makeUser();
      mock.onGet("/auth/me/").reply(200, user);

      await useAuthStore.getState().bootstrap();

      expect(useAuthStore.getState()).toMatchObject({ status: "authenticated", user });
    });

    it("/auth/me/ 401 verirse (refresh de başarısız) token'ları siler", async () => {
      await AsyncStorage.setItem("vennex.install.marker", "1");
      await tokenStorage.setTokens("A", "R");
      mock.onGet("/auth/me/").reply(401, {});
      mock.onPost("/auth/refresh/").reply(401, {});

      await useAuthStore.getState().bootstrap();

      expect(useAuthStore.getState().status).toBe("unauthenticated");
      expect(await tokenStorage.getAccess()).toBeNull();
    });

    it("sunucu/ağ hatasında oturumu silmez (çevrimdışı açılış)", async () => {
      await AsyncStorage.setItem("vennex.install.marker", "1");
      await tokenStorage.setTokens("A", "R");
      mock.onGet("/auth/me/").networkError();

      await useAuthStore.getState().bootstrap();

      // Giriş ekranına atmaz: bağlantı ekranı gösterilir, token'lar korunur
      expect(useAuthStore.getState().status).toBe("offline");
      expect(useAuthStore.getState().errorMessage).toMatch(/ulaşılamadı/);
      expect(await tokenStorage.getAccess()).toBe("A");
    });

    it("sunucu 5xx verirse de oturumu korur; bağlantı gelince tekrar deneme oturumu açar", async () => {
      await AsyncStorage.setItem("vennex.install.marker", "1");
      await tokenStorage.setTokens("A", "R");
      mock.onGet("/auth/me/").replyOnce(502, {}).onGet("/auth/me/").replyOnce(200, makeUser());

      await useAuthStore.getState().bootstrap();
      expect(useAuthStore.getState().status).toBe("offline");
      expect(await tokenStorage.getRefresh()).toBe("R");

      await useAuthStore.getState().bootstrap();
      expect(useAuthStore.getState().status).toBe("authenticated");
      expect(useAuthStore.getState().errorMessage).toBeNull();
    });
  });

  describe("oturum kapanmamalı (bir kez giriş yeter)", () => {
    it("giriş token'ı süresi dolmuş + internet yok: çıkış YOK, bağlantı ekranı; token'lar korunur", async () => {
      await AsyncStorage.setItem("vennex.install.marker", "1");
      await tokenStorage.setTokens("ESKI", "R");
      mock.onGet("/auth/me/").reply(401, {});
      mock.onPost("/auth/refresh/").networkError();

      await useAuthStore.getState().bootstrap();

      expect(useAuthStore.getState().status).toBe("offline");
      expect(await tokenStorage.getAccess()).toBe("ESKI");
      expect(await tokenStorage.getRefresh()).toBe("R");
    });

    it("giriş token'ı süresi dolmuş + sunucu geçici hata (503): çıkış YOK", async () => {
      await AsyncStorage.setItem("vennex.install.marker", "1");
      await tokenStorage.setTokens("ESKI", "R");
      mock.onGet("/auth/me/").reply(401, {});
      mock.onPost("/auth/refresh/").reply(503, {});

      await useAuthStore.getState().bootstrap();

      expect(useAuthStore.getState().status).toBe("offline");
      expect(await tokenStorage.getRefresh()).toBe("R");
    });

    it("bağlantı gelince aynı oturum kendiliğinden devam eder (yeniden giriş gerekmez)", async () => {
      await AsyncStorage.setItem("vennex.install.marker", "1");
      await tokenStorage.setTokens("ESKI", "R");
      mock.onGet("/auth/me/").replyOnce(401, {});
      mock.onPost("/auth/refresh/").replyOnce(503, {});
      await useAuthStore.getState().bootstrap();
      expect(useAuthStore.getState().status).toBe("offline");

      mock.onGet("/auth/me/").replyOnce(401, {}).onGet("/auth/me/").reply(200, makeUser());
      mock.onPost("/auth/refresh/").reply(200, { access: "YENI", refresh: "R2" });
      await useAuthStore.getState().bootstrap();
      expect(useAuthStore.getState().status).toBe("authenticated");
      expect(await tokenStorage.getAccess()).toBe("YENI");
    });

    it("anahtar zinciri okunamazsa oturum silinmez, bağlantı ekranı gösterilir", async () => {
      await AsyncStorage.setItem("vennex.install.marker", "1");
      await tokenStorage.setTokens("A", "R");
      const spy = jest.spyOn(tokenStorage, "getAccess").mockRejectedValueOnce(new Error("Keychain kilitli"));

      await useAuthStore.getState().bootstrap();

      expect(useAuthStore.getState().status).toBe("offline");
      spy.mockRestore();
      expect(await tokenStorage.getRefresh()).toBe("R");
    });
  });

  describe("şirket seçimi", () => {
    const companies = [
      { id: 10, name: "A", cari_state: 0, has_personnel_card_device: true, uses_stock_mode: true },
      { id: 20, name: "B", cari_state: 0, has_personnel_card_device: false, uses_stock_mode: false },
    ];

    it("girişte ilk şirket seçilir", async () => {
      mock.onPost("/auth/login/").reply(200, { access: "A", refresh: "R", user: makeUser({ companies }) });
      await useAuthStore.getState().login("u", "p");
      expect(useAuthStore.getState().selectedCompanyId).toBe(10);
    });

    it("şirket değiştirilince sonraki isteklerde X-Company-Id gönderilir", async () => {
      mock.onPost("/auth/login/").reply(200, { access: "A", refresh: "R", user: makeUser({ companies }) });
      await useAuthStore.getState().login("u", "p");
      await useAuthStore.getState().selectCompany(20);

      mock.onGet("/pos-devices/").reply((c) => [200, { company: c.headers?.["X-Company-Id"] }]);
      const { data } = await apiClient.get("/pos-devices/");
      expect(data.company).toBe("20");
    });

    it("seçim kullanıcı bazında hatırlanır", async () => {
      mock.onPost("/auth/login/").reply(200, { access: "A", refresh: "R", user: makeUser({ companies }) });
      await useAuthStore.getState().login("u", "p");
      await useAuthStore.getState().selectCompany(20);
      await useAuthStore.getState().logout();
      await useAuthStore.getState().login("u", "p");
      expect(useAuthStore.getState().selectedCompanyId).toBe(20);
    });

    it("erişimi olmayan şirket seçilemez", async () => {
      mock.onPost("/auth/login/").reply(200, { access: "A", refresh: "R", user: makeUser({ companies }) });
      await useAuthStore.getState().login("u", "p");
      await useAuthStore.getState().selectCompany(999);
      expect(useAuthStore.getState().selectedCompanyId).toBe(10);
    });
  });

  describe("login", () => {
    it("başarılı girişte token'ları saklar ve authenticated olur", async () => {
      const user = makeUser();
      mock.onPost("/auth/login/").reply(200, { access: "A", refresh: "R", user });

      await useAuthStore.getState().login("test.user", "secret");

      expect(JSON.parse(mock.history.post[0].data)).toEqual({ username: "test.user", password: "secret" });
      expect(useAuthStore.getState()).toMatchObject({ status: "authenticated", user });
      expect(await tokenStorage.getAccess()).toBe("A");
      expect(await tokenStorage.getRefresh()).toBe("R");
    });

    it("2FA gerekiyorsa requires_2fa durumuna geçer, token saklamaz", async () => {
      mock.onPost("/auth/login/").reply(200, { requires_2fa: true, session_token: "S1", attempts_left: 5 });

      await useAuthStore.getState().login("test.user", "secret");

      expect(useAuthStore.getState()).toMatchObject({ status: "requires_2fa", sessionToken: "S1", attemptsLeft: 5 });
      expect(await tokenStorage.getAccess()).toBeNull();
    });

    it("hatalı girişte backend mesajıyla hata fırlatır", async () => {
      mock.onPost("/auth/login/").reply(400, { detail: "Kullanıcı adı veya şifre hatalı" });

      await expect(useAuthStore.getState().login("x", "y")).rejects.toThrow("Kullanıcı adı veya şifre hatalı");
      expect(useAuthStore.getState().status).toBe("booting");
    });
  });

  describe("verify2FA", () => {
    beforeEach(() => {
      useAuthStore.setState({ status: "requires_2fa", sessionToken: "S1", attemptsLeft: 5 });
    });

    it("doğru kodla giriş tamamlanır", async () => {
      const user = makeUser();
      mock.onPost("/auth/2fa/verify/").reply(200, { access: "A", refresh: "R", user });

      await useAuthStore.getState().verify2FA("123456");

      expect(JSON.parse(mock.history.post[0].data)).toEqual({ session_token: "S1", otp: "123456" });
      expect(useAuthStore.getState()).toMatchObject({ status: "authenticated", sessionToken: null });
    });

    it("400 + requires_2fa yanıtında OTP ekranında kalır ve kalan hakkı günceller", async () => {
      mock.onPost("/auth/2fa/verify/").reply(400, { requires_2fa: true, attempts_left: 4, detail: "Kod hatalı" });

      await useAuthStore.getState().verify2FA("000000");

      expect(useAuthStore.getState()).toMatchObject({
        status: "requires_2fa",
        sessionToken: "S1",
        attemptsLeft: 4,
        errorMessage: "Kod hatalı",
      });
    });

    it("401 (oturum süresi doldu / çok fazla deneme) → giriş ekranına döner", async () => {
      mock.onPost("/auth/2fa/verify/").reply(401, { detail: "Çok fazla hatalı deneme, tekrar giriş yapın." });

      await useAuthStore.getState().verify2FA("111111");

      expect(useAuthStore.getState()).toMatchObject({
        status: "unauthenticated",
        sessionToken: null,
        errorMessage: "Çok fazla hatalı deneme, tekrar giriş yapın.",
      });
    });

    it("session token yoksa login ekranına döner", async () => {
      useAuthStore.setState({ sessionToken: null });

      await useAuthStore.getState().verify2FA("123456");

      expect(useAuthStore.getState().status).toBe("unauthenticated");
      expect(mock.history.post).toHaveLength(0);
    });
  });

  it("logout token'ları siler ve backend'e refresh token'ı gönderir", async () => {
    await tokenStorage.setTokens("A", "R");
    useAuthStore.setState({ status: "authenticated", user: makeUser() });
    mock.onPost("/auth/logout/").reply(200, {});

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState()).toMatchObject({ status: "unauthenticated", user: null });
    expect(await tokenStorage.getAccess()).toBeNull();
    expect(JSON.parse(mock.history.post[0].data)).toEqual({ refresh: "R" });
    // Token'lar silinmeden önce, erişim token'ıyla gönderilir (yoksa backend 401 verir, refresh kara listeye girmez)
    expect(mock.history.post[0].headers?.Authorization).toBe("Bearer A");
  });

  it("logout isteği 401 dönse de 'oturum sona erdi' akışını tetiklemez", async () => {
    await tokenStorage.setTokens("A", "R");
    useAuthStore.setState({ status: "authenticated", user: makeUser() });
    mock.onPost("/auth/logout/").reply(401, { detail: "Kimlik bilgileri verilmedi." });

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState()).toMatchObject({ status: "unauthenticated", errorMessage: null });
    expect(mock.history.post.filter((r) => r.url === "/auth/refresh/")).toHaveLength(0);
  });

  it("backend logout hata verse de istemci çıkışı tamamlanır", async () => {
    await tokenStorage.setTokens("A", "R");
    useAuthStore.setState({ status: "authenticated", user: makeUser() });
    mock.onPost("/auth/logout/").networkError();

    await useAuthStore.getState().logout();

    expect(useAuthStore.getState().status).toBe("unauthenticated");
  });
});
