/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — duurkeuzes per techniek, één bron voor de hele app

   Operator, 8 okt 2026 ("in your breathwork plan zie ik enkel 5 10 20 min
   — overal dezelfde keuzes"): het instelscherm (breath-setup.tsx) toonde
   per TECHNIEK elke hele minuut tussen de kleinste preset en het plafond,
   de plannen (agenda.tsx, plan.tsx) enkel de drie toestands-presets.
   Nu leest alles hier, dezelfde regels als het instelscherm:
     - cyclus-technieken (4-7-8): enkel hun vaste presets;
     - technieken zonder verlenging (NO_EXTEND): kleinste → grootste preset;
     - de rest: kleinste preset → CUSTOM_CEILING_MIN, per minuut.
   ───────────────────────────────────────────────────────────────────────── */

import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';
import { personalRecommendedMinutes } from '@/utils/breath-level';

export const CUSTOM_CEILING_MIN = 30;

export const NO_EXTEND_TECHNIQUE_KEYS = new Set([
  'faster-equal', // Boost — hyperventilatie-risico, "longer is not better"
  'ujjayi', // Focus — amber-tier, bronnen noemen nergens langer dan 20 min
  'triangle', // Calm — hold-techniek, specialist-review vereist
  'box', // Calm — CO2-opbouw bij twee holds, wordt over weken opgebouwd
  'physiological-sigh', // Clarity — dit IS al de exacte Stanford-studiedosering
]);

export type DurationOption = { value: number; label: string };

/** Alle kiesbare minuten voor deze techniek, plus de aanbevolen waarde. */
export function durationOptionsFor(
  stateKey: BreathStateKey,
  techKey: string | undefined,
): { options: DurationOption[]; recommended: number | null } {
  const st = BREATH_STATES[stateKey];
  const tech = st.techniques.find((t) => t.key === techKey) ?? st.techniques[0];
  const presets = tech.durations ?? st.durations;
  const isCycles = presets.some((d) => d.cycles != null);
  const minutes = presets.map((d) => d.minutes);
  const min = Math.min(...minutes);
  const max = NO_EXTEND_TECHNIQUE_KEYS.has(tech.key) ? Math.max(...minutes) : CUSTOM_CEILING_MIN;
  const label = (v: number) => `${v} min`;
  const options = isCycles
    ? presets.map((d) => ({ value: d.minutes, label: label(d.minutes) }))
    : Array.from({ length: max - min + 1 }, (_, i) => ({ value: min + i, label: label(min + i) }));
  /* `defaultDuration` is een INDEX in st.durations, geen minutenwaarde. */
  /* Operator, 10 okt 2026: overal dezelfde (persoonlijke) aanbeveling. */
  const rec =
    personalRecommendedMinutes(stateKey, tech.key, presets) ??
    st.durations[st.defaultDuration]?.minutes ??
    null;
  return { options, recommended: rec };
}
