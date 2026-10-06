/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — JS-kant van de Wear OS-brug.

   Enkel Android: Wear OS-horloges koppelen via Google Play Services
   (Wearable Data Layer), dat bestaat niet op iOS. `index.ts` blijft hier
   bewust zonder platform-check — de module zelf is Android-only gelinkt
   (expo-module.config.json: "platforms": ["android"]), dus op iOS/web is
   `requireNativeModule` altijd een no-op via de catch hieronder, net als
   breath-background dat voor zijn eigen web/Expo Go-val doet.

   NIEUW (4 okt 2026): dit kanaal is nu TWEERICHTINGS, zie
   WearBreathModule.kt voor de native routering — zelfde API-vorm als
   watch-breath/index.ts (Apple Watch), zodat breath-session.tsx/
   bracelet-control.tsx één en dezelfde aanroep kunnen gebruiken voor beide
   platforms. */

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
  /** Kleur van de toestand, voor de cirkel op het horloge. */
  colorHex?: string;
  /** Hervatten: ronde (1-based), fase-index en resterende ms van die fase
   *  (weglaten = vooraan beginnen). */
  startRound?: number;
  startPhase?: number;
  phaseRemainingMs?: number;
};

export type WearBraceletStatus = {
  title: string;
  colorHex: string;
  remainingMinutes: number;
  paused: boolean;
  active: boolean;
};

export type WatchAction = {
  action: 'pause' | 'resume' | 'stop';
  kind: 'breath' | 'bracelet';
};

/** `state-start` uit docs/WATCH_PROTOCOL.md — het horloge rekent het ritme
 *  zelf uit met de formule van bracelet-haptics.ts. */
export type StateSessionStart = {
  /** modusnaam zoals in de app */
  title: string;
  /** kleur van de toestand */
  colorHex: string;
  targetBpm: number;
  holdSec: number;
  rampSec: number;
  /** waar in de curve we beginnen */
  curveOffsetSec: number;
  /** resterende sessietijd vanaf ontvangst */
  remainingSec: number;
  /** 0–255, Wear OS met amplitude-sturing */
  lubAmp: number;
  dubAmp: number;
  /** tikduur zonder amplitude-sturing */
  lubMsNoAmp: number;
  dubMsNoAmp: number;
};

type WearBreathNativeModule = {
  isWatchReachable(): Promise<boolean>;
  sendBreathSession(session: WearBreathSession): void;
  pauseBreathSession(): void;
  stopBreathSession(): void;
  sendBraceletStatus(status: WearBraceletStatus): void;
  stopBraceletRelay(): void;
  sendStateSession(start: StateSessionStart): void;
  pauseStateSession(): void;
  stopStateSession(): void;
  addListener(eventName: 'onWatchAction', listener: (event: WatchAction) => void): { remove(): void };
  addListener(eventName: 'onStateAck', listener: () => void): { remove(): void };
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

/** Pauzeert de ademsessie op het horloge (hervatten = opnieuw
 *  `sendBreathSessionToWatch` met de plek in de sessie). Faalt stil. */
export function pauseBreathSessionOnWatch(): void {
  try {
    native?.pauseBreathSession();
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

/** Aanroepen bij elke bracelet-statuspoll (bracelet-control.tsx, elke 5s). */
export function sendBraceletStatusToWatch(status: WearBraceletStatus): void {
  try {
    native?.sendBraceletStatus(status);
  } catch {
    /* stil */
  }
}

export function stopBraceletRelayOnWatch(): void {
  try {
    native?.stopBraceletRelay();
  } catch {
    /* stil */
  }
}

/** Luistert naar Pause/Resume/Stop-tikken vanaf het horloge. Retourneert
 *  een cleanup-functie — altijd aanroepen bij unmount. */
export function onWatchAction(cb: (event: WatchAction) => void): () => void {
  try {
    const sub = native?.addListener('onWatchAction', cb);
    return () => sub?.remove();
  } catch {
    return () => {};
  }
}

/* ── State Control op de pols (docs/WATCH_PROTOCOL.md) ─────────────────── */

/** Start (of hervat — vervangt een lopende/gepauzeerde sessie) State
 *  Control op het horloge. Faalt stil. */
export function sendStateSessionToWatch(start: StateSessionStart): void {
  try {
    native?.sendStateSession(start);
  } catch {
    /* stil */
  }
}

export function pauseStateSessionOnWatch(): void {
  try {
    native?.pauseStateSession();
  } catch {
    /* stil */
  }
}

export function stopStateSessionOnWatch(): void {
  try {
    native?.stopStateSession();
  } catch {
    /* stil */
  }
}

/** Het horloge meldt dat het State Control echt speelt (`state-ack`) — dan
 *  legt de telefoon zijn eigen trilling stil. Retourneert een cleanup. */
export function onStateAck(cb: () => void): () => void {
  try {
    const sub = native?.addListener('onStateAck', () => cb());
    return () => sub?.remove();
  } catch {
    return () => {};
  }
}
