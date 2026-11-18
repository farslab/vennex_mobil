/**
 * Tam ekran formlarda kaydedilmemiş değişiklik varken geri / kaydırarak çıkış / sekme dışı
 * gezinmeyi onaya bağlar. Başarılı kayıttan sonra ekranın kendi çıkışı uyarı göstermesin diye
 * `leave(() => navigation.goBack())` kullanılır.
 */
import { useCallback, useRef } from "react";
import { useNavigation, usePreventRemove } from "@react-navigation/native";
import { confirmDiscard } from "@/design-system";

export function useUnsavedChangesGuard(dirty: boolean) {
  const navigation = useNavigation();
  const bypass = useRef(false);

  usePreventRemove(dirty, ({ data }) => {
    if (bypass.current) {
      navigation.dispatch(data.action);
      return;
    }
    confirmDiscard(() => navigation.dispatch(data.action));
  });

  /** Kaydetme sonrası gibi bilinçli çıkışlarda uyarıyı atla */
  const leave = useCallback((go: () => void) => {
    bypass.current = true;
    go();
  }, []);

  return { leave };
}
