import { colors } from "@/theme/colors";

export const markdownStyles = {
  body: { color: colors.textPrimary, fontSize: 14, lineHeight: 22 },
  heading1: { color: colors.textPrimary, fontSize: 22, fontWeight: "700" as const, marginTop: 16 },
  heading2: { color: colors.textPrimary, fontSize: 18, fontWeight: "700" as const, marginTop: 14 },
  heading3: { color: colors.textPrimary, fontSize: 16, fontWeight: "700" as const, marginTop: 12 },
  strong: { color: colors.textPrimary, fontWeight: "700" as const },
  link: { color: colors.primary },
  bullet_list: { marginVertical: 4 },
  ordered_list: { marginVertical: 4 },
  list_item: { color: colors.textSecondary },
  hr: { backgroundColor: colors.border, height: 1 },
};
