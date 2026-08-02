/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — De vijf ademtoestanden

   Alles wat per toestand verschilt staat HIER, en niets ervan in het
   sessiescherm. Dat scherm kent zijn eigen inhoud niet; het krijgt een
   sleutel mee en tekent wat hier staat. Zo kost een zesde toestand een
   blok gegevens en geen tweede scherm.

   Namen, teksten en kleuren zijn van de operator (1 augustus 2026).
   "Crystal Grid" verving "Hexagonal Grid" — dat laatste klonk als een
   wiskundeterm en niet als een toestand.

   ── Beslist door de operator, 2 augustus 2026 ────────────────────────
   FOCUS en CLARITY stonden in de opgave met hun adempatroon geruild. Het
   principe moet kloppen, dus ze staan hier zoals de Breath-tab het al doet:
   FOCUS krijgt 5-5 en CLARITY krijgt 4-2-6.

   Waarom die kant op: 5-5 is coherent ademen, zes ademhalingen per minuut —
   gelijk en ritmisch, precies wat de eigen beschrijving van FOCUS zegt
   ("a precise and balanced rhythm"). 4-2-6 heeft een langere uitademing en
   laat ruis zakken; dat is wat CLARITY moet doen.

   ── Kleur per toestand, operator 2 augustus 2026 ─────────────────────
   De kleur volgt de ILLUSTRATIE, niet andersom. Twee liepen daarop achter:
   CLARITY stond ijsblauw terwijl het kristal kleurloos is (nu wit), en REST
   stond indigo van de bol die er niet meer is (nu groen, als de boom).

   Rondes zijn leidend, minuten zijn het label: alleen waar de cycluslengte
   in zestig past vallen die samen. Daarom staat de exacte tijd altijd naast
   de keuze in beeld.

   ── Modusnamen gelijkgetrokken, 2 augustus 2026 ──────────────────────
   De keuzepagina noemde twee toestanden anders dan het sessiescherm:
   CALM tegenover Calm Control, REST tegenover Rest & Reset. Dezelfde
   modus onder twee namen is geen nuance maar een fout. De namen uit de
   mockup van de operator zijn nu de enige: BOOST · FOCUS · CALM CONTROL ·
   CLARITY · REST & RESET, hier in `eyebrow`, en beide schermen lezen die.

   Kleur hoort óók bij de modus en staat daarom hier: `accent` en
   `gradient` sturen zowel de keuzepagina als de knop als het sessiescherm.
   De bracelet houdt zijn eigen tabel (CLAUDE.md §5) — dat is hardware en
   een ander product; ademen kleurt naar de illustratie.
   ───────────────────────────────────────────────────────────────────────── */

import type { SessionArtKey } from '@/components/SessionArt';

export type BreathStateKey = 'boost' | 'focus' | 'calm' | 'clarity' | 'rest';

export type PhaseKey = 'inhale' | 'hold-in' | 'exhale' | 'hold-out';

export type PhaseDef = {
  key: PhaseKey;
  label: string;
  secs: number;
  /** Waar de lucht langs gaat. `null` tijdens vasthouden. */
  via: 'Nose' | 'Mouth' | null;
  /** Trillingsduur, gelijk aan (tabs)/breath.tsx. */
  vib: number;
};

export type DurationDef = {
  minutes: number;
  rounds: number;
  name: string;
  why: string;
  recommended?: boolean;
};

export type BreathState = {
  key: BreathStateKey;
  /** De naam van de MODUS, in hoofdletters. Staat boven de titel op het
   *  sessiescherm en is de kop op de keuzepagina — één naam, twee plekken. */
  eyebrow: string;
  /** De naam van het figuur — dit is de kop van het scherm. */
  title: string;
  tagline: string;
  /** Korte naam onder de miniatuur, uit de mockup van de operator. Niet
   *  altijd de figuurnaam: alleen BOOST heet daar hetzelfde. */
  subtitle: string;
  /** Wat de toestand doet, in twee zinnen. Operator-copy, 2 augustus 2026 —
   *  woord voor woord zoals aangeleverd. Staat op de keuzepagina. */
  description: string;
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
  technique: string;
  durations: DurationDef[];
  /** Welke duur standaard geselecteerd is. */
  defaultDuration: number;
};

/* Fasen komen vaak terug; deze helpers houden de tabel leesbaar. */
const inhale = (secs: number, via: 'Nose' | 'Mouth'): PhaseDef => ({
  key: 'inhale',
  label: 'INHALE',
  secs,
  via,
  vib: 60,
});
const exhale = (secs: number, via: 'Nose' | 'Mouth'): PhaseDef => ({
  key: 'exhale',
  label: 'EXHALE',
  secs,
  via,
  vib: 80,
});
const hold = (secs: number, which: 'hold-in' | 'hold-out'): PhaseDef => ({
  key: which,
  label: 'HOLD',
  secs,
  via: null,
  vib: 30,
});

