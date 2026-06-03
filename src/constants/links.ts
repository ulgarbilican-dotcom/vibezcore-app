/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Externe links

   Single source of truth voor alle externe URLs die de native app gebruikt.
   Eén plek wijzigen wanneer Gumroad-producten verhuizen, het shop-domein
   muteert, of we naar een eigen checkout migreren.

   Iter 9dq v50 (2026-06-03): GUMROAD_URLS object vervangt de oude losse
   GUMROAD_URL constant. De oude waarde wees naar `stones-sterling-atelier.
   gumroad.com` — een legacy/ander account dat geen actieve VIBEZCORE-
   producten meer host. Canoniek is `vibezcore.gumroad.com` (operator-
   bevestigd). Inline duplicate in (tabs)/index.tsx is verwijderd.
   ─────────────────────────────────────────────────────────────────────── */

/** Gumroad-product-URLs voor Audio Library abonnementen.
 *
 *  Gebruik: `openExternal(GUMROAD_URLS[plan])` waar `plan` 'monthly' of
 *  'yearly' is. Beide URLs leiden naar de hosted Gumroad-checkout van
 *  het VIBEZCORE-account.
 */
export const GUMROAD_URLS: Record<'monthly' | 'yearly', string> = {
  monthly: 'https://vibezcore.gumroad.com/l/vibezcore-monthly',
  yearly: 'https://vibezcore.gumroad.com/l/vibezcore-yearly',
};

/** Convenience-alias voor consumers die niet expliciet monthly/yearly
 *  willen kiezen. Wijst standaard naar de yearly-aanbieding (=default
 *  selectie in het pricing-blok). */
export const GUMROAD_URL = GUMROAD_URLS.yearly;
