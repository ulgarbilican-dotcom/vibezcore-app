/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Het dagplan: welke toestand op welk moment

   ÉÉN motor voor twee schermen (operator, 8 augustus 2026). De vragenlijst
   beloofde CLARITY · FOCUS · REST en Daily plan toonde FOCUS · FOCUS ·
   CLARITY — twee plekken die hetzelfde plan met een eigen sommetje
   uitrekenden. Een plan dat zichzelf tegenspreekt is geen plan; vanaf nu
   rekent alles hier.

   GEWIJZIGD (operator, 7 september 2026): "wij moeten rekening houden met
   wat de breathwork DOET en hoe wij dat communiceren, uur maakt niet uit —
   als iemand midden in de nacht energie wil, moet hij enkel breathwork
   kunnen doen die daartoe bijdraagt." Vervangt de oude grondwet ("de klok
   is leidend, REST hoort alleen 's avonds, BOOST nooit daar") — dat
   negeerde net het EXPLICIET gekozen doel van de gebruiker om een aanname
   over het tijdstip voorrang te geven. Nieuwe grondwet:
   · Het doel is leidend, altijd — DAY_CANDIDATES bevat nu alle 5
     toestanden voor elk moment; goalRank bepaalt de winnaar.
   · De volgorde per moment blijft wél de tiebreak wanneer het doel niets
     onderscheidt (bv. geen doel gekozen) — 's ochtends ligt BOOST dan nog
     voor, 's avonds REST — zuiver als stille standaardsmaak, nooit als
     harde uitsluiting.
   · Variatie: twee momenten na elkaar dezelfde toestand is een armere dag
     dan twee verwante.
   · Alles is na te vertellen — reasonFor geeft per keuze het doel dat hem
     daar zette.
   ───────────────────────────────────────────────────────────────────────── */

import { type BreathStateKey } from '@/data/breath-states';
/* Operator, 21 september 2026 ("dit is te gevoelig om aan het toeval over
   te laten"): RN-vrije bron i.p.v. `@/data/goals` (die `lucide-react-
   native` importeert voor de `Icon`-velden) — zo blijft dit hele bestand,
   het hart van de protocol-generator, rechtstreeks uitvoerbaar/testbaar
   met `tsx`, buiten de app om. Zie goal-states.ts voor de toelichting. */
import {
  GOAL_DAY_JOURNEY,
  GOAL_KEYS,
  GOAL_NAMES,
  GOAL_SLOT_PRIORITY,
  GOAL_STATES,
  type GoalKey,
  goalRank,
} from '@/data/goal-states';

/* Operator, 11 september 2026: "s ochtends rest? boost s avonds? dit is
   gewoon te belachelijk voor woorden" — terecht. Elke toestand op elk
   moment ZETTEN, ook maar als laagste-rang laatste-redmiddel, is zelf al
   de fout: Rest ("Restore deeply. Support recovery, relaxation and
   restful sleep" — zie breath-states.ts) heeft NERGENS iets te zoeken
   vóór het slapen gaan, ook niet als vijfde keuze. Boost ("Activate
   energy... physical drive") heeft NERGENS iets te zoeken 's avonds.
   Dat zijn harde uitsluitingen, geen smaakvoorkeur.

   VIER dagdelen, niet drie (operator, 11 september 2026, vervolg: "na het
   werk onderweg naar huis... moment van reflectie" — "avond" dekte tot nu
   toe zowel "net klaar met werk" als "vlak voor het slapen", en dat zijn
   twee andere triggers met een andere passende toestand. `afterWork` is
   het nieuwe, expliciet benoemde vierde moment (operator: "noem dat after
   work on the way home ofzo... als iemand dat moment aanduidt is het heel
   duidelijk").

   Per moment staan hieronder ENKEL de toestanden die er fysiologisch iets
   te zoeken hebben, gerangschikt op basis van hun eigen omschrijving in
   breath-states.ts:
   · Ochtend — activatie hoort hier (Boost, Focus); Rest NOOIT.
   · Middag — concentratie/stressbeheersing tijdens de werkdag (Focus,
     Calm); Rest NOOIT (een werkdagmiddag is geen slaapmoment).
   · After work — de dag verwerken op de terugweg (Clarity: "clear the
     mind, organize thoughts"), of loskomen van stress (Calm). Geen Rest
     (nog niet bedtijd), geen Boost, en geen Focus (je wil net AFBOUWEN
     van de werkmodus, niet opnieuw concentratie opbouwen — operator, 21
     september 2026, "afterwork Sharp Focus is fout": stond er tot dan
     wél nog in, in tegenspraak met precies deze eigen regel hierboven —
     zag je bv. bij "Sharper focus + Recover & relax", 3-4 sessies: Focus
     verscheen zowel 's ochtends als after-work).
   · Avond (vlak voor slapen) — Rest is hier de enige natuurlijke
     eerste keuze ("restful sleep"), Calm als zachte tweede. Geen
     Clarity/Focus (het "verwerken" gebeurde al bij after-work, dit
     moment is voor LOSLATEN, niet nadenken) en geen Boost.

   Ontbreekt een toestand hier voor een moment, dan wordt hij enkel nog
   gekozen als het doel LETTERLIJK geen ander alternatief overlaat (zie
   `pickStatesForDay`/`bestSlotForState`) — een zwakke noodgreep, nooit
   een aanbevolen combinatie. */
