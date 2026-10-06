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
     - Calm Control (−20%): meteen. Doppel sprong zonder glijden naar −20%
       onder de hartslag, en dat werkte (RCT).
     - Focus, Boost: meteen. Valente/Wang gebruikten meteen een vast snel
       tempo; een stijgend verloop is nergens getest.
     (Eerder 30 s — een eigen tussenkeuze zonder bron, vervangen.)

   EINDTEMPO:
     Calm Control    60 bpm  🟢 Doppel: −20% onder rust-HR (gem. 58,2)
     Clarity & Relax 50 bpm  🟢 Motokawa Study 1-eindpunt
     Sleep           40 bpm  🟠 Doppel's ondergrens ("onnatuurlijk traag"
                                daaronder), dalen tot hier niet getest
     Sharp Focus     90 bpm  🟡 boven rust-HR, onder Boost
     Boost          110 bpm  🟢 Valente 2024: HR↑, HRV↓ (ook op de pols)

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

const ASSUMED_RESTING_BPM = 75;
const SESSION_HOLD_SECONDS = 10;
const PREVIEW_HOLD_SECONDS = 3;
const PREVIEW_RAMP_SECONDS = 12;
/** "Feel it" is een VOORPROEF, geen gratis sessie (operator, 5 okt 2026:
 *  "als de cyclus blijft draaien mag niet, anders is de sessie gratis").
 *  Operator, 5 okt 2026: 30 s, en binnen die 30 s moet elke modus op zijn
 *  eindtempo staan — 3 s basislijn, 12 s glijden, dan 15 s het echte
 *  eindritme, gevolgd door het eind-signaal. Het glijden is korter dan in
 *  een sessie (Sleep: 2 min); een voorproef toont waar de sessie heen gaat. */
export const PREVIEW_MAX_SECONDS = 30;
const RESUME_WINDOW_SECONDS = 120;
const LUB_DUB_FRACTION = 0.3;
const LUB_DUB_MAX_MS = 350;
/** Met amplitude-sturing: vaste tikduur, sterkte via amplitude. */
const LUB_MS = 45;
const DUB_MS = 35;

const S = Haptics.ImpactFeedbackStyle;

type ModeHapticSpec = {
  targetBpm: number;
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
  [BraceletMode.Delta]: { targetBpm: 40, rampSec: 120, lubAmp: 18, dubAmp: 13, lubMsNoAmp: 38, dubMsNoAmp: 30, lubStyle: S.Soft, dubStyle: S.Soft },
  [BraceletMode.Theta]: { targetBpm: 50, rampSec: 120, lubAmp: 21, dubAmp: 15, lubMsNoAmp: 40, dubMsNoAmp: 32, lubStyle: S.Soft, dubStyle: S.Soft },
  /* rampSec 10 = na de basislijn in 10 s naar het eindtempo (vol op 20 s).
     Doppel (−20%) en Valente/Wang (110 bpm) gingen meteen naar hun tempo;
     operator, 5 okt 2026: "geen abrupte overgang, er moet een flow zijn,
     op 20 s bij max". 10 s is vrijwel meteen — binnen het geteste gebied,
     enkel de schok eruit. */
  [BraceletMode.Alpha]: { targetBpm: 60, rampSec: 10, lubAmp: 24, dubAmp: 17, lubMsNoAmp: 42, dubMsNoAmp: 34, lubStyle: S.Soft, dubStyle: S.Soft },
  [BraceletMode.Beta]: { targetBpm: 90, rampSec: 10, lubAmp: 45, dubAmp: 32, lubMsNoAmp: 50, dubMsNoAmp: 40, lubStyle: S.Medium, dubStyle: S.Light },
  [BraceletMode.Gamma]: { targetBpm: 110, rampSec: 10, lubAmp: 65, dubAmp: 45, lubMsNoAmp: 60, dubMsNoAmp: 46, lubStyle: S.Heavy, dubStyle: S.Medium },
};

type Timing = { holdSec: number; rampSec: number };

