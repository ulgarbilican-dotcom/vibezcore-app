/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — De vijf ademtoestanden

   Alles wat per toestand verschilt staat HIER, en niets ervan in het
   sessiescherm. Dat scherm kent zijn eigen inhoud niet; het krijgt een
   sleutel mee en tekent wat hier staat. Zo kost een zesde toestand een
   blok gegevens en geen tweede scherm.

   Namen, teksten en kleuren zijn van de operator (1 augustus 2026).
   "Crystal Grid" verving "Hexagonal Grid" — dat laatste klonk als een
   wiskundeterm en niet als een toestand.

   ── V1-PROTOCOLSET, operator 8 september 2026 ────────────────────────
   Vervangt de vorige 2-technieken-per-toestand opzet door 15 protocollen
   (3 per toestand, Beginner/Intermediate/Advanced), na uitgebreid
   onderzoek naar wat elke techniek ECHT is — geen verzonnen varianten.

   BELANGRIJK, letterlijk van de operator: "100% wetenschappelijke
   zekerheid bestaat hier niet. Wat hieronder staat is een concrete,
   reproduceerbare VIBEZCORE V1-specificatie. Een professionele
   breathwork/respiratory specialist moet vóór publieke release de
   safety-screening formeel aftekenen." Dat blijft waar zolang dit
   bestand bestaat — dit is geen medisch document, het is toestand-taal
   (CLAUDE.md §1) met een zo eerlijk mogelijke tijd/ritme-basis.

   Waar een techniek geen universeel "juist" ritme heeft (bijvoorbeeld
   diaphragmatic breathing — de literatuur gebruikt uiteenlopende
   frequenties), is de hier gekozen timing VIBEZCORE's GESTANDAARDISEERDE
   implementatie, niet een bewering dat dit hét wetenschappelijke ritme is.
   Waar een bron wél een concreet, citeerbaar getal geeft (Lehrer/Vaschillo
   resonance breathing ~5.5–6/min, Weil's 4-7-8 opbouwschema, de Stanford
   cyclic-sighing dosering van 5 min/dag), volgt VIBEZCORE die.

   `safetyTier` per techniek (green/amber/red) is een INTERNE indeling,
   nog niet getoond in de UI — bedoeld als basis voor de operator-review
   hierboven en voor eventuele latere UI (bv. een waarschuwing bij amber).

   Twee kleine, noodzakelijke motor-uitbreidingen (geen nieuwe schermen,
   geen nieuwe interactie-modellen — puur type-niveau):
   - `PhaseKey` kreeg 'inhale-2' en 'exhale-2' erbij. Zonder die twee kon
     Physiological Sigh (twee inademingen ná elkaar) en Alternate Nostril
     Breathing (twee in- én twee uitademingen per cyclus) niet: de
     bestaande motor zoekt een fase op via `phases.find(p => p.key === k)`
     — de EERSTE match — dus twee fases met dezelfde key in één techniek
     waren onvindbaar/dubbelzinnig. `breath-haptics.ts` en
     `breath-voice.ts` behandelen de "-2"-varianten identiek aan hun
     eerste helft (zelfde trilpatroon, zelfde stem-bestand — geen nieuwe
     opnames nodig).
   - `PhaseDef.via` kreeg 'Left Nostril' | 'Right Nostril' erbij, voor
     Alternate Nostril Breathing. Puur tekst — dezelfde plek waar nu al
     "NOSE"/"MOUTH" verschijnt naast een fase.
   Verder: geen nieuwe schermen, geen nieuw databronnen-concept. De
   layout van `breath-setup.tsx` (bol + techniek-knoppen) is aangepast van
   een vaste links/rechts-opstelling (gebouwd voor precies 2 knoppen) naar
   één rij die met elk aantal meeschaalt — noodzakelijk gevolg van 3
   protocollen per toestand, geen aparte architectuurkeuze.

   ── Beslist door de operator, 2 augustus 2026 ────────────────────────
   FOCUS en CLARITY stonden in de opgave met hun adempatroon geruild. Het
   principe moet kloppen, dus ze staan hier zoals de Breath-tab het al deed:
   FOCUS krijgt een rustig, gelijk ritme en CLARITY een langere uitademing.

   ── Kleur per toestand, operator 2 augustus 2026 ─────────────────────
   De kleur volgt de ILLUSTRATIE, niet andersom. Twee liepen daarop achter:
   CLARITY stond ijsblauw terwijl het kristal kleurloos is (nu wit), en REST
   stond indigo van de bol die er niet meer is (nu groen, als de boom).

   Rondes zijn leidend, minuten zijn het label: alleen waar de cycluslengte
   in zestig past vallen die samen. Daarom staat de exacte tijd altijd naast
   de keuze in beeld.

   ── Modusnamen gelijkgetrokken, 2 augustus 2026 ──────────────────────
   De keuzepagina noemde twee toestanden anders dan het sessiescherm:
   CALM tegenover Calm Control, REST tegenover Rest & Reset (inmiddels
   Sleep, operator 22 september 2026). Dezelfde modus onder twee namen is
   geen nuance maar een fout. De namen uit de mockup van de operator zijn
   nu de enige: BOOST · FOCUS · CALM CONTROL · CLARITY · SLEEP, hier in
   `eyebrow`, en beide schermen lezen die.

   Kleur hoort óók bij de modus en staat daarom hier: `accent` en
   `gradient` sturen zowel de keuzepagina als de knop als het sessiescherm.
   De bracelet houdt zijn eigen tabel (CLAUDE.md §5) — dat is hardware en
   een ander product; ademen kleurt naar de illustratie.
   ───────────────────────────────────────────────────────────────────────── */

import type { SessionArtKey } from '@/components/SessionArt';

export type BreathStateKey = 'boost' | 'focus' | 'calm' | 'clarity' | 'rest';

export type PhaseKey =
  | 'inhale'
  | 'inhale-2'
  | 'hold-in'
  | 'exhale'
  | 'exhale-2'
  | 'hold-out';

export type PhaseDef = {
  key: PhaseKey;
  label: string;
  secs: number;
  /** Waar de lucht langs gaat. `null` tijdens vasthouden. */
  via: 'Nose' | 'Mouth' | 'Left Nostril' | 'Right Nostril' | null;
  /* Hier stond `vib`: één trillingsduur per fase. Vervangen door een
     patroon per fase in services/breath-haptics.ts — met alleen een duur
     voelen de fasen identiek, en dan moet je toch kijken. */
};

/** Intern veiligheidsniveau per protocol (operator, 8 september 2026).
 *  Nog niet in de UI getoond — basis voor de verplichte operator/
 *  specialist-review vóór publieke release. */
export type SafetyTier = 'green' | 'amber' | 'red';

/** Eén ademritme binnen een toestand.
 *
 *  De NAAM is bewust zakelijk en draagt het ritme in zich — "Box 4-4-4-4",
 *  "Slow 4-6". De toestand eromheen draagt al de sfeer (BOOST, SLEEP);
 *  zou de techniek dat ook doen, dan staan er twee lagen stemming boven
 *  elkaar en is niet meer te zien wát er verschilt tussen twee keuzes. Op dit
 *  niveau wil iemand feiten. Het getal is dus de naam, en dat schaalt: een
 *  zesde ritme heeft geen nieuwe metafoor nodig. */
