import React, { forwardRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { makeStyles, useTheme } from "../theme";
import { AppText } from "./AppText";
import { AppIcon, type IconName } from "./AppIcon";

export interface AppInputProps extends Omit<TextInputProps, "style" | "editable"> {
  label?: string;
  /** Alan bazlı hata mesajı */
  error?: string | null;
  helper?: string;
  icon?: IconName;
  /** Şifre alanı — göster/gizle düğmesi ekler */
  secure?: boolean;
  disabled?: boolean;
  required?: boolean;
  /** Sağ tarafta sabit sonek (₺, adet vb.) */
  suffix?: string;
}

export const AppInput = forwardRef<TextInput, AppInputProps>(function AppInput(
  { label, error, helper, icon, secure, disabled, required, suffix, onFocus, onBlur, ...rest },
  ref
) {
  const { colors } = useTheme();
  const styles = useStyles();
  const [focused, setFocused] = useState(false);
  const [hidden, setHidden] = useState(true);

  const borderColor = error ? colors.danger : focused ? colors.primary : colors.border;

  return (
    <View style={styles.root}>
      {label ? (
        <AppText variant="label" color="textSecondary" style={styles.label}>
          {label}
          {required ? <AppText variant="label" color="danger"> *</AppText> : null}
        </AppText>
      ) : null}
      <View
        style={[
          styles.field,
          { borderColor, backgroundColor: disabled ? colors.surfaceMuted : colors.surface },
          focused && styles.focused,
        ]}
      >
        {icon ? <AppIcon name={icon} size={18} color="textTertiary" /> : null}
        <TextInput
          ref={ref}
          {...rest}
          editable={!disabled}
          secureTextEntry={secure ? hidden : rest.secureTextEntry}
          placeholderTextColor={colors.textTertiary}
          selectionColor={colors.primary}
          accessibilityLabel={rest.accessibilityLabel ?? label}
          accessibilityState={{ disabled: !!disabled }}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, { color: disabled ? colors.textDisabled : colors.text }]}
        />
        {suffix ? (
          <AppText variant="callout" color="textTertiary">
            {suffix}
          </AppText>
        ) : null}
        {secure ? (
          <Pressable
            onPress={() => setHidden((h) => !h)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Şifreyi göster" : "Şifreyi gizle"}
          >
            <AppIcon name={hidden ? "eye" : "eye-off"} size={18} color="textTertiary" />
          </Pressable>
        ) : null}
      </View>
      {error ? (
        <View style={styles.messageRow} accessibilityLiveRegion="polite">
          <AppIcon name="alert-circle" size={14} color="danger" />
          <AppText variant="caption" color="danger" style={styles.flex}>
            {error}
          </AppText>
        </View>
      ) : helper ? (
        <AppText variant="caption" color="textTertiary" style={styles.helper}>
          {helper}
        </AppText>
      ) : null}
    </View>
  );
});

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: { gap: t.spacing.xs },
    label: { marginBottom: 2 },
    field: {
      minHeight: t.layout.controlHeight,
      borderWidth: 1,
      borderRadius: t.radius.sm,
      paddingHorizontal: t.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.sm,
    },
    focused: { borderWidth: 1.5 },
    input: { flex: 1, fontSize: 15, paddingVertical: t.spacing.sm, minHeight: t.layout.controlHeight - 2 },
    messageRow: { flexDirection: "row", alignItems: "center", gap: t.spacing.xs },
    helper: { marginTop: 2 },
    flex: { flex: 1 },
  })
);
