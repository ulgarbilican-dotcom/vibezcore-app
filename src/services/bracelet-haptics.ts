/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — haptiek van de 5 modi op telefoon (en later smartwatch).

   Volledige onderbouwing + bronnen: docs/HAPTIC_RESEARCH_BASIS.md
   (§5–§6, §10). Kort:

   BOTTOM-UP MECHANISME: een pols-puls bereikt geen hersengolven (Pomper
   2023: 10 Hz tactiel → geen entrainment). Het zenuwstelsel leest een
   ritmische pols-tik als hartslag: TRAGER dan de eigen hartslag →
   parasympathisch/kalmer (Doppel 2017, Zhou 2020, Lee 2025), SNELLER →
   hartslag en arousal omhoog (Wang 2023, Valente 2024). De 5 modi zijn
   dus 5 eindtempo's op één arousal-as t.o.v. de hartslag.

   VERLOOP: 10 s de rust-hartslag van de gebruiker (R) — iso-principe,
   eerst aansluiten, dan leiden (Motokawa Study 2) — daarna glijden naar
   het eindtempo, en dat aanhouden. Hoe lang het glijden duurt volgt het
   bewijs per modus:
     - Grote daling (Clarity, Sleep): 120 s. Motokawa Study 1: een vast
       tempo meteen op 50 bpm was NIET significant, 2 min glijden wel.
       Korter is niet getest.
     - Calm Control (−20%): meteen. Doppel sprong zonder glijden naar −20%
       onder de hartslag, en dat werkte (RCT).
     - Focus, Boost: meteen. Valente/Wang gebruikten meteen een vast snel
       tempo; een stijgend verloop is nergens getest.
     (Eerder 30 s — een eigen tussenkeuze zonder bron, vervangen.)

   EINDTEMPO — "Match your rhythm" (operator, 7 okt 2026): een vast deel
   van R, zodat het kalme ritme altijd trager is dan het eigen hart.
   R komt uit services/resting-pulse.ts (meting / invoer / gemiddelde 70).
     Calm Control    80% van R, min 50   Doppel -20%, BoostMeUp 0,8 x HR
     Clarity & Relax 70% van R, min 45   Motokawa: dalen tot ~50 bpm
     Sleep           55% van R, min 40   Doppel's ondergrens 40 bpm
     Sharp Focus     90% van R, min 53   gelijkmatig, net onder rust -
                                         BoostMeUp: sneller dan rust gaf
                                         meer angst en slechtere scores
     Boost          110 bpm (vast)       Valente 2024: HR omhoog (pols)
   Bij R = 70: 56 / 49 / 40 / 63 / 110.

   PULSVORM: lub-dub (Doppel's "double heartbeat-like rhythm"), dub
   zachter. Lub→dub = 30% van de cyclus, max 350 ms (fysiologisch S1–S2).

   AFSPELEN — op Android gaat de HELE curve in één keer naar de systeem-
   trilmotor (modules/state-haptics), zodat het ritme doorloopt zonder
   JS-timers — die bevriest Android als het scherm op slot gaat (gemeten
   aug 2026, zie breath-background). Twee varianten:
     1. MET amplitude-sturing: vaste tikduur, sterkte via echte lage
        amplitudes (subtieler dan expo-haptics' zachtste 30/255).
     2. ZONDER (bv. Galaxy A16, gemeten 5 okt 2026: capabilities = [] —
        de hardware negeert elke sterkte): sterkte via de tikduur.
   Zonder native module (iOS/web): expo-haptics op JS-timers.

   PAUZE: hervatten binnen 2 min gaat verder waar de curve was (het
   lichaam is nog "meegenomen"); later hervatten begint opnieuw met de
   basislijn. 2 min = de geteste glijduur — productlogica, geen studie. */

import { BraceletMode } from './ble-contract';
import * as Haptics from 'expo-haptics';
import {
  canPlayNativeWaveform,
  getNativeSessionStatus,
  hasNativeWaveform,
  pauseNativeSession,
  playNativeWaveform,
  setNativeSessionSound,
  setNativeSessionHaptics,
  startNativeSession,
  stopNativeSession,
  stopNativeWaveform,
} from '../../modules/state-haptics';
import { getModeMeta } from './ble-contract';
import {
  onStateAck as onWearStateAck,
  pauseStateSessionOnWatch as pauseWearState,
  sendStateSessionToWatch as sendWearState,
  stopStateSessionOnWatch as stopWearState,
  isWatchReachable as isWearWatchReachable,
  keepLinkWarm as keepWearLinkWarm,
  wakeWatch as wakeWear,
} from '../../modules/wear-breath';
import {
  onStateAck as onAppleStateAck,
  pauseStateSessionOnWatch as pauseAppleState,
  sendStateSessionToWatch as sendAppleState,
  stopStateSessionOnWatch as stopAppleState,
} from '../../modules/watch-breath';

import { clearLiveStartPulse, getRestingPulse, getSessionStartBpm } from './resting-pulse';
import {
  HEARTBEAT_VOLUME,
  heartbeatDub,
  heartbeatLub,
  heartbeatSoundAllowed,
  startHeartbeatSound,
  stopHeartbeatSound,
} from './heartbeat-sound';
import {
  isSessionAudioAvailable,
  prepareHeartbeatSounds,
  startSessionBeats,
  stopSessionBeats,
  setSessionBeatHaptics,
  type BeatPlan,
} from '../../modules/session-audio';
import { getStateHear, getStateHearNow, subscribeStateHear } from './state-sound-pref';
import { isLibraryPlaying, subscribeLibraryPlaying } from './library-priority';
import { endLiveSession, showLiveSession } from '../../modules/live-activity';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { AppState, Platform } from 'react-native';
import { startSessionKeepAlive, stopSessionKeepAlive } from './session-keepalive';
import { getSetting, setSetting } from '@/utils/settings';
import {
  STATE_MS_FACTOR,
  WATCH_HAPTIC_LEVEL,
  getHapticStrength,
  subscribeHapticStrength,
  type HapticStrength,
} from './haptic-strength-pref';

/** Sterkte voor de curve die NU speelt. De onboarding-proef speelt altijd
 *  Strong (operator 19 okt 2026: te zacht), zonder de keuze van de
 *  gebruiker te wijzigen; al het andere volgt de instelling. */
let strengthOverride: HapticStrength | null = null;
const curStrength = (): HapticStrength => strengthOverride ?? getHapticStrength();


/* Feel & Hear zonder native service (iOS, oud Android): de app speelt het
   hartslaggeluid zelf op elke slag, zolang ze open is. */
let jsSoundOn = false;
/** Eindtimers van een herhalende voorproef-golfvorm (zie play()). */
const nativeEndTimers: ReturnType<typeof setTimeout>[] = [];
function clearNativeEndTimers(): void {
  nativeEndTimers.forEach(clearTimeout);
  nativeEndTimers.length = 0;
}

const SESSION_HOLD_SECONDS = 10;
/** Versnelde glijding in de voorproef voor de trage modi (Sleep, Clarity). */
const PREVIEW_RAMP_SECONDS = 12;
/** "Feel it" is een VOORPROEF, geen gratis sessie (operator, 5 okt 2026:
 *  "als de cyclus blijft draaien mag niet, anders is de sessie gratis").
 *  Operator, 5 okt 2026: 30 s, en binnen die 30 s moet elke modus op zijn
 *  eindtempo staan — 3 s basislijn, 12 s glijden, dan 15 s het echte
 *  eindritme, gevolgd door het eind-signaal. Het glijden is korter dan in
 *  een sessie (Sleep: 2 min); een voorproef toont waar de sessie heen gaat. */
export const PREVIEW_MAX_SECONDS = 30;

/** Curve van de voorproef (operator, 7 okt 2026: "kloppen de tempo's met de
 *  realiteit?"). Zelfde begin als een echte sessie (SESSION_HOLD_SECONDS op
 *  het basisritme). Modi die in een echte sessie binnen PREVIEW_RAMP_SECONDS
 *  hun eindtempo halen, glijden exact zoals in de sessie — de voorproef IS
 *  dan de eerste 30 s. Enkel de trage modi (Sleep, Clarity: 2 min) glijden
 *  versneld, en enkel daar zegt de UI dat (previewCondensedRampMinutes). */
function previewTiming(mode: BraceletMode): Timing {
  const ramp = SPECS[mode].rampSec;
  return { holdSec: SESSION_HOLD_SECONDS, rampSec: ramp <= PREVIEW_RAMP_SECONDS ? ramp : PREVIEW_RAMP_SECONDS };
}
const RESUME_WINDOW_SECONDS = 120;
const LUB_DUB_FRACTION = 0.3;
const LUB_DUB_MAX_MS = 350;
/** Met amplitude-sturing: vaste tikduur, sterkte via amplitude. */
const LUB_MS = 45;
/** Kracht (0–255) op telefoons MET amplitude-regeling, per sterkte — zelfde
 *  opbouw als het horloge (WATCH_HAPTIC_LEVEL), iets lager want een
 *  telefoonmotor is krachtiger dan een horlogemotor (20 okt 2026). */
const PHONE_AMP_LEVEL: Record<HapticStrength, number> = { soft: 120, medium: 175, strong: 255 };
const DUB_MS = 35;

const S = Haptics.ImpactFeedbackStyle;

type ModeHapticSpec = {
  /** Eindtempo als functie van de rusthartslag R (zie kop). */
  targetFor: (restingBpm: number) => number;
  rampSec: number;
  /** Native amplitude 0–255 (toestel MET amplitude-sturing). */
  lubAmp: number;
  dubAmp: number;
  /** Tikduur in ms (toestel ZONDER amplitude-sturing — daar bepaalt
   *  enkel de duur de sterkte). Niet onder ~25 ms: daaronder worden
   *  vibrotactiele pulsen vaak niet meer waargenomen. */
  lubMsNoAmp: number;
  dubMsNoAmp: number;
  /** Terugval-pad zonder native module (iOS/web): expo-haptics. */
  lubStyle: Haptics.ImpactFeedbackStyle;
  dubStyle: Haptics.ImpactFeedbackStyle;
};

/* iPhone (operator, 16 okt 2026, build 21: "haptics in Try 30 heel zacht"):
   lubStyle/dubStyle gelden enkel voor de expo-haptics-weg (iOS); Apple's
   "Soft" is nauwelijks voelbaar op de Taptic Engine. Elke toestand een
   trede sterker; de volgorde Sleep < Clarity/Calm < Focus < Boost blijft.
   Android (eigen golfvorm via amplitude/duur) verandert niet. */
const SPECS: Record<BraceletMode, ModeHapticSpec> = {
  /* NoAmp-duren: 5 okt 2026 eerst 26–30 ms → op de Galaxy A16 "bijna niet
     voelbaar" (operator). 50 ms (expo Soft) was voelbaar maar mocht
     subtieler → nu ertussen. */
  [BraceletMode.Delta]: { targetFor: (r) => Math.max(40, Math.round(r * 0.55)), rampSec: 120, lubAmp: 18, dubAmp: 13, lubMsNoAmp: 38, dubMsNoAmp: 30, lubStyle: S.Light, dubStyle: S.Soft },
  [BraceletMode.Theta]: { targetFor: (r) => Math.max(45, Math.round(r * 0.7)), rampSec: 120, lubAmp: 21, dubAmp: 15, lubMsNoAmp: 40, dubMsNoAmp: 32, lubStyle: S.Medium, dubStyle: S.Light },
  /* rampSec 10 = na de basislijn in 10 s naar het eindtempo (vol op 20 s).
     Doppel (−20%) en Valente/Wang (110 bpm) gingen meteen naar hun tempo;
     operator, 5 okt 2026: "geen abrupte overgang, er moet een flow zijn,
     op 20 s bij max". 10 s is vrijwel meteen — binnen het geteste gebied,
     enkel de schok eruit. */
  [BraceletMode.Alpha]: { targetFor: (r) => Math.max(50, Math.round(r * 0.8)), rampSec: 10, lubAmp: 24, dubAmp: 17, lubMsNoAmp: 42, dubMsNoAmp: 34, lubStyle: S.Medium, dubStyle: S.Light },
  [BraceletMode.Beta]: { targetFor: (r) => Math.max(53, Math.round(r * 0.9)), rampSec: 10, lubAmp: 45, dubAmp: 32, lubMsNoAmp: 50, dubMsNoAmp: 40, lubStyle: S.Heavy, dubStyle: S.Medium },
  [BraceletMode.Gamma]: { targetFor: () => 110, rampSec: 10, lubAmp: 65, dubAmp: 45, lubMsNoAmp: 60, dubMsNoAmp: 46, lubStyle: S.Rigid, dubStyle: S.Heavy },
};

/** Spec met de tempo's voor één concrete rusthartslag. */
type ResolvedSpec = ModeHapticSpec & { startBpm: number; targetBpm: number };

/** Bovenkant van de gangbare rusthartslag (volwassenen 60–80 bpm). */
const TARGET_BASE_CAP_BPM = 80;

/** Begin: de hartslag van nu als die net gemeten is, anders de rust-
 *  hartslag (resting-pulse.ts). Eind: altijd een deel van de RUST-
 *  hartslag — zo komt het kalme ritme altijd onder je rust uit. */
function resolveSpec(
  mode: BraceletMode,
  restingBpm: number = getRestingPulse().bpm,
  startBpm: number = getSessionStartBpm(),
): ResolvedSpec {
  const spec = SPECS[mode];
  /* Operator, 10 okt 2026 ("als iemand niet in rust zijn basis op 97 zet
     terwijl zijn echte rust 70 is, klopt het einde dan?"): het doel volgt
     je basis, maar nooit hoger dan bij een basis van 80 (bovenkant van de
     gangbare rust 60–80). Een te hoge basis start de sessie nog op je eigen
     ritme, maar eindigt toch rustgevend. Boost heeft een vast doel. */
  let targetBpm = Math.min(spec.targetFor(restingBpm), spec.targetFor(TARGET_BASE_CAP_BPM));
  /* De rustgevende toestanden eindigen ALTIJD onder je rusthartslag —
     ook bij een (zeer) lage rust, waar de ondergrenzen anders boven je
     eigen hart uitkwamen (operator, 7 okt 2026: "wat als 55?"). */
  if (mode !== BraceletMode.Gamma) targetBpm = Math.min(targetBpm, Math.max(40, restingBpm - 2));
  return { ...spec, startBpm, targetBpm };
}

/** Start- en eindtempo voor de UI (resultaat van "Match your rhythm"). */
export function rhythmFor(
  mode: BraceletMode,
  restingBpm: number,
  startBpm: number = restingBpm,
): { startBpm: number; targetBpm: number } {
  const r = resolveSpec(mode, restingBpm, startBpm);
  return { startBpm: r.startBpm, targetBpm: r.targetBpm };
}

type Timing = { holdSec: number; rampSec: number };

function bpmAt(spec: ResolvedSpec, elapsedSec: number, timing: Timing): number {
  if (elapsedSec < timing.holdSec) return spec.startBpm;
  const rampElapsed = elapsedSec - timing.holdSec;
  const progress = timing.rampSec <= 0 ? 1 : Math.min(1, rampElapsed / timing.rampSec);
  return spec.startBpm + (spec.targetBpm - spec.startBpm) * progress;
}

function beatAt(spec: ResolvedSpec, elapsedSec: number, timing: Timing) {
  const cycleMs = Math.round(60000 / bpmAt(spec, elapsedSec, timing));
  const dubAt = Math.round(Math.min(cycleMs * LUB_DUB_FRACTION, LUB_DUB_MAX_MS));
  return { cycleMs, dubAt };
}

/** De volledige curve vanaf `offsetSec` als één Android-waveform. Met
 *  `totalSec` eindig (sessie), zonder herhaalt de laatste tel eindeloos
 *  (preview, stopt bij het sluiten). */
function buildWaveform(
  spec: ResolvedSpec,
  timing: Timing,
  offsetSec: number,
  totalSec: number | undefined,
  amplitudeControl: boolean,
) {
  const timings: number[] = [];
  const amplitudes: number[] = [];
  const curveEnd = timing.holdSec + timing.rampSec;
  let t = offsetSec;
  let repeat = -1;

  /* Sterkte (operator, 11 okt 2026): met amplitude-regeling de kracht,
     zonder de tikduur. */
  const st = curStrength();
  const msOf = (ms: number) => Math.round(ms * STATE_MS_FACTOR[st]);
  const lubMs = amplitudeControl ? LUB_MS : msOf(spec.lubMsNoAmp);
  const dubMs = amplitudeControl ? DUB_MS : msOf(spec.dubMsNoAmp);
  /* 20 okt 2026 (operator: "voor ELKE gebruiker correct, niet enkel mijn
     gsm"): de oude krachten (Sleep 18 … Boost 65 van 255, ×0,55–3) zijn
     nooit gevoeld — de A16 van de operator heeft geen amplitude-regeling en
     speelt altijd vol. Op telefoons MET regeling (Pixel, Galaxy S, …) is
     18/255 gedurende 45 ms voor veel trilmotoren onder de voelbare grens.
     Nu dezelfde opbouw als op het horloge, die op de pols wél gevoeld en
     goedgekeurd is: een voelbaar basisniveau per sterkte, de toestand
     schaalt binnen 85–100 % (Sleep zachter dan Boost), dub = 70 % van lub. */
  const modeScale = st === 'strong' ? 1 : 0.85 + 0.15 * Math.min(1, Math.max(0, (spec.lubAmp - 18) / (65 - 18)));
  const lubAmp = amplitudeControl ? Math.max(1, Math.min(255, Math.round(PHONE_AMP_LEVEL[st] * modeScale))) : 255;
  const dubAmp = amplitudeControl ? Math.max(1, Math.min(255, Math.round(lubAmp * 0.7))) : 255;
  const pushBeat = (cycleMs: number, dubAt: number) => {
    timings.push(lubMs, dubAt - lubMs, dubMs, cycleMs - dubAt - dubMs);
    amplitudes.push(lubAmp, 0, dubAmp, 0);
  };

  while (t < curveEnd && (totalSec === undefined || t - offsetSec < totalSec)) {
    const { cycleMs, dubAt } = beatAt(spec, t, timing);
    pushBeat(cycleMs, dubAt);
    t += cycleMs / 1000;
  }

  const steady = beatAt(spec, curveEnd, timing);
  if (totalSec === undefined) {
    repeat = timings.length;
    pushBeat(steady.cycleMs, steady.dubAt);
  } else {
    while (t - offsetSec < totalSec) {
      pushBeat(steady.cycleMs, steady.dubAt);
      t += steady.cycleMs / 1000;
    }
    /* Eind-signaal (operator, 5 okt 2026: "met haptics duidelijk dat het
       einde van de sessie is"): na een korte stilte drie tikken die
       sterker worden — duidelijk anders dan het hartslag-ritme, ook
       voelbaar met het scherm op slot. Geen geluid: bracelet-sessies lopen
       vaak tijdens vergaderingen (operator, juli 2026). */
    const strong = (amp: number) => (amplitudeControl ? amp : 255);
    timings.push(600, 70, 120, 90, 120, 160);
    amplitudes.push(0, strong(90), 0, strong(130), 0, strong(180));
  }
  return { timings, amplitudes, repeat };
}

/* ── Pols-klok voor het beeld ────────────────────────────────────────────
   De animatie (HapticPulseRings) verzint geen eigen tempo: ze krijgt een
   event per tik uit exact dezelfde curve en hetzelfde ankerpunt als de
   trilmotor — haptiek en beeld vanuit één bron. */

export type HapticPulse = {
  kind: 'lub' | 'dub';
  mode: BraceletMode;
  /** Duur van de huidige hartslagcyclus — het beeld schaalt zijn ring-
   *  beweging hierop: traag tempo = trage, brede ring. */
  cycleMs: number;
  /** Gepland slagmoment (wandklok, ms). 14 okt 2026 (operator: "de ring op
   *  de smartwatch gaat sneller t.o.v. de telefoon"): de JS-timer die dit
   *  event afvuurt liep tot ±150 ms naast de slag (logs [sync]); het beeld
   *  rekent daarom vanaf DIT moment, zoals het horloge (vaste klok). */
  atMs: number;
  /** Vooraankondiging van een KOMENDE lub (18 okt 2026, gemeten op de A16
   *  bij Boost: de motor liep tot op 4 ms op de geplande slag, maar het
   *  event kwam 10–160 ms te laat — de cirkel/golf misten dan hun begin en
   *  sprongen halverwege de slag in). Enkel voor de beelden die op `atMs`
   *  wachten (HeartbeatScale, drukgolf); losse ringen negeren dit. */
  ahead?: boolean;
};

type PulseListener = (pulse: HapticPulse) => void;
const pulseListeners = new Set<PulseListener>();

export function subscribeHapticPulse(listener: PulseListener): () => void {
  pulseListeners.add(listener);
  return () => {
    pulseListeners.delete(listener);
  };
}

/** Alleen het BEELD van een slag (ringen, kloppende cirkel) aansturen, zonder trilling of geluid — voor de uitleg-intro (src/app/intro.tsx), die de echte
    pulsgolf toont op het tempo van een toestand. */
export function emitVisualPulse(pulse: HapticPulse): void {
  emitPulse(pulse);
}

function emitPulse(pulse: HapticPulse): void {
  pulseListeners.forEach((l) => {
    try {
      l(pulse);
    } catch {
      /* een kapotte luisteraar mag de haptiek niet raken */
    }
  });
}

let generation = 0;
const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

function clearPending(): void {
  pendingTimeouts.forEach(clearTimeout);
  pendingTimeouts.length = 0;
  /* iPhone: ook de slagen die de geluidsmotor al vooraf gepland had. */
  if (Platform.OS === 'ios') {
    stopSessionBeats();
    releaseIosAudioIfIdle();
  }
}

/** Buiten een sessie (onboarding-proef, voorproef-einde) de geluidssessie
 *  teruggeven aan andere apps (19 okt 2026). */
function releaseIosAudioIfIdle(): void {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('./session-keepalive') as typeof import('./session-keepalive')).releaseSessionAudioIfIdle();
  } catch {}
}

