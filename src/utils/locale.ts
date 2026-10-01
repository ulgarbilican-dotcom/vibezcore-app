/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — locale helpers

   Operator, 1 okt 2026 ("bij mij staat de kalender in EU formaat, hoe gaat
   dat voor gebruiker buiten EU bv US?"): de maand-kalender in agenda.tsx/
   bracelet-agenda.tsx liet de week altijd met zondag beginnen, hardcoded —
   toevallig de Amerikaanse volgorde, maar NIET aangepast aan het toestel's
   regio. De meeste EU-landen (incl. België, ISO 8601) beginnen op maandag.
   `getFirstWeekday()` leest de echte eerste weekdag van het toestel uit
   (via `expo-localization`'s `Localization.getCalendars()`), met zondag als
   veilige terugval als die info ontbreekt. */

import * as Localization from 'expo-localization';

/** 0 = zondag .. 6 = zaterdag (zelfde conventie als `Date.getDay()`). */
export function getFirstWeekday(): number {
  try {
    const fw = Localization.getCalendars()[0]?.firstWeekday;
    /* `firstWeekday` is 1-based (1 = zondag, 7 = zaterdag) — zelfde
       conventie als iOS' NSCalendar. */
    if (typeof fw === 'number' && fw >= 1 && fw <= 7) return fw - 1;
  } catch {
    /* Geen toestel-info beschikbaar (bv. web) — val terug op zondag. */
  }
  return 0;
}

const WEEKDAY_SUNDAY_FIRST = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

/** Eén-letter weekdag-labels, geroteerd zodat de eerste kolom overeenkomt
 *  met `getFirstWeekday()` — i.p.v. altijd zondag eerst. */
export function weekdayLabels(firstWeekday: number): string[] {
  return [
    ...WEEKDAY_SUNDAY_FIRST.slice(firstWeekday),
    ...WEEKDAY_SUNDAY_FIRST.slice(0, firstWeekday),
  ];
}

/** Aantal lege cellen vóór dag 1 van de maand, uitgaande van
 *  `firstWeekday` i.p.v. altijd zondag (`date.getDay()` rechtstreeks). */
export function leadingBlanks(firstOfMonth: Date, firstWeekday: number): number {
  return (firstOfMonth.getDay() - firstWeekday + 7) % 7;
}
