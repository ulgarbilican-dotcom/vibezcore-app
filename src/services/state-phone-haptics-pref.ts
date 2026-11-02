/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — State Control: trilt de TELEFOON mee? (operator, 2 nov 2026:
   "bij State Control heb ik geen button om haptic op telefoon af te zetten" +
   "zelfde principe: vragen enkel nu of voor altijd en voor alle sessies").

   Zelfde opbouw als haptic-strength-pref.ts:
   · `saved`  = de bewaarde standaard (aan tot de gebruiker "Remember" kiest);
   · `phone`  = wat NU geldt. "Just this time" verandert enkel `phone`; op het
     einde van de sessie (endPhoneHapticsSession) geldt weer `saved`.
   Uit = de telefoon trilt niet; het hartslaggeluid (Haptic + Audio) en een
   gekoppeld horloge lopen gewoon door.
   ───────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const KEY = 'vibezcore.stateControl.phoneHaptics';

let saved = true;
let phone = true;
const listeners = new Set<(v: boolean) => void>();

function apply(v: boolean): void {
  if (v === phone) return;
  phone = v;
  listeners.forEach((l) => l(v));
}

void AsyncStorage.getItem(KEY)
  .then((v) => {
    saved = v !== '0';
    apply(saved);
  })
  .catch(() => {});

/** Trilt de telefoon NU mee in State Control? */
export function getPhoneHapticsNow(): boolean {
  return phone;
}

/** De bewaarde standaard (aan tot de gebruiker zelf iets anders onthoudt). */
export function getSavedPhoneHaptics(): boolean {
  return saved;
}

/** "Just this time": enkel deze sessie. */
export function setPhoneHapticsForSession(v: boolean): void {
  apply(v);
}

/** "Remember": voor alle volgende sessies. */
export function setPhoneHaptics(v: boolean): void {
  saved = v;
  apply(v);
  void AsyncStorage.setItem(KEY, v ? '1' : '0').catch(() => {});
}

/** Einde van een sessie: een keuze voor "enkel deze keer" vervalt. */
export function endPhoneHapticsSession(): void {
  apply(saved);
}

export function subscribePhoneHaptics(cb: (v: boolean) => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

export function usePhoneHaptics(): boolean {
  const [v, setV] = useState(phone);
  useEffect(() => {
    listeners.add(setV);
    setV(phone);
    return () => {
      listeners.delete(setV);
    };
  }, []);
  return v;
}
