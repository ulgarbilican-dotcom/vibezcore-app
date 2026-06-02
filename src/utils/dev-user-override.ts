/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Dev-only user-type override

   Voor het testen van verschillende user-states zonder backend-roundtrip:
     - 'guest'    : geen account
     - 'audio'    : PRO audio-abonnement, geen bracelet
     - 'bracelet' : bracelet owner, geen audio-PRO
     - 'pro'      : full PRO (audio + bracelet owner)
     - null       : geen override — gebruik echte backend-state

   Patroon: module-state + listener-set (zelfde als history.ts, settings.ts).
   AsyncStorage-persistent zodat reload behouden blijft.

   ⚠️ Alleen gerespecteerd in __DEV__ builds. Productie negeert het.
   ─────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

const KEY = 'vz_dev_user_override_v1';

export type DevUserOverride = null | 'guest' | 'audio' | 'bracelet' | 'pro';

let cached: DevUserOverride = null;
let loaded = false;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<(v: DevUserOverride) => void>();

function notify(): void {
  listeners.forEach((cb) => cb(cached));
}

async function loadOnce(): Promise<void> {
  if (loaded) return;
  if (loadPromise) return loadPromise;
  loadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(KEY);
      if (raw === 'guest' || raw === 'audio' || raw === 'bracelet' || raw === 'pro') {
        cached = raw;
      }
    } catch {
      /* corrupt → null */
    }
    loaded = true;
    notify();
  })();
  return loadPromise;
}

/** Synchroon lezen (na initial load). Voor non-hook callers. */
export function getDevUserOverride(): DevUserOverride {
  if (!__DEV__) return null;
  return cached;
}

/** Iter 9dn (2026-05-31): publieke subscribe-API voor non-hook modules
 *  zoals bracelet-history.ts die op override-wijzigingen moeten reageren
 *  (bv. opnieuw laden van per-user bucket). Returnt een unsubscribe-fn. */
export function subscribeDevUserOverride(
  cb: (v: DevUserOverride) => void,
): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

/** Iter 9ar (2026-05-31): wacht tot de AsyncStorage-cache geladen is.
 *  Welcome screen heeft dit nodig zodat de 'guest'-override gerespecteerd
 *  wordt vóór de token-check beslist of welcome zichtbaar is. In prod
 *  resolved direct (geen override). */
export function awaitDevUserOverrideLoaded(): Promise<void> {
  if (!__DEV__) return Promise.resolve();
  if (loaded) return Promise.resolve();
  return loadPromise ?? Promise.resolve();
}

/** Set override + persist + broadcast. */
export async function setDevUserOverride(
  value: DevUserOverride,
): Promise<void> {
  if (!__DEV__) return;
  cached = value;
  notify();
  try {
    if (value === null) {
      await AsyncStorage.removeItem(KEY);
    } else {
      await AsyncStorage.setItem(KEY, value);
    }
  } catch {
    /* swallow */
  }
}

/** React-hook variant. Re-renders bij wijziging. */
export function useDevUserOverride(): DevUserOverride {
  const [value, setValue] = useState<DevUserOverride>(cached);
  useEffect(() => {
    listeners.add(setValue);
    if (cached !== value) setValue(cached);
    loadOnce();
    return () => {
      listeners.delete(setValue);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return __DEV__ ? value : null;
}

/** Bracelet-ownership wrapper — gebruikt door bracelet.tsx etc. Gebruikt
 *  override indien aanwezig, anders fallback (momenteel hardcoded false
 *  tot backend-endpoint live is). */
export function useBraceletOwner(): boolean {
  const override = useDevUserOverride();
  if (override === 'bracelet' || override === 'pro') return true;
  /* TODO: backend endpoint — momenteel hardcoded false. */
  return false;
}

loadOnce();
