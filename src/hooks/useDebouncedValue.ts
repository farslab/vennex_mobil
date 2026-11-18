import { useEffect, useState } from "react";

/** Değeri `delay` ms sabit kaldıktan sonra döndürür (arama sorguları için 350 ms) */
export function useDebouncedValue<T>(value: T, delay = 350): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}
