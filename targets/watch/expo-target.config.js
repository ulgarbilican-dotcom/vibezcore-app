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
  /* 15 okt 2026: interne target-naam moet verschillen van de iPhone-app
     (die heet ook "VIBEZCORE"). Met dezelfde naam gaf EAS het Watch-profiel
     aan het iPhone-target en faalde de build (Configure Xcode project).
     Op het horloge blijft de naam "VIBEZCORE" (displayName). */
  name: 'VIBEZCOREWatch',
  displayName: 'VIBEZCORE',
  /* 15 okt 2026: App Store weigerde build 19 (ITMS-90391/90713: geen
     icoon voor de Watch-app). 1024 px, ondoorzichtig, zelfde V op grafiet
     als de Galaxy Watch (ic_launcher_bg + vz_vmark). */
  icon: './icon.png',
  bundleIdentifier: 'com.ubili.vibezcoreapp.watchkitapp',
  deploymentTarget: '10.0',
  colors: {
    $accent: '#00A3A3',
  },
  /* 19 okt 2026 (operator: "bij breathwork moeten we de figuren krijgen,
     niet de cirkels"): dezelfde ademfiguren als de app en de Galaxy Watch
     (breath-states.ts `art`), vooraf bijgesneden tot het onderwerp — zie
     trimmedArt() in wear-app/CatalogStore.kt. Pad = vanaf deze map. */
  images: {
    vzArtSun: '../../assets/watch-art/vz_art_sun.png',
    vzArtFlower: '../../assets/watch-art/vz_art_flower.png',
    vzArtLotus: '../../assets/watch-art/vz_art_lotus.png',
    vzArtClarity: '../../assets/watch-art/vz_art_clarity.png',
    vzArtTree: '../../assets/watch-art/vz_art_tree.png',
  },
  /* 29 okt 2026: HealthKit enkel zodat de iPhone deze app kan openen bij het starten van een sessie (startWatchApp). */
  entitlements: {
    'com.apple.developer.healthkit': true,
  },
  /* Geen App Group (6 okt 2026): werd nergens gebruikt — telefoon en Watch
     praten via WatchConnectivity — en vroeg wel een extra registratie bij
     Apple die de build kon laten falen. */
};
