/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Breath voice cues

   Lichte audio-cue service voor de breath-tab. Speelt korte voice-files
   af op fase-overgangen (Inhale / Hold / Exhale) en bij completion van
   een sessie.

   Architectuur:
     - Eén persistente AudioPlayer-instance per cue-URL, lazy-initialized
       bij eerste play. Cached zodat herhaalde plays niet steeds een
       nieuwe loader triggeren.
     - Geen native TTS — gebruikt expo-audio (al in dev-build, geen
       rebuild vereist). Audio assets liggen op Bunny CDN.
     - Voice-toggle via setVoiceEnabled(); wanneer disabled doen alle
       play-calls niets en wordt eventuele ongoing utterance gestopt.
     - Phase-cue kiest automatisch de juiste exhale-file op basis van
       pattern.exhaleVia ('nose' vs 'mouth').

   Iter 9dq v185 (operator 2026-06-18): Vervangt de expo-speech TTS-stub
   die een native rebuild vereiste. Pre-recorded audio (ElevenLabs) +
   expo-audio = werkt direct in de bestaande dev-build.
   ─────────────────────────────────────────────────────────────────── */

import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { assetUri } from '@/services/asset-cache';
import { getSetting } from '@/utils/settings';

/* ── Asset URLs op Bunny CDN ───────────────────────────────────────── */

const CDN_BASE = 'https://vibezcore-audio.b-cdn.net/Breathwork%20audio';

/** Breath-cue URLs. Generieke files zeggen 'through your X' (oudere ElevenLabs
 *  takes); Boost-specifieke files zeggen verkort 'through X' (zonder 'your')
 *  matchend met de UI tekst. Dit is Kylie's stem (in de UI "Eli") — de stem
 *  die al vóór 11 september 2026 in productie stond, dus de DEFAULT (zie
 *  `voiceGender` default in `utils/settings.ts`: 'female', zodat bestaande
 *  gebruikers bij het invoeren van deze toggle niets merken).
 *
 *  Iter v170 (2026-06-28): Boost-cues toegevoegd. Operator nam 2 nieuwe MP3's
 *  op voor de korte vorm. Andere modes (focus, calm, clarity, rest) blijven
 *  op de oudere "your nose/mouth" cues totdat operator nieuwe opnames
 *  beschikbaar heeft.
 *
 *  Operator, 11 september 2026: de 5 nieuwe techniek-gat-cues (Alternate
 *  Nostril × 4, Physiological Sigh's "Extra inhale") kwamen óók van Kylie
 *  — zie `urlForPhase()` verderop voor hoe die per fase gekozen worden. */
const FEMALE_CUE_URLS = {
  inhaleNose:        `${CDN_BASE}/Inhale%20through%20your%20nose..mp3`,
  hold:              `${CDN_BASE}/Hold.mp3`,
  exhaleNose:        `${CDN_BASE}/Exhale%20through%20your%20nose..mp3`,
  exhaleMouth:       `${CDN_BASE}/Exhale%20through%20your%20mouth..mp3`,
  /* Iter v170: Boost-specifieke takes — korte vorm matcht UI 'through nose/mouth'.
     Operator, 21 september 2026: `boostExhaleMouth` wordt niet meer
     afgespeeld (alle 3 Boost-technieken zijn neus-uit, zie
     `resolveCueUris()`/`urlForPhase()`) — URL blijft staan, geen actieve
     asset weggegooid, mocht een toekomstige Boost-variant hem alsnog nodig
     hebben. */
  boostInhaleNose:   `${CDN_BASE}/Boost_%20inhale%20through%20nose.mp3`,
  boostExhaleMouth:  `${CDN_BASE}/Boost%20exhale%20through%20mouth.mp3`,
  /* Alternate Nostril Breathing — operator, 11 september 2026 (technique-
     gat, zie project-breath-voice-gaps-pending memory). Kylie's takes. */
  inhaleLeftNostril:  `${CDN_BASE}/Kylie%20Inhale%20left%20nostril.mp3`,
  inhaleRightNostril: `${CDN_BASE}/Kylie%20Inhale%20right%20nostril.mp3`,
  exhaleLeftNostril:  `${CDN_BASE}/Kylie%20Exhale%20left%20nostril.mp3`,
  exhaleRightNostril: `${CDN_BASE}/Kylie%20Exhale%20right%20nostril.mp3`,
  /* Physiological Sigh's tweede, korte "topping-off"-inademing. */
  extraInhale:        `${CDN_BASE}/Kylie%20Extra%20inhale.mp3`,
} as const;
/* Operator, 11 september 2026: vervangen door de "Darth Vader"-uitleg,
   zelfde tekst en reden als Marius/Benjamin's versie hieronder — Kylie/Eli
   loopt hiermee gelijk, geen inconsistentie meer tussen de twee stemmen.
   Definitieve take (2e ronde): bevat nu BEIDE zinnen in één opname — de
   Darth Vader-vergelijking + de "like a soft whisper"-regel, zie de
   toelichting bij `MALE_UJJAYI_START_URL` hieronder. */
