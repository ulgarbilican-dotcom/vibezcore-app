/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Live Activity (iPhone): de lopende sessie op het
   vergrendelscherm en in het Dynamic Island.

   Operator, 6 okt 2026 ("bouw altijd simultaan iOS en Android"): Android
   toont een lopende sessie op het vergrendelscherm via de media-melding van
   de native services. iOS heeft daar Live Activities voor (ActivityKit,
   iOS 16.2+). Deze map wordt door `@bacons/apple-targets` bij `expo
   prebuild` omgezet in een widget-extensie, zoals targets/watch.

   De app start/werkt bij/beëindigt de activity via modules/live-activity.
   `VibezSessionAttributes` staat in BEIDE (hier en in de module) en moet
   identiek blijven — ActivityKit koppelt ze op naam + Codable-vorm.

   NIET GETEST OP EEN TOESTEL: geschreven op Windows, zonder Xcode. De eerste
   iOS-build bevestigt het. */

/** @type {import('@bacons/apple-targets/app.plugin').Config} */
module.exports = {
  type: 'widget',
  name: 'VIBEZCORE Live',
  bundleIdentifier: 'com.ubili.vibezcoreapp.liveactivity',
  deploymentTarget: '16.2',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit', 'AppIntents'],
  colors: {
    $accent: '#00A3A3',
  },
};
