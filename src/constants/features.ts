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
 *  UIT sinds 5 augustus 2026 (operator): de app richt zich nu op de Smart
 *  Bead Bracelet en breathwork als één geheel. Audio wordt een apart
 *  gegeven en hoort daarom niet meer als tabblad in deze app te staan.
 *
 *  Wat er ONDANKS dit alles blijft draaien: bestaande abonnementen, de
 *  spelerslogica, de voortgang en de gegevens van iedereen die de
 *  bibliotheek al gebruikte. Er wordt niets weggegooid en niets opgezegd. */
export const AUDIO_ENABLED = false;
