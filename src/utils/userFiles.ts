/**
 * Oturuma ait indirilen dosyalar (Excel dışa aktarımları, rapor dosyaları) önbellek dizininde tutulur.
 * Kart sahibi adları ve satış verisi içerdikleri için çıkışta / oturum düşünce silinir.
 */
import { Directory, Paths } from "expo-file-system";

const USER_FILE_DIRS = ["exports", "reports"] as const;

export function deleteUserFiles(): void {
  for (const name of USER_FILE_DIRS) {
    try {
      const dir = new Directory(Paths.cache, name);
      if (dir.exists) dir.delete();
    } catch {
      // silinemese de çıkış tamamlanır
    }
  }
}
