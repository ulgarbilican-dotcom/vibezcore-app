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
} from '../../modules/wear-breath';
import {
  onStateAck as onAppleStateAck,
  pauseStateSessionOnWatch as pauseAppleState,
  sendStateSessionToWatch as sendAppleState,
  stopStateSessionOnWatch as stopAppleState,
} from '../../modules/watch-breath';

import { clearLiveStartPulse, getRestingPulse, getSessionStartBpm } from './resting-pulse';
import { heartbeatDub, heartbeatLub, startHeartbeatSound, stopHeartbeatSound } from './heartbeat-sound';
import { getStateHear } from './state-sound-pref';
import { getSetting, setSetting } from '@/utils/settings';
import { AMP_FACTOR, MS_FACTOR, WATCH_HAPTIC_LEVEL, getHapticStrength } from './haptic-strength-pref';


/* Feel & Hear zonder native service (iOS, oud Android): de app speelt het
   hartslaggeluid zelf op elke slag, zolang ze open is. */
let jsSoundOn = false;

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

const SPECS: Record<BraceletMode, ModeHapticSpec> = {
  /* NoAmp-duren: 5 okt 2026 eerst 26–30 ms → op de Galaxy A16 "bijna niet
     voelbaar" (operator). 50 ms (expo Soft) was voelbaar maar mocht
     subtieler → nu ertussen. */
  [BraceletMode.Delta]: { targetFor: (r) => Math.max(40, Math.round(r * 0.55)), rampSec: 120, lubAmp: 18, dubAmp: 13, lubMsNoAmp: 38, dubMsNoAmp: 30, lubStyle: S.Soft, dubStyle: S.Soft },
  [BraceletMode.Theta]: { targetFor: (r) => Math.max(45, Math.round(r * 0.7)), rampSec: 120, lubAmp: 21, dubAmp: 15, lubMsNoAmp: 40, dubMsNoAmp: 32, lubStyle: S.Soft, dubStyle: S.Soft },
  /* rampSec 10 = na de basislijn in 10 s naar het eindtempo (vol op 20 s).
     Doppel (−20%) en Valente/Wang (110 bpm) gingen meteen naar hun tempo;
     operator, 5 okt 2026: "geen abrupte overgang, er moet een flow zijn,
     op 20 s bij max". 10 s is vrijwel meteen — binnen het geteste gebied,
     enkel de schok eruit. */
  [BraceletMode.Alpha]: { targetFor: (r) => Math.max(50, Math.round(r * 0.8)), rampSec: 10, lubAmp: 24, dubAmp: 17, lubMsNoAmp: 42, dubMsNoAmp: 34, lubStyle: S.Soft, dubStyle: S.Soft },
  [BraceletMode.Beta]: { targetFor: (r) => Math.max(53, Math.round(r * 0.9)), rampSec: 10, lubAmp: 45, dubAmp: 32, lubMsNoAmp: 50, dubMsNoAmp: 40, lubStyle: S.Medium, dubStyle: S.Light },
  [BraceletMode.Gamma]: { targetFor: () => 110, rampSec: 10, lubAmp: 65, dubAmp: 45, lubMsNoAmp: 60, dubMsNoAmp: 46, lubStyle: S.Heavy, dubStyle: S.Medium },
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
  const st = getHapticStrength();
  const ampOf = (a: number) => Math.max(1, Math.min(255, Math.round(a * AMP_FACTOR[st])));
  const msOf = (ms: number) => Math.round(ms * MS_FACTOR[st]);
  const lubMs = amplitudeControl ? LUB_MS : msOf(spec.lubMsNoAmp);
  const dubMs = amplitudeControl ? DUB_MS : msOf(spec.dubMsNoAmp);
  const lubAmp = amplitudeControl ? ampOf(spec.lubAmp) : 255;
  const dubAmp = amplitudeControl ? ampOf(spec.dubAmp) : 255;
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
};

type PulseListener = (pulse: HapticPulse) => void;
const pulseListeners = new Set<PulseListener>();

export function subscribeHapticPulse(listener: PulseListener): () => void {
  pulseListeners.add(listener);
  return () => {
    pulseListeners.delete(listener);
  };
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
}

