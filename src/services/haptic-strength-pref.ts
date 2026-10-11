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
export const MS_FACTOR: Record<HapticStrength, number> = { soft: 0.75, medium: 1, strong: 1.35 };

let strength: HapticStrength = 'medium';
const listeners = new Set<(v: HapticStrength) => void>();

void AsyncStorage.getItem(KEY)
  .then((v) => {
    if ((v === 'soft' || v === 'strong') && v !== strength) {
      strength = v;
      listeners.forEach((l) => l(v));
    }
  })
  .catch(() => {});

export function getHapticStrength(): HapticStrength {
  return strength;
}

export function setHapticStrength(v: HapticStrength): void {
  if (v === strength) return;
  strength = v;
  listeners.forEach((l) => l(v));
  void AsyncStorage.setItem(KEY, v).catch(() => {});
}

export function subscribeHapticStrength(cb: (v: HapticStrength) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function useHapticStrength(): HapticStrength {
  const [v, setV] = useState(strength);
  useEffect(() => subscribeHapticStrength(setV), []);
  return v;
}
