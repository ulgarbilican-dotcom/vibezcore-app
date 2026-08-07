/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — snelkoppelingen onder het app-icoon

   Waarom niet met `expo-quick-actions`, waar dit eerst mee gebouwd was:
   dat pakket leest de snelkoppeling uit `activity.intent` in `onCreate`.
   MainActivity draait op `singleTask`, dus zodra de app al open is krijgt hij
   `onNewIntent` en NOOIT `onCreate` — de snelkoppeling werd dan niet gelezen
   en de app kwam gewoon naar voren op het scherm waar je gebleven was. Dat is
   precies wat de operator zag op 7 augustus 2026: alle drie de
   snelkoppelingen kwamen op de Breath-tab uit.

   Deze aanpak gebruikt gewone deeplinks (`vibezcoreapp://…`). Die worden door
   `Linking` afgehandeld, en dat luistert wél naar `onNewIntent`. Werkt dus
   zowel bij een app die uitstaat als bij een app die al draait.

   De teksten staan vast. Een snelkoppeling die van naam verandert is geen
   snelkoppeling meer — je moet kunnen weten wat eronder zit vóór je kijkt.

   De map `android/` wordt door `expo prebuild` opnieuw aangemaakt en staat
   niet in git; daarom staat dit hier en niet met de hand in het manifest.
   ───────────────────────────────────────────────────────────────────────── */

const {
  withAndroidManifest,
  withDangerousMod,
  AndroidConfig,
} = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/** Volgorde = volgorde in het menu, van boven naar beneden. */
const SHORTCUTS = [
  {
    id: 'quick_reset',
    short: 'Quick reset',
    long: 'Calm Control · shortest',
    uri: 'vibezcoreapp://quick-breath',
  },
  {
    id: 'all_modes',
    short: 'All modes',
    long: 'Pick your own state',
    uri: 'vibezcoreapp://breath',
  },
  {
    id: 'bracelet',
    short: 'Bracelet',
    long: 'One press, no screen',
    uri: 'vibezcoreapp://bracelet',
  },
];

function xml(pkg) {
  const items = SHORTCUTS.map(
    (s) => `  <shortcut
    android:shortcutId="${s.id}"
    android:enabled="true"
    android:shortcutShortLabel="@string/shortcut_${s.id}_short"
    android:shortcutLongLabel="@string/shortcut_${s.id}_long">
    <intent
      android:action="android.intent.action.VIEW"
      android:targetPackage="${pkg}"
      android:targetClass="${pkg}.MainActivity"
      android:data="${s.uri}" />
  </shortcut>`,
  ).join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>\n<shortcuts xmlns:android="http://schemas.android.com/apk/res/android">\n${items}\n</shortcuts>\n`;
}

/* De labels moeten uit strings.xml komen: Android weigert een letterlijke
   tekst in shortcutShortLabel bij een release-build. */
function strings() {
  const rows = SHORTCUTS.map(
    (s) =>
      `  <string name="shortcut_${s.id}_short">${s.short}</string>\n` +
      `  <string name="shortcut_${s.id}_long">${s.long}</string>`,
  ).join('\n');
  return rows;
}

module.exports = function withQuickShortcuts(config) {
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const res = path.join(
        cfg.modRequest.platformProjectRoot,
        'app/src/main/res',
      );
      const pkg = AndroidConfig.Package.getPackage(cfg);
      fs.mkdirSync(path.join(res, 'xml'), { recursive: true });
      fs.writeFileSync(path.join(res, 'xml/shortcuts.xml'), xml(pkg), 'utf8');

      /* In strings.xml bijschrijven zonder de rest aan te raken. */
      const sp = path.join(res, 'values/strings.xml');
      let s = fs.readFileSync(sp, 'utf8');
      if (!s.includes('shortcut_quick_reset_short')) {
        s = s.replace('</resources>', `${strings()}\n</resources>`);
        fs.writeFileSync(sp, s, 'utf8');
      }
      return cfg;
    },
  ]);

  return withAndroidManifest(config, (cfg) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(
      cfg.modResults,
    );
    const activity = app.activity?.find(
      (a) => a.$['android:name'] === '.MainActivity',
    );
    if (!activity) return cfg;
    activity['meta-data'] = activity['meta-data'] ?? [];
    const has = activity['meta-data'].some(
      (m) => m.$['android:name'] === 'android.app.shortcuts',
    );
    if (!has) {
      activity['meta-data'].push({
        $: {
          'android:name': 'android.app.shortcuts',
          'android:resource': '@xml/shortcuts',
        },
      });
    }
    return cfg;
  });
};
