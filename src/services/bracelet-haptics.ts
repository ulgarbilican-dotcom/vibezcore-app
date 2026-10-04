/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Voelbare preview van de 5 bracelet-modi, op de telefoon.

   GEBOUWD OP DE ECHTE SPEC (Haptic Bracelet Spec v2.4, juli 2026, §4/§5):
   burst_ms, interval_ms, phase_active_sec en phase_rest_sec per modus komen
   1-op-1 uit die tabel — geen eigen interpretatie meer (de vorige versie
   van dit bestand gokte op de `braceletDoes`-omschrijvingstekst, dat was
   fout zodra de echte spec beschikbaar kwam).

   Wat WEL exact overeenkomt met de firmware:
     - het RITME: burst_ms aan, interval_ms uit, zo vaak als phase_active_sec
       toelaat, dan phase_rest_sec stilte — precies de firmware-lus uit
       spec §6.1/§7.3.
     - de jitter-laag (§6.2): om en om een klein beetje sneller/trager dan
       interval_ms, binnen de in de spec gegeven marge.

   Wat NIET kan overeenkomen (platformgrens, geen bouwfout):
     - AMPLITUDE (100/80/65/50/40% — spec §3B). React Native's Vibration-
       API kent geen sterkteregeling, exact dezelfde beperking als
       breath-haptics.ts al documenteert. Alle 5 modi voelen hier dus even
       "hard" aan; enkel RITME en PAUZE-lengte maken het verschil.
     - Fade-in/fade-out per puls (§6.3) — zelfde reden.
     - De fysieke LRA-textuur (~150–250 Hz resonantie, spec §2.1) — de
       telefoon heeft een ander motortype.
     - iOS negeert de opgegeven aan-duur en maakt van elke puls een vaste
       tik (zelfde platformgrens als breath-haptics.ts beschrijft) — het
       VERSCHIL in burst_ms tussen modi is op iPhone dus minder voelbaar
       dan op Android; interval/pauze-ritme blijft overal het onderscheid.

   Kortom: dit laat het RITME van de echte firmware voelen, niet de
   volledige sensorische intensiteit — dat laatste kan alleen de echte
   bracelet. */

import { BraceletMode } from './ble-contract';
import { Vibration } from 'react-native';

type ModeHapticSpec = {
  burstMs: number;
  intervalMs: number;
  /** Max afwijking op interval_ms, zie spec §6.2 ("±10%" e.d.) — hier
   *  deterministisch om-en-om toegepast (de array wordt herhaald afgespeeld,
   *  dus "echte" randomness per lus is hier niet aan de orde). */
  jitterMs: number;
  activeSec: number;
  restSec: number;
};

/* Index/volgorde en waardes: spec §5 "Snel-referentie — alle modi". */
const SPECS: Record<BraceletMode, ModeHapticSpec> = {
  [BraceletMode.Gamma]: { burstMs: 120, intervalMs: 200, jitterMs: 15, activeSec: 20, restSec: 10 },
  [BraceletMode.Beta]: { burstMs: 80, intervalMs: 200, jitterMs: 15, activeSec: 40, restSec: 20 },
  [BraceletMode.Alpha]: { burstMs: 60, intervalMs: 300, jitterMs: 22, activeSec: 20, restSec: 25 },
  [BraceletMode.Theta]: { burstMs: 40, intervalMs: 500, jitterMs: 37, activeSec: 10, restSec: 30 },
  [BraceletMode.Delta]: { burstMs: 30, intervalMs: 1000, jitterMs: 75, activeSec: 5, restSec: 40 },
};

/** Eén volledige active+rest-cyclus (spec §6.1: `run_active_phase` dan
 *  `wait(phase_rest_sec)`, herhalen) als React Native Vibration-patroon
 *  ([0, aan, uit, aan, uit, ..., lange rust]). `Vibration.vibrate(p, true)`
 *  speelt deze array dan precies zo herhaald af als de firmware-lus. */
function buildPattern(spec: ModeHapticSpec): number[] {
  const out: number[] = [0];
  const activeMs = spec.activeSec * 1000;
  let elapsed = 0;
  let i = 0;
  while (elapsed < activeMs) {
    const burst = Math.min(spec.burstMs, activeMs - elapsed);
    out.push(burst);
    elapsed += burst;
    if (elapsed >= activeMs) break;
    const jitterSign = i % 2 === 0 ? 1 : -1;
    const interval = Math.max(10, Math.min(spec.intervalMs + jitterSign * spec.jitterMs, activeMs - elapsed));
    out.push(interval);
    elapsed += interval;
    i += 1;
  }
  out.push(spec.restSec * 1000);
  return out;
}

const PATTERNS: Record<BraceletMode, number[]> = {
  [BraceletMode.Gamma]: buildPattern(SPECS[BraceletMode.Gamma]),
  [BraceletMode.Beta]: buildPattern(SPECS[BraceletMode.Beta]),
  [BraceletMode.Alpha]: buildPattern(SPECS[BraceletMode.Alpha]),
  [BraceletMode.Theta]: buildPattern(SPECS[BraceletMode.Theta]),
  [BraceletMode.Delta]: buildPattern(SPECS[BraceletMode.Delta]),
};

/** Speelt de preview-reeks van één modus herhaald af, tot stopModePreviewHaptic().
 *  Faalt stil: een toestel/emulator zonder trilmotor mag niets breken. */
export function playModePreviewHaptic(mode: BraceletMode): void {
  try {
    Vibration.cancel();
    Vibration.vibrate(PATTERNS[mode], true);
  } catch {
    /* stil */
  }
}

export function stopModePreviewHaptic(): void {
  try {
    Vibration.cancel();
  } catch {
    /* stil */
  }
}