export const DAY_CANDIDATES: Record<string, BreathStateKey[]> = {
  morning: ['boost', 'focus', 'calm', 'clarity'],
  midday: ['focus', 'calm', 'clarity', 'boost'],
  afterWork: ['clarity', 'calm'],
  evening: ['rest', 'calm'],
};

/** Alle vier dagdelen, in dag-volgorde — gedeeld tussen de tiebreak-tabel
 *  hierboven en `bestSlotsForCount` hieronder. */
export const ALL_SLOTS = ['morning', 'midday', 'afterWork', 'evening'] as const;

/** Uurvenster per dagdeel — gedeeld bron (operator, 17 september 2026: was
 *  driemaal apart herhaald in build-your-day.tsx, daypart-picker.tsx en
 *  plan.tsx se lokale `MOMENTS`, met het risico dat ze ooit uit elkaar
 *  lopen). `to` mag boven 24 gaan (evening loopt door tot 3:45u de
 *  volgende ochtend) — JS' eigen Date-rekenkunde rolt dat correct om. */
export const SLOT_WINDOW: Record<string, { from: number; to: number }> = {
  morning: { from: 4, to: 12 },
  midday: { from: 12, to: 17 },
  afterWork: { from: 17, to: 20 },
  evening: { from: 20, to: 28 },
};

/* Operator, 17 september 2026 (fix, `breath-suggestion.ts` had een eigen
   afwijkende urenindeling die hiermee tegensprak): vóór 6u is nog geen
   "ochtend" — wie om 3u wakker ligt heeft niets aan een BOOST-suggestie.
   Valt terug in dezelfde bucket als "vlak voor slapen", zelfde toestanden
   (rest/calm) passen daar evengoed. */
export const slotForHour = (h: number): string =>
  h < 6 ? 'evening' : h < 12 ? 'morning' : h < 17 ? 'midday' : h < 20 ? 'afterWork' : 'evening';

/** De toestand voor dit moment, gegeven de doelen en wat het vorige moment
 *  al kreeg.
 *
 *  Operator, 10 september 2026 (Phase 2, Layer 1 — behavior-pattern
 *  mining): `personalOrder` is optioneel en verandert de GRONDWET niet —
 *  het doel blijft altijd leidend (`goalRank` sorteert hierna nog steeds
 *  alles opnieuw). Het vervangt enkel de STILLE TIEBREAK: in plaats van
 *  altijd dezelfde generieke tijdstip-volgorde (`DAY_CANDIDATES`) gebruiken
 *  we, zodra er genoeg geschiedenis is (`personalOrderForSlot`,
 *  `utils/behavior-patterns.ts`), wat deze gebruiker op dit moment ECHT
 *  meestal doet. Geen geschiedenis? `personalOrder` is dan `null` en dit
 *  gedraagt zich exact zoals voorheen. */
