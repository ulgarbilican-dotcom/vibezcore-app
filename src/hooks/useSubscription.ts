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

import { GUEST_PURCHASE_RC_ID_KEY, getToken } from '@/services/auth';
import { apiCall } from '@/utils/api';
import { useDevUserOverride } from '@/utils/dev-user-override';
import { subscriptionTierFromEntitlement } from '@/services/iap-contract';
import { syncAccessNotifications } from '@/services/access-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';

/* Iter v225 (2026-07-07): bump cache key naar v3 want RC-only cache uit
 * v2 mist hasBracelet permanent voor audio-subscribers (shortcircuit-bug).
 * Nieuwe key = auto-invalidatie zodra vC 69 draait. */
export const SUB_CACHE_KEY = 'vz_sub_v3';
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export type SubscriptionStatus = {
  active: boolean;
  /** 'day' = dagpas (operator, 16 okt 2026): 24 uur alles open, geen
   *  abonnement — `validUntil` = aankoop + 24 uur, `willRenew` false. */
  tier?: 'monthly' | 'yearly' | 'day';
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
  /** Operator, 26 september 2026 (toegangsmodel-gat gevonden en gedicht):
   *  RevenueCat's `entitlement.periodType === 'TRIAL'` — de gebruiker zit
   *  in de 7-dagen-proefperiode van het jaarabonnement, nog niet echt
   *  betaald. `active` is dan óók `true` (RC behandelt een trial als een
   *  actieve entitlement), dus zonder dit veld is een trial-user niet te
   *  onderscheiden van een volledig betaalde abonnee. Bedoeld
   *  toegangsmodel (project-free-tier-facts, operator-bevestigd
   *  26 september 2026): trial ontgrendelt enkel de `account`-tier
   *  sessies (17, zie audio-library-data.ts) + Breathwork, NIET de
   *  volledige PRO-catalogus — dat vereist dit onderscheid. Operator,
   *  1 okt 2026: "27" hier was het al op 1 sept gecorrigeerde foute
   *  getal (10 public + 17 account), dit commentaar had de fix gemist. */
  isTrialing?: boolean;
  /** 29 okt 2026: ISO-moment waarop de store een betaalprobleem meldde (RevenueCat `billingIssueDetectedAt`) — voor de
   *  melding "Update your payment to keep Premium" (services/access-notifications.ts). */
  billingIssueAt?: string;
  /** Iter 9dq v150 (operator 2026-06-17): Gumroad-veld verwijderd. App is
   *  IAP-only (App Store / Play Store). Geen Gumroad-subscriptions meer
   *  in productie — operator-besluit "GUMROAD NIET MEER VOOR DE APP".
   *  Cancellation gaat via storeSubscriptionsUrl() (Apple/Google policy). */
};

type CachedShape = SubscriptionStatus & { cachedAt: number };

let cachedStatus: SubscriptionStatus | null = null;
let cacheLoaded = false;
let cacheLoadPromise: Promise<void> | null = null;
/* Iter v227 (2026-07-07, audit B3): dedup fetches per generation ipv
   simple isFetching boolean. Twee calls binnen dezelfde generation →
   2e skip (correct, geen nieuwe data). Twee calls met NIEUWE generation
   (bump door refreshSubscription) → beide runnen (nodig — 1e wordt
   toch discarded). Voorheen: v226 verwijderde isFetching → RC 429
   rate-limit risk bij AppState-toggling; v225-en-eerder: isFetching
   blokkeerde ook NEW-generation fetches → Full PRO detectie faalde. */
let currentFetchGen: number | null = null;
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

/* Operator, 26 september 2026 ("denk volledig anders, alle scenario's
   nakijken"): dezelfde root cause als audio-player.ts's notify() — deze
   functie wordt aangeroepen vanuit `refreshSubscription()`, die op zijn
   beurt vuurt vanuit ECHTE native-bridge-callbacks: RevenueCat's
   `addCustomerInfoUpdateListener` (root _layout.tsx) én React Native's
   eigen `AppState.addEventListener('change', ...)` bij elke voorgrond-
   wissel. Deze hook draait op vrijwel elk scherm (account/index/player/
   bracelet/...), dus een synchrone `subscribers.forEach` hier kan op
   ELK moment, op ELK scherm, samenvallen met een lopende React-commit —
   exact dezelfde "Should not already be working"-reëntrantie, maar dan
   niet aan één specifiek scherm te koppelen (wat verklaart waarom de
   crash willekeurig leek qua sessie/scherm). Zelfde fix: de daadwerkelijke
   React-notificatie één tick uitstellen. `cachedStatus` blijft synchroon
   bijgewerkt — synchrone lezers (bv. `getCachedSubscription()`) zien de
   nieuwe waarde meteen, enkel de subscriber-callbacks (die naar React
   `setState` leiden) schuiven op. */
