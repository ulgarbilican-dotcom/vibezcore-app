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
import { useDevUserOverride } from '@/utils/dev-user-override';
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
  /** Iter 9dq v150 (operator 2026-06-17): Gumroad-veld verwijderd. App is
   *  IAP-only (App Store / Play Store). Geen Gumroad-subscriptions meer
   *  in productie — operator-besluit "GUMROAD NIET MEER VOOR DE APP".
   *  Cancellation gaat via storeSubscriptionsUrl() (Apple/Google policy). */
};

type CachedShape = SubscriptionStatus & { cachedAt: number };

let cachedStatus: SubscriptionStatus | null = null;
let cacheLoaded = false;
let cacheLoadPromise: Promise<void> | null = null;
let isFetching = false;
/* Iter 9dq v56 (2026-06-03, audit-finding C2): fetchGeneration markeert
   "welke fetch is nu de canonical?". refreshSubscription() bumpt deze
   waarde, wat impliciet alle in-flight fetches met een lagere generatie
   ongeldig maakt. Voorheen kon een in-flight fetch van user A's
   subscription afronden ná dat user A had gesignout (en user B/anon
   actief was). De .notifyAll() schreef dan user A's status (PRO!) in
   het cache van user B/anon → cross-user data-leak. Met generation-
   check: na elke await checken we of we nog actueel zijn; zo niet,
   discard de response. */
let fetchGeneration = 0;
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
      /* Iter 9aq (2026-05-31): token-check VÓÓR cache-load. Zonder
         token = guest = NOOIT PRO, ongeacht wat er in cache staat. Was
         een bug waardoor een uitgelogde user (of fresh install na
         eerdere PRO-test) alsnog PRO-content zag omdat de stale cache
         werd geladen en de fetch nooit triggerde (cachedStatus !==
         null). Nu: geen token → cache wissen → status active:false. */
      const token = await getToken();
      if (!token) {
        await clearPersistedCache();
        notifyAll({ active: false });
        cacheLoaded = true;
        return;
      }
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

/* Iter v164 (2026-06-27): RevenueCat customerInfo als PRIMARY bron-van-
   waarheid. Operator-spec: 'na betaling dient PRO unlocked te zijn en
   als user afsluit en terugkomt moet die altijd in PRO omgeving zolang
   abonnement geldig is'.

   RevenueCat houdt customerInfo automatisch up-to-date — bij elke
   getCustomerInfo() call krijgen we de huidige entitlement-state
   server-validated. Geen backend webhook nodig om te weten dat user PRO
   is — RevenueCat's customer-info IS de status.

   Fallback: /api/subscription-status (backend Supabase) blijft secondary
   bron voor het geval RevenueCat SDK niet bereikbaar is (offline + cache
   verlopen). Maar als RevenueCat zegt PRO → user IS PRO, ongeacht wat
   backend nog van eerdere weet. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function tryRevenueCatStatus(): Promise<SubscriptionStatus | null> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Purchases = require('react-native-purchases').default;
    const customerInfo = await Purchases.getCustomerInfo();
    const audioPro = customerInfo?.entitlements?.active?.['audio_pro'];
    if (!audioPro) return null; /* geen actieve entitlement — fall through */
    const productId: string | undefined = audioPro.productIdentifier;
    const tier: 'monthly' | 'yearly' | undefined = productId?.includes('yearly')
      ? 'yearly'
      : productId?.includes('monthly')
        ? 'monthly'
        : undefined;
    return {
      active: true,
      tier,
      status: 'active',
      validUntil:
        typeof audioPro.expirationDate === 'string'
          ? audioPro.expirationDate
          : undefined,
      willRenew: audioPro.willRenew === true,
    };
  } catch {
    return null; /* SDK niet geladen / native module mist — fall back */
  }
}