const FEMALE_UJJAYI_START_URL = `${CDN_BASE}/Kylie%20Dart%20Vader%20(1).mp3`;
const FEMALE_ENJOY_SESSION_URL = `${CDN_BASE}/Kylie%20Enjoy%20your%20session%20fem.mp3`;

/** Marius (man, UI-naam "Benjamin") — VOLLEDIGE heropname van de basisset
 *  + alle gat-cues + "Enjoy your session", aangeleverd 11 september 2026.
 *  Mist zelf nog de 5 completion-cues (operator: "die tekst stuur ik u
 *  later, we zien wel" — zie project-breath-voice-gaps-pending memory),
 *  dus `activeCompletionUrl()` verderop blijft voor BEIDE geslachten de
 *  gedeelde, oudere `COMPLETION_URLS` gebruiken tot die er zijn. */
const MALE_CUE_URLS = {
  inhaleNose:         `${CDN_BASE}/Marius%20Inhale%20through%20your%20nose.mp3`,
  hold:               `${CDN_BASE}/Marius%20Hold%20male.mp3`,
  exhaleNose:         `${CDN_BASE}/Marius%20Exhale%20through%20your%20nose%20male.mp3`,
  exhaleMouth:        `${CDN_BASE}/Marius%20Exhale%20through%20your%20mouth%20male.mp3`,
  boostInhaleNose:    `${CDN_BASE}/Marius%20Boost%20%20inhale%20through%20nose.mp3`,
  boostExhaleMouth:   `${CDN_BASE}/Marius%20Boost%20exhale%20through%20mouth.mp3`,
  inhaleLeftNostril:  `${CDN_BASE}/Marius%20Inhale%20left%20nostril%20male.mp3`,
  inhaleRightNostril: `${CDN_BASE}/Marius%20Inhale%20right%20nostril%20male.mp3`,
  exhaleLeftNostril:  `${CDN_BASE}/Marius%20Exhale%20left%20nostril%20male.mp3`,
  exhaleRightNostril: `${CDN_BASE}/Marius%20Exhale%20right%20nostril%20male.mp3`,
  extraInhale:        `${CDN_BASE}/Marius%20Extra%20inhale%20male.mp3`,
} as const;
/* Operator, 11 september 2026: "Soft throat sound" vervangen door een
   echte, korte UITLEG van de keelklank, gekoppeld aan een tekst-popup VÓÓR
   de sessie start (zie de Ujjayi-introductie in `breath-session.tsx`)
   i.p.v. een enkel woordje tijdens de eerste fase.
   Definitieve take (2e ronde, operator: "sigh haaa zal niemand begrijpen,
   moet simpel en duidelijk"): "sigh 'haaa'" verving door de universeler
   herkenbare "like a soft whisper"-vergelijking. Bevat nu BEIDE zinnen in
   één opname: "Create a soft Darth Vader–like sound at the back of your
   throat as you breathe in and out. Slightly tighten the back of your
   throat — like a soft whisper." — exact de twee regels van de popup.
   Kylie/Eli heeft dezelfde tekst in haar eigen stem (zie
   `FEMALE_UJJAYI_START_URL` hierboven) — beide stemmen consistent. */
const MALE_UJJAYI_START_URL = `${CDN_BASE}/Marius%20Dart%20Vader%203.mp3`;
const MALE_ENJOY_SESSION_URL = `${CDN_BASE}/Marius%20Enjoy%20your%20session%20male.mp3`;

/** Beide sets dragen dezelfde 11 keys, met eigen (dus verschillende)
 *  letterlijke string-URL's — `typeof FEMALE_CUE_URLS` zou die twee sets
 *  onterecht incompatibel maken. Deze structurele vorm (elke key een
 *  gewone `string`) is wat `activeCueUrls()` hieronder teruggeeft. */
type CueUrlSet = Record<keyof typeof FEMALE_CUE_URLS, string>;

