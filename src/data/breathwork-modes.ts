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
   "Energy. Focus. Calm. Clarity. Rest." ritme op de CTA-card.
   Operator, 28 september 2026 ("alle breathwork moet kloppen" — audit na
   fouten op de website): deze tabel was volledig uit sync met
   bracelet-control.tsx's `BREATH_PROTOCOLS` (regel ~356-403, de echte
   bron) — elke techniek-naam stond fout, en 2 van de 5 duren ook. Nu
   herberekend uit de echte protocol-waarden (cycles × fase-duur):
     Boost:  45×(2+2)s        = 3 min  (was "Energizing · 6 min")
     Focus:  30×(5+5)s        = 5 min  (was "Triangle breath · 4 min")
     Calm:   19×4×4s (box)    = 5 min  (was "Coherent · 5 min" — duur klopte toevallig)
     Clarity:20×(4+2+6)s      = 4 min  (was "Nadi Shodhana · 5 min")
     Sleep:  12×(4+7+8)s      = ~4 min (was "Box breath · 4 min" — duur klopte toevallig) */
export const BREATHWORK_CHOOSER: BreathworkChooserOption[] = [
  { mode: BraceletMode.Gamma, purpose: 'Energy',   technique: 'Boost',           minutes: 3 },
  { mode: BraceletMode.Beta,  purpose: 'Focus',    technique: 'Coherent breath', minutes: 5 },
  { mode: BraceletMode.Alpha, purpose: 'Calm',     technique: 'Box breath',      minutes: 5 },
  { mode: BraceletMode.Theta, purpose: 'Clarity',  technique: 'Long exhale',     minutes: 4 },
  { mode: BraceletMode.Delta, purpose: 'Rest',     technique: '4-7-8',           minutes: 4 },
];
