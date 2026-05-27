/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — User settings (vzs_v1)

   Persistente UI-instellingen. Webapp-parity: zelfde key. Schema is
   extensible — nieuwe setting = veld + default toevoegen. JSON-parse
   gaat door try/catch en valt terug op defaults bij corruptie.

   Patroon: module-state + listener-set (zelfde als history.ts, vzp.ts,
   useFavorites.ts). Synchrone getter (`getSetting`) zodat de audio-
   service zonder hook kan lezen — een eerste auto-import van dit
   bestand triggert direct de load van AsyncStorage.
   ─────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export const SETTINGS_KEY = 'vzs_v1';

export type Settings = {
  autoPlayNext: boolean;
  /** Save listening progress — bewaart positie zodat sessies kunnen
   *  hervatten waar je gebleven was. Default true (gewenste UX).
   *  Wanneer uitgezet wordt vzp_v1 (saved-position) genegeerd door de
   *  audio-player. Bestaande positie-state blijft staan tot user
   *  Clear local data uitvoert. */
  saveProgress: boolean;
  /** Track listening history — vult vzh_v1 (Your Journey). Default true.
   *  Uitschakelen voorkomt nieuwe history-entries; bestaande blijven
   *  staan tot user 'm clear. */
  trackHistory: boolean;
  /** Audio quality — high (default) of low. Backend levert nu nog 1
   *  bitrate, dus deze setting is voor toekomstige variant-keuze.
   *  Comment-stub: audio-player respecteert deze nog niet (pas nodig
   *  wanneer backend multi-bitrate ondersteunt). */
  audioQuality: 'high' | 'low';
};

const defaults: Settings = {
  autoPlayNext: false,
  saveProgress: true,
  trackHistory: true,
  audioQuality: 'high',
};

let state: Settings = { ...defaults };
let initialized = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

async function loadOnce(): Promise<void> {
  if (initialized) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          state = {
            ...defaults,
            ...(typeof obj.autoPlayNext === 'boolean'
              ? { autoPlayNext: obj.autoPlayNext }
              : {}),
            ...(typeof obj.saveProgress === 'boolean'
              ? { saveProgress: obj.saveProgress }
              : {}),
            ...(typeof obj.trackHistory === 'boolean'
              ? { trackHistory: obj.trackHistory }
              : {}),
            ...(obj.audioQuality === 'high' || obj.audioQuality === 'low'
              ? { audioQuality: obj.audioQuality }
              : {}),
          };
        }
      }
    } catch {
      /* corrupt → defaults */
    }
    initialized = true;
    notify();
  })();
  return loadPromise;
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(state));
  } catch {
    /* schrijf-fout — runtime-state blijft staan */
  }
}

/** Synchrone read — geldig na initiële load. Vóór de eerste load returnt
 *  hij de defaults; voor onze use-case (autoPlayNext default false) is
 *  een eventuele gemiste eerste finished-event acceptabel. */
export function getSetting<K extends keyof Settings>(key: K): Settings[K] {
  return state[key];
}

export async function setSetting<K extends keyof Settings>(
  key: K,
  value: Settings[K]
): Promise<void> {
  await loadOnce();
  if (state[key] === value) return;
  state = { ...state, [key]: value };
  notify();
  persist();
}

/** Kicker voor de eerste load. Wordt automatisch aangeroepen bij module
 *  init (zie regel onderaan dit bestand). Veilig om handmatig nogmaals
 *  aan te roepen vanuit bv. de root-layout. */
export function ensureSettingsLoaded(): Promise<void> {
  return loadOnce();
}

export function useSetting<K extends keyof Settings>(
  key: K
): [Settings[K], (v: Settings[K]) => void] {
  const [val, setVal] = useState<Settings[K]>(state[key]);
  useEffect(() => {
    loadOnce().then(() => setVal(state[key]));
    const listener = () => setVal(state[key]);
    listeners.add(listener);
    setVal(state[key]);
    return () => {
      listeners.delete(listener);
    };
  }, [key]);
  const setter = (v: Settings[K]) => {
    setSetting(key, v);
  };
  return [val, setter];
}

/* Auto-init: zodra een module dit bestand importeert (bv. audio-service
   of een React-hook in account.tsx) wordt de load alvast gekickt. Tegen
   de tijd dat een sessie eindigt en `getSetting('autoPlayNext')` wordt
   gelezen, zit de waarde in memory. */
loadOnce();
