/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — een State Control-sessie meteen starten vanuit een plan

   Eén plek voor "Tap to start", "Start session" en een tik in Your protocol
   (operator, 5 okt 2026): zelfde toegangsregel als de Start-knop op het
   State Control-scherm (abonnement, trial of geactiveerde bracelet), dan
   de sessie starten via de sessie-monitor en het scherm openen. Zonder
   toegang: de paywall, op de plek zelf.
   ───────────────────────────────────────────────────────────────────────── */

import { useState } from 'react';
import * as Haptics from 'expo-haptics';
import { useSubscription } from '@/hooks/useSubscription';
import type { BraceletMode } from '@/services/ble-contract';
import { startStateControlNow } from '@/services/bracelet-session-monitor';
import { useBraceletOwner } from '@/utils/dev-user-override';
import { useSetting } from '@/utils/settings';
import { openStateControl } from '@/utils/state-control-ui';
import { hapticTap } from '@/utils/haptics';

export function useStartStateControl() {
  const subscription = useSubscription();
  const ownsBracelet = useBraceletOwner();
  const [testFullSessions] = useSetting('testFullSessions');
  const [paywallOpen, setPaywallOpen] = useState(false);

  const start = (mode: BraceletMode, minutes: number) => {
    hapticTap();
    if (subscription.isLoading) return;
    const locked = !subscription.isPro && !ownsBracelet && !(__DEV__ && testFullSessions);
    if (locked) {
      setPaywallOpen(true);
      return;
    }
    void startStateControlNow(mode, minutes).then(() => openStateControl());
  };

  return { start, paywallOpen, closePaywall: () => setPaywallOpen(false) };
}
