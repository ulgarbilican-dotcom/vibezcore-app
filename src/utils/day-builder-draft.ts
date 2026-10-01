/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Terugkoppeling van breath-setup.tsx naar build-your-day.tsx

   Operator, 17 september 2026: "add session" op Pad B opent nu het
   BESTAANDE breath-setup.tsx-scherm (dark, in een nieuwe "addToDay"-modus
   — staat + techniek + duur + tijd op één kaart, cirkel geeft kleur/tijd
   animerend weer) i.p.v. een eigen los invulscherm. expo-router kent geen
   directe "geef een waarde terug bij pop"-mechanisme, dus een klein
   module-level plankje: breath-setup.tsx zet 'm klaar vlak vóór
   `router.back()`, build-your-day.tsx leest 'm op in een `useFocusEffect`
   bij terugkeer. Zelfde soort module-state-patroon als plan-store.ts,
   maar hier bewust GEEN persistentie — dit is een eenmalige overdracht
   tussen twee schermen op dezelfde stack, niets om te bewaren. */

import type { PlannedItem, PlanHorizon } from './plan-store';

export type DraftSession = {
  item: PlannedItem;
  /** `null` = nieuwe sessie toevoegen; anders de positie in
   *  build-your-day.tsx se `sessions`-array die vervangen wordt. */
  editIndex: number | null;
  /* Operator, 18 september 2026 ("aantal dagen moet in addToDay komen...
     onderaan als lange card"): horizon (hoelang het HELE protocol loopt)
     is geen sessie-veld — `PlannedItem` kent het niet — maar de gebruiker
     kiest 'm toch op dit per-sessie scherm (5e, brede tegel naast Time/
     State/Technique/Duration). Gaat dus even mee terug over dit kanaal,
     build-your-day.tsx onthoudt 'm los van de sessies-array zelf. */
  horizon: PlanHorizon;
};

let draft: DraftSession | null = null;

export function setDraftSession(
  item: PlannedItem,
  editIndex: number | null,
  horizon: PlanHorizon,
): void {
  draft = { item, editIndex, horizon };
}

/** Leest én wist in één beweging — een draft is maar één keer geldig,
 *  anders zou een tweede, ongerelateerde terugkeer naar build-your-day.tsx
 *  hem per ongeluk nog eens toevoegen. */
export function consumeDraftSession(): DraftSession | null {
  const d = draft;
  draft = null;
  return d;
}
