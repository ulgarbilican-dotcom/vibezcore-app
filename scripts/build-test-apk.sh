#!/usr/bin/env bash
# Testbuild NAAST de gewone app (22 okt 2026): andere pakketnaam (.test) en naam "VZ TEST",
# met de testschakelaar voor toegangsniveaus (/test-tier?tier=free|day|monthly|yearly|off).
# Gebruik: bash scripts/build-test-apk.sh   (arm64, release) -> scratchpad/vz-test.apk
set -eu
cd "$(dirname "$0")/.."
G=android/app/build.gradle; S=android/app/src/main/res/values/strings.xml
cp "$G" scratchpad/build.gradle.bak; cp "$S" scratchpad/strings.xml.bak
trap 'cp scratchpad/build.gradle.bak "$G"; cp scratchpad/strings.xml.bak "$S"' EXIT
sed -i "s/applicationId 'com.ubili.vibezcoreapp'/applicationId 'com.ubili.vibezcoreapp.test'/" "$G"
sed -i 's#<string name="app_name">VIBEZCORE</string>#<string name="app_name">VZ TEST</string>#' "$S"
EXPO_PUBLIC_VZ_TEST=1 SENTRY_DISABLE_AUTO_UPLOAD=true android/gradlew.bat -p android :app:createReleaseUpdatesResources --rerun :app:createBundleReleaseJsAndAssets --rerun :app:assembleRelease -PreactNativeArchitectures=arm64-v8a
cp android/app/build/outputs/apk/release/app-release.apk scratchpad/vz-test.apk
echo DONE
