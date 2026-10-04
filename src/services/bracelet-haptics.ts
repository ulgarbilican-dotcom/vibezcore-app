/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Voelbare preview van de 5 bracelet-modi, op de telefoon.

   HERONTWORPEN 4 okt 2026, op basis van grondig geverifieerd onderzoek
   (elke bron hieronder apart gecheckt tegen de originele publicatie —
   zie het gesprek). Vervangt het eerdere ontwerp dat op het ongeverifieerde
   "Haptic Bracelet Spec v2.4"-document leunde.

   ARCHITECTUUR: twee gescheiden lagen, niet één PPS-getal.
     - CARRIER: de fysieke resonantiefrequentie van de LRA-motor zelf
       (±200-250 Hz voor een typische coin-LRA zoals de Vybronics
       VG0640001D — 210 Hz resonantie, geverifieerd tegen de echte
       datasheet). Vast, verandert niet per modus. De telefoon heeft een
       ANDER motortype — dit is dus sowieso niet na te bootsen, net als
       eerder al gedocumenteerd.
     - ENVELOPE/RITME: hoe vaak een puls terugkomt. DIT is wat de 5 modi
       van elkaar onderscheidt, en waar onderstaande getallen op rusten.
   Deze scheiding is zelf het patroon dat de geciteerde onderzoeken
   gebruiken (bv. Hallihan & Siegle: 89 Hz carrier gemoduleerd op 0,1 Hz
   of 4 Hz) — niet een losse aanname.

   PER MODUS, met bronvermelding en eerlijke vertrouwensgraad:

   Sleep — 0,10 Hz envelope. Sterkste anker: PIV, een gepubliceerde
   vibrotactiele ademhalings-pacer (Stanford/ACM CHI 2020/PIV++), gebruikt
   voor affectregulatie, 0,08-0,15 Hz. PIV++ vond een gematigd effect
   (Cohen's d=0,33) op angstreductie vs d=0,05 controle.

   Clarity — 0,18 Hz, Calm Control — 0,35 Hz. Interpolatie tussen Sleep
   (0,10 Hz) en de Doppel-ankerwaarde (zie Sharp Focus) — geen directe
   bron, wel logisch tussenliggend op dezelfde monotone schaal.

   Sharp Focus — gebaseerd op Doppel: een gepubliceerde RCT (Nature
   Sci Rep 2017) met een pols-wearable die ~20% ONDER rust-hartslag trilt
   (gemiddeld 58,2 BPM ≈ 0,97 Hz, range 40-65 BPM ≈ 0,67-1,08 Hz) —
   significant lagere skin-conductance (p=0,029) EN angst (p=0,007) vs
   controle. Focus hoort per Yerkes-Dodson GEMATIGDE arousal te zijn
   (piek-focus ≠ piek-opwinding), dus net iets boven Doppel se kalme
   ankerwaarde: 1,25 Hz.

   Boost — 3,70 Hz. Richting ondersteund (meerdere bronnen: sneller ritme
   → hogere ervaren urgentie/arousal — bv. BoostMeUp, 72 deelnemers,
   Apple Watch, snel ritme → meer angst/lagere HRV/slechtere prestatie als
   TEGENGESTELDE richting bevestigd), maar geen bron valideert exact dit
   getal als "optimaal Boost". Minst onderbouwde van de vijf.

   NIET kan overeenkomen met echte hardware (platformgrens, geen
   bouwfout): AMPLITUDE (React Native's Vibration-API kent geen
   sterkteregeling), een ECHTE vloeiende envelope (enkel aan/uit, geen
   geleidelijke op-/afbouw — de "smooth"-modi hieronder worden daarom
   benaderd met één korte representatieve tik per envelope-cyclus, niet
   een echte vloeiende golf), en de carrier-textuur zelf. */

import { BraceletMode } from './ble-contract';
import { Vibration } from 'react-native';

type ModeHapticSpec = {
  /** Validated/semi-validated herhalingsfrequentie — zie bestandscomment
   *  per modus voor bron en vertrouwensgraad. */
  envelopeHz: number;
  /** 'smooth' = langzame modi, benaderd met één korte tik per cyclus
   *  (de telefoon kan geen echte vloeiende op-/afbouw). 'pulse-train' =
   *  snellere modi, een echte aan/uit-pulsreeks per cyclus. */
  waveform: 'smooth' | 'pulse-train';
  /** Voor 'smooth': duur van de representatieve tik. Voor 'pulse-train':
   *  duur van de AAN-fase binnen elke cyclus. */
  onMs: number;
};

const SPECS: Record<BraceletMode, ModeHapticSpec> = {
  [BraceletMode.Gamma]: { envelopeHz: 3.70, waveform: 'pulse-train', onMs: 110 },
  [BraceletMode.Beta]: { envelopeHz: 1.25, waveform: 'pulse-train', onMs: 200 },
  [BraceletMode.Alpha]: { envelopeHz: 0.35, waveform: 'smooth', onMs: 200 },
  [BraceletMode.Theta]: { envelopeHz: 0.18, waveform: 'smooth', onMs: 220 },
  [BraceletMode.Delta]: { envelopeHz: 0.10, waveform: 'smooth', onMs: 250 },
};

/** Eén volledige envelope-cyclus als React Native Vibration-patroon
 *  ([0, aan, uit]). `Vibration.vibrate(p, true)` herhaalt 'm. */
function buildPattern(spec: ModeHapticSpec): number[] {
  const cycleMs = Math.round(1000 / spec.envelopeHz);
  const on = Math.min(spec.onMs, cycleMs - 10);
  const off = cycleMs - on;
  return [0, on, off];
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
