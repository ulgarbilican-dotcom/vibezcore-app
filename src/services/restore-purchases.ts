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

import { refreshSubscription } from '@/hooks/useSubscription';
import { getAuthUserIdFromToken, getToken, linkRevenueCatUser } from './auth';
import { getIAP } from './iap';
import type { IapPurchase } from './iap-contract';

export type RestoreResult =
  | { ok: true; purchases: IapPurchase[]; restoredCount: number }
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

    /* Triggert subscription-status fetch — tryRevenueCatStatus() in
       useSubscription leest customerInfo lokaal (al bijgewerkt door SDK)
       en zet PRO direct in UI. Backend Supabase-row volgt via webhook. */
    refreshSubscription();

    return {
      ok: true,
      purchases,
      restoredCount: purchases.length,
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
