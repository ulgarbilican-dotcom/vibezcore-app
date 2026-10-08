/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Restore Purchases (Apple/Google policy-required)

   Apple App Store Review Guideline 3.1.1: apps die in-app purchases of
   subscriptions verkopen MOETEN een "Restore Purchases"-knop bieden.
   Google heeft een vergelijkbare vereiste in Play Console policy.

   Iter v165 (2026-06-27): VOLLEDIG VEREENVOUDIGD — RevenueCat doet alles.
   Voorheen riepen we voor elke gevonden purchase /api/iap-verify aan met
   de raw receipt + Bearer JWT. Dat brak in twee scenario's:
     1. RevenueCat geeft z'n eigen transactionIdentifier ipv een Google
        purchaseToken → /api/iap-verify gaf 400 google_400.
     2. User die restore tikt voordat 'ie inlogt → geen JWT → 'Please sign
        in' fout, terwijl Apple/Google een receipt heeft die we KUNNEN
        oppakken via RevenueCat's anonymous-user flow.

   Nieuwe flow:
     1. Init IAP (idempotent — geen overhead als al klaar).
     2. Als user ingelogd → re-link RevenueCat customer aan auth-user-id.
        Zorgt dat het webhook-event (server-to-server) bij het juiste
        Supabase account aankomt. Bij gast → RevenueCat blijft anonymous;
        entitlements zijn lokaal zichtbaar maar worden niet in backend
        opgeslagen tot user inlogt en logIn() fired.
     3. iap.restorePurchases() → triggert Purchases.restorePurchases() in
        de SDK. RevenueCat valideert receipt server-side bij Apple/Google
        en update z'n customerInfo. Async webhook update tegelijk Supabase.
     4. refreshSubscription() → useSubscription's tryRevenueCatStatus()
        leest de net-bijgewerkte customerInfo lokaal → UI ziet PRO meteen,
        zonder backend round-trip te wachten.
   ─────────────────────────────────────────────────────────────────────── */

import { getCachedSubscription, refreshSubscription } from '@/hooks/useSubscription';
import { getAuthUserIdFromToken, getToken, linkRevenueCatUser, markGuestPurchase } from './auth';
import { getIAP } from './iap';
import type { IapPurchase } from './iap-contract';

/** Iter v232 (2026-07-09): silent auto-restore na login. Voorheen moest
 *  een user die de app opnieuw installeerde eerst handmatig op
 *  "Restore purchases" tikken om z'n bestaande Play Store / App Store
 *  sub terug te krijgen. Operator-feedback: "geen enkele user weet dat
 *  2de stap restore verplicht is". Nu: sign-in triggert dit fire-and-
 *  forget. Fouten worden geswallowed — geen UI-modal, geen "Nothing to
 *  restore" alert. Als de restore lukt updaten cachedSubscription +
 *  customerInfo listeners de UI automatisch. */
export function silentRestoreAfterLogin(): void {
  void (async () => {
    try {
      const iap = getIAP();
      await iap.init();
      const token = await getToken();
      if (token) {
        const authUserId = getAuthUserIdFromToken(token);
        if (authUserId) {
          try {
            await linkRevenueCatUser(authUserId);
          } catch {
            /* swallow */
          }
        }
      }
      try {
        await iap.restorePurchases();
      } catch {
        /* swallow — 'Nothing to restore' throwt niet meer sinds v227,
           andere errors zijn niet fataal voor login flow */
      }
      try {
        await refreshSubscription();
      } catch {
        /* swallow */
      }
    } catch {
      /* swallow — helemaal silent */
    }
  })();
}

export type RestoreResult =
  | {
      ok: true;
      purchases: IapPurchase[];
      restoredCount: number;
      /* Iter v168 (2026-06-28): true wanneer Google Play / App Store geen
         actieve subscription teruggaf, maar onze VIBEZCORE-side (RC of
         backend) WEL al weet dat de user PRO is. Symptoom van een mismatch
         tussen het Play Store / Apple ID account op het device en het account
         waarop de aankoop staat. UI toont dan een uitleg-modal ipv een
         tegenstrijdig 'nothing to restore'. */
      accountMismatch?: boolean;
    }
  | { ok: false; error: string };

/** Trigger restore-purchases flow. Returnt aantal active subs gevonden door
 *  RevenueCat (= aantal entitlements actief na restore).
 *
 *  Werkt voor zowel ingelogde als anonieme users — RevenueCat handelt de
 *  anonymous-naar-named user merge automatisch af zodra logIn() fired.
 *
 *  De backend Supabase-row wordt asynchroon bijgewerkt door de RevenueCat
 *  webhook (zie netlify/functions/iap-webhook.js). UI hoeft daar niet op
 *  te wachten omdat useSubscription's tryRevenueCatStatus() rechtstreeks
 *  uit customerInfo leest (lokaal up-to-date direct na restore). */
export async function restorePurchases(): Promise<RestoreResult> {
  try {
    const iap = getIAP();
    await iap.init();

    /* Re-link RC customer aan huidige auth-user als die er is. Voorkomt dat
       een ingelogde user die net een ander toestel had aangezet de restore
       op anonymous niveau krijgt (zou de webhook nooit naar Supabase laten
       routen). Bij gast doen we niets — RC blijft anonymous. */
    const token = await getToken();
    if (token) {
      const authUserId = getAuthUserIdFromToken(token);
      if (authUserId) {
        await linkRevenueCatUser(authUserId);
      }
    }

    const purchases = await iap.restorePurchases();

    /* Audit 8 okt 2026: een gast die herstelt (nieuw toestel, herinstallatie)
       krijgt dezelfde gast-aankoop-marker als bij een aankoop. Zo blijft hij
       Premium na een herstart, en gaat de aankoop mee naar het account dat
       hij daarna maakt. */
    if (!token && purchases.length > 0) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const Purchases = require('react-native-purchases').default;
        const info = await Purchases.getCustomerInfo();
        await markGuestPurchase(info?.originalAppUserId);
      } catch {
        /* swallow */
      }
    }

    /* Iter v230 (2026-07-08, audit BUG 5): AWAIT refreshSubscription zodat
       accountMismatch-detectie hieronder op VERSE state werkt, niet op
       stale cache. Voorheen unawaited → cachedSubscription kon nog PRO
       tonen van vóór signout terwijl restore in werkelijkheid niks vond →
       accountMismatch false-positive. Ook: de backend Supabase-row is
       nu getest via /api/subscription-status → als RC webhook faalde,
       vinden we dat direct ipv 24h stille desync. */
    await refreshSubscription();

    /* Iter v168 (2026-06-28): account-mismatch detectie. Operator zag de
       tegenstrijdige UI 'Audio PRO Monthly' (Account) + 'Nothing to restore'
       (modal) in één view — root cause: Play Store account ≠ VIBEZCORE
       account. Detectie: 0 restored maar onze huidige useSubscription-cache
       weet dat user al PRO is (RC entitlement of backend status). */
    const accountMismatch =
      purchases.length === 0 && getCachedSubscription()?.active === true;

    return {
      ok: true,
      purchases,
      restoredCount: purchases.length,
      ...(accountMismatch ? { accountMismatch: true } : {}),
    };
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (__DEV__) console.warn('[restorePurchases] failed:', message);
    return {
      ok: false,
      error: message || 'Could not restore purchases. Please try again.',
    };
  }
}