/** Native pad: de motor speelt de curve zelf; dit loopt dezelfde tikken
 *  af (zelfde afgeronde cycleMs, zelfde startpunt) puur voor het beeld.
 *  Corrigeert zichzelf op de wandklok, zodat er geen drift opbouwt. */
/** Zoveel ms vooruit kiest de app het moment van de eerste slag van een
 *  sessie op Android; de trildienst speelt hem EXACT dan (20 okt 2026,
 *  operator: "voor elke gebruiker correct"). Vroeger een vaste 160 ms
 *  opstarttijd, gemeten op één A16 — andere telefoons starten sneller of
 *  trager. 300 ms dekt ook trage toestellen; beeld, geluid en horloge
 *  rekenen vanaf hetzelfde moment. */
const NATIVE_START_LEAD_MS = 300;
/** 28 okt 2026: gemeten handdruk PREPARE → READY duurt ~1,0 s (het grote bericht ~0,56 s over Bluetooth, het kleine GO daarna 0,03 s); de
 *  telefoon wacht daarom 1,5 s zodat GO altijd vóór het startmoment aankomt en beide op dezelfde slag beginnen.
 *  Met een horloge verbonden (27 okt 2026, operator: "het horloge begint iets later"): gemeten doet het startbericht er 190–740 ms over
 *  en het horloge heeft daarna nog ~110 ms nodig; met 300 ms miste het de eerste slag en begon het 0,86 s na de telefoon. Een
 *  afgesproken, ruimer startmoment laat telefoon en horloge op dezelfde slag beginnen. Zonder horloge blijft het 300 ms. */
