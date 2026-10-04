/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Voelbare preview van de 5 bracelet-modi, op de telefoon.

   STATUS-CORRECTIE (4 okt 2026, operator: "stop met die tabel als waarheid
   te zien, dat is ook door u samengesteld"): dit bestand noemde het
   "Haptic Bracelet Spec v2.4"-document eerder "DE ECHTE SPEC". Dat was
   fout — dat document is NIET door een firmware-engineer geverifieerd
   (operator heeft geen hardware-team). De burst_ms/interval_ms/fase-
   duren hieronder zijn dus een ONTWERP, geen vaststaand feit — zie de
   uitgebreide toelichting in ble-contract.ts.

   Wat WEL een geverifieerd wetenschappelijk principe is (meerdere
   onafhankelijke bronnen, zie het gesprek): trager pulsritme = kalmerend/
   parasympathisch, sneller ritme = alerter/sympathisch — dus de 5 modi
   moeten STRIKT monotoon vertragen van Boost (snelst) naar Sleep
   (traagst). Diepgaand onderzoek (4 okt 2026) wees uit dat de oorspronkelijke
   tabel dat zelf schond: Sharp Focus tikte sneller dan Boost (3.57 vs
   3.13 Hz) — Boost se interval hieronder is daarom verkort (200→150ms)
   zodat Boost opnieuw de snelste van de vijf is. Dat is de enige correctie
   die op een onafhankelijk, citeerbaar principe rust; de rest van de
   getallen blijft ontwerp, niet gevalideerd feit.

   Wat het ontwerp-document zelf beweert (NIET geverifieerd, enkel intern
   consistent gebruikt):
     - het RITME: burst_ms aan, interval_ms uit, zo vaak als phase_active_sec
       toelaat, dan phase_rest_sec stilte.
     - een jitter-laag: om en om een klein beetje sneller/trager dan
       interval_ms.

   Wat hoe dan ook NIET kan overeenkomen met echte hardware (platformgrens,
   geen bouwfout):
     - AMPLITUDE (100/80/65/50/40% in het document). React Native's
       Vibration-API kent geen sterkteregeling, exact dezelfde beperking als
       breath-haptics.ts al documenteert. Alle 5 modi voelen hier dus even
       "hard" aan; enkel RITME en PAUZE-lengte maken het verschil.
     - Fade-in/fade-out per puls — zelfde reden.
     - De fysieke LRA-textuur (de telefoon heeft een ander motortype dan
       een DRV2605L-aangestuurde LRA).
     - iOS negeert de opgegeven aan-duur en maakt van elke puls een vaste
       tik (zelfde platformgrens als breath-haptics.ts beschrijft) — het
       VERSCHIL in burst_ms tussen modi is op iPhone dus minder voelbaar
       dan op Android; interval/pauze-ritme blijft overal het onderscheid.

   Kortom: dit laat een ONTWERP-ritme voelen met één wetenschappelijk
   gecorrigeerde regel (Boost = snelst), niet een gevalideerde firmware-
   simulatie. */

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

/* Index/volgorde: ontwerp-document §5 "Snel-referentie — alle modi" (NIET
   hardware-geverifieerd, zie bestandscomment). Gamma se intervalMs is
   t.o.v. dat document aangepast (200→150): het origineel liet Sharp Focus
   sneller tikken dan Boost (3.57 vs 3.13 Hz), wat het enige onafhankelijk
   citeerbare principe hier schendt (Boost = hoogste arousal = snelste
   ritme). Nu: Boost 3.70 Hz, Sharp Focus 3.57 Hz — strikt monotoon. */
const SPECS: Record<BraceletMode, ModeHapticSpec> = {
  [BraceletMode.Gamma]: { burstMs: 120, intervalMs: 150, jitterMs: 15, activeSec: 20, restSec: 10 },
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
  /* React Native's Vibration-array wisselt AAN/UIT per index: even index =
     uit, oneven = aan (index 0 is de starttijd, dus ook "uit"). Als de lus
     hierboven eindigde net ná een volledig burst+interval-paar, staat de
     array op een ONEVEN lengte — de volgende push (de rust-fase) zou dan
     op een AAN-index vallen i.p.v. UIT, en de hele "rust" werd zo per
     ongeluk een ononderbroken trilling van 10-40 sec (operator, 4 okt
     2026: "voelt kort goed, dan blijft volle haptics" — exact dit). Eén
     `0`-vulwaarde duwt de pariteit terug naar een UIT-slot vóór de
     echte rust-duur gepusht wordt. */
  if (out.length % 2 === 1) out.push(0);
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
