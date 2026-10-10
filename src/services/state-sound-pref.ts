/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — State Control: Feel of Feel & Hear (operator, 10 okt 2026:
   "ja voor Feel en Hear … dat is een keuze voor State Control").

   Feel = enkel trillen (standaard). Feel & Hear = op elke slag ook het
   hartslaggeluid (zelfde opnames als de Resting Heart Rate-pagina). Op
   Android speelt de trilmotor-service het geluid zelf af, exact op de tik
   en ook met het scherm op slot; elders speelt de app het af zolang ze open
   is. Geen uitleg of claims in de app — enkel de keuze. */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { setNativeSessionSound } from '../../modules/state-haptics';

const KEY = 'vibezcore.stateControl.hear';

let hear = false;
const listeners = new Set<(v: boolean) => void>();

void AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v === '1' && !hear) {
      hear = true;
      setNativeSessionSound(true);
      listeners.forEach((l) => l(true));
    }
  })
  .catch(() => {});

export function getStateHear(): boolean {
  return hear;
}

export function setStateHear(v: boolean): void {
  if (v === hear) return;
  hear = v;
  /* Ook tijdens een lopende sessie: de service leest de vlag bij elke tik. */
  setNativeSessionSound(v);
  listeners.forEach((l) => l(v));
  void AsyncStorage.setItem(KEY, v ? '1' : '0').catch(() => {});
}

export function useStateHear(): boolean {
  const [v, setV] = useState(hear);
  useEffect(() => {
    listeners.add(setV);
    setV(hear);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return v;
}