const WATCH_START_LEAD_MS = 1500;
let wearWatchLinked = false;
function refreshWearWatchLink(): void {
  if (Platform.OS !== 'android') return;
  void isWearWatchReachable().then((ok) => { wearWatchLinked = ok; }).catch(() => { wearWatchLinked = false; });
}
refreshWearWatchLink();
setInterval(refreshWearWatchLink, 20_000);
AppState.addEventListener('change', (st) => { if (st === 'active') refreshWearWatchLink(); });
function nativeStartLeadMs(): number {
  return wearWatchLinked && getSetting('watchHaptics') ? WATCH_START_LEAD_MS : NATIVE_START_LEAD_MS;
}
/** Startmoment (wandklok) van de laatst gestarte curve op de telefoon —
 *  het horloge krijgt EXACT dit moment (17 okt 2026: het werd pas na het
 *  opbouwen van de golfvorm genoteerd, ~128 ms te laat → horloge ~150 ms
 *  achter in de voorproef, gemeten op de Watch4). */
let lastAnchorWallMs = 0;
/** Plek in de curve (s) op `lastAnchorWallMs` — samen één ankerpunt, zodat
 *  het horloge ook bij een latere relay (Smartwatch-schakelaar midden in de
 *  sessie) exact weet waar de telefoon zit (20 okt 2026). */
let lastAnchorCurveSec = 0;
/** Zoveel ms vóór een slag krijgen de beelden hem al aangekondigd. */
const PULSE_AHEAD_MS = 250;
let syncLogCount = 0;
function scheduleVisual(
  mode: BraceletMode,
  spec: ResolvedSpec,
  timing: Timing,
  anchorWallMs: number,
  offsetSec: number,
  curveSec: number,
  myGeneration: number,
  /** Einde van een eindige proef: geen slag meer aankondigen die de motor
   *  niet speelt (19 okt 2026). */
  endWallMs: number = Infinity,
): void {
  if (myGeneration !== generation) return;
  pendingTimeouts.length = 0;
  /* Na scherm-op-slot liep JS achter: spring stil naar de tik van NU in
     plaats van alle gemiste tikken als salvo te tonen. */
  let beat = beatAt(spec, curveSec, timing);
  while (anchorWallMs + (curveSec + beat.cycleMs / 1000 - offsetSec) * 1000 < Date.now()) {
    curveSec += beat.cycleMs / 1000;
    beat = beatAt(spec, curveSec, timing);
  }
  const { cycleMs, dubAt } = beat;
  const beatWallMs = anchorWallMs + (curveSec - offsetSec) * 1000;
  emitPulse({ kind: 'lub', mode, cycleMs, atMs: beatWallMs });
  /* Voorproef met Haptic + Audio: het hartslaggeluid op dezelfde klok als
     het beeld (een echte sessie speelt het geluid in de trildienst). */
  if (jsSoundOn && getStateHear()) heartbeatLub();
  /* Meting synchronisatie met het horloge (13 okt 2026, VZSync op het horloge). */
  if (__DEV__ && syncLogCount < 40) {
    syncLogCount += 1;
    console.log(`[sync] lub wall=${Math.round(beatWallMs)} curve=${curveSec.toFixed(3)}`);
  }
  const nextCurveSec = curveSec + cycleMs / 1000;
  const nextWallMs = anchorWallMs + (nextCurveSec - offsetSec) * 1000;
  const nextCycleMs = beatAt(spec, nextCurveSec, timing).cycleMs;
  pendingTimeouts.push(
    setTimeout(() => {
      if (myGeneration !== generation) return;
      emitPulse({ kind: 'dub', mode, cycleMs, atMs: beatWallMs + dubAt });
      if (jsSoundOn && getStateHear()) heartbeatDub();
    }, Math.max(0, beatWallMs + dubAt - Date.now())),
  );
  /* Volgt er nog een volledige slag? Anders niets meer aankondigen. */
  if (nextWallMs + cycleMs * 0.5 <= endWallMs) {
    pendingTimeouts.push(
      setTimeout(() => {
        if (myGeneration !== generation) return;
        emitPulse({ kind: 'lub', mode, cycleMs: nextCycleMs, atMs: nextWallMs, ahead: true });
      }, Math.max(0, nextWallMs - PULSE_AHEAD_MS - Date.now())),
      setTimeout(
        () => scheduleVisual(mode, spec, timing, anchorWallMs, offsetSec, nextCurveSec, myGeneration, endWallMs),
        Math.max(0, nextWallMs - Date.now()),
      ),
    );
  }
}