export function pickForSlot(
  slot: string,
  goals: string[],
  prev: BreathStateKey | null,
  personalOrder?: BreathStateKey[] | null,
): BreathStateKey {
  /* Operator, 21 september 2026 ("smorgens rest reset? dat klopt niet"):
     `personalOrderForSlot` (behavior-patterns.ts) retourneert ALTIJD alle
     5 states (gesorteerd op hoe vaak deze gebruiker ze op dit moment
     praktiseerde) — niet enkel de fysiologisch geldige. Blindelings op
     die lijst vertrouwen liet iemands testgeschiedenis (bv. een paar
     Rest-sessies 's ochtends) de harde `DAY_CANDIDATES`-uitsluiting
     compleet overschrijven. Nu altijd eerst doorgezeefd tegen de eigen
     kandidatenlijst van dit dagdeel — `personalOrder` bepaalt enkel nog
     de VOLGORDE binnen wat al geldig is, nooit WAT geldig is. */
  const candidates = DAY_CANDIDATES[slot] ?? DAY_CANDIDATES.evening;
  const base = personalOrder
    ? personalOrder.filter((st) => candidates.includes(st))
    : candidates;
  const ranked = [...(base.length ? base : candidates)].sort(
    (a, b) => goalRank(goals, a) - goalRank(goals, b),
  );
  let pick = ranked[0];
  /* Variatie is een REGEL, geen gunst (operator, 8 augustus 2026: twee keer
     dezelfde toestand na elkaar "klopt absoluut niet"). Elk kandidaat op de
     lijst past sowieso bij dit moment, dus de tweede keuze is nooit fout —
     twee keer dezelfde wel. */
  if (pick === prev && ranked[1]) {
    pick = ranked[1];
  }
  return pick;
}

const ALL_STATES: BreathStateKey[] = ['boost', 'focus', 'clarity', 'calm', 'rest'];

/** Welke N van de vier dagdelen het beste bij dit doel passen — gebruikt
 *  door de protocol-generator i.p.v. een vaste lijst per intensiteit
 *  ("Standard = altijd ochtend+avond", ongeacht doel). Voorbeeld: iemand
 *  met enkel "Sleep better" en 2 sessies/dag heeft niets aan een
 *  ochtendsessie (Rest hoort daar niet, per de uitsluiting hierboven) —
 *  die krijgt nu correct after-work + evening i.p.v. een verzonnen
 *  ochtend-Boost/Focus die niets met slapen te maken heeft.
 *
 *  Score per dagdeel = de beste (laagste) `goalRank` die het bereikt via
 *  zijn eigen kandidatenlijst — dus een dagdeel waar geen van de
 *  doel-relevante toestanden past, scoort automatisch slecht en valt af.
 *
 *  Operator, 21 september 2026 (gevonden tijdens het verifiëren van de
 *  `pickStatesForDay`-fix, niet gemeld maar zelf opgemerkt): bij een
 *  gelijkspel won voorheen simpelweg het dagdeel dat het eerst in
 *  `ALL_SLOTS` staat (vaste volgorde morning→midday→afterWork→evening) —
 *  voor "Sleep better" (enkel Rest/Clarity/Calm relevant) scoren morning/
 *  midday/afterWork alle drie exact gelijk (rang 2, via Clarity, want
 *  Rest hoort in geen van de drie thuis), en die vaste volgorde koos dan
 *  altijd "morning" — in tegenspraak met de toelichting hierboven
 *  ("after-work + evening"). Nu wint bij een gelijkspel het dagdeel dat
 *  het DICHTST in dag-volgorde bij het sterkste dagdeel ligt (rang 1,
 *  hier "evening") — dat geeft "after-work" (1 stap van evening) i.p.v.
 *  "morning" (3 stappen weg), en leest ook logischer: opbouwen naar het
 *  moment waar het doel het sterkst past, niet er zo ver mogelijk
 *  vandaan beginnen. Het resultaat komt terug in dag-volgorde, niet in
 *  score-volgorde. */
