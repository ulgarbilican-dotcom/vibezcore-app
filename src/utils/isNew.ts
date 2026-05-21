/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — "New"-filter logic.

   Een sessie geldt als "new" wanneer:
   1) `added` een geldige ISO-datum is (niet leeg, parseerbaar),
   2) die datum >= NEW_BASELINE valt (historische data kan niet
      onbedoeld als nieuw binnenrollen), en
   3) de datum binnen NEW_DAYS dagen ligt t.o.v. nu (rollende window
      zodat nieuwe drops na ±2 weken automatisch uit de filter vallen).

   Single source of truth voor zowel de filter-pill als evt. badges op
   sessierijen. ─────────────────────────────────────────────────────── */

export const NEW_BASELINE = new Date('2026-05-10');
export const NEW_DAYS = 30;

export function isNew(added: string): boolean {
  if (!added) return false;
  const addedDate = new Date(added);
  if (isNaN(addedDate.getTime())) return false;
  if (addedDate < NEW_BASELINE) return false;
  const diffDays =
    (Date.now() - addedDate.getTime()) / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= NEW_DAYS;
}