/* JS-weg (iOS / zonder eigen golfvorm): de stijl schuift één trede. */
const STYLE_LADDER = [S.Soft, S.Light, S.Medium, S.Heavy, S.Rigid];
function strengthStyle(style: Haptics.ImpactFeedbackStyle): Haptics.ImpactFeedbackStyle {
  const st = curStrength();
  /* Operator, 17 okt 2026 ("de hardste is nog altijd wat zacht — zet hard op
     max"): Strong = Apple's sterkste tik (Heavy) voor elke slag, in elke
     toestand. Soft en Medium blijven zoals ze waren. */
  if (st === 'strong') return S.Heavy;
  if (st === 'medium') return style;
  const i = STYLE_LADDER.indexOf(style);
  if (i < 0) return style;
  return STYLE_LADDER[Math.max(0, Math.min(STYLE_LADDER.length - 1, i - 1))];
}

function fire(style: Haptics.ImpactFeedbackStyle): void {
  /* iPhone op slot/achtergrond: iOS laat daar geen tikken toe — wat er toch
     doorsijpelt komt onregelmatig ("haptics haperen", build 26). Dan enkel
     geluid, zoals Apple het bedoelt. */
  if (Platform.OS === 'ios' && AppState.currentState !== 'active') return;
  Haptics.impactAsync(strengthStyle(style)).catch(() => {
    /* toestel/emulator zonder trilmotor mag niets breken */
  });
}

/* JS-weg (enkel nog zonder de iPhone-geluidsmotor, bv. een oudere build):
   elke slag op zijn vaste plek op de klok (vorige geplande slag + cycleMs);
   een late timer verschuift enkel die ene slag. Na een lange pauze van JS
   springen we stil naar de slag van nu. */
const BEAT_AHEAD_MS = 250;
/** De klank begint 10–14 ms ná de start van het bestand (piek 14–23 ms); de
 *  tik is meteen voelbaar. Het geluid start daarom zoveel vóór de tik, zodat
 *  beide samenvallen (gemeten op de bestanden, 18 okt 2026). De iPhone-
 *  geluidsmotor telt er zelf de uitvoervertraging van luidspreker/oortjes bij. */
const SOUND_LEAD_MS = 25;
/** iPhone: de eerste slag valt zoveel na de start, zodat de motor hem nog
 *  kan inplannen (hij plant ~1,5 s vooruit). */
const IOS_FIRST_BEAT_MS = 120;

/** Apple-tikstijl → Core Haptics-tik (sterkte, scherpte). Heavy = volle kracht. */
function tapFor(style: Haptics.ImpactFeedbackStyle): { intensity: number; sharpness: number } {
  switch (style) {
    case S.Soft:
      return { intensity: 0.5, sharpness: 0.15 };
    case S.Light:
      return { intensity: 0.6, sharpness: 0.45 };
    case S.Heavy:
      return { intensity: 1, sharpness: 0.4 };
    case S.Rigid:
      return { intensity: 1, sharpness: 0.85 };
    case S.Medium:
    default:
      return { intensity: 0.78, sharpness: 0.5 };
  }
}

function scheduleBeat(
  mode: BraceletMode,
  spec: ResolvedSpec,
  curveStartedAt: number,
  timing: Timing,
  myGeneration: number,
  plannedAt?: number,
): void {
  if (myGeneration !== generation) return;
  pendingTimeouts.length = 0;
  const now = Date.now();
  let at = plannedAt ?? now;
  let { cycleMs, dubAt } = beatAt(spec, (at - curveStartedAt) / 1000, timing);
  while (now - at > cycleMs) {
    at += cycleMs;
    ({ cycleMs, dubAt } = beatAt(spec, (at - curveStartedAt) / 1000, timing));
  }
  const nextAt = at + cycleMs;
  const hear = jsSoundOn && getStateHear();
  const fireLub = () => {
    if (myGeneration !== generation) return;
    fire(spec.lubStyle);
    if (hear) heartbeatLub();
    /* Beeld op het moment dat de tik echt viel. */
    emitPulse({ kind: 'lub', mode, cycleMs, atMs: Date.now() });
  };
  if (at - now > 2) pendingTimeouts.push(setTimeout(fireLub, at - now));
  else fireLub();
  pendingTimeouts.push(
    setTimeout(() => {
      if (myGeneration !== generation) return;
      fire(spec.dubStyle);
      if (jsSoundOn && getStateHear()) heartbeatDub();
      emitPulse({ kind: 'dub', mode, cycleMs, atMs: Date.now() });
    }, Math.max(0, at + dubAt - Date.now())),
  );
  pendingTimeouts.push(
    setTimeout(
      () => scheduleBeat(mode, spec, curveStartedAt, timing, myGeneration, nextAt),
      Math.max(0, nextAt - BEAT_AHEAD_MS - Date.now()),
    ),
  );
}

/** iPhone (19 okt 2026, operator: "hartslag moet stabiel klinken bij
 *  lockscreen … stop met lapmiddelen"): het HELE plan in één keer naar de
 *  geluidsmotor (modules/session-audio). Die plant elke slag zelf op de
 *  geluidsklok — ook met vergrendeld scherm — en tikt mee zolang de app in
 *  beeld is. Het beeld krijgt exact hetzelfde rooster (scheduleVisual).
 *  `silent` (het horloge trilt): enkel geluid, zoals op Android. */
function playIos(
  mode: BraceletMode,
  spec: ResolvedSpec,
  timing: Timing,
  offsetSec: number,
  totalSec: number | undefined,
  clock: SessionClock | undefined,
  silent: boolean,
  anchorWallMs?: number,
): void {
  /* Audio-voorrang (19 okt 2026): speelt de Audio Library, dan geen
     hartslaggeluid — haptiek en beeld lopen gewoon. */
  const withSound = !!clock && getStateHear() && heartbeatSoundAllowed() && !isLibraryPlaying();
  const firstAt = anchorWallMs ?? Date.now() + IOS_FIRST_BEAT_MS;
  lastAnchorWallMs = firstAt;
  lastAnchorCurveSec = offsetSec;
  const lub = tapFor(strengthStyle(spec.lubStyle));
  const dub = tapFor(strengthStyle(spec.dubStyle));
  const plan = {
    firstBeatAtMs: firstAt,
    firstCurveSec: offsetSec,
    startBpm: spec.startBpm,
    targetBpm: spec.targetBpm,
    holdSec: timing.holdSec,
    rampSec: timing.rampSec,
    endAtMs: totalSec !== undefined ? firstAt + totalSec * 1000 : 0,
    sound: withSound,
    speakerVolume: HEARTBEAT_VOLUME.speaker,
    headphonesVolume: HEARTBEAT_VOLUME.headphones,
    soundLeadMs: SOUND_LEAD_MS,
    haptics: !silent,
    lubIntensity: lub.intensity,
    lubSharpness: lub.sharpness,
    dubIntensity: dub.intensity,
    dubSharpness: dub.sharpness,
  };
  const myGeneration = generation;
  lastIosPlan = { plan, generation: myGeneration, clocked: !!clock };
  if (withSound) {
    /* Geluiden nog niet geladen: de motor start iets later, maar op
       hetzelfde rooster (hij slaat de slagen over die al voorbij zijn). */
    void prepareHeartbeatSounds().then(() => {
      if (myGeneration === generation) startSessionBeats(plan);
    });
  } else if (!silent) {
    startSessionBeats(plan);
  }
  scheduleVisual(
    mode, spec, timing, firstAt, offsetSec, offsetSec, generation,
    !clock && totalSec !== undefined ? firstAt + totalSec * 1000 : Infinity,
  );
}

/* iPhone: het laatst aan de geluidsmotor gegeven plan (19 okt 2026). De motor
   kent geen "geluid aan/uit" midden in een plan; hetzelfde plan opnieuw geven
   met een andere `sound` herrekent vanaf de eerste slag die nog moet komen,
   op hetzelfde rooster — geen sprong in ritme of beeld. */
let lastIosPlan: { plan: BeatPlan; generation: number; clocked: boolean } | null = null;

/** Audio-voorrang + Haptic/Haptic + Audio live (19 okt 2026, operator: "start
 *  je de Audio Library tijdens een sessie, dan zwijgt de hartslag; wisselen in
 *  Audio & Haptics werkt meteen"): het lopende iPhone-plan met de juiste
 *  geluidsstand opnieuw inplannen. Android regelt dit in de trildienst
 *  (state-sound-pref.ts), de JS-weg in heartbeat-sound.ts. */
function refreshIosBeatSound(): void {
  if (Platform.OS !== 'ios' || !lastIosPlan) return;
  const cur = lastIosPlan;
  if (cur.generation !== generation) return;
  if (cur.plan.endAtMs > 0 && Date.now() >= cur.plan.endAtMs) return;
  const want = cur.clocked && getStateHearNow() && heartbeatSoundAllowed();
  if (want === cur.plan.sound) return;
  const next: BeatPlan = { ...cur.plan, sound: want };
  lastIosPlan = { ...cur, plan: next };
  if (want) {
    void prepareHeartbeatSounds().then(() => {
      if (cur.generation === generation) startSessionBeats(next);
    });
  } else if (next.haptics) {
    startSessionBeats(next);
  } else {
    /* Het horloge trilt (stil plan): zonder geluid valt er niets te spelen. */
    stopSessionBeats();
  }
}
/** iPhone: het lopende plan zonder trilling verder (het horloge trilt) —
 *  zelfde rooster, de geluidsmotor plant vanaf de eerstvolgende slag
 *  (31 okt 2026, zie onWatchTookOver). */
