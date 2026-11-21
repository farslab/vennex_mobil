#!/usr/bin/env bash
# Uygulamanın NATIVE derlemeyi etkileyen yapılandırmasının özeti (app.config.ts'den).
# Mağaza sürümü gönderilirken ota/store-native-<sürüm>.json olarak kaydedilir; OTA betiği her yayında
# güncel özeti bununla karşılaştırır (fark varsa OTA durur, mağaza sürümü gerekir).
#   bash tools/store-native-snapshot.sh ota/store-native-1.0.0.json
set -euo pipefail
OUT="${1:?çıkış dosyası}"
cd "$(dirname "$0")/.."
npx expo config --json --type public | python3 -c '
import json, sys
c = json.load(sys.stdin)
keep = ["name", "slug", "scheme", "version", "runtimeVersion", "orientation", "userInterfaceStyle", "icon", "updates", "ios", "android", "plugins"]
print(json.dumps({k: c.get(k) for k in keep}, ensure_ascii=False, indent=2, sort_keys=True))
' > "$OUT"
