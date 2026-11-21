#!/usr/bin/env bash
# Vennex Mobile — OTA (JS) yayını. POS uygulamasıyla AYNI Xavia sunucusunu kullanır
# (ota.vennex.com.tr), ayrı runtime ad alanında: "vm-<mağaza sürümü>".
#
#   git switch ota-release && git merge main && git push   # OTA yalnız bu daldan çıkar
#   npm run ota -- "panel grafiği düzeltildi"
#
# Sırayla: ota-release dalı ve GitHub ile aynı mı → git temiz mi → native değişiklik yok mu → tip/lint/test → production paketi (iOS+Android)
# → Django'da OTA numarası ayır (--app vennex-mobile) → Xavia'ya yükle → yayın kaydı.
# Mobil yayınlar POS cihazlarına bildirim GÖNDERMEZ; uygulama açılışta/ön plana gelince kendisi kontrol eder.
#
# MAĞAZA KURALI: Yalnız JS/asset değişikliği OTA ile gider. Native değişiklik (yeni paket, izin,
# app.config native alanları) mağaza sürümü ister → APP_VERSION artırılır, yeni runtime oluşur.
#
# Gizliler (git dışı): ota-secrets/publish.env → OTA_UPLOAD_KEY=...
# Önkoşul: backend'de `ota_release --app` desteği (feature/mobil-ortak-yetki-ota dalı) canlıda olmalı.
set -euo pipefail

MSG="${1:-}"
[ -n "$MSG" ] || { echo "Kullanım: npm run ota -- \"değişiklik açıklaması\"" >&2; exit 1; }

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SECRETS="$ROOT/ota-secrets/publish.env"
SERVER="${OTA_SSH:-root@185.170.58.27}"
DJ="docker exec spserpetpaycom-web-1 python manage.py"
APP_ID="vennex-mobile"

die() { echo "HATA: $*" >&2; exit 1; }
step() { echo; echo "▶ $*"; }

[ -f "$SECRETS" ] || die "$SECRETS yok (OTA_UPLOAD_KEY)"
# shellcheck disable=SC1090
source "$SECRETS"
[ -n "${OTA_UPLOAD_KEY:-}" ] || die "publish.env eksik: OTA_UPLOAD_KEY"

cd "$ROOT"
# Uygulama yalnız canlı ortamla derlenir (app.config.ts)
RUNTIME="$(npx expo config --json --type public | python3 -c 'import json,sys; print(json.load(sys.stdin)["runtimeVersion"])')"
VERSION="$(npx expo config --json --type public | python3 -c 'import json,sys; print(json.load(sys.stdin)["version"])')"
[[ "$RUNTIME" == vm-* ]] || die "beklenmeyen runtime: $RUNTIME"

step "Git durumu"
git diff --quiet && git diff --cached --quiet || die "Commit edilmemiş değişiklik var; yayın bir commit'e bağlanır."
# OTA yalnız "ota-release" dalından çıkar ve o dal GitHub'daki haliyle aynı olmalı
# (yayınlanan her paketin kaynağı herkesin görebildiği bir commit olsun).
OTA_BRANCH="ota-release"
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
[ "$BRANCH" = "$OTA_BRANCH" ] || die "OTA yalnız '$OTA_BRANCH' dalından gönderilir (şu an: $BRANCH). main'i bu dala birleştirip oradan çalıştırın."
git fetch -q origin "$OTA_BRANCH" || die "origin/$OTA_BRANCH alınamadı (dal GitHub'a push edilmiş olmalı)"
[ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$OTA_BRANCH")" ] || die "Yerel $OTA_BRANCH, origin/$OTA_BRANCH ile aynı değil; önce push edin."
COMMIT="$(git rev-parse HEAD)"
echo "commit $COMMIT · sürüm $VERSION · runtime $RUNTIME"

# Mağazadaki sürümün commit'i "store-<sürüm>" etiketiyle işaretlenir. O commit'ten beri native etkileyen
# bir şey değiştiyse OTA ile gönderilemez. Kontrol dosya değil İÇERİK düzeyinde yapılır:
#  - bağımlılıklar (package.json dependencies) ve native varlıklar/sertifika birebir aynı olmalı
#  - app.config.ts'nin native alanları: mağaza anında kaydedilen ota/store-native-<sürüm>.json ile aynı olmalı
git rev-parse -q --verify "refs/tags/store-$VERSION" >/dev/null || die "store-$VERSION etiketi yok. Mağazaya gönderilen commit'i etiketleyin: git tag store-$VERSION <commit>"
CHANGED="$(git diff --name-only "store-$VERSION" HEAD -- package-lock.json assets/images/icon.png assets/images/adaptive-icon.png assets/images/splash-icon.png assets/images/splash-logo.png assets/images/splash-logo-dark.png ota/certificate.pem | grep -v '^$' || true)"
[ -z "$CHANGED" ] || { echo "$CHANGED" >&2; die "store-$VERSION etiketinden beri native etkileyen dosyalar değişmiş: mağaza sürümü gerekir (APP_VERSION artırın)."; }
python3 - "$(git show "store-$VERSION:package.json")" "$(cat package.json)" <<'PY' || die "store-$VERSION etiketinden beri bağımlılıklar değişmiş: mağaza sürümü gerekir."
import json, sys
a, b = (json.loads(x) for x in sys.argv[1:3])
diff = {k for k in set(a.get("dependencies", {})) | set(b.get("dependencies", {})) if a.get("dependencies", {}).get(k) != b.get("dependencies", {}).get(k)}
if diff:
    print("değişen bağımlılıklar:", ", ".join(sorted(diff)), file=sys.stderr)
    sys.exit(1)