/* Operator, 22 september 2026 ("recovery na het werk en savonds, niet
   ochtend/middag"): sommige doelen (Recovery) hebben een top-state die in
   ALLE 4 `DAY_CANDIDATES`-lijsten even sterk scoort — een perfecte
   gelijkstand. De oude tiebreak (dichtst bij het dagdeel dat het EERST
   wint, in dagvolgorde) loste zo'n gelijkstand altijd op door de ochtend
   te kiezen — toeval van dagvolgorde, geen inhoudelijke voorkeur.
   `GOAL_SLOT_PRIORITY` (goal-states.ts) geeft zulke doelen een expliciete
   tiebreak-volgorde.

   Operator, 22 september 2026, bugfix ("nu staat in mijn planning boost
   toch op middag" — Energy + Recovery samen gaf midday+evening i.p.v.
   Energy's eigen morning-first gedrag): de override gold voorheen zodra
   ÉÉN van de gekozen doelen een entry had, ook als dat doel niet het
   hoofddoel was — Recovery als TWEEDE doel kaapte zo de hele dagdeel-
   keuze van een sterk morning-doel als Energy. Nu enkel actief bij
   PRECIES ÉÉN gekozen doel (zelfde beperking als `GOAL_DAY_JOURNEY`
   hierboven) — "ochtend is bepalend" is de standaard zodra een tweede
   doel meedoet, exact zoals elk ander doel zonder eigen entry zich al
   gedraagt. */
export function bestSlotsForCount(goals: string[], count: number): string[] {
  if (count >= ALL_SLOTS.length) return [...ALL_SLOTS];
  const scored = ALL_SLOTS.map((slot, i) => {
    const candidates = DAY_CANDIDATES[slot] ?? [];
    const rank = candidates.length
      ? Math.min(...candidates.map((c) => goalRank(goals, c)))
      : 99;
    return { slot, rank, i };
  });
  const priorityGoal =
    goals.length === 1 ? goals.find((g) => GOAL_SLOT_PRIORITY[g as GoalKey]) : undefined;
  if (priorityGoal) {
    const order = GOAL_SLOT_PRIORITY[priorityGoal as GoalKey]!;
    scored.sort(
      (a, b) => a.rank - b.rank || order.indexOf(a.slot) - order.indexOf(b.slot),
    );
  } else {
    const bestRank = Math.min(...scored.map((s) => s.rank));
    const anchorI = scored.find((s) => s.rank === bestRank)!.i;
    scored.sort(
      (a, b) => a.rank - b.rank || Math.abs(a.i - anchorI) - Math.abs(b.i - anchorI) || a.i - b.i,
    );
  }
  const picked = new Set(scored.slice(0, count).map((s) => s.slot));
  return ALL_SLOTS.filter((s) => picked.has(s));
}

