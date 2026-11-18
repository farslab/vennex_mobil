import React, { useRef } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { AppText, makeStyles, useTheme } from "@/design-system";

/**
 * 6 haneli doğrulama kodu girişi. Tek gizli TextInput kullanır — yapıştırma ve
 * iOS/Android "SMS/tek kullanımlık kod" otomatik doldurma doğal olarak çalışır.
 */
export function OtpInput({
  value,
  onChange,
  length = 6,
  error,
  autoFocus,
  onComplete,
  testID,
}: {
  value: string;
  onChange: (value: string) => void;
  length?: number;
  error?: boolean;
  autoFocus?: boolean;
  onComplete?: (value: string) => void;
  testID?: string;
}) {
  const styles = useStyles();
  const { colors } = useTheme();
  const ref = useRef<TextInput>(null);
  const [focused, setFocused] = React.useState(false);

  return (
    <Pressable onPress={() => ref.current?.focus()} accessibilityLabel="Doğrulama kodu" accessibilityHint="6 haneli kodu girin">
      <View style={styles.row}>
        {Array.from({ length }).map((_, i) => {
          const char = value[i] ?? "";
          const active = focused && i === Math.min(value.length, length - 1);
          return (
            <View
              key={i}
              style={[
                styles.cell,
                active && { borderColor: colors.primary, borderWidth: 2 },
                error && { borderColor: colors.danger },
              ]}
            >
              <AppText variant="metricMd">{char}</AppText>
            </View>
          );
        })}
      </View>
      <TextInput
        ref={ref}
        testID={testID}
        value={value}
        onChangeText={(text) => {
          const digits = text.replace(/\D/g, "").slice(0, length);
          onChange(digits);
          if (digits.length === length) onComplete?.(digits);
        }}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        keyboardType="number-pad"
        textContentType="oneTimeCode"
        autoComplete="one-time-code"
        maxLength={length}
        autoFocus={autoFocus}
        caretHidden
        style={styles.hidden}
        accessibilityLabel="Doğrulama kodu"
      />
    </Pressable>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    row: { flexDirection: "row", gap: t.spacing.sm, justifyContent: "space-between" },
    cell: {
      flex: 1,
      maxWidth: 52,
      aspectRatio: 0.85,
      borderRadius: t.radius.sm,
      borderWidth: 1,
      borderColor: t.colors.border,
      backgroundColor: t.colors.surface,
      alignItems: "center",
      justifyContent: "center",
    },
    hidden: { position: "absolute", opacity: 0.01, width: 1, height: 1 },
  })
);
