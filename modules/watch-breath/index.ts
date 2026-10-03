/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — JS-kant van de Apple Watch-brug. Enkel iOS (WatchConnectivity
   bestaat niet op Android) — net als wear-breath/index.ts voor Android,
   bewust zonder platform-check: de module is alleen apple-gelinkt
   (expo-module.config.json: "platforms": ["apple"]), dus op Android/web
   is `requireNativeModule` altijd een no-op via de catch hieronder. */

import { requireNativeModule } from 'expo-modules-core';

export type WatchBreathPhase = {
  key: string;
  secs: number;
};

export type WatchBreathSession = {
  phases: WatchBreathPhase[];
  rounds: number;
  modeName: string;
};

type WatchBreathNativeModule = {
  isWatchReachable(): Promise<boolean>;
  sendBreathSession(session: WatchBreathSession): void;
  stopBreathSession(): void;
};

let native: WatchBreathNativeModule | null = null;
try {
  native = requireNativeModule<WatchBreathNativeModule>('WatchBreath');
} catch {
  native = null;
}

export async function isWatchReachable(): Promise<boolean> {
  try {
    return (await native?.isWatchReachable()) ?? false;
  } catch {
    return false;
  }
}

/** Let op: enkel `key`/`secs` per fase — GEEN `pattern`-array zoals bij
 *  Wear OS. watchOS heeft geen vrije trilduur-API, dus de Watch vertaalt
 *  `key` zelf naar een metronoom-tik (zie BreathSessionController.swift).
 *  Een pattern-array meesturen zou hier niets betekenen. */
export function sendBreathSessionToWatch(session: WatchBreathSession): void {
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
