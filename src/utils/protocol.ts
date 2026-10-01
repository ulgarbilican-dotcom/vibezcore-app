/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Protocol-generator

   Zet doel + intensiteit om in een concreet rooster (operator, 13 augustus
   2026, protocol-systeem). Dezelfde motor als /plan.tsx en reminders.ts
   (utils/day-plan.ts), zodat een gegenereerd protocol nooit iets anders
   kan tonen dan wat de rest van de app al voorstelt.

   ── Eén dag-TEMPLATE, herhaald over de hele horizon ───────────────────
   De vragenlijst op /plan-review laat je het protocol bekijken en per item
   accepteren/vervangen/verwijderen — dat gebeurt op ÉÉN representatieve dag
   (de template). Die exacte set items herhaalt daarna elke dag van de
   gekozen horizon, met dezelfde tijden. Bewust GEEN dag-tot-dag-variatie
   over de hele horizon: dat zou het "review"-scherm zinloos maken (wat je
   net goedkeurde geldt dan maar voor één dag van de veertien) en past bij
   hoe protocol-apps dit normaal doen — één routine, herhaald, tot je 'm
   zelf aanpast. */

import { BREATH_STATES, type BreathStateKey } from '@/data/breath-states';
import {
  ALL_SLOTS,
  bestSlotsForCount,
  pickForSlot,
  pickStatesForDay,
  reasonForPick,
} from '@/utils/day-plan';
import { getBreathHistory } from '@/utils/breath-history';
import { personalOrderForSlot } from '@/utils/behavior-patterns';
import { dayKey } from '@/utils/bracelet-history';
import { SLOTS } from '@/services/reminders';
import type { ExperienceLevel, Intensity } from '@/utils/settings';
import type { ActivePlan, PlanDay, PlannedItem, PlanHorizon, PlanSlot } from '@/utils/plan-store';

/* Operator, 11 september 2026: was een VASTE lijst per intensiteit
   ("Standard = altijd ochtend+avond", ongeacht doel) — nu enkel het
   AANTAL sessies; WELKE dagdelen dat worden bepaalt `bestSlotsForCount`
   per doel (bv. enkel "Sleep better" trekt vanzelf naar after-work +
   evening, nooit een verzonnen ochtendsessie met Boost/Focus die niets
   met slapen te maken heeft). */
/* Welke Routine-tier de aanbeveling draagt, per gekozen ervaringsniveau —
   bouwt sessie-aantal rechtstreeks oplopend op met ervaring (operator, 21
   september 2026: "advanced voorstel 4, intermediate 3, beginner 2 lijkt
   mij toch logisch?"): Beginner→Standard (2x), Intermediate→Advanced (3x),
   Advanced→Complete (4x). Essential (1x) krijgt hierdoor nooit de badge —
   blijft een eigen, bewuste keuze voor wie het nog rustiger wil, net
   zoals Complete dat eerder was. Was module-lokaal in intensity.tsx,
   hierheen verplaatst (22 september 2026) zodat breath-welcome.tsx se
   onboarding-preview dezelfde keten hergebruikt i.p.v. een eigen dubbele
   tabel — dit bestand (`utils/`) is de juiste plek, geen route-scherm. */
export const RECOMMENDED_INTENSITY: Record<ExperienceLevel, Intensity> = {
  beginner: 'standard',
  intermediate: 'advanced',
  advanced: 'complete',
};

export const INTENSITY_SESSION_COUNT: Record<Intensity, number> = {
  essential: 1,
  standard: 2,
  advanced: 3,
  /* 17 september 2026: enige tier die alle 4 dagdelen gebruikt — precies
     waarom de dagdeel-kiezer op intensity.tsx nu bestaat (bij minder dan
     4 sessies is een KEUZE zinvol; bij 4 vallen sowieso alle dagdelen
     samen, dus die stap toont zich daar niet als keuze maar als bevestiging). */
  complete: 4,
  /* Niet werkelijk gebruikt — Pad B ("Build it yourself") roept
     `bestSlotsForCount`/`INTENSITY_SESSION_COUNT` nooit aan, de gebruiker
     bepaalt het aantal zelf per dagdeel (zie `generateCustomTemplate`).
     Aanwezig zodat dit een geldig `Record<Intensity, number>` blijft. */
  custom: 1,
};

const HORIZON_DAYS: Record<PlanHorizon, number> = {
  today: 1,
  '1w': 7,
  '2w': 14,
  '1m': 30,
  '3m': 90,
  /* Rolt lazy verder — 30 dagen nu, agenda.tsx vult bij zodra het einde
     nadert. Zie plan-document §Fase A, punt 4. */
  ongoing: 30,
};