export type TechniqueDef = {
  /** Eigen duren, als de algemene van de toestand niet passen. Zie `cycles`. */
  durations?: DurationDef[];
  key: string;
  name: string;
  /** Beginner/Intermediate/Advanced — operator, 8 september 2026: drie
   *  protocollen per toestand, oplopend in complexiteit/intensiteit. */
  level: 'Beginner' | 'Intermediate' | 'Advanced';
  safetyTier: SafetyTier;
  /** Korte waarschuwing/caveat — enkel gezet bij amber/red. */
  safetyNote?: string;
  /** Eén zin: wát het is en waar het vandaan komt.
   *
   *  Nodig omdat een naam als "Coherent 5-5" of "Resonant 6-6" niets zegt
   *  tegen wie de term niet kent (operator, 4 augustus 2026) — en dat is
   *  vrijwel iedereen. Toestand-taal, geen claims over wat het met je lichaam
   *  doet (CLAUDE.md §1): wat het RITME is, niet wat het met je zenuwstelsel
   *  zou doen. [OPERATOR] mag deze zinnen herschrijven; ze zijn functioneel
   *  bedoeld, niet als merkcopy. */
  explain: string;
  /** Operator, 10 september 2026: "hier leg je weer gewoon de techniek uit.
   *  user moet zien wat het doet niet wat het is" — `explain` beschrijft de
   *  VORM (timing, herkomst); dit veld beschrijft het EFFECT/gebruik, en
   *  vooral hoe dit protocol verschilt van de andere twee in dezelfde
   *  toestand (Beginner→Intermediate→Advanced is altijd een oplopende
   *  stap, nooit drie keer hetzelfde gezegd). Toestand-taal, geen
   *  wetenschaps-/medische claims (CLAUDE.md §1) — "vaker gebruikt",
   *  "vraagt aandacht", "vergt oefening", nooit "verlaagt cortisol" of
   *  "activeert je nervus vagus". [OPERATOR] mag herschrijven. */
  effect: string;
  /** Operator, 24 september 2026 ("belachelijke opsommingen... moet
   *  professioneel/breder, geen filmscript-zinnetje" — pasted Apple-
   *  referentie over "Contextual Triggers"): 3 korte, brede momentlabels
   *  i.p.v. letterlijke scenario-zinnen in `effect` zelf gestopt ("terwijl
   *  je een kamer binnenloopt na een ruzie" e.d.). `effect` is nu weer een
   *  korte, op zichzelf staande "essentie"-zin (geen scenario, geen
   *  vergelijking); dit veld draagt de scanbare lijst met brede,
   *  universele momenten (bv. "Before important moments", "To clear
   *  mental clutter") — getoond als los blok ONDER de essentie-zin in de
   *  infosheet, niet als lopende tekst. */
  moments?: string[];
  /** Operator, 24 september 2026 (pasted analyse, sectie 2/9: "Best for:
   *  Downshifting" i.p.v. de gebruiker op techniek-naam te laten kiezen):
   *  een tot twee woorden, de FUNCTIE van het protocol i.p.v. zijn naam —
   *  "Downshifting", "Structured composure", "Settling attention". Staat
   *  bovenaan de techniek-infosheet, vóór alles. */
  bestFor: string;
  /** Operator, 24 september 2026 ("is dit de meest optimale weergave? —
   *  zelfcontrole"): een kort mechanisme-zinnetje ("Longer exhale than
   *  inhale.", "Four equal phases. One clear rhythm.") voor de "WHAT IT
   *  CHANGES"-sectie in de infosheet. EIGEN veld i.p.v. hergebruik van
   *  `techniqueHook(explain)` — die helper geeft soms de reputatie-/
   *  herkomstzin terug i.p.v. het mechanisme (bv. Box zonder streepje in
   *  `explain` toonde de HELE zin incl. "Popularized as tactical
   *  breathing in military training", niet wat het ritme fysiek doet). */
  changes: string;
  phases: PhaseDef[];
};

export type DurationDef = {
  minutes: number;
  /* Vaste hoeveelheid ADEMHALINGEN in plaats van minuten.
     Nodig voor 4-7-8: Weil schrijft vier cycli om mee te beginnen en hoogstens
     acht na een maand oefenen. Onze algemene duren van 5, 10 en 20 minuten
     zijn bij een cyclus van negentien seconden zestien, tweeendertig en
     drieenzestig cycli — tot acht keer die bovengrens. Voor een app die met
     docenten samenwerkt is dat niet te verdedigen (operator, 7 augustus 2026).
     Staat dit veld er, dan telt het en niet de minuten. */
  cycles?: number;
  rounds: number;
  name: string;
  why: string;
  recommended?: boolean;
  /** Operator, 24 september 2026 (pasted analyse, sectie 9: "5 min ★ ·
   *  Research protocol" — enkel waar dat FEITELIJK klopt, bv. Physiological
   *  Sigh's 5 minuten is letterlijk de dosering uit de Stanford-studie).
   *  Niet zomaar overal zetten — enkel bij een echt citeerbaar,
   *  gepubliceerd protocol, geen marketing-badge. */
  researchProtocol?: boolean;
};

export type BreathState = {
  key: BreathStateKey;
  /** De naam van de MODUS, in hoofdletters. Staat boven de titel op het
   *  sessiescherm en is de kop op de keuzepagina — één naam, twee plekken. */
  eyebrow: string;
  /** De naam van het figuur — dit is de kop van het scherm. */
  title: string;
  tagline: string;
  /** Korte descriptor onder de miniatuur/naast de naam — geen van de vijf
   *  hergebruikt meer de figuurnaam (BOOST deed dat tot 7 september 2026,
   *  "Radiating Sun"; nu een eigen descriptor, "Energy & Drive", zoals de
   *  andere vier al hadden). */
  subtitle: string;
  /** Wat de toestand doet, in twee zinnen. Operator-copy, 2 augustus 2026 —
   *  woord voor woord zoals aangeleverd. Staat op de keuzepagina. */
  description: string;
  /** Operator, 24 september 2026 (pasted analyse: "STATE → TECHNIQUE →
   *  DURATION, niet TECHNIQUE → RANDOM DURATION"): functionele
   *  toestand-definitie — "Move from X toward Y", geen resultaatclaim
   *  ("Get more energy" zou dat wel zijn). Nieuw, eigen veld — raakt NIET
   *  `description` hierboven, die blijft woord-voor-woord de
   *  operator-copy op de keuzepagina. `need` is voor het setup-scherm
   *  (breath-setup.tsx), waar de vraag "waarom kies ik deze staat"
   *  concreter beantwoord moet worden. */
  need: string;
  /** Accentkleur: tekst, randen, de boog. */
  accent: string;
  /** Zachte vulling van de gekozen keuze. */
  accentSoft: string;
  /** Verzadigde kleur voor de lichtbron achter de figuur. */
  glow: string;
  /** Verloop van de startknop, donker → licht. */
  gradient: [string, string, string];
  art: SessionArtKey;
  /** Waar het onderwerp verticaal in zijn eigen bestand staat. */
  focusY: number;
  /** Correctie op de beeldgrootte. Elk bestand heeft een andere lege rand:
   *  de flower of life vult het zijne bijna helemaal, de lotus maar
   *  tweederde. Zonder deze factor is één maat voor alle vijf altijd voor
   *  iemand fout. 1 = ongewijzigd. */
  artScale?: number;
  phases: PhaseDef[];
  /** Naam van de techniek, onder het ritmeblok. */
  /* Het losse veld `technique` is op 7 augustus 2026 verwijderd. Het was een
     met de hand ingevulde herhaling van het eerste ritme, en zodra een
     toestand er twee kreeg, noemde het er nog maar een. Wat een toestand aan
     ritmes heeft, staat in `techniques` — daar en nergens anders. */
  /** De protocollen die binnen deze toestand te kiezen zijn — drie per
   *  toestand sinds de V1-protocolset (operator, 8 september 2026),
   *  Beginner/Intermediate/Advanced. De eerste is de standaard en draagt
   *  dezelfde fasen als `phases` hierboven — dat veld blijft bestaan zodat
   *  schermen die maar één ritme nodig hebben, zoals de keuzepagina, niets
   *  hoeven te weten van deze lijst. */
  techniques: TechniqueDef[];
  durations: DurationDef[];
  /** Welke duur standaard geselecteerd is. */
  defaultDuration: number;
};