PY
SNAP="ota/store-native-$VERSION.json"
[ -f "$SNAP" ] || die "$SNAP yok (mağaza sürümünde 'tools/store-native-snapshot.sh' ile kaydedilir)"
bash tools/store-native-snapshot.sh /dev/stdout | diff -u "$SNAP" - >&2 || die "app.config native alanları mağaza sürümünden farklı: mağaza sürümü gerekir (APP_VERSION artırın)."

step "Tip kontrolü, lint ve testler"
npm run typecheck --silent || die "tip hatası"
npm run lint --silent || die "lint hatası"
npx jest --silent --forceExit >/dev/null || die "testler başarısız"

step "OTA numarası (Django)"
OTA_LABEL="$(ssh "$SERVER" "$DJ ota_release reserve --app $APP_ID --runtime $RUNTIME" | tail -1 | tr -d '[:space:]')"
[[ "$OTA_LABEL" =~ ^[0-9]+$ ]] || die "OTA numarası alınamadı ($OTA_LABEL)"
fail_release() { ssh "$SERVER" "$DJ ota_release fail --app $APP_ID --runtime $RUNTIME --number $OTA_LABEL" >/dev/null 2>&1 || true; }
trap '[ "${UPLOADED:-0}" = 1 ] || fail_release' EXIT
echo "OTA no: $OTA_LABEL"

step "JS paketi (iOS + Android, production)"
OUT="$(mktemp -d)/bundle"
EXPO_PUBLIC_OTA_LABEL="$OTA_LABEL" npx expo export --clear --platform ios --platform android --output-dir "$OUT" >/dev/null
[ -f "$OUT/metadata.json" ] || die "paket üretilemedi"
grep -q "tms.vennex.com.tr" -r "$OUT/_expo" 2>/dev/null || echo "UYARI: pakette canlı API adresi bulunamadı"
npx expo config --json --type public > "$OUT/expoconfig.json"
(cd "$OUT" && zip -qr ../release.zip .)
echo "paket hazır ($(du -h "$OUT/../release.zip" | cut -f1))"

step "Xavia'ya yükleme (sunucu içinden, 127.0.0.1:8098)"
REMOTE_ZIP="/tmp/vennex-mobile-ota-$OTA_LABEL-$$.zip"
scp -q "$OUT/../release.zip" "$SERVER:$REMOTE_ZIP" || die "paket sunucuya kopyalanamadı"
MSG_FORM="Mobil OTA $OTA_LABEL — $MSG"
RESP="$(ssh "$SERVER" "curl -sS -w '\\n%{http_code}' -X POST http://127.0.0.1:8098/api/upload \
  -F file=@$REMOTE_ZIP -F runtimeVersion=$RUNTIME -F commitHash=$COMMIT \
  -F commitMessage=$(printf '%q' "$MSG_FORM") -F uploadKey=$OTA_UPLOAD_KEY; rm -f $REMOTE_ZIP")"
HTTP="$(printf '%s' "$RESP" | tail -1)"
BODY="$(printf '%s' "$RESP" | sed '$d')"
echo "$BODY"
XAVIA_PATH="$(printf '%s' "$BODY" | python3 -c 'import json,sys; print(json.load(sys.stdin).get("path",""))' 2>/dev/null || true)"
[ "$HTTP" = "200" ] || die "yükleme başarısız (HTTP $HTTP)"

step "Yayın kaydı (POS cihazlarına bildirim gitmez)"
UPLOADED=1
MSG_Q="$(printf '%q' "$MSG")"
ssh "$SERVER" "$DJ ota_release publish --app $APP_ID --runtime $RUNTIME --number $OTA_LABEL --commit $COMMIT --path '$XAVIA_PATH' --message $MSG_Q" \
  || echo "UYARI: yayın kaydı başarısız — paket Xavia'da; Nexus/admin'den kontrol edin."

echo
echo "✓ Yayınlandı: Mobil OTA $OTA_LABEL · runtime $RUNTIME · $COMMIT · \"$MSG\""
echo "  Uygulamalar açılışta veya ön plana gelince (en sık 30 dk'da bir) indirir; 'Yeni sürüm hazır' bandı çıkar."
