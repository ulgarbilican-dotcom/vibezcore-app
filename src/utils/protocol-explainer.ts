/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Protocol-explainer

   Operator, 21 september 2026 ("kunnen wij die uitleg apple-stijl kort en
   duidelijk per protocol tonen, gepersonaliseerd voor eender welk
   protocool?"): zet een gegenereerde template (`PlannedItem[]`, uit
   protocol.ts) om in een korte, natuurlijke uitleg — waarom DEZE staten op
   DEZE momenten, voor DIT doel. Werkt voor élke combinatie (0-2 doelen ×
   1-4+ sessies × willekeurige dagdelen), want ze leest enkel de al
   gegenereerde `items` + `goals` uit, dezelfde data die het scherm al
   toont — nooit een eigen, aparte gok.

   Taal: enkel toestand-taal (energie/focus/kalmte/rust), geen wetenschaps-
   of medische claims (CLAUDE.md §1) — dezelfde grens als de rest van de
   app. */

import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';
import { GOAL_NAMES, type GoalKey } from '@/data/goal-states';
import type { PlannedItem, PlanSlot } from '@/utils/plan-store';

const SLOT_OPENER: Record<PlanSlot, string> = {
  morning: 'In the morning',
  midday: 'At midday',
  afterWork: 'After work',
  evening: 'In the evening',
};

/** Titel-case weergavenaam per staat — `BREATH_STATES[key].eyebrow` staat
 *  in hoofdletters (voor de kop op het sessiescherm), niet leesbaar
 *  middenin een zin. */
const STATE_DISPLAY_NAME: Record<BreathStateKey, string> = {
  boost: 'Boost',
  focus: 'Sharp Focus',
  calm: 'Calm Control',
  clarity: 'Clarity & Relax',
  rest: 'Sleep',
};

/** Wat elke staat doet, in twee-drie woorden — dezelfde toestand-taal als
 *  BREATH_STATES se `description`, enkel korter voor middenin een zin. */
const STATE_BLURB: Record<BreathStateKey, string> = {
  boost: 'for a quick lift in energy',
  focus: 'to sharpen concentration',
  calm: 'to settle and steady you',
  clarity: 'for a clear, open headspace',
  rest: 'to wind down and recover',
};

export type ProtocolExplanation = {
  intro: string;
  lines: { key: string; text: string }[];
};

/** Operator-copy, 21 september 2026 — één zin per doel-combinatie, geen
 *  losse tags. Enkel de eerste twee gekozen doelen tellen mee (zelfde
 *  grens als `goalRank`/`MAX_GOALS`). */
function introFor(goals: string[]): string {
  const names = goals
    .slice(0, 2)
    .map((g) => GOAL_NAMES[g as GoalKey])
    .filter((n): n is string => !!n);
  if (names.length === 0) return "Here's why each session sits where it does.";
  return `Built around ${names.join(' + ')} — here's why each session sits where it does.`;
}

/** Eén regel per sessie, chronologisch. Twee sessies in hetzelfde dagdeel
 *  (Pad B, "Build your day") herhalen het dagdeel niet — "Then" i.p.v.
 *  een tweede "At midday". */
export function explainProtocol(
  items: Pick<PlannedItem, 'slot' | 'state' | 'reminderAt'>[],
  goals: string[],
): ProtocolExplanation {
  const ordered = [...items].sort((a, b) => a.reminderAt - b.reminderAt);
  let prevSlot: PlanSlot | null = null;
  const lines = ordered.map((it, i) => {
    const slot = it.slot as PlanSlot;
    const opener = slot === prevSlot ? 'Then' : (SLOT_OPENER[slot] ?? 'Later');
    prevSlot = slot;
    const name = STATE_DISPLAY_NAME[it.state];
    const blurb = STATE_BLURB[it.state];
    return { key: `${slot}-${i}`, text: `${opener}, ${name} ${blurb}.` };
  });
  return { intro: introFor(goals), lines };
}
