/* ───────────────────────────────────────────────────────────────────────────
   VIBEZCORE — zachte accountuitnodiging (26 okt 2026, operator: "alles doen")

   Gast-first blijft: niets staat achter een login en er verschijnt NOOIT een muur of popup. Pas nadat iemand
   echt iets heeft gedaan (een afgeronde ademsessie, of de gratis State Control-sessie gebruikt) biedt de Activity-pagina
   zacht aan om een gratis account te maken — met als eerlijke reden dat voortgang, plan en instellingen dan op elk
   toestel meekomen (Backup & Sync). Apple 5.1.1: de lokale functies blijven voor iedereen werken.

   Regels: enkel voor gasten · enkel na een echte sessie · "Not now" verbergt de kaart minstens 7 dagen · hoogstens
   twee keer; daarna nooit meer vanzelf. Na inloggen verdwijnt de kaart vanzelf.
   ───────────────────────────────────────────────────────────────────────────── */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

import { hasStoredSession } from '@/services/auth';
import { useBreathHistory } from '@/utils/breath-history';
import { useSetting } from '@/utils/settings';

const KEY = 'vz_account_invite_v1';
const MAX_DISMISSALS = 2;
const PAUSE_MS = 7 * 86_400_000;

type Stored = { dismissals: number; lastAt: number };

/** Mag de kaart nu getoond worden? Zuivere regel, los van opslag (unit-testbaar). */
export function shouldShowInvite(input: { guest: boolean; didSomething: boolean; stored: Stored; now: number }): boolean {
  const { guest, didSomething, stored, now } = input;
  if (!guest || !didSomething) return false;
  if (stored.dismissals >= MAX_DISMISSALS) return false;
  return stored.dismissals === 0 || now - stored.lastAt >= PAUSE_MS;
}

async function load(): Promise<Stored> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const p = raw ? JSON.parse(raw) : null;
    if (p && typeof p.dismissals === 'number' && typeof p.lastAt === 'number') return p;
  } catch {
    /* corrupt → alsof nooit getoond */
  }
  return { dismissals: 0, lastAt: 0 };
}

/** Hook voor de Activity-pagina. */
export function useAccountInvite(): { show: boolean; dismiss: () => void } {
  const history = useBreathHistory();
  const [stateFree] = useSetting('stateFreeSessionUsedAt');
  const [breathFree] = useSetting('breathFreeSessionUsedAt');
  const [guest, setGuest] = useState(false);
  const [stored, setStored] = useState<Stored>({ dismissals: 0, lastAt: 0 });
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [signedIn, s] = await Promise.all([hasStoredSession(), load()]);
      if (!alive) return;
      setGuest(!signedIn);
      setStored(s);
      setReady(true);
    })();
    return () => {
      alive = false;
    };
  }, []);

  const didSomething = history.length > 0 || stateFree != null || breathFree != null;
  const show = ready && shouldShowInvite({ guest, didSomething, stored, now: Date.now() });

  const dismiss = useCallback(() => {
    const next = { dismissals: stored.dismissals + 1, lastAt: Date.now() };
    setStored(next);
    AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
  }, [stored.dismissals]);

  return { show, dismiss };
}
