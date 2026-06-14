/* ───────────────────────────────────────────────────────────────────────────
 * BREATHWORK MODES — shared chooser data
 *
 * De 5 breathwork-protocols matchen 1-op-1 met de 5 bracelet-modi. Naam
 * + duur worden hier ge-export voor de chooser modals op de Audio en
 * Bracelet tabs. Kleur + bracelet-mode-naam komen via getModeMeta.
 *
 * Bron: bracelet-control.tsx BREATHWORK_PROTOCOLS (iter 8/9).
 * Aanpassingen aan tempo's hier moeten met die file in sync blijven.
 *
 * Gebruikt door:
 *   - src/app/(tabs)/index.tsx       (Audio tab Free Breathwork CTA)
 *   - src/app/(tabs)/bracelet.tsx    (Bracelet tab Free Breathwork CTA)
 * ─────────────────────────────────────────────────────────────────────────── */

import { BraceletMode } from '@/services/ble-contract';

export interface BreathworkChooserOption {
  /** Bracelet-mode index — gebruikt als query-param richting bracelet-control */
  mode: BraceletMode;
  /** State purpose-tag (Apple-stijl) — "Energy", "Focus", etc. */
  purpose: string;
  /** Breathwork-techniek naam — "Energizing", "Triangle breath", etc. */
  technique: string;
  /** Sessie-duur in minuten */
  minutes: number;
}

/* Volgorde: Boost · Sharp Focus · Calm · Clarity · Rest — matcht het
   "Energy. Focus. Calm. Clarity. Rest." ritme op de CTA-card. */
export const BREATHWORK_CHOOSER: BreathworkChooserOption[] = [
  { mode: BraceletMode.Gamma, purpose: 'Energy',   technique: 'Energizing',      minutes: 6 },
  { mode: BraceletMode.Beta,  purpose: 'Focus',    technique: 'Triangle breath', minutes: 4 },
  { mode: BraceletMode.Alpha, purpose: 'Calm',     technique: 'Coherent',        minutes: 5 },
  { mode: BraceletMode.Theta, purpose: 'Clarity',  technique: 'Nadi Shodhana',   minutes: 5 },
  { mode: BraceletMode.Delta, purpose: 'Rest',     technique: 'Box breath',      minutes: 4 },
];
