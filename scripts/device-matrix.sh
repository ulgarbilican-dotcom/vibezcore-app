#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# VIBEZCORE — flowtests op een reeks "toestellen" (20 okt 2026, operator:
# "hoe bouwt een professioneel bedrijf dit … wij moeten zo bouwen").
#
# Eén Android-emulator wordt per profiel omgeschakeld (schermformaat,
# dichtheid, lettergrootte, navigatieknoppen, licht/donker) en elk profiel
# draait alle Maestro-flows uit .maestro/. Screenshots per profiel komen in
# test-results/<datum>/<profiel>/ — daarop controleren we overlap/afknippen.
#
# Gebruik:  bash scripts/device-matrix.sh [apk] [profiel…]
#   apk     standaard android/app/build/outputs/apk/release/app-release.apk
#   profiel standaard alle: pixel8 small tall bigfont lightmode
# Vereist: een draaiende emulator (adb), Maestro in %LOCALAPPDATA%\maestro.
# ─────────────────────────────────────────────────────────────────────────
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADB="${ADB:-$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe}"
MAESTRO="${MAESTRO:-$LOCALAPPDATA/maestro/bin/maestro.bat}"
export JAVA_HOME="${JAVA_HOME_17:-/c/Program Files/Android/Android Studio/jbr}"
export PATH="$JAVA_HOME/bin:$PATH"
APK="${1:-$ROOT/android/app/build/outputs/apk/release/app-release.apk}"
shift || true
PROFILES="${*:-pixel8 small tall bigfont lightmode}"
STAMP="$(date +%Y%m%d-%H%M)"
OUT="$ROOT/test-results/$STAMP"
mkdir -p "$OUT"

EMU="$("$ADB" devices | awk '/^emulator-/{print $1; exit}')"
if [ -z "$EMU" ]; then echo "Geen emulator gevonden"; exit 2; fi
A() { "$ADB" -s "$EMU" "$@"; }

reset_device() {
  A shell wm size reset >/dev/null
  A shell wm density reset >/dev/null
  A shell settings put system font_scale 1.0 >/dev/null
  A shell cmd uimode night yes >/dev/null
  A shell cmd overlay enable com.android.internal.systemui.navbar.gestural >/dev/null 2>&1
}

apply_profile() {
  reset_device
  case "$1" in
    pixel8) ;;                                           # 412x915 dp, veeggebaren
    small)  A shell wm size 720x1280; A shell wm density 320   # 360x640 dp
            A shell cmd overlay enable com.android.internal.systemui.navbar.threebutton ;;
    tall)   A shell wm size 1080x2520; A shell wm density 480 ;; # 360x840 dp
    bigfont) A shell settings put system font_scale 1.5
             A shell cmd overlay enable com.android.internal.systemui.navbar.threebutton ;;
    lightmode) A shell cmd uimode night no
               A shell cmd overlay enable com.android.internal.systemui.navbar.threebutton ;;
    *) echo "onbekend profiel $1"; return 1 ;;
  esac
  sleep 3
}

echo "APK: $APK"
A install -r "$APK" >/dev/null || { echo "Installeren mislukt"; exit 3; }

FAIL=0
for P in $PROFILES; do
  echo "=== profiel $P ==="
  apply_profile "$P" || continue
  mkdir -p "$OUT/$P"
  ( cd "$OUT/$P" && "$MAESTRO" --device "$EMU" test "$ROOT/.maestro" \
      --format junit --output "$OUT/$P/report.xml" --test-output-dir "$OUT/$P" -e PROFILE="$P" ) \
    > "$OUT/$P/maestro.log" 2>&1 || FAIL=1
  grep -E "Flow|PASSED|FAILED|✅|❌" "$OUT/$P/maestro.log" | tail -20
done
reset_device
echo "Resultaten: $OUT"
exit $FAIL