function muteIosPlanHaptics(): boolean {
  const cur = lastIosPlan;
  if (!cur || cur.generation !== generation || !cur.clocked) return false;
  if (cur.plan.endAtMs > 0 && Date.now() >= cur.plan.endAtMs) return false;
  if (!cur.plan.haptics) return true;
  if (!setSessionBeatHaptics(false)) return false;
  lastIosPlan = { ...cur, plan: { ...cur.plan, haptics: false } };
  return true;
}
subscribeLibraryPlaying(() => refreshIosBeatSound());
subscribeStateHear(() => refreshIosBeatSound());

/* ── Gemeenschappelijk ───────────────────────────────────────────────── */

/** Draait de voorgrondservice (lopend, opstartend of gepauzeerd met
 *  melding)? De service zelf is de bron — geen JS-vlag die na een herlaad
 *  of een zelf-stop van de service achterloopt. */
export function isNativeSessionAlive(): boolean {
  return hasNativeWaveform() && getNativeSessionStatus() !== 'none';
}

function endNativeSession(): void {
  stopNativeSession();
}

/** `keepService`: de service krijgt meteen een nieuwe curve — niet eerst
 *  stoppen, anders verdwijnt de melding even van het vergrendelscherm. */
function silence(keepService = false): void {
  generation += 1;
  if (jsSoundOn) {
    jsSoundOn = false;
    stopHeartbeatSound('state-control');
  }
  clearPending();
  clearNativeEndTimers();
  stopNativeWaveform();
  if (!keepService) endNativeSession();
}

/** `preview`: gratis voorproef via dezelfde dienst (vergrendelscherm, door
 *  op slot), zonder "Session complete"-melding (17 okt 2026). */
type SessionClock = { elapsedSec: number; totalSec: number; preview?: boolean };

function play(
  mode: BraceletMode,
  timing: Timing,
  offsetSec: number,
  totalSec?: number,
  clock?: SessionClock,
  /** Het horloge speelt het ritme (6 okt 2026): de telefoon houdt sessie,
   *  timer en melding aan, maar trilt niet mee. */
  silent = false,
  restingBpm: number = getRestingPulse().bpm,
  startBpm: number = getSessionStartBpm(),
  strength?: HapticStrength,
  /** Exact startmoment (wandklok) van slag `offsetSec` — enkel voor de
   *  stille herstart als het horloge overneemt: dan valt het geluid op het
   *  rooster van het horloge i.p.v. op "nu + opstarttijd" (31 okt 2026). */
  anchor?: { wallMs: number },
): void {
  silence(!!clock && hasNativeWaveform());
  strengthOverride = strength ?? null;
  const spec = resolveSpec(mode, restingBpm, startBpm);
  syncLogCount = 0;
  if (hasNativeWaveform()) {
    const built = buildWaveform(spec, timing, offsetSec, totalSec, canPlayNativeWaveform());
    const { timings, repeat } = built;
    const amplitudes = silent ? built.amplitudes.map(() => 0) : built.amplitudes;
    /* Diagnose (flowtest 10 okt 2026): wat de trilmotor krijgt. */
    if (__DEV__) {
      const cyc = (i: number) => timings[i] + timings[i + 1] + timings[i + 2] + timings[i + 3];
      const beats = Math.floor((timings.length - (totalSec !== undefined ? 6 : 0)) / 4);
      const totalMs = timings.reduce((a, b) => a + b, 0);
      console.log(
        `[haptic-test] mode=${mode} resting=${restingBpm} start=${spec.startBpm} target=${spec.targetBpm} hold=${timing.holdSec}s ramp=${timing.rampSec}s offset=${offsetSec.toFixed(1)}s session=${totalSec ?? '-'}s beats=${beats} firstBpm=${(60000 / cyc(0)).toFixed(1)} lastBpm=${(60000 / cyc((beats - 1) * 4)).toFixed(1)} waveform=${(totalMs / 1000).toFixed(1)}s clock=${!!clock} silent=${silent}`,
      );
    }
    /* De trildienst begint ~0,15–0,18 s na deze aanroep (gemeten 13 okt
       2026, VibratorManagerService). Beeld én horloge rekenen vanaf het
       moment dat de eerste tik ECHT voelbaar is — zo vallen cirkel,
       trilling, geluid en pols samen (operator: "horloge loopt een fractie
       vooruit"). */
    const anchorWallMs = anchor ? anchor.wallMs : Date.now() + (clock ? nativeStartLeadMs() : 0);
    lastAnchorWallMs = anchorWallMs;
    lastAnchorCurveSec = offsetSec;
    if (clock) {
      /* Sessie: via de voorgrondservice, zodat het doorloopt op slot. Feel &
         Hear: de service speelt het hartslaggeluid zelf, op elke tik. */
      /* Ook als het horloge de trilling overneemt (silent): het geluid blijft
         hier (13 okt 2026, zie watchStrength). */
      /* Audio-voorrang (19 okt 2026): niet terwijl de Audio Library speelt;
         state-sound-pref.ts zet het weer aan zodra ze stopt. */
      setNativeSessionSound(getStateHearNow());
      startNativeSession(
        timings,
        amplitudes,
        clock?.preview ? `${getModeMeta(mode).name} · Free preview` : getModeMeta(mode).name,
        clock?.totalSec ?? totalSec,
        clock?.elapsedSec ?? 0,
        !!clock?.preview,
        anchorWallMs,
      );
    } else if (totalSec !== undefined) {
      /* Voorproef / proeven (operator, 16 okt 2026: "bij geluid luider zetten
         stopt de haptic"): een eindige golfvorm wordt op Android vervangen
         door elk systeemtikje (volumeknop, toetsenbord) en komt niet terug.
         Een HERHALENDE golfvorm laat Android niet onderbreken — dus spelen
         we de curve herhalend en stoppen we hem zelf na totalSec, met
         daarna hetzelfde eind-signaal. */
      const looped = buildWaveform(spec, timing, offsetSec, undefined, canPlayNativeWaveform());
      /* 19 okt 2026 (operator: de slag moet superconsistent zijn): stoppen
         midden in de rust na de laatste VOLLEDIGE slag (nooit een lub zonder
         dub), en native, dus niet afhankelijk van een JS-timer. Geen
         eind-signaal meer: de proef duurt maar enkele slagen, en iPhone
         heeft er ook geen. */
      const rest = looped.timings[looped.repeat + 3] ?? 0;
      const stopMs = Math.max(1, Math.round(totalSec * 1000 - rest / 2));
      playNativeWaveform(
        looped.timings,
        silent ? looped.amplitudes.map(() => 0) : looped.amplitudes,
        looped.repeat,
        stopMs,
      );
      if (!silent && getStateHear()) {
        jsSoundOn = true;
        startHeartbeatSound('state-control');
      }
      const myGeneration = generation;
      const endTimer = setTimeout(() => {
        if (myGeneration !== generation) return;
        stopNativeWaveform();
        if (jsSoundOn) {
          jsSoundOn = false;
          stopHeartbeatSound('state-control');
        }
      }, stopMs);
      nativeEndTimers.push(endTimer);
    } else {
      playNativeWaveform(timings, amplitudes, repeat);
    }
    scheduleVisual(
      mode, spec, timing, anchorWallMs, offsetSec, offsetSec, generation,
      !clock && totalSec !== undefined ? anchorWallMs + totalSec * 1000 : Infinity,
    );
  } else if (Platform.OS === 'ios' && isSessionAudioAvailable()) {
    playIos(mode, spec, timing, offsetSec, totalSec, clock, silent, anchor?.wallMs);
  } else if (!silent) {
    if (clock) {
      jsSoundOn = true;
      startHeartbeatSound('state-control');
    }
    scheduleBeat(mode, spec, Date.now() - offsetSec * 1000, timing, generation);
  }
}

/* Curve-positie volgt de WERKELIJK verstreken (actieve) sessietijd, niet
   het moment waarop een scherm mount — operator, 5 okt 2026: na weg- en
   terugnavigeren begon de curve opnieuw bij 75 bpm ("volledig fout
   ritme"). `curveZero` = de verstreken sessietijd waarop de curve begon
   (0 bij de start; verschuift enkel na een lange pauze, zie hieronder). */
/** `restingBpm` ligt vast vanaf de start: een nieuwe meting tijdens een
 *  lopende sessie verandert haar ritme niet halverwege. */
type SessionState = {
  mode: BraceletMode;
  curveZeroSec: number;
  pausedAt: number | null;
  restingBpm: number;
  startBpm: number;
};
let session: SessionState | null = null;
/** Wandklok-moment waarop de lopende sessie natuurlijk eindigt. */
let sessionEndsAt: number | null = null;

/** Echte sessie — aangeroepen door bracelet-session-monitor.ts bij start/
 *  hervatten, NIET door een scherm. `elapsedSec` = actieve sessietijd tot
 *  nu, `remainingSec` maakt de native curve eindig. Na een pauze langer dan
 *  2 min begint de curve opnieuw met de basislijn. */
