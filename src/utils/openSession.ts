/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — openSession util

   Centrale helper voor het openen van een sessie in de player. Wordt gedeeld
   tussen de Audio Library-tab en de sub-pages onder /library/. Param-shape
   identiek aan wat player.tsx leest, dus de player blijft ongewijzigd.

   Iter 9dq v59 (2026-06-03): nieuw access-tier-model. `openSession` zelf
   blijft ongewijzigd (rauwe push naar /player); de gating-logica zit in
   `useGatedOpenSession()` zodat callers de tier-check niet zelf hoeven te
   doen. Callers die de oude open-direct-flow willen (bv. auto-play-next
   na een PRO-sessie) kunnen openSession() rechtstreeks blijven roepen.
   ─────────────────────────────────────────────────────────────────────── */

import { useSubscription } from '@/hooks/useSubscription';
import { getToken } from '@/services/auth';
import {
  resolveAccess,
  type AccessTier,
} from '@/utils/access-tier';
import { showAccountWall } from '@/components/AccountWallModal';
import type { Session } from '@/data/audio-library-data';
import { router } from 'expo-router';
import { useCallback } from 'react';

/* Operator, 26 september 2026 ("weer zwart scherm, nu bij een andere
   gratis sessie — kijk alle open-sessie-paden na"): de crash zat NIET in
   de tier-gating (die werkt correct) maar in een generieke, scherm-
   onafhankelijke race — `services/audio-player.ts`'s status-listener
   stuurt 4×/seconde een synchrone state-update. Valt zo'n tick precies
   samen met de commit van de navigatie naar `/player`, dan geeft
   Reanimated/Fabric een scheduler-reëntrantiecrash ("Should not already
   be working") — dit heeft NIETS te maken met welke sessie of welk
   scherm, dus elke eerdere per-scherm workaround (enkel in het
   pijlerscherm) miste alle andere aanroepers. Fix hier, op de ENE
   centrale plek die alle open-paden delen (gated én ongated), met de
   zelfde bekende, al elders in deze codebase gedocumenteerde oplossing:
   de navigatie één tick uitstellen (`setTimeout(...,0)`) zodat React
   eerst het huidige scherm afrondt vóór `/player` begint te mounten. */
/* Dubbeltik-bescherming (audit 8 okt 2026): twee snelle tikken zetten
   anders twee spelers op de stapel. */
let lastOpenAt = 0;
export function openSession(sess: Session) {
  const now = Date.now();
  if (now - lastOpenAt < 600) return;
  lastOpenAt = now;
  setTimeout(() => {
    router.push({
      pathname: '/player',
      params: {
        title: sess.title,
        series: sess.series,
        url: sess.url,
        free: sess.free ? 'true' : 'false',
        desc: sess.desc,
      },
    });
  }, 0);
}

/** React-hook variant met tier-gating. Roep aan in een component, gebruik
 *  de teruggegeven functie als onPress-handler. Drie paden:
 *
 *    - 'public' tier            → openSession()
 *    - 'account' tier + ingelogd → openSession()
 *    - 'account' tier + uitgelogd → AccountWallModal verschijnt
 *    - 'pro' tier + actieve sub  → openSession()
 *    - 'pro' tier + geen sub     → push naar /subscribe?tier=yearly
 *
 *  Hook tracked de auth-token via een eenvoudige polling-by-mount;
 *  zwaardere events (token-refresh midden-sessie, sign-out tijdens
 *  scroll) komen automatisch door wanneer de subscribed component
 *  re-rendert. */
export function useGatedOpenSession() {
  const { isPro, isTrialing } = useSubscription();

  return useCallback(
    async (session: Session) => {
      /* Audit 8 okt 2026: inlogstatus op het moment van de tik — het
         Library-tabblad blijft gemonteerd, dus een eenmalige check bij het
         openen ervan raakte achterhaald na in- of uitloggen. */
      const isSignedIn = !!(await getToken());
      /* Operator, 7 okt 2026: "voor premium users is alles unlocked" — een
         Premium-gebruiker krijgt nooit de account-muur. Heeft hij (gast-
         aankoop) nog geen account, dan vraagt de speler daarna in één stap
         om er een te maken; zijn Premium gaat mee (player.tsx). */
      const access = resolveAccess(session, isSignedIn || isPro, isPro, isTrialing);
      if (access === 'allowed') {
        openSession(session);
      } else if (access === 'needs-account') {
        showAccountWall(session.title);
      } else if (access === 'needs-pro') {
        /* Iter 9dq v64 (2026-06-03, operator-keuze): PRO-sessies voor
           non-PRO users gaan terug naar de player ipv direct naar
           /subscribe. De player detecteert via shouldPreview() dat er
           geen actieve sub is en signt de URL met preview=true → 60-sec
           cap → upsell-modal. Die modal route't dan naar /subscribe
           (zie player.tsx — "Get full access"-knop).

           Behoud van de 60-sec-preview is conversie-strategie: laat user
           proeven vóór upsell. Direct doorpushen naar /subscribe was
           aggressiever en is bewust teruggedraaid voor launch. */
        openSession(session);
      }
    },
    [isPro, isTrialing],
  );
}

/** Re-export voor convenience — sommige consumers willen alleen de tier
 *  weten zonder open-call. */
export type { AccessTier };
