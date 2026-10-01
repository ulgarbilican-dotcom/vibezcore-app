/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Doelen

   Oorspronkelijk vier, bewust niet meer (operator, 5 augustus 2026) — later
   uitgebreid naar acht (operator, 13 augustus 2026, protocol-systeem), en
   op 22 september 2026 teruggebracht naar ZES ("more energy en peak
   performance zelfde doel... calm the mind overlapt met recover en relax,
   niet sleep"): Peak performance (overlapte met Energy) en Calm the mind
   (overlapte met Recovery, niet met Sleep — dat blijft avond-specifiek)
   zijn geschrapt, zie `goal-states.ts` voor de bron van waarheid. Het
   principe blijft ongewijzigd: elk doel is een TOESTAND waar één sessie iets
   aan kan doen, geen eigenschap. De doelen zijn geen nieuwe inhoud — het
   zijn verschillende RANGSCHIKKINGEN over dezelfde vijf ademtoestanden
   (`BreathStateKey`); overlap tussen doelen is dus normaal en geen bug,
   want er zijn nu eenmaal maar vijf toestanden om uit te kiezen.

   "Anxiety Relief" (uit de operator-opgave) was hier ooit "Calm the Mind"
   — "anxiety" is klinische taal en dat verbiedt CLAUDE.md §1 expliciet;
   alleen toestand-taal. Dat doel zelf is intussen ook geschrapt (zie
   hierboven), maar de reden voor de naamskeuze blijft relevant mocht een
   vergelijkbaar doel ooit terugkomen.

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
  BatteryCharging,
  Crosshair,
  Moon,
  Scale,
  Waves,
  Zap,
  type LucideIcon,
} from 'lucide-react-native';
import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';
/* Operator, 21 september 2026 ("dit is te gevoelig om aan het toeval over
   te laten"): `states`/`goalRank`/`MAX_GOALS` wonen sinds vandaag in
   `goal-states.ts` — een RN-vrij bestand, zodat de protocol-generator
   (`day-plan.ts`) en een permanent testscript ze rechtstreeks met `tsx`
   kunnen importeren, buiten de app (en dus buiten `lucide-react-native`,
   dat hier importeren normaal onmogelijk maakt) om. Hier enkel opnieuw
   geëxporteerd zodat bestaande `from '@/data/goals'`-imports elders
   ongewijzigd blijven werken. */
import { GOAL_STATES, goalRank, MAX_GOALS, type GoalKey } from '@/data/goal-states';

export { goalRank, MAX_GOALS, type GoalKey };

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
  /** Operator, 21 september 2026 ("bij aanklikken transformeert de kaart
   *  volledig in een rijke, levendige gradiënt die past bij het doel —
   *  sleep better kleurt naar diep koningsblauw met paars, peak
   *  performance explodeert in feloranje met neon-roze"): 2-stop-gradiënt
   *  voor de GESELECTEERDE staat van een goal.tsx-tegel, los van `accent`
   *  (dat blijft de subtielere/algemene kleur — badges, dun randje). Elke
   *  tint is met de hand gekozen binnen de kleurfamilie van `accent`,
   *  behalve de twee expliciet opgegeven voorbeelden. */
  gradient: [string, string];
  /** Operator, 11 september 2026: kaart-achtergrondfoto per doel (Bunny
   *  CDN) — de foto vult de HELE kaart, geen donker verloop eroverheen
   *  (operator: "geen overlay, moeten scherp overkomen" — de foto's zijn
   *  zelf donker/moody genoeg om witte tekst te dragen). Alle 8 doelen
   *  hebben er inmiddels een. */
  image?: string;
  /** Operator, 11 september 2026 (2-koloms grid, 9e ronde): "bal moet in
   *  beeld" — eerste poging gebruikte een `transform` bovenop de al
   *  gecropte (resizeMode="cover") Image; dat kan alleen verder INzoomen
   *  op wat al zichtbaar was, nooit een ander deel van de bron tonen —
   *  bij foto's waar de bol al vlak tegen de rand van de standaard-crop
   *  stond (bv. focus) duwde die extra zoom hem er juist helemaal uit.
   *  Opgemeten in de browser (echte bol-posities per foto) en opnieuw
   *  opgebouwd als een bewust oversized foto die WEL over de volle bron
   *  kan pannen — zie goal.tsx. Waarde = extra procentpunt van de bron
   *  die rechts in beeld komt t.o.v. de gecentreerde standaard-crop (die
   *  toont al 22-78% van de bron); 0/undefined = gecentreerd laten. */
  imageOffsetX?: number;
};

const GOAL_CDN =
  'https://vibezcore-audio.b-cdn.net/Breathwork%20audio';

