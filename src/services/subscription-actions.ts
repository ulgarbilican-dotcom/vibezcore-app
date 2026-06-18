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

import { Platform } from 'react-native';

/** Platform-specifieke subscription-management URL. Apple en Google EISEN
 *  dat een app een in-app-toegankelijke link biedt naar de subscription-
 *  instellingen van het OS — voor cancel, re-subscribe, billing-info, etc.
 *  App Store review fail't zonder.
 *
 *    iOS     : itms-apps://apps.apple.com/account/subscriptions
 *              (deep-link naar Settings → Apple ID → Subscriptions)
 *    Android : https://play.google.com/store/account/subscriptions
 *              (opent Play Store-app in subscription-tab)
 *    Web/onbekend : Play Store-URL als pragmatische fallback
 *
 *  Voor users met een IAP-sub: dit IS de enige manier om te managen of
 *  cancellen (Apple/Google eisen dat het via hun systeem gaat — een app
 *  mag niet zelf cancellatie afhandelen voor IAP-content). */
export function storeSubscriptionsUrl(): string {
  if (Platform.OS === 'ios') {
    return 'itms-apps://apps.apple.com/account/subscriptions';
  }
  /* Android + web fallback. */
  return 'https://play.google.com/store/account/subscriptions';
}
