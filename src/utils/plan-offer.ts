/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — "Set your plan" / "Set your goal" voor een NIEUWE Premium-abonnee

   Operator, 28 okt 2026: een gebruiker die net Premium kocht, krijgt de vraag niet op het aankoopscherm maar wanneer hij zelf op het tabblad
   tikt:
     · State Control: na de rusthartslag-keuze → "Set your plan" → ja = /bracelet-set-day
     · Breathwork:    zodra de keuzepagina open is → "Set your goal" → ja = /build-choice (stap 1 van 5)
   Eén keer per tabblad en per toestel; alleen na een échte nieuwe aankoop (niet bij herstel of een bestaand abonnement — behalve in een
   testbuild, zodat het testaccount het kan zien); niet als er al een plan is. [TEKST] concept: de definitieve tekst is aan de operator.
   ───────────────────────────────────────────────────────────────────────── */

import { showVibezAlert } from '@/components/VibezAlert';
import { reloadActiveBraceletPlan, getActiveBraceletPlan } from '@/utils/bracelet-plan-store';
import { getActivePlan, reloadActivePlan } from '@/utils/plan-store';
import { QA_ENABLED } from '@/utils/qa';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import { useEffect, useRef } from 'react';

export type PlanOfferKind = 'state' | 'breath';

const PENDING_KEY = 'vz_plan_offer_pending_v1';
const SEEN_KEY = 'vz_plan_offer_seen_v1';

type Flags = { state?: boolean; breath?: boolean };

async function read(key: string): Promise<Flags> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Flags) : {};
  } catch {
    return {};
  }
}
async function write(key: string, v: Flags): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(v));
  } catch {
    /* swallow */
  }
}

/** Een nieuwe Premium-aankoop is bevestigd: beide vragen staan klaar (voor wat nog niet eerder getoond is). */
export async function markPlanOfferPending(): Promise<void> {
  const seen = await read(SEEN_KEY);
  const pending = await read(PENDING_KEY);
  await write(PENDING_KEY, {
    state: pending.state || QA_ENABLED || !seen.state,
    breath: pending.breath || QA_ENABLED || !seen.breath,
  });
}

async function consume(kind: PlanOfferKind): Promise<void> {
  const pending = await read(PENDING_KEY);
  const seen = await read(SEEN_KEY);
  await write(PENDING_KEY, { ...pending, [kind]: false });
  await write(SEEN_KEY, { ...seen, [kind]: true });
}

/** Toont de vraag zodra `ready` waar is (tabblad open, hartslag gekozen / keuzepagina zichtbaar, geen sessie). */
export function usePlanOffer(kind: PlanOfferKind, ready: boolean): void {
  const shown = useRef(false);
  useEffect(() => {
    if (!ready || shown.current) return;
    let cancelled = false;
    void (async () => {
      const pending = await read(PENDING_KEY);
      if (!pending[kind] || cancelled || shown.current) return;
      if (kind === 'breath') {
        await reloadActivePlan();
        if (getActivePlan()) {
          await consume(kind);
          return;
        }
      } else {
        await reloadActiveBraceletPlan();
        if (getActiveBraceletPlan()) {
          await consume(kind);
          return;
        }
      }
      if (cancelled || shown.current) return;
      shown.current = true;
      await consume(kind);
      const state = kind === 'state';
      const choice = await showVibezAlert({
        title: state ? 'Set your plan' : 'Set your goal',
        message: state
          ? "Choose your sessions and your times. VIBEZCORE builds your daily plan and can remind you when it's time."
          : "Choose your goal and your times. VIBEZCORE builds your daily plan and can remind you when it's time.",
        buttons: [
          { text: state ? 'Set my plan' : 'Set my goal', style: 'primary' },
          { text: 'Not now', style: 'cancel' },
        ],
      });
      if (choice === 0) router.push((state ? '/bracelet-set-day' : '/build-choice') as never);
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, ready]);
}
