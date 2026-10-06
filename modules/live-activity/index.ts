/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — JS-kant van de Live Activity (iPhone, iOS 16.2+).

   Eén lopende sessie op het vergrendelscherm en in het Dynamic Island,
   zoals Android dat via de media-melding van de native services doet.
   Enkel apple-gelinkt (expo-module.config.json), dus op Android/web is
   alles hier een stille no-op.

   De activity telt zelf af naar `endMs` (het systeem doet dat, ook als iOS
   de app stillegt). We sturen dus enkel iets bij een verandering: start,
   pauze, hervatten, stop. Bij een pauze rekent deze module zelf de
   resterende tijd uit, bij hervatten het nieuwe eindmoment. */

import { requireNativeModule, type EventSubscription } from 'expo-modules-core';
import { Platform } from 'react-native';

type NativeRecord = {
  kind: 'state' | 'breath';
  title: string;
  subtitle: string;
  colorHex: string;
  endMs: number;
  paused: boolean;
  remainingSec: number;
  totalSec: number;
};

type NativeModule = {
  addListener(event: 'onLiveAction', cb: (e: { action: 'toggle' }) => void): EventSubscription;
  isSupported(): boolean;
  show(record: NativeRecord): Promise<void>;
  end(): Promise<void>;
};

let native: NativeModule | null = null;
if (Platform.OS === 'ios') {
  try {
    native = requireNativeModule<NativeModule>('LiveActivity');
  } catch {
    native = null; // oudere build zonder de module
  }
}

export type LiveSession = {
  kind: 'state' | 'breath';
  title: string;
  subtitle: string;
  colorHex: string;
  remainingSec: number;
  totalSec: number;
  paused: boolean;
};

let last: (LiveSession & { endMs: number }) | null = null;

/** Start of werk de Live Activity bij. */
export function showLiveSession(s: LiveSession): void {
  if (!native) return;
  const remaining = Math.max(0, Math.round(s.remainingSec));
  const endMs = Date.now() + remaining * 1000;
  last = { ...s, remainingSec: remaining, endMs };
  native.show({ ...s, remainingSec: remaining, endMs }).catch(() => {});
}

/** Pauze: de resterende tijd bevriezen op wat de activity nu toont. */
export function pauseLiveSession(): void {
  if (!native || !last || last.paused) return;
  const remaining = Math.max(0, Math.round((last.endMs - Date.now()) / 1000));
  showLiveSession({ ...last, remainingSec: remaining, paused: true });
}

/** Hervatten vanaf de bevroren resterende tijd. */
export function resumeLiveSession(): void {
  if (!native || !last || !last.paused) return;
  showLiveSession({ ...last, paused: false });
}

export function endLiveSession(): void {
  last = null;
  if (!native) return;
  native.end().catch(() => {});
}

/* ── De pauze/hervat-knop op het vergrendelscherm (iOS 17+) ──
   Eén luisteraar per soort: State Control (de monitor) en de ademsessie
   registreren elk hun eigen. Enkel die van de sessie die nu op het
   vergrendelscherm staat, krijgt de tik. */
const toggleHandlers: Partial<Record<'state' | 'breath', () => void>> = {};
let subscribed = false;

export function onLiveToggle(kind: 'state' | 'breath', cb: () => void): () => void {
  toggleHandlers[kind] = cb;
  if (native && !subscribed) {
    subscribed = true;
    try {
      native.addListener('onLiveAction', () => {
        const k = last?.kind;
        if (k) toggleHandlers[k]?.();
      });
    } catch {
      subscribed = false;
    }
  }
  return () => {
    if (toggleHandlers[kind] === cb) delete toggleHandlers[kind];
  };
}