/** Operator, 11 september 2026: "moet niet weggestopt zitten, user moet
 *  keuze hebben om als default OF eenmalig te kiezen" — naast de globale
 *  Settings-instelling (`voiceGender`) kan het sessiescherm nu ook een
 *  TIJDELIJKE override zetten (zelfde "autostoel"-principe als de
 *  bestaande Voice AAN/UIT-knop: een sessie-stand die zwaarder weegt dan
 *  de opgeslagen stand, maar die stand zelf niet aanraakt tenzij de
 *  gebruiker expliciet "onthouden" kiest). `null` = geen override, val
 *  terug op de opgeslagen instelling. Gezet/gewist door
 *  `breath-session.tsx`, zie `setVoiceGenderOverride()`/
 *  `clearVoiceGenderOverride()` hieronder. */
let voiceGenderOverride: 'male' | 'female' | null = null;

export function setVoiceGenderOverride(gender: 'male' | 'female' | null): void {
  voiceGenderOverride = gender;
}

function activeGender(): 'male' | 'female' {
  return voiceGenderOverride ?? getSetting('voiceGender');
}

/** Welke van de twee sets actief is. Drie kleine resolvers i.p.v. één
 *  grote branch overal: elke aanroepplek hieronder leest precies wat hij
 *  nodig heeft. */
function activeCueUrls(): CueUrlSet {
  return activeGender() === 'male' ? MALE_CUE_URLS : FEMALE_CUE_URLS;
}
function activeUjjayiStartUrl(): string {
  return activeGender() === 'male'
    ? MALE_UJJAYI_START_URL
    : FEMALE_UJJAYI_START_URL;
}
function activeEnjoySessionUrl(): string {
  return activeGender() === 'male'
    ? MALE_ENJOY_SESSION_URL
    : FEMALE_ENJOY_SESSION_URL;
}

/** Vijf completion-files, één per protocol-key. Lange motiverende
 *  monoloog die de visuele completion-modal aanvult.
 *  Iter 9dq v186 (operator 2026-06-18): boost + focus finished
 *  vervangen door nieuwe takes (filename heeft trailing space).
 *  Operator, 11 september 2026: NOG NIET vervangen door Marius-takes — die
 *  tekst/opnames bestaan nog niet ("we zien wel", zie
 *  project-breath-voice-gaps-pending memory). Blijft dus voorlopig de
 *  oudere stem, enige inconsistentie tot die opnames er zijn. */
const COMPLETION_URLS: Record<BreathKey, string> = {
  boost:   `${CDN_BASE}/boost%20finished%20.mp3`,
  focus:   `${CDN_BASE}/focus%20finished%20.mp3`,
  calm:    `${CDN_BASE}/calm%20finished.mp3`,
  clarity: `${CDN_BASE}/clarity%20finished.mp3`,
  rest:    `${CDN_BASE}/rest%20finished.mp3`,
};


/** Alles wat deze dienst kan afspelen, als platte lijst — BEIDE stemmen,
 *  ongeacht welke nu actief staat (iemand kan de instelling later
 *  omzetten, en dan moeten ook die bestanden al offline klaarstaan).
 *  Bestaat zodat de offline-laag weet wat er binnengehaald moet worden — en
 *  zodat die lijst niet ergens anders met de hand wordt nagetypt en dan bij
 *  de volgende opname stilletjes achterloopt. */
export const VOICE_ASSET_URLS: string[] = [
  ...Object.values(FEMALE_CUE_URLS),
  FEMALE_UJJAYI_START_URL,
  FEMALE_ENJOY_SESSION_URL,
  ...Object.values(MALE_CUE_URLS),
  MALE_UJJAYI_START_URL,
  MALE_ENJOY_SESSION_URL,
  ...Object.values(COMPLETION_URLS),
];

export type BreathKey = 'boost' | 'focus' | 'calm' | 'clarity' | 'rest';
/* 'inhale-2'/'exhale-2' — operator, 8 september 2026 (V1-protocolset):
   nodig voor Physiological Sigh (twee inademingen vóór één uitademing) en
   Alternate Nostril Breathing (twee in- én twee uitademingen per cyclus).
   Aanvankelijk geen nieuwe opnames — hergebruikten het gewone inhale/
   exhale-bestand. Sinds de heropname (11 september 2026) hebben ze WEL
   hun eigen cue, zie `urlForPhase()` verderop. */
export type BreathPhase =
  | 'inhale'
  | 'inhale-2'
  | 'hold-in'
  | 'exhale'
  | 'exhale-2'
  | 'hold-out';
