/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — Wat een State Control-start voor Free betekent (19 okt 2026,
   operator: "free sessies kondigen de preview ALTIJD vooraf aan").

   Dezelfde regel als bracelet-control.tsx (`premiumLocked` / `freeFor`):
   - Premium, bracelet-eigenaar of dev-testvlag → 'full';
   - Free en dit is de ene gratis volledige sessie (stateFreeMode /
     stateFreeSessionUsedAt, na de State Control-onboarding) → 'free-full';
   - anders → 'preview' (30 s, daarna de paywall).
   ───────────────────────────────────────────────────────────────────── */

import { useSubscription } from '@/hooks/useSubscription';
import { useBraceletOwner } from '@/utils/dev-user-override';
import { useSetting } from '@/utils/settings';
import type { BreathStartKind } from '@/hooks/useBreathFreeStart';

export function useStateFreeStart(): (mode: number) => BreathStartKind {
  const sub = useSubscription();
  const ownsBracelet = useBraceletOwner();
  const [testFullSessions] = useSetting('testFullSessions');
  const [freeUsedAt] = useSetting('stateFreeSessionUsedAt');
  const [freeMode] = useSetting('stateFreeMode');
  const premiumLocked = !sub.isLoading && !sub.isPro && !ownsBracelet && !(__DEV__ && testFullSessions);
  return (mode: number) => {
    if (!premiumLocked) return 'full';
    const free = freeUsedAt === null && freeMode !== null && (freeMode === -1 || mode === freeMode);
    return free ? 'free-full' : 'preview';
  };
}
