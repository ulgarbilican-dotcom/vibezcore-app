/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Haptisch alfabet voor de ademfasen

   Je moet ZONDER KIJKEN weten wat je moet doen — op de telefoon nu, en
   straks aan de pols. Dat lukte niet: elke fase trilde één keer, alleen met
   een andere duur (60 ms in, 80 uit, 30 vasthouden). Die verschillen liggen
   onder de waarneemdrempel, en één tikje aan het begin zegt bovendien niets
   over de vier seconden die erop volgen.

   Opzet van de operator (3 augustus 2026), en de juiste: ademen is DOEN, dus
   dat voel je onafgebroken. Vasthouden is NIETS doen, dus dat telt alleen.

     INADEMEN    één ononderbroken trilling, de hele fase lang
                 ██████████████████
                 Glad en aanhoudend. Zolang je het voelt, adem je in.

     UITADEMEN   ononderbroken, maar RIMPELEND
                 ▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚▚
                 Even lang aanwezig, maar met korrel erin — het stroomt weg
                 in plaats van te vullen.

     VASTHOUDEN  één tik per seconde, verder stilte
                 ·    ·    ·    ·
                 Niets loopt door, want jij ook niet. En je voelt meteen
                 hoe ver je bent: vier tikken is vier seconden.

   Waarom niet twee keer glad: zonder amplituderegeling — en die heeft geen
   van beide platformen — is TEXTUUR het enige dat twee even lange, even
   sterke trillingen kan scheiden. Glad tegenover korrelig doet dat, en het
   is dezelfde taal die de bracelet straks kan spreken; daar stuurt de
   DRV2605L de LRA en kan dit één op één over.

   Beperking om te kennen: iOS negeert opgegeven trilduur en maakt van elke
   stap een vaste puls. Daar blijft het onderscheid staan via het AANTAL —
   inademen is één puls, uitademen een dichte reeks, vasthouden een paar
   losse — maar "aanhoudend" is op iPhone niet letterlijk aanhoudend. Dat is
   een platformgrens, geen keuze. Op de bracelet speelt hij niet.

   Beide vormen van vasthouden delen hun signaal: vol of leeg, je doet exact
   hetzelfde, en het scherm zegt in beide gevallen HOLD.

   Deze tabel staat los van de ademtoestanden: hij hoort bij het ADEMEN, niet
   bij één figuur. Gaat de bracelet dezelfde taal spreken, dan leest de
   firmware hiernaar en ontstaat er geen tweede versie die uit de pas loopt.
   ───────────────────────────────────────────────────────────────────────── */

import type { PhaseKey } from '@/data/breath-states';
import { Vibration } from 'react-native';

/* De trilling vult de fase niet helemaal: de laatste tiende blijft stil.
   Die stilte is functioneel — ze kondigt de wissel aan, en zonder haar loopt
   het einde van de ene fase over het begin van de volgende heen. */
const FILL = 0.9;

/* De korrel van het uitademen. 130 aan / 55 uit is dicht genoeg om als
   doorlopend te voelen, maar grof genoeg om merkbaar te verschillen van de
   gladde inademing. Fijner dan ~40 ms uit en de motor haalt het niet meer;
   dan wordt het alsnog één egale trilling. */
const RIPPLE_ON = 130;
const RIPPLE_OFF = 55;

/* De tik van het vasthouden. Kort en droog — het mag geen zoem worden. */
const TICK = 34;
const TICK_PERIOD = 1000;

/** Eén ononderbroken trilling over de hele fase. */
function steady(secs: number): number[] {
  /* Android leest [wachten, trillen, …]; de eerste waarde is de aanloop. */
  return [0, Math.max(400, Math.round(secs * 1000 * FILL))];
}

/** Doorlopend, maar met korrel: aan/uit tot de fase vol is. */
function ripple(secs: number): number[] {
  const span = Math.max(400, Math.round(secs * 1000 * FILL));
  const out: number[] = [0];
  let used = 0;
  while (used + RIPPLE_ON <= span) {
    out.push(RIPPLE_ON);
    used += RIPPLE_ON;
    if (used + RIPPLE_OFF >= span) break;
    out.push(RIPPLE_OFF);
    used += RIPPLE_OFF;
  }
  /* Een reeks die met een pauze eindigt is een pauze te veel. */
  if (out.length % 2 === 1) out.push(RIPPLE_ON);
  return out;
}

/** Eén tik per seconde, zo vaak als de fase seconden telt. */
function tickPerSecond(secs: number): number[] {
  const count = Math.max(1, Math.round(secs));
  const out: number[] = [0, TICK];
  for (let i = 1; i < count; i += 1) {
    out.push(TICK_PERIOD - TICK);
    out.push(TICK);
  }
  return out;
}

/** Het patroon voor deze fase, passend bij de lengte ervan.
 *  Apart exporteerbaar zodat de bracelet-firmware straks dezelfde reeksen
 *  kan afleiden in plaats van een eigen versie te verzinnen. */
export function phaseHapticPattern(phase: PhaseKey, secs: number): number[] {
  if (phase === 'inhale') return steady(secs);
  if (phase === 'exhale') return ripple(secs);
  return tickPerSecond(secs);
}

/** Speel het patroon dat bij deze fase hoort.
 *
 *  Faalt stil: een trilmotor die niet meewerkt — emulator, toestel zonder
 *  motor, of systeemhaptiek uitgezet — mag een lopende sessie nooit
 *  onderbreken. */
export function playPhaseHaptic(phase: PhaseKey, secs: number): void {
  try {
    /* `false` = niet herhalen. Zonder die tweede parameter blijft het
       patroon op sommige Android-versies eeuwig doorlopen. */
    Vibration.vibrate(phaseHapticPattern(phase, secs), false);
  } catch {
    /* stil */
  }
}