export type ExhaleVia = 'nose' | 'mouth';
/** Rijker dan `ExhaleVia` — matcht `PhaseDef['via']` uit `breath-states.ts`
 *  (bewust geen import daarvandaan: geen cross-domain koppeling nodig,
 *  de vier strings zijn stabiel genoeg om hier los te herhalen). Optioneel
 *  vijfde argument op `playBreathCue()`, zie daar. */
export type CueVia = 'Nose' | 'Mouth' | 'Left Nostril' | 'Right Nostril' | null;

/* ── State ─────────────────────────────────────────────────────────── */

let voiceEnabled = true;

/* Iter v170 (2026-06-28): voice-source ownership. Voorkomt dubbele cues
   wanneer breath-tab sessie loopt EN bracelet active sessie breathwork
   tegelijk activeert. Wie als laatste claimVoiceSource() aanroept "wint"
   en alleen die source's playBreathCue() doet daadwerkelijk geluid.
   Andere cues = silent no-op (geen interferentie). releaseVoiceSource()
   bij session-end zodat een latere solo-sessie weer kan claimen. */
export type VoiceSource = 'breath' | 'bracelet';
let activeVoiceSource: VoiceSource | null = null;

/* Cache: één AudioPlayer per unieke URL. Lazy-init bij eerste play.
   AudioPlayer-instances overleven over de tab-levensduur — geen overhead
   na de eerste warmup. */
const playerCache = new Map<string, AudioPlayer>();

/** Track de laatst gestarte player zodat we 'm kunnen pause'en wanneer
 *  een nieuwe cue start (anders stapelen overlappende cues). */
let activePlayer: AudioPlayer | null = null;

/* ── Public API ────────────────────────────────────────────────────── */

/** Voice cues aan/uit zetten. Bij uit-zetten stopt eventuele actieve cue. */
export function setVoiceEnabled(enabled: boolean): void {
  voiceEnabled = enabled;
  if (!enabled) stopVoice();
}

/** Iter v170 (2026-06-28): claim voice-ownership voor één source. Een
 *  tweede claim (bv. bracelet active start terwijl breath-tab nog speelt)
 *  vervangt de eerste — oude source's cues stoppen direct en latere
 *  playBreathCue() calls van die source worden no-op tot ze opnieuw claimen
 *  of de huidige sessie eindigt. */
export function claimVoiceSource(source: VoiceSource): void {
  if (activeVoiceSource !== null && activeVoiceSource !== source) {
    /* Onderbreking — stop huidige cue zodat oude source niet doorpoept. */
    stopVoice();
  }
  activeVoiceSource = source;
}

/** Iter v170: vrijgeven aan einde van een sessie of bij cleanup. */
export function releaseVoiceSource(source: VoiceSource): void {
  if (activeVoiceSource === source) {
    activeVoiceSource = null;
    stopVoice();
  }
}

/** Welke drie cue-URL's bij deze toestand/uitademweg horen — inhale, hold
 *  (gedeeld door hold-in en hold-out) en exhale. Puur data, geen afspelen:
 *  bestaat zodat er precies ÉÉN plek is die de URL-keuze kent. playBreathCue()
 *  hieronder gebruikt 'm voor de telefoon-UI; de native achtergrond-module
 *  (modules/breath-background) gebruikt 'm om dezelfde drie bestanden vooraf
 *  op te lossen via assetUri() en aan de sessie mee te geven — zie
 *  breath-session.tsx `start()`. Zonder deze extractie had de native module
 *  een eigen kopie van deze if/else nodig, en die twee lopen gegarandeerd
 *  een keer uit elkaar. */
export function resolveCueUris(
  key: BreathKey | undefined,
  exhaleVia: ExhaleVia,
): { inhale: string; hold: string; exhale: string } {
  const cues = activeCueUrls();
  const inhale = key === 'boost' ? cues.boostInhaleNose : cues.inhaleNose;
  const hold = cues.hold;
  /* Operator, 21 september 2026 ("audio en tekst komen niet overeen, denk
     dat fout al zeker bij boost zit"): bevestigd — alle 3 Boost-technieken
     in breath-states.ts zijn neus-in/neus-uit (`exhale(_, 'Nose')`), geen
     enkele mond-fase. Deze regel forceerde niettemin altijd
     `boostExhaleMouth` ("Boost exhale through mouth.mp3") voor Boost,
     ongeacht `exhaleVia` — een verouderde aanname (zie de oude comment,
     "Bhastrika-adapted, nose-in/mouth-out") die niet meer klopt met de
     huidige, geldende techniek-tekst. Tekst is leidend (operator: "bij
     fout moet audio aan juiste techniek aangepast worden") — er bestaat
     geen `boostExhaleNose`-opname, dus terugval op de gedeelde generieke
     `exhaleNose`-cue (dezelfde die elke andere neus-uitademing gebruikt),
     i.p.v. het speciale (foute) mond-bestand. */
  const exhale = exhaleVia === 'mouth' ? cues.exhaleMouth : cues.exhaleNose;
  return { inhale, hold, exhale };
}

