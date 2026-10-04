/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — haptiek van de 5 modi op telefoon (en later smartwatch).

   RONDE 3, 4 okt 2026 — operator: "baseer ons op de meest logische en
   bewezen wetenschap". Volledige onderbouwing + bronnen:
   docs/HAPTIC_RESEARCH_BASIS.md (§5–§6). Kort:

   BOTTOM-UP MECHANISME: een pols-puls bereikt geen hersengolven (Pomper
   2023: 10 Hz tactiel → geen entrainment). Het zenuwstelsel leest een
   ritmische pols-tik als hartslag: TRAGER dan de eigen hartslag →
   parasympathisch/kalmer (Doppel 2017, Zhou 2020, Lee 2025), SNELLER →
   hartslag en arousal omhoog (Wang 2023, Valente 2024). De 5 modi zijn
   dus 5 eindtempo's op één arousal-as t.o.v. de hartslag.

   TEMPOVERLOOP: Motokawa & Kato 2025 (BMC Psychology 13:1100), Study 1 —
   de enige vibratie-zonder-muziek-vergelijking: tempo dat start op de
   hartslag en in 2 min geleidelijk daalt naar 50 bpm was significant
   (p<0,05), een VAST tempo niet. Daarom: elke modus speelt eerst 10 s
   de aangenomen rust-hartslag (iso-principe: eerst aansluiten, dan
   leiden — Motokawa Study 2 hield ook 10 s op 75 bpm), en glijdt dan in
   een VASTE duur van 2 min (Study 1) naar zijn eindtempo, en blijft daar.

   AANGENOMEN RUST-HARTSLAG: 75 bpm (Doppel-baseline gem. 75,8; Motokawa
   Study 2 startte ook op 75). Er is nog geen hartslagsensor gekoppeld —
   met de smartwatch kan dit later de echte hartslag worden (gouden
   standaard, closed-loop zoals ambienBeat/Doppel-app).

   EINDTEMPO PER MODUS:
     Calm Control    60 bpm  🟢 Doppel: −20% onder rust-HR (gem. 58,2)
     Clarity & Relax 50 bpm  🟢 Motokawa Study 1-eindpunt
     Sleep           40 bpm  🟠 Doppel's ondergrens (trager = "onnatuurlijk
                                traag", bewust uitgesloten). Doorgezette
                                daling, niet als dalend protocol getest.
     Sharp Focus     90 bpm  🟡 boven rust-HR, onder Boost (Yerkes-Dodson)
     Boost          110 bpm  🟢 Valente 2024: 110 bpm (ook pols) → HR↑, HRV↓

   PULSVORM: lub-dub (dubbele hartslagtik, zoals Doppel's "double
   heartbeat-like rhythm"), tweede tik zachter (S2 < S1). Afstand lub→dub
   = 30% van de cyclus, max 350 ms (fysiologisch S1–S2-interval).
   Amplitude via expo-haptics (Android: Soft/Light 30/255, Medium 50,
   Heavy 70) — rauwe RN `Vibration` vuurt altijd op volle kracht en is
   daarom niet bruikbaar. Lagere amplitude = minder arousal/aangenamer,
   dus kalme modi zacht, Focus/Boost sterker.

   NIET op deze manier na te bootsen op telefoon/watch: Apollo-achtige
   gladde amplitude-golf (vraagt continue amplitude-sturing) — die hoort
   in de bracelet-firmware (DRV2605L kan dat), zie het onderzoeksdoc. */

import { BraceletMode } from './ble-contract';
import * as Haptics from 'expo-haptics';

const ASSUMED_RESTING_BPM = 75;
/** Eerst de "eigen hartslag" laten voelen (iso-principe), dan pas leiden —
 *  Motokawa Study 2: 10 s op 75 bpm vóór de daling begint. */
const SESSION_HOLD_SECONDS = 10;
/** Motokawa Study 1: van de hartslag naar het eindtempo in een VASTE duur
 *  van 2 min, ongeacht hoe groot de verschuiving is. */
const SESSION_RAMP_SECONDS = 120;
/** "Feel it"-preview: zelfde verloop, ingekort zodat je het eindtempo voelt. */
const PREVIEW_HOLD_SECONDS = 2;
const PREVIEW_RAMP_SECONDS = 8;
const LUB_DUB_FRACTION = 0.3;
const LUB_DUB_MAX_MS = 350;

const S = Haptics.ImpactFeedbackStyle;

type ModeHapticSpec = {
  targetBpm: number;
  lub: Haptics.ImpactFeedbackStyle;
  dub: Haptics.ImpactFeedbackStyle;
};

const SPECS: Record<BraceletMode, ModeHapticSpec> = {
  [BraceletMode.Delta]: { targetBpm: 40, lub: S.Soft, dub: S.Soft },
  [BraceletMode.Theta]: { targetBpm: 50, lub: S.Soft, dub: S.Soft },
  [BraceletMode.Alpha]: { targetBpm: 60, lub: S.Light, dub: S.Soft },
  [BraceletMode.Beta]: { targetBpm: 90, lub: S.Medium, dub: S.Light },
  [BraceletMode.Gamma]: { targetBpm: 110, lub: S.Heavy, dub: S.Medium },
};

type Timing = { holdSec: number; rampSec: number };

function bpmAt(spec: ModeHapticSpec, elapsedSec: number, timing: Timing): number {
  const rampElapsed = Math.max(0, elapsedSec - timing.holdSec);
  const progress = timing.rampSec <= 0 ? 1 : Math.min(1, rampElapsed / timing.rampSec);
  return ASSUMED_RESTING_BPM + (spec.targetBpm - ASSUMED_RESTING_BPM) * progress;
}

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

function scheduleBeat(spec: ModeHapticSpec, startedAt: number, timing: Timing, myGeneration: number): void {
  if (myGeneration !== generation) return;
  // Oude timers van vorige cycli opruimen, anders groeit de lijst onbeperkt.
  pendingTimeouts.length = 0;

  const cycleMs = 60000 / bpmAt(spec, (Date.now() - startedAt) / 1000, timing);
  const dubAt = Math.min(cycleMs * LUB_DUB_FRACTION, LUB_DUB_MAX_MS);

  fire(spec.lub);
  pendingTimeouts.push(
    setTimeout(() => {
      if (myGeneration === generation) fire(spec.dub);
    }, dubAt),
    setTimeout(() => scheduleBeat(spec, startedAt, timing, myGeneration), cycleMs),
  );
}

function start(mode: BraceletMode, timing: Timing): void {
  generation += 1;
  clearPending();
  scheduleBeat(SPECS[mode], Date.now(), timing, generation);
}

/** Echte sessie: 10 s basislijn, dan in 2 min naar het eindtempo. */
export function playModeSessionHaptic(mode: BraceletMode): void {
  start(mode, { holdSec: SESSION_HOLD_SECONDS, rampSec: SESSION_RAMP_SECONDS });
}

/** "Feel it"-preview: zelfde verloop, ingekort tot een paar seconden. */
export function playModePreviewHaptic(mode: BraceletMode): void {
  start(mode, { holdSec: PREVIEW_HOLD_SECONDS, rampSec: PREVIEW_RAMP_SECONDS });
}

export function stopModePreviewHaptic(): void {
  generation += 1;
  clearPending();
}
