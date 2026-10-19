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
import { isLibraryPlaying, subscribeLibraryPlaying } from './library-priority';

const KEY = 'vibezcore.stateControl.hear';

let hear = false;
const listeners = new Set<(v: boolean) => void>();

/* Audio-voorrang (19 okt 2026, operator: "speelt de Audio Library, dan geen
   hartslaggeluid; de bibliotheek blijft spelen"): de trildienst (Android)
   krijgt de keuze ÉN de bibliotheek mee. De opgeslagen keuze blijft staan;
   stopt de bibliotheek, dan klinkt de hartslag weer op de volgende slag. */
function pushNativeSound(): void {
  setNativeSessionSound(hear && !isLibraryPlaying());
}
subscribeLibraryPlaying(() => pushNativeSound());

/** Moet het hartslaggeluid NU klinken? = keuze van de gebruiker en de
 *  Audio Library speelt niet. */
export function getStateHearNow(): boolean {
  return hear && !isLibraryPlaying();
}

export function subscribeStateHear(cb: (v: boolean) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

void AsyncStorage.getItem(KEY)
  .then((v) => {
    if (v === '1' && !hear) {
      hear = true;
      pushNativeSound();
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
  pushNativeSound();
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
