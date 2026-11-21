import { displayVersion } from "../build";

describe("displayVersion", () => {
  it("mağaza paketinde yalnız sürüm", () => {
    expect(displayVersion("1.0.0", null)).toBe("1.0.0");
  });
  it("OTA paketinde sürüm-OTA numarası", () => {
    expect(displayVersion("2.0.4", "5")).toBe("2.0.4-5");
  });
  it("sürüm yoksa", () => {
    expect(displayVersion(undefined, null)).toBeNull();
    expect(displayVersion("", "3")).toBe("OTA 3");
  });
});