async function fetchStatus(): Promise<void> {
  /* Iter 9dq v56 (2026-06-03, audit C2): elke fetch claimt z'n eigen
     generation-nummer. Bij elke yield-point checken we of we nog de
     "current" generation zijn; zo niet → discard. Hierdoor schrijft
     een in-flight user-A-fetch nooit meer in user-B's cache. */
  const myGen = fetchGeneration;
  if (isFetching) {
    /* Een eerdere fetch loopt nog. Die heeft een lagere of dezelfde
       generatie. Als dezelfde → al onderweg, niets dubbel doen. Als
       lagere → 'ie wordt straks toch gediscard, geen reden om hier
       te wachten. In beide gevallen: geen nieuwe parallelle fetch. */
    return;
  }
  isFetching = true;
  try {
    /* Iter v164: probeer RevenueCat eerst. Bij actieve entitlement is
       dit DE bron-van-waarheid — geen backend round-trip nodig. */
    const rcStatus = await tryRevenueCatStatus();
    if (myGen !== fetchGeneration) return;
    if (rcStatus?.active) {
      notifyAll(rcStatus);
      persistCache(rcStatus);
      return;
    }

    /* Geen actieve RevenueCat entitlement → check backend voor het geval
       user al PRO is via een ander pad (bv. handmatige grant). */
    const token = await getToken();
    if (myGen !== fetchGeneration) return; /* gerevoket — sign-out happened */
    if (!token) {
      notifyAll({ active: false });
      clearPersistedCache();
      return;
    }

    const raw = await apiCall<Record<string, unknown>>(
      '/api/subscription-status',
      { auth: true }
    );
    if (myGen !== fetchGeneration) return; /* gerevoket midden in fetch */
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
    };
    notifyAll(data);
    persistCache(data);
  } catch (e: any) {
    if (__DEV__) console.warn('[useSubscription] fetch failed:', e?.message ?? e);
    if (myGen !== fetchGeneration) return; /* gerevoket — niet schrijven */
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

/** Trigger refresh — bv. vanuit Account.tsx na login of na sign-out.
 *  Iter 9dq v56 (2026-06-03, audit C2): bumpt fetchGeneration zodat
 *  in-flight fetches van de vorige user worden gediscard wanneer hun
 *  await teruggegeven wordt aan de event-loop. Ook clearPersistedCache
 *  zodat een no-token scenario direct ook AsyncStorage opschoont (anders
 *  zou een fresh app-start van user-B nog user-A's gecachede status
 *  pakken voordat de fetch klaar is). */
export function refreshSubscription(): void {
  fetchGeneration++;
  cachedStatus = null;
  subscribers.forEach((cb) => cb(null));
  /* Direct preventief cache-wipe zodat een verse load nooit stale
     user-A data binnenpakt. fetchStatus overschrijft 'm met de echte
     waarde wanneer 'ie klaar is. */
  clearPersistedCache().catch(() => {});
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

  /* Iter 9p: dev-only override voor user-state testing. Geen effect
     in productie. */
  const override = useDevUserOverride();
  const realIsPro = status?.active === true;
  const isPro =
    override === 'audio' || override === 'pro'
      ? true
      : override === 'guest' || override === 'bracelet'
        ? false
        : realIsPro;

  return {
    isPro,
    /* Iter 9dq v13 (2026-06-02): realIsPro = uitsluitend backend-state
       (status.active === true), genegeerd door dev-override. Bedoeld
       voor consumers die op ECHTE auth-state moeten beslissen (zoals
       de audio-player die bepaalt of-ie preview=true of een echte JWT
       moet sturen). UI-elementen die alleen visueel "PRO" moeten tonen
       (badges, upgrade-cards verbergen) blijven `isPro` gebruiken zodat
       override hun visueel-state correct simuleert.
       Lange-termijn pattern: scheid display-state (override-aware) van
       auth-state (echt alleen). Voorkomt subtiele bugs zoals deze:
       PRO override + geen real token → backend gaf 401 op PRO sessies
       omdat we geen preview=true stuurden. */
    realIsPro,
    tier: status?.tier,
    validUntil: status?.validUntil,
    willRenew: status?.willRenew,
    isLoading: status === null && override === null,
    refresh: refreshSubscription,
  };
}

loadCacheOnce();