/* Geëxporteerd (11 september 2026): plan-review.tsx toonde tot nu toe
   `it.slot.toUpperCase()` rechtstreeks — voor 'afterWork' geeft dat
   "AFTERWORK" i.p.v. "AFTER WORK". Dezelfde label-bron als de meldingen
   (`SLOTS` in reminders.ts), niet een tweede eigen opmaakregel. */
export const slotLabel = (slot: PlanSlot): string =>
  SLOTS.find((s) => s.slot === slot)?.label ?? slot;

const slotDefaultReminderAt = (slot: PlanSlot): number =>
  (SLOTS.find((s) => s.slot === slot)?.hour ?? 8) * 60;

/** Vaste streefduur per intensiteit, niet "de langste/aanbevolen die
 *  toevallig bestaat" (operator, 13 augustus 2026: "de duurtijden zijn veel
 *  te lang, dit gaat niemand volhouden — zeker overdag tussen het werk").
 *  Bij 2-3 sessies/dag stapelen individuele "aanbevolen" duren (vaak 10-20
 *  min, bedoeld voor een LOSSE sessie) op tot een dagtotaal dat niemand
 *  volhoudt. Kort houden is hier het hele punt: een protocol dat je elke
 *  dag echt doet wint van een protocol dat op papier indrukwekkender is. */
const INTENSITY_TARGET_MINUTES: Record<Intensity, number> = {
  essential: 3,
  standard: 5,
  advanced: 10,
  /* Zelfde streefduur als Advanced, NIET hoger — de reden hierboven blijft
     onverkort gelden bij 4 sessies/dag: kort houden is het punt, niet meer
     sessies EN elk langer maken. */
  complete: 10,
  /* Zelfde streefduur, zelfde reden — Pad B is geen uitzondering op "kort
     houden is het punt", ook al bepaalt de gebruiker hier zelf het aantal. */
  custom: 10,
};

/** Operator, 21 september 2026 ("gebruiker moet ook wel het niveau
 *  invullen beginner... zodat wij op basis daarvan de ademtechniek en
 *  timing kunnen opstellen"): elke toestand heeft 3 technieken met een
 *  eigen `level` (Beginner/Intermediate/Advanced, `breath-states.ts`) —
 *  hiervoor koos de generator altijd blind `techniques[0]` (= altijd
 *  Beginner), ongeacht wie de gebruiker is. Nu een echte lookup op
 *  niveau, met Beginner als terugval als het gekozen niveau toevallig
 *  ontbreekt voor die toestand. */
const LEVEL_LABEL: Record<ExperienceLevel, string> = {
  beginner: 'Beginner',
  intermediate: 'Intermediate',
  advanced: 'Advanced',
};

function techniqueKeyForLevel(state: BreathStateKey, level: ExperienceLevel): string {
  const st = BREATH_STATES[state];
  const wanted = LEVEL_LABEL[level];
  return (st.techniques.find((t) => t.level === wanted) ?? st.techniques[0]).key;
}

/** De duur die het dichtst bij de streefwaarde ligt. Operator, 21 september
 *  2026 ("de minuten moeten ook correct wijzigen afhankelijk van level"):
 *  zocht voorheen altijd in `state.durations` (de generieke lijst) — maar
 *  elke techniek heeft VAAK haar EIGEN duren-lijst (bv. Clarity's Beginner-
 *  techniek biedt 5/10/15 min, de Advanced-techniek 1/3/5 min — zie
 *  breath-states.ts). Dezelfde streefwaarde zocht dus altijd in dezelfde
 *  generieke lijst, ongeacht welke techniek (en dus welk niveau) al
 *  gekozen was — de minuten veranderden daardoor nooit mee met het
 *  niveau. Nu zoekt dit in de duren-lijst van de GEKOZEN techniek zelf
 *  (terugval op de state-lijst als de techniek er geen eigen heeft).
 *  Nooit op index vertrouwen — durations kunnen per techniek in een
 *  andere volgorde staan of ontbreken, dus altijd op `minutes` vergelijken
 *  met een dichtst-bij-match. */
function durationForIntensity(
  state: BreathStateKey,
  intensity: Intensity,
  techniqueKey: string,
): number {
  const st = BREATH_STATES[state];
  const tech = st.techniques.find((t) => t.key === techniqueKey);
  const durations = tech?.durations ?? st.durations;
  const target = INTENSITY_TARGET_MINUTES[intensity];
  return durations.reduce((best, d) =>
    Math.abs(d.minutes - target) < Math.abs(best.minutes - target) ? d : best,
  ).minutes;
}

