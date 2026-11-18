import React, { createContext, useContext } from "react";
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
 * İç içe sayfa derinliği. Bir sayfanın içinden açılan ikinci sayfa (ör. form → silme onayı)
 * kendi tam koyu arka planını çizerse kararma ikiye katlanır ve alttaki form kaybolur;
 * iç sayfa bu yüzden arka planını hafif çizer.
 */
const SheetDepthContext = createContext(0);

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
  const depth = useContext(SheetDepthContext);
  const close = () => {
    if (!dismissible) return;
    if (dirty) confirmDiscard(onClose);
    else onClose();
  };
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close} statusBarTranslucent>
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
            >
              <SheetDepthContext.Provider value={depth + 1}>{children}</SheetDepthContext.Provider>
            </ScrollView>
          ) : (
            <View style={[styles.body, styles.bodyContent]}>
              <SheetDepthContext.Provider value={depth + 1}>{children}</SheetDepthContext.Provider>
            </View>
          )}
          {footer ? (
            <View style={styles.footer}>
              <SheetDepthContext.Provider value={depth + 1}>{footer}</SheetDepthContext.Provider>
            </View>
          ) : null}
        </View>
      </KeyboardAvoidingView>
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
    body: { flexGrow: 0 },
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
