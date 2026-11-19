import MockAdapter from "axios-mock-adapter";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as messaging from "@react-native-firebase/messaging";
import { apiClient } from "@/api/client";
import { openFromNotification, startPush, stopPush } from "@/push/pushService";
import { makeUser } from "@/test/utils";

const mockNavigate = jest.fn();
jest.mock("@/navigation/navigationRef", () => ({
  navigateWhenReady: (...args: unknown[]) => mockNavigate(...args),
}));

const m = messaging as jest.Mocked<typeof messaging>;

describe("pushService", () => {
  let mock: MockAdapter;
  beforeEach(async () => {
    mock = new MockAdapter(apiClient);
    await AsyncStorage.clear();
    mockNavigate.mockReset();
    jest.clearAllMocks();
    m.getToken.mockResolvedValue("tok-1");
    m.requestPermission.mockResolvedValue(messaging.AuthorizationStatus.AUTHORIZED);
    m.getInitialNotification.mockResolvedValue(null);
  });
  afterEach(() => mock.restore());

  it("izin verilince FCM token'ını platform ve kalıcı cihaz kimliğiyle kaydeder", async () => {
    mock.onPost("/device/register/").reply(200, {});
    const token = await startPush(() => makeUser());
    expect(token).toBe("tok-1");
    const body = JSON.parse(mock.history.post[0].data);
    expect(body).toMatchObject({ fcm_token: "tok-1", platform: "ios" });
    expect(body.device_id).toMatch(/^vm-/);

    // Aynı kurulumda cihaz kimliği değişmez
    await startPush(() => makeUser());
    expect(JSON.parse(mock.history.post[1].data).device_id).toBe(body.device_id);
  });

  it("iOS: token istemeden önce cihazı uzaktan bildirime kaydeder (yoksa getToken reddedilir)", async () => {
    mock.onPost("/device/register/").reply(200, {});
    m.isDeviceRegisteredForRemoteMessages.mockReturnValue(false);
    await startPush(() => makeUser());
    expect(m.registerDeviceForRemoteMessages).toHaveBeenCalledTimes(1);
    expect(m.registerDeviceForRemoteMessages.mock.invocationCallOrder[0]).toBeLessThan(m.getToken.mock.invocationCallOrder[0]);

    m.isDeviceRegisteredForRemoteMessages.mockReturnValue(true);
    await startPush(() => makeUser());
    expect(m.registerDeviceForRemoteMessages).toHaveBeenCalledTimes(1); // zaten kayıtlıysa tekrar etmez
  });

  it("izin reddedilirse kayıt yapmaz", async () => {
    m.requestPermission.mockResolvedValue(messaging.AuthorizationStatus.DENIED);
    expect(await startPush(() => makeUser())).toBeNull();
    expect(mock.history.post).toHaveLength(0);
  });

  it("kayıt hatası uygulamayı bozmaz", async () => {
    mock.onPost("/device/register/").networkError();
    await expect(startPush(() => makeUser())).resolves.toBeNull();
  });

  it("token yenilenince yeniden kaydeder", async () => {
    mock.onPost("/device/register/").reply(200, {});
    let refresh: (t: string) => void = () => {};
    m.onTokenRefresh.mockImplementation((_m, cb) => {
      refresh = cb as (t: string) => void;
      return () => {};
    });
    await startPush(() => makeUser());
    refresh("tok-2");
    await new Promise((r) => setTimeout(r, 0));
    expect(mock.history.post.map((r) => JSON.parse(r.data).fcm_token)).toEqual(["tok-1", "tok-2"]);
  });

  it("çıkışta kayıt silinir ve yerel token silinir", async () => {
    mock.onPost("/device/register/").reply(200, {});
    mock.onPost("/device/unregister/").reply(200, {});
    await startPush(() => makeUser());
    await stopPush();
    const unreg = mock.history.post.find((r) => r.url === "/device/unregister/");
    expect(JSON.parse(unreg!.data)).toEqual({ fcm_token: "tok-1" });
    expect(m.deleteToken).toHaveBeenCalled();
  });

  it("uygulama bildirime dokunularak açıldıysa ilgili ekrana gider", async () => {
    mock.onPost("/device/register/").reply(200, {});
    m.getInitialNotification.mockResolvedValue({ data: { event: "device.offline", sn: "PAV1" } } as never);
    await startPush(() => makeUser());
    expect(mockNavigate).toHaveBeenCalledWith("DeviceDetail", { sn: "PAV1" });
  });

  it("yetkisiz hedefte bildirim merkezine düşer (varsayılan RED)", () => {
    openFromNotification({ data: { event: "card.pending", card_id: "5" } }, makeUser({ permissions: [] }));
    expect(mockNavigate).toHaveBeenCalledWith("Notifications");
  });

  it("Nexus push'u (notification_id): bildirim ekranında o bildirimin tamamını açar", () => {
    openFromNotification(
      {
        data: { notification_id: "77", url: "/pos-cihazi/PAV1/", sent_by_admin: "True", campaign_id: "3" },
        notification: { title: "Bakım", body: "Gece bakım var" },
        sentTime: 1795000000000,
      } as never,
      makeUser()
    );
    expect(mockNavigate).toHaveBeenCalledWith("Notifications", {
      open: { id: 77, title: "Bakım", body: "Gece bakım var", url: "/pos-cihazi/PAV1/", sentAt: 1795000000000 },
    });
  });
});