export function playModeSessionHaptic(mode: BraceletMode, elapsedSec: number, remainingSec: number): void {
  /* Een lopende voorproef-weergave (iPhone) ruimt zichzelf op na 30 s, maar
     die opruiming slaat over zodra er intussen iets anders speelt (19 okt 2026).
     De Live Activity niet weghalen: die is nu van de sessie. */
  endIosPreviewKeepers();
  previewRun = null;
  const now = Date.now();
  if (!session || session.mode !== mode || elapsedSec < session.curveZeroSec) {
    session = {
      mode,
      curveZeroSec: elapsedSec,
      pausedAt: null,
      restingBpm: getRestingPulse().bpm,
      startBpm: getSessionStartBpm(),
    };
    /* Het startpunt van een meting geldt voor DEZE sessie; de volgende
       begint weer bij de rusthartslag (operator, 7 okt 2026). */
    clearLiveStartPulse();
  } else if (session.pausedAt !== null && now - session.pausedAt > RESUME_WINDOW_SECONDS * 1000) {
    session.curveZeroSec = elapsedSec;
    session.restingBpm = getRestingPulse().bpm;
    session.startBpm = getSessionStartBpm();
  }
  session.pausedAt = null;
  sessionEndsAt = now + remainingSec * 1000;
  lastClock = { mode, elapsedSec, remainingSec, at: now };
  /* Elke (her)start: eerst speelt de telefoon zelf, tot het horloge
     bevestigt dat het overneemt (`state-ack`, zie hieronder). Zo voel je
     altijd iets, ook als er geen horloge-app is. */
  watchHasRhythm = false;
  stopWatchdog();
  play(
    mode,
    { holdSec: SESSION_HOLD_SECONDS, rampSec: SPECS[mode].rampSec },
    Math.max(0, elapsedSec - session.curveZeroSec),
    remainingSec > 0 ? remainingSec : undefined,
    { elapsedSec, totalSec: elapsedSec + remainingSec },
    false,
    session.restingBpm,
    session.startBpm,
  );
  relayToWatch(
    mode,
    Math.max(0, elapsedSec - session.curveZeroSec),
    remainingSec,
    session.restingBpm,
    session.startBpm,
  );
}

/* ── Het ritme op de pols: smartwatch (6 okt 2026) ─────────────────────
   Operator: "de haptics van State Control zijn bedoeld om via de pols te
   gaan". De telefoon stuurt de parameters; het horloge berekent en speelt
   exact dezelfde curve zelf (docs/WATCH_PROTOCOL.md), ook met de pols
   omlaag. Bevestigt het horloge, dan zwijgt de telefoon — één ritme. */
let watchHasRhythm = false;
/** Speelt een gekoppeld horloge het ritme? (iPhone-tip in de sessie, 6 okt 2026) */
export function isWatchPlayingRhythm(): boolean {
  return watchHasRhythm;
}
let lastClock: { mode: BraceletMode; elapsedSec: number; remainingSec: number; at: number } | null = null;

/* Operator, 12 okt 2026 ("haptic niveau verandert niet op het horloge;
   strong mag echt heel voelbaar"): de trilsterkte (Soft/Medium/Strong) gaat
   nu mee naar het horloge. Een horlogemotor tegen de pols voelt zwakker dan
   de telefoon in de hand, dus de basis ligt ×1,4 hoger; Strong ×2,6 (Boost
   bijna vol vermogen, Sleep blijft zacht) en langere tikken. Verhouding
   tussen de toestanden blijft. Ritme en timing veranderen niet. */
/* Operator, 12 okt 2026 (vervolg 2: "soft is bijna onvoelbaar en strong,
   is dat max?"): de zachte toestanden (Sleep 18/255) bleven op de pols te
   zwak. Op het horloge nu vaste niveaus: Strong = vol vermogen bij elke
   toestand, Medium ≈ 70 %, Soft ≈ 40 % — de rustige toestanden blijven
   bij Soft/Medium iets zachter dan Boost (×0,75 … ×1), nooit onvoelbaar.
   Tweede tik (dub) ≈ 70 % van de eerste, zoals een echte hartslag. */
/* Vervolg 3 (operator: "soft is nog echt te soft"): onder ~50 % voelt een
   horlogemotor bijna niets — Soft ≈ 60 %, Medium ≈ 80 %, Strong 100 %. */
const WATCH_LEVEL = WATCH_HAPTIC_LEVEL;
const WATCH_MS: Record<'soft' | 'medium' | 'strong', number> = { soft: 1.15, medium: 1.4, strong: 1.8 };
function watchStrength(spec: { lubAmp: number; dubAmp: number; lubMsNoAmp: number; dubMsNoAmp: number }) {
  const st = getHapticStrength();
  /* Sleep (18) → 0,75 · Boost (65) → 1 */
  const modeScale = st === 'strong' ? 1 : 0.85 + 0.15 * Math.min(1, Math.max(0, (spec.lubAmp - 18) / (65 - 18)));
  const lub = Math.max(1, Math.min(255, Math.round(WATCH_LEVEL[st] * modeScale)));
  const dub = Math.max(1, Math.min(255, Math.round(lub * 0.7)));
  const ms = (m: number) => Math.round(m * WATCH_MS[st]);
  return {
    lubAmp: lub,
    dubAmp: dub,
    lubMs: ms(45),
    dubMs: ms(35),
    lubMsNoAmp: ms(spec.lubMsNoAmp),
    dubMsNoAmp: ms(spec.dubMsNoAmp),
    /* Het hartslaggeluid speelt de TELEFOON (luider, en via oortjes), ook
       als het horloge trilt (13 okt 2026); het horloge speelt geen geluid
       (14 okt 2026). */
  };
}

/** De parameters waarmee het horloge een State Control-sessie ZELF start
 *  (13 okt 2026 — State Control op het horloge, zonder telefoon): hetzelfde
 *  ritme als de telefoon nu zou spelen (rusthartslag, sterkte). */
export function watchStateParams(mode: BraceletMode) {
  const resting = getRestingPulse().bpm;
  const spec = resolveSpec(mode, resting, resting);
  return {
    startBpm: spec.startBpm,
    targetBpm: spec.targetBpm,
    holdSec: SESSION_HOLD_SECONDS,
    rampSec: spec.rampSec,
    ...watchStrength(spec),
    strength: getHapticStrength(),
  };
}

function relayToWatch(
  mode: BraceletMode,
  curveOffsetSec: number,
  remainingSec: number,
  restingBpm: number,
  startBpm: number,
): void {
  if (remainingSec <= 0) return;
  /* "Smartwatch" uit in Audio & Haptics (14 okt 2026): niets naar het
     horloge — de telefoon blijft zelf trillen. */
  if (!getSetting('watchHaptics')) return;
  const spec = resolveSpec(mode, restingBpm, startBpm);
  const meta = getModeMeta(mode);
  /* = het moment dat slag 0 van deze curve op de telefoon voelbaar is.
     Met een anker (native dienst / iPhone-geluidsmotor) sturen we het
     ankerpunt zelf: (plek in de curve, moment) — ook als deze relay later
     komt (Smartwatch-schakelaar); `curveOffsetSec` van de aanroeper geldt
     voor NU en zou dan dubbel tellen (20 okt 2026). */
  const anchored =
    lastAnchorWallMs > 0 && ((Platform.OS === 'ios' && isSessionAudioAvailable()) || hasNativeWaveform());
  const sentAtMs = anchored ? lastAnchorWallMs : Date.now();
  if (anchored) curveOffsetSec = lastAnchorCurveSec;
  /* 19 okt 2026 (operator, build 38: "telefoon loopt ~1 s voor op het
     horloge"): beide horloges rekenen het einde als sentAtMs + remainingSec.
     remainingSec gold echter voor NU (niet voor sentAtMs, dat 0,12–0,16 s
     later of — na de Smartwatch-schakelaar — ver in het verleden ligt) en
     werd op hele seconden afgerond (±0,5 s). Nu de rest op sentAtMs, op
     0,1 s nauwkeurig. */
  const remainingAtSent = remainingSec - (sentAtMs - Date.now()) / 1000;
  const start = {
    title: meta.name,
    colorHex: meta.color,
    startBpm: spec.startBpm,
    targetBpm: spec.targetBpm,
    holdSec: SESSION_HOLD_SECONDS,
    rampSec: spec.rampSec,
    curveOffsetSec,
    remainingSec: Math.round(remainingAtSent * 10) / 10,
    ...watchStrength(spec),
    strength: getHapticStrength(),
    sentAtMs,
  };
  sendWearState(start);
  sendAppleState(start);
}

/* 14 okt 2026 (A-tot-Z-audit): het horloge bevestigt elke 10 s dat het
   nog speelt. Valt het weg midden in een sessie (batterij leeg, app door
   het systeem gestopt, opnieuw geïnstalleerd), dan neemt de telefoon na
   25 s zonder bevestiging het ritme weer zelf over, op dezelfde plek —
   anders voelde je de rest van de sessie niets. (Werkt zolang de app-JS
   loopt; met de telefoon op slot kan Android dit vertragen.) */
const WATCH_ACK_TIMEOUT_MS = 25_000;
let lastWatchAckAt = 0;
let watchdog: ReturnType<typeof setInterval> | null = null;

function stopWatchdog(): void {
  if (watchdog) clearInterval(watchdog);
  watchdog = null;
}