/* Dagpas: precies op het einde van de 24 uur opnieuw kijken, zodat alles
   meteen weer op slot gaat — ook als de app al die tijd open stond. */
let dayPassTimer: ReturnType<typeof setTimeout> | null = null;
function scheduleDayPassEnd(status: SubscriptionStatus | null): void {
  if (dayPassTimer) {
    clearTimeout(dayPassTimer);
    dayPassTimer = null;
  }
  if (!status?.active || status.tier !== 'day' || !status.validUntil) return;
  const ms = Date.parse(status.validUntil) - Date.now();
  if (!Number.isFinite(ms)) return;
  /* setTimeout kan niet verder dan ~24,8 dagen; een pas loopt max 24 u. */
  dayPassTimer = setTimeout(() => {
    dayPassTimer = null;
    void refreshSubscription();
  }, Math.max(0, ms) + 1000);
}

function notifyAll(status: SubscriptionStatus | null): void {
  cachedStatus = status;
  scheduleDayPassEnd(status);
  /* 29 okt 2026: meldingen rond het einde van de toegang volgen elke nieuwe status (dagpas, opgezegd, betaalprobleem). */
  syncAccessNotifications(status);
  setTimeout(() => {
    subscribers.forEach((cb) => cb(status));
  }, 0);
}

/* Audit 8 okt 2026: een bewaarde status waarvan de einddatum voorbij is,
   telt niet meer als actief — anders bleef je offline eeuwig Premium. */
