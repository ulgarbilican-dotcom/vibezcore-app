// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

/* Operator, 16 september 2026 ("kan niet verbinden" — Metro crashte met
   EMFILE: too many open files): `android/app/build` alleen is al 4.5GB
   aan Gradle-build-output (honderdduizenden losse .class/.o/cache-
   bestanden). Metro's file-watcher crawlt standaard de hele project-
   root behalve node_modules-internals — die build-map (en .gradle/.cxx,
   dezelfde soort wegwerp-compileroutput) telt gewoon mee, en op Windows
   (geen Watchman geïnstalleerd, dus Node's eigen fs-watcher met een
   file-descriptor-per-bestand) loopt dat vast tegen de OS-limiet. Metro
   heeft NOOIT reden om native build-artefacten te watchen — dit
   `blockList` sluit ze uit van de crawl, zonder de map zelf te
   verwijderen (Gradle blijft'm gewoon gebruiken). */
config.resolver.blockList = [
  /android[\\/]app[\\/]build[\\/].*/,
  /android[\\/]\.gradle[\\/].*/,
  /android[\\/]app[\\/]\.cxx[\\/].*/,
];

/* Operator, 16 september 2026: de blockList hierboven verhielp het niet
   volledig — de server crashte na ~15 min alsnog op EMFILE (geen
   Watchman geïnstalleerd; dat vergt een admin-rechten-install die de
   operator zelf moet doen). Tussenoplossing: minder parallelle Metro-
   workers = minder gelijktijdig open bestandshandles tijdens bundelen,
   wat de tijd-tot-crash verlengt (geen garantie, wel minder pijnlijk
   totdat Watchman er is). Verwijderen zodra Watchman geïnstalleerd is —
   dan mag Metro weer op volle snelheid workers draaien. */
config.maxWorkers = 2;

/* Iter 9dq v3 (2026-06-02): voeg `mjs` toe aan sourceExts zodat Metro
   ESM-modules kan resolven. Nodig voor `lucide-react-native` dat z'n
   icons als `.mjs` ships (en mogelijk toekomstige ESM-only packages).
   Zonder deze fix faalt de bundle met:
     "None of these files exist: ...icons/a-arrow-down.mjs(...)"
   Bekend Metro-issue: https://github.com/facebook/metro/issues/535 */
config.resolver.sourceExts = [...config.resolver.sourceExts, 'mjs'];

module.exports = config;
