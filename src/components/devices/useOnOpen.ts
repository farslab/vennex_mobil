import { useState } from "react";

/**
 * Sheet her açıldığında (visible false → true) `onOpen`'ı render sırasında bir kez çalıştırır.
 * React'in önerdiği "prop değişince state'i ayarla" kalıbı — effect içinde setState zinciri yerine.
 * `onOpen` yalnız bu bileşenin kendi state setter'larını çağırmalıdır.
 */
export function useOnOpen(visible: boolean, onOpen: () => void): void {
  const [prev, setPrev] = useState(visible);
  if (visible !== prev) {
    setPrev(visible);
    if (visible) onOpen();
  }
}
