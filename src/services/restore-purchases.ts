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

import { refreshSubscription } from '@/hooks/useSubscription';
import { getIAP } from './iap';
import type { IapPurchase } from './iap-contract';

export type RestoreResult =
  | { ok: true; purchases: IapPurchase[]; restoredCount: number }
  | { ok: false; error: string };

/** Trigger restore-purchases flow. Returnt aantal active subs gevonden
 *  + verified bij backend. Bij 0 active = user heeft niets te restoren
 *  (Apple/Google rapporteerden geen purchases voor dit account).
 *
 *  Backend-call POST /api/iap-verify is momenteel een TODO — wanneer
 *  endpoint live is, vul de fetch in. Tot dan: we returnen alleen wat
 *  Apple/Google teruggaf zonder backend-koppeling. Dat is niet ideaal
 *  maar voorkomt een dood UI in dev mock-mode. */
export async function restorePurchases(): Promise<RestoreResult> {
  try {
    const iap = getIAP();
    await iap.init();
    const purchases = await iap.restorePurchases();

    if (purchases.length === 0) {
      return { ok: true, purchases: [], restoredCount: 0 };
    }

    /* TODO (backend-dependency): voor elke purchase POST /api/iap-verify
       met {platform, productId, transactionId, receiptToken}. Backend
       valideert bij Apple/Google en linkt aan Supabase-user. Voor nu
       skippen we deze stap zodat de mock-flow eind-tot-eind werkt. */
    if (__DEV__) {
      console.log(
        '[restorePurchases] would POST /api/iap-verify for each:',
        purchases.map((p) => ({
          tier: p.tier,
          transactionId: p.transactionId,
          isRestore: p.isRestore,
        }))
      );
    }

    /* Triggert subscription-status fetch — als backend de restored
       purchases inderdaad heeft gelinkt, ziet useSubscription nu de
       PRO-state. */
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
