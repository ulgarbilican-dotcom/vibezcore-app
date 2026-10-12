/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — één regel voor "streak" (audit 12 okt 2026, operator akkoord)

   Was per scherm anders: Breathwork en State Control vielen elke ochtend
   op 0 tot je oefende ("vandaag-anker"), de Audio Library hield de reeks
   tot het einde van de dag. Nu overal zoals Apple Fitness / Headspace: je
   reeks blijft staan zolang je vandaag nog kunt oefenen — telt vanaf
   vandaag, of vanaf gisteren als je vandaag nog niets deed.

   Telt in kalenderdagen via setDate (niet 24 u terug), zodat een
   zomer-/wintertijdwissel geen dag overslaat of dubbel telt.
   ───────────────────────────────────────────────────────────────────────── */

/** Huidige reeks. `hasDay` zegt of er op die (lokale) dag geoefend is. */
export function currentStreak(hasDay: (day: Date) => boolean, now: Date = new Date()): number {
  const cursor = new Date(now);
  cursor.setHours(12, 0, 0, 0);
  if (!hasDay(cursor)) cursor.setDate(cursor.getDate() - 1);
  let streak = 0;
  while (hasDay(cursor) && streak < 3660) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}
