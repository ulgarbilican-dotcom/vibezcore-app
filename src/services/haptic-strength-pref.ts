/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — State Control: sterkte van de trillingen (operator, 11 okt
   2026: "een knop waarmee de gebruiker de haptics harder of zachter
   voelbaar zet"). Drie vaste standen: Soft · Medium (standaard, = vroeger)
   · Strong. Geldt voor alle toestanden; de onderlinge verhouding blijft
   (Boost voelt altijd steviger dan Sleep). Onthouden op dit toestel.
   ───────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export type HapticStrength = 'soft' | 'medium' | 'strong';

const KEY = 'vibezcore.stateControl.strength';

/** Factor op de kracht van de motor (toestellen met amplitude-regeling). */
export const AMP_FACTOR: Record<HapticStrength, number> = { soft: 0.55, medium: 1, strong: 1.7 };
/** Factor op de tikduur (toestellen zonder amplitude-regeling). */
/* 13 okt 2026 (operator: "kan soft wat zachter"): soft 0,75 → 0,55 — gelijk
   aan de krachtfactor; voelbaar korter, minimum blijft 40 ms per tik. */
/** Kracht (0–255) voor breathwork-tikken op toestellen MET amplitude-regeling
 *  (horloge, sommige telefoons). 0 = standaardkracht van het toestel, zoals
 *  voorheen. 13 okt 2026 (operator: "zacht blijft te hard"): het horloge
 *  trilde bij breathwork altijd op standaardkracht — Soft voelde daardoor
 *  niet zacht. */
export const BREATH_AMP: Record<HapticStrength, number> = { soft: 120, medium: 0, strong: 255 };
/** Kracht op het HORLOGE (0–255), één bron voor State Control én
 *  breathwork (operator 13 okt 2026: "sterkte bij breathwork zelfde als bij
 *  State Control voor horloge"). Onder ~50 % voelt een horlogemotor tegen de
 *  pols bijna niets. */
export const WATCH_HAPTIC_LEVEL: Record<HapticStrength, number> = { soft: 155, medium: 205, strong: 255 };
export const MS_FACTOR: Record<HapticStrength, number> = { soft: 0.55, medium: 1, strong: 1.35 };

/** State Control op de TELEFOON (operator, 16 okt 2026: "Strong is te
 *  zwak" — enkel voor State Control, Breathwork blijft op MS_FACTOR):
 *  Strong duidelijk steviger. Tikduur ×1,8 (A16: Calm 42 → 76 ms) en kracht
 *  ×3 op toestellen met amplitude-regeling (Calm 24 → 72, Boost 65 → 195).
 *  Soft en Medium ongewijzigd. Het horloge staat op Strong al op 255 (max). */
export const STATE_MS_FACTOR: Record<HapticStrength, number> = { ...MS_FACTOR, strong: 1.8 };
export const STATE_AMP_FACTOR: Record<HapticStrength, number> = { ...AMP_FACTOR, strong: 3 };

/* 1 nov 2026 (operator, vervangt 29 okt "elke sessie op Strong"): "wie de app downloadt staat standaard op Strong; enkel als de gebruiker
   zelf Medium instelt, blijft dat zo tot hij zelf terug Strong zet." Strong = standaard, de keuze wordt bewaard (nieuwe sleutel: oude
   bewaarde waarden van vóór 29 okt tellen niet mee). Soft bestaat niet meer (wordt Medium).

   2 nov 2026 (operator: "ja op alles"; herzien na audit): `saved` = de bewaarde standaard (Strong tot de gebruiker "Remember" kiest),
   `strength` = wat nu speelt. "Just this time" geldt tot de sessie EINDIGT (endHapticStrengthSession), ook als je het vóór de start
   kiest; daarna weer `saved`. Eén regel voor State Control, voorproef en Breathwork, geen vlag die naar een andere sessie lekt. */
const KEY_V2 = 'vibezcore.hapticStrength.v2';
let saved: HapticStrength = 'strong';
let strength: HapticStrength = 'strong';
const listeners = new Set<(v: HapticStrength) => void>();
void AsyncStorage.removeItem(KEY).catch(() => {});
void AsyncStorage.getItem(KEY_V2)
  .then((v) => {
    if (v === 'medium' && saved === 'strong') {
      saved = 'medium';
      if (strength === 'strong') apply('medium');
    }
  })
  .catch(() => {});

function apply(v: HapticStrength): void {
  if (v === strength) return;
  strength = v;
  listeners.forEach((l) => l(v));
}

/** Einde van een sessie (State Control, voorproef, Breathwork): een keuze "Just this time" vervalt, terug naar de bewaarde stand. */
export function endHapticStrengthSession(): void {
  apply(saved);
}

export function getHapticStrength(): HapticStrength {
  return strength;
}

/** De bewaarde standaard (Strong tot de gebruiker zelf iets anders onthoudt). */
export function getSavedHapticStrength(): HapticStrength {
  return saved;
}

/** Kiezen én onthouden (Remember, of vanaf de Haptics-pagina van het horloge). */
export function setHapticStrength(vIn: HapticStrength): void {
  const v: HapticStrength = vIn === 'soft' ? 'medium' : vIn;
  if (v !== saved) {
    saved = v;
    void AsyncStorage.setItem(KEY_V2, v).catch(() => {});
  }
  apply(v);
}

/** Enkel voor deze sessie ("Just this time") — vervalt bij endHapticStrengthSession. */
export function setHapticStrengthForSession(vIn: HapticStrength): void {
  apply(vIn === 'soft' ? 'medium' : vIn);
}

export function subscribeHapticStrength(cb: (v: HapticStrength) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useHapticStrength(): HapticStrength {
  const [v, setV] = useState(strength);
  /* Audit 2 nov: bij het inschrijven ook de huidige waarde overnemen (kon tussen eerste render en effect veranderen). */
  useEffect(() => {
    setV(strength);
    return subscribeHapticStrength(setV);
  }, []);
  return v;
}
