#!/usr/bin/env bash
# VIBEZCORE — Firebase Test Lab op echte iPhones (20 okt 2026). Robo-test:
# Google installeert de .ipa (EAS-build, gratis te downloaden van expo.dev)
# en doorloopt de app zelf. Resultaten: Firebase-console → Test Lab.
# Gebruik: bash scripts/testlab-ios.sh <pad-naar.ipa>
set -eu
G="${GCLOUD:-$(cygpath "$LOCALAPPDATA")/Google/Cloud SDK/google-cloud-sdk/bin/gcloud.cmd}"
"$G" firebase test ios run \
  --project vibezcore1-ziub6j \
  --type robo \
  --app "$1" \
  --device model=iphonese3,version=18.4 \
  --device model=iphone14pro,version=16.6 \
  --device model=iphone16pro,version=18.3 \
  --timeout 6m \
  --results-history-name "VIBEZCORE iOS"
