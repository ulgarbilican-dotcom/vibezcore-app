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
   BreathHapticPlayer.swift voor de vertaling.

   Info.plist (6 okt 2026): deze plugin kent geen `infoPlist`-optie in de
   config. Ze gebruikt `targets/watch/Info.plist` als INFOPLIST_FILE (naast
   GENERATE_INFOPLIST_FILE) en maakt dat bestand enkel aan als het
   ontbreekt — dus het staat in git, met WKBackgroundModes = [mindfulness]
   voor de WKExtendedRuntimeSession (RuntimeSessionManager.swift). */

/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'watch',
  name: 'VIBEZCORE',
  bundleIdentifier: 'com.ubili.vibezcoreapp.watchkitapp',
  deploymentTarget: '10.0',
  colors: {
    $accent: '#00A3A3',
  },
  /* Geen App Group (6 okt 2026): werd nergens gebruikt — telefoon en Watch
     praten via WatchConnectivity — en vroeg wel een extra registratie bij
     Apple die de build kon laten falen. */
};
