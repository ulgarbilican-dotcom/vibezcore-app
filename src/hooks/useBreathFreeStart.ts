/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Wat een Breathwork-start voor Free betekent (19 okt 2026,
   operator: "free sessies kondigen de preview ALTIJD vooraf aan").

   Dezelfde regel als breath-setup.tsx / breath-session.tsx (`locked`):
   - Premium (of dev-testvlag) → 'full', niets nieuws te tonen;
   - Free, ene gratis volledige sessie nog niet gebruikt → 'free-full' (de
     start claimt ze via claimFreeSessionParam);
   - Free, al gebruikt → 'preview' (30 s, daarna de paywall).
   ───────────────────────────────────────────────────────────────────── */

import { useSubscription } from '@/hooks/useSubscription';
import { useSetting } from '@/utils/settings';

export type BreathStartKind = 'full' | 'free-full' | 'preview';

export function useBreathFreeStart(): BreathStartKind {
  const sub = useSubscription();
  const [freeSessionUsedAt] = useSetting('breathFreeSessionUsedAt');
  const [testFullSessions] = useSetting('testFullSessions');
  if (sub.isLoading || sub.isPro || (__DEV__ && testFullSessions)) return 'full';
  return freeSessionUsedAt ? 'preview' : 'free-full';
}
