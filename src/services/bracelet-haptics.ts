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

   MECHANISME-KEUZE (4 okt 2026, herzien — zie het gesprek): er bestaan
   twee aparte, allebei gevalideerde routes naar kalmerende pols-haptiek:
     - PIV (0,08-0,15 Hz): werkt via EXPLICIETE ademhalings-synchronisatie
       — de gebruiker ademt bewust mee.
     - Doppel (~0,67-1,08 Hz, 20% onder rust-hartslag): werkt IMPLICIET —
       geen ademinstructie, enkel een hartslag-achtig ritme.
   VIBEZCORE's bracelet geeft GEEN ademinstructie (dat is een losse,
   optionele laag) — Doppel is dus de mechanistisch betere match, niet
   PIV. Eerdere versie van dit bestand koos per ongeluk tóch de
   PIV-waardes; hersteld naar het Doppel-geankerde model.

   PER MODUS, met bronvermelding en eerlijke vertrouwensgraad:

   Calm Control — 0,97 Hz. 🟢 Directe evidence: Doppel, een gepubliceerde
   RCT (Nature Sci Rep 2017) met een pols-wearable die ~20% ONDER
   rust-hartslag trilt (gemiddeld 58,2 BPM ≈ 0,97 Hz) — significant
   lagere skin-conductance (p=0,029) EN angst (p=0,007) vs controle.

   Sleep — 0,60 Hz, Clarity — 0,80 Hz. 🟠 Extrapolatie/interpolatie onder
   de Doppel-ankerwaarde — geen directe bron voor deze twee exacte
   getallen, wel logisch (dieper dan "kalm" moet trager zijn).

   Sharp Focus — 1,50 Hz. 🟡 Ontwerp-hypothese: boven de Doppel-
   ankerwaarde (Doppel's eigen studie beschrijft zelf "slow vibrations
   calming, faster vibrations increase focus"), getemperd door
   Yerkes-Dodson (focus = gematigde, niet piek-arousal — dus niet te
   dicht bij Boost).

   Boost — 2,75 Hz. 🟡 Ontwerp-hypothese: richting ondersteund (sneller
   ritme → hogere ervaren urgentie, meerdere bronnen w.o. BoostMeUp),
   geen bron valideert dit exacte getal.

   NIET kan overeenkomen met echte hardware (platformgrens, geen
   bouwfout): AMPLITUDE (React Native's Vibration-API kent geen
   sterkteregeling) en een ECHTE vloeiende envelope. De "smooth"-modi
   hieronder zijn dus NIET een echte PIV/Hallihan-stijl op-/afbouwende
   golf — enkel een korte PULS PER CYCLUS (sparse pulse repetition).
   Perceptueel een ander signaal dan een echte envelope; eerlijk zo
   benoemd, niet verkocht als "smooth". Op echte firmware (met
   amplitude-controle) hoort Sleep/Clarity/Calm Control wél een
   vloeiende op-/afbouw te krijgen, Focus/Boost een scherpe pulse-train —
   die keuze blijft overeind, enkel de telefoon kan 'm niet uitvoeren. */

import { BraceletMode } from './ble-contract';
import { Vibration } from 'react-native';

type ModeHapticSpec = {
  /** Validated/semi-validated herhalingsfrequentie — zie bestandscomment
   *  per modus voor bron en vertrouwensgraad. */
  envelopeHz: number;
  /** 'sparse-pulse' = langzame modi, één korte tik per cyclus — géén
   *  echte vloeiende op-/afbouw (zie bestandscomment, dat kan de
   *  telefoon niet). 'pulse-train' = snellere modi, een duidelijke
   *  aan/uit-pulsreeks per cyclus. */
  waveform: 'sparse-pulse' | 'pulse-train';
  /** Voor 'sparse-pulse': duur van de representatieve tik. Voor
   *  'pulse-train': duur van de AAN-fase binnen elke cyclus. */
  onMs: number;
};

/* Doppel-geankerd model (zie bestandscomment) — vervangt het eerdere
   PIV-geankerde model (0.10/0.18/0.35/1.25/3.70). */
const SPECS: Record<BraceletMode, ModeHapticSpec> = {
  [BraceletMode.Gamma]: { envelopeHz: 2.75, waveform: 'pulse-train', onMs: 120 },
  [BraceletMode.Beta]: { envelopeHz: 1.50, waveform: 'pulse-train', onMs: 200 },
  [BraceletMode.Alpha]: { envelopeHz: 0.97, waveform: 'sparse-pulse', onMs: 200 },
  [BraceletMode.Theta]: { envelopeHz: 0.80, waveform: 'sparse-pulse', onMs: 220 },
  [BraceletMode.Delta]: { envelopeHz: 0.60, waveform: 'sparse-pulse', onMs: 250 },
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
