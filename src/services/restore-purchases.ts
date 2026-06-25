/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Restore Purchases (Apple/Google policy-required)

   Apple App Store Review Guideline 3.1.1: apps die in-app purchases of
   subscriptions verkopen MOETEN een "Restore Purchases"-knop bieden.
   Google heeft een vergelijkbare vereiste in Play Console policy.

   Wanneer een user de app herinstalleert of op een nieuw toestel inlogt,
   moet 'ie z'n bestaande subscription kunnen "restoren" — d.w.z. de
   IAP-receipt opnieuw ophalen bij Apple/Google en linken aan het
   ingelogde VIBEZCORE-account.

   Flow:
     1. iap.restorePurchases() → vraagt aan Apple/Google welke active
        subs deze Apple-ID / Google-account heeft
     2. Voor elke gevonden purchase: POST /api/iap-verify met de receipt
        zodat backend 'm aan de ingelogde Supabase user koppelt
     3. refreshSubscription() → useSubscription hook ziet de nieuwe state
     4. UI toont success / error

   Iter 9dq v86 (2026-06-03).
   ─────────────────────────────────────────────────────────────────────── */

import { Platform } from 'react-native';

import { refreshSubscription } from '@/hooks/useSubscription';
import { getToken, VZ_BACKEND_URL } from './auth';
import { getIAP } from './iap';
import type { IapPurchase } from './iap-contract';

export type RestoreResult =
  | { ok: true; purchases: IapPurchase[]; restoredCount: number }
  | { ok: false; error: string };

/** Trigger restore-purchases flow. Returnt aantal active subs gevonden
 *  + verified bij backend. Bij 0 active = user heeft niets te restoren
 *  (Apple/Google rapporteerden geen purchases voor dit account).
 *
 *  Backend POST /api/iap-verify: voor elke purchase een aparte call zodat
 *  ze elk hun eigen verify-flow krijgen. Partial success accepteren: zelfs
 *  als 1 van de 2 mislukt willen we de andere wel restoren. Backend is
 *  idempotent op transactionId (zie iap-verify.js). */
export async function restorePurchases(): Promise<RestoreResult> {
  try {
    const iap = getIAP();
    await iap.init();
    const purchases = await iap.restorePurchases();

    if (purchases.length === 0) {
      return { ok: true, purchases: [], restoredCount: 0 };
    }

    const token = await getToken();
    if (!token) {
      return { ok: false, error: 'Please sign in before restoring purchases.' };
    }

    let restoredCount = 0;
    /* Iter v148 (2026-06-25): platform string + receipt field name moeten
       matchen met backend contract — 'apple'/'google' (niet 'ios'/'android')
       en `receipt` (niet `receiptToken`). Zelfde fix als subscribe.tsx. */
    const platform = Platform.OS === 'ios' ? 'apple' : 'google';

    for (const p of purchases) {
      try {
        const res = await fetch(`${VZ_BACKEND_URL}/api/iap-verify`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            platform,
            tier: p.tier,
            productId: p.productId,
            transactionId: p.transactionId,
            receipt: p.receiptToken,
          }),
        });
        if (res.ok) {
          const data = await res.json().catch(() => ({}));
          if (data?.active === true) restoredCount += 1;
        } else if (__DEV__) {
          const text = await res.text().catch(() => '');
          console.warn('[restorePurchases] verify HTTP error:', res.status, text);
        }
      } catch (err) {
        if (__DEV__) console.warn('[restorePurchases] verify error:', err);
        /* continue with next purchase */
      }
    }

    /* Triggert subscription-status fetch — als backend de restored
       purchases inderdaad heeft gelinkt, ziet useSubscription nu de
       PRO-state. */
    refreshSubscription();

    return {
      ok: true,
      purchases,
      restoredCount,
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