function itemFor(
  slot: PlanSlot,
  state: BreathStateKey,
  goals: string[],
  level: ExperienceLevel = 'beginner',
): PlannedItem {
  const st = BREATH_STATES[state];
  const techniqueKey = techniqueKeyForLevel(state, level);
  const tech = st.techniques.find((t) => t.key === techniqueKey);
  const durations = tech?.durations ?? st.durations;
  /* `minutes` hier is enkel een startwaarde — elke aanroeper
     (`replaceTemplateItem`) overschrijft 'm meteen met de duur van het
     item dat vervangen wordt, dus geen streefwaarde nodig: gewoon de
     eigen aanbevolen duur van de gekozen techniek. */
  const recommended = durations.find((d) => d.recommended) ?? durations[0];
  return {
    slot,
    state,
    techniqueKey,
    minutes: recommended.minutes,
    reason: reasonForPick(state, goals, slotLabel(slot)),
    reminderAt: slotDefaultReminderAt(slot),
  };
}

/** Bouw de dag-template: één item per slot uit `INTENSITY_SLOTS[intensity]`.
 *
 *  Operator, 11 september 2026: was slot-voor-slot met enkel "niet gelijk
 *  aan de vorige" als variatieregel — bij twee doelen die op rang 1 gelijk
 *  staan (bv. Sharper focus + Recovery) leverde dat "Focus - Rest - Focus"
 *  op: rust op een werkdagmiddag, gevolgd door felle focus om 9 uur
 *  's avonds. Nu via `pickStatesForDay` — kiest eerst de N best passende,
 *  van elkaar VERSCHILLENDE toestanden over de hele dag (dus bij zo'n
 *  gelijkspel komen beide toestanden aan bod, samen met wat er daarna
 *  komt, i.p.v. een van de twee te herhalen), en wijst ze daarna toe aan
 *  het moment waar ze het beste passen. Zie de toelichting bij die
 *  functie in `day-plan.ts` voor de volledige uitleg.
 *
 *  Operator, 10 september 2026 (Phase 2, Layer 1): per moment wordt eerst
 *  gekeken of er genoeg geschiedenis is om te weten wat deze gebruiker op
 *  dit moment ECHT meestal doet (`personalOrderForSlot`) — zo niet, dan
 *  verandert er niets aan het bestaande gedrag. Het doel (`goals`) blijft
 *  altijd de eerste beslisser; dit raakt enkel de stille tiebreak. */
export function generateTemplate(
  goals: string[],
  intensity: Intensity,
  /* Operator, 17 september 2026 ("Set your times" — de dagdeel-kiezer op
     Pad A): de gebruiker koos hier zelf al WANNEER, dus `bestSlotsForCount`
     hoeft niet meer te gokken. Enkel gebruikt als het aantal klopt met de
     intensiteit — komt het niet overeen (bv. stale voorkeur van een vorig,
     ander protocol), dan blijft de terugval-schatting gelden. */
  explicitSlots?: PlanSlot[],
  level: ExperienceLevel = 'beginner',
): PlannedItem[] {
  /* Operator, 11 september 2026: "user geeft 1 state in en 1x per dag,
     wanneer stel jij dan voor?" — dit stond hardcoded op vaste dagdelen
     per intensiteit, ongeacht het doel, dus "Sleep better" 1x/dag kreeg
     een sessie 's OCHTENDS. `bestSlotsForCount` kiest nu de dagdelen die
     het beste bij DIT doel passen, voor elk aantal sessies — enkel nog de
     terugval wanneer er geen expliciete keuze is. */
  const slots =
    explicitSlots && explicitSlots.length === INTENSITY_SESSION_COUNT[intensity]
      ? explicitSlots
      : (bestSlotsForCount(goals, INTENSITY_SESSION_COUNT[intensity]) as PlanSlot[]);
  const history = getBreathHistory();
  const picks = pickStatesForDay(slots, goals, (slot) => personalOrderForSlot(history, slot));
  return slots.map((slot) => {
    const state = picks[slot];
    const techniqueKey = techniqueKeyForLevel(state, level);
    return {
      slot,
      state,
      techniqueKey,
      minutes: durationForIntensity(state, intensity, techniqueKey),
      reason: reasonForPick(state, goals, slotLabel(slot)),
      reminderAt: slotDefaultReminderAt(slot),
    };
  });
}