export const GOALS: Goal[] = [
  {
    key: 'sleep',
    Icon: Moon,
    name: 'Sleep better',
    hint: 'Wind down at the end of the day',
    states: GOAL_STATES.sleep,
    accent: BREATH_STATES.rest.accent,
    /* Operator, 21 september 2026: "sleep better keuze kleur mag zelfde
       zijn als recover en relax" — was "diep koningsblauw met paars",
       nu dezelfde gradiënt als 'recovery' (beide leunen op REST). */
    gradient: ['#57D9A3', '#22B8CF'],
    /* Operator, 21 september 2026: eerste van de 8 doelen die een eigen
       foto krijgt op goal.tsx (Let VIBEZCORE build it, stap 2) — zie
       `GoalTile` in goal.tsx voor de foto-achtergrond-behandeling, zelfde
       recept als intensity.tsx (stap 3). De andere 7 behouden hun
       icoon+kleur-wasem tot ze ook een foto krijgen. */
    /* Operator, 21 september 2026: gewisseld met 'recovery' (het
       maantje-icoon paste beter bij Sleep better). */
    image: 'https://vibezcore-audio.b-cdn.net/images/pics%20app/pic%20recovery%20set%20your%20state%20app%202.png',
  },
  {
    key: 'stress',
    Icon: Waves,
    name: 'Less stress',
    hint: 'Come back to steady when it builds',
    /* Herzien op bewijs (8 augustus 2026). CLARITY eerst: dat zijn de
       ritmes met een langere uitademing dan inademing (4-2-6 en 4-8), en
       daar wijst het onderzoek naar spanning het duidelijkst heen. Daarna
       FOCUS, want dat draagt Coherent Breathing — de techniek met de
       meeste literatuur rond spanning en HRV. Box breathing (CALM) staat
       lager: dat is van oorsprong een techniek om scherp te blijven ONDER
       druk, niet om druk af te bouwen. REST sluit de rij; dat is afbouwen
       naar slaap, en dat is iets anders dan kalmeren overdag. */
    states: GOAL_STATES.stress,
    accent: BREATH_STATES.calm.accent,
    gradient: ['#2E6FB3', '#4FD1C5'],
    /* Operator, 21 september 2026: vervangen door hetzelfde soort
       transparant lijnicoon als de overige doelen. */
    image: 'https://vibezcore-audio.b-cdn.net/images/pics%20app/pic%20less%20stress%20set%20your%20state%20app.png',
  },
  {
    key: 'energy',
    Icon: Zap,
    name: 'More energy',
    hint: 'Start moving when you feel flat',
    states: GOAL_STATES.energy,
    accent: BREATH_STATES.boost.accent,
    gradient: ['#FFB020', '#FF6B35'],
    /* Operator, 21 september 2026: vervangen door hetzelfde soort
       transparant lijnicoon als 'sleep' (zie GoalTile in goal.tsx). */
    image: 'https://vibezcore-audio.b-cdn.net/images/pics%20app/pic%20energy%20set%20your%20state.png',
  },
  {
    key: 'focus',
    Icon: Crosshair,
    name: 'Sharper focus',
    hint: 'Hold your attention on one thing',
    /* FOCUS (Coherent Breathing) eerst, dan CALM: box breathing is de
       klassieke techniek om scherp te blijven onder druk. CLARITY sluit
       aan — een lange uitademing haalt de ruis weg voor je begint. */
    states: GOAL_STATES.focus,
    accent: BREATH_STATES.focus.accent,
    gradient: ['#1D6FE0', '#22D3EE'],
    /* Operator, 21 september 2026: vervangen door hetzelfde soort
       transparant lijnicoon als 'sleep'/'energy' (zie GoalTile in
       goal.tsx). */
    image: 'https://vibezcore-audio.b-cdn.net/images/pics%20app/pic%20sharper%20focus%20%20set%20your%20state%20app%202.png',
  },
  {
    key: 'emotionalBalance',
    Icon: Scale,
    name: 'Emotional balance',
    hint: 'Even yourself out, not up or down',
    states: GOAL_STATES.emotionalBalance,
    /* Eigen tint i.p.v. BREATH_STATES.calm.accent (operator, 13 augustus
       2026: "kleuren zijn niet allemaal anders" — met de toenmalige 8
       doelen over 5 toestand-kleuren vielen stress/emotionalBalance/
       calmMind allemaal op hetzelfde violet; calmMind is sindsdien
       geschrapt, 22 september 2026). Indigo-blauw: familie van violet
       (leunt op CALM), maar op het scherm meteen te onderscheiden van
       'Less stress'. */
    accent: '#7C93FF',
    gradient: ['#6C7FFF', '#B37CFF'],
    image: 'https://vibezcore-audio.b-cdn.net/images/pics%20app/pic%20emotional%20balance%20set%20your%20state%20app.png',
  },
  {
    key: 'recovery',
    Icon: BatteryCharging,
    /* Operator, 21 september 2026: "Recovery & relaxation" → "Recover &
       relax" (korter, past ook beter in de kaart). */
    name: 'Recover & relax',
    hint: 'Let the body catch up',
    states: GOAL_STATES.recovery,
    /* Teal-groen i.p.v. BREATH_STATES.rest.accent — anders identiek aan
       'Sleep better'. Blijft in de groene familie (leunt op REST). */
    accent: '#6FCF97',
    gradient: ['#57D9A3', '#22B8CF'],
    image: 'https://vibezcore-audio.b-cdn.net/images/pics%20app/pic%20recovery%20set%20your%20state%20app%203.png',
  },
];

export const goalByKey = (k: string | null): Goal | null =>
  k ? (GOALS.find((g) => g.key === k) ?? null) : null;

export const goalsByKeys = (keys: string[]): Goal[] =>
  keys.map((k) => goalByKey(k)).filter((g): g is Goal => g !== null);
