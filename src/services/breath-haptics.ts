/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Haptisch alfabet voor de ademfasen

   Doel (operator, 3 augustus 2026): je moet ZONDER KIJKEN weten wat je moet
   doen. Dat lukte niet: elke fase trilde één keer, alleen met een andere
   duur — 60 ms voor inademen, 80 voor uitademen, 30 voor vasthouden. Die
   verschillen liggen onder de waarneemdrempel. Aan de pols voelt dat als
   drie keer hetzelfde tikje, dus moest je alsnog naar het scherm.

   Onderscheid zit daarom in RITME, niet in duur:

     INADEMEN   twee tikken, de tweede twee keer zo lang     · –
                Iets dat opbouwt. Je begint en gaat door.

     VASTHOUDEN drie korte tikjes, dicht op elkaar           · · ·
                Staccato, gaat nergens heen. Stilstand.

     UITADEMEN  één lange trilling                           ———
                Loslaten in één beweging, niets meer erna.

   Twee, drie, één — het AANTAL verschilt, niet alleen de lengte. Dat is
   bewust: op iOS negeert het systeem de opgegeven duur en voelt elke stap
   als een vaste puls. Zou het verschil alleen in duur zitten, dan zouden
   daar alle drie de fasen identiek aanvoelen. Nu telt de gebruiker er twee,
   drie of één, en dat werkt op beide platformen.

   Beide vormen van vasthouden krijgen hetzelfde signaal. Vasthouden ís
   vasthouden — of je longen nu vol of leeg zijn, je doet exact hetzelfde,
   en het scherm zegt in beide gevallen HOLD.

   De patronen blijven ruim binnen de kortste fase die we kennen (BOOST
   ademt in twee seconden in), zodat een cue nooit over de volgende heen
   loopt.

   Deze tabel is met opzet losgeknipt van de ademtoestanden: hij hoort bij
   het ADEMEN, niet bij één figuur. Als de bracelet straks dezelfde taal
   spreekt, leest hij hier mee en niet uit een tweede kopie.
   ───────────────────────────────────────────────────────────────────────── */

import type { PhaseKey } from '@/data/breath-states';
import { Vibration } from 'react-native';

/* Android leest dit als [wachten, trillen, wachten, trillen, …]; de eerste
   waarde is de aanloop en staat daarom op nul. */
export const PHASE_HAPTIC: Record<PhaseKey, number[]> = {
  /* Opbouwend: kort, pauze, dubbel zo lang. */
  inhale: [0, 45, 95, 95],
  /* Staccato: drie gelijke tikjes met korte tussenpozen. */
  'hold-in': [0, 22, 50, 22, 50, 22],
  /* Eén aaneengesloten trilling — de langste van de drie. */
  exhale: [0, 220],
  /* Gelijk aan hold-in: hetzelfde gebaar verdient hetzelfde signaal. */
  'hold-out': [0, 22, 50, 22, 50, 22],
};

/** Speel het patroon dat bij deze fase hoort.
 *
 *  Faalt stil: een trilmotor die niet meewerkt (emulator, toestel zonder
 *  motor, of een gebruiker die systeemhaptiek heeft uitgezet) mag een
 *  lopende sessie nooit onderbreken. */
export function playPhaseHaptic(phase: PhaseKey): void {
  try {
    /* `false` = niet herhalen. Zonder die tweede parameter blijft het
       patroon op sommige Android-versies eeuwig doorlopen. */
    Vibration.vibrate(PHASE_HAPTIC[phase], false);
  } catch {
    /* stil */
  }
}
