/**
 * Kaydedilmemiş değişiklik koruması.
 *
 * - `useFormDirty(open, values)`: formun açılıştaki (kendi sıfırlaması uygulandıktan sonraki)
 *   değerleriyle şimdiki değerleri kıyaslar. Formlar açılışta değerlerini render sırasında
 *   sıfırladığı için temel değer bir sonraki render turunda alınır (effect kullanılmaz).
 * - `confirmDiscard(onDiscard)`: yerel uyarı penceresi (Alert). İç içe Modal açmadığı için
 *   alttan açılan sayfaların üzerinde güvenle çalışır.
 * - `useGuardedClose(dirty, onClose)`: Vazgeç/Kapat butonları için korumalı kapatma.
 */
import { useCallback, useState } from "react";
import { Alert } from "react-native";

export const DISCARD_TITLE = "Değişiklikler kaydedilmedi";
export const DISCARD_MESSAGE = "Çıkarsanız girdiğiniz bilgiler kaybolur.";

export function confirmDiscard(onDiscard: () => void) {
  Alert.alert(DISCARD_TITLE, DISCARD_MESSAGE, [
    { text: "Düzenlemeye devam et", style: "cancel" },
    { text: "Çık", style: "destructive", onPress: onDiscard },
  ]);
}

/** Açılış anı: formun kendi sıfırlaması aynı render turunda uygulanana kadar temel alınmaz */
const PENDING = "\u0000pending";

export function useFormDirty(open: boolean, values: unknown): boolean {
  const current = JSON.stringify(values ?? null);
  const [base, setBase] = useState<string | null>(open ? PENDING : null);
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    // Açıldı/kapandı: bu turdaki sıfırlamalar (useOnOpen vb.) bir sonraki renderda görünür
    setWasOpen(open);
    setBase(open ? PENDING : null);
  } else if (open && base === PENDING) {
    // Sıfırlanmış değerler artık geçerli → temel al
    setBase(current);
  }
  return open && base !== null && base !== PENDING && base !== current;
}

export function useGuardedClose(dirty: boolean, onClose: () => void): () => void {
  return useCallback(() => {
    if (dirty) confirmDiscard(onClose);
    else onClose();
  }, [dirty, onClose]);
}