/** Operator, 11 september 2026: per-fase cue-keuze die ook de rijkere
 *  `via` kent (Left/Right Nostril, niet enkel nose/mouth) — nodig sinds
 *  Alternate Nostril Breathing en Physiological Sigh hun EIGEN cues kregen
 *  i.p.v. het gewone inhale/exhale-bestand te hergebruiken. Los van
 *  `resolveCueUris()` hierboven qua VERANTWOORDELIJKHEID (die voedt ook de
 *  native achtergrond-voorbereiding in `breath-session.tsx` `start()` —
 *  een functie die te gevoelig getimed is om zomaar mee te breiden, zie de
 *  toelichting daar) — beide lezen inmiddels wel dezelfde `activeCueUrls()`,
 *  dus de man/vrouw-keuze werkt ook daar mee. Deze helper hier is puur voor
 *  de live, foreground per-fase cue tijdens playBreathCue() hieronder. */
function urlForPhase(phase: BreathPhase, via: CueVia, key?: BreathKey): string {
  const cues = activeCueUrls();
  if (phase === 'hold-in' || phase === 'hold-out') return cues.hold;
  if (phase === 'inhale') {
    if (via === 'Left Nostril') return cues.inhaleLeftNostril;
    return key === 'boost' ? cues.boostInhaleNose : cues.inhaleNose;
  }
  if (phase === 'inhale-2') {
    /* Alternate Nostril's tweede inademing (Right Nostril) vs
       Physiological Sigh's tweede, korte "topping-off"-inademing (Nose). */
    if (via === 'Right Nostril') return cues.inhaleRightNostril;
    return cues.extraInhale;
  }
  if (phase === 'exhale') {
    if (via === 'Right Nostril') return cues.exhaleRightNostril;
    /* Operator, 21 september 2026: zelfde fix als `resolveCueUris()`
       hierboven — geen `key === 'boost'` → `boostExhaleMouth`-kortsluiting
       meer, alle 3 Boost-technieken zijn neus-uit volgens breath-states.ts. */
    return via === 'Mouth' ? cues.exhaleMouth : cues.exhaleNose;
  }
  /* phase === 'exhale-2': enkel Alternate Nostril's slotstap (Left Nostril). */
  return cues.exhaleLeftNostril;
}

/** Speel de juiste cue voor een phase + protocol. Optionele `key` selecteert
 *  protocol-specifieke cues waar beschikbaar (iter v170: Boost heeft eigen
 *  korte takes; andere modes vallen terug op generieke cues).
 *
 *  GEEN tempo-aanpassing op de fase-duur (operator, 11 augustus 2026,
 *  terugdraai van een eerdere poging: "de stem moet niet vertragen en
 *  sloom worden maar op het juiste moment beginnen en een aangename
 *  normale ritme, anders klinkt het super irritant en saai"). Elke cue
 *  speelt op zijn natuurlijke tempo; wat WEL per fase-duur afgestemd hoort
 *  te zijn is het MOMENT waarop hij start — dat regelt CUE_LEAD_MS in
 *  breath-session.tsx (de cue begint een fractie vóór de overgang, zodat
 *  het eerste woord er precies op valt), niet de afspeelsnelheid.
 *
 *  Operator, 11 september 2026: optioneel 5e argument `via` — de rijkere
 *  `PhaseDef['via']` (Left/Right Nostril e.d.), gebruikt door
 *  `urlForPhase()` hierboven voor de nieuwe techniek-gat-cues. Achterwaarts
 *  compatibel: callers die 'm niet meegeven (bv. `breath-welcome.tsx`,
 *  `breath-sample.tsx`) vallen terug op het oude, ongewijzigde pad via
 *  `resolveCueUris()`. */
