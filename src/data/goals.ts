/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Doelen

   Vier doelen, en bewust niet meer (operator, 5 augustus 2026). Alle vier
   zijn TOESTANDEN waar één sessie iets aan kan doen.

   Wat er bewust NIET bij staat: zelfvertrouwen, zelfbeheersing, discipline.
   Dat zijn eigenschappen, geen toestanden — die verander je niet in vijf
   minuten, en ze als doel aanbieden belooft iets wat de app niet waarmaakt.
   Dat merkt een gebruiker binnen twee weken, en dan is het vertrouwen weg.

   Wat een doel WEL doet: het weegt mee in welke toestand er voorgesteld
   wordt, en op welk moment. Het bepaalt niets dwingend — de vijf deuren
   blijven allemaal open, altijd. Een doel is een voorkeur, geen route.

   Toestand-taal, geen claims over het lichaam (CLAUDE.md §1).
   ───────────────────────────────────────────────────────────────────────── */

import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';

export type GoalKey = 'sleep' | 'stress' | 'energy' | 'focus';

export type Goal = {
  key: GoalKey;
  name: string;
  /** Eén regel: wat je ervan merkt, niet wat het met je doet. */
  hint: string;
  /** Welke toestanden bij dit doel horen, belangrijkste eerst. */
  states: BreathStateKey[];
  /** Waar de nadruk op ligt: de klok blijft leidend, maar binnen een
   *  dagdeel wint een toestand die bij het doel hoort. */
  accent: string;
};

export const GOALS: Goal[] = [
  {
    key: 'sleep',
    name: 'Sleep better',
    hint: 'Wind down at the end of the day',
    states: ['rest', 'clarity', 'calm'],
    accent: BREATH_STATES.rest.accent,
  },
  {
    key: 'stress',
    name: 'Less stress',
    hint: 'Come back to steady when it builds',
    states: ['calm', 'clarity', 'rest'],
    accent: BREATH_STATES.calm.accent,
  },
  {
    key: 'energy',
    name: 'More energy',
    hint: 'Start moving when you feel flat',
    states: ['boost', 'focus', 'clarity'],
    accent: BREATH_STATES.boost.accent,
  },
  {
    key: 'focus',
    name: 'Sharper focus',
    hint: 'Hold your attention on one thing',
    states: ['focus', 'clarity', 'calm'],
    accent: BREATH_STATES.focus.accent,
  },
];

export const goalByKey = (k: string | null): Goal | null =>
  k ? (GOALS.find((g) => g.key === k) ?? null) : null;
