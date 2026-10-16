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
  /** Langs waar de lucht gaat (Nose / Mouth / …), leeg bij vasthouden. */
  via?: string;
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
  /** Date.now() van de telefoon bij versturen — het horloge trekt de
   *  Bluetooth-vertraging af (13 okt 2026). */
  sentAtMs?: number;
  /** Trilkracht 0–255 (0 = standaard van het horloge) — Soft/Medium/Strong. */
  amp?: number;
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
  /** rusthartslag van de gebruiker = begintempo (oudere versies: 75) */
  startBpm: number;
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
  /** tikduur met amplitude-sturing */
  lubMs?: number;
  dubMs?: number;
  /** telefoonklok bij verzenden — het horloge trekt de vertraging af */
  sentAtMs?: number;
};

type WearBreathNativeModule = {
  isWatchReachable(): Promise<boolean>;
  watchStatus?(): Promise<{ status: WatchAppStatus; name: string }>;
  openStoreOnWatch?(): Promise<boolean>;
  sendBreathSession(session: WearBreathSession): void;
  pauseBreathSession(): void;
  stopBreathSession(): void;
  sendStateSession(start: StateSessionStart): void;
  wakeWatch?(): void;
  pauseStateSession(): void;
  stopStateSession(): void;
  syncCatalog?(json: string): void;
  takeWatchSessions?(): Promise<string[]>;
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
/** "none" = geen horloge verbonden · "noApp" = horloge zonder VIBEZCORE ·
 *  "ready" = horloge met VIBEZCORE. */
export type WatchAppStatus = 'none' | 'noApp' | 'ready';

export async function getWatchStatus(): Promise<{ status: WatchAppStatus; name: string }> {
  try {
    return (await native?.watchStatus?.()) ?? { status: 'none', name: '' };
  } catch {
    return { status: 'none', name: '' };
  }
}

/** Opent de Play Store op het horloge bij VIBEZCORE. */
export async function openStoreOnWatch(): Promise<boolean> {
  try {
    return (await native?.openStoreOnWatch?.()) ?? false;
  } catch {
    return false;
  }
}

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

/** 15 okt 2026: het horloge meldt dat een horloge-sessie in de geschiedenis
 *  klaarstaat (bericht `{action:"logged", kind:"history"}` op hetzelfde pad
 *  als Pause/Stop — geen nieuwe native code nodig). Zo verschijnt ze meteen,
 *  ook als de app al open staat. Bestaande handlers negeren deze kind. */
export function onWatchSessionLogged(cb: () => void): () => void {
  try {
    const sub = native?.addListener('onWatchAction', (e) => {
      if ((e as { kind: string }).kind === 'history') cb();
    });
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

/** Wekt de horloge-app alvast (17 okt 2026): Samsung laat een slapende
 *  app een bericht soms pas ~20 s later ontvangen. Faalt stil; ontbreekt
 *  in een oudere build gewoon. */
export function wakeWatch(): void {
  try {
    native?.wakeWatch?.();
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

/** 13 okt 2026 — het horloge zelfstandig: de "catalogus" (toestanden,
 *  techniek, fasen, trilpatronen, sterkte, toegang) als bewaard gegeven naar
 *  het horloge. Zie services/watch-catalog.ts. */
export function syncWatchCatalog(json: string): void {
  try {
    native?.syncCatalog?.(json);
  } catch {
    /* stil */
  }
}

/** Sessies die op het horloge zelf gedaan zijn (en meteen gewist). */
export async function takeWatchSessions(): Promise<string[]> {
  try {
    return (await native?.takeWatchSessions?.()) ?? [];
  } catch {
    return [];
  }
}
