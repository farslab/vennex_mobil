/**
 * Ekran kayıt tablosu — navigator ile ekran modüllerini ayırır. Modüller yeniden
 * yazıldıkça yalnızca bu dosyadaki eşleme değişir.
 */
import type React from "react";
import type { RootStackParamList } from "./types";

import DashboardScreen from "@/screens/dashboard/DashboardScreen";
import DevicesListScreen from "@/screens/devices/list/DevicesListScreen";
import CardsScreen from "@/screens/cards/CardsScreen";
import CardDetailScreen from "@/screens/cards/CardDetailScreen";
import StockScreen from "@/screens/stock/StockScreen";
import StockLocationDetailScreen from "@/screens/stock/StockLocationDetailScreen";
import ProfileScreen from "@/screens/profile/ProfileScreen";
import DeviceDetailScreen from "@/screens/devices/detail/DeviceDetailScreen";
import ProductTemplatesScreen from "@/screens/devices/templates/ProductTemplatesScreen";
import TemplateEditorScreen from "@/screens/devices/templates/TemplateEditorScreen";
import NotificationsScreen from "@/screens/notifications/NotificationsScreen";
import ReportsListScreen from "@/screens/reports/ReportsListScreen";
import NewReportScreen from "@/screens/reports/NewReportScreen";
import ReportDetailScreen from "@/screens/reports/ReportDetailScreen";
import UsersScreen from "@/screens/users/UsersScreen";
import UserFormScreen from "@/screens/users/UserFormScreen";
import EditProfileScreen from "@/screens/account/EditProfileScreen";
import SecurityScreen from "@/screens/account/SecurityScreen";
import NotificationSettingsScreen from "@/screens/account/NotificationSettingsScreen";
import CompanyAccountScreen from "@/screens/account/CompanyAccountScreen";
import RegionsScreen from "@/screens/account/RegionsScreen";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyScreen = React.ComponentType<any>;

interface StackEntry {
  name: Exclude<keyof RootStackParamList, "Tabs" | "LegalDocument">;
  component: AnyScreen;
  title: string;
  headerShown?: boolean;
}

export const screenRegistry: {
  Dashboard: AnyScreen;
  Devices: AnyScreen;
  Cards: AnyScreen;
  Stock: AnyScreen;
  Profile: AnyScreen;
  stack: StackEntry[];
} = {
  Dashboard: DashboardScreen,
  Devices: DevicesListScreen,
  Cards: CardsScreen,
  Stock: StockScreen,
  Profile: ProfileScreen,
  stack: [
    { name: "DeviceDetail", component: DeviceDetailScreen, title: "Cihaz" },
    { name: "ProductTemplates", component: ProductTemplatesScreen, title: "Ürün Şablonları" },
    { name: "TemplateProductsEdit", component: TemplateEditorScreen, title: "Şablon Ürünleri" },
    { name: "Notifications", component: NotificationsScreen, title: "Bildirimler" },
    { name: "Reports", component: ReportsListScreen, title: "Raporlar" },
    { name: "NewReport", component: NewReportScreen, title: "Yeni Rapor" },
    { name: "ReportDetail", component: ReportDetailScreen, title: "Rapor ayrıntısı" },
    { name: "CardDetail", component: CardDetailScreen, title: "Kart Detayı" },
    { name: "Users", component: UsersScreen, title: "Kullanıcılar" },
    { name: "UserForm", component: UserFormScreen, title: "Teknisyen" },
    { name: "EditProfile", component: EditProfileScreen, title: "Profili düzenle" },
    { name: "Security", component: SecurityScreen, title: "Güvenlik" },
    { name: "NotificationSettings", component: NotificationSettingsScreen, title: "Bildirim tercihleri" },
    { name: "CompanyAccount", component: CompanyAccountScreen, title: "Şirket ve cari" },
    { name: "Regions", component: RegionsScreen, title: "Bölge ve konumlar" },
    { name: "StockLocationDetail", component: StockLocationDetailScreen, title: "Lokasyon" },
  ],
};