/** De telefoon trilt weer zelf, vanaf de huidige plek in het ritme. */
function phoneTakesRhythmBack(): void {
  stopWatchdog();
  if (!watchHasRhythm || !session || session.pausedAt !== null || !lastClock) return;
  watchHasRhythm = false;
  const clock = lastClock;
  const passed = (Date.now() - clock.at) / 1000;
  const elapsedSec = clock.elapsedSec + passed;
  const remainingSec = Math.max(0, clock.remainingSec - passed);
  if (remainingSec <= 1) return;
  play(
    clock.mode,
    { holdSec: SESSION_HOLD_SECONDS, rampSec: SPECS[clock.mode].rampSec },
    Math.max(0, elapsedSec - session.curveZeroSec),
    remainingSec,
    { elapsedSec, totalSec: elapsedSec + remainingSec },
    false,
    session.restingBpm,
    session.startBpm,
  );
  lastClock = { mode: clock.mode, elapsedSec, remainingSec, at: Date.now() };
}

/** `watchdog`: beide horloges herhalen hun bevestiging elke 10 s (Apple
 *  Watch sinds 15 okt 2026, StateSessionController.startAckLoop). */
function onWatchTookOver(watchdogOn = false): void {
  lastWatchAckAt = Date.now();
  if (watchHasRhythm || !session || session.pausedAt !== null || !lastClock) return;
  watchHasRhythm = true;
  stopWatchdog();
  if (watchdogOn) watchdog = setInterval(() => {
    if (!watchHasRhythm) return stopWatchdog();
    if (Date.now() - lastWatchAckAt > WATCH_ACK_TIMEOUT_MS) phoneTakesRhythmBack();
  }, 5_000);
  /* 31 okt 2026 (gemeten op de A16, operator: "de eerste seconde hapert"):
     een stille HERSTART brak de lopende slag af — de bevestiging kwam
     ~1,6 s na de start, midden in slag 2: lub zonder dub, dan een gat tot
     slag 3. Daarom eerst zonder herstart: de lopende sessie trilt gewoon niet
     meer mee, geluid en beeld lopen ongestoord door op hetzelfde rooster als
     het horloge. Enkel een oudere build zonder die mogelijkheid herstart. */
  if (hasNativeWaveform() && isNativeSessionAlive() && setNativeSessionHaptics(false)) return;
  if (Platform.OS === 'ios' && muteIosPlanHaptics()) return;
  /* Zelfde plek in de curve, nu stil — sessie, timer en melding blijven.
     31 okt 2026 (operator: "geluid (telefoon) en haptics (horloge) moeten
     ALTIJD perfect synchroon zijn", ook bij een horloge dat midden in de
     sessie aansluit): het horloge speelt het rooster van het laatste
     ANKER (lastAnchorWallMs/lastAnchorCurveSec — exact wat relayToWatch
     meestuurde). De stille herstart, die het hartslaggeluid speelt, valt
     op de eerstvolgende slag van DAT rooster, met dat exacte moment als
     anker. Vroeger telde het rooster vanaf lastClock.at (een opstarttijd
     van 300/1500 ms ernaast) en ankerde de herstart op "nu + opstarttijd"
     (nog eens verschoven, plus timer-speling): geluid en pols vielen een
     fractie naast elkaar. */
  const clock = lastClock;
  const sess = session;
  const timing = { holdSec: SESSION_HOLD_SECONDS, rampSec: SPECS[clock.mode].rampSec };
  const spec = resolveSpec(clock.mode, sess.restingBpm, sess.startBpm);
  /* De motor (Android-trildienst / iPhone-geluidsmotor) moet het patroon
     op tijd krijgen: minstens zijn opstarttijd vóór de slag. */
  const lead = (Platform.OS === 'ios' ? IOS_FIRST_BEAT_MS : NATIVE_START_LEAD_MS) + 50;
  let beatCurve = lastAnchorCurveSec;
  let beatWall = lastAnchorWallMs;
  const earliest = Date.now() + lead;
  while (beatWall < earliest) {
    const { cycleMs } = beatAt(spec, beatCurve, timing);
    beatCurve += cycleMs / 1000;
    beatWall += cycleMs;
  }
  const elapsedSec = clock.elapsedSec + (beatWall - clock.at) / 1000;
  const remainingSec = Math.max(0, clock.remainingSec - (beatWall - clock.at) / 1000);
  if (remainingSec <= 1) return;
  play(
    clock.mode,
    timing,
    beatCurve,
    remainingSec,
    { elapsedSec, totalSec: elapsedSec + remainingSec },
    true,
    sess.restingBpm,
    sess.startBpm,
    undefined,
    { wallMs: beatWall },
  );
}
onWearStateAck(() => onWatchTookOver(true));

/** "Smartwatch"-schakelaar in Audio & Haptics, ook midden in een sessie
 *  (14 okt 2026). Uit: het horloge stopt en de telefoon trilt weer zelf,
 *  op dezelfde plek in het ritme. Aan: het horloge neemt het over. */
export async function setWatchHapticsEnabled(on: boolean): Promise<void> {
  /* eerst bewaren: setSetting is asynchroon, en relayToWatch leest de
     instelling — anders ging er bij "aan" niets naar het horloge (getest). */
  await setSetting('watchHaptics', on);
  if (!session || session.pausedAt !== null || !lastClock) return;
  const clock = lastClock;
  const passed = (Date.now() - clock.at) / 1000;
  const elapsedSec = clock.elapsedSec + passed;
  const remainingSec = Math.max(0, clock.remainingSec - passed);
  if (remainingSec <= 1) return;
  const offset = Math.max(0, elapsedSec - session.curveZeroSec);
  if (!on) {
    stopWearState();
    stopAppleState();
    phoneTakesRhythmBack();
  } else {
    lastClock = { mode: clock.mode, elapsedSec, remainingSec, at: Date.now() };
    relayToWatch(clock.mode, offset, remainingSec, session.restingBpm, session.startBpm);
  }
}
onAppleStateAck(() => onWatchTookOver(true));

export function pauseModeSessionHaptic(): void {
  /* De service blijft draaien in pauze-stand: zo blijft de sessie op het
     vergrendelscherm staan, met een hervat-knop. */
  generation += 1;
  clearPending();
  stopNativeWaveform();
  /* Altijd doorgeven: start en pauze lopen in volgorde over dezelfde
     native wachtrij, dus ook een pauze vlak na Play (service nog aan het
     opstarten) komt goed aan. Zonder service doet de module niets. */
  if (hasNativeWaveform()) pauseNativeSession();
  pauseWearState();
  pauseAppleState();
  watchHasRhythm = false;
  stopWatchdog();
  sessionEndsAt = null;
  if (session && session.pausedAt === null) session.pausedAt = Date.now();
}

/** Duurt het glijden naar het eindtempo in een echte sessie langer dan in
 *  de voorproef? Dan de sessieduur ervan in minuten (de UI zegt dat de
 *  voorproef ingekort is), anders null. Operator, 5 okt 2026: "moet dan wel
 *  duidelijk zijn dat het voor preview aangepast is". */
export function previewCondensedRampMinutes(mode: BraceletMode): number | null {
  const ramp = SPECS[mode].rampSec;
  return ramp > PREVIEW_RAMP_SECONDS ? Math.round(ramp / 60) : null;
}

/** "Feel it"-preview: zelfde verloop, ingekort tot PREVIEW_MAX_SECONDS. */
export function playModePreviewHaptic(mode: BraceletMode, fromSec = 0): void {
  session = null;
  const from = Math.max(0, Math.min(PREVIEW_MAX_SECONDS, fromSec));
  const left = PREVIEW_MAX_SECONDS - from;
  /* Via de trildienst, net als een echte sessie (operator, 17 okt 2026:
     "op het vergrendelscherm zie ik niets"): media-kaart met naam en
     aftellende tijd, loopt door op slot, geluid op elke slag in de dienst. */
  play(mode, previewTiming(mode), from, left, { elapsedSec: from, totalSec: PREVIEW_MAX_SECONDS, preview: true });
  previewRun = { mode, startedAt: Date.now() - from * 1000 };
  /* Eindig: na de voorproef stopt ook het beeld (en op toestellen zonder
     native module de JS-tikken). De native curve is zelf al eindig en
     speelt nog het eind-signaal uit. */
  const myGeneration = generation;
  pendingTimeouts.push(
    setTimeout(() => {
      if (myGeneration !== generation) return;
      generation += 1;
      clearPending();
      previewRun = null;
      if (!hasNativeWaveform()) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
      endIosPreviewSurface();
    }, left * 1000),
  );
}

/* Sterkte gewijzigd tijdens de 30 s-voorproef (19 okt 2026, operator: "Audio
   & Haptics tijdens de preview past meteen toe"): zelfde plek in de curve,
   nieuwe sterkte — telefoon én horloge. Een echte sessie doet dit via
   bracelet-session-monitor.ts. */
let previewRun: { mode: BraceletMode; startedAt: number } | null = null;
/** Loopt de 30 s-voorproef nu? (19 okt 2026: de Day Pass-kaart wacht dan —
 *  components/SalesNudgeHost.tsx.) */
export function isModePreviewRunning(): boolean {
  return previewRun !== null;
}
subscribeHapticStrength(() => {
  const run = previewRun;
  if (!run || session) return;
  const elapsed = (Date.now() - run.startedAt) / 1000;
  if (elapsed >= PREVIEW_MAX_SECONDS - 1) return;
  playModePreviewHaptic(run.mode, elapsed);
  if (previewOnWatch) sendPreviewToWatch(run.mode, elapsed);
});