/** Native pad: de motor speelt de curve zelf; dit loopt dezelfde tikken
 *  af (zelfde afgeronde cycleMs, zelfde startpunt) puur voor het beeld.
 *  Corrigeert zichzelf op de wandklok, zodat er geen drift opbouwt. */
/** Gemeten opstarttijd van de trildienst op Android (13 okt 2026: 145–178 ms). */
const NATIVE_START_LAG_MS = 160;
let syncLogCount = 0;
function scheduleVisual(
  mode: BraceletMode,
  spec: ResolvedSpec,
  timing: Timing,
  anchorWallMs: number,
  offsetSec: number,
  curveSec: number,
  myGeneration: number,
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
  /* Meting synchronisatie met het horloge (13 okt 2026, VZSync op het horloge). */
  if (__DEV__ && syncLogCount < 40) {
    syncLogCount += 1;
    console.log(`[sync] lub wall=${Math.round(beatWallMs)} curve=${curveSec.toFixed(3)}`);
  }
  const nextCurveSec = curveSec + cycleMs / 1000;
  const nextWallMs = anchorWallMs + (nextCurveSec - offsetSec) * 1000;
  pendingTimeouts.push(
    setTimeout(() => {
      if (myGeneration === generation) emitPulse({ kind: 'dub', mode, cycleMs, atMs: beatWallMs + dubAt });
    }, Math.max(0, beatWallMs + dubAt - Date.now())),
    setTimeout(
      () => scheduleVisual(mode, spec, timing, anchorWallMs, offsetSec, nextCurveSec, myGeneration),
      Math.max(0, nextWallMs - Date.now()),
    ),
  );
}

/* JS-weg (iOS / zonder eigen golfvorm): de stijl schuift één trede. */
const STYLE_LADDER = [S.Soft, S.Light, S.Medium, S.Heavy, S.Rigid];
function strengthStyle(style: Haptics.ImpactFeedbackStyle): Haptics.ImpactFeedbackStyle {
  const st = getHapticStrength();
  if (st === 'medium') return style;
  const i = STYLE_LADDER.indexOf(style);
  if (i < 0) return style;
  return STYLE_LADDER[Math.max(0, Math.min(STYLE_LADDER.length - 1, i + (st === 'strong' ? 1 : -1)))];
}

function fire(style: Haptics.ImpactFeedbackStyle): void {
  Haptics.impactAsync(strengthStyle(style)).catch(() => {
    /* toestel/emulator zonder trilmotor mag niets breken */
  });
}

function scheduleBeat(
  mode: BraceletMode,
  spec: ResolvedSpec,
  curveStartedAt: number,
  timing: Timing,
  myGeneration: number,
): void {
  if (myGeneration !== generation) return;
  pendingTimeouts.length = 0;
  const { cycleMs, dubAt } = beatAt(spec, (Date.now() - curveStartedAt) / 1000, timing);
  fire(spec.lubStyle);
  if (jsSoundOn && getStateHear()) heartbeatLub();
  const lubAt = Date.now();
  emitPulse({ kind: 'lub', mode, cycleMs, atMs: lubAt });
  pendingTimeouts.push(
    setTimeout(() => {
      if (myGeneration !== generation) return;
      fire(spec.dubStyle);
      if (jsSoundOn && getStateHear()) heartbeatDub();
      emitPulse({ kind: 'dub', mode, cycleMs, atMs: lubAt + dubAt });
    }, dubAt),
    setTimeout(() => scheduleBeat(mode, spec, curveStartedAt, timing, myGeneration), cycleMs),
  );
}

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
  stopNativeWaveform();
  if (!keepService) endNativeSession();
}

