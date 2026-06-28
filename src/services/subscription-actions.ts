/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Subscription Actions

   Iter 9dq v150 (operator 2026-06-17): Gumroad volledig verwijderd uit
   de app. Audio-subscriptions lopen vanaf nu uitsluitend via Apple
   StoreKit / Google Play Billing (IAP). Cancellation, billing-info en
   plan-wissel gaan via het OS-eigen subscription-management — Apple en
   Google policy verbiedt dat een app deze acties zelf afhandelt voor
   IAP-content.

   Voorheen woonden hier ook `gumroadManageUrl()` en `cancelSubscription()`
   (POST /api/cancel-subscription). Allebei verwijderd: geen actieve
   Gumroad-abonnees per operator-memory 2026-06-12.
   ─────────────────────────────────────────────────────────────────────── */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

/** Platform-specifieke subscription-management URL. Apple en Google EISEN
 *  dat een app een in-app-toegankelijke link biedt naar de subscription-
 *  instellingen van het OS — voor cancel, re-subscribe, billing-info, etc.
 *  App Store review fail't zonder.
 *
 *    iOS     : itms-apps://apps.apple.com/account/subscriptions
 *              (deep-link naar Settings → Apple ID → Subscriptions)
 *    Android : https://play.google.com/store/account/subscriptions
 *              (opent Play Store-app op de generieke subscription-lijst;
 *               gebruiker ziet alle eigen subs incl. VIBEZCORE)
 *
 *  Voor users met een IAP-sub: dit IS de enige manier om te managen of
 *  cancellen (Apple/Google eisen dat het via hun systeem gaat — een app
 *  mag niet zelf cancellatie afhandelen voor IAP-content).
 *
 *  Iter v169 (2026-06-28): SKU-specific Android deeplink uit v168 teruggedraaid.
 *  Live testing wees uit dat `?sku=...&package=...` vaak een "kan niet vinden"-
 *  page produceert i.p.v. de subscription detail-page — zelfs als de
 *  subscription wél op het actieve Google account staat. Yearly heeft
 *  bovendien een `:yearly` base_plan_id suffix die Play Store soms anders
 *  verwacht. Generic URL = robuuster: opent direct de subscription-lijst,
 *  gebruiker ziet z'n VIBEZCORE-sub als die er is. Account-mismatch detectie
 *  blijft via restore-purchases.ts werken (toont gerichte modal). */
export function storeSubscriptionsUrl(_tier?: 'monthly' | 'yearly'): string {
  if (Platform.OS === 'ios') {
    return 'itms-apps://apps.apple.com/account/subscriptions';
  }
  return 'https://play.google.com/store/account/subscriptions';
}
