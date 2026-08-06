/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Welke toestand nu

   Othership heeft een dagelijkse UP en DOWN, Open heeft een dagprogramma.
   Wij hebben vijf deuren en de historiek van de gebruiker, en daarmee kun je
   hetzelfde bereiken zonder één opname extra.

   ── Alles hier is NA TE VERTELLEN ─────────────────────────────────────
   Geen hartslag, geen HRV, geen "adaptief". Alleen de klok en wat iemand
   zelf gedaan heeft. Dat is een bewuste grens: een suggestie die niemand kan
   verklaren voelt als een gok, en één keer BOOST voorstellen om elf uur
   's avonds kost meer geloofwaardigheid dan tien goede suggesties opleveren.

   De regels staan hieronder in de volgorde waarin ze gelden. Wie ze leest
   kan precies voorspellen wat de app gaat voorstellen — en dat hoort zo.
   ───────────────────────────────────────────────────────────────────────── */

import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';
import { goalByKey } from '@/data/goals';
import type { BreathHistoryEntry } from '@/utils/breath-history';

export type Suggestion = {
  state: BreathStateKey;
  /** Welke duur uit `durations` van die toestand. */
  durationIdx: number;
  /** Korte reden, zichtbaar voor de gebruiker. Geen uitleg-taal, een label. */
  reason: string;
};

/* Wat past bij welk uur. De avondgrens is hard: na negenen is REST & RESET
   het enige juiste antwoord, wat de historiek ook zegt. */
function byHour(h: number): BreathStateKey[] {
  if (h < 6) return ['rest'];
  if (h < 11) return ['boost', 'focus'];
  if (h < 15) return ['focus', 'clarity'];
  if (h < 21) return ['calm', 'clarity'];
  return ['rest'];
}

const REASON: Record<BreathStateKey, string> = {
  boost: 'To start the day',
  focus: 'For deep work',
  calm: 'To settle the afternoon',
  clarity: 'To clear your head',
  rest: 'To wind down',
};

export function suggestBreath(
  history: BreathHistoryEntry[],
  now: Date,
  goalKey?: string | null,
): Suggestion {
  const hour = now.getHours();
  const fits = byHour(hour);

  /* Recent = de laatste drie sessies. Wie twee keer hetzelfde deed krijgt
     iets anders voorgesteld — variatie is hier geen sier maar het verschil
     tussen een app die meedenkt en een lijst die zich herhaalt. */
  const recent = [...history].sort((a, b) => b.ts - a.ts).slice(0, 3);
  const lastTwoSame =
    recent.length >= 2 && recent[0]?.key === recent[1]?.key
      ? recent[0].key
      : null;

  /* Wat iemand structureel afbreekt, stellen we niet voor. Drie of meer
     pogingen en minder dan de helft afgemaakt is genoeg signaal: die
     toestand werkt niet voor deze persoon, en hem blijven aanbieden maakt
     de suggestie ongeloofwaardig. */
  const abandoned = new Set<string>();
  for (const k of Object.keys(BREATH_STATES)) {
    const mine = history.filter((e) => e.key === k);
    if (mine.length < 3) continue;
    const done = mine.filter((e) => e.completed !== false).length;
    if (done / mine.length < 0.5) abandoned.add(k);
  }

  /* Het doel weegt mee BINNEN wat bij dit uur past, niet erbovenuit. Wie
     "meer energie" kiest krijgt geen BOOST om elf uur 's avonds — de klok
     blijft leidend, en één absurde suggestie kost meer vertrouwen dan tien
     goede opleveren. */
  const goal = goalByKey(goalKey ?? null);
  const ranked = goal
    ? [...fits].sort(
        (a, b) =>
          (goal.states.indexOf(a) + 1 || 99) -
          (goal.states.indexOf(b) + 1 || 99),
      )
    : fits;

  let state =
    ranked.find((k) => k !== lastTwoSame && !abandoned.has(k)) ??
    ranked.find((k) => !abandoned.has(k)) ??
    ranked[0];

  /* Nog niets gedaan vandaag? Dan de KORTSTE duur. Een gewoonte houd je vol
     met drie minuten, niet met twintig — en de drempel van vandaag bepaalt
     of er een morgen is. */
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const doneToday = history.some((e) => e.ts >= startOfDay.getTime());

  const durations = BREATH_STATES[state].durations;
  let durationIdx = doneToday
    ? BREATH_STATES[state].defaultDuration
    : 0;

  /* Kiest iemand bij deze toestand altijd dezelfde lengte, volg dat dan —
     ook als het een andere is dan onze standaard. */
  if (doneToday) {
    const mine = history.filter((e) => e.key === state).slice(-5);
    if (mine.length >= 3) {
      const target = mine.reduce((s, e) => s + e.durSec, 0) / mine.length / 60;
      let best = durationIdx;
      let gap = Infinity;
      durations.forEach((d, i) => {
        const g = Math.abs(d.minutes - target);
        if (g < gap) {
          gap = g;
          best = i;
        }
      });
      durationIdx = best;
    }
  }

  return {
    state,
    durationIdx,
    reason: !doneToday && history.length > 0 ? 'Keep your streak' : REASON[state],
  };
}
