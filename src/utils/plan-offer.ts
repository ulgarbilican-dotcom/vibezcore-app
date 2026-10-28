/* ─────────────────────────────────────────────────────────────────────────
   VIBEZCORE — "Set your plan" / "Set your goal" voor een NIEUWE Premium-abonnee

   Operator, 28 okt 2026: een gebruiker die net Premium kocht, krijgt de vraag niet op het aankoopscherm maar wanneer hij zelf op het tabblad
   tikt:
     · State Control: na de rusthartslag-keuze → "Set your plan" → ja = /bracelet-set-day
     · Breathwork:    zodra de keuzepagina open is → "Set your goal" → ja = /build-choice (stap 1 van 5)
   Eén keer per tabblad en per toestel; alleen na een échte nieuwe aankoop (niet bij herstel of een bestaand abonnement — behalve in een
   testbuild, zodat het testaccount het kan zien); niet als er al een plan is. Teksten (PlanOfferHost.tsx) goedgekeurd door de operator, 28 okt 2026.
   ───────────────────────────────────────────────────────────────────────── */

import { reloadActiveBraceletPlan, getActiveBraceletPlan } from '@/utils/bracelet-plan-store';
import { getActivePlan, reloadActivePlan } from '@/utils/plan-store';
import { QA_ENABLED } from '@/utils/qa';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useRef, useState } from 'react';

export type PlanOfferKind = 'state' | 'breath';

const PENDING_KEY = 'vz_plan_offer_pending_v1';
const SEEN_KEY = 'vz_plan_offer_seen_v1';

type Flags = { state?: boolean; breath?: boolean };

/* Synchrone kopie van de openstaande vragen, voor beslissingen die niet kunnen wachten (Breath-tab: onboarding of de vraag). */
let pendingCache: Flags = {};
void AsyncStorage.getItem(PENDING_KEY)
  .then((raw) => {
    if (raw) pendingCache = { ...(JSON.parse(raw) as Flags), ...pendingCache };
  })
  .catch(() => {});

/** Staat de vraag voor dit tabblad nog open (nieuwe abonnee, nog niet getoond)? */
export function isPlanOfferPending(kind: PlanOfferKind): boolean {
  return pendingCache[kind] === true;
}

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

/* 28 okt 2026 (operator: "in Profile blijven na aankoop zodat de gebruiker zelf een tab aantikt"): het blad verschijnt pas als de
   gebruiker het tabblad ZELF opent (tabbalk of welkomstscherm) — zelfde regel als de onboardings. Een tik van vóór de aankoop telt niet. */
const tappedAt: Record<PlanOfferKind, number> = { state: 0, breath: 0 };
const tapListeners = new Set<() => void>();
export function notePlanOfferTabTap(kind: PlanOfferKind): void {
  tappedAt[kind] = Date.now();
  tapListeners.forEach((l) => l());
}

/* Het blad wordt getekend door PlanOfferHost (root-layout); deze module zegt enkel wanneer en welk. */
const sheetListeners = new Set<(k: PlanOfferKind | null) => void>();
export function subscribePlanOfferSheet(l: (k: PlanOfferKind | null) => void): () => void {
  sheetListeners.add(l);
  return () => {
    sheetListeners.delete(l);
  };
}

/** Een nieuwe Premium-aankoop is bevestigd: beide vragen staan klaar (voor wat nog niet eerder getoond is). */
export async function markPlanOfferPending(): Promise<void> {
  const seen = await read(SEEN_KEY);
  const pending = await read(PENDING_KEY);
  const next = {
    state: pending.state || QA_ENABLED || !seen.state,
    breath: pending.breath || QA_ENABLED || !seen.breath,
  };
  pendingCache = next;
  tappedAt.state = 0;
  tappedAt.breath = 0;
  await write(PENDING_KEY, next);
}

async function consume(kind: PlanOfferKind): Promise<void> {
  const pending = await read(PENDING_KEY);
  const seen = await read(SEEN_KEY);
  pendingCache = { ...pendingCache, [kind]: false };
  await write(PENDING_KEY, { ...pending, [kind]: false });
  await write(SEEN_KEY, { ...seen, [kind]: true });
}

/** Toont de vraag zodra `ready` waar is (tabblad open, hartslag gekozen / keuzepagina zichtbaar, geen sessie). */
export function usePlanOffer(kind: PlanOfferKind, ready: boolean): void {
  const shown = useRef(false);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const l = () => setTick((n) => n + 1);
    tapListeners.add(l);
    return () => {
      tapListeners.delete(l);
    };
  }, []);
  useEffect(() => {
    if (!ready || shown.current || tappedAt[kind] === 0) return;
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
      /* Het glasblad zelf: components/PlanOfferHost.tsx (root-layout). */
      sheetListeners.forEach((l) => l(kind));
    })();
    return () => {
      cancelled = true;
    };
  }, [kind, ready, tick]);
}