/** Een heel dagrooster in één keer, i.p.v. slot per slot met enkel "niet
 *  gelijk aan de vorige" als variatieregel (operator, 11 september 2026:
 *  "smiddags rust en s avonds sharp focus voorstellen is absoluut
 *  verkeerd" + "het is niet omdat user sharper focus ingeeft dat het 2x
 *  ook sharp focus moet zijn").
 *
 *  Het echte probleem: bij twee doelen die allebei hun EIGEN topkeuze op
 *  rang 1 hebben (bv. Sharper focus → focus, Recovery → rest), pingpongt
 *  `pickForSlot` slot na slot eindeloos tussen enkel DIE TWEE toestanden
 *  ("niet gelijk aan de vorige" is zo simpel dat A-B-A al voldoet) — de
 *  tussenliggende, bij BEIDE doelen even geldige opties (bv. Calm,
 *  Clarity) komen dan nooit aan bod, en je krijgt "rust op een werkdag-
 *  middag, gevolgd door felle focus om 9 uur 's avonds".
 *
 *  Deze functie kiest daarom voor de VOLLEDIGE dag in één keer: eerst de
 *  N best passende, van elkaar VERSCHILLENDE toestanden (N = aantal
 *  sloten) over alle doelen heen — dus bij een gelijkspel op rang 1 komen
 *  BEIDE in de dag terecht, samen met de eerstvolgende rang(en), i.p.v.
 *  een van de twee te herhalen. Daarna wordt élke gekozen toestand
 *  toegewezen aan het moment waar hij van nature het beste past (zijn
 *  eigen positie in `DAY_CANDIDATES`/`personalOrder` voor dat moment) —
 *  dus focus blijft naar de ochtend trekken, rust naar de avond, zonder
 *  dat het doel ooit overruled wordt (de KEUZE van toestanden blijft
 *  100% `goalRank`; enkel de TOEWIJZING aan een moment gebruikt de
 *  tijdstip-volgorde, exact zoals de bestaande tiebreak-filosofie). */
/* Operator, 21 september 2026 ("iemand kiest energy en rust, smorgens
   clarity, smiddags rest, after work boost, savonds opnieuw boost —
   daar zit geen logica in"): bevestigd en exhaustief nagerekend (555
   combinaties van 0/1/2 doelen × elke dagdeel-combinatie) — de oude
   opzet ("kies eerst de N beste toestanden puur op doel-rang, plaats ze
   DAARNA pas") kon een toestand kiezen die in GEEN van de gekozen
   dagdelen thuishoort, en forceerde die dan als noodgreep ergens toch
   — 194 van de 555 scenario's (35%) schonden zo de eigen harde regels
   (Boost 's avonds, Rest 's ochtends, enz.).

   Nieuwe opzet: geen aparte "kies dan plaats"-stap meer. Eén doorloop,
   dagdeel per dagdeel, steeds te beginnen met het MEEST beperkte
   dagdeel (het minste nog-geldige opties over) — en daarbinnen enkel
   kiezen uit DIE dagdeel-zijn-eigen kandidatenlijst, nooit daarbuiten.
   Geverifieerd: 0 schendingen over alle 555 scenario's.

   Operator, 21 september 2026 ("smorgens rest reset? dat klopt niet" —
   reproduceerbaar in de app zelf): de 555-scenario-test hierboven testte
   deze functie ZONDER `personalOrderForSlot`, en miste zo een tweede
   lek — `personalOrderForSlot` (behavior-patterns.ts) retourneert ALTIJD
   alle 5 states, niet enkel de fysiologisch geldige voor dit dagdeel.
   Een paar Rest-sessies 's ochtends in iemands geschiedenis liet die
   functie 'rest' voor 'morning' teruggeven, en dat overschreef de harde
   `DAY_CANDIDATES`-regel volledig — exact de bug op het screenshot. Nu
   altijd eerst doorgezeefd tegen `DAY_CANDIDATES[slot]`: `personalOrder`
   bepaalt enkel nog de VOLGORDE/voorkeur binnen wat al geldig is, nooit
   WAT geldig is.

   Operator, 21 september 2026 (vervolg — "More energy + Peak performance,
   4 sessies: smorgens Boost (goed), smiddags Clarity — wat heeft dat met
   energy te maken?"): de "kies eerst N VERSCHILLENDE states, plaats ze
   dan" aanpak hierboven had zelf ook nog een denkfout — niet de
   fysiologische regel (die klopt), maar de VARIATIE-dwang. Energy + Peak
   performance hebben maar 2 echt sterke states (Boost/Focus, allebei
   rang 1) — Clarity staat wel op rang 3 bij beide doelen (dus technisch
   "relevant", geen 99), maar is duidelijk een zwakker, generiek
   derde-keuze-item. Toch werd het erbij gesleept, puur om aan "4
   verschillende toestanden" te voldoen voor 4 sloten.

   Nieuwe regel: GEEN geforceerde uniciteit meer over de hele dag.
   Herhaling van de best-passende toestand is normaal en correct als een
   doel simpelweg niet meer dan 1-2 sterke toestanden heeft — dat is geen
   "armere dag", dat is trouw blijven aan wat de gebruiker koos. Variatie
   blijft wel bestaan, maar ALLEEN tussen states die ECHT gelijkwaardig
   zijn (rang ≤ 2 — dus de expliciete 1e of 2e voorkeur van een gekozen
   doel), nooit door af te zakken naar een zwakker rang-3+-item. Simpele
   dag-volgorde-doorloop i.p.v. "meest beperkte dagdeel eerst" — dat was
   enkel nodig om de oude "moet uniek zijn"-eis sluitend te krijgen, en
   is nu overbodig: elk dagdeel kiest sowieso al enkel uit zijn EIGEN
   geldige kandidatenlijst (fysiologisch nog steeds waterdicht,
   onafhankelijk van de doorloopvolgorde). */
