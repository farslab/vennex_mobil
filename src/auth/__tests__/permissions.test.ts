import {
  canChangeCardBalance,
  canManageDeviceSettings,
  canManageUsers,
  canViewSales,
  cariStateInfo,
  hasPermission,
  showCardsModule,
  showStockModule,
} from "@/auth/permissions";
import { makeUser } from "@/test/utils";

describe("permissions — varsayılan RED", () => {
  it("kullanıcı yoksa hiçbir yetki yok", () => {
    expect(hasPermission(null, "view_sales")).toBe(false);
    expect(canViewSales(undefined)).toBe(false);
  });

  it("permissions alanı eksik/bozuksa yetki yok (eski `?? true` hatası)", () => {
    const broken = { ...makeUser(), permissions: undefined as unknown as string[] };
    expect(canViewSales(broken)).toBe(false);
    expect(canManageDeviceSettings(broken)).toBe(false);
  });

  it("yalnızca listede olan yetkiler verilir", () => {
    const user = makeUser({ role: "tech", permissions: ["tech", "view_sales"] });
    expect(canViewSales(user)).toBe(true);
    expect(canManageDeviceSettings(user)).toBe(false);
    expect(canChangeCardBalance(user)).toBe(false);
  });

  it("kullanıcı yönetimi yalnızca owner", () => {
    expect(canManageUsers(makeUser({ role: "owner" }))).toBe(true);
    expect(canManageUsers(makeUser({ role: "tech" }))).toBe(false);
    expect(canManageUsers(makeUser({ role: "admin" }))).toBe(false);
  });
});

describe("modül görünürlüğü", () => {
  const company = { id: 1, name: "A", cari_state: 0, has_personnel_card_device: false, uses_stock_mode: false };

  it("kart modülü: yetki + şirkette personel kart cihazı gerekir", () => {
    const user = makeUser({ permissions: ["manage_personel_card"] });
    expect(showCardsModule(user, company)).toBe(false);
    expect(showCardsModule(user, { ...company, has_personnel_card_device: true })).toBe(true);
    expect(showCardsModule(makeUser({ permissions: [] }), { ...company, has_personnel_card_device: true })).toBe(false);
  });

  it("stok modülü: yetki + stok modu gerekir", () => {
    const user = makeUser({ permissions: ["manage_stock"] });
    expect(showStockModule(user, company)).toBe(false);
    expect(showStockModule(user, { ...company, uses_stock_mode: true })).toBe(true);
  });
});

describe("cariStateInfo", () => {
  it("bilinen ve bilinmeyen durumlar", () => {
    expect(cariStateInfo(0).label).toBe("Temiz");
    expect(cariStateInfo(4).tone).toBe("danger");
    expect(cariStateInfo(99).label).toBe("Bilinmiyor");
    expect(cariStateInfo(null).label).toBe("Bilinmiyor");
  });
});
