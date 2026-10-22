#!/usr/bin/env bash
# Zet een schermopname (mp4) of screenshot (png) in een telefoonframe.
# Gebruik: bash scripts/frame-clip.sh <invoer.mp4|.png> <uitvoer-basis> [max_seconden]
# Optioneel: START=1.5 om het begin weg te knippen.
# Schrijft <basis>.mp4 (zwarte achtergrond, H.264, geen geluid) en <basis>.webm (transparant, VP9).
set -euo pipefail
IN="$1"; BASE="$2"; MAXS="${3:-12}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="${TMPDIR:-/tmp}/vz-frame"; mkdir -p "$TMP"
# schermverhouding van de invoer overnemen (Galaxy A16 = 1080x2340, emulator = 1080x2400)
DIM="$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=s=x:p=0 "$IN" | tr -cd '0-9x')"
IW="${DIM%x*}"; IH="${DIM#*x}"
SHH=1040; SWW=$(( (SHH * IW / IH) / 2 * 2 ))
python "$ROOT/scripts/phone-frame.py" "$TMP/frame.png" "$SWW" "$SHH" >/dev/null
read CW CH SX SY SW SH < "$TMP/frame.png.txt"
PRE=(); SS=()
case "$IN" in *.png|*.jpg) PRE=(-loop 1 -framerate 30);; esac
[ -n "${START:-}" ] && SS=(-ss "$START")
# scherm schalen naar het gat; PNG-bezel ligt BOVENOP zodat de afgeronde hoeken kloppen
FILT="[0:v]fps=30,scale=${SW}:${SH}:flags=lanczos,setsar=1[v];color=c=black@0.0:s=${CW}x${CH}:r=30,format=rgba[bg];[bg][v]overlay=${SX}:${SY}:shortest=1[a];[a][1:v]overlay=0:0:format=auto[out];[out]split[o1][o2];[o1]format=yuv420p[m]"
ffmpeg -y -loglevel error "${PRE[@]}" "${SS[@]}" -t "$MAXS" -i "$IN" -loop 1 -framerate 30 -i "$TMP/frame.png" \
  -filter_complex "$FILT" \
  -map "[m]" -an -t "$MAXS" -c:v libx264 -crf 24 -preset slow -movflags +faststart -pix_fmt yuv420p "$BASE.mp4" \
  -map "[o2]" -an -t "$MAXS" -c:v libvpx-vp9 -pix_fmt yuva420p -b:v 0 -crf 34 -auto-alt-ref 0 "$BASE.webm"
ls -l "$BASE.mp4" "$BASE.webm"