/** "Try 30 seconds free" op het State Control-keuzescherm (operator, 7 okt
 *  2026): dezelfde ingekorte voorproef als "Feel it", maar ook op een
 *  gekoppeld horloge — wie er een draagt, voelt het meteen op de pols.
 *  Het horloge krijgt exact dezelfde ingekorte curve en stopt zelf na
 *  PREVIEW_MAX_SECONDS. */
/** Kort proeven in de onboarding (operator, 16 okt 2026: "het ritme moet
 *  onmiddellijk op eindritme beginnen, en max 5 seconden"): meteen het
 *  eindtempo van de toestand — geen start bij je hartslag, geen glijden —
 *  en na `seconds` stil. De echte voorproef (30 s) blijft ongewijzigd. */
export const TASTE_SECONDS = 5;
/** Proefduur afgerond op hele slagen van het eindtempo (19 okt 2026: nooit
 *  een halve slag op het einde). */
export function tasteDurationMs(mode: BraceletMode, seconds = TASTE_SECONDS): number {
  const cycle = Math.round(60000 / resolveSpec(mode).targetBpm);
  return Math.max(1, Math.round((seconds * 1000) / cycle)) * cycle;
}
export function playModeTasteHaptic(mode: BraceletMode, seconds = TASTE_SECONDS): void {
  endIosPreviewSurface(); /* zie playModeSessionHaptic */
  session = null;
  const ms = tasteDurationMs(mode, seconds);
  play(mode, { holdSec: 0, rampSec: 0 }, 0, ms / 1000, undefined, false, undefined, undefined, 'strong');
  const myGeneration = generation;
  pendingTimeouts.push(
    setTimeout(() => {
      if (myGeneration !== generation) return;
      generation += 1;
      clearPending();
    }, ms + (Platform.OS === 'ios' ? IOS_FIRST_BEAT_MS : 0) + 50),
  );
}

let previewOnWatch = false;

/* iPhone (operator, 17 okt 2026: "voor iPhone zelfde aanpassingen"): de
   voorproef krijgt wat een Premium-sessie op de iPhone heeft — Live Activity
   met aftellende tijd op het vergrendelscherm, scherm blijft aan, stil
   audio-anker houdt de app levend (zie bracelet-session-monitor.ts). */
const PREVIEW_KEEP_AWAKE_TAG = 'state-control-preview';
let iosPreviewOn = false;
function startIosPreviewSurface(mode: BraceletMode): void {
  if (Platform.OS !== 'ios') return;
  const meta = getModeMeta(mode);
  showLiveSession({
    kind: 'state',
    title: meta.name,
    subtitle: 'Free preview',
    colorHex: meta.color.toUpperCase() === '#00A3A3' ? '#4AF0D4' : meta.color,
    remainingSec: PREVIEW_MAX_SECONDS,
    totalSec: PREVIEW_MAX_SECONDS,
    paused: false,
  });
  void activateKeepAwakeAsync(PREVIEW_KEEP_AWAKE_TAG).catch(() => {});
  startSessionKeepAlive(undefined, false, 'preview');
  iosPreviewOn = true;
}
/** Enkel scherm-aan en geluidsmotor van de voorproef vrijgeven. */
function endIosPreviewKeepers(): void {
  if (!iosPreviewOn) return;
  iosPreviewOn = false;
  void deactivateKeepAwake(PREVIEW_KEEP_AWAKE_TAG).catch(() => {});
  stopSessionKeepAlive('preview');
}
function endIosPreviewSurface(): void {
  if (!iosPreviewOn) return;
  iosPreviewOn = false;
  endLiveSession();
  void deactivateKeepAwake(PREVIEW_KEEP_AWAKE_TAG).catch(() => {});
  stopSessionKeepAlive('preview');
}
/** Wekt de horloge-app alvast als State Control of het voorproef-blad
 *  opent (17 okt 2026, gemeten: een door Samsung bevroren app op de Watch4
 *  ontving de voorproef pas ~20 s na de telefoon). Hoogstens om de 15 s,
 *  enkel als het horloge mee mag trillen. */
let lastWakeAt = 0;
/** iPhone: de hartslaggeluiden al in de geluidsmotor laden als State
 *  Control opent, zodat ook de eerste slag van een sessie klinkt. */
export function warmUpBeatEngine(): void {
  if (Platform.OS === 'ios') void prepareHeartbeatSounds();
}

/** Houdt de verbinding met het horloge wakker zolang het State Control-scherm in beeld is (snelle handdruk bij de start, 28 okt 2026). */
export function setWatchLinkWarm(on: boolean): void {
  if (Platform.OS !== 'android') return;
  keepWearLinkWarm(on && !!getSetting('watchHaptics'));
}

export function wakeWatchForStateControl(): void {
  if (!getSetting('watchHaptics')) return;
  const now = Date.now();
  if (now - lastWakeAt < 15000) return;
  lastWakeAt = now;
  wakeWear();
}

export function playModeTrialHaptic(mode: BraceletMode): void {
  /* Eén sessie tegelijk (19 okt 2026): een lopende ademsessie stopt.
     Inline require: breath-session-host → bracelet-session-monitor → hier. */
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    (require('./breath-session-host') as typeof import('./breath-session-host')).endRunningBreathSession();
  } catch {
    /* nooit de voorproef blokkeren */
  }
  playModePreviewHaptic(mode);
  startIosPreviewSurface(mode);
  sendPreviewToWatch(mode, 0);
}

/** Voorproef hervatten na pauze, op de plek waar ze stopte (21 okt 2026). */
export function resumeModeTrialHaptic(mode: BraceletMode, fromSec: number): void {
  playModePreviewHaptic(mode, fromSec);
  startIosPreviewSurface(mode);
  sendPreviewToWatch(mode, fromSec);
}

/** De voorproef naar een gekoppeld horloge, vanaf `offsetSec` in de curve
 *  (0 = begin; > 0 = herstart na een sterktewissel, 19 okt 2026). */
function sendPreviewToWatch(mode: BraceletMode, offsetSec: number): void {
  if (!getSetting('watchHaptics')) return;
  const spec = resolveSpec(mode);
  const meta = getModeMeta(mode);
  const start = {
    title: meta.name,
    colorHex: meta.color,
    startBpm: spec.startBpm,
    targetBpm: spec.targetBpm,
    holdSec: previewTiming(mode).holdSec,
    rampSec: previewTiming(mode).rampSec,
    curveOffsetSec: Math.round(offsetSec * 10) / 10,
    remainingSec: Math.round((PREVIEW_MAX_SECONDS - offsetSec) * 10) / 10,
    ...watchStrength(spec),
    strength: getHapticStrength(),
    /* Het moment dat de eerste tik op de telefoon voelbaar is. De
       voorproef start de trilmotor rechtstreeks (geen voorgrondservice):
       gemeten 17 okt 2026 op de A16, 6 voorproeven: 7–21 ms na dit
       moment, niet de 160 ms van een sessie — met 160 liep het horloge
       ~150 ms achter op de telefoon. */
    /* De voorproef loopt nu via de dienst, net als Premium: het anker
       bevat het vaste startmoment van de dienst al (NATIVE_START_LEAD_MS). */
    sentAtMs:
      (hasNativeWaveform() || (Platform.OS === 'ios' && isSessionAudioAvailable())) && lastAnchorWallMs > 0
        ? lastAnchorWallMs
        : Date.now(),
  };
  sendWearState(start);
  sendAppleState(start);
  previewOnWatch = true;
}

/** Natuurlijk einde volgens de sessie-monitor: JS-kant opruimen, de
 *  native service NIET stoppen — die speelt het eind-signaal uit, toont
 *  "Session complete" en stopt dan zelf. (Na een herlaad van de app kent
 *  deze module het eindmoment niet meer, dus de monitor zegt het.) */
export function releaseSessionHapticAtNaturalEnd(): void {
  generation += 1;
  clearPending();
  session = null;
  sessionEndsAt = null;
}

/** Stopt alles en vergeet een eventuele gepauzeerde sessie. Bij een
 *  NATUURLIJK einde blijft de native service ongemoeid: die speelt zelf
 *  nog het eind-signaal uit en stopt dan vanzelf. */
export function stopModePreviewHaptic(): void {
  const endingNaturally = sessionEndsAt !== null && Date.now() >= sessionEndsAt - 1500;
  generation += 1;
  clearPending();
  endIosPreviewSurface();
  previewRun = null;
  if (jsSoundOn) {
    jsSoundOn = false;
    stopHeartbeatSound('state-control');
  }
  if (!endingNaturally) {
    clearNativeEndTimers();
    stopNativeWaveform();
    endNativeSession();
    /* Enkel als er een echte sessie of een voorproef op het horloge liep.
       Bij een natuurlijk einde speelt het horloge zelf het eind-signaal en
       stopt het vanzelf. */
    if (session || previewOnWatch) {
      stopWearState();
      stopAppleState();
    }
  }
  previewOnWatch = false;
  watchHasRhythm = false;
  stopWatchdog();
  lastClock = null;
  /* Bij een natuurlijk einde speelt de service het eind-signaal uit en
     stopt dan zelf. */
  session = null;
  sessionEndsAt = null;
}
