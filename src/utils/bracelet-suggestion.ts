/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Welke bracelet-modus nu

   Operator, 29 september 2026 ("kunnen wij voor bracelet ook een
   preselected programma maken volgens onze documentatie"): dezelfde
   tijdstip-motor als breathwork's `suggestBreath()` (`breath-suggestion.ts`)
   — DAY_CANDIDATES/slotForHour uit `utils/day-plan.ts`, hier hergebruikt
   i.p.v. herschreven, met dezelfde grondwet ("geen hartslag, geen HRV,
   geen 'adaptief', alles na te vertellen"). Puur app-zijdig: bepaalt enkel
   welke modus al aangevinkt staat vóór de gebruiker op Start tikt — geen
   BLE-/firmware-/PCB-impact (bevestigd aan de operator: het commando gaat
   pas de deur uit bij een expliciete Start-tik, ongeacht welke modus
   vooraf al geselecteerd stond).

   Gedeeld tussen bracelet-control.tsx (bepaalt `initialMode`) en
   activity.tsx (toont de suggestie in de "Set your goal"-kaart voor
   bracelet) — één bron, zodat beide plekken nooit een andere modus
   voorstellen. */

import { DAY_CANDIDATES, slotForHour } from '@/utils/day-plan';
import type { BreathStateKey } from '@/data/breath-states';
import { BraceletMode } from '@/services/ble-contract';

/* Zelfde 5-staten-naar-5-modi-mapping als breathwork-modes.ts
   (BREATHWORK_CHOOSER): Boost↔Gamma, Sharp Focus↔Beta, Calm Control↔Alpha,
   Clarity & Relax↔Theta, Sleep↔Delta — spec §8.1. */
const STATE_TO_MODE: Record<BreathStateKey, BraceletMode> = {
  boost: BraceletMode.Gamma,
  focus: BraceletMode.Beta,
  calm: BraceletMode.Alpha,
  clarity: BraceletMode.Theta,
  rest: BraceletMode.Delta,
};

/* Geen persoonlijke geschiedenis/doel-input hier (die bestaat voor de
   bracelet nog niet) — enkel de generieke tijdstip-tiebreak, eerste
   kandidaat van dat dagdeel. Zelfde bron als breathwork, dus nooit een
   ander verhaal tussen de twee schermen. */
export function suggestBraceletMode(now: Date): BraceletMode {
  const slot = slotForHour(now.getHours());
  const state = (DAY_CANDIDATES[slot]?.[0] ?? 'calm') as BreathStateKey;
  return STATE_TO_MODE[state];
}