function withoutExpired(st: SubscriptionStatus): SubscriptionStatus {
  if (!st.active || !st.validUntil) return st;
  const end = Date.parse(st.validUntil);
  return Number.isFinite(end) && end < Date.now() ? { ...st, active: false } : st;
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

/* 30 okt 2026 (audit Free/Premium): een gast die op dit toestel kocht, zag bij elke koude start 1-2 s Free (slotjes,
   60 s-voorproef bij een tik) tot RevenueCat antwoordde. Zijn laatst door RevenueCat bevestigde status bewaren we
   apart, vastgemaakt aan de anonieme RevenueCat-ID van de aankoop (de gast-markering): zonder die markering, of met
   een andere ID, wordt hij nooit gelezen — dus geen oude Premium voor een uitgelogde of andere gebruiker. */
const GUEST_SUB_CACHE_KEY = 'vz_sub_guest_v1';

async function persistGuestCache(rcId: string, status: SubscriptionStatus): Promise<void> {
  try {
    await AsyncStorage.setItem(GUEST_SUB_CACHE_KEY, JSON.stringify({ ...status, rcId, cachedAt: Date.now() }));
  } catch {
    /* swallow */
  }
}

async function clearGuestCache(): Promise<void> {
  try {
    await AsyncStorage.removeItem(GUEST_SUB_CACHE_KEY);
  } catch {
    /* swallow */
  }
}

/** Gast-markering + de daaraan vastgemaakte bewaarde status (enkel als die nog actief en niet verlopen is). */
async function readGuestCache(): Promise<{ marker: string | null; status: SubscriptionStatus | null }> {
  try {
    const marker = await AsyncStorage.getItem(GUEST_PURCHASE_RC_ID_KEY);
    if (!marker) return { marker: null, status: null };
    const raw = await AsyncStorage.getItem(GUEST_SUB_CACHE_KEY);
    const obj = raw ? (JSON.parse(raw) as SubscriptionStatus & { rcId?: string }) : null;
    if (!obj || obj.rcId !== marker || obj.active !== true) return { marker, status: null };
    const status = withoutExpired({
      active: true,
      tier: obj.tier,
      status: obj.status,
      validUntil: obj.validUntil,
      willRenew: obj.willRenew,
      isTrialing: obj.isTrialing,
    });
    return { marker, status: status.active ? status : null };
  } catch {
    return { marker: null, status: null };
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
        /* 30 okt 2026: gast-koper → meteen zijn bewaarde Premium; markering zonder bewaarde status → nog even
           "laden" (null) i.p.v. Free, fetchStatus beslist. Zonder markering: Free, zoals altijd. */
        const guest = await readGuestCache();
        if (guest.status) notifyAll(guest.status);
        else if (!guest.marker) notifyAll({ active: false });
        cacheLoaded = true;
        /* Audit 8 okt 2026 (blokkerend): een gast die kocht, moest na een
           koude start ook Premium zijn. fetchStatus kiest zelf: zonder
           gast-aankoop op dit toestel blijft het Free. */
        void fetchStatus();
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
          /* Iter v226 (2026-07-07): stale-while-revalidate. Ook verlopen
             cache tonen (>24h) zodat UI direct wat renderd. fetchStatus
             overschrijft daarna met verse data. Voorheen bleef "Checking…"
             flash hangen tot response — 500-1500ms. */
          const status: SubscriptionStatus = {
            active: obj.active,
            tier: obj.tier,
            status: obj.status,
            email: obj.email,
            validUntil: obj.validUntil,
            willRenew: obj.willRenew,
            hasBracelet: obj.hasBracelet,
            braceletModel: obj.braceletModel,
            isTrialing: obj.isTrialing,
          };
          notifyAll(withoutExpired(status));
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
/* 30 okt 2026: true als de laatste RevenueCat-vraag MISLUKTE (SDK nog niet klaar / geen verbinding) — iets anders dan
   "geen abonnement". Dan houden we de laatst bekende status i.p.v. iemand onterecht op Free te zetten. */
let lastRcCallFailed = false;
async function tryRevenueCatStatus(
  requireAppUserId?: string,
): Promise<SubscriptionStatus | null> {
  lastRcCallFailed = false;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Purchases = require('react-native-purchases').default;
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { ENTITLEMENT_AUDIO_PRO } = require('@/services/iap-real');
    const customerInfo = await Purchases.getCustomerInfo();
    if (requireAppUserId && customerInfo?.originalAppUserId !== requireAppUserId) return null;
    const audioPro = customerInfo?.entitlements?.active?.[ENTITLEMENT_AUDIO_PRO];
    if (!audioPro) {
      /* Geen abonnement: een lopende dagpas opent alles tot 24 uur na de
         aankoop (losse aankoop, bewust niet aan het entitlement gekoppeld). */
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { activeDayPass } = require('@/services/iap-real');
      const pass = activeDayPass(customerInfo);
      if (!pass) return null; /* niets actief — fall through */
      return {
        active: true,
        tier: 'day',
        status: 'active',
        validUntil: pass.validUntil,
        willRenew: false,
        isTrialing: false,
      };
    }
    const productId: string | undefined = audioPro.productIdentifier;
    const tier: 'monthly' | 'yearly' | undefined = subscriptionTierFromEntitlement(
      productId,
      typeof audioPro.latestPurchaseDate === 'string' ? audioPro.latestPurchaseDate : undefined,
      typeof audioPro.expirationDate === 'string' ? audioPro.expirationDate : undefined,
    );
    return {
      active: true,
      tier,
      status: 'active',
      validUntil:
        typeof audioPro.expirationDate === 'string'
          ? audioPro.expirationDate
          : undefined,
      willRenew: audioPro.willRenew === true,
      /* Operator, 26 september 2026: `periodType` is RevenueCat's eigen
         onderscheid tussen "TRIAL"/"INTRO"/"NORMAL"/"PREPAID" — de enige
         betrouwbare bron om trial vs. echt-betaald te weten (de backend
         kent dit onderscheid niet, dus GEEN fallback op backendStatus
         hier). */
      isTrialing: audioPro.periodType === 'TRIAL',
      billingIssueAt: typeof audioPro.billingIssueDetectedAt === 'string' ? audioPro.billingIssueDetectedAt : undefined,
    };
  } catch {
    lastRcCallFailed = true;
    return null; /* SDK niet geladen / native module mist — fall back */
  }
}

/* Iter v225 (2026-07-07): backend fetch als aparte helper. Nu altijd
 * aangeroepen (ook als RC actieve entitlement heeft) omdat de backend
 * de enige bron is voor bracelet-ownership (has_bracelet_activated).
 * Voorheen: RC shortcircuit skipte de backend → bundle-users die audio
 * KOCHTEN via IAP en dan bracelet activeerden zagen "Audio PRO" ipv
 * "Full PRO" want hasBracelet bleef undefined. */
async function fetchBackendStatus(): Promise<SubscriptionStatus | null> {
  try {
    const token = await getToken();
    if (!token) return null;
    const raw = await apiCall<Record<string, unknown>>(
      '/api/subscription-status',
      { auth: true }
    );
    return {
      active: raw.active === true,
      tier:
        raw.tier === 'monthly' || raw.tier === 'yearly' ? raw.tier : undefined,
      status: typeof raw.status === 'string' ? raw.status : undefined,
      email: typeof raw.email === 'string' ? raw.email : undefined,
      validUntil:
        typeof raw.valid_until === 'string' ? raw.valid_until : undefined,
      willRenew:
        typeof raw.will_renew === 'boolean' ? raw.will_renew : undefined,
      hasBracelet:
        raw.has_bracelet_activated === true ? true : undefined,
      braceletModel:
        raw.bracelet_model === 'bracelet' || raw.bracelet_model === 'bundle'
          ? raw.bracelet_model
          : undefined,
    };
  } catch (e) {
    if (__DEV__) console.warn('[useSubscription] backend fetch failed:', e);
    return null;
  }
}

/* TESTBUILD-ONLY (21 okt 2026): forceer een toegangsniveau zonder echte aankoop, om elk niveau
   (free, dagpas, maand, jaar) te kunnen doorlopen. Alleen actief als de build met
   EXPO_PUBLIC_VZ_TEST=1 is gemaakt; in een store-build is `process.env.EXPO_PUBLIC_VZ_TEST`
   undefined en doet dit niets. */
let testOverride: SubscriptionStatus | null = null;
export function setTestTier(tier: 'free' | 'day' | 'monthly' | 'yearly' | 'off'): void {
  if (process.env.EXPO_PUBLIC_VZ_TEST !== '1') return;
  const dayEnd = new Date(Date.now() + 20 * 3600 * 1000).toISOString();
  const year = new Date(Date.now() + 200 * 24 * 3600 * 1000).toISOString();
  testOverride =
    tier === 'off' ? null
    : tier === 'free' ? { active: false }
    : tier === 'day' ? { active: true, tier: 'day', validUntil: dayEnd, willRenew: false }
    : { active: true, tier, validUntil: year, willRenew: true };
  fetchGeneration++;
  if (testOverride) { cachedStatus = testOverride; notifyAll(testOverride); } else void fetchStatus();
}

async function fetchStatus(): Promise<void> {
  if (testOverride) { notifyAll(testOverride); return; }
  const myGen = fetchGeneration;
  if (currentFetchGen === myGen) return;
  currentFetchGen = myGen;
  try {
    /* Iter v230 (2026-07-08, KRITIEK — v229 regressie): guard op TOKEN, niet
       op backend-response. v229 pakte `backendStatus === null` als proxy
       voor guest, maar dat vlagt ook backend 5xx / network timeout →
       PRO-user zakt intermittent naar FREE bij transient backend-fout.
       Nu: check token eerst; geen token → guest (echte lek van v229 dicht);
       token aanwezig maar backend faalt → val terug op RC + cachedStatus
       (geen regressie). */
    const token = await getToken();
    if (myGen !== fetchGeneration) return;
    if (!token) {
      /* Operator, 7 okt 2026 (account-audit, blokkerend): een gast mag
         zonder account kopen (Apple 5.1.1v) — die aankoop staat op de
         anonieme RevenueCat-klant van dit toestel. Zonder deze tak zag de
         koper "Welcome to Premium" en bleef alles op slot. Enkel
         RevenueCat (store-gevalideerd), nooit de lokale cache: een
         uitgelogde gebruiker krijgt na `Purchases.logOut()` een verse
         anonieme klant zonder abonnement, dus het lek van 9aq komt niet
         terug. */
      /* Audit 8 okt 2026: enkel de anonieme RevenueCat-ID waarop op DIT
         toestel gekocht of hersteld werd (marker) — nooit een abonnement
         dat via een mislukte logOut of geërfde entitlement op het toestel
         achterbleef. Zonder marker: meteen Free, zonder SDK-call. */
      let guestId: string | null = null;
      try {
        guestId = await AsyncStorage.getItem(GUEST_PURCHASE_RC_ID_KEY);
      } catch {
        guestId = null;
      }
      let guestRc: SubscriptionStatus | null = null;
      if (guestId) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { getIAP } = require('@/services/iap');
          await getIAP().init();
        } catch {
          /* SDK niet klaar → tryRevenueCatStatus geeft null */
        }
        guestRc = await tryRevenueCatStatus(guestId);
      }
      const guestRcFailed = !!guestId && lastRcCallFailed;
      if (myGen !== fetchGeneration) return;
      clearPersistedCache();
      /* 30 okt 2026: RevenueCat even onbereikbaar → laatst bevestigde Premium houden (met eigen einddatum). */
      if (guestRcFailed && cachedStatus?.active) {
        const kept = withoutExpired(cachedStatus);
        if (kept.active) {
          notifyAll(kept);
          return;
        }
      }
      if (guestId && guestRc?.active) void persistGuestCache(guestId, guestRc);
      else void clearGuestCache();
      notifyAll(guestRc?.active ? guestRc : { active: false });
      return;
    }

    const [rcStatus, backendStatus] = await Promise.all([
      tryRevenueCatStatus(),
      fetchBackendStatus(),
    ]);
    const rcFailed = lastRcCallFailed;
    if (myGen !== fetchGeneration) return;
    /* 30 okt 2026 (audit Free/Premium): RevenueCat nog niet klaar bij een koude start → de server kent geen dagpas en
       loopt soms achter op de store. Dan de laatst bekende Premium houden i.p.v. even Free; de RevenueCat-listener
       ververst zodra de koppeling klaar is. */
    const keepLastKnown =
      !rcStatus?.active && rcFailed && backendStatus?.active !== true && cachedStatus?.active === true
        ? withoutExpired(cachedStatus)
        : null;

    /* Base: RC audio-state als actief, anders backend, anders cachedStatus
       (transient backend fail → behoud vorige waarheid). */
    const base: SubscriptionStatus = rcStatus?.active
      ? rcStatus
      : keepLastKnown?.active
        ? keepLastKnown
        : backendStatus
        ? /* Ook de server kan achterlopen (8 okt 2026: "active" met einddatum
             juli) — een verlopen einddatum telt nooit als actief. */
          withoutExpired(backendStatus)
        : withoutExpired(cachedStatus ?? { active: false });

    /* Bracelet-info uit backend WANNEER backend antwoordde. Backend fail →
       behoud vorige waarde uit cachedStatus. */
    const preservedHasBracelet =
      backendStatus === null
        ? cachedStatus?.hasBracelet
        : backendStatus.hasBracelet === true
          ? true
          : undefined;
    const preservedBraceletModel =
      backendStatus === null
        ? cachedStatus?.braceletModel
        : backendStatus.braceletModel;

    const merged: SubscriptionStatus = {
      ...base,
      hasBracelet: preservedHasBracelet,
      braceletModel: preservedBraceletModel,
      email: base.email || backendStatus?.email || cachedStatus?.email,
    };

    notifyAll(merged);
    persistCache(merged);
  } catch (e: any) {
    if (__DEV__) console.warn('[useSubscription] fetch failed:', e?.message ?? e);
    if (myGen !== fetchGeneration) return;
    if (cachedStatus === null) {
      notifyAll({ active: false });
    }
  } finally {
    if (currentFetchGen === myGen) currentFetchGen = null;
  }
}

