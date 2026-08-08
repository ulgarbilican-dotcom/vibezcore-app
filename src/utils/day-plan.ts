/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Het dagplan: welke toestand op welk moment

   ÉÉN motor voor twee schermen (operator, 8 augustus 2026). De vragenlijst
   beloofde CLARITY · FOCUS · REST en Daily plan toonde FOCUS · FOCUS ·
   CLARITY — twee plekken die hetzelfde plan met een eigen sommetje
   uitrekenden. Een plan dat zichzelf tegenspreekt is geen plan; vanaf nu
   rekent alles hier.

   De grondwet is die van utils/breath-suggestion.ts:
   · De klok is leidend — REST hoort alleen 's avonds, BOOST nooit daar.
   · Het doel weegt BINNEN wat bij het moment past (goalRank, eerste twee).
   · Variatie: twee momenten na elkaar dezelfde toestand is een armere dag
     dan twee verwante.
   · Alles is na te vertellen — reasonFor geeft per keuze het doel dat hem
     daar zette.
   ───────────────────────────────────────────────────────────────────────── */

import { type BreathStateKey } from '@/data/breath-states';
import { GOALS, goalRank } from '@/data/goals';

/* Wat bij welk dagdeel KAN, in volgorde van vanzelfsprekendheid. Breder dan
   de per-uur-lijst van de losse suggestie, want een plan mag kiezen uit
   alles wat niet misstaat op dat moment. */
export const DAY_CANDIDATES: Record<string, BreathStateKey[]> = {
  morning: ['boost', 'focus', 'clarity', 'calm'],
  midday: ['focus', 'clarity', 'calm', 'boost'],
  evening: ['rest', 'calm', 'clarity'],
};

export const slotForHour = (h: number): string =>
  h < 12 ? 'morning' : h < 17 ? 'midday' : 'evening';

/** De toestand voor dit moment, gegeven de doelen en wat het vorige moment
 *  al kreeg. */
export function pickForSlot(
  slot: string,
  goals: string[],
  prev: BreathStateKey | null,
): BreathStateKey {
  const ranked = [...(DAY_CANDIDATES[slot] ?? DAY_CANDIDATES.evening)].sort(
    (a, b) => goalRank(goals, a) - goalRank(goals, b),
  );
  let pick = ranked[0];
  /* Variatie is een REGEL, geen gunst (operator, 8 augustus 2026: twee keer
     dezelfde toestand na elkaar "klopt absoluut niet"). Elk kandidaat op de
     lijst past sowieso bij dit moment, dus de tweede keuze is nooit fout —
     twee keer dezelfde wel. */
  if (pick === prev && ranked[1]) {
    pick = ranked[1];
  }
  return pick;
}

/** Waarom deze toestand hier staat: het gekozen doel dat hem het HOOGST
 *  zette, of anders het moment zelf. */
export function reasonForPick(
  state: BreathStateKey,
  goals: string[],
  slotLabel: string,
): string {
  let best: { name: string; idx: number } | null = null;
  for (const g of GOALS) {
    if (!goals.includes(g.key)) continue;
    const idx = (g.states as string[]).indexOf(state);
    if (idx === -1) continue;
    if (!best || idx < best.idx) best = { name: g.name, idx };
  }
  return best ? best.name : `Fits the ${slotLabel.toLowerCase()}`;
}
