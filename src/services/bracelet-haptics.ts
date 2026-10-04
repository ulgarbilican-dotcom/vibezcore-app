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

   VERLOOP: 10 s de aangenomen rust-hartslag (75 bpm) — iso-principe,
   eerst aansluiten, dan leiden (Motokawa Study 2) — daarna glijden naar
   het eindtempo, en dat aanhouden. Hoe lang het glijden duurt volgt het
   bewijs per modus:
     - Grote daling (Clarity, Sleep): 120 s. Motokawa Study 1: een vast
       tempo meteen op 50 bpm was NIET significant, 2 min glijden wel.
       Korter is niet getest.
     - Calm Control (−20%): 30 s. Doppel sprong zonder glijden meteen
       naar −20% onder de hartslag, en dat werkte.
     - Focus, Boost: 30 s. Valente/Wang gebruikten meteen een vast snel
       tempo; een stijgend verloop is nergens getest.
     30 s is een productkeuze tussen "meteen" en "2 min" in.

   EINDTEMPO:
     Calm Control    60 bpm  🟢 Doppel: −20% onder rust-HR (gem. 58,2)
     Clarity & Relax 50 bpm  🟢 Motokawa Study 1-eindpunt
     Sleep           40 bpm  🟠 Doppel's ondergrens ("onnatuurlijk traag"
                                daaronder), dalen tot hier niet getest
     Sharp Focus     90 bpm  🟡 boven rust-HR, onder Boost
     Boost          110 bpm  🟢 Valente 2024: HR↑, HRV↓ (ook op de pols)

   PULSVORM: lub-dub (Doppel's "double heartbeat-like rhythm"), dub
   zachter. Lub→dub = 30% van de cyclus, max 350 ms (fysiologisch S1–S2).

   AFSPELEN — twee paden:
     1. Android met amplitude-sturing (modules/state-haptics): de HELE
        curve gaat in één keer naar de systeem-trilmotor. Echte lage
        amplitudes (subtieler dan expo-haptics' zachtste 30/255) én het
        ritme loopt door zonder JS-timers — die bevriest Android als het
        scherm op slot gaat (gemeten aug 2026, zie breath-background).
     2. Anders (iOS, toestel zonder amplitude-sturing): expo-haptics op
        JS-timers, zachtste beschikbare stijlen.

   PAUZE: hervatten binnen 2 min gaat verder waar de curve was (het
   lichaam is nog "meegenomen"); later hervatten begint opnieuw met de
   basislijn. 2 min = de geteste glijduur — productlogica, geen studie. */

import { BraceletMode } from './ble-contract';
import * as Haptics from 'expo-haptics';
import {
  canPlayNativeWaveform,
  playNativeWaveform,
  stopNativeWaveform,
} from '../../modules/state-haptics';

const ASSUMED_RESTING_BPM = 75;
const SESSION_HOLD_SECONDS = 10;
const PREVIEW_HOLD_SECONDS = 2;
const PREVIEW_RAMP_SECONDS = 8;
const RESUME_WINDOW_SECONDS = 120;
const LUB_DUB_FRACTION = 0.3;
const LUB_DUB_MAX_MS = 350;
const LUB_MS = 45;
const DUB_MS = 35;

const S = Haptics.ImpactFeedbackStyle;

type ModeHapticSpec = {
  targetBpm: number;
  rampSec: number;
  /** Native amplitude 0–255 — engineering-waarden, af te stemmen op gevoel. */
  lubAmp: number;
  dubAmp: number;
  /** Terugval-pad (expo-haptics). */
  lubStyle: Haptics.ImpactFeedbackStyle;
  dubStyle: Haptics.ImpactFeedbackStyle;
};

const SPECS: Record<BraceletMode, ModeHapticSpec> = {
  [BraceletMode.Delta]: { targetBpm: 40, rampSec: 120, lubAmp: 18, dubAmp: 13, lubStyle: S.Soft, dubStyle: S.Soft },
  [BraceletMode.Theta]: { targetBpm: 50, rampSec: 120, lubAmp: 21, dubAmp: 15, lubStyle: S.Soft, dubStyle: S.Soft },
  [BraceletMode.Alpha]: { targetBpm: 60, rampSec: 30, lubAmp: 24, dubAmp: 17, lubStyle: S.Soft, dubStyle: S.Soft },
  [BraceletMode.Beta]: { targetBpm: 90, rampSec: 30, lubAmp: 45, dubAmp: 32, lubStyle: S.Medium, dubStyle: S.Light },
  [BraceletMode.Gamma]: { targetBpm: 110, rampSec: 30, lubAmp: 65, dubAmp: 45, lubStyle: S.Heavy, dubStyle: S.Medium },
};

type Timing = { holdSec: number; rampSec: number };

function bpmAt(spec: ModeHapticSpec, elapsedSec: number, timing: Timing): number {
  const rampElapsed = Math.max(0, elapsedSec - timing.holdSec);
  const progress = timing.rampSec <= 0 ? 1 : Math.min(1, rampElapsed / timing.rampSec);
  return ASSUMED_RESTING_BPM + (spec.targetBpm - ASSUMED_RESTING_BPM) * progress;
}

function beatAt(spec: ModeHapticSpec, elapsedSec: number, timing: Timing) {
  const cycleMs = Math.round(60000 / bpmAt(spec, elapsedSec, timing));
  const dubAt = Math.round(Math.min(cycleMs * LUB_DUB_FRACTION, LUB_DUB_MAX_MS));
  return { cycleMs, dubAt };
}

/** De volledige curve vanaf `offsetSec` als één Android-waveform. Met
 *  `totalSec` eindig (sessie), zonder herhaalt de laatste tel eindeloos
 *  (preview, stopt bij het sluiten). */
function buildWaveform(spec: ModeHapticSpec, timing: Timing, offsetSec: number, totalSec?: number) {
  const timings: number[] = [];
  const amplitudes: number[] = [];
  const curveEnd = timing.holdSec + timing.rampSec;
  let t = offsetSec;
  let repeat = -1;

  const pushBeat = (cycleMs: number, dubAt: number) => {
    timings.push(LUB_MS, dubAt - LUB_MS, DUB_MS, cycleMs - dubAt - DUB_MS);
    amplitudes.push(spec.lubAmp, 0, spec.dubAmp, 0);
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
  }
  return { timings, amplitudes, repeat };
}

/* ── Terugval-pad: expo-haptics op JS-timers ─────────────────────────── */

let generation = 0;
const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

function clearPending(): void {
  pendingTimeouts.forEach(clearTimeout);
  pendingTimeouts.length = 0;
}

function fire(style: Haptics.ImpactFeedbackStyle): void {
  Haptics.impactAsync(style).catch(() => {
    /* toestel/emulator zonder trilmotor mag niets breken */
  });
}

function scheduleBeat(spec: ModeHapticSpec, curveStartedAt: number, timing: Timing, myGeneration: number): void {
  if (myGeneration !== generation) return;
  pendingTimeouts.length = 0;
  const { cycleMs, dubAt } = beatAt(spec, (Date.now() - curveStartedAt) / 1000, timing);
  fire(spec.lubStyle);
  pendingTimeouts.push(
    setTimeout(() => {
      if (myGeneration === generation) fire(spec.dubStyle);
    }, dubAt),
    setTimeout(() => scheduleBeat(spec, curveStartedAt, timing, myGeneration), cycleMs),
  );
}

/* ── Gemeenschappelijk ───────────────────────────────────────────────── */

function silence(): void {
  generation += 1;
  clearPending();
  stopNativeWaveform();
}

function play(mode: BraceletMode, timing: Timing, offsetSec: number, totalSec?: number): void {
  silence();
  const spec = SPECS[mode];
  if (canPlayNativeWaveform()) {
    const { timings, amplitudes, repeat } = buildWaveform(spec, timing, offsetSec, totalSec);
    playNativeWaveform(timings, amplitudes, repeat);
  } else {
    scheduleBeat(spec, Date.now() - offsetSec * 1000, timing, generation);
  }
}

type SessionState = { mode: BraceletMode; curveStartedAt: number; pausedAt: number | null };
let session: SessionState | null = null;

/** Echte sessie. Hervat waar de curve was als dezelfde modus binnen 2 min
 *  na een pauze verdergaat, anders opnieuw vanaf de basislijn.
 *  `remainingSec` maakt de native curve eindig (stopt ook als JS stilvalt). */
export function playModeSessionHaptic(mode: BraceletMode, remainingSec?: number): void {
  const now = Date.now();
  if (
    session &&
    session.mode === mode &&
    session.pausedAt !== null &&
    now - session.pausedAt <= RESUME_WINDOW_SECONDS * 1000
  ) {
    session.curveStartedAt += now - session.pausedAt;
    session.pausedAt = null;
  } else {
    session = { mode, curveStartedAt: now, pausedAt: null };
  }
  const total = remainingSec !== undefined && remainingSec > 0 ? remainingSec : undefined;
  play(
    mode,
    { holdSec: SESSION_HOLD_SECONDS, rampSec: SPECS[mode].rampSec },
    (now - session.curveStartedAt) / 1000,
    total,
  );
}

export function pauseModeSessionHaptic(): void {
  silence();
  if (session && session.pausedAt === null) session.pausedAt = Date.now();
}

/** "Feel it"-preview: zelfde verloop, ingekort tot een paar seconden. */
export function playModePreviewHaptic(mode: BraceletMode): void {
  session = null;
  play(mode, { holdSec: PREVIEW_HOLD_SECONDS, rampSec: PREVIEW_RAMP_SECONDS }, 0);
}

/** Stopt alles en vergeet een eventuele gepauzeerde sessie. */
export function stopModePreviewHaptic(): void {
  silence();
  session = null;
}
