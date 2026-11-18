import MockAdapter from "axios-mock-adapter";
import { apiClient } from "@/api/client";
import { appConfigApi, compareVersions, evaluateVersionPolicy, normalizeConfig } from "@/api/appConfig";
import { moduleVisible } from "@/auth/permissions";
import { enumLabel } from "@/hooks/useAppConfig";
import { __resetOtaForTests, checkForOtaUpdate, useOtaStore, type OtaDeps } from "@/updates/otaUpdater";

describe("compareVersions", () => {
  it.each([
    ["1.0.0", "1.0.0", 0],
    ["1.10.0", "1.9.9", 1],
    ["1.2", "1.2.0", 0],
    ["0.9.1", "1.0.0", -1],
    ["2.0.0-beta", "2.0.0", 0],
  ])("%s ? %s → %i", (a, b, r) => {
    expect(compareVersions(a, b)).toBe(r);
  });
});

describe("evaluateVersionPolicy", () => {
  const policy = {
    platforms: {
      ios: { min_version: "1.2.0", latest_version: "1.3.0", force_update: true, store_url: "https://apps.apple.com/x", message: "" },
      android: { min_version: "2.0.0", latest_version: "2.0.0", force_update: false, store_url: "", message: "Lütfen güncelleyin" },
    },
  };

  it("sunucu status döndürdüyse onu kullanır", () => {
    expect(
      evaluateVersionPolicy({ ...policy, status: { platform: "ios", app_version: "1.0.0", update_required: true, update_available: true } }, "ios", "9.9.9")
        .required
    ).toBe(true);
  });

  it("minimumun altı + zorunlu → engeller", () => {
    expect(evaluateVersionPolicy(policy, "ios", "1.1.0")).toMatchObject({ required: true, available: true, storeUrl: "https://apps.apple.com/x" });
  });

  it("zorunlu değilse asla engellemez", () => {
    expect(evaluateVersionPolicy(policy, "android", "1.0.0")).toMatchObject({ required: false, available: true, message: "Lütfen güncelleyin" });
  });

  it("politika yoksa veya platform bilinmiyorsa engellemez (çevrimdışı kullanım)", () => {
    expect(evaluateVersionPolicy(undefined, "ios", "0.1.0").required).toBe(false);
    expect(evaluateVersionPolicy(policy, null, "0.1.0").required).toBe(false);
  });

  it("eski backend alanlarıyla da çalışır", () => {
    expect(evaluateVersionPolicy({ ios_min: "1.5.0", force_update: true }, "ios", "1.4.9").required).toBe(true);
  });
});

describe("appConfigApi", () => {
  let mock: MockAdapter;
  beforeEach(() => {
    mock = new MockAdapter(apiClient);
  });
  afterEach(() => mock.restore());

  it("min-version oturumsuz istenir, platform ve sürüm gönderilir", async () => {
    mock.onGet("/app/min-version/").reply(200, { ios_min: "1.0.0" });
    await appConfigApi.versionPolicy();
    const req = mock.history.get[0];
    expect(req.headers?.Authorization).toBeUndefined();
    expect(req.params).toHaveProperty("version");
  });

  it("config yanıtını normalize eder (bozuk alanlara dayanıklı)", async () => {
    mock.onGet("/app/config/").reply(200, { permissions: ["owner", 3], modules: [{ key: "stock" }, null], enums: null });
    const cfg = await appConfigApi.config();
    expect(cfg.permissions).toEqual(["owner"]);
    expect(cfg.modules).toEqual([{ key: "stock" }]);
    expect(cfg.enums).toEqual({});
  });

  it("normalizeConfig boş girdide güvenli varsayılan", () => {
    expect(normalizeConfig(undefined)).toMatchObject({ permissions: [], modules: [], features: [] });
  });
});

describe("moduleVisible / enumLabel", () => {
  it("sunucu modülleri varsa tek kaynak odur", () => {
    expect(moduleVisible([{ key: "stock" }], "stock", () => false)).toBe(true);
    expect(moduleVisible([{ key: "stock" }], "cards", () => true)).toBe(false);
  });
  it("sunucu modülü yoksa yerel kurala düşer", () => {
    expect(moduleVisible(undefined, "cards", () => true)).toBe(true);
    expect(moduleVisible([], "cards", () => false)).toBe(false);
  });
  it("enum etiketi sunucudan, yoksa yedek", () => {
    const enums = { machine_type: [{ value: 0, label: "Snack" }, { value: 1, label: "Kahve" }] };
    expect(enumLabel(enums, "machine_type", 1, "?")).toBe("Kahve");
    expect(enumLabel(enums, "machine_type", "0", "?")).toBe("Snack");
    expect(enumLabel(enums, "payment_type", 3, "Multinet")).toBe("Multinet");
  });
});

describe("checkForOtaUpdate", () => {
  const deps = (over: Partial<OtaDeps> = {}): OtaDeps => ({
    isEnabled: true,
    checkForUpdateAsync: jest.fn(async () => ({ isAvailable: true })),
    fetchUpdateAsync: jest.fn(async () => ({ isNew: true })),
    now: () => 1_000_000,
    ...over,
  });

  beforeEach(() => __resetOtaForTests());

  it("devre dışıysa hiçbir şey yapmaz (geliştirme)", async () => {
    const d = deps({ isEnabled: false });
    await checkForOtaUpdate({}, d);
    expect(d.checkForUpdateAsync).not.toHaveBeenCalled();
  });

  it("güncelleme varsa indirir ve hazır işaretler", async () => {
    const d = deps();
    await checkForOtaUpdate({}, d);
    expect(d.fetchUpdateAsync).toHaveBeenCalledTimes(1);
    expect(useOtaStore.getState().phase).toBe("ready");
  });

  it("30 dk içinde tekrar kontrol etmez (sunucu yükü)", async () => {
    const d = deps({ checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })) });
    await checkForOtaUpdate({}, d);
    await checkForOtaUpdate({}, { ...d, now: () => 1_000_000 + 10 * 60_000 });
    expect(d.checkForUpdateAsync).toHaveBeenCalledTimes(1);
    await checkForOtaUpdate({}, { ...d, now: () => 1_000_000 + 31 * 60_000 });
    expect(d.checkForUpdateAsync).toHaveBeenCalledTimes(2);
  });

  it("eşzamanlı çağrılar tek kontrole birleşir", async () => {
    const d = deps({ checkForUpdateAsync: jest.fn(async () => ({ isAvailable: false })) });
    await Promise.all([checkForOtaUpdate({ force: true }, d), checkForOtaUpdate({ force: true }, d)]);
    expect(d.checkForUpdateAsync).toHaveBeenCalledTimes(1);
  });

  it("ağ hatasında uygulamayı bozmaz, hata durumuna geçer", async () => {
    const d = deps({ checkForUpdateAsync: jest.fn(async () => Promise.reject(new Error("offline"))) });
    await expect(checkForOtaUpdate({}, d)).resolves.toBeUndefined();
    expect(useOtaStore.getState()).toMatchObject({ phase: "error", error: "offline" });
  });
});