/* Fasen komen vaak terug; deze helpers houden de tabel leesbaar. */
const inhale = (secs: number, via: PhaseDef['via']): PhaseDef => ({
  key: 'inhale',
  label: 'INHALE',
  secs,
  via,
});
/* Tweede inademing — Physiological Sigh (de korte "topping-off"-adem) en
   Alternate Nostril Breathing (de tweede helft van de cyclus). Zelfde
   label als een gewone inademing: voor wie ademt voelt dit niet als een
   aparte fase, enkel als een korte extra teug. */
const inhale2 = (secs: number, via: PhaseDef['via']): PhaseDef => ({
  key: 'inhale-2',
  label: 'INHALE',
  secs,
  via,
});
const exhale = (secs: number, via: PhaseDef['via']): PhaseDef => ({
  key: 'exhale',
  label: 'EXHALE',
  secs,
  via,
});
const exhale2 = (secs: number, via: PhaseDef['via']): PhaseDef => ({
  key: 'exhale-2',
  label: 'EXHALE',
  secs,
  via,
});
const hold = (secs: number, which: 'hold-in' | 'hold-out'): PhaseDef => ({
  key: which,
  label: 'HOLD',
  secs,
  via: null,
});

export const BREATH_STATES: Record<BreathStateKey, BreathState> = {
  /* ── BOOST ──────────────────────────────────────────────────────────
     Drie protocollen, oplopend in tempo: 7.5 → 10 → 15 ademhalingen per
     minuut. Alleen het derde (Faster Equal Breathing) is bewust kort
     gehouden — sneller ademen verlaagt het CO₂-gehalte en kan tintelingen/
     lichte duizeligheid geven. */
  boost: {
    key: 'boost',
    eyebrow: 'BOOST',
    title: 'Radiating Sun',
    tagline: 'Energy moves outward.',
    subtitle: 'Energy & Drive',
    description:
      'Activate energy. Increase intensity, motivation and physical drive.',
    need: 'From rest to activity.',
    accent: '#F5A524',
    accentSoft: 'rgba(245,165,36,0.15)',
    glow: '#C8760A',
    gradient: ['#B8720A', '#F5A524', '#FFD98A'],
    art: 'sun',
    focusY: 0.5,
    artScale: 1,
    /* State-level fallback, gebruikt vóór een techniek gekozen is — houdt
       gelijke tred met Diaphragmatic Breathing (de standaardtechniek)
       hieronder, zie de toelichting daar. */
    phases: [inhale(4, 'Nose'), exhale(2, 'Nose')],
    techniques: [
      {
        key: 'diaphragmatic',
        name: 'Diaphragmatic Breathing',
        level: 'Beginner',
        safetyTier: 'green',
        /* Operator, 24 september 2026 (1e ronde, "echte herkenbare
           situaties... geen vage 'stress'-taal, geen vergelijking"; 2e
           ronde, correctie: "belachelijke opsommingen, te simplistisch...
           moet professioneel/breder" — pasted Apple-referentie over
           "Contextual Triggers"): `effect` is nu weer een korte, op
           zichzelf staande zin (geen letterlijk scenario, geen
           vergelijking); `moments` (nieuw veld, zie type hierboven) draagt
           de brede, scanbare momentlabels — "Before important moments" i.p.v.
           "walking into a room before an argument". `why` per duur terug
           naar zijn eigen, rustige vorm. */
        explain:
          'Four seconds in, two seconds out, breathing low into the abdomen — the shorter exhale keeps you leaning toward alert rather than settled. A gentle, standardized pace: comfortable, never maximal.',
        /* Operator, 24 september 2026 (3e ronde — pasted, herschreven
           referentie-tekst, "optimaliseren volgens ons systeem"): copy
           overgenomen in stijl/punch, maar VOOR opname gefilterd op
           CLAUDE.md §1 (geen wetenschaps-/medische claims) — enkele
           zinnen in de referentie ("prime your nervous system",
           "chemically overriding a hyperactive brain", "cellular
           recovery", "rewrite its stress response", "intervention") zijn
           harde schendingen van die regel en dus vervangen door
           toestand-taal, niet letterlijk overgenomen.
           Operator, 24 september 2026 (4e ronde, "wetenschappelijk correct
           altijd overal"): ritme van 4/4 naar 4 in / 2 uit — bevestigd via
           onderzoek (biorxiv, paced breathing met verlengde inademing)
           dat een langere inademing t.o.v. de uitademing sympathische
           activatie/alertheid verhoogt, het spiegelbeeld van de verlengde-
           uitademing-voor-kalmte die Calm/Sleep elders al gebruiken. De
           referentie-tekst claimde dit met klinische termen ("autonomic
           nervous system", "sympathetic action mode", "oxygen stacking")
           — ook dat is opnieuw naar toestand-taal herschreven, niet
           letterlijk overgenomen. */
        effect: 'A shorter exhale keeps the lift building instead of settling — a steady rise, not a jolt.',
        bestFor: 'Gentle activation',
        changes: 'Shorter exhale than inhale.',
        moments: ['To start with a clear head', 'Priming the body before effort', 'Breaking through a low-energy stretch'],
        phases: [inhale(4, 'Nose'), exhale(2, 'Nose')],
        /* Rondes herberekend voor de nieuwe 6s-cyclus (4+2, was 8s bij
           4+4) — anders klopt de getoonde duur-info niet meer. */
        durations: [
          { minutes: 3, rounds: 30, name: 'Quick Charge', why: 'Enough to shake off grogginess or a slump before you need to be sharp — quick and to the point.' },
          { minutes: 5, rounds: 50, name: 'System Ignition', why: 'Enough to properly lift your energy, and still fits right before you start your day.', recommended: true },
          { minutes: 10, rounds: 100, name: 'Extended Activation', why: 'For a slower morning or a full warm-up, when there is time to build energy gradually.' },
        ],
      },
      {
        key: 'equal',
        name: 'Equal Breathing',
        level: 'Intermediate',
        safetyTier: 'green',
        explain: 'Three seconds in, three seconds out, nose only — a brisker version of the same even rhythm.',
        effect: 'A steady rise in energy — alert, not wired.',
        bestFor: 'Steady activation',
        changes: 'Brisk, even breathing.',
        moments: ['Before physical exertion', 'Breaking through an energy crash', 'Before a long stretch on your feet'],
        phases: [inhale(3, 'Nose'), exhale(3, 'Nose')],
        durations: [
          { minutes: 3, rounds: 30, name: 'Quick Charge', why: 'A fast lift when time is short but the energy still matters — before a workout or a long shift.' },
          { minutes: 5, rounds: 50, name: 'System Ignition', why: 'The everyday length at this brisker pace — enough to feel the lift without planning around it.', recommended: true },
          { minutes: 10, rounds: 100, name: 'Extended Activation', why: 'The full warm-up, for when real physical effort is coming and there is time to build into it properly.' },
        ],
      },
      {
        key: 'faster-equal',
        name: 'Faster Equal Breathing',
        level: 'Advanced',
        safetyTier: 'amber',
        safetyNote:
          'Can bring on light-headedness or tingling in the hands. Stop early if it does, and skip this one if you are pregnant or have a heart or blood-pressure condition.',
        /* Operator, 24 september 2026 ("wetenschappelijk correct altijd
           overal"): was neus-in/neus-uit. Neusademhaling beperkt van nature
           hoeveel lucht je per seconde verplaatst — precies waarom
           uitademen door getuite lippen/mond het MOEILIJKER maakt om te
           hyperventileren, niet makkelijker. Een zuiver neus/neus-protocol
           op dit tempo wekt het effect dat deze techniek zelf claimt
           (lichtheid/tinteling) dus niet betrouwbaar op. De erkende
           protocollen die dat effect wél opwekken (bv. Huberman Lab's
           cyclische ademhaling, Wim Hof-stijl) gebruiken neus-in/mond-uit.
           Exhale hier daarom naar Mouth — inhale blijft Nose. */
        explain:
          'Two seconds in through the nose, two seconds out through the mouth — a brisk paced-breathing protocol, not a traditional fast-breathing technique. Short sessions only.',
        effect: 'A fast, sharp lift in alertness — built for right before something happens.',
        bestFor: 'Rapid activation',
        changes: 'Very fast breathing, mouth exhale.',
        moments: ['Before high-stakes focus', 'Centering before you perform', 'Before an explosive burst of effort'],
        phases: [inhale(2, 'Nose'), exhale(2, 'Mouth')],
        durations: [
          { minutes: 2, rounds: 30, name: 'Quick Charge', why: 'A fast, focused boost — right in the moments before something that demands full energy.', recommended: true },
          { minutes: 3, rounds: 45, name: 'System Ignition', why: 'A little more once the pace feels familiar, for when two minutes is not quite enough.' },
          { minutes: 5, rounds: 75, name: 'Extended Activation', why: 'The longest at this pace — stop early if you feel light-headed, this rhythm is not about going long.' },
        ],
      },
    ],
    /* State-level fallback — zelfde herberekening als de techniek
       hierboven (6s-cyclus, was 8s). */
    durations: [
      { minutes: 3, rounds: 30, name: 'Quick Charge', why: 'Enough to shake off grogginess or a slump before you need to be sharp — quick and to the point.' },
      { minutes: 5, rounds: 50, name: 'System Ignition', why: 'Enough to properly lift your energy, and still fits right before you start your day.', recommended: true },
      { minutes: 10, rounds: 100, name: 'Extended Activation', why: 'For a slower morning or a full warm-up, when there is time to build energy gradually.' },
    ],
    defaultDuration: 1,
  },

  /* ── FOCUS ──────────────────────────────────────────────────────────
     Coherent Breathing (het best onderzochte langzame ademtempo) als
     standaard, met Alternate Nostril Breathing en Ujjayi als de twee
     technieken waar de VORM (welk neusgat, keelklank) belangrijker is dan
     de timing eromheen. */
  focus: {
    key: 'focus',
    eyebrow: 'SHARP FOCUS',
    title: 'Flower of Life',
    tagline: 'Perfect order.',
    subtitle: 'Clarity Mind',
    description:
      'Sharpen attention. Improve concentration and reduce distractions.',
    need: 'From scattered to focused.',
    accent: '#3E9BFF',
    accentSoft: 'rgba(62,155,255,0.15)',
    glow: '#0B4FBF',
    gradient: ['#1554B8', '#3E9BFF', '#A9D3FF'],
    art: 'flower',
    focusY: 0.5,
    artScale: 0.72,
    phases: [inhale(5, 'Nose'), exhale(5, 'Nose')],
    techniques: [
      {
        key: 'coherent',
        name: 'Coherent Breathing',
        level: 'Beginner',
        safetyTier: 'green',
        explain:
          'Five seconds in, five seconds out — six breaths a minute. One of the most studied slow-breathing rhythms there is.',
        effect: 'A measured, even pace that settles a scattered mind into deep, steady attention.',
        bestFor: 'Settling attention',
        changes: 'Slow, even breathing.',
        moments: ['Dropping into deep work', 'Clearing static before an exam or presentation', 'Holding attention when it starts to tire'],
        phases: [inhale(5, 'Nose'), exhale(5, 'Nose')],
        durations: [
          /* Operator, 9 september 2026: zelfde "micro-sessie ontbrak"-fix
             als bij Calm — geen holds hier, dus geen bezwaar tegen kort. */
          { minutes: 3, rounds: 18, name: 'Pre-Task Prime', why: 'A fast reset for the minutes before a task that needs your attention, when there is no time to spare.' },
          { minutes: 5, rounds: 30, name: 'Mind Declutter', why: 'The everyday standard for focus — long enough to ground a scattered mind before real work begins.', recommended: true },
          { minutes: 10, rounds: 60, name: 'Flow Entry', why: 'Your runway into deep work — before writing, studying, or anything that needs uninterrupted focus.' },
          { minutes: 20, rounds: 120, name: 'Deep Focus', why: 'For a long block of work or study, when what is ahead genuinely deserves the extra runway.' },
        ],
      },
      {
        key: 'alternate-nostril',
        name: 'Alternate Nostril Breathing',
        level: 'Intermediate',
        safetyTier: 'green',
        explain:
          'Inhale through the left nostril, exhale through the right; then inhale right, exhale left — one full cycle. Close each nostril gently with a finger as you go. No holds.',
        effect: 'Gives a wandering mind a precise job to do — a real answer for attention that keeps slipping.',
        bestFor: 'Active attention anchor',
        changes: 'Alternating nostril breathing.',
        moments: ['When focus keeps drifting', 'Switching cleanly between tasks', 'Opening up before creative work'],
        phases: [
          inhale(4, 'Left Nostril'),
          exhale(4, 'Right Nostril'),
          inhale2(4, 'Right Nostril'),
          exhale2(4, 'Left Nostril'),
        ],
        durations: [
          /* "No holds" staat letterlijk in `explain` hierboven — geen
             fysiologisch bezwaar tegen een korte versie. */
          { minutes: 3, rounds: 11, name: 'Pre-Task Prime', why: 'A fast mental switch when there is only a short window between two very different tasks.' },
          { minutes: 5, rounds: 19, name: 'Mind Declutter', why: 'The right length to properly settle into the alternating rhythm before you need to perform.', recommended: true },
          { minutes: 10, rounds: 38, name: 'Flow Entry', why: 'A longer, unhurried practice — a solid base before a long, complex piece of work.' },
          { minutes: 15, rounds: 56, name: 'Deep Focus', why: 'The full session, for when focus has scattered and genuinely needs to be rebuilt.' },
        ],
      },
      {
        key: 'ujjayi',
        name: 'Ujjayi Breathing',
        level: 'Advanced',
        safetyTier: 'amber',
        safetyNote:
          'Skip the throat constriction if you have low blood pressure or a heart condition — breathe the timed rhythm plainly instead.',
        explain:
          "Five seconds in, five seconds out through the nose, with a gentle narrowing at the back of the throat — the same soft 'ocean' sound used in flowing yoga practice. The sound is the technique; the timing here is VIBEZCORE's pacing for it, not the definition of Ujjayi.",
        effect: 'The sound demands your full attention — exactly what makes it work against distraction.',
        bestFor: 'Blocking distraction',
        changes: 'Slow breathing with a throat sound.',
        moments: ['In a noisy environment', 'Locking in before sustained concentration', 'When outside noise keeps pulling you away'],
        phases: [inhale(5, 'Nose'), exhale(5, 'Nose')],
        durations: [
          { minutes: 5, rounds: 30, name: 'Mind Declutter', why: 'The baseline — enough to sync with the sound and the rhythm before diving into work.', recommended: true },
          { minutes: 10, rounds: 60, name: 'Flow Entry', why: 'For longer stretches once the technique feels familiar and a bigger task is ahead.' },
          { minutes: 20, rounds: 120, name: 'Deep Focus', why: 'A long, uninterrupted block of focused work.' },
        ],
      },
    ],
    durations: [
      { minutes: 5, rounds: 30, name: 'Mind Declutter', why: 'The everyday standard for focus — long enough to ground a scattered mind before real work begins.', recommended: true },
      { minutes: 10, rounds: 60, name: 'Flow Entry', why: 'Your runway into deep work — before writing, studying, or anything that needs uninterrupted focus.' },
      { minutes: 20, rounds: 120, name: 'Deep Focus', why: 'For a long block of work or study, when what is ahead genuinely deserves the extra runway.' },
    ],
    defaultDuration: 0,
  },

  /* ── CALM ───────────────────────────────────────────────────────────
     De drie meest "structured breathing"-protocollen die er zijn:
     Extended Exhale, Triangle en Box. Alle drie zonder bijzondere
     veiligheidscaveat, behalve dat Box (twee holds) niet voor iedereen
     prettig is. */
  calm: {
    key: 'calm',
    eyebrow: 'CALM CONTROL',
    title: 'Lotus',
    tagline: 'Stillness in motion.',
    subtitle: 'Balance & Composure',
    description:
      'Reduce stress. Restore balance. Regain composure.',
    need: 'From high activation to a settled state.',
    accent: '#B478FF',
    accentSoft: 'rgba(180,120,255,0.15)',
    glow: '#7B2FE0',
    gradient: ['#8B3DF0', '#B478FF', '#D0A2FF'],
    art: 'lotus',
    focusY: 0.43,
    artScale: 1.14,
    phases: [inhale(4, 'Nose'), exhale(6, 'Nose')],
    techniques: [
      {
        key: 'extended-exhale',
        name: 'Extended Exhale Breathing',
        level: 'Beginner',
        safetyTier: 'green',
        explain:
          'Four seconds in, six seconds out. The longer exhale is the whole idea — one of the best-supported slow-breathing rhythms there is.',
        effect: 'The gentlest way in — a longer exhale that signals the body to ease off, without much effort.',
        bestFor: 'Downshifting',
        changes: 'Longer exhale than inhale.',
        moments: ['Right after something rattles you', 'Before a difficult conversation', 'Landing back in your body'],
        phases: [inhale(4, 'Nose'), exhale(6, 'Nose')],
        durations: [
          /* Operator, 9 september 2026 (na productonderzoek naar
             gebruikersniveaus): een korte "acute stress reset"-optie
             ontbrak — 5 min is voor iemand die net iets stressvols
             meemaakte al een drempel. Geen holds in dit ritme, dus geen
             fysiologisch bezwaar tegen kort. */
          { minutes: 2, rounds: 12, name: 'Quick Reset', why: 'A fast reset for right after something throws you off — not a full session, just enough to take the edge off.' },
          { minutes: 5, rounds: 30, name: 'Daily Grounding', why: 'The one to reach for most days — enough to settle in, brief enough that you will keep coming back to it.', recommended: true },
          { minutes: 10, rounds: 60, name: 'Deep Release', why: 'For when there is time to let the longer exhale properly do its work — after a genuinely hard stretch, not a passing annoyance.' },
          { minutes: 20, rounds: 120, name: 'Extended Release', why: 'A full session, for when calm needs to last — not just reset you for the next ten minutes.' },
        ],
      },
      {
        key: 'triangle',
        name: 'Triangular Breathing',
        level: 'Intermediate',
        safetyTier: 'green',
        /* Operator, 24 september 2026: `explain` se tweede zin verwees naar
           Box Breathing ("A quicker cousin of..."), dat de gebruiker hier
           nooit per se al zag — standalone gemaakt. `moments` (zie
           `effect` hieronder) draagt sindsdien de "wanneer"-voorbeelden als
           korte, brede labels i.p.v. een scenario-zin in de lopende
           tekst. */
        explain:
          'Four in, four held, four out — three equal sides, no second hold.',
        effect: 'One pause, enough to interrupt racing thoughts without much fuss.',
        bestFor: 'Structured calming',
        changes: 'Equal parts, one hold.',
        moments: ['Before high-stakes moments', 'When thoughts start to race', 'Between one demand and the next'],
        phases: [inhale(4, 'Nose'), hold(4, 'hold-in'), exhale(4, 'Nose')],
        durations: [
          { minutes: 3, rounds: 15, name: 'Quick Reset', why: 'For when tension needs to come off fast, with no time to sit down properly.' },
          { minutes: 5, rounds: 25, name: 'Daily Grounding', why: 'The everyday length — enough to settle before a difficult moment, without taking much time.', recommended: true },
          { minutes: 10, rounds: 50, name: 'Deep Release', why: 'For when there is time to let the rhythm properly take over, not just take the edge off.' },
          /* Operator, 9 september 2026: capte hier eerst ook op 10 min,
             samen met Box — maar Triangle heeft maar ÉÉN hold (Box heeft
             er twee) en dus niet hetzelfde CO2-opbouw-bezwaar bij lange
             sessies. Uitgebreid tot 20 min, gelijk aan Extended Exhale
             (dezelfde staat, ook zonder herhaalde adem-holds). */
          { minutes: 20, rounds: 100, name: 'Extended Release', why: 'A full session. This rhythm has only one hold, so there is little added strain from going the distance.' },
        ],
      },
      {
        key: 'box',
        name: 'Box Breathing',
        level: 'Advanced',
        safetyTier: 'green',
        safetyNote:
          'The two holds make this one to skip if breath-holding makes you uneasy — Extended Exhale or Triangle cover the same ground without them.',
        explain:
          'Four equal parts: in, hold, out, hold. Popularized as tactical breathing in military training; used by people who need to stay sharp under pressure.',
        effect: 'The most grounding of the three — two pauses give an overstimulated mind something solid to hold onto.',
        bestFor: 'Structured composure',
        changes: 'Four equal phases. One clear rhythm.',
        moments: ['Before important moments', 'Under real pressure', 'Before a critical decision'],
        phases: [
          inhale(4, 'Nose'),
          hold(4, 'hold-in'),
          exhale(4, 'Nose'),
          hold(4, 'hold-out'),
        ],
        /* Operator, 9 september 2026: bewust NIET uitgebreid naar 20 min,
           anders dan Triangle/Extended Exhale hierboven — Box heeft TWEE
           holds per cyclus, en herhaald lang vasthouden bouwt CO2 op
           (mentaal vermoeiend, geen fysiologisch probleem bij de gezonde
           gebruiker maar wel een reëel comfort-plafond). 10 min blijft
           hier het advies; wie langer wil, kan Triangle of Extended
           Exhale kiezen — beide dekken hetzelfde kalmerende doel zonder
           herhaalde holds. */
        durations: [
          { minutes: 3, rounds: 11, name: 'Quick Reset', why: 'Enough rounds to let the rhythm take hold before you step into pressure.' },
          { minutes: 5, rounds: 19, name: 'Daily Grounding', why: 'Two pauses, steadying without wasting time — the everyday length.', recommended: true },
          { minutes: 10, rounds: 38, name: 'Deep Release', why: 'For real time to let it work. Past the halfway mark, the counting tends to fade into the background.' },
        ],
      },
    ],
    durations: [
      { minutes: 5, rounds: 30, name: 'Daily Grounding', why: 'The one to reach for most days — enough to settle in, brief enough that you will keep coming back to it.', recommended: true },
      { minutes: 10, rounds: 60, name: 'Deep Release', why: 'For when there is time to let the longer exhale properly do its work — after a genuinely hard stretch, not a passing annoyance.' },
      { minutes: 20, rounds: 120, name: 'Extended Release', why: 'A full session, for when calm needs to last — not just reset you for the next ten minutes.' },
    ],
    defaultDuration: 0,
  },

  /* ── CLARITY ────────────────────────────────────────────────────────
     Een gelijke, een verdiepte lange-uitademing, en Physiological Sigh —
     het best onderbouwde protocol van de vijftien (Stanford, Cell Reports
     Medicine 2023), bewust kort gehouden zoals het onderzoek het deed. */
  clarity: {
    key: 'clarity',
    /* Operator, 22 september 2026 ("clarity - relax, kan dat als we de
       ademhalingstechnieken beoordelen"): Deep Extended Exhale (4 in/8
       uit, 1:2-verhouding) en Physiological Sigh zijn fysiologisch echte
       ontspanningstechnieken (verlengde uitademing activeert de
       parasympathische respons), niet enkel mentaal opruimen — de naam
       draagt dat nu ook uit. */
    eyebrow: 'CLARITY & RELAX',
    title: 'Crystal',
    tagline: 'Order from complexity.',
    subtitle: 'Clear & Relax',
    description:
      'Clear the mind and relax the body. Organize thoughts, ease tension, and settle into calm clarity.',
    need: 'Space before what comes next.',
    /* Operator 2 augustus 2026: CLARITY is WIT, niet cyaan. Het kristal is
       kleurloos; een ijsblauwe naam ernaast maakte er een zesde kleur van
       die nergens in het beeld zit. */
    accent: '#FFFFFF',
    accentSoft: 'rgba(255,255,255,0.13)',
    glow: '#6E86AB',
    gradient: ['#2F4059', '#7A93B6', '#CBD9EA'],
    art: 'clarity',
    focusY: 0.5,
    artScale: 0.7,
    phases: [inhale(4, 'Nose'), exhale(4, 'Nose')],
    techniques: [
      {
        key: 'equal',
        name: 'Equal Breathing',
        level: 'Beginner',
        safetyTier: 'green',
        explain:
          'Four seconds in, four seconds out — a calm, even middle ground between a slower focus pace and a brisker energizing one.',
        effect: 'A balanced middle ground — neither rushed nor slow, the everyday mental reset.',
        bestFor: 'Neutral reset',
        changes: 'Even, balanced breathing.',
        moments: ['In the gap between demands', 'Switching mindsets cleanly', 'Clearing mental clutter'],
        phases: [inhale(4, 'Nose'), exhale(4, 'Nose')],
        durations: [
          { minutes: 5, rounds: 38, name: 'Equilibrium', why: 'A clean, brief border between two different parts of the day — work and home, one task and the next.', recommended: true },
          { minutes: 10, rounds: 75, name: 'Total Alignment', why: 'When a decision or a plan needs more room to think than a short pause can give it.' },
          { minutes: 15, rounds: 113, name: 'Extended Reflection', why: 'The full block, for when there is real space to think a complex thing through.' },
        ],
      },
      {
        key: 'deep-extended-exhale',
        name: 'Deep Extended Exhale',
        level: 'Intermediate',
        safetyTier: 'green',
        explain:
          'Four in, eight out — twice as long out as in, and no pause. A deeper version of extended-exhale breathing.',
        effect: 'A longer exhale gives circling thoughts room to untangle and settle.',
        bestFor: 'Untangling thoughts',
        changes: 'Exhale twice as long as the inhale.',
        moments: ['When your mind feels stuck in loops', 'Before making a decision', 'Quieting an overactive mind'],
        phases: [inhale(4, 'Nose'), exhale(8, 'Mouth')],
        durations: [
          { minutes: 3, rounds: 15, name: 'Center Check', why: 'A brief pause to clear the deck before choosing what to pick up next.' },
          { minutes: 5, rounds: 25, name: 'Equilibrium', why: 'The everyday length. A longer exhale than inhale is what lets mental noise settle instead of circling.', recommended: true },
          { minutes: 10, rounds: 50, name: 'Extended Reflection', why: 'For when there is time to let the longer exhale properly take over — before a decision that has been sitting unresolved.' },
        ],
      },
      {
        key: 'physiological-sigh',
        name: 'Physiological Sigh',
        level: 'Advanced',
        safetyTier: 'green',
        explain:
          'Two inhales through the nose — one full, one short and quick on top — followed by one long, slow exhale through the mouth. Studied as a short daily practice, not a long session; the timing here is a VIBEZCORE default within the range researchers used, not an exact prescription.',
        effect: 'A fast, well-studied reset, most effective in short, daily doses.',
        bestFor: 'Rapid reset',
        changes: 'Two inhales. One long exhale.',
        moments: ['Right after bad news', 'Between back-to-back demands', 'Clearing mental overload, fast'],
        phases: [inhale(2, 'Nose'), inhale2(1, 'Nose'), exhale(6, 'Mouth')],
        durations: [
          { minutes: 1, rounds: 7, name: 'Quick Reset', why: 'A brief version — proof that a short window is enough to feel the shift.' },
          { minutes: 3, rounds: 20, name: 'Center Check', why: 'Enough cycles to feel the pattern settle before you move on.' },
          { minutes: 5, rounds: 33, name: 'Equilibrium', why: 'The dose used in the original Stanford study — five minutes a day.', recommended: true, researchProtocol: true },
        ],
      },
    ],
    durations: [
      { minutes: 5, rounds: 38, name: 'Equilibrium', why: 'A clean, brief border between two different parts of the day — work and home, one task and the next.', recommended: true },
      { minutes: 10, rounds: 75, name: 'Total Alignment', why: 'When a decision or a plan needs more room to think than a short pause can give it.' },
      { minutes: 15, rounds: 113, name: 'Extended Reflection', why: 'The full block, for when there is real space to think a complex thing through.' },
    ],
    defaultDuration: 0,
  },

  /* ── REST ───────────────────────────────────────────────────────────
     Slow Breathing als rustige standaard, 4-7-8 met Weils eigen
     opbouwschema (NIET het "1/3/5 min" uit de eerste V1-opgave — dat zou
     bij dit tempo 3 en 5 minuten allebei ruim over Weils eigen grens van
     acht cycli per sessie duwen; rondes blijven daarom leidend, zoals
     hierboven bij `DurationDef.cycles` al stond uitgelegd), en een
     mildere lange-uitademing variant. */
  rest: {
    key: 'rest',
    /* Operator, 22 september 2026 ("Rest & Reset wordt Sleep, dat is voor
       gebruiker duidelijker"): was "REST & RESET". */
    eyebrow: 'SLEEP',
    title: 'Tree of Life',
    tagline: 'Nothing to think about.',
    /* Operator, 22 september 2026 (vervolg op de eyebrow-rename): subtitle
       + description noemden nog expliciet "recovery" naast "restful
       sleep" — exact het woord dat ook de Recovery-GOAL draagt ("Recover
       & relax"), en precies het misverstand dat de rename net moest
       oplossen. Nu puur over slapen, geen ander doel meer genoemd. */
    subtitle: 'Deep Rest',
    description: 'Wind down completely. Prepare body and mind for deep, restful sleep.',
    need: 'From active to ready for rest.',
    /* Operator, 11 september 2026: "groen te neon-achtig, wat is een
       moderne groen" — dit was zelf al een getemperde vervanging (8
       augustus 2026) van een nog fellere lime (#8FD94A), maar bleef
       binnen dezelfde limoen-achtige geel-groene familie. Toen een
       overstap naar een gedempt salie-/smaragdgroen.
       Operator, 14 september 2026: "te oudbollig" — het salie zelf bleek
       te gedempt/gebroken (leest als khaki, niet als merkkleur). Toen een
       helderder, strakker jade-smaragd (#20B486).
       Operator, 16 september 2026: "het groen is echt lelijk, gebruik
       het groen van WhatsApp" — vierde en (voorlopig) laatste wissel,
       naar het herkenbare WhatsApp-groen (#25D366). Zelfde groenfamilie/
       rol als voorheen, enkel de exacte tint.
       Operator, 5 oktober 2026: "maak van dat groen ons groen — het
       accentgroen van VIBEZCORE" — Bio-Teal (#00A3A3, theme.ts
       AudioAccent), met het lichte merk-teal (#4AF0D4) als oplichtend
       uiteinde van de gradient. */
    accent: '#00A3A3',
    accentSoft: 'rgba(0,163,163,0.15)',
    glow: '#006B6B',
    gradient: ['#006B6B', '#00A3A3', '#4AF0D4'],
    artScale: 0.7,
    art: 'tree',
    focusY: 0.5,
    /* State-level fallback, houdt gelijke tred met Slow Breathing (de
       standaardtechniek) hieronder, zie de toelichting daar. */
    phases: [inhale(5, 'Nose'), exhale(10, 'Nose')],
    techniques: [
      {
        key: 'slow',
        /* Operator, 24 september 2026 ("nu staat daar 2x slow"): was 'Slow
           Breathing' — botste met 'Slow Extended Exhale' hieronder, extra
           verwarrend nu dit ritme zelf ook een 1:2-verlengde-uitademing is.
           Naar '1:2 Breathing': accuraat (letterlijk de ratio), duidelijk
           onderscheiden, en herkenbare vaktaal zoals '4-7-8 Breathing'/
           'Box Breathing' elders al in de app. */
        name: '1:2 Breathing',
        level: 'Beginner',
        safetyTier: 'green',
        /* Operator, 24 september 2026 (2e ronde, "1 sec verschil lijkt
           verzonnen"): 5/6 (eerste fix) stond te dicht op deze staat se
           eigen Slow Extended Exhale (5/7) — een toevallig ogend verschil
           van 1 seconde. Nu een echte, herkenbare 1:2 inademen:uitademen-
           ratio (5/10) — bevestigd via onderzoek als een erkend protocol
           (o.a. gebruikt in biofeedback-apparaten bij trage ademhaling),
           niet een kleine nudge om uniek te lijken. 15s cyclus = 4
           ademhalingen/min, duidelijk dieper/trager dan zowel Focus's
           Coherent (5/5) als deze staat se eigen Slow Extended Exhale
           (5/7) — een reële, niet-toevallige afstand tot beide. */
        explain:
          'Five seconds in, ten seconds out — a full 1:2 ratio, twice as long out as in, with no holds, offered here for winding down.',
        effect: 'A deep, unhurried exhale that eases you out of the day and into stillness.',
        bestFor: 'Bedtime transition',
        changes: 'Exhale twice as long as the inhale. No holds.',
        moments: ['After a demanding, fast-paced day', 'Making the switch out of "doing" mode', 'The last thing before you close your eyes'],
        phases: [inhale(5, 'Nose'), exhale(10, 'Nose')],
        /* Rondes herberekend voor de nieuwe 15s-cyclus (5+10). */
        durations: [
          /* Zelfde micro-sessie-fix als bij Calm/Focus — hier voor een
             snelle overgang naar rust, niet enkel de volle avondroutine. */
          { minutes: 3, rounds: 12, name: 'Bedtime Shift', why: 'A short, effective wind-down for when time is short but a racing mind still needs settling.' },
          { minutes: 5, rounds: 20, name: 'Pulse Down', why: 'A gentle landing when you are already on the edge of sleep.' },
          { minutes: 10, rounds: 40, name: 'Deep Wind-Down', why: 'The evening standard — so unhurried you will stop counting somewhere along the way.', recommended: true },
          { minutes: 20, rounds: 80, name: 'Sleep Wind-Down', why: 'For a night with no early alarm, when a full, unhurried wind-down is the priority.' },
        ],
      },
      {
        key: '478',
        name: '4-7-8 Breathing',
        level: 'Intermediate',
        safetyTier: 'amber',
        safetyNote:
          'Start with four cycles for at least the first month, as originally taught by Dr. Andrew Weil — more than that too soon is the most common reason people feel light-headed.',
        explain:
          'Four in, seven held, eight out — the longest hold of any VIBEZCORE rhythm. Begin with four cycles; build toward eight only after weeks of practice.',
        effect: 'A wind-down ritual, one of the best-known ways to ease into sleep.',
        bestFor: 'Structured wind-down',
        changes: 'A held breath, timed and counted.',
        moments: ['After a stretch of stress or overthinking', 'When your mind will not stop planning in the dark', 'Before an early start'],
        phases: [inhale(4, 'Nose'), hold(7, 'hold-in'), exhale(8, 'Mouth')],
        durations: [
          { minutes: 1, cycles: 4, rounds: 4, name: 'Starter', why: 'Four cycles — the safe entry point, meant to be practiced regularly.', recommended: true },
          { minutes: 3, cycles: 8, rounds: 8, name: 'Practised', why: 'Eight cycles — build up to this over about a month, not sooner.' },
        ],
      },
      {
        key: 'slow-extended-exhale',
        name: 'Slow Extended Exhale',
        level: 'Advanced',
        safetyTier: 'green',
        explain:
          /* Operator, 10 september 2026: "at a slower overall pace" was
             feitelijk fout — deze cyclus (5+7=12s) en Clarity's Deep
             Extended Exhale (4+8=12s) zijn EXACT even lang, dus zelfde
             tempo. Het echte verschil is de verhouding (5:7 i.p.v. 4:8),
             niet de snelheid. Gecorrigeerd.
             Operator, 24 september 2026 ("niet vergelijkend, gebuiker heeft
             de andere staat mogelijk nooit gezien"): stond nog vergeleken
             met "Clarity offers" — een andere STAAT, nog onwaarschijnlijker
             dat de gebruiker dat al zag dan een andere techniek binnen
             dezelfde staat. Standalone gemaakt. */
          'Five in, seven out — a long, slow exhale with a small gap between in and out, built for winding all the way down.',
        effect: 'A long, gentle exhale rhythm, built for winding all the way down.',
        bestFor: 'Deep wind-down',
        changes: 'A long, slower-paced exhale.',
        moments: ['When tomorrow keeps creeping in', 'Guarding the line between thinking and resting', 'The last, conscious act of letting go'],
        phases: [inhale(5, 'Nose'), exhale(7, 'Nose')],
        durations: [
          { minutes: 5, rounds: 25, name: 'Pulse Down', why: 'A quick, comforting transition when fatigue is setting in and you want to drift off soon.' },
          { minutes: 10, rounds: 50, name: 'Deep Wind-Down', why: 'The evening length, for the nights the day will not quite let go.', recommended: true },
          { minutes: 20, rounds: 100, name: 'Sleep Wind-Down', why: 'For full wind-down, when the goal is letting go completely.' },
        ],
      },
    ],
    /* State-level fallback — zelfde herberekening als Slow Breathing
       hierboven (15s-cyclus, 1:2 ratio). */
    durations: [
      { minutes: 5, rounds: 20, name: 'Pulse Down', why: 'A gentle landing when you are already on the edge of sleep.' },
      { minutes: 10, rounds: 40, name: 'Deep Wind-Down', why: 'The evening standard — so unhurried you will stop counting somewhere along the way.', recommended: true },
      { minutes: 20, rounds: 80, name: 'Sleep Wind-Down', why: 'For a night with no early alarm, when a full, unhurried wind-down is the priority.' },
    ],
    defaultDuration: 1,
  },
};

