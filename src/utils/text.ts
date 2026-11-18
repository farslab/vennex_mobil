/**
 * Türkçe duyarlı arama normalizasyonu: "İSTANBUL" ile "istanbul", "Çay" ile "cay" eşleşir.
 */
export function normalizeForSearch(input: string | null | undefined): string {
  if (!input) return "";
  return input
    .toLocaleLowerCase("tr-TR")
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Ad + soyad birleştirme, boşları atlar */
export function fullName(first?: string | null, last?: string | null): string {
  return [first, last].filter((s) => s && s.trim()).join(" ").trim();
}

/** Baş harfler (avatar için) */
export function initials(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const chars = parts.length > 1 ? parts[0][0] + parts[parts.length - 1][0] : parts[0]?.slice(0, 2) ?? "?";
  return chars.toLocaleUpperCase("tr-TR");
}