/** Synchrone snapshot voor non-React consumers (bv. audio-player service).
 *  Geen fetch, alleen huidige cache. */
export function getCachedSubscription(): SubscriptionStatus | null {
  return cachedStatus;
}

/** Iter v226 (2026-07-07): non-hook subscribe voor modules die zonder
 *  circulaire import de subscription-cache willen volgen. Gebruikt door
 *  useBraceletOwner + useDevBraceletActivated in dev-user-override.ts.
 *  Voorheen deden die hooks een require('@/hooks/useSubscription') binnenin
 *  hun body, wat een circulaire dependency oplevert (useSubscription
 *  importeert useDevUserOverride terug). Metro handelde het lazy af maar
 *  gaf op cold-start "useSubscription is not a function" bij bepaalde
 *  bundling volgordes. Returnt unsubscribe. */
export function subscribeSubscription(
  cb: (s: SubscriptionStatus | null) => void,
): () => void {
  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
  };
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
  /* Iter v228 (2026-07-08, KRITIEK SECURITY FIX): NOOIT nullen tijdens
     fetch. Voorheen v227 B2 nulde cachedStatus voor niet-active users
     → notify(null) → useSubscription().isLoading=true → Audio Library
     tab code `hasSub = isLoading ? true : isPro` → uitgelogde/free
     users kregen PRO-behandeling tijdens elke AppState=active refresh
     → volledige Audio Library toegankelijk voor gasten → premium
     content lekt. Nu: laat cachedStatus staan; fetchStatus overschrijft
     met verse data zodra klaar. Persistent cache wordt wel gewist
     zodat een sign-out expliciet setSignedOutStatus({active:false})
     kan zetten zonder oude PRO uit disk te reïncarneren. */
  /* 30 okt 2026 (audit Free/Premium): de schijf-cache NIET meer wissen bij elke refresh (elke keer de app naar voren
     komt). Werd de app gesloten vóór de fetch klaar was, dan startte een Premium-gebruiker de volgende keer zonder
     cache → even Free. Uitloggen wist de cache zelf (setSignedOutStatus), inloggen ook (setSigningInStatus), en een
     start zonder token wist hem in loadCacheOnce; fetchStatus overschrijft hem met verse data. */
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

