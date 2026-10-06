/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — JS-kant van de Apple Watch-brug. Enkel iOS (WatchConnectivity
   bestaat niet op Android) — net als wear-breath/index.ts voor Android,
   bewust zonder platform-check: de module is alleen apple-gelinkt
   (expo-module.config.json: "platforms": ["apple"]), dus op Android/web
   is `requireNativeModule` altijd een no-op via de catch hieronder.

   NIEUW (4 okt 2026): dit kanaal is nu TWEERICHTINGS. Naast sessies/status
   naar de Watch sturen, kan de Watch nu ook een Pause/Resume/Stop-tik
   terugsturen (`onWatchAction`) — de gedeelde "Active Session"-ring op het
   horloge bedient zo zowel breathwork als Instant State Control (bracelet),
   zie WatchBreathModule.swift voor de native routering. */

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

/** Lichtgewicht, periodiek te hersturen status voor Instant State Control
 *  (bracelet) — de Watch toont dit enkel, de echte sessie draait op de
 *  bracelet-hardware. `colorHex` = meta.color uit ble-contract.ts, dezelfde
 *  kleur als de rest van de app voor die modus. */
export type WatchBraceletStatus = {
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

/** `state-start` uit docs/WATCH_PROTOCOL.md — de Watch speelt hiermee
 *  zelf exact dezelfde lub-dub-curve als bracelet-haptics.ts. */
export type StateSessionStart = {
  title: string;
  colorHex: string;
  targetBpm: number;
  holdSec: number;
  rampSec: number;
  curveOffsetSec: number;
  remainingSec: number;
  lubAmp: number;
  dubAmp: number;
  lubMsNoAmp: number;
  dubMsNoAmp: number;
};

type Subscription = { remove(): void };

type WatchBreathNativeModule = {
  isWatchReachable(): Promise<boolean>;
  sendBreathSession(session: WatchBreathSession): void;
  stopBreathSession(): void;
  sendBraceletStatus(status: WatchBraceletStatus): void;
  stopBraceletRelay(): void;
  sendStateSession(start: StateSessionStart): void;
  pauseStateSession(): void;
  stopStateSession(): void;
  addListener(eventName: 'onWatchAction', listener: (event: WatchAction) => void): Subscription;
  addListener(eventName: 'onStateAck', listener: () => void): Subscription;
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

/** Aanroepen bij elke bracelet-statuspoll (bracelet-control.tsx, elke 5s) —
 *  faalt stil als er geen horloge gekoppeld is. */
export function sendBraceletStatusToWatch(status: WatchBraceletStatus): void {
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
 *  een cleanup-functie — altijd aanroepen bij unmount, anders stapelen
 *  listeners op bij elke remount van breath-session.tsx/bracelet-control.tsx. */
export function onWatchAction(cb: (event: WatchAction) => void): () => void {
  try {
    const sub = native?.addListener('onWatchAction', cb);
    return () => sub?.remove();
  } catch {
    return () => {};
  }
}

/* ── State Control-ritme op de pols (docs/WATCH_PROTOCOL.md) ──────────
   Transport: live via sendMessage, anders via de FIFO-wachtrij
   transferUserInfo — NIET via de application context, zodat breath- en
   state-berichten elkaar niet kunnen overschrijven (WatchBreathModule.swift). */

/** Start of hervat (nieuwe offset + resterende tijd) — vervangt een
 *  lopende of gepauzeerde sessie op het horloge. */
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

/** Het horloge speelt het ritme echt (ook met de pols omlaag) — de
 *  telefoon mag zijn eigen trilling stilleggen. Retourneert cleanup. */
export function onStateAck(cb: () => void): () => void {
  try {
    const sub = native?.addListener('onStateAck', () => cb());
    return () => sub?.remove();
  } catch {
    return () => {};
  }
}