export function playBreathCue(
  phase: BreathPhase,
  exhaleVia: ExhaleVia,
  key?: BreathKey,
  source?: VoiceSource,
  via?: CueVia,
): void {
  /* Er is GEEN ontsnapping meer (3 augustus 2026). Hier zat een `force`-vlag
     waarmee een scherm langs de voorkeur van de gebruiker kon spelen. Die
     bestond omdat schermen een eigen stemknop hadden náást de instelling:
     twee waarheden, dus moest er één winnen, en dat werd steeds degene die
     geluid maakte.
     De knoppen ZIJN nu de instelling — op het sessiescherm, bij de bracelet
     en in de onboarding. Daarmee valt er niets meer te omzeilen, en zonder
     vlag kan niemand het per ongeluk opnieuw invoeren. */
  if (!voiceEnabled) return;
  /* Iter v170: silently no-op als er een andere source de voice claimt.
     Voorkomt dat breath-tab cues door bracelet active heen spelen of
     vice versa. Calls zonder source parameter blijven backwards-compat
     en spelen altijd af. */
  if (source && activeVoiceSource !== null && activeVoiceSource !== source) {
    return;
  }
  if (via !== undefined) {
    if (phase === 'inhale' || phase === 'inhale-2' || phase === 'exhale' || phase === 'exhale-2' || phase === 'hold-in' || phase === 'hold-out') {
      playUrl(urlForPhase(phase, via, key));
    }
    return;
  }
  const uris = resolveCueUris(key, exhaleVia);
  let url: string;
  if (phase === 'inhale' || phase === 'inhale-2') {
    url = uris.inhale;
  } else if (phase === 'hold-in' || phase === 'hold-out') {
    url = uris.hold;
  } else if (phase === 'exhale' || phase === 'exhale-2') {
    url = uris.exhale;
  } else return;
  playUrl(url);
}

/** Ujjayi Breathing's keelklank-herinnering — ÉÉN keer bij sessiestart,
 *  niet per fase (zou onnatuurlijk vaak herhalen). Los aan te roepen,
 *  niet via de per-fase `playBreathCue()`-route. Respecteert dezelfde
 *  `voiceEnabled`-instelling. */
export function playUjjayiStartCue(): void {
  if (!voiceEnabled) return;
  playUrl(activeUjjayiStartUrl());
}

/** De rustige intro-overlay vóór een sessie start ("Enjoy your session",
 *  zie `SessionIntro` op `breath-session.tsx`) — spreekt nu ook de tekst
 *  uit die er al stond. Respecteert dezelfde `voiceEnabled`-instelling. */
export function playEnjoySessionCue(): void {
  if (!voiceEnabled) return;
  playUrl(activeEnjoySessionUrl());
}

/** Speel het completion-bestand voor het juiste protocol.
 *
 *  TERUGGEDRAAID op 3 augustus 2026 (operator): dit was een "always-play"
 *  moment dat `voiceEnabled` bewust negeerde — de redenering was dat wie
 *  z'n sessie afmaakt z'n afsluiting verdient, ook met de stem uit. Dat
 *  klopt niet. Wie het geluid uitzet, of alleen via trillingen begeleid
 *  wordt (telefoon of bracelet), heeft dat niet gezegd over de ademcues
 *  maar over de APP. Onaangekondigd een minuut spraak starten aan het eind
 *  van een stille sessie is precies wat zo iemand niet wil — 's avonds,
 *  naast een slapende partner, of met de telefoon in gezelschap.
 *
 *  Stilte is de veilige stand, en er is geen uitzondering — zie
 *  playBreathCue hierboven. */
export function playCompletionCue(key: BreathKey): void {
  if (!voiceEnabled) return;
  const url = COMPLETION_URLS[key];
  if (!url) return;
  playUrl(url);
}

/** Maak de spelers alvast aan zonder te spelen.
 *
 *  Nodig op schermen waar één losse cue wordt afgespeeld i.p.v. een reeks.
 *  Een speler voor een REMOTE bestand moet eerst laden; `play()` op een
 *  speler die nog niets heeft ingeladen levert stilte op. In een sessie valt
 *  dat niet op — de tweede cue speelt wél, want dan is het bestand er. Bij
 *  één enkele tik hoor je gewoon niets.
 *
 *  Aanroepen bij het openen van zo'n scherm; daarna is de eerste tik hoorbaar. */
