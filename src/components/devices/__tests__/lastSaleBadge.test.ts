import { lastSaleBadge } from "@/components/devices/deviceHelpers";

describe("lastSaleBadge (web last_tx_badge ile aynı)", () => {
  const now = new Date("2026-11-19T15:00:00Z");
  const ago = (min: number) => new Date(now.getTime() - min * 60000).toISOString();

  it("< 60 dk yeşil, 60–120 sarı, > 120 kırmızı; satış yoksa gri", () => {
    expect(lastSaleBadge(ago(0), now)).toEqual({ label: "0 dakika", color: "emerald" });
    expect(lastSaleBadge(ago(59), now)).toEqual({ label: "59 dakika", color: "emerald" });
    expect(lastSaleBadge(ago(60), now)).toEqual({ label: "1 saat", color: "amber" });
    expect(lastSaleBadge(ago(95), now)).toEqual({ label: "1 saat 35 dakika", color: "amber" });
    expect(lastSaleBadge(ago(120), now)).toEqual({ label: "2 saat", color: "red" });
    expect(lastSaleBadge(ago(60 * 50 + 3), now)).toEqual({ label: "50 saat 3 dakika", color: "red" });
    expect(lastSaleBadge(null, now)).toEqual({ label: "—", color: "gray" });
    expect(lastSaleBadge("bozuk", now)).toEqual({ label: "—", color: "gray" });
  });
});