function bpmAt(spec: ModeHapticSpec, elapsedSec: number, timing: Timing): number {
  if (elapsedSec < timing.holdSec) return ASSUMED_RESTING_BPM;
  const rampElapsed = elapsedSec - timing.holdSec;
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
function buildWaveform(
  spec: ModeHapticSpec,
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

  const lubMs = amplitudeControl ? LUB_MS : spec.lubMsNoAmp;
  const dubMs = amplitudeControl ? DUB_MS : spec.dubMsNoAmp;
  const lubAmp = amplitudeControl ? spec.lubAmp : 255;
  const dubAmp = amplitudeControl ? spec.dubAmp : 255;
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
function scheduleVisual(
  mode: BraceletMode,
  spec: ModeHapticSpec,
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
  emitPulse({ kind: 'lub', mode, cycleMs });
  const beatWallMs = anchorWallMs + (curveSec - offsetSec) * 1000;
  const nextCurveSec = curveSec + cycleMs / 1000;
  const nextWallMs = anchorWallMs + (nextCurveSec - offsetSec) * 1000;
  pendingTimeouts.push(
    setTimeout(() => {
      if (myGeneration === generation) emitPulse({ kind: 'dub', mode, cycleMs });
    }, Math.max(0, beatWallMs + dubAt - Date.now())),
    setTimeout(
      () => scheduleVisual(mode, spec, timing, anchorWallMs, offsetSec, nextCurveSec, myGeneration),
      Math.max(0, nextWallMs - Date.now()),
    ),
  );
}

function fire(style: Haptics.ImpactFeedbackStyle): void {
  Haptics.impactAsync(style).catch(() => {
    /* toestel/emulator zonder trilmotor mag niets breken */
  });
}

function scheduleBeat(
  mode: BraceletMode,
  spec: ModeHapticSpec,
  curveStartedAt: number,
  timing: Timing,
  myGeneration: number,
): void {
  if (myGeneration !== generation) return;
  pendingTimeouts.length = 0;
  const { cycleMs, dubAt } = beatAt(spec, (Date.now() - curveStartedAt) / 1000, timing);
  fire(spec.lubStyle);
  emitPulse({ kind: 'lub', mode, cycleMs });
  pendingTimeouts.push(
    setTimeout(() => {
      if (myGeneration !== generation) return;
      fire(spec.dubStyle);
      emitPulse({ kind: 'dub', mode, cycleMs });
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
): void {
  silence(!!clock && hasNativeWaveform());
  const spec = SPECS[mode];
  if (hasNativeWaveform()) {
    const built = buildWaveform(spec, timing, offsetSec, totalSec, canPlayNativeWaveform());
    const { timings, repeat } = built;
    const amplitudes = silent ? built.amplitudes.map(() => 0) : built.amplitudes;
    const anchorWallMs = Date.now();
    if (clock) {
      /* Sessie: via de voorgrondservice, zodat het doorloopt op slot. */
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
    scheduleBeat(mode, spec, Date.now() - offsetSec * 1000, timing, generation);
  }
}

/* Curve-positie volgt de WERKELIJK verstreken (actieve) sessietijd, niet
   het moment waarop een scherm mount — operator, 5 okt 2026: na weg- en
   terugnavigeren begon de curve opnieuw bij 75 bpm ("volledig fout
   ritme"). `curveZero` = de verstreken sessietijd waarop de curve begon
   (0 bij de start; verschuift enkel na een lange pauze, zie hieronder). */
type SessionState = { mode: BraceletMode; curveZeroSec: number; pausedAt: number | null };
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
    session = { mode, curveZeroSec: elapsedSec, pausedAt: null };
  } else if (session.pausedAt !== null && now - session.pausedAt > RESUME_WINDOW_SECONDS * 1000) {
    session.curveZeroSec = elapsedSec;
  }
  session.pausedAt = null;
  sessionEndsAt = now + remainingSec * 1000;
  lastClock = { mode, elapsedSec, remainingSec, at: now };
  /* Elke (her)start: eerst speelt de telefoon zelf, tot het horloge
     bevestigt dat het overneemt (`state-ack`, zie hieronder). Zo voel je
     altijd iets, ook als er geen horloge-app is. */
  watchHasRhythm = false;
  play(
    mode,
    { holdSec: SESSION_HOLD_SECONDS, rampSec: SPECS[mode].rampSec },
    Math.max(0, elapsedSec - session.curveZeroSec),
    remainingSec > 0 ? remainingSec : undefined,
    { elapsedSec, totalSec: elapsedSec + remainingSec },
  );
  relayToWatch(mode, Math.max(0, elapsedSec - session.curveZeroSec), remainingSec);
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

function relayToWatch(mode: BraceletMode, curveOffsetSec: number, remainingSec: number): void {
  if (remainingSec <= 0) return;
  const spec = SPECS[mode];
  const meta = getModeMeta(mode);
  const start = {
    title: meta.name,
    colorHex: meta.color,
    targetBpm: spec.targetBpm,
    holdSec: SESSION_HOLD_SECONDS,
    rampSec: spec.rampSec,
    curveOffsetSec,
    remainingSec: Math.round(remainingSec),
    lubAmp: spec.lubAmp,
    dubAmp: spec.dubAmp,
    lubMsNoAmp: spec.lubMsNoAmp,
    dubMsNoAmp: spec.dubMsNoAmp,
  };
  sendWearState(start);
  sendAppleState(start);
}

function onWatchTookOver(): void {
  if (watchHasRhythm || !session || session.pausedAt !== null || !lastClock) return;
  watchHasRhythm = true;
  /* Zelfde plek in de curve, nu stil — sessie, timer en melding blijven. */
  const passed = (Date.now() - lastClock.at) / 1000;
  const elapsedSec = lastClock.elapsedSec + passed;
  const remainingSec = Math.max(0, lastClock.remainingSec - passed);
  if (remainingSec <= 1) return;
  play(
    lastClock.mode,
    { holdSec: SESSION_HOLD_SECONDS, rampSec: SPECS[lastClock.mode].rampSec },
    Math.max(0, elapsedSec - session.curveZeroSec),
    remainingSec,
    { elapsedSec, totalSec: elapsedSec + remainingSec },
    true,
  );
}
onWearStateAck(onWatchTookOver);
onAppleStateAck(onWatchTookOver);

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
  play(
    mode,
    { holdSec: PREVIEW_HOLD_SECONDS, rampSec: SPECS[mode].rampSec > 0 ? PREVIEW_RAMP_SECONDS : 0 },
    0,
    PREVIEW_MAX_SECONDS,
  );
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
    /* Enkel als er een echte sessie liep — een voorproef gaat niet naar
       het horloge. Bij een natuurlijk einde speelt het horloge zelf het
       eind-signaal en stopt het vanzelf. */
    if (session) {
      stopWearState();
      stopAppleState();
    }
  }
  watchHasRhythm = false;
  lastClock = null;
  /* Bij een natuurlijk einde speelt de service het eind-signaal uit en
     stopt dan zelf. */
  session = null;
  sessionEndsAt = null;
}
