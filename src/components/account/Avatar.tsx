import React from "react";
import { StyleSheet, View } from "react-native";
import { AppText, makeStyles } from "@/design-system";
import { initials } from "@/utils/text";

/** Baş harf avatarı — fotoğraf alanı backend'de yok */
export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  const styles = useStyles();
  return (
    <View
      style={[styles.root, size === "lg" ? styles.lg : styles.md]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <AppText variant={size === "lg" ? "headline" : "calloutStrong"} color="primary">
        {initials(name)}
      </AppText>
    </View>
  );
}

const useStyles = makeStyles((t) =>
  StyleSheet.create({
    root: {
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.colors.primarySubtle,
      borderRadius: t.radius.pill,
    },
    md: { width: 40, height: 40 },
    lg: { width: 56, height: 56 },
  })
);