/* De drie helpers vragen niet langer een hele TOESTAND maar alleen iets met
   fasen. Zowel een BreathState als een TechniqueDef voldoet daaraan, dus
   bestaande aanroepen blijven werken én een scherm kan er een gekozen ritme
   in stoppen. Dat scheelt vijf plekken waar anders een tweede versie van
   dezelfde functie zou ontstaan. */
type HasPhases = { phases: PhaseDef[] };

export const cycleSeconds = (x: HasPhases) =>
  x.phases.reduce((s, p) => s + p.secs, 0);

/* Het patroon in seconden, AFGELEID uit de fases: "4-2-6".
   Stond het in de naam, dan waren er weer twee bronnen voor hetzelfde — en
   dat is precies wat er op 7 augustus 2026 misging bij het losse veld
   `technique`. Een naam die een getal bevat, kan verouderen; dit niet. */
export const patternOf = (x: HasPhases) => x.phases.map((f) => f.secs).join('-');

/** Naam plus patroon, zoals je het buiten het keuzevak leest.
 *  Draagt de naam het patroon al ("4-7-8 Breathing"), dan niet nog een keer. */
export const techLabel = (t: TechniqueDef) => {
  const p = patternOf(t);
  return t.name.includes(p) ? t.name : `${t.name} ${p}`;
};

