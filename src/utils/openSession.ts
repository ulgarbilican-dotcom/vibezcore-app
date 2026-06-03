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
import { useCallback, useEffect, useState } from 'react';

export function openSession(sess: Session) {
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
  const { isPro } = useSubscription();
  const [isSignedIn, setIsSignedIn] = useState<boolean>(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const t = await getToken();
      if (!cancelled) setIsSignedIn(!!t);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return useCallback(
    (session: Session) => {
      const access = resolveAccess(session, isSignedIn, isPro);
      if (access === 'allowed') {
        openSession(session);
      } else if (access === 'needs-account') {
        showAccountWall(session.title);
      } else if (access === 'needs-pro') {
        /* Default naar yearly omdat dat de aanbevolen tier is (50% off
           vs monthly). User kan op subscribe-screen nog switchen. */
        router.push('/subscribe?tier=yearly' as never);
      }
    },
    [isSignedIn, isPro],
  );
}

/** Re-export voor convenience — sommige consumers willen alleen de tier
 *  weten zonder open-call. */
export type { AccessTier };
