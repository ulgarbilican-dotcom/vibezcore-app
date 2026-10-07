/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — "How do you feel?" instant situation matrix

   Operator, 2 oktober 2026: vervangt de eerdere "How do you want to feel?"
   swipe-door in feel-now.tsx. Vraagt de HUIDIGE toestand ("I feel tired"),
   niet de doel-toestand — de app bepaalt zelf de bestemming, geen
   keuzescherm nodig. Entry-knop zit op de intro-overlay van de Breath-tab,
   het eerste wat een gebruiker ziet bij het openen van die tab.

   Staat-koppeling geverifieerd tegen elke staat se eigen `need`-omschrijving
   in breath-states.ts (niet zomaar overgenomen uit het aangeleverde
   voorstel, en twee rondes gecorrigeerd — eerst tegen het oorspronkelijke
   voorstel, daarna nogmaals tussen Calm Control en Clarity & Relax
   onderling, die qua omschrijving dicht bijeen liggen):
   - "Frustrated/Angry" → Calm Control ("Reduce stress. Restore balance.
     Regain composure." / "From high activation to a settled state.") —
     fysiologische opwinding die moet zakken, niet Sharp Focus of
     Clarity & Relax.
   - "Can't stop thinking" → Clarity & Relax ("Clear the mind... Organize
     thoughts..." / "Space before what comes next.") — een denk-probleem,
     geen opwindingsprobleem; Clarity & Relax se eigen omschrijving is
     vrijwel woordelijk een match, Calm Control's "regain composure" niet.
     (Stond hier eerst ook bij Calm Control — bij herbeoordeling, operator
     2 okt 2026: "calm control en clarity liggen dicht bijeen", bleek dit
     de ene echte misser.)
   - De overige Calm Control-mappings (overwhelmed, anxious/nervous,
     restless/jittery) bleven bij diezelfde herbeoordeling wél correct —
     stuk voor stuk acute-opwinding-problemen, geen denk- of
     overgangsproblemen.

   Techniek-keuze: GEEN per-situatie techniek verzinnen (dat ging de vorige
   keer fout — "Bellows"/"Slow Pace"/"Grounding" bestaan nergens in
   breath-states.ts). In plaats daarvan: de standaard-techniek-selectie van
   de staat zelf, via `pickInstantTechnique()` hieronder — zelfde bron als
   de rest van de app (`techniques[]`, Beginner→Intermediate→Advanced).

   "Niet-beginner" (operator, 2 oktober 2026: "iemand die via deze weg komt
   wil een echt werkende snelle oplossing"): wie via deze knop komt en nog
   geen `experienceLevel` heeft gekozen (null) krijgt hier INTERMEDIATE als
   startpunt, niet Beginner — in tegenstelling tot protocol.ts, dat bij
   null wél terugvalt op Beginner (dat is een bewust andere context: een
   geduldig opgebouwd protocol vs. een spontane "los dit nu op"-vraag).
   Dit wijzigt de opgeslagen instelling zelf niet — enkel de interpretatie
   hier, bij het bepalen van het startpunt.

   App-brede bijstelling (operator, 2 oktober 2026, bevestigd "ja heel
   goed"): de "Worked/Too hard/Too long/Too short"-feedback na een instant-
   sessie (zie breath-session.tsx) past de ECHTE, gedeelde `experienceLevel`-
   instelling aan (dezelfde die protocol.ts/intensity.tsx/plan-review.tsx al
   lezen) plus de nieuwe `instantDurationBias`-instelling — dus ook de
   normale Breath-tab/breath-setup.tsx-flow beweegt mee. Bewust gekozen
   bovenop een nieuw per-staat-systeem: minder risico, hergebruikt wat er
   al bestaat (zie de afweging die hierover met de operator liep). */

import {
  BREATH_STATES,
  type BreathState,
  type BreathStateKey,
  type TechniqueDef,
  type DurationDef,
} from '@/data/breath-states';
import { getSetting, setSetting, type ExperienceLevel } from './settings';

export type InstantSituation = {
  id: string;
  label: string;
  state: BreathStateKey;
  /** Core-basics krijgen een prominente plek bovenaan de grid; de rest
     verschijnt als kleinere, omwikkelende chips eronder (operator-indeling,
     zie het aangeleverde voorstel — de UI-opdeling zelf was wel correct,
     enkel de staat-/techniekinvulling niet). */
  isCoreBasis: boolean;
  /** Operator, 2 okt 2026 ("afhankelijk van de ernst de minuten aanpassen"):
     hoe grondig de aanpak moet zijn, los van welke staat. -1 = korter dan
     de aanbevolen duur (acute uitbarsting, iemand wil snel weer verder, of
     lang stilzitten is net moeilijk — bv. frustrated_angry, restless_jittery).
     0 = de aanbevolen duur van de staat (de meeste situaties). +1 = langer
     (hardnekkigere/zwaardere staten waar een korte sessie weinig oplost —
     bv. overwhelmed, cant_stop_thinking). Toegepast in
     `pickInstantDuration()`, bovenop (niet i.p.v.) de globale
     `instantDurationBias`-feedback-bijstelling. */
  severity: -1 | 0 | 1;
  /** Operator, 2 okt 2026 ("tired but wired maar 3 minuten, identiek
     dezelfde techniek als cant sleep — moeten verschillende technieken en
     timing zijn"): de ECHTE oorzaak was dat techniek enkel uit (staat +
     experienceLevel) kwam, nooit uit de situatie zelf — dus elke situatie
     onder dezelfde staat kreeg exact dezelfde techniek én dus dezelfde
     duur. Elke situatie krijgt nu een bewust gekozen technique-key van de
     eigen staat (zie `pickInstantTechnique` voor de redenering per
     situatie) — geen experienceLevel-afgeleide meer voor dit pad. */
  technique: string;
  /** Operator, 2 okt 2026 ("uw uitleg over military klopt misschien met de
     staat, maar is niet relevant voor I feel stressed... blijf fouten
     ontdekken"): de info-sheet in feel-now.tsx gebruikte eerst
     `technique.explain` uit breath-states.ts — geschreven voor de NEUTRALE
     technieken-kiezer (bv. box breathing se militaire herkomst/"stay sharp
     under pressure"), niet voor een mood-specifieke uitleg. Dezelfde
     technieknaam betekent iets anders per situatie: box breathing helpt
     "I feel stressed" ANDERS dan "Anxious/nervous". Dit veld is daarom
     PER SITUATIE geschreven, geen generieke techniek-copy — maar wel
     gegrond in hetzelfde, al met bronnen geverifieerde onderzoek uit deze
     sessie (zie de web-search-samenvatting), geen nieuwe claims. */
  why: string;
};

export const INSTANT_SITUATIONS: InstantSituation[] = [
  // ── Core basics ──────────────────────────────────────────────────────
  /* Box Breathing: brede, bekende, bewezen stress-techniek (Navy SEALs-
     associatie) — geschikt als "default" voor algemene stress, niet te
     specifiek.
     Operator, 2 okt 2026 ("5 min voldoende?" → onderzoek: 2-4 min voor
     acute verlichting → operator, vervolg: "hier vraagt gebruiker
     EXPLICIET om deze sessie omdat het nodig is, effect moet gegarandeerd
     zijn, en dit is niet dagelijks — dan mag het langer"): terechte
     correctie. De 2-4 min-bevinding ging over een vluchtige stressklap
     tussendoor; een bewuste tap op "I feel stressed" is een ander geval —
     een gerichte vraag om een sessie die écht werkt, niet een haastige
     topping-up. severity+1 kiest daarom "Deep Release" (10 min, "for real
     time to let it work. Past the halfway mark, the counting tends to
     fade into the background") — de eigen top-tier van Box. */
  {
    id: 'feel_stressed', label: 'I feel stressed', state: 'calm', isCoreBasis: true, severity: 1, technique: 'box',
    why: 'Two steady pauses give a stressed mind something solid to hold on to — a simple structure that helps you feel more composed, not just distracted.',
  },
  /* Faster Equal Breathing: de meest intense/snelst-werkende Boost-
     techniek (Advanced) — "niet-beginner", iemand wil hier een reëel,
     snel effect, geen voorzichtige opbouw. "Quick Charge" (2 min). */
  {
    id: 'feel_tired', label: 'I feel tired / low energy', state: 'boost', isCoreBasis: true, severity: 0, technique: 'faster-equal',
    why: 'A quicker, even rhythm is energizing by design — a fast way to feel more awake and switched on, without reaching for caffeine.',
  },
  /* Operator, 2 okt 2026 ("1 min is dat voldoende?" → "in bed hebben
     mensen meer tijd" → "20 min klopt ook niet"): was '478' (4-7-8). De
     Starter-tier is met opzet maar 1 minuut/4 cycli ("build up over a
     month, not sooner" — de hold-fase kan licht-in-het-hoofd geven bij te
     snel opbouwen voor iemand zonder bekende oefengeschiedenis), dus '478'
     hoger zetten zou de eigen veiligheidsregel breken — '478' is hier
     gewoon de verkeerde techniek.
     '1:2 Breathing' (`slow`, safetyTier 'green', geen holds) lost dat op.
     severity 0 kiest via `recommendedIdx` de EIGEN curated tier van deze
     techniek: "Deep Wind-Down" (10 min, "the evening standard... so
     unhurried you will stop counting somewhere along the way") — lang
     genoeg om echt te werken voor iemand die wakker ligt, zonder een
     instant-tap meteen naar de langste (20 min) tier te duwen; wie meer
     tijd wil kan dat op het setup-scherm zelf aanpassen. `ready_unwind`
     hieronder (mildere, minder acute variant) krijgt severity-1, zodat
     beide een verschillende duur geven. */
  {
    id: 'cant_sleep', label: "I can't sleep", state: 'rest', isCoreBasis: true, severity: 0, technique: 'slow',
    why: 'An exhale twice as long as the inhale is the classic wind-down rhythm — slow, simple and free of breath-holds, so you can ease toward rest.',
  },
  /* Coherent Breathing: de staat se eigen "Mind Declutter"-duurnaam is
     vrijwel letterlijk "I can't focus" se probleem. */
  {
    id: 'cant_focus', label: "I can't focus", state: 'focus', isCoreBasis: true, severity: 0, technique: 'coherent',
    why: 'A steady, even pace — about six breaths a minute — helps you settle into calm, clear attention instead of jittery alertness.',
  },

  // ── Mind & emotion (nuance) ──────────────────────────────────────────
  /* Gecorrigeerd van 'focus' → 'calm' (operator, 2 okt 2026), daarna
     opnieuw gecorrigeerd naar 'clarity' (operator, 2 okt 2026, vervolg:
     "calm control en clarity liggen dicht bijeen, kijk na"). Clarity &
     Relax se eigen omschrijving is letterlijk "organize thoughts" — een
     preciezere match voor malende gedachten dan Calm Control's "reduce
     stress/regain composure" (dat is fysiologische opwinding, geen
     denk-probleem). De andere 5 Calm Control-mappings hieronder bleven bij
     herbeoordeling wél correct — enkel deze ene stond fout.
     Deep Extended Exhale: de staat se eigen "why" is vrijwel letterlijk
     dit probleem — "a longer exhale than inhale is what lets mental noise
     settle instead of circling". severity +1: malende gedachten vragen
     meer tijd om te ordenen dan een korte sessie biedt. */
  {
    id: 'cant_stop_thinking', label: "Can't stop thinking", state: 'clarity', isCoreBasis: false, severity: 1, technique: 'deep-extended-exhale',
    why: 'A longer exhale than inhale is what lets mental noise settle instead of circling — it gives racing thoughts somewhere to go, rather than trying to force them to stop.',
  },
  /* Operator, 2 okt 2026 ("overwhelmed en angry hebben nu dezelfde
     techniek, kies voor overwhelmed iets anders" → vervolg: "alle sessies
     moeten gegarandeerd effect geven, 20 min zou ik nu niet doen, dat is
     lang"): was Extended Exhale — deelde zijn techniek met
     `frustrated_angry` hieronder. Triangular Breathing (slechts één hold,
     dus geen CO2-opbouw-bezwaar, al uitgebreid tot 20 min — zie
     breath-states.ts) is hier een vrije, andere optie binnen Calm
     Control. severity+1 kiest "Deep Release" (10 min, "time to let the
     rhythm properly take over, not just take the edge off") — substantieel
     genoeg voor een gegarandeerd effect, zonder meteen de 20-minutentier
     als instant-default op te leggen. */
  {
    id: 'overwhelmed', label: 'Overwhelmed', state: 'calm', isCoreBasis: false, severity: 1, technique: 'triangle',
    why: 'One single pause gives a rushed, overloaded mind something structured to follow — enough to interrupt the rush without the extra pressure of holding your breath twice per cycle.',
  },
  /* Gecorrigeerd van 'clarity' → 'calm' (operator, 2 okt 2026).
     Operator, vervolg ("kijk alles na, zoek bronnen op"): was Triangular
     Breathing — maar die heeft een hold-in (4s). Onderzoek naar boosheid
     is expliciet: "avoid breath retention during acute anger because it
     can increase arousal... deliberate breath retention would be
     counterproductive" (het is net bewuste ademstop die het "ingehouden"
     gevoel van boosheid voedt). Extended Exhale heeft GEEN enkele hold —
     puur verlengde uitademing, dezelfde mechaniek als bij `overwhelmed`
     hierboven, maar dan zonder het ademstop-risico dat specifiek bij
     woede ongewenst is. severity 0 kiest "Daily Grounding" (5 min) —
     anders dan `overwhelmed` (10 min) en `restless_jittery` (2 min)
     hieronder, dus geen duplicaat binnen dezelfde techniek. */
  {
    id: 'frustrated_angry', label: 'Frustrated / angry', state: 'calm', isCoreBasis: false, severity: 0, technique: 'extended-exhale',
    why: 'No breath-holds — deliberately, because holding your breath can let tension build. Just a long, steady exhale to help bring the heat down.',
  },
  /* Box Breathing: gestructureerd ademritme is een bekende, effectieve
     angst-regulatietechniek.
     Operator, 2 okt 2026: `feel_stressed` hierboven kreeg net ook
     severity+1 op dezelfde techniek (box) — zonder onderscheid zouden
     beide identiek 10 min geven. severity 0 houdt deze op "Daily
     Grounding" (5 min, de eigen recommended tier van Box), een stap
     korter dan `feel_stressed`, dus geen duplicaat. */
  {
    id: 'anxious_nervous', label: 'Anxious / nervous', state: 'calm', isCoreBasis: false, severity: 0, technique: 'box',
    why: 'An anxious mind does better with something steady to follow — four equal parts give your attention a clear, calming structure in the moment.',
  },

  // ── Focus & energy (nuance) ──────────────────────────────────────────
  /* Alternate Nostril Breathing: in de ademhalingstraditie specifiek
     geassocieerd met het "opklaren"/balanceren van een mistig hoofd —
     ander technisch spoor dan Coherent (cant_focus hierboven), zodat
     beide Sharp-Focus-situaties niet dezelfde techniek delen. */
  {
    id: 'brain_fog', label: 'Brain fog / stuck', state: 'focus', isCoreBasis: false, severity: 0, technique: 'alternate-nostril',
    why: 'Alternating the breath between nostrils is a traditional way to reset a foggy, stuck mind — a different kind of reset than trying to concentrate harder.',
  },
  /* Operator, 2 okt 2026 ("restless zelfde verhaal, 2 min is te kort"):
     was severity-1 (2 min, "Quick Reset") — zelfde redenering als bij
     `feel_stressed` hierboven: een EXPLICIETE tap vraagt om een sessie
     met gegarandeerd effect, geen korte topping-up. severity+1 kiest
     "Deep Release" (10 min, "after a genuinely hard stretch, not a
     passing annoyance") — anders dan `frustrated_angry` hierboven (5 min,
     zelfde techniek), dus geen duplicaat. */
  {
    id: 'restless_jittery', label: 'Restless / jittery', state: 'calm', isCoreBasis: false, severity: 1, technique: 'extended-exhale',
    why: 'A long, slow exhale calms physical agitation without asking you to sit perfectly still — it works even when stillness itself is the hard part.',
  },
  /* Operator, 2 okt 2026 ("tired but wired maar 3 minuten, identiek
     dezelfde techniek als cant sleep" → later "staat ook op 20 min, geen
     logica"): Slow Extended Exhale i.p.v. 4-7-8 blijft de juiste techniek
     — eigen duurbereik (5-20 min), apart van `cant_sleep`s `slow`. Maar
     severity+1 duwde dit naar de langste tier (20 min) zonder reden.
     severity 0 kiest i.p.v. daarvan de EIGEN recommended tier van deze
     techniek: "Deep Wind-Down" (10 min, "the evening length, for the
     nights the day will not quite let go") — die omschrijving IS "can't
     switch off", geen noodzaak om naar het uiterste te duwen. */
  {
    id: 'tired_wired', label: "Exhausted — can't switch off", state: 'rest', isCoreBasis: false, severity: 0, technique: 'slow-extended-exhale',
    why: 'Built for exactly this: tired, but still wired from the day — a long, slow exhale that lets your body power down even when your mind is still running.',
  },
  /* Operator, 2 okt 2026 ("ready to unwind beter clarity en relax, hier
     is gebruiker nog niet aan het slapen"): was state `rest` (Sleep,
     "Nothing to think about") — te specifiek, deze persoon ligt niet in
     bed. `clarity` ("Space before what comes next") past beter: bewust
     ontspannen, niet per se bedtime.
     Equal Breathing (`equal`): eigen omschrijving is letterlijk "a clean,
     brief border between two different parts of the day — work and home,
     one task and the next" — exact "ready to unwind". Andere techniek dan
     `cant_stop_thinking` hierboven (ook `clarity`, maar `deep-extended-
     exhale`), dus geen botsing. severity 0 → eigen recommended tier:
     "Equilibrium" (5 min). */
  {
    id: 'ready_unwind', label: 'Ready to unwind', state: 'clarity', isCoreBasis: false, severity: 0, technique: 'equal',
    why: 'An even, steady rhythm marks a clean break between one part of the day and the next — not a sleep technique, just a deliberate reset.',
  },
];

const LEVEL_ORDER: ExperienceLevel[] = ['beginner', 'intermediate', 'advanced'];

function levelIndex(level: ExperienceLevel | null): number {
  if (level === null) return 1; // "niet-beginner" startpunt, zie breath-setup.tsx-integratie
  return Math.max(0, LEVEL_ORDER.indexOf(level));
}

/** Techniek voor een instant-sessie: de EXPLICIET gekozen techniek van de
   situatie zelf (`situation.technique`, zie INSTANT_SITUATIONS hierboven
   voor de redenering per situatie) — niet langer afgeleid van
   experienceLevel. Dat was de oorzaak van de "Tired but wired = Can't
   sleep"-bug (operator, 2 okt 2026): twee situaties onder dezelfde staat
   kregen identiek dezelfde experienceLevel-afgeleide techniek, dus ook
   identieke duur. Valt terug op de eerste techniek van de staat als een
   key ooit niet zou bestaan (defensief, zou nooit mogen gebeuren).

   Let op: de "Too hard"-feedback (zie `recordInstantFeedback` hieronder)
   verlaagt nog steeds de gedeelde `experienceLevel`-instelling — dat blijft
   zinvol voor breath-setup.tsx's normale flow (die leest 'm nog wél), maar
   verandert vanaf nu NIET meer welke techniek dit instant-pad kiest, want
   die ligt per situatie al vast. Enkel "Too long"/"Too short"
   (`instantDurationBias`) werkt nog rechtstreeks door op dit pad. */
export function pickInstantTechnique(state: BreathState, situation: InstantSituation): TechniqueDef {
  const found = state.techniques.find((t) => t.key === situation.technique);
  return found ?? state.techniques[0];
}

/** Duur voor een instant-sessie: start bij de AANBEVOLEN duur van de staat
   (niet de kortste/"beginner"-optie — de operator was hier expliciet: een
   reële, voelbare dosis, geen minimale), daarna verschoven met de
   opgeslagen `instantDurationBias` uit eerdere feedback. Geklemd binnen de
   bestaande durations-lijst van de staat. */
export function pickInstantDuration(
  state: BreathState,
  technique: TechniqueDef,
  situation: InstantSituation,
): DurationDef {
  /* Techniek-specifieke duren (bv. 4-7-8 se eigen, kortere lijst) gaan
     vóór de staat-brede lijst — zelfde regel als breath-setup.tsx
     (`tech.durations ?? st.durations`), anders zou een "grondiger"-
     bijstelling hieronder een duur kunnen kiezen die voor DEZE techniek
     niet eens bestaat. */
  const list = technique.durations ?? state.durations;
  const recommendedIdx = Math.max(
    0,
    list.findIndex((d) => d.recommended),
  );
  const bias = getSetting('instantDurationBias');
  const idx = Math.max(
    0,
    Math.min(list.length - 1, recommendedIdx + situation.severity + bias),
  );
  return list[idx];
}

export type InstantFeedback = 'worked' | 'too_hard' | 'too_long' | 'too_short';

/** Past de GEDEELDE, app-brede instellingen aan op basis van feedback na
   een instant-gestarte sessie — zelfde `experienceLevel`/duur-logica die
   ook breath-setup.tsx/intensity.tsx/protocol.ts lezen. "Worked" wijzigt
   niets. Zie de toelichting bovenaan dit bestand voor de afweging. */
export async function recordInstantFeedback(feedback: InstantFeedback): Promise<void> {
  if (feedback === 'worked') return;

  if (feedback === 'too_hard') {
    const level = getSetting('experienceLevel');
    const idx = levelIndex(level);
    const next = LEVEL_ORDER[Math.max(0, idx - 1)];
    await setSetting('experienceLevel', next);
    return;
  }

  if (feedback === 'too_long') {
    const bias = getSetting('instantDurationBias');
    await setSetting('instantDurationBias', Math.max(-1, bias - 1));
    return;
  }

  if (feedback === 'too_short') {
    const bias = getSetting('instantDurationBias');
    await setSetting('instantDurationBias', Math.min(1, bias + 1));
  }
}

export function situationById(id: string): InstantSituation | undefined {
  return INSTANT_SITUATIONS.find((s) => s.id === id);
}

export function stateFor(key: BreathStateKey): BreathState {
  return BREATH_STATES[key];
}

/* ── Vrije-tekst-matcher ──────────────────────────────────────────────────
   Operator, 2 okt 2026 ("just had a discussion" gaf geen resultaat): een
   los woordje-per-situatie-lijstje (de vorige versie) dekt lang niet alle
   manieren waarop iemand hetzelfde zegt. Dit blijft bewust een LOKALE
   keyword-matcher — geen AI/backend-call, dat is nooit goedgekeurd (zie de
   afweging met de operator over BLOK 1) — maar wel breder en met een
   score i.p.v. "eerste match wint", zodat een zin met meerdere aanwijzingen
   (bv. "I'm stressed and can't focus") naar de sterkste klopt, niet de
   eerste de beste.

   Elke situatie heeft een lijst KERNWOORDEN/-ZINNEN. Matching is op
   woordgrens (geen losse 3-letter-substrings die toevallig ergens in
   zitten), meerdere hits per situatie tellen op. Hoogste score wint; bij
   gelijke stand wint de eerst gedefinieerde (core-basics staan eerst in
   `INSTANT_SITUATIONS`, dus die winnen bij een gelijkspel). Geen enkele
   hit: `matchFreeText` geeft `null` terug — de aanroeper (feel-now.tsx)
   toont dan een zichtbare "we couldn't quite catch that"-regel, in plaats
   van stil niets te doen. */
const KEYWORDS: Record<string, string[]> = {
  feel_stressed: [
    'stress', 'stressed', 'stressing', 'stressful', 'stresses me', 'pressure',
    'under pressure', 'deadline', 'deadlines', 'too much on my plate',
    'too much to do', 'swamped', 'slammed', 'busy', 'so busy', 'overworked',
    'tense', 'tension', 'wound up', 'at my limit', 'breaking point',
    'can’t cope', 'cant cope', 'struggling to keep up', 'a lot going on',
    'rough day', 'bad day', 'hard day', 'long day', 'tough week', 'hectic',
    'chaotic', 'crunch time', 'juggling too much', 'spread thin',
  ],
  feel_tired: [
    'tired', 'so tired', 'exhausted', 'drained', 'low energy', 'no energy',
    'low on energy', 'running on empty', 'sleepy', 'fatigued', 'worn out',
    'burnt out', 'burned out', 'sluggish', 'groggy', 'lethargic', 'weary',
    'need energy', 'need a boost', 'need to wake up', 'need a pick me up',
    'flat', 'zero energy', 'can barely keep my eyes open', 'jet lagged',
    'sleep deprived', 'didn’t sleep well', 'slept badly', 'woke up tired',
  ],
  cant_sleep: [
    "can't sleep", 'cant sleep', 'cannot sleep', 'can’t fall asleep',
    'cant fall asleep', 'insomnia', 'wide awake', 'trouble sleeping',
    'not sleepy', 'restless at night', 'up all night', 'tossing and turning',
    'bedtime', 'need to sleep', 'can’t get to sleep', 'mind won’t shut off at night',
    'keep waking up', 'lying awake', 'staring at the ceiling', 'sleepless',
  ],
  cant_focus: [
    "can't focus", 'cant focus', 'cannot focus', "can't concentrate",
    'cant concentrate', 'cannot concentrate', 'distracted', 'distraction',
    'procrastinating', 'procrastinate', 'procrastination', 'unfocused',
    'need to focus', 'need focus', 'all over the place', 'scattered mind',
    'can’t get started', 'cant get started', 'keep getting distracted',
    'mind keeps wandering', 'zoning out', 'spacing out', 'lost focus',
    'need to concentrate', 'need to study', 'need to work', 'can’t sit down and work',
  ],
  cant_stop_thinking: [
    "can't stop thinking", 'cant stop thinking', 'overthinking', 'overthink',
    'racing thoughts', 'racing mind', 'ruminating', 'rumination',
    'mind racing', 'thoughts racing', "won't stop", "can't switch off",
    'cant switch off', 'spiraling', 'spiralling', 'in my head', 'stuck in my head',
    'replaying it', 'can’t let it go', 'cant let it go', 'keeps circling back',
    'mind won’t stop', 'thinking too much', 'too much on my mind',
  ],
  overwhelmed: [
    'overwhelmed', 'overwhelm', 'overwhelming', 'rushed', 'in a rush',
    'too much going on', 'swamped', 'drowning', 'everything at once',
    'can’t keep up', 'cant keep up', 'so much to do', 'can’t handle it',
    'cant handle it', 'too much happening', 'buried', 'snowed under',
    'maxed out', 'spinning plates', 'pulled in every direction',
  ],
  frustrated_angry: [
    'frustrated', 'frustrating', 'frustration', 'angry', 'anger', 'mad',
    'furious', 'annoyed', 'annoying', 'irritated', 'irritating',
    'pissed off', 'ticked off', 'fuming', 'livid', 'argument', 'argued',
    'arguing', 'fight', 'fought', 'discussion', 'had a discussion',
    'just had a discussion', 'disagreement', 'disagreed', 'conflict', 'yelled',
    'yelling', 'shouting', 'shouted', 'confrontation', 'heated conversation',
    'got into it with', 'snapped at', 'blew up at', 'rubbed me the wrong way',
    'drives me crazy', 'drives me nuts', 'fed up', 'had it with', 'short-tempered',
  ],
  anxious_nervous: [
    'anxious', 'anxiety', 'nervous', 'nerves', 'worried', 'worry', 'worrying',
    'on edge', 'uneasy', 'apprehensive', 'panicky', 'panic', 'butterflies',
    'dread', 'dreading', 'scared', 'afraid', 'fear', 'fearful',
    'knot in my stomach', 'can’t relax', 'cant relax', 'jittery about',
    'nervous about', 'anxious about', 'big presentation', 'important meeting',
    'exam', 'test coming up', 'interview', 'worried about', 'what if',
  ],
  brain_fog: [
    'brain fog', 'foggy', 'stuck', 'blank', 'mind blank', 'drawing a blank',
    'can’t think straight', 'cant think straight', 'fuzzy', 'fuzzy headed',
    'mentally stuck', 'hazy', 'can’t think clearly', 'cant think clearly',
    'head is cloudy', 'not thinking clearly', 'mush for brains', 'brain is mush',
  ],
  restless_jittery: [
    'restless', 'jittery', 'fidgety', 'antsy', 'can’t sit still',
    'cant sit still', 'wired up', 'edgy', 'keyed up', 'can’t settle',
    'cant settle', 'twitchy', 'buzzing', 'full of nervous energy',
    'need to move', 'pacing', 'can’t stay still', 'cant stay still',
  ],
  tired_wired: [
    'tired but wired', 'tired and wired', 'exhausted but can’t sleep',
    'exhausted but cant sleep', 'wired but tired', 'too tired to sleep',
    'overstimulated', 'exhausted but my mind won’t stop', 'running on fumes but awake',
  ],
  ready_unwind: [
    'unwind', 'wind down', 'relax', 'relaxing', 'decompress', 'chill',
    'chill out', 'ready to rest', 'done for the day', 'winding down',
    'want to relax', 'need to relax', 'need to unwind', 'off the clock',
    'finished work', 'done with work', 'kick back', 'settle in for the evening',
  ],
};

/* Operator, 2 okt 2026 ("denk ook aan crying, pain"): verdriet/emotionele
   overspoeling heeft geen eigen staat (er bestaan er maar 5) — qua "hoge
   emotionele activatie naar rust" is Calm Control (feel_stressed) de enige
   die logisch past, net als frustrated_angry hierboven. Los toegevoegd
   i.p.v. in de KEYWORDS-bank hierboven, zodat dit apart herleesbaar blijft
   als eigen beslissing. "Pain" is BEWUST uitgesloten — dat zou een
   medische claim suggereren (CLAUDE.md §1), nog te bevestigen met de
   operator vóór het toegevoegd wordt. */
KEYWORDS.feel_stressed.push(
  'crying', 'cried', 'cry', 'tears', 'tearful', 'sad', 'sadness', 'upset',
  'heartbroken', 'grief', 'grieving', 'devastated', 'hurting emotionally',
  'low mood', 'feeling low', 'down about', 'emotional', 'breaking down',
);

/* Generieke, minder specifieke signaalwoorden — vangen een zin op die
   duidelijk "iets is lastig" zegt zonder in één van de bovenstaande
   banken te passen. Bewust naar Calm Control (breed inzetbaar, "van hoge
   activatie naar rust" — past bij de meeste vage klachten) i.p.v. niets
   te doen. Operator, 2 okt 2026: "moet echt zo uitgebreid dat het werkt,
   anders is dit belachelijk" — dit is het vangnet daarvoor, geen vervanging
   van de specifieke banken hierboven (die blijven altijd eerst proberen). */
const GENERIC_NEGATIVE = [
  'hard', 'difficult', 'struggling', 'struggle', 'not okay', 'not ok',
  'not good', 'bad', 'rough', 'awful', 'terrible', 'heavy', 'a lot',
  'too much', 'help', 'need help', 'not great', 'not doing well',
  'having a moment', 'down', 'off today', 'not myself',
];

function scoreAll(text: string): { id: string; score: number }[] {
  const q = ` ${text.trim().toLowerCase()} `;
  const scores: { id: string; score: number }[] = [];
  for (const situation of INSTANT_SITUATIONS) {
    const bank = KEYWORDS[situation.id] ?? [];
    let score = 0;
    for (const phrase of bank) {
      if (phrase.includes(' ')) {
        // Meerwoordige zin: gewone substring-check volstaat (woordgrens-
        // regex op een hele zin voegt weinig toe en kost complexiteit).
        if (q.includes(phrase)) score += 1;
      } else {
        // Eén woord: op woordgrens matchen, zodat "mad" niet toevallig
        // "madrid" raakt, en "fight" niet "fighting" mist — \b dekt beide.
        const re = new RegExp(`\\b${phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
        if (re.test(q)) score += 1;
      }
    }
    if (score > 0) scores.push({ id: situation.id, score });
  }
  return scores.sort((a, b) => b.score - a.score);
}

/** Sterke match: hoogste score wint, enkel teruggeven bij score > 0. */
export function matchFreeText(text: string): InstantSituation | null {
  if (text.trim().length < 2) return null;
  const scores = scoreAll(text);
  if (scores.length > 0) return situationById(scores[0].id) ?? null;

  // Vangnet: niets specifieks matchte, maar de tekst klinkt duidelijk
  // negatief/moeilijk — val terug op Calm Control i.p.v. niets te doen.
  const q = ` ${text.trim().toLowerCase()} `;
  for (const word of GENERIC_NEGATIVE) {
    const re = word.includes(' ')
      ? null
      : new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re ? re.test(q) : q.includes(word)) {
      return situationById('feel_stressed') ?? null;
    }
  }
  return null;
}

/* Geen aparte "Did you mean…"-functie: `matchFreeText` commit al op elke
   score > 0 (één herkend trefwoord is al genoeg signaal om door te gaan —
   wachten op een hogere score zou juist de EENVOUDIGE, meest voorkomende
   invoer, zoals gewoon "tired" typen, onnodig naar een suggestie-stap
   duwen). Bij een ECHTE nul-match is er dus ook geen eerlijk "dit lijkt
   er een beetje op"-signaal om op te baseren — verzinnen zou oneerlijk
   zijn. Het vangnet is daarom: de zichtbare "we couldn't quite catch
   that"-regel (feel-now.tsx) die rechtstreeks naar de chip-grid eronder
   wijst, die zelf al bewust geordend is (4 core-basics bovenaan, breedst
   toepasbaar) — dát IS het suggestiesysteem bij een echte nul-match. */