/** Bouw de dag-template voor Pad B ("Build it yourself", build-your-day.tsx)
 *  — operator, 17 september 2026: de gebruiker bepaalt hier zelf HOEVEEL
 *  sessies per dagdeel, ook meerdere in hetzelfde dagdeel (bv. 3x Midday).
 *  `generateTemplate`/`bestSlotsForCount`/`pickStatesForDay` gaan uit van
 *  hoogstens 1 item per dagdeel (4 unieke sloten) en passen hier dus niet.
 *
 *  De STAAT per sessie blijft wél het algoritme — enkel WANNEER/HOEVEEL is
 *  vrij. Gebruikt `pickForSlot` (dezelfde motor als de live suggestie op
 *  plan.tsx/breath-quiz.tsx) sequentieel over de hele dag: kiest per item
 *  de best passende toestand voor dat dagdeel, vermijdt enkel herhaling
 *  van de vorige (dezelfde regel als overal elders) — dat werkt vanzelf
 *  ook binnen één dagdeel met meerdere sessies (de tweede Midday-sessie
 *  herhaalt niet zomaar de eerste, tenzij niets anders bij dat dagdeel
 *  past). */
export function generateCustomTemplate(
  goals: string[],
  /** Aantal sessies per dagdeel, 0 = geen. */
  slotCounts: Partial<Record<PlanSlot, number>>,
  level: ExperienceLevel = 'beginner',
): PlannedItem[] {
  const flatSlots: PlanSlot[] = [];
  for (const slot of ALL_SLOTS as readonly PlanSlot[]) {
    const n = Math.max(0, slotCounts[slot] ?? 0);
    for (let i = 0; i < n; i += 1) flatSlots.push(slot);
  }
  const history = getBreathHistory();
  let prev: BreathStateKey | null = null;
  return flatSlots.map((slot) => {
    const personalOrder = personalOrderForSlot(history, slot);
    const state = pickForSlot(slot, goals, prev, personalOrder);
    prev = state;
    const techniqueKey = techniqueKeyForLevel(state, level);
    return {
      slot,
      state,
      techniqueKey,
      minutes: durationForIntensity(state, 'custom', techniqueKey),
      reason: reasonForPick(state, goals, slotLabel(slot)),
      reminderAt: slotDefaultReminderAt(slot),
    };
  });
}

/** Herhaal een goedgekeurde template over de hele horizon. */
export function buildPlanFromTemplate(
  goals: string[],
  intensity: Intensity,
  horizon: PlanHorizon,
  startDate: Date,
  template: PlannedItem[],
): ActivePlan {
  const dayCount = HORIZON_DAYS[horizon];
  const days: Record<string, PlanDay> = {};
  for (let i = 0; i < dayCount; i += 1) {
    const d = new Date(startDate);
    d.setDate(d.getDate() + i);
    const dk = dayKey(d);
    days[dk] = { dayKey: dk, items: template.map((it) => ({ ...it })) };
  }
  return {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8),
    createdAt: Date.now(),
    goals,
    intensity,
    horizon,
    startDayKey: dayKey(startDate),
    days,
  };
}

/** Kortsluiting voor wie de review-stap overslaat: template + volledig
 *  plan in één keer. */
export function generateProtocol(
  goals: string[],
  intensity: Intensity,
  horizon: PlanHorizon,
  startDate: Date,
): ActivePlan {
  return buildPlanFromTemplate(goals, intensity, horizon, startDate, generateTemplate(goals, intensity));
}

/** Zet één item in de template op een door de gebruiker zelf gekozen
 *  toestand (plan-review.tsx se state-kiezer, operator 21 september 2026:
 *  "als gebruiker niet akkoord is met een bepaalde state, kan die dan uit
 *  alle andere kiezen — zelf vervangen"). Was `replaceTemplateItem`: die
 *  cycelde blind naar het volgende AI-alternatief binnen `DAY_CANDIDATES`,
 *  zonder dat de gebruiker ooit zag welke opties er waren. Geen
 *  `DAY_CANDIDATES`-filter hier — de suggestie-engine bewaakt wél de
 *  fysiologische regels, maar de gebruiker heeft altijd het laatste
 *  woord (zelfde principe als "Set your times": nooit hard blokkeren). */
export function setTemplateItemState(
  items: PlannedItem[],
  index: number,
  state: BreathStateKey,
  goals: string[],
  level: ExperienceLevel = 'beginner',
): PlannedItem[] {
  const target = items[index];
  if (!target) return items;
  const updated = itemFor(target.slot, state, goals, level);
  const out = [...items];
  out[index] = { ...updated, minutes: target.minutes };
  return out;
}

/** Verwijder een item uit de template (plan-review.tsx se "remove"). */
export function removeTemplateItem(items: PlannedItem[], index: number): PlannedItem[] {
  return items.filter((_, i) => i !== index);
}