export function pickStatesForDay(
  slots: string[],
  goals: string[],
  personalOrderForSlot?: (slot: string) => BreathStateKey[] | null | undefined,
): Record<string, BreathStateKey> {
  const validBaseFor = (slot: string): BreathStateKey[] => {
    const candidates = DAY_CANDIDATES[slot] ?? DAY_CANDIDATES.evening;
    const personal = personalOrderForSlot?.(slot);
    if (!personal) return candidates;
    const filtered = personal.filter((st) => candidates.includes(st));
    return filtered.length ? filtered : candidates;
  };

  /* Operator, 22 september 2026 ("hoe ziet de dag eruit die tot goede
     slaap leidt"): een expliciet dagtraject (`GOAL_DAY_JOURNEY`) geldt
     enkel bij precies ÉÉN gekozen doel — bij 2 doelen zou een vast
     traject het TWEEDE doel volledig negeren, dus dan valt dit terug op
     de gewone `goalRank`-motor hieronder. */
  const journey =
    goals.length === 1 ? GOAL_DAY_JOURNEY[goals[0] as GoalKey] : undefined;

  /* Operator, 23 september 2026 ("Energy + Less stress, 4 sessies: smorgens
     boost, smiddags sharp focus, na werk clarity, savonds sleep — maar jij
     stelt 2x clarity voor, smiddag EN na werk"): bevestigde bug. Oorzaak:
     de oude doorloop koos per dagdeel in DAG-VOLGORDE en vergeleek enkel
     met de VORIGE sessie ("prev"). Midday koos daardoor greedy zijn eigen
     rang-1 (clarity) — geldig voor midday op zich — zonder te weten dat
     afterWork zijn ENIGE goede kandidaat óók clarity is (afterWork se
     andere optie, calm, is met dit doel te zwak: rang > 2). Midday had
     zelf nog een prima alternatief (focus, rang 2) — na werk had dat niet.
     Doordat "prev" enkel de ONMIDDELLIJK vorige sessie checkt (geen bredere
     blik), kon afterWork zijn eigen herhaling niet meer voorkomen: zijn
     enige alternatief (calm) valt buiten de rang-≤2-grens, dus de
     bestaande "wissel enkel naar een evenwaardige optie"-regel liet de
     herhaling toe — een op zich correcte regel, toegepast op het verkeerde
     dagdeel.

     Fix: niet meer strikt in dag-volgorde kiezen, maar het MEEST beperkte
     dagdeel eerst (het dagdeel met de minste rang-≤2-kandidaten) — dat
     dagdeel claimt zijn beste optie het eerst. Minder beperkte dagdelen
     (die vaak MEERDERE evenwaardige opties hebben) wijken dan vanzelf uit
     naar hun eigen volgende evenwaardige alternatief in plaats van het
     schaarse dagdeel zijn enige goede optie afhandig te maken. Exact
     dezelfde "nooit afzakken onder rang ≤ 2"-regel als voorheen, enkel de
     VOLGORDE waarin dagdelen hem toepassen veranderde — geverifieerd tegen
     de eerder gedocumenteerde scenario's (Sleep better-traject, Energy
     alleen, Recovery alleen) hierboven: identiek resultaat, plus dit
     nieuwe geval nu correct (boost/focus/clarity/rest, geen herhaling). */
  const rankedFor: Record<string, BreathStateKey[]> = {};
  for (const slot of slots) {
    rankedFor[slot] = [...validBaseFor(slot)].sort(
      (a, b) => goalRank(goals, a) - goalRank(goals, b),
    );
  }
  const flexOf = (slot: string) =>
    rankedFor[slot].filter((st) => goalRank(goals, st) <= 2).length;
  const order = [...slots].sort((a, b) => {
    const diff = flexOf(a) - flexOf(b);
    return diff !== 0 ? diff : slots.indexOf(a) - slots.indexOf(b);
  });

  const result: Record<string, BreathStateKey> = {};
  const claimed = new Set<BreathStateKey>();

  for (const slot of order) {
    const ranked = rankedFor[slot];
    /* Enkel gebruiken als de vaste stap ook echt een geldige kandidaat is
       voor dit dagdeel (DAY_CANDIDATES) — anders (bv. een nieuw dagdeel
       zonder traject-entry) gewoon terugvallen op de rang-gedreven keuze
       hieronder. */
    const journeyPick = journey?.[slot];
    let pick: BreathStateKey;
    if (journeyPick && ranked.includes(journeyPick)) {
      pick = journeyPick;
    } else {
      const bestRank = goalRank(goals, ranked[0]);
      /* Geen doel dat dit dagdeel iets zegt (rang 99, de "welk moment
         dan ook"-terugval) — mag altijd wisselen, geen kwaliteitsverlies
         mogelijk. Draagt een doel dit dagdeel wél (rang < 99), dan enkel
         wisselen naar een even sterke (rang ≤ 2) toestand — nooit naar
         een zwakker rang-3+-item enkel om een andere sessie te ontwijken. */
      const altCeiling = bestRank < 99 ? 2 : 99;
      const unclaimed = ranked.find(
        (st) => !claimed.has(st) && goalRank(goals, st) <= altCeiling,
      );
      pick = unclaimed ?? ranked[0] ?? ALL_STATES[0];
    }
    result[slot] = pick;
    claimed.add(pick);
  }
  return result;
}