type SessionClock = { elapsedSec: number; totalSec: number };

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
): void {
  silence(!!clock && hasNativeWaveform());
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
    const anchorWallMs = Date.now() + (clock ? NATIVE_START_LAG_MS : 0);
    if (clock) {
      /* Sessie: via de voorgrondservice, zodat het doorloopt op slot. Feel &
         Hear: de service speelt het hartslaggeluid zelf, op elke tik. */
      /* Ook als het horloge de trilling overneemt (silent): het geluid blijft
         hier (13 okt 2026, zie watchStrength). */
      setNativeSessionSound(getStateHear());
      startNativeSession(
        timings,
        amplitudes,
        getModeMeta(mode).name,
        clock?.totalSec ?? totalSec,
        clock?.elapsedSec ?? 0,
      );
    } else {
      playNativeWaveform(timings, amplitudes, repeat);
    }
    scheduleVisual(mode, spec, timing, anchorWallMs, offsetSec, offsetSec, generation);
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
  const start = {
    title: meta.name,
    colorHex: meta.color,
    startBpm: spec.startBpm,
    targetBpm: spec.targetBpm,
    holdSec: SESSION_HOLD_SECONDS,
    rampSec: spec.rampSec,
    curveOffsetSec,
    remainingSec: Math.round(remainingSec),
    ...watchStrength(spec),
    /* = het moment dat slag 0 van deze curve op de telefoon voelbaar is */
    sentAtMs: Date.now() + (hasNativeWaveform() ? NATIVE_START_LAG_MS : 0),
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
  /* Zelfde plek in de curve, nu stil — sessie, timer en melding blijven.
     13 okt 2026 (meting: tikken van horloge en telefoon vielen ~0,63 s
     naast elkaar): de stille herstart (die het hartslaggeluid speelt) begint
     op de eerstvolgende slag van HETZELFDE rooster als het horloge, niet op
     het moment van de bevestiging. Tot dan loopt de huidige curve door. */
  const clock = lastClock;
  const sess = session;
  const timing = { holdSec: SESSION_HOLD_SECONDS, rampSec: SPECS[clock.mode].rampSec };
  const spec = resolveSpec(clock.mode, sess.restingBpm, sess.startBpm);
  const originCurve = Math.max(0, clock.elapsedSec - sess.curveZeroSec);
  const nowCurve = originCurve + (Date.now() - clock.at) / 1000;
  let gridCurve = originCurve;
  while (gridCurve < nowCurve + 0.05) gridCurve += beatAt(spec, gridCurve, timing).cycleMs / 1000;
  const myGeneration = generation;
  const startAt = clock.at + (gridCurve - originCurve) * 1000;
  pendingTimeouts.push(
    setTimeout(() => {
      if (myGeneration !== generation || !session || session.pausedAt !== null) return;
      const ahead = gridCurve - originCurve;
      const elapsedSec = clock.elapsedSec + ahead;
      const remainingSec = Math.max(0, clock.remainingSec - ahead);
      if (remainingSec <= 1) return;
      play(
        clock.mode,
        timing,
        gridCurve,
        remainingSec,
        { elapsedSec, totalSec: elapsedSec + remainingSec },
        true,
        sess.restingBpm,
        sess.startBpm,
      );
    }, Math.max(0, startAt - Date.now())),
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
export function playModePreviewHaptic(mode: BraceletMode): void {
  session = null;
  play(mode, previewTiming(mode), 0, PREVIEW_MAX_SECONDS);
  /* Eindig: na de voorproef stopt ook het beeld (en op toestellen zonder
     native module de JS-tikken). De native curve is zelf al eindig en
     speelt nog het eind-signaal uit. */
  const myGeneration = generation;
  pendingTimeouts.push(
    setTimeout(() => {
      if (myGeneration !== generation) return;
      generation += 1;
      clearPending();
      if (!hasNativeWaveform()) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      }
    }, PREVIEW_MAX_SECONDS * 1000),
  );
}

/** "Try 30 seconds free" op het State Control-keuzescherm (operator, 7 okt
 *  2026): dezelfde ingekorte voorproef als "Feel it", maar ook op een
 *  gekoppeld horloge — wie er een draagt, voelt het meteen op de pols.
 *  Het horloge krijgt exact dezelfde ingekorte curve en stopt zelf na
 *  PREVIEW_MAX_SECONDS. */
let previewOnWatch = false;
export function playModeTrialHaptic(mode: BraceletMode): void {
  playModePreviewHaptic(mode);
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
    curveOffsetSec: 0,
    remainingSec: PREVIEW_MAX_SECONDS,
    ...watchStrength(spec),
    /* zoals relayToWatch: het moment dat de eerste tik op de telefoon
       voelbaar is (audit 14 okt 2026) */
    sentAtMs: Date.now() + (hasNativeWaveform() ? NATIVE_START_LAG_MS : 0),
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
  if (!endingNaturally) {
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