export const BREATH_STATES: Record<BreathStateKey, BreathState> = {
  /* ── BOOST ──────────────────────────────────────────────────────────
     Vijftien ademhalingen per minuut, sneller dan rusttempo. Dit is de
     enige toestand waar langer NIET beter is: snel ademen verlaagt het
     CO₂-gehalte, en dat geeft tintelingen en lichte duizeligheid. Daarom
     geen twintig minuten, en een echte waarschuwing bij tien. */
  boost: {
    key: 'boost',
    eyebrow: 'BOOST',
    title: 'Radiating Sun',
    tagline: 'Energy moves outward.',
    subtitle: 'Radiating Sun',
    description:
      'Activate energy. Increase intensity, motivation and physical drive.',
    accent: '#F5A524',
    accentSoft: 'rgba(245,165,36,0.15)',
    glow: '#C8760A',
    gradient: ['#B8720A', '#F5A524', '#FFD98A'],
    art: 'sun',
    focusY: 0.5,
    artScale: 1,
    phases: [inhale(2, 'Nose'), exhale(2, 'Mouth')],
    technique: 'Energizing breath · 2-2',
    durations: [
      {
        minutes: 3,
        rounds: 45,
        name: 'Quick Boost',
        why: 'Short and sharp. Enough to shake off sluggishness before something demanding.',
      },
      {
        minutes: 5,
        rounds: 75,
        name: 'Standard Boost',
        why: 'The longest we suggest at this pace, and the one to pick if you are unsure.',
        recommended: true,
      },
      {
        minutes: 10,
        rounds: 150,
        name: 'Maximum',
        why: 'Breathing this fast for this long often brings on light-headedness or tingling in the hands. Stop early if it does. This is the one length in the app where longer is not better.',
      },
    ],
    defaultDuration: 1,
  },

  /* ── FOCUS ──────────────────────────────────────────────────────────
     Coherent ademen: vijf in, vijf uit, zes ademhalingen per minuut. Gelijk
     en ritmisch — dit is het best onderzochte langzame ademtempo, en het
     enige waarbij een verwijzing naar onderzoek stand houdt. */
  focus: {
    key: 'focus',
    eyebrow: 'FOCUS',
    title: 'Flower of Life',
    tagline: 'Perfect order.',
    subtitle: 'Clarity Mind',
    description:
      'Sharpen attention. Improve concentration and reduce distractions.',
    accent: '#3E9BFF',
    accentSoft: 'rgba(62,155,255,0.15)',
    glow: '#0B4FBF',
    gradient: ['#1554B8', '#3E9BFF', '#A9D3FF'],
    art: 'flower',
    focusY: 0.5,
    artScale: 0.72,
    phases: [inhale(5, 'Nose'), exhale(5, 'Nose')],
    technique: 'Coherent breathing · 5-5',
    durations: [
      {
        minutes: 3,
        rounds: 18,
        name: 'Quick Reset',
        why: 'Between tasks, or after an interruption pulled you out of something.',
      },
      {
        minutes: 5,
        rounds: 30,
        name: 'Daily Focus',
        why: 'The everyday length, at six breaths per minute — the pace slow-breathing research keeps coming back to. Before a work block or a meeting.',
        recommended: true,
      },
      {
        minutes: 10,
        rounds: 60,
        name: 'Deep Focus',
        why: 'For longer stretches of concentration, when there is a real block of work ahead.',
      },
      {
        minutes: 20,
        rounds: 120,
        name: 'Extended Focus',
        why: 'A full session. There is no evidence that longer works better — this is simply the far end of the range used in studies of slow breathing.',
      },
    ],
    defaultDuration: 1,
  },

  /* ── CALM ───────────────────────────────────────────────────────────
     Box breathing. Zestien seconden per cyclus, en zestien past niet in
     zestig — daarom landt alleen twintig minuten precies op een heel getal
     en worden de andere 2:56, 5:04 en 10:08. */
  calm: {
    key: 'calm',
    eyebrow: 'CALM CONTROL',
    title: 'Lotus',
    tagline: 'Stillness in motion.',
    subtitle: 'Balance & Composure',
    description:
      'Reduce stress. Restore balance, composure and emotional control.',
    accent: '#B478FF',
    accentSoft: 'rgba(180,120,255,0.15)',
    glow: '#7B2FE0',
    gradient: ['#8B3DF0', '#B478FF', '#D0A2FF'],
    art: 'lotus',
    focusY: 0.43,
    artScale: 1.14,
    phases: [
      inhale(4, 'Nose'),
      hold(4, 'hold-in'),
      exhale(4, 'Nose'),
      hold(4, 'hold-out'),
    ],
    technique: 'Box Breathing · 4-4-4-4',
    durations: [
      {
        minutes: 3,
        rounds: 11,
        name: 'Quick Calm',
        why: 'For when tension needs to come off and there is no time to sit down for it. Eleven rounds is enough to notice the rhythm take over.',
      },
      {
        minutes: 5,
        rounds: 19,
        name: 'Daily Calm',
        why: 'The everyday length. Long enough to settle into, short enough that you keep coming back to it — which matters more than any single session.',
        recommended: true,
      },
      {
        minutes: 10,
        rounds: 38,
        name: 'Deep Calm',
        why: 'For when there is time. Somewhere past the halfway mark the counting stops being something you follow and starts running by itself.',
      },
      {
        minutes: 20,
        rounds: 75,
        name: 'Extended Calm',
        why: 'A full session, and the length most often used in studies of slow paced breathing. There is no evidence that longer is better — this is simply the far end of the range.',
      },
    ],
    defaultDuration: 1,
  },

  /* ── CLARITY ────────────────────────────────────────────────────────
     Langer uit dan in, met een korte pauze ertussen. Die langere uitademing
     is wat mentale ruis laat zakken in plaats van laten rondcirkelen. */
  clarity: {
    key: 'clarity',
    eyebrow: 'CLARITY',
    title: 'Crystal',
    tagline: 'Order from complexity.',
    subtitle: 'Clear Mind',
    description:
      'Clear the mind. Organize thoughts and improve mental clarity.',
    /* Operator 2 augustus 2026: CLARITY is WIT, niet cyaan. Het kristal is
       kleurloos; een ijsblauwe naam ernaast maakte er een zesde kleur van
       die nergens in het beeld zit.
       Het verloop blijft wél getint staal: dat verloop draagt de knop van
       het sessiescherm, en daar staat witte tekst op. Wit op wit is geen
       knop meer. De naam, de rand en de omtrek zijn het wit. */
    accent: '#FFFFFF',
    accentSoft: 'rgba(255,255,255,0.13)',
    glow: '#6E86AB',
    gradient: ['#2F4059', '#7A93B6', '#CBD9EA'],
    art: 'clarity',
    focusY: 0.5,
    artScale: 0.7,
    phases: [inhale(4, 'Nose'), hold(2, 'hold-in'), exhale(6, 'Mouth')],
    technique: 'Long exhale · 4-2-6',
    durations: [
      {
        minutes: 3,
        rounds: 15,
        name: 'Mental Reset',
        why: 'A brief pause to clear the deck before you pick the next thing up.',
      },
      {
        minutes: 5,
        rounds: 25,
        name: 'Daily Clarity',
        why: 'The everyday length. A longer exhale than inhale, which is what lets mental noise settle instead of circling.',
        recommended: true,
      },
      {
        minutes: 10,
        rounds: 50,
        name: 'Deep Clarity',
        why: 'When thinking needs more room than a short pause can give it.',
      },
      {
        minutes: 20,
        rounds: 100,
        name: 'Extended Clarity',
        why: 'A full session. Long enough that the longer exhale stops being something you count and starts being how you breathe.',
      },
    ],
    defaultDuration: 1,
  },

  /* ── REST ───────────────────────────────────────────────────────────
     Uitademing langer dan de inademing, zonder vasthouden. Geen 4-7-8:
     die techniek is zwaar, en de bedenker ervan raadt beginners aan bij
     vier cycli te blijven — dat verdraagt geen sessie van twintig minuten. */
  rest: {
    key: 'rest',
    eyebrow: 'REST & RESET',
    /* Operator 2 augustus 2026: REST krijgt de Tree of Life, en daarmee ook
       die naam — "Soft Orb" hoorde bij een bol die er niet meer is. De kleur
       gaat mee: de boom is groen, dus de toestand is groen. Het indigo dat
       hier stond kwam nog van de bol. */
    title: 'Tree of Life',
    tagline: 'Nothing to think about.',
    subtitle: 'Restore & Replenish',
    description:
      'Restore deeply. Support recovery, relaxation and restful sleep.',
    accent: '#8FD94A',
    accentSoft: 'rgba(143,217,74,0.15)',
    glow: '#3B7A1C',
    gradient: ['#3F7D1F', '#8FD94A', '#D8F5A5'],
    /* 20% kleiner dan eerst (operator, 2 augustus 2026): 0.88 → 0.70. De
       boom is hoog en breed en vulde het beeldvak tot aan de rand, waar de
       andere vier lucht om zich heen hebben. */
    artScale: 0.7,
    art: 'tree',
    focusY: 0.5,
    phases: [inhale(4, 'Nose'), exhale(6, 'Mouth')],
    technique: 'Slow breathing · 4-6',
    durations: [
      {
        minutes: 5,
        rounds: 30,
        name: 'Wind Down',
        why: 'A short transition out of the day, for when you are nearly ready to sleep anyway.',
      },
      {
        minutes: 10,
        rounds: 60,
        name: 'Evening Rest',
        why: 'The evening length. Unhurried enough that you stop counting somewhere along the way.',
        recommended: true,
      },
      {
        minutes: 20,
        rounds: 120,
        name: 'Deep Rest',
        why: 'For when there is no reason to rush and no alarm to beat.',
      },
    ],
    defaultDuration: 1,
  },
};

export const cycleSeconds = (st: BreathState) =>
  st.phases.reduce((s, p) => s + p.secs, 0);

export const phaseAt = (st: BreathState, k: PhaseKey) =>
  st.phases.find((p) => p.key === k) ?? st.phases[0];

export const nextPhase = (st: BreathState, k: PhaseKey) => {
  const i = st.phases.findIndex((p) => p.key === k);
  return st.phases[(i + 1) % st.phases.length];
};
