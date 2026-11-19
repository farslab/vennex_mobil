import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { makeStyles } from "../theme";
import { AppText } from "./AppText";
import { AppIconButton } from "./AppIconButton";
import { confirmDiscard } from "../hooks/useUnsavedChanges";
import { AppToastHost, useToastHostStore } from "./AppToast";

export interface AppSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  /** Altta sabit aksiyon alanı (Kaydet/İptal) */
  footer?: React.ReactNode;
  /** İçerik kaydırılabilir mi (formlar için true) */
  scrollable?: boolean;
  /** İşlem sürerken arka plana dokunarak kapatmayı engelle */
  dismissible?: boolean;
  /** Kaydedilmemiş değişiklik var: X / arka plan / geri tuşu önce onay ister (`useFormDirty`) */
  dirty?: boolean;
  testID?: string;
}

/**
 * İç içe sayfa bağlamı.
 * - depth: içteki sayfa (ör. form → onay) arka planını hafif çizer; kararma ikiye katlanmaz.
 * - setChildPresented: iOS'ta iç içe iki Modal AYNI ANDA kapanırsa ekranda görünmez bir pencere
 *   kalır ve uygulama dokunmalara kapanır (React Native bilinen sorunu; ör. stok hareketi
 *   kaydedilince form + onay birlikte kapanıyordu). Bu yüzden üst sayfa, içindeki sayfa tamamen
 *   kapanana (onDismiss / güvenlik süresi) kadar açık kalır, sonra kapanır.
 */
interface SheetContextValue {
  depth: number;
  setChildPresented: (id: number, presented: boolean) => void;
}
const SheetContext = createContext<SheetContextValue>({ depth: 0, setChildPresented: () => {} });

let sheetSeq = 0;
/** onDismiss gelmezse (Android/test) içteki sayfanın kapanmış sayılacağı süre */
export const CHILD_DISMISS_FALLBACK_MS = 450;

/**
 * Alttan açılan sayfa (bottom sheet). Ek native bağımlılık gerektirmez;
 * klavye açıldığında içerik yukarı kayar, safe area'ya uyar.
 */
