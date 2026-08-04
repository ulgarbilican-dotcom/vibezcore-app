/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — lint uit bij release-builds

   Waarom dit bestand bestaat: de map `android/` wordt door `expo prebuild`
   opnieuw aangemaakt en staat daarom niet in git. Een wijziging die je daar
   met de hand aanbrengt is weg zodra iemand prebuild draait. Dit plugintje
   zet dezelfde instelling telkens opnieuw, zodat ze niet verdwijnt.

   Wat het doet: `lintVitalRelease` overslaan. Die stap kostte op deze machine
   ruim veertig minuten op een build die er zonder twee nodig heeft, en hij
   controleert zaken als ongebruikte bronnen en verouderde aanroepen. Nuttig,
   maar niet iets waar je veertig minuten op wacht om een APK op je eigen
   toestel te zetten (operator, 3 augustus 2026).

   De controle is NIET weg, alleen losgekoppeld van de build:
       cd android && ./gradlew lintRelease
   Draai die vóór je iets naar de Play Store stuurt.
   ───────────────────────────────────────────────────────────────────────── */

const { withAppBuildGradle } = require('expo/config-plugins');

const BLOCK = `
    lint {
        checkReleaseBuilds false
        abortOnError false
    }
`;

module.exports = function withoutReleaseLint(config) {
  return withAppBuildGradle(config, (cfg) => {
    if (cfg.modResults.contents.includes('checkReleaseBuilds false')) {
      return cfg;
    }
    /* Direct achter de opening van het android-blok, vóór de rest. Op die
       plek geldt hij voor alle varianten en botst hij met niets. */
    cfg.modResults.contents = cfg.modResults.contents.replace(
      /android\s*\{/,
      (m) => `${m}\n${BLOCK}`,
    );
    return cfg;
  });
};
