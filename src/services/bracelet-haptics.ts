/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Voelbare preview van de 5 bracelet-modi, op de telefoon.

   HERBOUWD 4 okt 2026 — TWEEDE RONDE (operator: "ik heb het gevoel dat er
   verkeerd wordt geredeneerd, er is geen enkel haptic ritme dat rust gaat
   brengen, bv. sleep voelt te snel/hard"). De EERSTE fix van vandaag
   (commit met PWM-achtige "sine-zwel" van 7 micro-tikjes) loste het
   verkeerde probleem op. Grondig herzocht, elke bron opnieuw apart
   gecheckt tegen de originele publicatie:

   FOUT #1 — AMPLITUDE. React Native's `Vibration.vibrate(pattern)` stuurt
   op Android `VibrationEffect.createWaveform(timings, amplitudes=-1, …)`
   — amplitude -1 = VibrationEffect.DEFAULT_AMPLITUDE, dus ELKE puls
   (ook de "zachte" 12-24ms randjes van de vorige zwel) vuurde op VOLLE
   kracht af. Dat verklaart "hard": de vorm (duur) van een puls veranderen
   deed niets aan hoe hard hij aanvoelde.
     Oplossing: `expo-haptics` (al elders in de app gebruikt, bv. voor
     tab-taps) gebruikt ZELF `VibrationEffect.createWaveform` met ECHTE,
     lage amplitudes — geverifieerd in de package-broncode
     (node_modules/expo-haptics/android/.../HapticsImpactType.kt):
       Soft/Light  → 50ms @ amplitude 30/255 (≈12%)
       Medium/Rigid→ 43ms @ amplitude 50/255 (≈20%)
       Heavy       → 60ms @ amplitude 70/255 (≈27%)
     Dit bestand gebruikt nu UITSLUITEND `Haptics.impactAsync(style)`,
     zelf getimed via setTimeout — geen rauwe `Vibration` meer.

   FOUT #2 — AANTAL PULSEN PER CYCLUS. Onderzoek naar vibrotactiele
   valentie (affective-ratings-literatuur, zie bronnen) is expliciet:
   "repeated short vibrations were felt to be alarming and unpleasant"
   terwijl "long vibrations were perceived as pleasant". De vorige zwel
   (7 korte tikjes per cyclus) deed structureel het tegenovergestelde van
   wat "kalm" vraagt — ongeacht de sinusvorm.
     Oplossing: terug naar WEINIG pulsen per cyclus (1-2), niet veel.

   FOUT #3 — VORM VAN DOPPEL ZELF NIET GEBRUIKT. Doppel (de sterkste
   directe bron, zie hieronder) is zelf geen "zwel" — de eigen
   productbeschrijving noemt het expliciet "a double heartbeat-like
   rhythm tactile sensation" (lub-dub, twee korte tikken per cyclus,
   zoals een echt hartslaggeluid S1→S2). Vorige versie verzon een eigen
   7-pulse sinusvorm die geen basis had in de geciteerde bron.
     Oplossing: Sleep/Clarity/Calm Control spelen nu een ECHTE lub-dub
     (1 of 2 tikken, Soft/Light) i.p.v. een zelfverzonnen zwel.

   ARCHITECTUUR (ongewijzigd): envelopeHz (herhalingsritme) blijft het
   Doppel-geankerde model — zie HAPTIC_RESEARCH_BASIS.md §5, "niet
   verder wijzigen op basis van literatuur". Enkel de PULSVORM (aantal
   tikken + amplitude per tik) binnen elke cyclus is herzien.

   PER MODUS:

   Sleep — 0,60 Hz, 1 zachte tik (Soft) per cyclus. Geen lub-dub: het
   traagste/diepste ritme, bewust het minst aanwezige signaal — "long
   [gap], pleasant" i.p.v. nog een extra tik toevoegen.

   Clarity & Relax — 0,80 Hz, lub-dub (Soft+Soft) per cyclus.

   Calm Control — 0,97 Hz, lub-dub (Soft+Light). 🟢 Dit is het enige punt
   met directe evidence: Doppel, Azevedo et al. (2017, Scientific
   Reports 7:2285) — pols-wearable, ~20% onder rust-hartslag (gem. 58,2
   BPM ≈ 0,97 Hz), EIGEN "double heartbeat-like rhythm"-vorm, significant
   lagere skin-conductance (p=0,029) EN angst (p=0,007) vs controle.
   Aanvullend: Zhou, Murata & Watanabe (2020, IEEE Haptics Symposium,
   "The Calming Effect of Heartbeat Vibration") — tweede, onafhankelijke
   hartslag-vibratie-studie die fysiologische ontspanning (HRV) bevestigt
   via hetzelfde mechanisme.

   Sharp Focus — 1,50 Hz, 1 brisk tik (Medium) per cyclus — bewust GEEN
   lub-dub: ander karakter dan de kalme familie (scherp, alert), hogere
   amplitude (Medium i.p.v. Soft) — vibrotactiele affective-ratings-
   literatuur: amplitude correleert positief met arousal.

   Boost — 2,75 Hz, 1 tik (Heavy) per cyclus — snelste ritme + hoogste
   amplitude, zelfde arousal-principe verder doorgetrokken.

   GEVAARLIJKE RICHTING EXPLICIET VERMEDEN: "Increasing Heart Rate and
   Anxiety Level with Vibrotactile and Audio Presentation of Fast
   Heartbeat" (ACM, 2023) toont dat een VERSNELD hartslag-ritme angst/
   hartslag juist VERHOOGT — bevestigt waarom Sleep/Clarity/Calm Control
   trager dan rust-hartslag moeten blijven (wat al zo was) en nooit
   sneller gemaakt mogen worden.

   NIET kan overeenkomen met echte hardware (platformgrens, geen
   bouwfout): de telefoon heeft een ander motortype dan de bracelet
   (Vybronics VG0640001D LRA, 210 Hz resonantie) — dit blijft een
   benadering, nu wel met echte lage amplitude i.p.v. enkel getimede
   on/off-pulsen.

   Primaire bronnen (elk apart gecheckt):
   - Azevedo et al. (2017). Scientific Reports 7, 2285.
     https://www.nature.com/articles/s41598-017-02274-2
   - Zhou, Murata & Watanabe (2020). "The Calming Effect of Heartbeat
     Vibration." IEEE Haptics Symposium (HAPTICS), 677–683.
   - "Increasing Heart Rate and Anxiety Level with Vibrotactile and Audio
     Presentation of Fast Heartbeat." ACM (2023).
     https://dl.acm.org/doi/fullHtml/10.1145/3577190.3614161
   - Vibrotactile affective-ratings-literatuur (amplitude ↔ arousal/
     valence; "repeated short vibrations... alarming" vs "long
     vibrations... pleasant") — samenvattend overzicht geciteerd in het
     gesprek van 4 okt 2026.
   - expo-haptics Android-broncode (amplitude-waardes per impact-style),
     geverifieerd tegen node_modules/expo-haptics/android/.../
     HapticsImpactType.kt in dit project. */

import { BraceletMode } from './ble-contract';
import * as Haptics from 'expo-haptics';

type Beat = {
  /** Wanneer (ms na cyclusstart) deze tik afvuurt. */
  atMs: number;
  style: Haptics.ImpactFeedbackStyle;
};

type ModeHapticSpec = {
  /** Doppel-geankerd herhalingsritme — zie bestandscomment per modus
   *  voor bron en vertrouwensgraad. Ongewijzigd t.o.v. vorige ronde. */
  cycleMs: number;
  /** 1 tik (Sleep/Focus/Boost) of lub-dub (Clarity/Calm Control) — zie
   *  bestandscomment "Fout #3" voor waarom dit geen zelfverzonnen vorm
   *  meer is. Elke `style` gebruikt expo-haptics' eigen, echte lage
   *  amplitude (zie "Fout #1"), nooit de rauwe Vibration-API. */
  beats: Beat[];
};

const hz = (envelopeHz: number) => Math.round(1000 / envelopeHz);

const SPECS: Record<BraceletMode, ModeHapticSpec> = {
  [BraceletMode.Delta]: {
    // Sleep — 0,60 Hz, 1 zachte tik, geen lub-dub.
    cycleMs: hz(0.6),
    beats: [{ atMs: 0, style: Haptics.ImpactFeedbackStyle.Soft }],
  },
  [BraceletMode.Theta]: {
    // Clarity & Relax — 0,80 Hz, lub-dub (Soft+Soft).
    cycleMs: hz(0.8),
    beats: [
      { atMs: 0, style: Haptics.ImpactFeedbackStyle.Soft },
      { atMs: Math.round(hz(0.8) * 0.3), style: Haptics.ImpactFeedbackStyle.Soft },
    ],
  },
  [BraceletMode.Alpha]: {
    // Calm Control — 0,97 Hz. 🟢 Doppel-geankerd, lub-dub (Soft+Light).
    cycleMs: hz(0.97),
    beats: [
      { atMs: 0, style: Haptics.ImpactFeedbackStyle.Soft },
      { atMs: Math.round(hz(0.97) * 0.3), style: Haptics.ImpactFeedbackStyle.Light },
    ],
  },
  [BraceletMode.Beta]: {
    // Sharp Focus — 1,50 Hz, 1 brisk tik (Medium), geen lub-dub.
    cycleMs: hz(1.5),
    beats: [{ atMs: 0, style: Haptics.ImpactFeedbackStyle.Medium }],
  },
  [BraceletMode.Gamma]: {
    // Boost — 2,75 Hz, 1 tik (Heavy), hoogste amplitude + tempo.
    cycleMs: hz(2.75),
    beats: [{ atMs: 0, style: Haptics.ImpactFeedbackStyle.Heavy }],
  },
};

/* Scheduler-state — generation-counter i.p.v. een losse `active`-bool,
   zodat een snel op elkaar volgende play(modeA) → play(modeB) nooit de
   oude cyclus van modeA kan laten doortikken nadat modeB al gestart is. */
let generation = 0;
const pendingTimeouts: ReturnType<typeof setTimeout>[] = [];

function clearPending(): void {
  pendingTimeouts.forEach(clearTimeout);
  pendingTimeouts.length = 0;
}

function scheduleCycle(spec: ModeHapticSpec, myGeneration: number): void {
  if (myGeneration !== generation) return;
  spec.beats.forEach((beat) => {
    const id = setTimeout(() => {
      if (myGeneration !== generation) return;
      Haptics.impactAsync(beat.style).catch(() => {
        /* stil — toestel/emulator zonder trilmotor mag niets breken */
      });
    }, beat.atMs);
    pendingTimeouts.push(id);
  });
  const nextId = setTimeout(() => scheduleCycle(spec, myGeneration), spec.cycleMs);
  pendingTimeouts.push(nextId);
}

/** Speelt de preview-reeks van één modus herhaald af, tot stopModePreviewHaptic().
 *  Faalt stil: een toestel/emulator zonder trilmotor mag niets breken. */
export function playModePreviewHaptic(mode: BraceletMode): void {
  generation += 1;
  clearPending();
  scheduleCycle(SPECS[mode], generation);
}

export function stopModePreviewHaptic(): void {
  generation += 1;
  clearPending();
}