export function preloadBreathCues(): void {
  /* Operator, 25 september 2026 ("knop reageert traag, ~3 sec vertraging"):
     dit liep voorheen als ÉÉN synchrone lus over alle 11 bestanden —
     `createAudioPlayer()` is een native bridge-call, en 11 ervan
     achter elkaar zonder adempauze kon de JS-thread samen enkele seconden
     blokkeren, precies WANNEER dit scherm net verscheen. Het scherm zelf
     was allang gemount (bevestigd via logcat-tijdmeting), maar bevroor
     zichtbaar zolang deze lus de thread vasthield. Elke aanroep nu op zijn
     eigen macrotask (`setTimeout(...,0)`, oplopend), zodat de JS-thread
     tussen elke player door weer even ademt en het scherm interactief
     blijft. Geen enkele individuele wachttijd toegevoegd — enkel de reeks
     uit elkaar getrokken. */
  Object.values(activeCueUrls()).forEach((url, i) => {
    setTimeout(() => {
      try {
        const player = getOrCreatePlayer(url);
        /* Stil één keer aantikken zet het ophalen in gang. Of dat lukt is
           niet zeker — daarom leunt het afspelen zelf er ook niet op, dat
           probeert het gewoon een paar keer opnieuw. Dit scheelt alleen de
           eerste wachttijd wanneer het wél werkt. */
        /* Operator, 24 september 2026 ("voor de 5de keer, ronde 1 slaat nog
           steeds over" — na de cache-sleutel-fix hierboven, die het
           probleem verminderde maar niet oploste): DIT was de resterende
           oorzaak. Was 500ms geluidloos afspelen en dan METEEN pauzeren +
           `seekTo(0)`. Een remote mp3 is na 500ms op een gewoon netwerk
           zelden al volledig gebufferd — pauzeren (en al zeker
           terugspoelen) halverwege het laden kan de buffer van een
           streamende player resetten, waardoor de preload zichzelf
           ondermijnde vóór hij ooit klaar kon zijn. Geen pauze/terugspoel
           meer: gewoon stil laten doorspelen (volume 0) tot de echte
           sessie 'm nodig heeft — `playUrl()` doet dan zelf `seekTo(0)` +
           `play()`, tegen die tijd allang volledig gebufferd. */
        player.volume = 0;
        player.play();
      } catch {
        /* swallow — falen mag het scherm niet breken */
      }
    }, i * 40);
  });
}

/** Stop alle ongoing voice playback. Call bij session-cleanup,
 *  voice-toggle-off, of bij tab-unmount. */
export function stopVoice(): void {
  if (activePlayer) {
    try {
      activePlayer.pause();
      activePlayer.seekTo(0);
    } catch {
      /* swallow — pause op een al-niet-spelende player is harmless */
    }
    activePlayer = null;
  }
}

/* ── Internals ─────────────────────────────────────────────────────── */

/** Alle stembestanden lopen hierlangs, en dus ook langs de offline-laag:
 *  staat het bestand op het toestel, dan speelt dat en niet de CDN-versie.
 *  Eén plek, want elke cue komt hier voorbij.
 *
 *  Operator, 24 september 2026 ("nog altijd geen stem in ronde 1, ook na
 *  vroeger preloaden"): geroot-causet — de cache werd voorheen gesleuteld
 *  op `assetUri(remote)`, en DIE geeft niet altijd hetzelfde terug voor
 *  dezelfde cue. `offline-assets.ts` cachet alle stembestanden op de
 *  achtergrond (`VOICE_ASSET_URLS`); maakt die download een bestand
 *  lokaal beschikbaar TUSSEN het preloaden (`preloadBreathCues()`, nu op
 *  breath-setup.tsx) en de echte sessiestart in, dan levert `assetUri()`
 *  bij de sessiestart plots een ANDER pad (lokaal i.p.v. remote) dan waar
 *  de preload-player op stond — cache-miss, en er werd alsnog een verse,
 *  ongeladen player aangemaakt op precies het moment dat geluid nodig
 *  was. De preload had dus niets uitgehaald. Sleutel nu op `remote` (het
 *  STABIELE, nooit-veranderende invoerargument) i.p.v. op zijn resultaat
 *  — de player zelf wordt nog altijd via `assetUri()` aangemaakt (dus
 *  gebruikt gewoon het lokale bestand zodra dat er is), enkel de CACHE
 *  blijft daarna dezelfde player teruggeven voor dezelfde cue, ongeacht
 *  wat de offline-laag ondertussen deed. */
function getOrCreatePlayer(remote: string): AudioPlayer {
  let player = playerCache.get(remote);
  if (!player) {
    player = createAudioPlayer({ uri: assetUri(remote) });
    playerCache.set(remote, player);
  }
  return player;
}