/** De ritmes van een toestand op één regel.
 *
 *  Heten ze allemaal hetzelfde — bij BOOST zijn het allebei Equal Breathing —
 *  dan staat de naam één keer en volgen de patronen. Anders volledig. Zonder
 *  die uitzondering las BOOST als "Equal Breathing 2-2 · Equal Breathing 3-3",
 *  en dat is twee keer hetzelfde woord om één verschil te tonen. */
export const rhythmLine = (techniques: TechniqueDef[]) => {
  const names = techniques.map((t) => t.name);
  return names.every((n) => n === names[0])
    ? [names[0], ...techniques.map(patternOf)].join(' · ')
    : techniques.map(techLabel).join(' · ');
};

export const phaseAt = (x: HasPhases, k: PhaseKey) =>
  x.phases.find((p) => p.key === k) ?? x.phases[0];

export const nextPhase = (x: HasPhases, k: PhaseKey) => {
  const i = x.phases.findIndex((p) => p.key === k);
  return x.phases[(i + 1) % x.phases.length];
};

/** Hoeveel rondes er in een gekozen aantal minuten passen.
 *
 *  BEREKEND en niet meer per toestand met de hand ingevuld. Dat kon toen elke
 *  toestand één ritme had; nu een toestand er meerdere draagt, zou elk
 *  vastgezet getal bij het tweede ritme fout staan — twintig minuten van een
 *  cyclus van tien seconden is nu eenmaal een ander aantal rondes dan van een
 *  cyclus van zestien.
 *
 *  Minstens één ronde, want een sessie van nul rondes is geen sessie. */
export const roundsFor = (x: HasPhases, minutes: number) =>
  Math.max(1, Math.round((minutes * 60) / cycleSeconds(x)));
