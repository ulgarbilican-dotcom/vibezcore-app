/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Access-tier model (operator-besluit 2026-06-03)

   Drie tiers bepalen welke sessies een user kan luisteren:

     'public'  → iedereen, zonder account
                 (alle Soundscapes + 5 series-openers — operator kiest welke 5)

     'account' → ingelogd account vereist, geen sub
                 (9 overige series-openers — email-capture funnel)

     'pro'     → audio-PRO subscription vereist
                 (sessies 2-5 van elk van de 14 series — ~56 sessies)

   ── Backward-compat ──
   De Session-type heeft een optioneel `accessTier`-veld. Wanneer een sessie
   het veld NIET expliciet zet, gebruiken we deze fallback-regels op basis van
   het bestaande `free`-veld:

     - series === 'Soundscapes'   → 'public'
     - free === true              → 'account'  (was eerder simpelweg "free")
     - free === false             → 'pro'

   Zo werkt de bestaande audio-library-data.ts onmiddellijk in het nieuwe
   model zonder dat we elke sessie hoeven te muteren. De operator promoveert
   later 5 series-openers van 'account' → 'public' door explicit `accessTier:
   'public'` toe te voegen aan die rijen.

   Bij content-uitbreidingen (nieuwe series) wijst de operator gewoon per
   nieuwe sessie het juiste tier toe.
   ─────────────────────────────────────────────────────────────────────── */

import type { Session } from '@/data/audio-library-data';

export type AccessTier = 'public' | 'account' | 'pro';

/** Resolve de effectieve tier voor een sessie. Honoreert explicit
 *  `accessTier` op de sessie; valt anders terug op de regels hierboven.
 *
 *  Dit is de ENIGE plek waar we tier-resolutie doen — UI- en open-handlers
 *  roepen deze functie aan, NIET de fallback-logica zelf.
 *
 *  Iter 9dq v62 (2026-06-03): operator-rollback van het account-gating
 *  experiment. Default voor `free:true` is nu 'public' ipv 'account' —
 *  dat herstelt het gedrag van vóór de 3-tier-introductie (alle eerste-
 *  sessies + Soundscapes zijn vrij toegankelijk, geen account vereist).
 *  Framework blijft intact: operator kan later expliciet `accessTier:
 *  'account'` zetten op specifieke sessies wanneer 'ie de email-gating
 *  alsnog wil invoeren, zonder code-rewrite. */
export function getEffectiveTier(session: Session): AccessTier {
  if (session.accessTier) return session.accessTier;
  /* Fallback voor data zonder explicit accessTier. */
  if (session.series === 'Soundscapes') return 'public';
  if (session.free) return 'public';
  return 'pro';
}

/** Wat het resultaat zou zijn als de user op deze sessie tikt.
 *  Drie uitkomsten:
 *    - 'allowed'        → openSession kan firen
 *    - 'needs-account'  → toon AccountWallModal (account-creatie)
 *    - 'needs-pro'      → push naar /subscribe (IAP-flow)
 *
 *  Parameters:
 *    - isSignedIn: is er een geldige Supabase-session?
 *    - isPro:      heeft de user een actieve audio-subscription?
 */
export function resolveAccess(
  session: Session,
  isSignedIn: boolean,
  isPro: boolean,
): 'allowed' | 'needs-account' | 'needs-pro' {
  const tier = getEffectiveTier(session);
  switch (tier) {
    case 'public':
      return 'allowed';
    case 'account':
      return isSignedIn ? 'allowed' : 'needs-account';
    case 'pro':
      return isPro ? 'allowed' : 'needs-pro';
  }
}

/** UI-helper: korte label voor de tier-badge in LibraryListRow. */
export function tierBadgeLabel(tier: AccessTier): string | null {
  switch (tier) {
    case 'public':
      return 'FREE';
    case 'account':
      return 'FREE WITH ACCOUNT';
    case 'pro':
      return 'PRO';
  }
}

/** UI-helper: kleur-token voor de tier-badge. */
export function tierBadgeColor(tier: AccessTier): string {
  switch (tier) {
    case 'public':
      return '#4ade80'; /* groen — direct beschikbaar */
    case 'account':
      return '#3a8fff'; /* blauw — actie nodig om te unlocken (account) */
    case 'pro':
      return 'rgba(255,255,255,0.55)'; /* dim wit — premium gating */
  }
}
