/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Behavior-pattern mining (Phase 2, Layer 1)

   Operator, 10 september 2026: "Recognize You" — laag 1 uit de strategie-
   doc ("Recognize the person first — recommend second"). Gratis, geen
   nieuwe permissie, geen nieuw scherm: leest enkel de al-bestaande
   `breath-history.ts`-log (die er sowieso al is voor de streak-telling) en
   haalt eruit welke toestand iemand op welk moment van de dag ECHT
   praktiseert — niet wat ze zouden zeggen te willen.

   Bewuste beperking t.o.v. de strategie-doc: die noemt ook "welke
   technieken je echt afmaakt vs. vroegtijdig verlaat" als signaal.
   `BreathHistoryEntry` bevat momenteel GEEN techniek-sleutel (enkel de
   TOESTAND-key) — dat is een schema-uitbreiding die zijn eigen aparte
   beslissing verdient (raakt `addBreathSession()`-aanroepen in
   breath-session.tsx), niet iets om stilzwijgend mee te nemen in deze
   eerste, voorzichtige laag. Deze module doet dus uitsluitend TOESTAND-
   niveau patroonherkenning, niet techniek-niveau.

   Alles hier is een PURE afleiding uit al-gelogde data — geen enkele
   aanroep, geen opslag. Retourneert altijd `null` bij te weinig data
   (`MIN_SAMPLES`), zodat de aanroeper simpelweg op zijn bestaande,
   generieke tijdstip-volgorde terugvalt — nooit een "personalisatie" op
   basis van 1 toevallige sessie. */

import type { BreathHistoryEntry } from '@/utils/breath-history';
import { slotForHour } from '@/utils/day-plan';
import type { BreathStateKey } from '@/data/breath-states';

const ALL_STATES: BreathStateKey[] = ['boost', 'focus', 'calm', 'clarity', 'rest'];

/** Minstens dit veel sessies IN DIT MOMENT nodig vóór we het patroon
 *  vertrouwen — anders bepaalt één toevallige sessie de "gewoonte". */
const MIN_SAMPLES = 3;

/** Toestanden voor dit moment, geordend van vaakst naar minst vaak
 *  gepraktiseerd door DEZE gebruiker op DIT moment van de dag — of
 *  `null` als er te weinig geschiedenis is om dat te vertrouwen.
 *  Toestanden die nooit voorkwamen op dit moment komen achteraan, in de
 *  vaste volgorde, zodat het resultaat altijd alle 5 bevat (`pickForSlot`
 *  verwacht een volledige kandidatenlijst). */
export function personalOrderForSlot(
  entries: BreathHistoryEntry[],
  slot: string,
): BreathStateKey[] | null {
  const counts = new Map<BreathStateKey, number>();
  let total = 0;
  for (const e of entries) {
    if (slotForHour(new Date(e.ts).getHours()) !== slot) continue;
    const key = e.key as BreathStateKey;
    if (!ALL_STATES.includes(key)) continue;
    counts.set(key, (counts.get(key) ?? 0) + 1);
    total += 1;
  }
  if (total < MIN_SAMPLES) return null;

  return [...ALL_STATES].sort((a, b) => (counts.get(b) ?? 0) - (counts.get(a) ?? 0));
}
