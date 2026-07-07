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
  /** Iter v222 (2026-07-07): bracelet-ownership uit backend. Backend
   *  retourneert `has_bracelet_activated` op /api/subscription-status na
   *  succesvolle POST /api/bracelet/activate. Als backend het veld nog
   *  niet meegeeft blijft dit undefined → useBraceletOwner()=false, geen
   *  regressie voor bestaande users. */
  hasBracelet?: boolean;
  /** Iter v222 (2026-07-07): 'bracelet' (bracelet only) of 'bundle'
   *  (bracelet + 1 jaar audio). Uit backend `bracelet_model`. */
  braceletModel?: 'bracelet' | 'bundle';
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
              hasBracelet: obj.hasBracelet,
              braceletModel: obj.braceletModel,
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
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ENTITLEMENT_AUDIO_PRO } = require('@/services/iap-real');
    const customerInfo = await Purchases.getCustomerInfo();
    const audioPro = customerInfo?.entitlements?.active?.[ENTITLEMENT_AUDIO_PRO];
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
      /* Iter v222 (2026-07-07): backend snake_case → camelCase. Als het
         veld ontbreekt in de response blijft dit undefined en
         useBraceletOwner() geeft false — non-breaking als backend nog
         niet is uitgebreid. */
      hasBracelet:
        raw.has_bracelet_activated === true ? true : undefined,
      braceletModel:
        raw.bracelet_model === 'bracelet' || raw.bracelet_model === 'bundle'
          ? raw.bracelet_model
          : undefined,
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
/* Iter v177 (2026-07-02): return de fetchStatus promise zodat callers KUNNEN
   awaiten voor race-critical paths (sign-in → subscribe flow). Bestaande
   callers die niet awaiten blijven werken als fire-and-forget. */
export function refreshSubscription(): Promise<void> {
  fetchGeneration++;
  cachedStatus = null;
  subscribers.forEach((cb) => cb(null));
  /* Direct preventief cache-wipe zodat een verse load nooit stale
     user-A data binnenpakt. fetchStatus overschrijft 'm met de echte
     waarde wanneer 'ie klaar is. */
  clearPersistedCache().catch(() => {});
  return fetchStatus();
}

/** Iter v170 (2026-06-28): explicit sign-out marker. Synchroon notify met
 *  {active:false} zonder fetchStatus loop. Voorheen riep account.tsx
 *  alleen refreshSubscription() aan na clearSession() — dat zet status
 *  tijdelijk op null (= isLoading), en mijn iter v168 fix in (tabs)/index.tsx
 *  behandelt isLoading als hasSub=true, waardoor Audio Library de PRO-
 *  rendering BEHIELD na sign-out totdat fetchStatus voltooide (2+ sec, of
 *  bij RC SDK cache stale: helemaal niet tot app-restart). Operator zag dit
 *  als "Free Picks tile verdwijnt na sign-out, komt pas terug na app-restart".
 *
 *  setSignedOutStatus() omzeilt de fetch: direct notify {active:false} +
 *  cachedStatus update + cache-wipe. Daarna optionele refresh om backend
 *  in sync te houden, maar UI hoeft niet meer te wachten. */
export function setSignedOutStatus(): void {
  fetchGeneration++;
  const freeStatus: SubscriptionStatus = { active: false };
  notifyAll(freeStatus);
  clearPersistedCache().catch(() => {});
}

/** Iter v177 (2026-07-02): symmetrische fix voor post-purchase race.
 *  Na een succesvolle IAP-aankoop moet PRO direct actief zijn in de UI —
 *  anders ziet de zojuist-betaalde user kort de FREE-view op de Audio Library
 *  totdat een async fetchStatus is voltooid.
 *  Deze functie omzeilt de fetch: direct notify {active:true} zodat álle
 *  consumers (Audio Library tile, player, About/FAQ, etc.) synchroon zien
 *  dat de user PRO is. Backend-sync loopt daarna alsnog via refreshSubscription
 *  maar de UI wacht daar niet meer op. */
export function setProSubscribedStatus(): void {
  fetchGeneration++;
  const proStatus: SubscriptionStatus = { active: true };
  cachedStatus = proStatus;
  notifyAll(proStatus);
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
  /* Iter v196 (2026-07-04): 'bracelet' override valt terug op backend-state
     ipv forced false. Reden: audio-subscriber die z'n bracelet activeert
     krijgt override='bracelet', maar heeft realIsPro=true via IAP. Vroeger
     forceerde 'bracelet' isPro=false → Account toonde "Bracelet PRO — Add
     Audio Library" ipv "Full PRO". Nu: bracelet-only user (geen backend
     audio_pro) → isPro=false correct; bracelet+audio user → isPro=true
     via realIsPro → Full PRO detectie werkt. */
  const isPro =
    override === 'audio' || override === 'pro'
      ? true
      : override === 'guest'
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
    /* Iter v222 (2026-07-07): bracelet-ownership uit backend. Wordt
       gelezen door useBraceletOwner() in dev-user-override.ts en levert
       de bron-van-waarheid in productie. */
    hasBracelet: status?.hasBracelet === true,
    braceletModel: status?.braceletModel,
    isLoading: status === null && override === null,
    refresh: refreshSubscription,
  };
}

loadCacheOnce();
