/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Apple Watch companion-app target.

   Deze map wordt door `@bacons/apple-targets` tijdens `expo prebuild`
   omgezet in een écht watchOS-Xcode-target — zelfde reden als
   plugins/withWearApp.js voor Wear OS: de generated `ios/`-map staat niet
   in git en wordt elke keer herbouwd.

   BELANGRIJK (bevestigd via Apple's eigen forums, okt 2026): watchOS heeft
   GEEN Core Haptics (CHHapticEngine) — enkel `WKInterfaceDevice.play()`
   met een vaste set van 9 types. De haptiek hier is dus een METRONOOM-
   vertaling van het bestaande alfabet (breath-haptics.ts), geen 1-op-1
   kopie van de telefoon-textuur. Zie AppDelegate.swift/
   BreathHapticPlayer.swift voor de vertaling. */

/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'watch',
  name: 'VIBEZCORE',
  bundleIdentifier: 'com.ubili.vibezcoreapp.watchkitapp',
  deploymentTarget: '10.0',
  colors: {
    $accent: '#00A3A3',
  },
  entitlements: {
    'com.apple.security.application-groups': ['group.com.ubili.vibezcoreapp'],
  },
};
