import type { LinkingOptions } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

/**
 * Derin bağlantılar (vennex://...). Tek ve her zaman etkin bir yapılandırma: NavigationContainer
 * `linking`'i yalnız ilk bağlanışta okur; oturum açılıp kapandığında değiştirmek etkisizdir.
 * Güvenlik, o an kayıtlı ekranlarla sağlanır: yollar yalnız oturum açıkken kayıtlı olan uygulama
 * ekranlarına karşılık gelir; oturum kapalıyken gelen bağlantılar yok sayılır (giriş ekranı açık kalır). Parametreler ekranlarda
 * doğrulanır, yetki backend'de yeniden kontrol edilir.
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
