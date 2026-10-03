/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — JS-kant van de Wear OS-brug.

   Enkel Android: Wear OS-horloges koppelen via Google Play Services
   (Wearable Data Layer), dat bestaat niet op iOS. `index.ts` blijft hier
   bewust zonder platform-check — de module zelf is Android-only gelinkt
   (expo-module.config.json: "platforms": ["android"]), dus op iOS/web is
   `requireNativeModule` altijd een no-op via de catch hieronder, net als
   breath-background dat voor zijn eigen web/Expo Go-val doet. */

import { requireNativeModule } from 'expo-modules-core';

export type WearBreathPhase = {
  key: string;
  secs: number;
  /** phaseHapticPattern(key, secs) uit breath-haptics.ts — geen eigen
   *  berekening hier, zie de toelichting in WearBreathModule.kt. */
  pattern: number[];
};

export type WearBreathSession = {
  phases: WearBreathPhase[];
  rounds: number;
  modeName: string;
};

type WearBreathNativeModule = {
  isWatchReachable(): Promise<boolean>;
  sendBreathSession(session: WearBreathSession): void;
  stopBreathSession(): void;
};

let native: WearBreathNativeModule | null = null;
try {
  native = requireNativeModule<WearBreathNativeModule>('WearBreath');
} catch {
  native = null;
}

/** `false` op iOS/web/Expo Go, en op Android zonder gekoppeld horloge —
 *  de UI gebruikt dit om de watch-indicator pas te tonen als er écht iets
 *  is om naar te sturen. */
export async function isWatchReachable(): Promise<boolean> {
  try {
    return (await native?.isWatchReachable()) ?? false;
  } catch {
    return false;
  }
}

/** Stuurt de volledige sessie in één keer. Faalt stil: een horloge dat er
 *  niet is (of niet bereikbaar) mag de telefoon-sessie nooit raken — exact
 *  dezelfde regel als startBackgroundBreathSession(). */
export function sendBreathSessionToWatch(session: WearBreathSession): void {
  try {
    native?.sendBreathSession(session);
  } catch {
    /* stil */
  }
}

export function stopBreathSessionOnWatch(): void {
  try {
    native?.stopBreathSession();
  } catch {
    /* stil */
  }
}
