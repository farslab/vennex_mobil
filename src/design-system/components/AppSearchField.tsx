import React from "react";
import { regularFont } from "../tokens/fonts";
import { Pressable, StyleSheet, TextInput, View, type TextInputProps } from "react-native";
import { makeStyles, useTheme } from "../theme";
import { AppIcon } from "./AppIcon";

export interface AppSearchFieldProps extends Omit<TextInputProps, "style" | "onChangeText" | "value"> {
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
}

/**
 * Arama kutusu. Debounce bu bileşende değil, sorguyu tetikleyen tarafta
 * (`useDebouncedValue`) yapılır — böylece input anında tepki verir ve odak kaybolmaz.
 */
export function AppSearchField({ value, onChangeText, placeholder = "Ara", ...rest }: AppSearchFieldProps) {
  const { colors } = useTheme();
  const styles = useStyles();
  return (
    <View style={styles.root}>
      <AppIcon name="search" size={18} color="textTertiary" />
      <TextInput
        {...rest}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textTertiary}
        selectionColor={colors.primary}
        returnKeyType="search"
        autoCorrect={false}
        autoCapitalize="none"
        accessibilityLabel={rest.accessibilityLabel ?? placeholder}
        style={[styles.input, { color: colors.text }, regularFont()]}
      />
      {value.length > 0 ? (
        <Pressable
          onPress={() => onChangeText("")}
          // 16pt ikon + 2×14 → 44pt dokunma alanı
          hitSlop={14}
          accessibilityRole="button"
          accessibilityLabel="Aramayı temizle"
          testID="search-clear"
        >
          <AppIcon name="x-circle" size={16} color="textTertiary" />
        </Pressable>
      ) : null}
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: {
      minHeight: 42,
      borderRadius: t.radius.sm,
      backgroundColor: t.colors.surfaceMuted,
      paddingHorizontal: t.spacing.md,
      flexDirection: "row",
      alignItems: "center",
      gap: t.spacing.sm,
    },
    input: { flex: 1, fontSize: 15, paddingVertical: t.spacing.sm },
  })
);
