import { createNavigationContainerRef } from "@react-navigation/native";
import type { RootStackParamList } from "./types";

/**
 * Bileşen dışından (push bildirimi tıklaması gibi) gezinme için. Navigator hazır değilse
 * hedef bekletilir ve hazır olunca uygulanır.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>();

type PendingNav = { name: keyof RootStackParamList; params?: object };
let pending: PendingNav | null = null;

export function navigateWhenReady(name: keyof RootStackParamList, params?: object) {
  if (navigationRef.isReady()) {
    // Rota adı + parametre çifti çağıran tarafta tipli üretilir (notificationTarget)
    (navigationRef.navigate as (n: string, p?: object) => void)(name, params);
    return;
  }
  pending = { name, params };
}

/** NavigationContainer onReady içinde çağrılır */
export function flushPendingNavigation() {
  if (pending && navigationRef.isReady()) {
    const p = pending;
    pending = null;
    (navigationRef.navigate as (n: string, p?: object) => void)(p.name, p.params);
  }
}
