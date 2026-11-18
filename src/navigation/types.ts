import type { NavigatorScreenParams } from "@react-navigation/native";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import type { BottomTabScreenProps } from "@react-navigation/bottom-tabs";
import type { CompositeScreenProps } from "@react-navigation/native";
import type { LegalDocumentSlug } from "@/types/legal";

export type AuthStackParamList = {
  Login: undefined;
  TwoFactor: undefined;
  ForgotPassword: undefined;
};

export type TabParamList = {
  Dashboard: undefined;
  Devices: undefined;
  Cards: undefined;
  Stock: undefined;
  Profile: undefined;
};

/**
 * Tek kök stack: sekmeler + tüm detay ekranları. Detay ekranları sekme çubuğunun
 * üzerine açılır; geri davranışı ve başlıklar her yerde tutarlıdır.
 */
export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  DeviceDetail: { sn: string; name?: string };
  ProductTemplates: undefined;
  TemplateProductsEdit: { templateId: number; title?: string };
  CardDetail: { id: number };
  StockLocationDetail: { locationId: number; name?: string };
  ReportDetail: { id: number };
  Notifications: undefined;
  Reports: undefined;
  NewReport: undefined;
  Users: undefined;
  UserForm: { userId?: number } | undefined;
  LegalDocument: { slug: LegalDocumentSlug };
  Security: undefined;
  EditProfile: undefined;
  NotificationSettings: undefined;
  CompanyAccount: undefined;
  Regions: undefined;
};

export type RootScreenProps<T extends keyof RootStackParamList> = NativeStackScreenProps<RootStackParamList, T>;

export type TabScreenProps<T extends keyof TabParamList> = CompositeScreenProps<
  BottomTabScreenProps<TabParamList, T>,
  NativeStackScreenProps<RootStackParamList>
>;

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace ReactNavigation {
    // eslint-disable-next-line @typescript-eslint/no-empty-object-type
    interface RootParamList extends RootStackParamList {}
  }
}
