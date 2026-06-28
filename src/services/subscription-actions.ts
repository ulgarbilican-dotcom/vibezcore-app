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
 *    Android : https://play.google.com/store/account/subscriptions?sku=...&package=...
 *              (opent Play Store-app op VIBEZCORE subscription-page als
 *               die bestaat op het actieve Google Play account; anders valt
 *               Play Store terug op de generieke subscription-lijst)
 *    Web/onbekend : Play Store-URL als pragmatische fallback
 *
 *  Voor users met een IAP-sub: dit IS de enige manier om te managen of
 *  cancellen (Apple/Google eisen dat het via hun systeem gaat — een app
 *  mag niet zelf cancellatie afhandelen voor IAP-content).
 *
 *  Iter v168 (2026-06-28): SKU-specific Android deeplink. Voorheen openden
 *  we de generieke /subscriptions pagina. Operator zag bij multi-account
 *  testing dat VIBEZCORE niet zichtbaar was (Play Store account ≠ VIBEZCORE
 *  account). Met SKU + package opent Play Store direct op de VIBEZCORE
 *  subscription detail-page wanneer die bestaat, wat een betere hint
 *  geeft als de subscription op een ander Google account staat. Optioneel
 *  tier ('monthly'/'yearly') bepaalt welke SKU. Default 'monthly'. */
export function storeSubscriptionsUrl(tier?: 'monthly' | 'yearly'): string {
  if (Platform.OS === 'ios') {
    return 'itms-apps://apps.apple.com/account/subscriptions';
  }
  /* Android: SKU-specifieke URL. Package + product-id uit app.json zodat
     een naam-wissel later geen broken deeplink achterlaat. */
  const pkg =
    (Constants.expoConfig?.android?.package as string | undefined) ??
    'com.vibezcore.app';
  const sku =
    tier === 'yearly' ? 'vibezcore_audio_yearly' : 'vibezcore_audio_monthly';
  return `https://play.google.com/store/account/subscriptions?sku=${sku}&package=${pkg}`;
}