/** Iter v229 (2026-07-08): expliciete "loading" state voor sign-in flows.
 *  Voorheen: bij login met bestaand PRO-account bleef cachedStatus op
 *  {active:false} van de vorige uitgeloggde sessie tot fetchStatus klaar
 *  was → user zag 1-2 sec "free environment" flash vóór "Audio PRO
 *  Monthly" verscheen. Nu: account.tsx roept deze aan direct vóór
 *  refreshSubscription() → cachedStatus=null → isLoading=true → tabs
 *  tonen "Checking..." ipv verkeerde free-state. Fetch overschrijft
 *  straks met correcte data. */
export function setSigningInStatus(): void {
  fetchGeneration++;
  cachedStatus = null;
  setTimeout(() => { subscribers.forEach((cb) => cb(null)); }, 0);
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
export function setProSubscribedStatus(isTrialing = false, dayPassUntil?: string): void {
  fetchGeneration++;
  /* Iter v227 (2026-07-07, audit B6): merge in bestaande cache ipv
     vervangen. Voorheen: {active:true} zonder andere velden → wist
     hasBracelet uit → bracelet-owner koopt audio → 1-2s "Audio PRO"
     ipv "Full PRO" totdat backend-fetch landt. Nu: preserve alle
     bestaande velden (hasBracelet, braceletModel, email). */
  const proStatus: SubscriptionStatus = {
    ...(cachedStatus ?? {}),
    active: true,
    /* Audit 8 okt 2026: een trial-aankoop is meteen een trial — anders
       speelde de Pro-audio even zonder voorproef-grens tot de refresh. */
    isTrialing,
    /* Van dagpas naar abonnement: de pas-velden vallen weg, de refresh
       vult het abonnement aan. */
    ...(dayPassUntil
      ? { tier: 'day' as const, validUntil: dayPassUntil, willRenew: false }
      : cachedStatus?.tier === 'day'
        ? { tier: undefined, validUntil: undefined, willRenew: undefined }
        : {}),
  };
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
  /* Iter v228 (2026-07-08): bundle-fallback. Backend `/api/bracelet/activate`
     schrijft momenteel bij `model=bundle` alleen users.has_bracelet=true en
     bracelet_model='bundle', geen subscriptions-row voor de 1-jaar audio-
     component. Zonder subscription-row = active:false = isPro=false =
     Account tab toont "Bracelet PRO" ipv "Full Bundle". Defensive fallback:
     als braceletModel === 'bundle' → user is per definitie Full PRO. Backend
     krijgt hopelijk later een subscription-row voor bundle-users, dan wordt
     realIsPro=true en is deze fallback moot. */
  const bundleAsPro = status?.braceletModel === 'bundle';
  const isPro =
    override === 'audio' || override === 'pro'
      ? true
      : override === 'guest'
        ? false
        : realIsPro || bundleAsPro;

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
    /* Operator, 26 september 2026: echte trial-status, ongeacht override —
       consumers die content moeten gaten op "echt betaald vs. trial"
       (access-tier.ts, audio-player.ts) lezen dit, niet `isPro`. Devs die
       PRO-override gebruiken simuleren bewust een volledig betaalde
       gebruiker, geen trial, dus override forceert dit NIET naar true. */
    isTrialing: status?.isTrialing === true,
    tier: status?.tier,
    /* 19 okt 2026 (punt 23b): e-mail van het account achter deze status —
       Welcome Back koppelt het bewaarde 'wasPro'-einde aan hetzelfde account. */
    email: status?.email,
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
