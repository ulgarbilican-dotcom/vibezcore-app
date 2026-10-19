/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Wat er zichtbaar is

   Eén schakelaar per productdeel. Verbergen is hier GEEN verwijderen: alle
   schermen, gegevens en aankopen blijven staan en werken. Alleen de ingangen
   verdwijnen uit beeld.

   Dat onderscheid is belangrijk. Code weghalen is een operatie van uren en
   een risico bij elke regel; een ingang verbergen is één waarde en kost een
   herstart. Wie het terug wil zet AUDIO weer op `true` en alles staat er
   precies zoals het was — inclusief de historiek van gebruikers die de
   bibliotheek al gebruikt hebben.
   ───────────────────────────────────────────────────────────────────────── */

/** De audiobibliotheek.
 *
 *  UIT sinds 5 augustus 2026 (operator): de app richt zich toen op de Smart
 *  Bead Bracelet en breathwork als één geheel. Audio wordt een apart
 *  gegeven en hoorde daarom niet meer als tabblad in deze app te staan.
 *
 *  WEER AAN sinds 7 september 2026 (operator, expliciet bevestigd na
 *  toelichting van de 5-augustus-reden): de "end trial"-exit uit de
 *  gratis breathwork-sessie stuurt nu naar de Breath-tab, en de user moet
 *  daar ook naar de Audio Library kunnen — dat kan alleen via de tabbalk. */
export const AUDIO_ENABLED = true;

/** Apple Health (iPhone) / Health Connect (Android).
 *
 *  UIT sinds 19 oktober 2026 (operator): bij de lancering meet VIBEZCORE de
 *  rusthartslag zelf (camerameting, zelf ingeven of het gemiddelde). Eén
 *  helder verhaal, minder toestemmingsvensters, geen HealthKit-review, geen
 *  Health-apps-verklaring in Play, geen gezondheidslabels in de stores.
 *
 *  De code (services/health-sync.ts, components/HealthSyncSetting.tsx)
 *  blijft staan. Terug aanzetten = deze waarde op `true` ÉN de
 *  build-instellingen terugzetten (app.json: health-permissies + de config-
 *  plugins react-native-health-connect / @kingstinct/react-native-healthkit;
 *  react-native.config.js: iOS-uitsluiting van HealthKit weghalen) ÉN de
 *  privacyverklaring/FAQ weer aanvullen (zie commit 9a20275). */
export const HEALTH_INTEGRATION_ENABLED = false;
