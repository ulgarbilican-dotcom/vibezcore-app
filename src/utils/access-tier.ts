/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Access-tier model (operator-besluit 2026-06-03)

   Drie tiers bepalen welke sessies een user kan luisteren:

     'public'  → iedereen, zonder account
                 (alle Soundscapes + 5 series-openers — operator kiest welke 5)

     'account' → 7-dagen-trial of abonnement vereist (8 okt 2026; was
                 "ingelogd account"). 17 series-openers, samen met de 10
                 'public' = de 27 trial-sessies. Label: FREE WITH TRIAL.

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
  /* Fallback voor data zonder explicit accessTier.
     Iter 9dq v65 (2026-06-03): Soundscapes is niet langer blanket-public.
     Operator-besluit: alleen de eerste sessie van elke subcategorie is
     vrij (= 4 stuks bij 4 subcats), de rest is PRO. Implementatie: laat
     Soundscapes-sessies hetzelfde `free`-veld respecteren als series.
     Operator markeert per subcat één sessie als free:true (Theta Arabic,
     Delta Descent, Background Calm + Forest Sanctuary voor Harmonic). */
  if (session.series === 'Soundscapes') {
    return session.free ? 'public' : 'pro';
  }
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
 *    - isTrialing: zit de user in de 7-dagen-proefperiode (RevenueCat
 *      `periodType === 'TRIAL'`)? Operator, 26 september 2026
 *      (toegangsmodel-gat gedicht): `isPro` is ook `true` tijdens een
 *      trial (RevenueCat telt een trial als een actieve entitlement), dus
 *      zonder dit param zou een trial-user meteen de hele PRO-catalogus
 *      zien. Bedoeld model (project-free-tier-facts, operator-bevestigd):
 *      trial ontgrendelt enkel de 'account'-tier content (27 sessies) +
 *      Breathwork, NIET de 'pro'-tier catalogus — dat blijft pas
 *      toegankelijk na een ECHT betaald jaar. Default `false` zodat
 *      bestaande callers die dit param niet meegeven het oude (nu
 *      bewust strengere) gedrag niet stilzwijgend omzeilen. */
export function resolveAccess(
  session: Session,
  isSignedIn: boolean,
  isPro: boolean,
  isTrialing: boolean = false,
): 'allowed' | 'needs-account' | 'needs-pro' {
  const tier = getEffectiveTier(session);
  switch (tier) {
    case 'public':
      return 'allowed';
    /* Operator, 8 okt 2026 ("27 is enkel voor trial, 10 voor free user"):
       'account' is voortaan de TRIAL-laag — een gratis account op zich
       ontgrendelt niets extra. Enkel trial of abonnement (isPro is ook
       true tijdens de trial). Gast en free account zien dus hetzelfde:
       de 10 'public'-sessies. 'needs-account' toont de trial-sheet
       (AccountWallModal → /subscribe). */
    case 'account':
      return isPro ? 'allowed' : 'needs-account';
    case 'pro':
      return isPro && !isTrialing ? 'allowed' : 'needs-pro';
  }
}

/** UI-helper: korte label voor de tier-badge in LibraryListRow. */
export function tierBadgeLabel(tier: AccessTier): string | null {
  switch (tier) {
    case 'public':
      return 'FREE';
    case 'account':
      return 'FREE WITH TRIAL';
    case 'pro':
      return 'PRO';
  }
}

/** UI-helper: kleur-token voor de tier-badge. */
/* Operator, 14 september 2026: "account"-tier gebruikte het signaalblauw
   (#3a8fff) — dat kanaal is voorbehouden aan haptic-pulsen/"nu actief",
   nooit aan een statuslabel. Vervangen door Royal Indigo Light
   (#6E85C4), de huisstijl-kleur voor accent-tekst/labels. */
export function tierBadgeColor(tier: AccessTier): string {
  switch (tier) {
    /* Operator ("check free sessions in de pill ook, daar moet ook alles
       correct zijn"): '#4ade80' is GROEN — in (tabs)/index.tsx al
       vastgelegd als exclusief voor de completion-state ("fully
       listened"), nooit als decoratieve "dit is gratis"-tint (zie C.free
       daar). Deze gedeelde helper (LibraryListRow → /library/new,
       /favorites, /free) had die fix nog niet gekregen — zelfde witte
       tint als C.free, geen groen meer. */
    case 'public':
      return 'rgba(255,255,255,0.72)'; /* wit — direct beschikbaar */
    case 'account':
      return '#6E85C4'; /* Royal Indigo Light — actie nodig om te unlocken */
    case 'pro':
      return 'rgba(255,255,255,0.55)'; /* dim wit — premium gating */
  }
}
