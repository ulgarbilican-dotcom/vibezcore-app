/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Doel-kern (RN-vrij)

   Operator, 21 september 2026 ("dit is te gevoelig om aan het toeval over
   te laten... hoeveel combinaties zijn er"): geëxtraheerd uit goals.ts
   zodat de protocol-generator (`day-plan.ts`, `protocol.ts`) en een
   permanent testscript (`scripts/verify-protocol.ts`) deze data — en
   vooral `goalRank`, het hart van de state-toewijzing — rechtstreeks met
   `tsx` kunnen importeren, BUITEN de app om. goals.ts importeert
   `lucide-react-native` (voor de `Icon`-velden) en dat sleept via de
   module-graph `react-native` zelf mee, wat een losstaand testscript
   direct laat crashen (esbuild kan de Flow-syntax in react-native/index.js
   niet parsen). Dit bestand raakt NOOIT React Native aan — pure data +
   pure functies — zodat de kernlogica altijd, ook los van de app,
   uitvoerbaar en exhaustief testbaar blijft.

   goals.ts blijft de bron van waarheid voor UI-velden (Icon/accent/
   gradient/image) en bouwt zijn `GOALS`-array bovenop `GOAL_STATES`
   hieronder — de states-lijst per doel bestaat dus maar op ÉÉN plek. */

import { type BreathStateKey } from '@/data/breath-states';

/* Operator, 22 september 2026 ("more energy en peak performance zelfde
   doel... calm the mind overlapt met recover en relax, niet sleep — sleep
   is 's avonds voor slapen, recover/relax meestal na werk"): van 8 naar 6
   doelen. `peakPerformance` (overlapte met `energy`) en `calmMind`
   (overlapte met `recovery`, niet met `sleep` — dat blijft een eigen,
   avond-specifiek doel) zijn weg. `GOAL_STATES`/`GOALS` (goals.ts) leiden
   hier dynamisch uit af, dus dit is de ENE plek die moest veranderen —
   geen los "8 doelen"-getal ergens anders in de app. */
export type GoalKey =
  | 'sleep'
  | 'stress'
  | 'energy'
  | 'focus'
  | 'emotionalBalance'
  | 'recovery';

export const GOAL_KEYS: GoalKey[] = [
  'sleep',
  'stress',
  'energy',
  'focus',
  'emotionalBalance',
  'recovery',
];

export const GOAL_NAMES: Record<GoalKey, string> = {
  sleep: 'Sleep better',
  stress: 'Less stress',
  energy: 'More energy',
  focus: 'Sharper focus',
  emotionalBalance: 'Emotional balance',
  recovery: 'Recover & relax',
};

/** Welke toestanden bij elk doel horen, belangrijkste eerst — DE bron van
 *  waarheid; goals.ts se `GOALS`-array leest hieruit i.p.v. een eigen
 *  kopie bij te houden. Zie goals.ts voor de toelichting per rangschikking
 *  (elke volgorde staat daar onderbouwd, dit bestand herhaalt enkel de
 *  waarden zelf). */
/* Operator, 22 september 2026, uitgebreide ronde ("wanneer heb je meer
   energy nodig? wanneer begin je af te winden? wanneer ga je richting
   totale rust voor slapen? dat moet toch pure logica kunnen worden"):
   `rest` stond bij Energy/Focus enkel impliciet mee via een toevallige
   99-99-gelijkstand met Calm bij het avond-dagdeel (array-volgorde
   besliste, geen bewuste keuze) — nu EXPLICIET onderaan gezet ("'s avonds
   goed slapen, zodat je morgen weer energie/scherpte hebt"), i.p.v. op
   toeval te vertrouwen. Bij Stress stond Rest al in de lijst maar ná Calm;
   nu ervóór ("savonds goed slapen heel belangrijk hier" — stress speelt
   zich af TIJDENS de dag via Clarity/Focus/Calm, de avond mag wél naar
   echte slaap-prep gaan, niet enkel een zachte landing). Dit is voor alle
   drie veilig: `rest` is een kandidaat voor GEEN ENKEL dagdeel behalve
   `evening` (zie `DAY_CANDIDATES`, day-plan.ts) — welke rang hij hier
   krijgt, hij kan NOOIT gekozen worden voor ochtend/middag/after-work,
   voor geen enkel doel. Emotional Balance blijft bewust ongewijzigd (geen
   sleep-narratief, Calm is al de hele dag even sterk — "over heel de dag"
   klopt al zonder aanpassing). */
export const GOAL_STATES: Record<GoalKey, BreathStateKey[]> = {
  sleep: ['rest', 'clarity', 'calm'],
  stress: ['clarity', 'focus', 'rest', 'calm'],
  energy: ['boost', 'focus', 'clarity', 'rest', 'calm'],
  /* `boost` toegevoegd (operator, 22 september 2026, "smiddags een boost
     doen om energieniveau terug te verhogen" — de post-lunch-dip
     bestrijden hoort net zo goed bij Sharper Focus als bij Energy). */
  focus: ['focus', 'boost', 'clarity', 'rest', 'calm'],
  emotionalBalance: ['calm', 'clarity', 'focus'],
  /* Operator, 22 september 2026 (vervolg op de 21 sept-veiligheidsregel
     hieronder): `rest` terug toegelaten — operator's eigen conclusie na
     verificatie dat `rest` structureel nooit buiten `evening` kan
     verschijnen (voor geen enkel doel, zie DAY_CANDIDATES): het gevaar
     dat de 21 sept-regel wilde vermijden (sufheid tijdens de rit naar
     huis) speelt zich af in `afterWork`, waar `rest` sowieso nooit een
     geldige kandidaat is. "'s Avonds beter slapen" kan dus zonder risico
     bij Recovery horen. `rest` staat VOORAAN (niet onderaan) — Calm blijft
     anders globaal #1 en wint dan ook de avond (getest: onderaan gaf
     nog steeds Calm 's avonds, niet Rest). Vooraan zetten verandert
     NIETS aan ochtend/middag/after-work (DAY_CANDIDATES bevat daar geen
     `rest`, dus Calm wint die drie sowieso nog steeds) — enkel de avond
     zelf kiest nu bewust Rest i.p.v. Calm. */
  recovery: ['rest', 'calm', 'focus', 'clarity'],
};

/* Operator, 22 september 2026 ("recovery na het werk en savonds, niet
   ochtend/middag"): Calm (Recovery's #1) scoort in ALLE 4 dagdelen van
   `DAY_CANDIDATES` exact even sterk — een perfecte gelijkstand die
   `bestSlotsForCount`'s standaard-tiebreak (dichtst bij het dagdeel dat
   als EERSTE wint, in dagvolgorde) altijd naar de ochtend trok, puur
   toeval van dagvolgorde, geen inhoudelijke voorkeur. Doelen hier geven
   een EXPLICIETE tiebreak-volgorde i.p.v. impliciet op "ochtend eerst" te
   vallen. Enkel doelen met zo'n perfecte gelijkstand hebben dit nodig —
   Stress/Energy/Focus/Sleep hebben elk al genoeg onderscheid tussen
   dagdelen en gedragen zich zonder entry hier exact zoals voorheen. */
export const GOAL_SLOT_PRIORITY: Partial<Record<GoalKey, string[]>> = {
  recovery: ['afterWork', 'evening', 'midday', 'morning'],
};

/* Operator, 22 september 2026 ("wat zorgt ervoor dat iemand beter slaapt,
   hoe ziet de dag eruit... smorgens sharp focus, smiddags calm control,
   na het werk clarity, savonds sleep"): een gebalanceerde dag ALS GEHEEL
   is wat tot goede slaap leidt, niet enkel de avondsessie zelf. Dat is
   met de gewone `goalRank`-motor niet te bereiken — de "vermijd exacte
   herhaling"-regel in `pickStatesForDay` mag alleen wisselen naar een
   EVENWAARDIGE (top-2) state, en een traject met 4 verschillende stappen
   zou minstens 3 states in de top-2 vereisen, onmogelijk want rangen zijn
   uniek per doel (`indexOf` levert nooit twee keer dezelfde positie).
   Dit is dus een NIEUW mechanisme: een expliciet dagtraject per dagdeel,
   enkel gebruikt wanneer dit doel als ENIGE gekozen is (`pickStatesForDay`
   in day-plan.ts) — bij 2 gekozen doelen samen zou een vast traject de
   TWEEDE doel volledig overrulen, dus dan valt het terug op de gewone
   `GOAL_STATES`-rangschikking. Elke state hier is ook geverifieerd geldig
   voor zijn dagdeel (`DAY_CANDIDATES`) — geen enkele hier zou de gewone
   veiligheidsregels schenden. */
export const GOAL_DAY_JOURNEY: Partial<
  Record<GoalKey, Partial<Record<string, BreathStateKey>>>
> = {
  sleep: {
    morning: 'focus',
    midday: 'calm',
    afterWork: 'clarity',
    evening: 'rest',
  },
};

/** 4 -> 2 (operator, 13 augustus 2026, protocol-systeem: "primair +
 *  optioneel secundair doel"). `goalRank` gebruikte toch al alleen de
 *  eerste twee gekozen doelen. */
export const MAX_GOALS = 2;

/** Hoe zwaar een toestand weegt over ALLE gekozen doelen heen. Lager is
 *  belangrijker; 99 = komt bij geen enkel doel voor. Bij twee doelen telt
 *  de BESTE positie, zodat een toestand die bij allebei hoort vooropgaat
 *  zonder dat de rest gelijk komt te staan. */
export const goalRank = (keys: string[], state: string): number => {
  /* Alleen de EERSTE TWEE sturen de suggestie, wat er ook aangevinkt staat. */
  const gs = keys
    .slice(0, MAX_GOALS)
    .map((k) => GOAL_STATES[k as GoalKey])
    .filter((s): s is BreathStateKey[] => !!s);
  if (gs.length === 0) return 99;
  return Math.min(
    ...gs.map((states) => {
      const i = states.indexOf(state as BreathStateKey);
      return i === -1 ? 99 : i + 1;
    }),
  );
};
