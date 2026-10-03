/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — bundelt de Wear OS-companion-app in de telefoon-APK.

   `android/` wordt door `expo prebuild` opnieuw aangemaakt en staat niet in
   git (zie plugins/withQuickShortcuts.js voor dezelfde constatering). De
   echte bron van de horloge-app leeft daarom in `wear-app/` op repo-niveau;
   dit plugintje kopieert die map naar `android/wear` en haakt hem in
   settings.gradle + app/build.gradle in, telkens opnieuw bij elke prebuild.

   Alleen Android — Apple Watch is een apart, Xcode-target-gebaseerd traject
   (zie plugins/withWatchApp.js), geen onderdeel van deze plugin. */

const { withDangerousMod, withSettingsGradle, withAppBuildGradle } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

function copyDir(src, dest) {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, entry.name);
    const d = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(s, d);
    } else {
      fs.copyFileSync(s, d);
    }
  }
}

module.exports = function withWearApp(config) {
  config = withDangerousMod(config, [
    'android',
    (cfg) => {
      const src = path.join(cfg.modRequest.projectRoot, 'wear-app');
      const dest = path.join(cfg.modRequest.platformProjectRoot, 'wear');
      if (fs.existsSync(src)) {
        copyDir(src, dest);
      }
      return cfg;
    },
  ]);

  config = withSettingsGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes("include ':wear'")) {
      cfg.modResults.contents += "\ninclude ':wear'\n";
    }
    return cfg;
  });

  config = withAppBuildGradle(config, (cfg) => {
    if (!cfg.modResults.contents.includes("wearApp project(':wear')")) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /dependencies\s*\{/,
        "dependencies {\n  wearApp project(':wear')",
      );
    }
    return cfg;
  });

  return config;
};
