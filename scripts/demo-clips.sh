#!/usr/bin/env bash
# Neemt één democlip op van de echte app: screenrecord + Maestro-flow + telefoonframe.
# Gebruik:  bash scripts/demo-clips.sh <naam> <flow.yaml> [serial] [max_seconden]
#   bv.     bash scripts/demo-clips.sh breath-start .maestro/demo/breath-start.yaml 192.168.0.223:PORT 12
# Uitvoer:  website-clips/<naam>.mp4 (H.264) en <naam>.webm (transparant), zonder geluid.
# Vereist:  verbonden toestel (adb), Maestro, ffmpeg; app geïnstalleerd (appId com.ubili.vibezcoreapp).
# Let op:   niet tegelijk met een andere Maestro-run op hetzelfde toestel draaien.
# Opties (env): START=1.5 (seconden weg aan het begin), SIZE=1080x2340, BITRATE=12000000
set -euo pipefail
NAME="$1"; FLOW="$2"; SERIAL="${3:-}"; MAXS="${4:-12}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ADB="${ADB:-$LOCALAPPDATA/Android/Sdk/platform-tools/adb.exe}"
MAESTRO="${MAESTRO:-$LOCALAPPDATA/maestro/bin/maestro.bat}"
A=("$ADB"); [ -n "$SERIAL" ] && A+=(-s "$SERIAL")
OUT="$ROOT/website-clips"; mkdir -p "$OUT"
RAW="/sdcard/vz-demo-$NAME.mp4"
REC_ARGS=(--bit-rate "${BITRATE:-12000000}"); [ -n "${SIZE:-}" ] && REC_ARGS+=(--size "$SIZE")

demo() { "${A[@]}" shell am broadcast -a com.android.systemui.demo "$@" >/dev/null; }
demo_on() {
  "${A[@]}" shell settings put global sysui_demo_allowed 1
  demo -e command enter
  demo -e command clock -e hhmm 0941
  demo -e command battery -e level 100 -e plugged false
  demo -e command network -e wifi show -e level 4 -e fully true
  demo -e command network -e mobile show -e datatype none -e level 4 -e fully true
  demo -e command notifications -e visible false
}
demo_off() { demo -e command exit || true; "${A[@]}" shell settings put global sysui_demo_allowed 0 || true; }
trap 'demo_off; "${A[@]}" shell pkill -2 screenrecord 2>/dev/null || true' EXIT

demo_on
"${A[@]}" shell "screenrecord ${REC_ARGS[*]} --time-limit 180 $RAW" &
REC=$!
sleep 2
cd "$ROOT"
if [ -n "$SERIAL" ]; then "$MAESTRO" --device "$SERIAL" test "$FLOW"; else "$MAESTRO" test "$FLOW"; fi
sleep 1
"${A[@]}" shell pkill -2 screenrecord || true   # SIGINT: mp4 netjes afsluiten
wait $REC || true
sleep 1
"${A[@]}" pull "$RAW" "$OUT/$NAME.raw.mp4"
"${A[@]}" shell rm "$RAW"
demo_off
trap - EXIT
bash "$ROOT/scripts/frame-clip.sh" "$OUT/$NAME.raw.mp4" "$OUT/$NAME" "$MAXS"
echo "Klaar: $OUT/$NAME.mp4 en .webm (ruwe opname: $NAME.raw.mp4, mag weg)"
