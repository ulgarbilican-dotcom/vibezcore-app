/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — aanbevolen duur en ritme per techniek × ervaring

   Operator, 6 okt 2026 ("elke techniek kan door beginner, midden en
   gevorderd gedaan worden; daar speelt tijd een rol" → "ok go"). Twee
   assen, strikt gescheiden:
     · `TechniqueDef.level` = moeilijkheid van de TECHNIEK (data);
     · `UserLevel` hieronder  = ervaring van de GEBRUIKER met deze techniek.

   Onderzoeksbasis (peer-reviewed / originele protocollen, rapport 6 okt):
     · 5 min is de GETESTE dagdosis (Balban 2023, Cell Rep Med), geen drempel
       en geen omslagpunt — boven 5 min geen dosis-respons (Bentley 2023
       review; You/Laborde 2021 5/10/15/20 min). Nooit "na 5 min schakelt je
       lichaam" of "langer = meer effect" beweren.
     · Opbouw is vooral via het RITME onderbouwd (Balban: box-fasen per
       persoon 3–4 s → 5–6 s → 8–10 s; Ma 2017: beginners vertragen over
       weken; Weil: 4-7-8 eerst 4 cycli, na een maand 8). Langere sessies
       voor gevorderden zijn een KEUZE (protocollen met ervaren mensen
       gebruiken 15–20 min), geen "beter".
     · Regelmaat bouwt het effect op (Balban, Bentley ≥6×/week).
   Waarden zonder direct onderzoek (Triangle, de drie Boost-technieken) zijn
   logisch afgeleid — zie het rapport.

   Startniveau = `experienceLevel` uit de onboarding. Daarna stijgt het per
   techniek met afgemaakte sessies van díe techniek (los én uit een plan).
   Een ervaren gebruiker die een techniek nog nooit deed, begint één stap
   lager. 4-7-8 naar gevorderd (8 cycli) pas na een maand met die techniek,
   zoals Weil voorschrijft.
   ───────────────────────────────────────────────────────────────────────── */

import type { BreathStateKey, TechniqueDef } from '@/data/breath-states';
import { getBreathHistory, type BreathHistoryEntry } from '@/utils/breath-history';
import { getSetting, type ExperienceLevel } from '@/utils/settings';

export type UserLevel = ExperienceLevel;

const ORDER: UserLevel[] = ['beginner', 'intermediate', 'advanced'];

/** Afgemaakte sessies met één techniek per stap omhoog — ±2 weken bij de
 *  ≥6×/week uit Bentley 2023. Logische keuze, geen onderzoeksgetal. */
export const SESSIONS_PER_STEP = 12;
/** Weil: "first month of practice" vóór 8 cycli 4-7-8. */
const FOUR_SEVEN_EIGHT_DAYS = 28;

type Plan = {
  /** Aanbevolen minuten (of cycli bij 4-7-8) per niveau: [B, I, G]. */
  rec: [number, number, number];
  /** Fase-seconden per niveau, zelfde volgorde/lengte als `phases`. */
  rhythm?: [number[], number[], number[]];
};

/** Sleutel = `${toestand}:${techniek}` — 'equal' bestaat in twee toestanden. */
const PLANS: Record<string, Plan> = {
  'boost:diaphragmatic': { rec: [3, 3, 5] },
  'boost:equal': { rec: [3, 3, 5] },
  'boost:faster-equal': { rec: [2, 2, 2] },
  'focus:coherent': { rec: [5, 10, 20] },
  'focus:alternate-nostril': {
    rec: [5, 10, 15],
    rhythm: [[4, 4, 4, 4], [4, 4, 4, 4], [5, 5, 5, 5]],
  },
  'focus:ujjayi': { rec: [5, 10, 15] },
  'calm:extended-exhale': { rec: [5, 10, 15] },
  'calm:triangle': { rec: [5, 5, 10], rhythm: [[3, 3, 3], [4, 4, 4], [5, 5, 5]] },
  'calm:box': { rec: [5, 5, 5], rhythm: [[4, 4, 4, 4], [5, 5, 5, 5], [6, 6, 6, 6]] },
  'clarity:equal': { rec: [5, 5, 10] },
  'clarity:deep-extended-exhale': { rec: [5, 5, 10], rhythm: [[4, 6], [4, 8], [4, 8]] },
  'clarity:physiological-sigh': { rec: [5, 5, 5] },
  'rest:slow': { rec: [10, 15, 20], rhythm: [[4, 8], [5, 10], [5, 10]] },
  'rest:478': { rec: [4, 4, 8] },
  'rest:slow-extended-exhale': { rec: [10, 10, 15] },
};

const planFor = (stateKey: BreathStateKey, techKey: string): Plan | undefined =>
  PLANS[`${stateKey}:${techKey}`];

const idx = (l: UserLevel) => ORDER.indexOf(l);

/** Ervaringsniveau van deze gebruiker met déze techniek. */
export function levelForTechnique(
  stateKey: BreathStateKey,
  techKey: string,
  history: BreathHistoryEntry[] = getBreathHistory(),
  base: UserLevel | null = getSetting('experienceLevel'),
): UserLevel {
  const done = history.filter(
    (e) => e.key === stateKey && e.techniqueKey === techKey && e.completed !== false,
  );
  let start = idx(base ?? 'beginner');
  /* Ervaren met ademwerk, maar deze techniek nog nooit gedaan: één stap
     lager beginnen — vertrouwdheid met een techniek telt (ANB-onderzoek). */
  /* Audit 8 okt 2026: die stap lager geldt tot de gebruiker deze techniek
     een volle stap (12 sessies) gedaan heeft — niet maar één sessie. */
  if (start === 2 && done.length < SESSIONS_PER_STEP) start = 1;
  let level = Math.min(2, start + Math.floor(done.length / SESSIONS_PER_STEP));
  if (techKey === '478' && level === 2) {
    const first = Math.min(...done.map((e) => e.ts));
    const days = done.length ? (Date.now() - first) / 864e5 : 0;
    if (days < FOUR_SEVEN_EIGHT_DAYS) level = 1;
  }
  return ORDER[level];
}

/** Aanbevolen minuten (of cycli bij 4-7-8) voor dit niveau, of `null` als
 *  er voor deze techniek geen plan is (dan geldt de `recommended` uit de data). */
export function recommendedForLevel(
  stateKey: BreathStateKey,
  techKey: string,
  level: UserLevel,
): number | null {
  const p = planFor(stateKey, techKey);
  return p ? p.rec[idx(level)] : null;
}

/** De techniek met het ritme van dit niveau. Zelfde fasen, andere seconden. */
export function techniqueForLevel<T extends TechniqueDef>(
  stateKey: BreathStateKey,
  tech: T,
  level: UserLevel,
): T {
  const r = planFor(stateKey, tech.key)?.rhythm?.[idx(level)];
  if (!r || r.length !== tech.phases.length) return tech;
  return { ...tech, phases: tech.phases.map((ph, i) => ({ ...ph, secs: r[i] })) };
}

/** Sleutel voor `breathLevelSeen`. */
export const levelSeenKey = (stateKey: BreathStateKey, techKey: string) => `${stateKey}:${techKey}`;

/** DE aanbevolen duur in MINUTEN voor deze gebruiker en deze techniek —
 *  één bron voor elke plek in de app (operator, 10 okt 2026: "de recommended
 *  tijd die wij aanbevelen moet overal kloppen"). Volgt de ervaring (PLANS);
 *  zonder plan de `recommended`-vlag uit de data. Bij ritmes in cycli (4-7-8)
 *  de minuten van de preset met dat aantal cycli. */
export function personalRecommendedMinutes(
  stateKey: BreathStateKey,
  techKey: string,
  durations: { minutes: number; cycles?: number; recommended?: boolean }[],
  level: UserLevel = levelForTechnique(stateKey, techKey),
): number | null {
  const rec = recommendedForLevel(stateKey, techKey, level);
  if (rec != null) {
    if (durations.some((d) => d.cycles != null)) {
      const d = durations.find((x) => (x.cycles ?? x.minutes) === rec);
      if (d) return d.minutes;
    } else {
      return rec;
    }
  }
  return (durations.find((d) => d.recommended) ?? durations[0])?.minutes ?? null;
}
