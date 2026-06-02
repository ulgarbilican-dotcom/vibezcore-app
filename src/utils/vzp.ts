/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Saved playback position (vzp_v1)

   Per sessie de laatste afspeelpositie in seconden. Webapp-parity: zelfde
   key, zelfde schema. Wordt gebruikt door de player voor het Resume-panel
   (Continue / Start over).

   Schema:
     AsyncStorage 'vzp_v1' → JSON object { [url]: positionInSeconds }

   Gedrag (vanuit de audio-player service):
     - pause / track-switch / unmount → setSavedPosition(url, posSec)
     - ended (full=true)              → clearSavedPosition(url)
     - bij play() leest UI getSavedPosition(url) → toont resume-panel als
       waarde > 4 sec EN actuele positie < 1 sec.

   Pattern: module-state + listener-set (zelfde als history.ts en
   useFavorites.ts) zodat de UI direct re-rendert na een mutatie.
   ─────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import {
  ensureBucketLoaded,
  getCurrentBucket,
  subscribeUserBucket,
} from '@/utils/user-bucket';

/* Iter 9dq v44 (2026-06-03): per-user bucketed storage.
   VZP_KEY blijft als legacy / migratie-key. Echte storage onder
   vzp_{bucket}_v1 zodat resume-posities per user-type apart staan. */
export const VZP_KEY = 'vzp_v1';
const KEY_PREFIX = 'vzp_';
const KEY_SUFFIX = '_v1';
function vzpBucketKey(bucket: string): string {
  return `${KEY_PREFIX}${bucket}${KEY_SUFFIX}`;
}
const RESUME_MIN_SEC = 4; // < dit → niet de moeite waard om "continue" te tonen

type Positions = Record<string, number>;

let state: Positions = {};
let initialized = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((l) => l());
}

/* Iter 9dq v44: eenmalig vzp_v1 → vzp_{bucket}_v1 migreren. */
async function migrateLegacyVzpKey(bucket: string): Promise<void> {
  try {
    const legacy = await AsyncStorage.getItem(VZP_KEY);
    if (!legacy) return;
    const newKey = vzpBucketKey(bucket);
    const existing = await AsyncStorage.getItem(newKey);
    if (existing) {
      await AsyncStorage.removeItem(VZP_KEY);
      return;
    }
    await AsyncStorage.setItem(newKey, legacy);
    await AsyncStorage.removeItem(VZP_KEY);
  } catch {
    /* migration mislukt — proberen we volgende keer opnieuw */
  }
}

async function loadOnce(): Promise<void> {
  if (initialized) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const bucket = await ensureBucketLoaded();
      await migrateLegacyVzpKey(bucket);
      const raw = await AsyncStorage.getItem(vzpBucketKey(bucket));
      if (raw) {
        const obj = JSON.parse(raw);
        if (obj && typeof obj === 'object' && !Array.isArray(obj)) {
          const cleaned: Positions = {};
          for (const [k, v] of Object.entries(obj)) {
            if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
              cleaned[k] = v;
            }
          }
          state = cleaned;
        }
      }
    } catch {
      /* corrupt of leeg → start met {} */
    }
    initialized = true;
    notify();
  })();
  return loadPromise;
}

async function persist(): Promise<void> {
  try {
    const bucket = getCurrentBucket();
    await AsyncStorage.setItem(vzpBucketKey(bucket), JSON.stringify(state));
  } catch {
    /* schrijf-fout — runtime-state blijft staan */
  }
}

/* Iter 9dq v44: bij bucket-switch wis cache + reload uit nieuwe bucket. */
subscribeUserBucket(() => {
  state = {};
  initialized = false;
  loadPromise = null;
  notify();
  loadOnce().catch(() => {
    /* swallow */
  });
});

/* ── Public API ─────────────────────────────────────────────────────────── */

export function getSavedPosition(url: string): number {
  return state[url] ?? 0;
}

export async function setSavedPosition(
  url: string,
  positionSec: number
): Promise<void> {
  await loadOnce();
  if (!url || !Number.isFinite(positionSec) || positionSec < RESUME_MIN_SEC) {
    /* Te kort om bij te houden — laat eventuele oude waarde staan, of clear
       als we al een waarde hadden. Conservatief: niet auto-wissen, voorkomt
       data-verlies bij toevallige micro-pauzes. */
    return;
  }
  state = { ...state, [url]: positionSec };
  notify();
  persist();
}

export async function clearSavedPosition(url: string): Promise<void> {
  await loadOnce();
  if (!(url in state)) return;
  const next = { ...state };
  delete next[url];
  state = next;
  notify();
  persist();
}

/* ── React hook ─────────────────────────────────────────────────────────── */

/**
 * @returns De opgeslagen positie voor `url` in seconden, of 0 als er geen is.
 *          Re-rendert wanneer setSavedPosition / clearSavedPosition is
 *          aangeroepen, ook vanuit een ander component.
 */
export function useSavedPosition(url: string | null | undefined): number {
  const [pos, setPos] = useState<number>(url ? state[url] ?? 0 : 0);
  useEffect(() => {
    let cancelled = false;
    loadOnce().then(() => {
      if (cancelled) return;
      setPos(url ? state[url] ?? 0 : 0);
    });
    const listener = () => {
      setPos(url ? state[url] ?? 0 : 0);
    };
    listeners.add(listener);
    return () => {
      cancelled = true;
      listeners.delete(listener);
    };
  }, [url]);
  return pos;
}
