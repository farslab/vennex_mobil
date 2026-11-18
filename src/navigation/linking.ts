import type { LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

/**
 * Derin bağlantılar (vennex://...). Yalnızca oturum açıkken etkin; parametreler
 * ekranlarda doğrulanır (ör. seri no formatı) ve yetki backend'de yeniden kontrol edilir.
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ["vennex://"],
  config: {
    screens: {
      Tabs: {
        screens: {
          Dashboard: "panel",
          Devices: "cihazlar",
          Cards: "kartlar",
          Stock: "stok",
          Profile: "profil",
        },
      },
      DeviceDetail: { path: "cihaz/:sn", parse: { sn: (sn: string) => decodeURIComponent(sn).slice(0, 64) } },
      Notifications: "bildirimler",
      Reports: "raporlar",
    },
  },
};
