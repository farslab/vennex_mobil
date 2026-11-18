/**
 * OTA (JS) güncellemeleri — Xavia OTA sunucusu (ota.vennex.com.tr), expo-updates protokolü.
 *
 * Mağaza kurallarına uygun davranış:
 *  - Yalnız JS/asset değişir; native kod mağaza sürümüyle gelir (runtimeVersion = "vm-<mağaza sürümü>").
 *  - Açılış hiç bekletilmez: kontrol arka planda yapılır, indirilen paket bir sonraki
 *    soğuk açılışta veya kullanıcı "Yeniden başlat" dediğinde devreye girer.
 *  - Kontrol sıklığı sınırlıdır (30 dk) — sunucuyu yormaz.
 *  - Bozuk paket: expo-updates hata kurtarması gömülü pakete geri döner.
 */
import { AppState, type AppStateStatus } from "react-native";
import * as Updates from "expo-updates";
import { create } from "zustand";

const MIN_INTERVAL_MS = 30 * 60 * 1000;

type OtaPhase = "idle" | "checking" | "downloading" | "ready" | "error";

interface OtaState {
  phase: OtaPhase;
  lastCheckedAt: number | null;
  error: string | null;
  set: (patch: Partial<Omit<OtaState, "set">>) => void;
}

export const useOtaStore = create<OtaState>((set) => ({
  phase: "idle",
  lastCheckedAt: null,
  error: null,
  set: (patch) => set(patch),
}));

/** Test edilebilirlik için bağımlılıklar enjekte edilebilir */
export interface OtaDeps {
  isEnabled: boolean;
  checkForUpdateAsync: () => Promise<{ isAvailable: boolean }>;
  fetchUpdateAsync: () => Promise<{ isNew: boolean }>;
  now: () => number;
}

const defaultDeps = (): OtaDeps => ({
  isEnabled: Updates.isEnabled && !__DEV__,
  checkForUpdateAsync: () => Updates.checkForUpdateAsync(),
  fetchUpdateAsync: () => Updates.fetchUpdateAsync(),
  now: () => Date.now(),
});

let inFlight: Promise<void> | null = null;

/** Güncelleme var mı bak, varsa indir. Eşzamanlı çağrılar tek işleme birleşir. */
export function checkForOtaUpdate(options: { force?: boolean } = {}, deps: OtaDeps = defaultDeps()): Promise<void> {
  if (!deps.isEnabled) return Promise.resolve();
  const store = useOtaStore.getState();
  if (store.phase === "ready") return Promise.resolve();
  if (!options.force && store.lastCheckedAt && deps.now() - store.lastCheckedAt < MIN_INTERVAL_MS) {
    return Promise.resolve();
  }
  inFlight ??= (async () => {
    store.set({ phase: "checking", error: null, lastCheckedAt: deps.now() });
    try {
      const check = await deps.checkForUpdateAsync();
      if (!check.isAvailable) {
        store.set({ phase: "idle" });
        return;
      }
      store.set({ phase: "downloading" });
      const fetched = await deps.fetchUpdateAsync();
      store.set({ phase: fetched.isNew ? "ready" : "idle" });
    } catch (e) {
      // Ağ yok / sunucu kapalı: sessizce bir sonraki fırsatta tekrar denenir
      store.set({ phase: "error", error: e instanceof Error ? e.message : String(e) });
    }
  })().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** İndirilen paketi hemen uygula (kullanıcı onayıyla) */
export async function applyOtaUpdate() {
  await Updates.reloadAsync();
}

/** Açılışta ve uygulama ön plana her geldiğinde (sınırlı sıklıkta) kontrol eder */
export function startOtaWatcher(): () => void {
  checkForOtaUpdate();
  const sub = AppState.addEventListener("change", (s: AppStateStatus) => {
    if (s === "active") checkForOtaUpdate();
  });
  return () => sub.remove();
}

/** Ekranda gösterilecek sürüm bilgisi (Profil → Hakkında) */
export function currentBundleInfo() {
  return {
    runtimeVersion: Updates.runtimeVersion ?? null,
    updateId: Updates.updateId ?? null,
    isEmbedded: Updates.isEmbeddedLaunch,
    channel: Updates.channel ?? null,
    createdAt: Updates.createdAt ? Updates.createdAt.toISOString() : null,
  };
}

/** Yalnız testler için */
export function __resetOtaForTests() {
  inFlight = null;
  useOtaStore.setState({ phase: "idle", lastCheckedAt: null, error: null });
}