/** Waarom deze toestand hier staat: het gekozen doel dat hem het HOOGST
 *  zette, of anders het moment zelf.
 *
 *  Operator, 22 september 2026 ("Recover & relax vs Rest & Reset/Sleep —
 *  hoe verhelpen we dat misverstand?"): sinds de "avond mag naar Sleep"-
 *  uitbreiding (zie GOAL_STATES hierboven) kan zowat elk doel — niet enkel
 *  Sleep better zelf — 's avonds een Sleep-sessie opleveren (Stress,
 *  Energy, Focus, Recovery reiken allemaal tot `rest`). Zonder context zou
 *  bv. "Recover & relax" naast een Sleep-sessie verwarrend lijken (twee
 *  losse, gelijkklinkende namen). Enkel wanneer het gekozen doel NIET zelf
 *  Sleep better is, krijgt de reden een korte toevoeging — Sleep better's
 *  eigen "waarom" (gewoon "Sleep better") heeft die uitleg niet nodig, dat
 *  IS al de kern van het doel. */
export function reasonForPick(
  state: BreathStateKey,
  goals: string[],
  slotLabel: string,
): string {
  let best: { name: string; key: GoalKey; idx: number } | null = null;
  for (const key of GOAL_KEYS) {
    if (!goals.includes(key)) continue;
    const idx = GOAL_STATES[key].indexOf(state);
    if (idx === -1) continue;
    if (!best || idx < best.idx) best = { name: GOAL_NAMES[key], key, idx };
  }
  if (!best) return `Fits the ${slotLabel.toLowerCase()}`;
  if (state === 'rest' && best.key !== 'sleep') return `${best.name} · Evening winddown`;
  return best.name;
}
