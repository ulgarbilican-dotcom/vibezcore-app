/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — alle gegevens op dit toestel wissen

   Audit 12 okt 2026: "Delete account" beloofde "listening history,
   favorites, and saved settings" te wissen, maar ruimde enkel de laatst
   beluisterde sessie op — geschiedenis, hartslag, plannen en favorieten
   bleven op het toestel. Settings → "Clear all local data" deed het wel,
   maar liet de lopende stores in het geheugen staan ("Restart the app").
   Eén gedeelde functie voor beide: eerst alles stoppen en de stores in
   het geheugen leegmaken, dan de opslag.
   ───────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { unload as unloadAudioPlayer } from '@/services/audio-player';
import { closeBreathSession } from '@/services/breath-session-host';
import { stopBraceletSessionMonitor } from '@/services/bracelet-session-monitor';
import { syncBraceletPlanReminder } from '@/services/reminders';
import { resetRestingPulse } from '@/services/resting-pulse';
import { saveActiveBraceletPlan } from '@/utils/bracelet-plan-store';
import { clearHistory as clearBraceletHistory } from '@/utils/bracelet-history';
import { clearBreathHistory } from '@/utils/breath-history';
import { setDevBraceletActivated } from '@/utils/dev-user-override';
import { clearHistory as clearListeningHistory } from '@/utils/history';
import { clearLastPlayed } from '@/utils/last-played';
import { clearActivePlan } from '@/utils/plan-store';
import { clearAllSavedPositions } from '@/utils/vzp';

/** Inloggen + de koppeling van een gast-aankoop (blijft bij "Clear data"). */
const AUTH_KEYS = [
  'vz_last_login_email',
  'vz_session_token',
  'vz_refresh_token',
  'vz_token_expires_at',
  'vz_user_email',
  'vz_auth_provider',
];
/* Een gast-aankoop hoort bij de store-account van het toestel, niet bij het
   VIBEZCORE-account — die koppeling blijft altijd staan. */
const PURCHASE_KEYS = ['vz_guest_purchase_rc_id', 'vz_pending_rc_link'];

async function quietly(fn: () => Promise<unknown> | unknown): Promise<void> {
  try {
    await fn();
  } catch {
    /* één onderdeel dat faalt mag de rest van het wissen niet tegenhouden */
  }
}

export async function wipeLocalData(opts: { keepAuth: boolean }): Promise<void> {
  /* 1. Alles wat loopt stoppen. unload zonder positie te bewaren (iter
        9dq v124), anders schreef hij na het wissen nog een positie weg. */
  closeBreathSession();
  await quietly(() => stopBraceletSessionMonitor());
  await quietly(() => unloadAudioPlayer({ skipSave: true }));

  /* 2. De stores in het geheugen leeg — geen herstart meer nodig. */
  await quietly(() => clearAllSavedPositions());
  await Promise.all([
    quietly(() => clearLastPlayed()),
    quietly(() => clearListeningHistory()),
    quietly(() => clearBraceletHistory()),
    quietly(() => clearBreathHistory()),
    quietly(() => clearActivePlan()),
    quietly(() => saveActiveBraceletPlan(null)),
    quietly(() => syncBraceletPlanReminder(null)),
    quietly(() => setDevBraceletActivated(false)),
  ]);
  resetRestingPulse();

  /* 3. De opslag zelf. */
  const keep = new Set([...PURCHASE_KEYS, ...(opts.keepAuth ? AUTH_KEYS : [])]);
  await quietly(async () => {
    const all = await AsyncStorage.getAllKeys();
    const toRemove = all.filter((k) => !keep.has(k));
    if (toRemove.length > 0) await AsyncStorage.multiRemove(toRemove);
  });

  /* 4. Geplande meldingen (herinneringen) weg. */
  await quietly(async () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    await require('expo-notifications').cancelAllScheduledNotificationsAsync();
  });
}
