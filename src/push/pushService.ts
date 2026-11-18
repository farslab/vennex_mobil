/**
 * Push bildirimleri — Firebase Cloud Messaging (proje "vennexmobile").
 *
 * Backend sözleşmesi (vennex_mobile/views/device.py, fcm_service.py):
 *   POST /device/register/   { fcm_token, platform, device_id }   (upsert, idempotent)
 *   POST /device/unregister/ { fcm_token }
 * iOS'ta da FCM token'ı gerekir (backend firebase-admin ile gönderir) → RN Firebase Messaging.
 *
 * Akış:
 *  - Oturum açılınca: izin iste (iOS / Android 13+) → token al → kaydet; token yenilenince tekrar kaydet.
 *  - Çıkışta: kayıt sil (oturum token'ı henüz geçerliyken) → yerel FCM token'ını sil.
 *  - Ön planda gelen bildirim: kısa bilgi + bildirim sayaçlarını tazele.
 *  - Bildirime dokunma (arka plan / kapalı uygulama): ilgili ekrana git (notificationTarget).
 */
import { PermissionsAndroid, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  AuthorizationStatus,
  deleteToken,
  getInitialNotification,
  getMessaging,
  getToken,
  onMessage,
  onNotificationOpenedApp,
  onTokenRefresh,
  requestPermission,
} from "@react-native-firebase/messaging";
import { authApi } from "@/api/auth";
import { queryKeys } from "@/api/queryKeys";
import { queryClient } from "@/store/queryClient";
import { toast } from "@/design-system";
import { navigateWhenReady } from "@/navigation/navigationRef";
import { resolveNotificationTarget } from "@/screens/notifications/notificationTarget";
import type { AuthUser } from "@/types/auth";
import { PUSH_ENABLED } from "@/config/env";

const DEVICE_ID_KEY = "vennex.push.deviceId";
const REGISTERED_TOKEN_KEY = "vennex.push.registeredToken";

type RemoteData = Record<string, string | object | undefined> | undefined;
interface RemoteLike {
  data?: RemoteData;
  notification?: { title?: string; body?: string };
}

let unsubscribers: (() => void)[] = [];
let currentUser: (() => AuthUser | null) | null = null;

function isSupported() {
  return PUSH_ENABLED && (Platform.OS === "ios" || Platform.OS === "android");
}

/** Kuruluma özgü, kişisel veri içermeyen cihaz kimliği */
export async function getInstallDeviceId(): Promise<string> {
  const saved = await AsyncStorage.getItem(DEVICE_ID_KEY).catch(() => null);
  if (saved) return saved;
  const id = `vm-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  await AsyncStorage.setItem(DEVICE_ID_KEY, id).catch(() => {});
  return id;
}

export async function ensurePushPermission(): Promise<boolean> {
  if (Platform.OS === "android") {
    if (typeof Platform.Version === "number" && Platform.Version >= 33) {
      const res = await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      return res === PermissionsAndroid.RESULTS.GRANTED;
    }
    return true;
  }
  const status = await requestPermission(getMessaging());
  return status === AuthorizationStatus.AUTHORIZED || status === AuthorizationStatus.PROVISIONAL;
}

async function registerToken(token: string) {
  const platform = Platform.OS === "ios" ? "ios" : "android";
  const deviceId = await getInstallDeviceId();
  await authApi.registerDevice(token, platform, deviceId);
  await AsyncStorage.setItem(REGISTERED_TOKEN_KEY, token).catch(() => {});
}

/** Bildirim verisinden uygulama içi hedefe git (yetki kontrollü; hedef yoksa bildirim merkezi) */
export function openFromNotification(message: RemoteLike | null | undefined, user: AuthUser | null) {
  if (!message) return;
  const target = resolveNotificationTarget({ data: (message.data ?? null) as never }, user);
  if (target) navigateWhenReady(target.name, target.params);
  else navigateWhenReady("Notifications");
}

/**
 * Oturum açıkken çağrılır. Hata uygulamayı bozmaz (push isteğe bağlı bir kanaldır).
 * @returns kaydedilen token veya null
 */
export async function startPush(getUser: () => AuthUser | null): Promise<string | null> {
  if (!isSupported()) return null;
  stopPushListeners();
  currentUser = getUser;
  try {
    const messaging = getMessaging();

    unsubscribers.push(
      onMessage(messaging, (msg: RemoteLike) => {
        const title = msg.notification?.title || msg.notification?.body;
        if (title) toast.info(title);
        queryClient.invalidateQueries({ queryKey: queryKeys.notifications.all });
      }),
      onNotificationOpenedApp(messaging, (msg: RemoteLike) => openFromNotification(msg, currentUser?.() ?? null)),
      onTokenRefresh(messaging, (token: string) => {
        registerToken(token).catch(() => {});
      })
    );

    // Uygulama kapalıyken bildirime dokunularak açıldıysa
    const initial = await getInitialNotification(messaging);
    if (initial) openFromNotification(initial as RemoteLike, getUser());

    if (!(await ensurePushPermission())) return null;
    const token = await getToken(messaging);
    if (!token) return null;
    await registerToken(token);
    return token;
  } catch {
    return null;
  }
}

export function stopPushListeners() {
  unsubscribers.forEach((u) => u());
  unsubscribers = [];
}

/** Çıkıştan ÖNCE çağrılır (kayıt silme isteği oturum token'ı ister) */
export async function stopPush(): Promise<void> {
  stopPushListeners();
  currentUser = null;
  if (!isSupported()) return;
  try {
    const token = await AsyncStorage.getItem(REGISTERED_TOKEN_KEY);
    if (token) await authApi.unregisterDevice(token).catch(() => {});
    await AsyncStorage.removeItem(REGISTERED_TOKEN_KEY).catch(() => {});
    // Aynı cihazda başka kullanıcı giriş yaparsa yeni token üretilsin
    await deleteToken(getMessaging()).catch(() => {});
  } catch {
    // push kaydı silinemese de çıkış tamamlanır; backend geçersiz token'ları zaten temizler
  }
}
