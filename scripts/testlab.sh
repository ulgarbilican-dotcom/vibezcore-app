#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────
# VIBEZCORE — Firebase Test Lab: Robo-test op echte toestellen (20 okt 2026).
# Google installeert de APK op echte telefoons, doorloopt de app zelf en
# geeft crashes, screenshots en video terug in de Firebase-console
# (project vibezcore1 → Test Lab). Gratis tegoed: 5 echte toestellen/dag.
#
# Gebruik: bash scripts/testlab.sh [apk]
#   apk = een ARM-APK (echte toestellen), standaard
#         android/app/build/outputs/apk/release/app-release.apk
# Bouwen:  cd android && SENTRY_DISABLE_AUTO_UPLOAD=true ./gradlew.bat \
#            :app:assembleRelease -PreactNativeArchitectures=arm64-v8a,armeabi-v7a
# Let op: Test Lab stopt op 30 sept 2027 → opvolger Developer Device Platform.
# ─────────────────────────────────────────────────────────────────────────
set -eu
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# Kort Windows-pad (8.3): gcloud start intern hulpprocessen en struikelt
# over de spatie in "Cloud SDK" (20 okt 2026).
G="${GCLOUD:-$(powershell.exe -NoProfile -Command '(New-Object -ComObject Scripting.FileSystemObject).GetFile("$env:LOCALAPPDATA\Google\Cloud SDK\google-cloud-sdk\bin\gcloud.cmd").ShortPath' | tr -d '\r')}"
APK="${1:-$ROOT/android/app/build/outputs/apk/release/app-release.apk}"

# Een mix die de gebruikers dekt: duur en goedkoop, nieuw en oud, klein en
# groot scherm, Samsung (One UI), Pixel (puur Android), Motorola, tablet.
"$G" firebase test android run \
  --project vibezcore1-ziub6j \
  --type robo \
  --app "$APK" \
  --device model=SC-51E,version=36 \
  --device model=a15,version=34 \
  --device model=akita,version=35 \
  --device model=cancun,version=34 \
  --device model=a10,version=29 \
  --timeout 6m \
  --results-history-name "VIBEZCORE Android"
