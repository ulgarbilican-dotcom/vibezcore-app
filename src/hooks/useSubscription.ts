/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — useSubscription hook (shared)

   Eén bron van waarheid voor "is deze gebruiker PRO?". Vervangt twee
   lokale stubs in player.tsx + (tabs)/index.tsx die altijd false
   teruggaven.

   Architectuur (zelfde patroon als history.ts / settings.ts / vzp.ts):
     - Module-level cachedStatus + Set<subscriber> voor cross-component
       sync (een refresh in Account ziet de Library tegelijk).
     - AsyncStorage-cache onder key 'vz_sub_v1' met cachedAt-timestamp.
       Bij module-import direct geladen → bij hot starts is de waarde
       in geheugen vóór de eerste hook-mount, dus terugkerende
       PRO-users zien direct correct UI.
     - Cache TTL: 24h. Ouder → behandel als geen cache (forceer fetch).
     - Bij fetch-failure met bestaande cache: cached waarde behouden.
     - Bij no-token (gast/uitgelogd): {active:false} + cache wissen.

   Token-management: getToken() haalt nu verse Supabase-session via SDK
   (auto-refresh). Geen handmatige refresh-logica in deze hook nodig.
   ─────────────────────────────────────────────────────────────────────── */

import { getToken } from '@/services/auth';
import { apiCall } from '@/utils/api';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

export const SUB_CACHE_KEY = 'vz_sub_v1';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type SubscriptionStatus = {
  active: boolean;
  tier?: 'monthly' | 'yearly';
  status?: string;
  email?: string;
  /** ISO-datum tot wanneer het abonnement geldig is (backend snake_case
   *  `valid_until`). */
  validUntil?: string;
  /** true = abo verlengt automatisch op `validUntil`. Backend `will_renew`. */
  willRenew?: boolean;
  /** Gumroad subscriber-id. Nodig voor de "Manage billing"-link die de user
   *  naar de Gumroad-portal opent (https://app.gumroad.com/subscriptions/{id}/manage).
   *  Backend (`subscription-status.js`) returnt dit als `gumroad_subscriber_id`. */
  gumroadSubscriberId?: string;
};

type CachedShape = SubscriptionStatus & { cachedAt: number };

let cachedStatus: SubscriptionStatus | null = null;
let cacheLoaded = false;
let cacheLoadPromise: Promise<void> | null = null;
let isFetching = false;
const subscribers = new Set<(s: SubscriptionStatus | null) => void>();

function notifyAll(status: SubscriptionStatus | null): void {
  cachedStatus = status;
  subscribers.forEach((cb) => cb(status));
}

async function persistCache(status: SubscriptionStatus): Promise<void> {
  try {
    const payload: CachedShape = { ...status, cachedAt: Date.now() };
    await AsyncStorage.setItem(SUB_CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* swallow */
  }
}

async function clearPersistedCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(SUB_CACHE_KEY);
  } catch {
    /* swallow */
  }
}

async function loadCacheOnce(): Promise<void> {
  if (cacheLoaded) return;
  if (cacheLoadPromise) return cacheLoadPromise;
  cacheLoadPromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(SUB_CACHE_KEY);
      if (raw) {
        const obj = JSON.parse(raw) as Partial<CachedShape>;
        if (
          obj &&
          typeof obj.cachedAt === 'number' &&
          typeof obj.active === 'boolean'
        ) {
          const age = Date.now() - obj.cachedAt;
          if (age < CACHE_MAX_AGE_MS) {
            const status: SubscriptionStatus = {
              active: obj.active,
              tier: obj.tier,
              status: obj.status,
              email: obj.email,
              validUntil: obj.validUntil,
              willRenew: obj.willRenew,
              gumroadSubscriberId: obj.gumroadSubscriberId,
            };
            notifyAll(status);
          }
        }
      }
    } catch {
      /* corrupt → start uncached */
    }
    cacheLoaded = true;
  })();
  return cacheLoadPromise;
}

async function fetchStatus(): Promise<void> {
  if (isFetching) return;
  isFetching = true;
  try {
    const token = await getToken();
    if (!token) {
      notifyAll({ active: false });
      clearPersistedCache();
      return;
    }

    const raw = await apiCall<Record<string, unknown>>(
      '/api/subscription-status',
      { auth: true }
    );
    const data: SubscriptionStatus = {
      active: raw.active === true,
      tier:
        raw.tier === 'monthly' || raw.tier === 'yearly' ? raw.tier : undefined,
      status: typeof raw.status === 'string' ? raw.status : undefined,
      email: typeof raw.email === 'string' ? raw.email : undefined,
      validUntil:
        typeof raw.valid_until === 'string' ? raw.valid_until : undefined,
      willRenew:
        typeof raw.will_renew === 'boolean' ? raw.will_renew : undefined,
      gumroadSubscriberId:
        typeof raw.gumroad_subscriber_id === 'string'
          ? raw.gumroad_subscriber_id
          : undefined,
    };
    notifyAll(data);
    persistCache(data);
  } catch (e: any) {
    console.warn('[useSubscription] fetch failed:', e?.message ?? e);
    if (cachedStatus === null) {
      notifyAll({ active: false });
    }
  } finally {
    isFetching = false;
  }
}

/** Synchrone snapshot voor non-React consumers (bv. audio-player service).
 *  Geen fetch, alleen huidige cache. */
export function getCachedSubscription(): SubscriptionStatus | null {
  return cachedStatus;
}

/** Trigger refresh — bv. vanuit Account.tsx na login of na sign-out. */
export function refreshSubscription(): void {
  cachedStatus = null;
  subscribers.forEach((cb) => cb(null));
  fetchStatus();
}

export function useSubscription() {
  const [status, setStatus] = useState<SubscriptionStatus | null>(cachedStatus);

  useEffect(() => {
    subscribers.add(setStatus);
    if (cachedStatus !== status) setStatus(cachedStatus);
    loadCacheOnce().then(() => {
      if (cachedStatus === null) fetchStatus();
    });
    return () => {
      subscribers.delete(setStatus);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isPro: status?.active === true,
    tier: status?.tier,
    validUntil: status?.validUntil,
    willRenew: status?.willRenew,
    gumroadSubscriberId: status?.gumroadSubscriberId,
    isLoading: status === null,
    refresh: refreshSubscription,
  };
}

loadCacheOnce();