/** Operator, 24 september 2026 (7de melding — nu bevestigd op het echte
 *  toestel via live logcat, niet langer een gok): `player.playing` staat
 *  bij een VERSE remote AudioPlayer al `true` vrijwel meteen na `play()`,
 *  ook wanneer er in werkelijkheid nog geen enkel geluid klinkt — die vlag
 *  zegt kennelijk "play() is aangeroepen", niet "er komt nu audio uit".
 *  Elke eerdere fix in dit bestand (preload-timing, cache-key, preemption)
 *  leunde daar blind op en loste dus niets structureels op. `currentTime`
 *  is de betrouwbare graadmeter: die blijft op 0 staan tot er ECHT audio
 *  gerenderd wordt, en loopt daarna op. */
function hasAudibleProgress(p: AudioPlayer): boolean {
  try {
    return p.currentTime > 0;
  } catch {
    return false;
  }
}

function playUrl(url: string): void {
  /* Stop een eventueel andere lopende cue zodat ze niet overlappen
     (overlappen = onverstaanbaar bij snel volgende phase-cues). Alleen
     onderbreken wat ECHT hoorbaar aan het spelen was (`hasAudibleProgress`,
     niet het onbetrouwbare `.playing`) — een player die nog stil aan het
     laden is heeft niets om te overlappen; die laten we gewoon op de
     achtergrond doorbufferen i.p.v. 'm te resetten vóór hij ooit klonk. */
  if (
    activePlayer &&
    activePlayer !== playerCache.get(url) &&
    hasAudibleProgress(activePlayer)
  ) {
    try {
      activePlayer.pause();
      activePlayer.seekTo(0);
    } catch {
      /* swallow — pause op een al-niet-spelende player is harmless */
    }
  }

  try {
    const player = getOrCreatePlayer(url);
    activePlayer = player;
    /* Operator, 24 september 2026 (vervolg op de preload-fix hierboven):
       `preloadBreathCues()` laat de player nu bewust op `volume = 0` staan
       (geen pauze/reset meer die de buffer kon verstoren) — dus MOET hier
       expliciet terug naar 1, anders speelt de eerste echte cue na een
       preload muted af. Nooit weggelaten worden bij een player die nog
       nooit gepreload werd (was daar al standaard 1), dus onschadelijk om
       dit altijd te zetten. */
    player.volume = 1;

    /* METEEN starten, en daarna een paar keer opnieuw proberen.

       Operator, 24 september 2026 (8ste melding, live logcat-bewijs):
       `player.seekTo(0)` is ASYNC (`Promise<void>`, zie ook audio-player.ts).
       Deze functie riep 'm eerder aan zonder te awaiten en las meteen
       daarna `currentTime` — op dat moment was de reset nog niet
       toegepast, dus `currentTime` gaf nog de OUDE, blijvende positie van
       de vorige keer dat deze (permanent gecachete) player gebruikt werd
       terug. `hasAudibleProgress()` zag die oude waarde en dacht "speelt
       al" — en sloeg `play()` voor deze nieuwe cue dan gewoon over. Fix:
       eerst de seek AFWACHTEN, pas daarna spelen en pas daarna vertrouwen
       op `currentTime`-metingen. */
    const attempt = async () => {
      if (activePlayer !== player) return;
      try {
        await player.seekTo(0);
      } catch {
        /* swallow */
      }
      if (activePlayer !== player) return;
      try {
        player.play();
      } catch {
        /* swallow */
      }
    };

    void attempt();

    /* Oplopende tussenpozen: snel genoeg om niet als vertraging te voelen,
       ruim genoeg om een trage verbinding op te vangen. Geen `seekTo(0)`
       meer hier (operator, 13 augustus 2026: "inhale through nose, en dan
       halverwege nog eens, en dan afgebroken" — een echte bug) — alleen
       `play()` opnieuw proberen als er tegen die tijd nog altijd geen
       hoorbare voortgang is. Bij deze latere metingen ligt de `seekTo(0)`
       van hierboven allang achter ons, dus is `currentTime` dan wél een
       verse, betrouwbare lezing. */
    for (const ms of [120, 300, 650, 1200, 2000]) {
      setTimeout(() => {
        if (activePlayer !== player) return;
        if (hasAudibleProgress(player)) return;
        try {
          player.play();
        } catch {
          /* swallow */
        }
      }, ms);
    }

    if (__DEV__) {
      console.log(
        '[breath-voice] play',
        url.split('/').pop(),
        'loaded=',
        player.isLoaded,
        'playing=',
        player.playing,
        'currentTime=',
        player.currentTime,
      );
    }
  } catch (e) {
    /* swallow — audio-failure mag de sessie niet breken */
    if (__DEV__) {
      console.warn(
        '[breath-voice] play FAILED:',
        e instanceof Error ? e.message : String(e),
      );
    }
  }
}
