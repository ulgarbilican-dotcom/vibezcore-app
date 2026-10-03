/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — manifest-injectie voor de achtergrond-ademsessie

   `android/` wordt door `expo prebuild` opnieuw aangemaakt en staat niet in
   git (zie plugins/withQuickShortcuts.js voor dezelfde constatering).
   Handmatige manifest-edits zouden dus bij elke prebuild verdwijnen — dit
   plugintje zet dezelfde twee elementen en de permissie telkens opnieuw
   terug, net als de andere lokale plugins hier.

   Wat het toevoegt:
     · <service> voor BreathSessionService (foregroundServiceType=
       "mediaPlayback", hergebruikt de FOREGROUND_SERVICE(_MEDIA_PLAYBACK)-
       permissies die al in app.json/android.permissions staan).
     · WAKE_LOCK-permissie: de service houdt de CPU wakker (partial wake
       lock) voor de duur van een sessie i.p.v. te vertrouwen op
       AlarmManager.setExactAndAllowWhileIdle() (operator, 15 augustus
       2026: "boost werkt niet correct, timing klopt niet, veel te traag").
       Boost's fasen zijn maar 2 seconden — met een wekker per fase-overgang
       liep dat tegen Android's throttling van herhaalde exact-wekkers aan,
       precies zichtbaar als "te traag". Eén wake lock + Handler-timers
       binnen de service zelf omzeilt die throttling volledig: geen
       PendingIntent-omweg meer nodig, dus ook geen SCHEDULE_EXACT_ALARM-
       permissie en geen PhaseAlarmReceiver meer.
     · REQUEST_IGNORE_BATTERY_OPTIMIZATIONS-permissie (operator, 14
       augustus 2026: "met batterij onbeperkt lukt het wel, hoe pakken we
       dat aan?" — bevestigd op een Samsung-toestel: zonder deze
       uitzondering blokkeert OneUI's eigen batterijbeheer de service
       zelf, los van de rest van deze module). De bijbehorende UI-flow zit
       in Settings + een blijvende banner op het startscherm, zie
       BreathBackgroundModule.kt en breath-session.tsx. */

const { withAndroidManifest, AndroidConfig } = require('expo/config-plugins');

const SERVICE_NAME = '.breathbackground.BreathSessionService';
const WAKE_LOCK_PERMISSION = 'android.permission.WAKE_LOCK';
const BATTERY_PERMISSION =
  'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS';

module.exports = function withBreathBackground(config) {
  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(
      cfg.modResults,
    );

    app.service = app.service ?? [];
    const hasService = app.service.some(
      (s) => s.$['android:name'] === SERVICE_NAME,
    );
    if (!hasService) {
      app.service.push({
        $: {
          'android:name': SERVICE_NAME,
          'android:foregroundServiceType': 'mediaPlayback',
          'android:exported': 'false',
        },
      });
    }

    const manifest = cfg.modResults.manifest;
    manifest['uses-permission'] = manifest['uses-permission'] ?? [];
    const hasWakeLock = manifest['uses-permission'].some(
      (p) => p.$['android:name'] === WAKE_LOCK_PERMISSION,
    );
    if (!hasWakeLock) {
      manifest['uses-permission'].push({
        $: { 'android:name': WAKE_LOCK_PERMISSION },
      });
    }

    const hasBattery = manifest['uses-permission'].some(
      (p) => p.$['android:name'] === BATTERY_PERMISSION,
    );
    if (!hasBattery) {
      manifest['uses-permission'].push({
        $: { 'android:name': BATTERY_PERMISSION },
      });
    }

    return cfg;
  });
};
