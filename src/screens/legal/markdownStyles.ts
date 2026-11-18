import { StyleSheet } from "react-native";
import { makeStyles, type Theme } from "@/design-system";

/**
 * react-native-markdown-display stilleri — tema token'larından üretilir (açık/koyu).
 * Önceki sürüm statik renk kullandığı için açık temada metin okunmuyordu.
 */
export function makeMarkdownStyles(t: Theme) {
  const text = t.colors.text;
  const secondary = t.colors.textSecondary;
  return StyleSheet.create({
    body: { color: secondary, fontSize: t.typography.body.fontSize, lineHeight: 23 },
    heading1: { color: text, ...t.typography.title, marginTop: t.spacing.lg, marginBottom: t.spacing.sm },
    heading2: { color: text, ...t.typography.headline, marginTop: t.spacing.lg, marginBottom: t.spacing.xs },
    heading3: { color: text, ...t.typography.cardTitle, marginTop: t.spacing.md, marginBottom: t.spacing.xs },
    heading4: { color: text, ...t.typography.bodyStrong, marginTop: t.spacing.md },
    paragraph: { color: secondary, marginTop: t.spacing.xs, marginBottom: t.spacing.sm },
    strong: { color: text, fontWeight: "700" },
    em: { fontStyle: "italic" },
    link: { color: t.colors.primary, textDecorationLine: "underline" },
    bullet_list: { marginVertical: t.spacing.xs },
    ordered_list: { marginVertical: t.spacing.xs },
    list_item: { color: secondary, marginVertical: 2 },
    bullet_list_icon: { color: t.colors.textTertiary },
    ordered_list_icon: { color: t.colors.textTertiary },
    hr: { backgroundColor: t.colors.border, height: StyleSheet.hairlineWidth * 2, marginVertical: t.spacing.lg },
    blockquote: {
      backgroundColor: t.colors.surfaceMuted,
      borderLeftColor: t.colors.borderStrong,
      borderLeftWidth: 3,
      paddingHorizontal: t.spacing.md,
      paddingVertical: t.spacing.xs,
      marginVertical: t.spacing.sm,
    },
    code_inline: {
      backgroundColor: t.colors.surfaceMuted,
      color: t.colors.text,
      borderRadius: t.radius.xs,
      paddingHorizontal: 4,
    },
    code_block: { backgroundColor: t.colors.surfaceMuted, color: t.colors.text, borderRadius: t.radius.sm, padding: t.spacing.md },
    fence: { backgroundColor: t.colors.surfaceMuted, color: t.colors.text, borderRadius: t.radius.sm, padding: t.spacing.md },
    table: { borderColor: t.colors.border, borderWidth: 1, borderRadius: t.radius.xs },
    thead: { backgroundColor: t.colors.surfaceMuted },
    th: { color: text, padding: t.spacing.sm },
    tr: { borderBottomColor: t.colors.border, borderBottomWidth: StyleSheet.hairlineWidth },
    td: { color: secondary, padding: t.spacing.sm },
  });
}

/** Aktif temaya göre önbelleklenmiş markdown stilleri */
export const useMarkdownStyles = makeStyles(makeMarkdownStyles);
