/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Subscription Actions

   Wrapper rond de backend-endpoints voor het beheren van een actieve
   Gumroad-subscription. Twee paden:

     1. `manageBilling(subscriberId)` — opent direct de Gumroad customer-
        portal voor deze subscriber. Geen backend-call nodig; de URL is
        deterministisch op basis van de `gumroad_subscriber_id` die
        /api/subscription-status meegeeft.

     2. `cancelSubscription()` — calls POST /api/cancel-subscription.
        Backend markeert pending-cancel in onze DB en returnt een
        `manage_url` die naar Gumroad's portal wijst, waar user de
        cancellatie definitief moet bevestigen. Gumroad's webhook
        reconcilieert daarna onze DB.

   Bron-endpoints: `cancel-subscription.js` (Netlify Function).
   ─────────────────────────────────────────────────────────────────────── */

import { apiCall } from '@/utils/api';
import { Platform } from 'react-native';

/** Bouwt de Gumroad customer-portal URL voor een subscriber-id.
 *  Format: https://app.gumroad.com/subscriptions/{subscriber_id}/manage
 *  Dezelfde URL die backend zou returnen via cancel-subscription. */
export function gumroadManageUrl(subscriberId: string): string {
  return `https://app.gumroad.com/subscriptions/${encodeURIComponent(subscriberId)}/manage`;
}

/** Iter 9dq v83 (2026-06-03): platform-specifieke subscription-management
 *  URL. Apple en Google EISEN dat een app een in-app-toegankelijke link
 *  biedt naar de subscription-instellingen van het OS — voor cancel,
 *  re-subscribe, billing-info, etc. App Store review fail't zonder.
 *
 *    iOS     : itms-apps://apps.apple.com/account/subscriptions
 *              (deep-link naar Settings → Apple ID → Subscriptions)
 *    Android : https://play.google.com/store/account/subscriptions
 *              (opent Play Store-app in subscription-tab)
 *    Web/onbekend : Play Store-URL als pragmatische fallback
 *
 *  Voor users met een IAP-sub: dit IS de enige manier om te managen
 *  of cancellen (Apple/Google eisen dat het via hun systeem gaat —
 *  een app mag niet zelf cancellatie afhandelen voor IAP-content). */
export function storeSubscriptionsUrl(): string {
  if (Platform.OS === 'ios') {
    return 'itms-apps://apps.apple.com/account/subscriptions';
  }
  /* Android + web fallback. */
  return 'https://play.google.com/store/account/subscriptions';
}

/** Response shape voor /api/cancel-subscription. */
export type CancelSubscriptionResult =
  | {
      ok: true;
      manageUrl: string | null;
      validUntil?: string;
      alreadyCancelled?: boolean;
      requiresConfirmation?: boolean;
    }
  | {
      ok: false;
      error: string;
      /** true → backend kan deze sub niet identificeren in Gumroad (legacy
       *  data of webhook-failure). User moet via support gecanceld worden. */
      noGumroadId?: boolean;
    };

/** Mark de active subscription als pending-cancel in onze DB en krijg de
 *  Gumroad-portal URL terug zodat user de cancellatie kan bevestigen.
 *  Vereist een ingelogde user (Bearer-token). */
export async function cancelSubscription(): Promise<CancelSubscriptionResult> {
  try {
    const raw = await apiCall<Record<string, unknown>>(
      '/api/cancel-subscription',
      { method: 'POST', auth: true },
    );
    return {
      ok: true,
      manageUrl:
        typeof raw.manage_url === 'string' ? raw.manage_url : null,
      validUntil:
        typeof raw.valid_until === 'string' ? raw.valid_until : undefined,
      alreadyCancelled: raw.already_cancelled === true,
      requiresConfirmation: raw.requires_confirmation === true,
    };
  } catch (e: any) {
    /* ApiError exposes `.body` met JSON-payload van backend bij non-2xx.
       Bij `422 no_gumroad_id` willen we user naar support sturen ipv
       Gumroad-portal. */
    const body = typeof e?.body === 'string' ? e.body : '';
    if (body && /no_gumroad_id/.test(body)) {
      return {
        ok: false,
        error:
          'We cannot cancel this subscription automatically. Please contact support so we can handle it manually.',
        noGumroadId: true,
      };
    }
    return {
      ok: false,
      error:
        typeof e?.message === 'string'
          ? e.message
          : 'Could not cancel subscription. Try again or contact support.',
    };
  }
}
