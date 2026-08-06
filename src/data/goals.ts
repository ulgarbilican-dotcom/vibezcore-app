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

import {
  Crosshair,
  Moon,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';

export type GoalKey = 'sleep' | 'stress' | 'energy' | 'focus';

export type Goal = {
  key: GoalKey;
  /* Een icoon in plaats van een bolletje (operator, 6 augustus 2026). Vier
     bolletjes in vier kleuren zeggen alleen "dit zijn er vier"; een maan, een
     golf, een vonk en een schijf zeggen waar het over gaat nog voor je leest.
     Allemaal uit Lucide, dezelfde familie als de rest van de app. */
  Icon: LucideIcon;
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
    Icon: Moon,
    name: 'Sleep better',
    hint: 'Wind down at the end of the day',
    states: ['rest', 'clarity', 'calm'],
    accent: BREATH_STATES.rest.accent,
  },
  {
    key: 'stress',
    Icon: Waves,
    name: 'Less stress',
    hint: 'Come back to steady when it builds',
    states: ['calm', 'clarity', 'rest'],
    accent: BREATH_STATES.calm.accent,
  },
  {
    key: 'energy',
    Icon: Zap,
    name: 'More energy',
    hint: 'Start moving when you feel flat',
    states: ['boost', 'focus', 'clarity'],
    accent: BREATH_STATES.boost.accent,
  },
  {
    key: 'focus',
    Icon: Crosshair,
    name: 'Sharper focus',
    hint: 'Hold your attention on one thing',
    states: ['focus', 'clarity', 'calm'],
    accent: BREATH_STATES.focus.accent,
  },
];

export const goalByKey = (k: string | null): Goal | null =>
  k ? (GOALS.find((g) => g.key === k) ?? null) : null;

/** Hoogstens twee — zie de toelichting bij `goals` in utils/settings.ts. */
export const MAX_GOALS = 2;

export const goalsByKeys = (keys: string[]): Goal[] =>
  keys.map((k) => goalByKey(k)).filter((g): g is Goal => g !== null);

/** Hoe zwaar een toestand weegt over ALLE gekozen doelen heen. Lager is
 *  belangrijker; 99 = komt bij geen enkel doel voor. Bij twee doelen telt de
 *  BESTE positie, zodat een toestand die bij allebei hoort vooropgaat zonder
 *  dat de rest gelijk komt te staan. */
export const goalRank = (keys: string[], state: string): number => {
  const gs = goalsByKeys(keys);
  if (gs.length === 0) return 99;
  return Math.min(
    ...gs.map((g) => {
      const i = g.states.indexOf(state as never);
      return i === -1 ? 99 : i + 1;
    }),
  );
};