export function AppSheet({
  visible,
  onClose,
  title,
  subtitle,
  children,
  footer,
  scrollable = true,
  dismissible = true,
  dirty = false,
  testID,
}: AppSheetProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const parent = useContext(SheetContext);
  const depth = parent.depth;
  const [id] = useState(() => ++sheetSeq);

  // Bu sayfa ekranda mı (kapanma animasyonu dahil)? Açılınca hemen, kapanınca onDismiss'te false.
  const [presented, setPresented] = useState(visible);
  if (visible && !presented) setPresented(true);
  useEffect(() => {
    if (visible || !presented) return;
    const t = setTimeout(() => setPresented(false), CHILD_DISMISS_FALLBACK_MS);
    return () => clearTimeout(t);
  }, [visible, presented]);
  const { setChildPresented } = parent;
  useEffect(() => {
    setChildPresented(id, presented);
    return () => setChildPresented(id, false);
  }, [setChildPresented, id, presented]);

  // İçteki sayfalardan biri hâlâ ekrandaysa bu sayfa kapanmayı bekler
  const [openChildren, setOpenChildren] = useState<ReadonlySet<number>>(() => new Set());
  const onChildPresented = useCallback((childId: number, on: boolean) => {
    setOpenChildren((cur) => {
      if (cur.has(childId) === on) return cur;
      const next = new Set(cur);
      if (on) next.add(childId);
      else next.delete(childId);
      return next;
    });
  }, []);
  const childContext = useMemo<SheetContextValue>(
    () => ({ depth: depth + 1, setChildPresented: onChildPresented }),
    [depth, onChildPresented]
  );
  const modalVisible = visible || openChildren.size > 0;

  // Açıkken toast bu sayfanın Modal'ında çizilir (kökteki konak Modal'ın altında kalır)
  const registerToastHost = useToastHostStore((s) => s.register);
  const unregisterToastHost = useToastHostStore((s) => s.unregister);
  useEffect(() => {
    if (!visible) return;
    registerToastHost(id);
    return () => unregisterToastHost(id);
  }, [visible, id, registerToastHost, unregisterToastHost]);

  const close = () => {
    if (!dismissible) return;
    if (dirty) confirmDiscard(onClose);
    else onClose();
  };
  return (
    <Modal
      visible={modalVisible}
      transparent
      animationType="slide"
      onRequestClose={close}
      onDismiss={() => setPresented(false)}
      statusBarTranslucent
    >
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <Pressable
          style={[styles.backdrop, depth > 0 && styles.backdropNested]}
          onPress={close}
          accessibilityLabel="Kapat"
          accessibilityRole="button"
          testID={testID ? `${testID}-backdrop` : undefined}
        />
        <View
          testID={testID}
          style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}
          accessibilityViewIsModal
        >
          <View style={styles.handle} />
          <View style={styles.header}>
            <View style={styles.flex}>
              <AppText variant="headline" accessibilityRole="header">
                {title}
              </AppText>
              {subtitle ? (
                <AppText variant="caption" color="textTertiary">
                  {subtitle}
                </AppText>
              ) : null}
            </View>
            <AppIconButton icon="x" label="Kapat" onPress={close} disabled={!dismissible} />
          </View>
          {scrollable ? (
            <ScrollView
              style={styles.body}
              contentContainerStyle={styles.bodyContent}
              keyboardShouldPersistTaps="handled"
              // iOS sayısal klavyede "Bitti" yok: sayfayı sürükleyerek klavye kapatılabilsin
              keyboardDismissMode={Platform.OS === "ios" ? "interactive" : "on-drag"}
            >
              <SheetContext.Provider value={childContext}>{children}</SheetContext.Provider>
            </ScrollView>
          ) : (
            <View style={[styles.body, styles.bodyContent]}>
              <SheetContext.Provider value={childContext}>{children}</SheetContext.Provider>
            </View>
          )}
          {footer ? (
            <View style={styles.footer}>
              <SheetContext.Provider value={childContext}>{footer}</SheetContext.Provider>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
      <AppToastHost hostId={id} />
    </Modal>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    flex: { flex: 1 },
    backdrop: { ...StyleSheet.absoluteFill, backgroundColor: t.colors.overlay },
    /** İç içe sayfa: alttaki sayfa zaten karartıyor → yarım kararma yeter */
    backdropNested: { opacity: 0.5 },
    sheet: {
      marginTop: "auto",
      maxHeight: "90%",
      // Klavye açıkken (KeyboardAvoidingView alanı daralınca) sayfa da küçülsün; başlık ve alt düğmeler görünür kalır
      flexShrink: 1,
      // iPad: ekranlarla aynı okunabilir genişlikte, ortalı (telefonda etkisiz)
      width: "100%",
      maxWidth: t.layout.maxContentWidth,
      alignSelf: "center",
      backgroundColor: t.colors.surface,
      borderTopLeftRadius: t.radius.xl,
      borderTopRightRadius: t.radius.xl,
      ...t.elevation(3),
    },
    handle: {
      alignSelf: "center",
      width: 36,
      height: 4,
      borderRadius: 2,
      backgroundColor: t.colors.borderStrong,
      marginTop: t.spacing.sm,
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      paddingLeft: t.layout.screenPadding,
      paddingRight: t.spacing.xs,
      paddingVertical: t.spacing.xs,
      gap: t.spacing.sm,
    },
    /** İçerik büyükse gövde küçülür (başlık/alt aksiyonlar sabit kalır) */
    body: { flexGrow: 0, flexShrink: 1 },
    bodyContent: { paddingHorizontal: t.layout.screenPadding, paddingBottom: t.spacing.lg, gap: t.spacing.lg },
    footer: {
      flexDirection: "row",
      gap: t.spacing.md,
      paddingHorizontal: t.layout.screenPadding,
      paddingTop: t.spacing.md,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: t.colors.border,
    },
  })
);
