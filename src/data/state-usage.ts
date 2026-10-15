/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — "Wanneer gebruik je deze toestand?" in één korte regel

   Operator, 15 okt 2026: per toestand op het horloge een korte uitleg
   wanneer te gebruiken — "maar moet overzichtelijk blijven". Eén regel van
   enkele woorden onder de naam (zoals een ondertitel in de Workout-app),
   geen i-knop. Kort (≤ 16 tekens: past onderaan het ronde scherm, operator 15 okt 2026). Kort gemaakt uit de langere uitleg in de app
   (bracelet-control.tsx `BREATH_WHEN`, breath-states.ts `moments`).
   Welzijnstaal, geen claims. Concept-tekst: operator keurt goed.

   Geldt voor State Control én Breathwork (dezelfde vijf toestanden).
   ───────────────────────────────────────────────────────────────────────── */

import { BraceletMode } from '@/services/ble-contract';
import type { BreathStateKey } from '@/data/breath-states';

export const STATE_USAGE: Record<BraceletMode, string> = {
  [BraceletMode.Gamma]: 'When energy is low',
  [BraceletMode.Beta]: 'For deep work',
  [BraceletMode.Alpha]: 'Under pressure',
  [BraceletMode.Theta]: 'To unwind',
  [BraceletMode.Delta]: 'Before bed',
};

export const BREATH_STATE_MODE: Record<BreathStateKey, BraceletMode> = {
  boost: BraceletMode.Gamma,
  focus: BraceletMode.Beta,
  calm: BraceletMode.Alpha,
  clarity: BraceletMode.Theta,
  rest: BraceletMode.Delta,
};
