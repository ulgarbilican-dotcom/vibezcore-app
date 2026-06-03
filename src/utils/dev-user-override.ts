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

/* ── Bracelet activation tracking (iter 9dq v89, 2026-06-03) ────────
   Operator-feedback: override 'bracelet' / 'pro' liet de user direct
   zien als "Bracelet activated" terwijl in productie een gekochte
   bracelet ook eerst geactiveerd moet worden met de 12-char code.
   Twee onafhankelijke staten nu:
     1. Entitled = paid → override 'bracelet' of 'pro'
     2. Activated = code geredeem'd → separate flag
   Account-tab toont "Activate"-CTA bij entitled-niet-activated.
   BraceletCard verschijnt pas wanneer activated.
   In productie regelt backend has_bracelet=true dit; deze flag is
   alleen voor dev-mock-flow. Clear bij override-change voor schone tests. */
const ACTIVATED_KEY = 'vz_dev_bracelet_activated_v1';
let activatedCached = false;
let activatedLoaded = false;
const activationListeners = new Set<(v: boolean) => void>();

function notifyActivation(): void {
  activationListeners.forEach((cb) => cb(activatedCached));
}

async function loadActivationOnce(): Promise<void> {
  if (activatedLoaded) return;
  try {
    const raw = await AsyncStorage.getItem(ACTIVATED_KEY);
    activatedCached = raw === '1';
  } catch {
    /* swallow */
  }
  activatedLoaded = true;
  notifyActivation();
}

export async function setDevBraceletActivated(value: boolean): Promise<void> {
  if (!__DEV__) return;
  activatedCached = value;
  notifyActivation();
  try {
    if (value) {
      await AsyncStorage.setItem(ACTIVATED_KEY, '1');
    } else {
      await AsyncStorage.removeItem(ACTIVATED_KEY);
    }
  } catch {
    /* swallow */
  }
}

/** Heeft user de activation-code ingevoerd? Dev-only flag. */
export function useDevBraceletActivated(): boolean {
  const [value, setValue] = useState<boolean>(activatedCached);
  useEffect(() => {
    activationListeners.add(setValue);
    if (activatedCached !== value) setValue(activatedCached);
    loadActivationOnce();
    return () => {
      activationListeners.delete(setValue);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return __DEV__ ? value : false;
}

/** Reset activation-flag wanneer override verandert — schone test-cycli. */
listeners.add(() => {
  if (activatedCached) {
    activatedCached = false;
    notifyActivation();
    AsyncStorage.removeItem(ACTIVATED_KEY).catch(() => {});
  }
});

/** Heeft user RECHT op bracelet-features? = paid (override).
 *  Niet hetzelfde als 'has activated' — voor activation-status gebruik
 *  useBraceletOwner() (die beide combineert). */
export function useBraceletEntitled(): boolean {
  const override = useDevUserOverride();
  if (override === 'bracelet' || override === 'pro') return true;
  return false;
}

/** Bracelet-ownership wrapper. Iter 9dq v89: vereist NU zowel entitled
 *  (paid) als activated (code geredeem'd). In productie levert backend
 *  has_bracelet pas true wanneer beide compleet zijn. */
export function useBraceletOwner(): boolean {
  const entitled = useBraceletEntitled();
  const activated = useDevBraceletActivated();
  return entitled && activated;
}

loadOnce();
loadActivationOnce();
