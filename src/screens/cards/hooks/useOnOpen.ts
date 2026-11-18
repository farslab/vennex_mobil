import { useState } from "react";

/**
 * Değer değiştiğinde (render sırasında) bir kez çalışır — "önceki prop'a göre state ayarla"
 * React kalıbı. Sheet açılışında form state'ini sıfırlamak için effect yerine kullanılır.
 */
export function useOnValueChange<T>(value: T, onChange: (value: T) => void) {
  const [prev, setPrev] = useState(value);
  if (!Object.is(prev, value)) {
    setPrev(value);
    onChange(value);
  }
}

/** `open` false→true olduğunda çalışır */
export function useOnOpen(open: boolean, onOpen: () => void) {
  useOnValueChange(open, (o) => {
    if (o) onOpen();
  });
}
